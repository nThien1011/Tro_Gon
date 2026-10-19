import {
  randomInt,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.ts";
import { transaction, readDatabase, saveDatabase } from "../db/repository.ts";
import { digest, hashPassword } from "./password.ts";
import { deliverCode, ensureDeliveryReady } from "./delivery.ts";
import { HttpError } from "../http/errors.ts";
import {
  normalizeContact,
  passwordInput,
  stringInput,
} from "../domain/input.ts";
import { config } from "../config.ts";
const challengeDigest = (id: string, code: string) =>
  createHmac("sha256", config.authSecret)
    .update(id + ":" + code)
    .digest("hex");

type Purpose = "verify_email" | "verify_phone" | "reset_password";
export async function requestChallenge(
  contactValue: unknown,
  purpose: Purpose,
  userId?: string,
) {
  const contact = normalizeContact(
    stringInput(contactValue, "Thông tin liên hệ", 254),
  );
  ensureDeliveryReady(contact);
  const id = randomUUID(),
    code = String(randomInt(100000, 1000000));
  const [users] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM users WHERE (email=? OR phone=?) AND active=TRUE" +
      (userId ? " AND id=?" : ""),
    userId ? [contact, contact, userId] : [contact, contact],
  );
  if (!users.length) {
    if (purpose !== "reset_password")
      throw new HttpError(422, "Thông tin liên hệ không khớp hồ sơ.");
    return {
      challengeId: id,
      message: "Nếu tài khoản tồn tại, mã xác nhận sẽ được gửi.",
    };
  }
  const [recent] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM auth_challenges WHERE userId=? AND expiresAt>DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 9 MINUTE) LIMIT 1",
    [users[0].id],
  );
  if (recent.length)
    throw new HttpError(429, "Vui lòng đợi một phút trước khi yêu cầu mã mới.");
  await pool.execute(
    "INSERT INTO auth_challenges(id,userId,purpose,contact,codeHash,expiresAt) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE))",
    [id, users[0].id, purpose, contact, challengeDigest(id, code)],
  );
  try {
    await deliverCode(contact, code, purpose, id);
  } catch (error) {
    await pool.execute("DELETE FROM auth_challenges WHERE id=?", [id]);
    if (purpose !== "reset_password") throw error;
    // Same outward response when delivery fails, to avoid disclosing account existence.
    console.error(
      "Password reset delivery failed; check the configured provider.",
    );
  }
  return {
    challengeId: id,
    message: "Nếu tài khoản tồn tại, mã xác nhận sẽ được gửi.",
  };
}
export async function confirmChallenge(
  input: Record<string, any>,
  purpose: "verify" | "reset_password",
  actorId?: string,
) {
  const id = stringInput(input.challengeId, "Mã yêu cầu", 36),
    code = stringInput(input.code, "Mã xác nhận", 6);
  if (!/^\d{6}$/.test(code))
    throw new HttpError(422, "Mã xác nhận gồm 6 chữ số.");
  const password =
    purpose === "reset_password"
      ? await hashPassword(passwordInput(input.newPassword))
      : undefined;
  // Invalid attempts commit too, so brute-force attempts cannot reset by rollback.
  const valid = await transaction(async (connection) => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM auth_challenges WHERE id=? FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (
      !row ||
      row.usedAt ||
      row.attempts >= 5 ||
      new Date(row.expiresAt + "Z").getTime() <= Date.now() ||
      (purpose === "reset_password"
        ? row.purpose !== purpose
        : !row.purpose.startsWith("verify_") || row.userId !== actorId)
    )
      return false;
    await connection.execute(
      "UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?",
      [id],
    );
    const expected = Buffer.from(row.codeHash, "hex"),
      actual = Buffer.from(challengeDigest(id, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;
    const db = await readDatabase(connection),
      before = structuredClone(db);
    const user = db.users.find((u) => u.id === row.userId && u.active);
    if (!user || (row.contact !== user.email && row.contact !== user.phone))
      return false;
    if (password) {
      const credential = db.credentials.find((c) => c.userId === user.id)!;
      Object.assign(credential, password);
      await connection.execute("DELETE FROM sessions WHERE userId=?", [
        user.id,
      ]);
    } else if (row.purpose === "verify_email") user.emailVerified = true;
    else user.phoneVerified = true;
    db.version++;
    db.audit.unshift({
      id: randomUUID(),
      actorId: user.id,
      action: password ? "auth.password.reset" : "auth.contact.verified",
      createdAt: new Date().toISOString(),
    });
    await saveDatabase(connection, before, db);
    await connection.execute(
      "UPDATE auth_challenges SET usedAt=UTC_TIMESTAMP(3) WHERE userId=? AND purpose=?",
      [user.id, row.purpose],
    );
    return true;
  }, true);
  if (!valid)
    throw new HttpError(422, "Mã không đúng, đã hết hạn hoặc đã được sử dụng.");
}
