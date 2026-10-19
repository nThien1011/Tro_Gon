import { HttpError } from "../http/errors.ts";
import type { Command } from "../../../src/domain/models.ts";

const commands = new Set(
  "building.save building.delete room.save room.delete listing.save listing.hide listing.moderate tenancy.assign tenancy.end request.create request.respond request.confirm request.cancel invoice.save invoice.cancel payment.notify payment.confirm payment.reject favorite.toggle appointment.create appointment.respond conversation.start message.send ticket.create ticket.respond user.toggle profile.save settings.save meter.submit meter.review notification.read".split(
    " ",
  ),
);
export function objectInput(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(422, "Dữ liệu phải là đối tượng JSON.");
  return value as Record<string, any>;
}
export function stringInput(
  value: unknown,
  label: string,
  max = 300,
  optional = false,
): string {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(422, `${label} không hợp lệ.`);
  return value.trim();
}
export const normalizeContact = (value: string) =>
  value.includes("@")
    ? value.trim().toLowerCase()
    : value.replace(/[\s().-]/g, "").replace(/^\+84/, "0");
export function contactInput(emailValue: unknown, phoneValue: unknown) {
  const email = normalizeContact(stringInput(emailValue, "Email", 254, true));
  const phone = normalizeContact(
    stringInput(phoneValue, "Số điện thoại", 30, true),
  );
  if (
    (!email && !phone) ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (phone && !/^0\d{9}$/.test(phone))
  )
    throw new HttpError(422, "Cần email hoặc số điện thoại Việt Nam hợp lệ.");
  return { email, phone };
}
export function passwordInput(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new HttpError(422, "Mật khẩu cần từ 8 đến 128 ký tự.");
  return value;
}
export function commandInput(value: unknown): Command {
  const input = objectInput(value),
    payload = objectInput(input.payload);
  if (!commands.has(input.type))
    throw new HttpError(422, "Thao tác chưa được hỗ trợ.");
  for (const flag of [
    "issue",
    "submit",
    "approve",
    "accept",
    "maintenance",
    "confirmed",
    "all",
  ])
    if (payload[flag] !== undefined && typeof payload[flag] !== "boolean")
      throw new HttpError(422, `${flag} phải là boolean.`);
  for (const field of ["images", "amenities"])
    if (
      payload[field] !== undefined &&
      (!Array.isArray(payload[field]) ||
        payload[field].length > (field === "images" ? 8 : 20) ||
        !payload[field].every((item: unknown) => typeof item === "string"))
    )
      throw new HttpError(422, `${field} không hợp lệ.`);
  for (const field of [
    "id",
    "roomId",
    "buildingId",
    "listingId",
    "ownerId",
    "electricityReadingId",
    "waterReadingId",
  ])
    if (
      payload[field] !== undefined &&
      (typeof payload[field] !== "string" || payload[field].length > 64)
    )
      throw new HttpError(422, `${field} không hợp lệ.`);
  for (const field of ["electricityPhoto", "waterPhoto", "photo"])
    if (
      payload[field] !== undefined &&
      (typeof payload[field] !== "string" ||
        payload[field].length > 14 * 1024 * 1024)
    )
      throw new HttpError(422, `${field} không hợp lệ.`);
  const dateFields: Record<string, string[]> = {
    "tenancy.assign": ["startDate", "endDate"],
    "tenancy.end": ["date"],
    "request.create": ["date"],
    "invoice.save": ["dueDate"],
  };
  for (const field of dateFields[input.type] || [])
    if (
      payload[field] !== undefined &&
      (typeof payload[field] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload[field]))
    )
      throw new HttpError(422, `${field} cần định dạng YYYY-MM-DD.`);
  if (
    input.type === "appointment.create" &&
    (typeof payload.date !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(payload.date))
  )
    throw new HttpError(422, "Thời gian hẹn cần có múi giờ.");
  return { type: input.type, payload };
}
