import QRCode from "qrcode";
const tlv = (tag: string, value: string) =>
  tag +
  new TextEncoder().encode(value).length.toString().padStart(2, "0") +
  value;
export function crc16(value: string) {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(value)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++)
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function vietQrPayload(
  bankBin: string,
  account: string,
  amount: number,
  reference: string,
) {
  if (
    !/^\d{6}$/.test(bankBin) ||
    !/^\d{4,25}$/.test(account) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  )
    throw new Error(
      "Cần cấu hình ngân hàng và số tài khoản hợp lệ trước khi tạo QR.",
    );
  const merchant =
    tlv("00", "A000000727") +
    tlv("01", tlv("00", bankBin) + tlv("01", account)) +
    tlv("02", "QRIBFTTA");
  const content = reference.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 25);
  const payload =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    tlv("54", String(amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", content)) +
    "6304";
  return payload + crc16(payload);
}
export const createQr = (
  bank: string,
  account: string,
  amount: number,
  ref: string,
) =>
  QRCode.toDataURL(vietQrPayload(bank, account, amount, ref), {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
