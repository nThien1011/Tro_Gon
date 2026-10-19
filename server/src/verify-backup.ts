import { spawn } from "node:child_process";
import { existsSync, createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";
import mysql from "mysql2/promise";
import { serverDir } from "./config.ts";

const testEnv = resolve(serverDir, ".env.test");
if (!existsSync(testEnv))
  throw new Error("Cần tài khoản kiểm thử riêng trong server/.env.test.");
const env = parseEnv(await readFile(testEnv, "utf8"));
const testUser = env.DB_USER;
if (!testUser || !env.DB_PASSWORD)
  throw new Error("Cấu hình tài khoản kiểm thử chưa đầy đủ.");
const backups = (await readdir(resolve(serverDir, "backups"))).sort();
const source = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(serverDir, "backups", backups.at(-1) || "", "database.sql.gz");
if (!existsSync(source))
  throw new Error("Chưa có file backup. Chạy npm run db:backup trước.");
const db = `trogon_test_restore_${randomBytes(6).toString("hex")}`;
const connection = await mysql.createConnection({
  host: env.DB_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
});
let created = false;
try {
  await connection.query(
    `CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  created = true;
  const windowsClient = "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe";
  const binary =
    process.env.MYSQL_BIN ||
    (process.platform === "win32" && existsSync(windowsClient)
      ? windowsClient
      : "mysql");
  const child = spawn(
    binary,
    [
      "--host",
      env.DB_HOST || "127.0.0.1",
      "--port",
      env.DB_PORT || "3306",
      "--user",
      testUser,
      "--default-character-set=utf8mb4",
      db,
    ],
    {
      env: { ...process.env, MYSQL_PWD: env.DB_PASSWORD },
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  child.stderr.resume();
  const exited = once(child, "close");
  await pipeline(createReadStream(source), createGunzip(), child.stdin);
  const [code] = await exited;
  if (code !== 0)
    throw new Error("Không khôi phục được backup vào database kiểm thử.");
  const [rows] = await connection.query<any[]>(
    `SELECT (SELECT COUNT(*) FROM \`${db}\`.users) AS users,(SELECT COUNT(*) FROM \`${db}\`.rooms) AS rooms,(SELECT COUNT(*) FROM \`${db}\`.invoices) AS invoices,(SELECT COUNT(*) FROM \`${db}\`.schema_migrations) AS migrations`,
  );
  if (!rows[0].migrations) throw new Error("Backup thiếu lịch sử migration.");
  console.log(
    "Đã khôi phục thành công trong database kiểm thử riêng:",
    JSON.stringify(rows[0]),
  );
} finally {
  if (created && /^trogon_test_restore_[a-f0-9]{12}$/.test(db))
    await connection.query(`DROP DATABASE \`${db}\``);
  await connection.end();
}
