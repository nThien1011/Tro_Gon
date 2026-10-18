import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice, parseMeterText } from "../src/domain/billing.ts";
import { executeCommand } from "../src/domain/commands.ts";
import { seedData } from "../src/domain/seed.ts";
import type { Database } from "../src/domain/models.ts";
const database = (): Database => ({ ...seedData(), credentials: [] });
test("tính tiền điện nước bằng chênh lệch và làm tròn VND", () => {
  const result = calculateInvoice({
    oldElectricity: 1482,
    newElectricity: 1573,
    oldWater: 120,
    newWater: 125.5,
    electricityRate: 3500,
    waterRate: 18000,
    rent: 3500000,
    serviceFee: 150000,
  });
  assert.equal(result.electricity, 318500);
  assert.equal(result.water, 99000);
  assert.equal(result.total, 4067500);
});
test("từ chối chỉ số giảm, NaN và chi phí âm", () => {
  const base = {
    oldElectricity: 100,
    newElectricity: 90,
    oldWater: 10,
    newWater: 12,
    electricityRate: 3500,
    waterRate: 18000,
    rent: 3000000,
    serviceFee: 150000,
  };
  assert.throws(() => calculateInvoice(base), /Chỉ số mới/);
  assert.throws(
    () => calculateInvoice({ ...base, newElectricity: NaN }),
    /hợp lệ/,
  );
  assert.throws(() => calculateInvoice({ ...base, rent: -1 }), /hợp lệ/);
});
test("người thuê không sửa phòng hoặc tự xác nhận thu tiền", () => {
  assert.throws(
    () =>
      executeCommand(database(), "tenant", {
        type: "room.delete",
        payload: { id: "r2" },
      }),
    /quyền/,
  );
  assert.throws(
    () =>
      executeCommand(database(), "tenant", {
        type: "payment.confirm",
        payload: { id: "i1" },
      }),
    /quyền/,
  );
});
test("chủ trọ không can thiệp tòa nhà của chủ khác", () => {
  assert.throws(
    () =>
      executeCommand(database(), "owner", {
        type: "building.delete",
        payload: { id: "b3" },
      }),
    /quyền/,
  );
});
test("thêm người vào phòng cập nhật đồng thời phòng và tin đăng, chặn thêm trùng", () => {
  let db = database();
  db.tenancies = [];
  db.rooms[0].status = "available";
  db = executeCommand(db, "owner", {
    type: "tenancy.assign",
    payload: {
      roomId: "r2",
      contact: "nguoithue@trogon.demo",
      people: 1,
      startDate: "2026-10-01",
      endDate: "2027-10-01",
    },
  });
  assert.equal(db.rooms.find((r) => r.id === "r2")?.status, "occupied");
  assert.equal(db.listings.find((l) => l.roomId === "r2")?.status, "hidden");
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "tenancy.assign",
        payload: {
          roomId: "r2",
          contact: "thaovy@trogon.demo",
          people: 1,
          startDate: "2026-10-01",
          endDate: "2027-10-01",
        },
      }),
    /không còn trống/,
  );
});
test("phát hành giữ snapshot, cập nhật chỉ số và chặn trùng kỳ", () => {
  let db = database();
  const room = db.rooms.find((r) => r.id === "r3")!;
  const old = room.electricity;
  const command = {
    type: "invoice.save",
    payload: {
      roomId: "r3",
      period: "2030-01",
      newElectricity: old + 100,
      newWater: room.water + 5,
      dueDate: "2030-02-05",
      issue: true,
    },
  };
  db = executeCommand(db, "owner", command);
  const invoice = db.invoices.at(-1)!;
  assert.equal(room.electricity, old + 100);
  room.electricityRate = 9000;
  assert.equal(invoice.electricityRate, 3500);
  assert.throws(() => executeCommand(db, "owner", command), /đã phát hành/);
});
test("thông báo thanh toán chưa làm hóa đơn thành đã thu", () => {
  let db = executeCommand(database(), "tenant", {
    type: "payment.notify",
    payload: { id: "i1" },
  });
  assert.equal(db.invoices[0].paymentStatus, "pending");
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "invoice.cancel",
        payload: { id: "i1" },
      }),
    /đang chờ/,
  );
  db = executeCommand(db, "owner", {
    type: "payment.confirm",
    payload: { id: "i1" },
  });
  assert.equal(db.invoices[0].paymentStatus, "paid");
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "payment.confirm",
        payload: { id: "i1" },
      }),
    /đã thu/,
  );
});
test("hủy hóa đơn mới nhất khôi phục chỉ số gốc", () => {
  let db = database();
  const r = db.rooms.find((r) => r.id === "r3")!,
    old = r.electricity;
  db = executeCommand(db, "owner", {
    type: "invoice.save",
    payload: {
      roomId: "r3",
      period: "2030-01",
      newElectricity: old + 10,
      newWater: r.water + 1,
      dueDate: "2030-02-05",
      issue: true,
    },
  });
  db = executeCommand(db, "owner", {
    type: "invoice.cancel",
    payload: { id: db.invoices.at(-1)!.id },
  });
  assert.equal(r.electricity, old);
});
test("người ngoài hội thoại không được gửi tin", () => {
  let db = executeCommand(database(), "tenant", {
    type: "conversation.start",
    payload: { listingId: "l2" },
  });
  assert.throws(
    () =>
      executeCommand(db, "tenant2", {
        type: "message.send",
        payload: { id: db.conversations[0].id, body: "hello" },
      }),
    /không thuộc/,
  );
});
test("không xóa phòng có lịch sử và không khóa admin", () => {
  assert.throws(
    () =>
      executeCommand(database(), "owner", {
        type: "room.delete",
        payload: { id: "r1" },
      }),
    /lịch sử/,
  );
  assert.throws(
    () =>
      executeCommand(database(), "admin", {
        type: "user.toggle",
        payload: { id: "admin" },
      }),
    /quản trị/,
  );
});
test("OCR chỉ đưa gợi ý số phù hợp, không tự chế số", () => {
  assert.equal(parseMeterText("001573 kWh", 1482), 1573);
  assert.equal(parseMeterText("125,5", 120), 125.5);
  assert.equal(parseMeterText("không đọc được", 100), null);
  assert.equal(parseMeterText("20", 100), null);
});
