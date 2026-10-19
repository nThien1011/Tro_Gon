import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleSnapshot } from "../src/domain/snapshot.ts";
import { commandInput, contactInput } from "../src/domain/input.ts";
import { hashPassword, verifyPassword } from "../src/auth/password.ts";
import { readConfig } from "../src/config.ts";
import { seedData } from "../../src/domain/seed.ts";
import { executeCommand } from "../../src/domain/commands.ts";

test("ảnh chỉ số đang chờ chỉ chia sẻ với đúng người thuê, chủ trọ và admin; thông báo chỉ của người nhận", () => {
  const db = { ...seedData(), credentials: [] };
  executeCommand(db, "tenant", {
    type: "meter.submit",
    payload: {
      roomId: "r1",
      kind: "electricity",
      period: "2030-01",
      value: 2000,
      photo: "data:image/png;base64,AA==",
      confirmed: true,
    },
  });
  const view = (id: string | null) =>
    visibleSnapshot(db, db.users.find((u) => u.id === id) || null);
  assert.equal(view("tenant").meterReadings.length, 1);
  assert.equal(view("owner").meterReadings.length, 1);
  assert.equal(view("admin").meterReadings.length, 1);
  for (const id of [null, "tenant2", "owner2"]) {
    assert.equal(view(id).meterReadings.length, 0);
    assert.equal(view(id).notifications.length, 0);
  }
  assert.equal(view("admin").notifications.length, 0);
  assert.ok(view("owner").notifications.every((n) => n.userId === "owner"));
});

test("guest chỉ nhận tin công khai và không nhận hóa đơn, người thuê, ngân hàng hoặc credentials", () => {
  const db = {
    ...seedData(),
    credentials: [{ userId: "owner", salt: "private", hash: "private" }],
  };
  db.users[1].bankAccount = "1234567890";
  const view = visibleSnapshot(db, null);
  assert.equal(view.invoices.length, 0);
  assert.equal(view.tenancies.length, 0);
  assert.equal(view.audit.length, 0);
  assert.ok(view.listings.every((l) => l.status === "published"));
  assert.ok(view.users.every((u) => u.role === "owner" && !u.bankAccount));
  assert.equal("credentials" in view, false);
  assert.ok(view.rooms.every((r) => r.electricity === 0 && r.water === 0));
});
test("người thuê chỉ xem hóa đơn và hồ sơ thuê của mình", () => {
  const db = { ...seedData(), credentials: [] };
  const tenant = db.users.find((u) => u.id === "tenant")!;
  db.invoices.push({ ...db.invoices[0], id: "private-draft", status: "draft" });
  const view = visibleSnapshot(db, tenant);
  assert.ok(view.invoices.every((i) => i.tenantId === tenant.id));
  assert.ok(view.invoices.every((i) => i.status !== "draft"));
  assert.ok(view.tenancies.every((t) => t.tenantId === tenant.id));
  assert.equal(
    view.users.some((u) => u.id === "tenant2"),
    false,
  );
});
test("chủ trọ khác không nhận hóa đơn, người ở hoặc chỉ số phòng riêng", () => {
  const db = { ...seedData(), credentials: [] };
  const view = visibleSnapshot(
    db,
    db.users.find((u) => u.id === "owner2")!,
  );
  assert.equal(view.invoices.length, 0);
  assert.equal(
    view.rooms.some((r) => r.id === "r1"),
    false,
  );
  assert.equal(
    view.users.some((u) => u.id === "tenant"),
    false,
  );
});
test("phòng đã lưu không làm lộ bản nháp chỉnh sửa", () => {
  const db = { ...seedData(), credentials: [] };
  db.favorites.push({ userId: "tenant", listingId: "l2" });
  db.listings[1].status = "draft";
  assert.equal(
    visibleSnapshot(db, db.users[2]).listings.some((l) => l.id === "l2"),
    false,
  );
});
test("đầu vào không cho tự cấp role admin hoặc dùng chuỗi thay boolean", () => {
  assert.throws(() => commandInput({ type: "unknown", payload: {} }));
  assert.throws(() =>
    commandInput({ type: "invoice.save", payload: { issue: "false" } }),
  );
  assert.deepEqual(contactInput("  OWNER@EXAMPLE.COM ", "+84 900000001"), {
    email: "owner@example.com",
    phone: "0900000001",
  });
  assert.throws(() => contactInput("", ""));
});
test("mật khẩu dùng salt riêng và so khớp đúng", async () => {
  const a = await hashPassword("Test-password-2026"),
    b = await hashPassword("Test-password-2026");
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
  assert.ok(await verifyPassword("Test-password-2026", a));
  assert.equal(await verifyPassword("wrong-password", a), false);
});
test("production từ chối root, HTTP origin hoặc dữ liệu seed tự động", () => {
  assert.throws(() =>
    readConfig({
      NODE_ENV: "production",
      APP_ORIGIN: "http://example.com",
      DB_USER: "root",
      DB_PASSWORD: "password",
    }),
  );
  assert.throws(() =>
    readConfig({
      NODE_ENV: "production",
      APP_ORIGIN: "https://example.com",
      DB_USER: "root",
      DB_PASSWORD: "password",
    }),
  );
  assert.throws(() =>
    readConfig({
      NODE_ENV: "production",
      APP_ORIGIN: "https://example.com",
      DB_USER: "trogon",
      DB_PASSWORD: "password",
      SEED_DEMO: "true",
    }),
  );
});
test("snapshot không dùng phiên của tài khoản đã bị khóa", () => {
  const db = { ...seedData(), credentials: [] };
  const viewer = { ...db.users[1] };
  db.users[1].active = false;
  const view = visibleSnapshot(db, viewer);
  assert.equal(view.invoices.length, 0);
  assert.equal(view.tenancies.length, 0);
});
