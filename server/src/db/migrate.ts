import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { pool, createDatabase } from "./pool.ts";
import { serverDir } from "../config.ts";

export async function migrate() {
  await createDatabase();
  const conn = await pool.getConnection();
  try {
    const [tables] = await conn.query<RowDataPacket[]>("SHOW TABLES");
    const names = tables.map((row) => Object.values(row)[0]);
    if (
      names.length &&
      (!names.includes("schema_migrations") || !names.includes("app_state"))
    )
      throw new Error(
        "Database đã có dữ liệu khác. Chọn database riêng, trống cho TrọGọn.",
      );
    if (!names.includes("schema_migrations"))
      await conn.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, appliedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))",
      );
    const files = (await readdir(resolve(serverDir, "migrations")))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const sql = await readFile(
        resolve(serverDir, "migrations", file),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const [rows] = await conn.execute<RowDataPacket[]>(
        "SELECT checksum FROM schema_migrations WHERE version = ?",
        [file],
      );
      if (rows.length) {
        if (rows[0].checksum !== checksum)
          throw new Error(
            `Migration ${file} đã đổi sau khi áp dụng; tạo migration mới.`,
          );
        continue;
      }
      // These migrations contain plain DDL only; MySQL DDL commits implicitly.
      for (const statement of sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean))
        await conn.query(statement);
      await conn.execute(
        "INSERT INTO schema_migrations (version,checksum) VALUES (?,?)",
        [file, checksum],
      );
    }
  } finally {
    conn.release();
  }
}
