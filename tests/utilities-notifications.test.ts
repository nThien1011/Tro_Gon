import { test } from "node:test";
import assert from "node:assert/strict";
import { seedData } from "../src/domain/seed.ts";
import { executeCommand } from "../src/domain/commands.ts";
import { calculateInvoice, parseMeterText } from "../src/domain/billing.ts";
import type { Database } from "../src/domain/models.ts";

const database = (): Database => ({ ...seedData(), credentials: [] });
const period = "2030-01";
const photo = "data:image/png;base64,AA==";
const submit = (db: Database, actor = "tenant", kind = "electricity") =>
  executeCommand(db, actor, {
    type: "meter.submit",
    payload: {
      roomId: "r1",
      kind,
      period,
      value: db.rooms[0][kind as "electricity" | "water"] + 12.5,
      photo,
      confirmed: true,
      ocrValue: db.rooms[0][kind as "electricity" | "water"] + 12,
      ocrConfidence: 80,
    },
  });

test("tính điện/nước độc lập giữa cố định và chỉ số, giữ đúng tiền phòng", () => {
  const x = {
    ...seedData().invoices[0],
    electricityBillingMode: "fixed" as const,
    electricityMonthlyFee: 120000,
  };
  const total = calculateInvoice(x);
  assert.equal(total.electricity, 120000);
  assert.equal(total.water, 90000);
  assert.equal(total.total, x.rent + x.serviceFee + 120000 + 90000);
  assert.throws(() => calculateInvoice({ ...x, electricityMonthlyFee: -1 }));
});
test("khi hai khoản cố định, không cần chỉ số mới; thay đổi phòng không sửa hóa đơn cũ", () => {
  const db = database(),
    room = db.rooms[0];
  executeCommand(db, "owner", {
    type: "room.save",
    payload: {
      ...room,
      electricityBillingMode: "fixed",
      electricityMonthlyFee: 100000,
      waterBillingMode: "fixed",
      waterMonthlyFee: 60000,
    },
  });
  executeCommand(db, "owner", {
    type: "invoice.save",
    payload: {
      roomId: room.id,
      period,
      dueDate: "2030-02-05",
      issue: true,
      electricityMonthlyFee: 1,
    },
  });
  const invoice = db.invoices.at(-1)!;
  assert.equal(calculateInvoice(invoice).electricity, 100000);
  assert.equal(calculateInvoice(invoice).water, 60000);
  assert.equal(invoice.newElectricity, invoice.oldElectricity);
  room.electricityMonthlyFee = 999000;
  room.electricityBillingMode = "metered";
  assert.equal(calculateInvoice(invoice).electricity, 100000);
});
test("người thuê gửi ảnh tạo đề xuất và thông báo; không tự cập nhật chỉ số phòng", () => {
  const db = database(),
    old = db.rooms[0].electricity;
  submit(db);
  assert.equal(db.meterReadings[0].status, "pending");
  assert.equal(db.rooms[0].electricity, old);
  assert.ok(
    db.notifications.some(
      (n) => n.userId === "owner" && n.type === "meter.submit",
    ),
  );
  assert.throws(() => submit(db), /đang chờ/);
});
test("chặn gửi ảnh phòng khác, tự duyệt, chỉ số giảm hoặc chưa đối chiếu", () => {
  const db = database();
  assert.throws(() => submit(db, "tenant2"), /phòng bạn đang thuê/);
  assert.throws(() => submit(db, "owner2"), /quyền/);
  assert.throws(
    () =>
      executeCommand(db, "tenant", {
        type: "meter.submit",
        payload: {
          roomId: "r1",
          kind: "electricity",
          period,
          value: 1,
          photo,
          confirmed: true,
        },
      }),
    /Chỉ số mới/,
  );
  assert.throws(
    () =>
      executeCommand(db, "tenant", {
        type: "meter.submit",
        payload: {
          roomId: "r1",
          kind: "electricity",
          period,
          value: 2000,
          photo,
          confirmed: false,
        },
      }),
    /đối chiếu/,
  );
  submit(db);
  assert.throws(
    () =>
      executeCommand(db, "tenant", {
        type: "meter.review",
        payload: { id: db.meterReadings[0].id, accept: true },
      }),
    /quyền/,
  );
});
test("chủ trọ xác nhận, hai bên được báo và invoice dùng giá trị đã duyệt trên server", () => {
  const db = database();
  submit(db);
  const reading = db.meterReadings[0];
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "invoice.save",
        payload: {
          roomId: "r1",
          period,
          electricityReadingId: reading.id,
          dueDate: "2030-02-05",
        },
      }),
    /chưa được xác nhận/,
  );
  executeCommand(db, "owner", {
    type: "meter.review",
    payload: { id: reading.id, accept: true },
  });
  assert.ok(
    db.notifications.some(
      (n) => n.userId === "tenant" && n.type === "meter.review",
    ),
  );
  executeCommand(db, "owner", {
    type: "invoice.save",
    payload: {
      roomId: "r1",
      period,
      electricityReadingId: reading.id,
      newElectricity: 999999,
      newWater: db.rooms[0].water + 5,
      electricityRate: 1,
      rent: 1,
      dueDate: "2030-02-05",
      issue: true,
    },
  });
  const invoice = db.invoices.at(-1)!;
  assert.equal(invoice.newElectricity, reading.value);
  assert.equal(invoice.electricityPhoto, reading.photo);
  assert.equal(invoice.electricityRate, 3500);
  assert.equal(invoice.rent, 3500000);
  assert.throws(() => submit(db), /hóa đơn phát hành/);
});
test("chủ trọ có thể gửi ảnh xác nhận; bản mới thay thế bản cũ, không làm mất lịch sử", () => {
  const db = database();
  submit(db, "owner");
  submit(db, "owner");
  assert.equal(db.meterReadings[0].status, "superseded");
  assert.equal(db.meterReadings[1].status, "accepted");
  assert.ok(
    db.notifications.some(
      (n) => n.userId === "tenant" && n.type === "meter.submit",
    ),
  );
});
test("từ chối cần lý do và cho phép gửi lại; chỉ số gốc thay đổi thì không được duyệt", () => {
  const db = database();
  submit(db);
  executeCommand(db, "owner", {
    type: "meter.review",
    payload: { id: db.meterReadings[0].id, accept: false, reason: "Ảnh bị mờ" },
  });
  submit(db);
  db.rooms[0].electricity++;
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "meter.review",
        payload: { id: db.meterReadings[1].id, accept: true },
      }),
    /gốc đã thay đổi/,
  );
});
test("không cho gửi hoặc duyệt đồng hồ của khoản phí cố định", () => {
  const db = database();
  submit(db);
  db.rooms[0].electricityBillingMode = "fixed";
  assert.throws(() => submit(db), /cố định/);
  assert.throws(
    () =>
      executeCommand(db, "owner", {
        type: "meter.review",
        payload: { id: db.meterReadings[0].id, accept: true },
      }),
    /cố định/,
  );
});
test("thông báo đánh dấu đọc theo đúng người nhận, admin cũng không đọc hộ", () => {
  const db = database();
  submit(db);
  const notification = db.notifications.find((n) => n.userId === "owner")!;
  assert.throws(
    () =>
      executeCommand(db, "tenant", {
        type: "notification.read",
        payload: { id: notification.id },
      }),
    /quyền/,
  );
  assert.throws(
    () =>
      executeCommand(db, "admin", {
        type: "notification.read",
        payload: { id: notification.id },
      }),
    /quyền/,
  );
  const auditCount = db.audit.length;
  executeCommand(db, "owner", {
    type: "notification.read",
    payload: { all: true },
  });
  assert.ok(notification.readAt);
  assert.equal(db.audit.length, auditCount);
});
test("OCR không tự chọn số nhỏ nhất khi ảnh có nhiều số khả dĩ", () => {
  assert.equal(parseMeterText("001573 kWh", 1482), 1573);
  assert.equal(parseMeterText("125,500", 120), 125.5);
  assert.equal(parseMeterText("Serial 98231278\n001573", 1482), null);
  assert.equal(parseMeterText("20", 100), null);
});

test("lưu và hủy nháp hóa đơn không gửi thông báo người thuê", () => {
  const db = database(),
    room = db.rooms[0];
  executeCommand(db, "owner", {
    type: "invoice.save",
    payload: {
      roomId: room.id,
      period,
      newElectricity: room.electricity + 2,
      newWater: room.water + 1,
      dueDate: "2030-02-05",
      issue: false,
    },
  });
  executeCommand(db, "owner", {
    type: "invoice.cancel",
    payload: { id: db.invoices.at(-1)!.id },
  });
  assert.equal(db.notifications.filter((n) => n.userId === "tenant").length, 0);
});
