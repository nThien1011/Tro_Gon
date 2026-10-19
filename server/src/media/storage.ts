import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Database } from "../../../src/domain/models.ts";
import { config } from "../config.ts";
import { HttpError } from "../http/errors.ts";
sharp.concurrency(2);

export const mediaPrefix = "/api/v1/media/";
export function mediaReferences(
  database: Omit<Database, "credentials">,
): Set<string> {
  return new Set(
    [
      ...database.rooms.flatMap((r) => r.images),
      ...database.invoices.flatMap((i) => [i.electricityPhoto, i.waterPhoto]),
      ...database.users.map((u) => u.avatar),
      ...(database.meterReadings || []).map((r) => r.photo),
    ].filter((url): url is string => !!url),
  );
}
export async function storeMedia(
  connection: PoolConnection,
  previous: Database,
  next: Database,
  actorId: string,
  written: string[],
) {
  const uploadCache = new Map<string, string>();
  const store = async (value: string | undefined, allowed: string[]) => {
    if (!value) return value;
    if (value.startsWith(mediaPrefix)) {
      if (!/^\/api\/v1\/media\/[0-9a-f-]{36}$/.test(value))
        throw new HttpError(422, "Tham chiếu ảnh không hợp lệ.");
      if (allowed.includes(value)) return value;
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM media WHERE id=? AND ownerId=?",
        [value.slice(mediaPrefix.length), actorId],
      );
      if (!rows.length)
        throw new HttpError(403, "Không được dùng ảnh thuộc tài khoản khác.");
      return value;
    }
    if (!value.startsWith("data:")) {
      if (/^\/images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(value))
        return value;
      throw new HttpError(422, "Định dạng ảnh không hợp lệ.");
    }
    if (uploadCache.has(value)) return uploadCache.get(value)!;
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
      value,
    );
    if (!match || value.length > 14 * 1024 * 1024)
      throw new HttpError(
        422,
        "Ảnh cần là JPG, PNG hoặc WebP và tối đa 10 MB.",
      );
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 10 * 1024 * 1024)
      throw new HttpError(422, "Ảnh tối đa 10 MB.");
    let image: Buffer;
    try {
      image = await sharp(bytes, { limitInputPixels: 16_000_000 })
        .rotate()
        .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .timeout({ seconds: 10 })
        .toBuffer();
    } catch {
      throw new HttpError(422, "Không đọc được nội dung ảnh.");
    }
    const id = randomUUID(),
      filename = `${id}.webp`,
      filepath = resolve(config.storageDir, filename);
    await mkdir(config.storageDir, { recursive: true });
    await writeFile(filepath, image, { flag: "wx", mode: 0o600 });
    written.push(filepath);
    await connection.execute(
      "INSERT INTO media(id,ownerId,filename,mimeType,size) VALUES (?,?,?,?,?)",
      [id, actorId, filename, "image/webp", image.length],
    );
    const url = mediaPrefix + id;
    uploadCache.set(value, url);
    return url;
  };
  for (const reading of next.meterReadings || []) {
    const original = previous.meterReadings?.find((r) => r.id === reading.id);
    if (reading.photo !== original?.photo)
      reading.photo = (await store(
        reading.photo,
        original ? [original.photo] : [],
      ))!;
  }
  for (const room of next.rooms) {
    const original = previous.rooms.find((r) => r.id === room.id);
    if (JSON.stringify(room.images) !== JSON.stringify(original?.images))
      room.images = await Promise.all(
        room.images.map(
          (value) => store(value, original?.images || []) as Promise<string>,
        ),
      );
  }
  for (const invoice of next.invoices) {
    const original = previous.invoices.find((i) => i.id === invoice.id);
    for (const key of ["electricityPhoto", "waterPhoto"] as const)
      if (invoice[key] !== original?.[key])
        invoice[key] = await store(invoice[key], [
          ...(original?.[key] ? [original[key]!] : []),
          ...next.meterReadings
            .filter(
              (r) =>
                r.id ===
                  (key === "electricityPhoto"
                    ? invoice.electricityReadingId
                    : invoice.waterReadingId) &&
                r.roomId === invoice.roomId &&
                r.tenantId === invoice.tenantId &&
                r.period === invoice.period &&
                r.status === "accepted",
            )
            .map((r) => r.photo),
        ]);
  }
  for (const user of next.users) {
    const original = previous.users.find((u) => u.id === user.id);
    if (user.avatar !== original?.avatar)
      user.avatar = await store(
        user.avatar,
        original?.avatar ? [original.avatar] : [],
      );
  }
}
export async function removeWritten(files: string[]) {
  await Promise.all(files.map((file) => unlink(file).catch(() => undefined)));
}
