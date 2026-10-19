import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.ts";
import { digest } from "./password.ts";
import { HttpError } from "../http/errors.ts";

export async function checkLoginThrottle(contact: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT attempts FROM login_failures WHERE contactHash=? AND expiresAt>UTC_TIMESTAMP(3)",
    [digest(contact)],
  );
  if (rows[0]?.attempts >= 10)
    throw new HttpError(
      429,
      "Đã có nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.",
    );
}
export async function recordLoginFailure(contact: string) {
  await pool.execute(
    "INSERT INTO login_failures(contactHash,attempts,expiresAt) VALUES (?,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE attempts=IF(expiresAt<UTC_TIMESTAMP(3),1,attempts+1),expiresAt=IF(expiresAt<UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE),expiresAt)",
    [digest(contact)],
  );
}
export async function clearLoginFailures(contact: string) {
  await pool.execute("DELETE FROM login_failures WHERE contactHash=?", [
    digest(contact),
  ]);
}
