import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.ts";
import { transaction, readDatabase, saveDatabase } from "../db/repository.ts";
import {
  clearSession,
  currentUser,
  issueSession,
  requireUser,
} from "../auth/session.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { confirmChallenge, requestChallenge } from "../auth/challenges.ts";
import {
  objectInput,
  stringInput,
  contactInput,
  passwordInput,
  normalizeContact,
} from "../domain/input.ts";
import { HttpError } from "../http/errors.ts";
import { notifyUsers } from "../../../src/domain/notifications.ts";
import {
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginFailures,
} from "../auth/throttle.ts";

const dummyCredential = hashPassword("nonexistent-account-timing-check");
const limited = {
  config: { rateLimit: { max: 15, timeWindow: "15 minutes" } },
};
export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/me", async (request) => currentUser(request));
  app.post("/auth/login", limited, async (request, reply) => {
    const input = objectInput(request.body),
      contact = normalizeContact(
        stringInput(input.contact, "Thông tin đăng nhập", 254),
      );
    const password = passwordInput(input.password);
    await checkLoginThrottle(contact);
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT u.*, c.salt, c.hash FROM users u JOIN credentials c ON c.userId=u.id WHERE u.email=? OR u.phone=? LIMIT 1",
      [contact, contact],
    );
    const row = rows[0];
    const valid = await verifyPassword(
      password,
      row ? { salt: row.salt, hash: row.hash } : await dummyCredential,
    );
    if (!row || !valid || !row.active) {
      await recordLoginFailure(contact);
      throw new HttpError(
        401,
        "Thông tin đăng nhập chưa đúng hoặc tài khoản đã bị khóa.",
      );
    }
    await clearLoginFailures(contact);
    await clearSession(request, reply);
    await issueSession(reply, row.id);
    const { salt: _, hash: __, ...user } = row;
    return {
      ...user,
      email: user.email || "",
      phone: user.phone || "",
      active: Boolean(user.active),
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified),
    };
  });
  app.post("/auth/register", limited, async (request, reply) => {
    const input = objectInput(request.body);
    if (!["owner", "tenant"].includes(input.role))
      throw new HttpError(422, "Chỉ được đăng ký chủ trọ hoặc người thuê.");
    const contact = contactInput(input.email, input.phone),
      name = stringInput(input.name, "Họ tên"),
      password = await hashPassword(passwordInput(input.password));
    const user = {
      id: randomUUID(),
      name,
      ...contact,
      role: input.role as "owner" | "tenant",
      active: true,
      emailVerified: false,
      phoneVerified: false,
    };
    await transaction(async (connection) => {
      const db = await readDatabase(connection),
        before = structuredClone(db);
      if (
        db.users.some(
          (u) =>
            (contact.email && u.email === contact.email) ||
            (contact.phone && u.phone === contact.phone),
        )
      )
        throw new HttpError(409, "Email hoặc số điện thoại đã được đăng ký.");
      if (db.settings.maintenance)
        throw new HttpError(
          503,
          "Hệ thống đang bảo trì. Vui lòng thử lại sau.",
        );
      db.users.push(user);
      db.credentials.push({ userId: user.id, ...password });
      notifyUsers(
        db,
        db.users.filter((u) => u.role === "admin").map((u) => u.id),
        "auth.register",
        "Có tài khoản đăng ký mới",
        `${user.name} vừa đăng ký ${user.role === "owner" ? "chủ trọ" : "người thuê"}.`,
        "/app/users",
      );
      db.version++;
      db.audit.unshift({
        id: randomUUID(),
        actorId: user.id,
        action: "auth.register",
        createdAt: new Date().toISOString(),
      });
      await saveDatabase(connection, before, db);
    }, true);
    await clearSession(request, reply);
    await issueSession(reply, user.id);
    return reply.code(201).send(user);
  });
  app.post("/auth/logout", async (request, reply) => {
    await clearSession(request, reply);
    return { ok: true };
  });
  app.post("/auth/password", limited, async (request, reply) => {
    const user = await requireUser(request),
      input = objectInput(request.body);
    const oldPassword = passwordInput(input.oldPassword),
      next = await hashPassword(passwordInput(input.newPassword));
    await transaction(async (connection) => {
      const db = await readDatabase(connection),
        before = structuredClone(db),
        credential = db.credentials.find((c) => c.userId === user.id)!;
      if (!(await verifyPassword(oldPassword, credential)))
        throw new HttpError(422, "Mật khẩu hiện tại chưa đúng.");
      Object.assign(credential, next);
      notifyUsers(
        db,
        [user.id],
        "auth.password.changed",
        "Mật khẩu đã được thay đổi",
        "Mật khẩu tài khoản vừa được cập nhật; các phiên cũ đã kết thúc.",
        "/app/account",
      );
      db.version++;
      db.audit.unshift({
        id: randomUUID(),
        actorId: user.id,
        action: "auth.password.changed",
        createdAt: new Date().toISOString(),
      });
      await saveDatabase(connection, before, db);
      await connection.execute("DELETE FROM sessions WHERE userId=?", [
        user.id,
      ]);
    }, true);
    await issueSession(reply, user.id);
    return { ok: true };
  });
  app.post("/auth/verification/request", limited, async (request) => {
    const user = await requireUser(request),
      input = objectInput(request.body);
    if (!["email", "phone"].includes(input.channel))
      throw new HttpError(422, "Chọn email hoặc điện thoại.");
    return requestChallenge(
      input.channel === "email" ? user.email : user.phone,
      input.channel === "email" ? "verify_email" : "verify_phone",
      user.id,
    );
  });
  app.post("/auth/verification/confirm", limited, async (request) => {
    const user = await requireUser(request);
    await confirmChallenge(objectInput(request.body), "verify", user.id);
    return { ok: true };
  });
  app.post("/auth/password/reset/request", limited, async (request) =>
    requestChallenge(objectInput(request.body).contact, "reset_password"),
  );
  app.post("/auth/password/reset/confirm", limited, async (request, reply) => {
    await confirmChallenge(objectInput(request.body), "reset_password");
    await clearSession(request, reply);
    return { ok: true };
  });
}
