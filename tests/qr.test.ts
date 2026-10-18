import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, vietQrPayload } from "../src/services/qr.ts";
test("CRC16 CCITT-FALSE khớp vector chuẩn", () =>
  assert.equal(crc16("123456789"), "29B1"));
test("QR chứa mã tiền tệ, số tiền và checksum hợp lệ", () => {
  const result = vietQrPayload("970436", "0000000000", 123456, "TG TEST");
  assert.ok(result.startsWith("000201010212"));
  assert.ok(result.includes("5303704"));
  assert.ok(result.includes("5406123456"));
  assert.equal(result.slice(-4), crc16(result.slice(0, -4)));
});
test("không sinh QR với thông tin nhận tiền thiếu hoặc sai", () => {
  assert.throws(() => vietQrPayload("", "", 123, "test"));
  assert.throws(() => vietQrPayload("970436", "0000000000", -1, "test"));
});
