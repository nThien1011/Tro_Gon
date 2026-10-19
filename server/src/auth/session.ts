import type { FastifyReply, FastifyRequest } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import type { User } from "../../../src/domain/models.ts";
import { pool } from "../db/pool.ts";
import { config } from "../config.ts";
import { digest, randomToken } from "./password.ts";
import { HttpError } from "../http/errors.ts";

export const sessionCookie = config.production
  ? "__Host-trogon_session"
  : "trogon_session";
const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.production,
};
export async function currentUser(
  request: FastifyRequest,
): Promise<User | null> {
  const token = request.cookies[sessionCookie];
  if (!token || token.length > 100) return null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.userId WHERE s.tokenHash=? AND s.expiresAt>UTC_TIMESTAMP(3) AND u.active=TRUE",
    [digest(token)],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...row,
    email: row.email || "",
    phone: row.phone || "",
    active: Boolean(row.active),
    emailVerified: Boolean(row.emailVerified),
    phoneVerified: Boolean(row.phoneVerified),
  } as User;
}
export async function requireUser(request: FastifyRequest) {
  const user = await currentUser(request);
  if (!user)
    throw new HttpError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      "UNAUTHENTICATED",
    );
  return user;
}
export async function issueSession(reply: FastifyReply, userId: string) {
  const token = randomToken();
  await pool.execute(
    "INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY))",
    [digest(token), userId, config.sessionDays],
  );
  reply.setCookie(sessionCookie, token, {
    ...cookieOptions,
    maxAge: config.sessionDays * 86400,
  });
}
export async function clearSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = request.cookies[sessionCookie];
  if (token)
    await pool.execute("DELETE FROM sessions WHERE tokenHash=?", [
      digest(token),
    ]);
  reply.clearCookie(sessionCookie, cookieOptions);
}
