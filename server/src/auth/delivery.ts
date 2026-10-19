import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../config.ts";
import { HttpError } from "../http/errors.ts";
export function ensureDeliveryReady(contact: string) {
  if (!config.production && process.env.MAIL_TRANSPORT === "file") return;
  if (contact.includes("@")) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
      throw new HttpError(
        503,
        "Chưa cấu hình dịch vụ gửi email. Liên hệ quản trị viên.",
      );
  } else if (
    !process.env.SMS_WEBHOOK_URL ||
    (config.production && !process.env.SMS_WEBHOOK_URL.startsWith("https://"))
  )
    throw new HttpError(
      503,
      "Chưa cấu hình dịch vụ gửi SMS. Liên hệ quản trị viên.",
    );
}

export async function deliverCode(
  contact: string,
  code: string,
  purpose: string,
  challengeId: string,
) {
  ensureDeliveryReady(contact);
  const message = `Mã TrọGọn của bạn: ${code}. Có hiệu lực 10 phút. Không chia sẻ mã này. Mục đích: ${purpose}.`;
  if (!config.production && process.env.MAIL_TRANSPORT === "file") {
    const dir = resolve(config.storageDir, "outbox");
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, `${challengeId}.json`),
      JSON.stringify({ contact, code, purpose }),
      { mode: 0o600 },
    );
    return;
  }
  if (contact.includes("@")) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
      throw new HttpError(
        503,
        "Chưa cấu hình dịch vụ gửi email. Liên hệ quản trị viên.",
      );
    const smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      requireTLS: true,
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          }
        : {}),
    });
    await smtp.sendMail({
      from: process.env.SMTP_FROM,
      to: contact,
      subject: "Mã xác nhận TrọGọn",
      text: message,
    });
  } else {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url || (config.production && !url.startsWith("https://")))
      throw new HttpError(
        503,
        "Chưa cấu hình dịch vụ gửi SMS. Liên hệ quản trị viên.",
      );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ to: contact, code, purpose, message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new HttpError(503, "Chưa gửi được SMS. Vui lòng thử lại sau.");
  }
}
