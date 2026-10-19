import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, copyFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";
import { config, serverDir } from "./config.ts";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const directory = resolve(serverDir, "backups", timestamp);
await mkdir(resolve(directory, "media"), { recursive: true, mode: 0o700 });
const windowsDump = "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe";
const binary =
  process.env.MYSQLDUMP_BIN ||
  (process.platform === "win32" && existsSync(windowsDump)
    ? windowsDump
    : "mysqldump");
const child = spawn(
  binary,
  [
    "--host",
    config.db.host,
    "--port",
    String(config.db.port),
    "--user",
    config.db.user,
    "--single-transaction",
    "--no-tablespaces",
    "--skip-lock-tables",
    "--set-gtid-purged=OFF",
    config.database,
  ],
  {
    env: { ...process.env, MYSQL_PWD: config.db.password },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let errorText = "";
child.stderr.on("data", (chunk) => {
  errorText += chunk.toString();
});
const exited = once(child, "close");
const sql = resolve(directory, "database.sql.gz");
await pipeline(
  child.stdout,
  createGzip(),
  createWriteStream(sql, { mode: 0o600 }),
);
const [code] = await exited;
if (code !== 0)
  throw new Error(
    `Backup MySQL thất bại (${code}). Kiểm tra quyền đọc database và đường dẫn mysqldump.`,
  );
if (existsSync(config.storageDir))
  for (const filename of await readdir(config.storageDir))
    if (/^[0-9a-f-]{36}\.webp$/.test(filename)) {
      const target = resolve(directory, "media", filename);
      await copyFile(resolve(config.storageDir, filename), target);
      await chmod(target, 0o600);
    }
console.log(`Đã sao lưu SQL và ảnh: ${directory}`);
