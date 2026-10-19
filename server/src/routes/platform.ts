import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../db/pool.ts";
import { transaction, readDatabase, saveDatabase } from "../db/repository.ts";
import { currentUser, requireUser } from "../auth/session.ts";
import { digest } from "../auth/password.ts";
import { visibleSnapshot } from "../domain/snapshot.ts";
import { commandInput } from "../domain/input.ts";
import { executeCommand } from "../../../src/domain/commands.ts";
import { HttpError } from "../http/errors.ts";
import {
  storeMedia,
  removeWritten,
  mediaReferences,
  mediaPrefix,
} from "../media/storage.ts";
import { config } from "../config.ts";

export async function platformRoutes(app: FastifyInstance) {
  app.get("/version", async (request) => {
    const viewer = await currentUser(request);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT version FROM app_state WHERE id=1",
    );
    return { version: Number(rows[0].version), userId: viewer?.id || null };
  });
  app.get("/snapshot", async (request, reply) => {
    const viewer = await currentUser(request);
    const snapshot = await transaction(async (connection) =>
      visibleSnapshot(await readDatabase(connection), viewer),
    );
    reply.header("Cache-Control", "no-store");
    return snapshot;
  });
  app.post("/commands", async (request) => {
    const user = await requireUser(request),
      command = commandInput(request.body);
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(key))
      throw new HttpError(422, "Thiếu Idempotency-Key hợp lệ.");
    const requestHash = digest(JSON.stringify(command)),
      written: string[] = [];
    try {
      return await transaction(async (connection) => {
        const [cached] = await connection.execute<RowDataPacket[]>(
          "SELECT requestHash,response FROM idempotency_keys WHERE userId=? AND requestKey=?",
          [user.id, key],
        );
        if (cached.length) {
          if (cached[0].requestHash !== requestHash)
            throw new HttpError(
              409,
              "Idempotency-Key đã được dùng cho thao tác khác.",
            );
          return typeof cached[0].response === "string"
            ? JSON.parse(cached[0].response)
            : cached[0].response;
        }
        const db = await readDatabase(connection),
          before = structuredClone(db);
        if (db.settings.maintenance && user.role !== "admin")
          throw new HttpError(
            503,
            "Hệ thống đang bảo trì. Vui lòng thử lại sau.",
          );
        executeCommand(db, user.id, command);
        await storeMedia(connection, before, db, user.id, written);
        await saveDatabase(connection, before, db);
        if (command.type === "user.toggle")
          await connection.execute("DELETE FROM sessions WHERE userId=?", [
            String(command.payload.id),
          ]);
        const result = { ok: true, version: db.version };
        await connection.execute(
          "INSERT INTO idempotency_keys(userId,requestKey,requestHash,response) VALUES (?,?,?,?)",
          [user.id, key, requestHash, JSON.stringify(result)],
        );
        return result;
      }, true);
    } catch (error) {
      await removeWritten(written);
      throw error;
    }
  });
  app.get<{ Params: { id: string } }>("/media/:id", async (request, reply) => {
    const id = request.params.id;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new HttpError(404, "Không tìm thấy ảnh.");
    const viewer = await currentUser(request);
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT filename,mimeType,ownerId FROM media WHERE id=?",
      [id],
    );
    if (!rows.length) throw new HttpError(404, "Không tìm thấy ảnh.");
    const allowed =
      viewer?.role === "admin" ||
      rows[0].ownerId === viewer?.id ||
      (await transaction(async (connection) =>
        mediaReferences(
          visibleSnapshot(await readDatabase(connection), viewer),
        ).has(mediaPrefix + id),
      ));
    if (!allowed) throw new HttpError(404, "Không tìm thấy ảnh.");
    reply.header("Cache-Control", "private, no-store").type(rows[0].mimeType);
    return reply.send(
      createReadStream(resolve(config.storageDir, rows[0].filename)),
    );
  });
}
