import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

// Keep elevated migration credentials separate from the application's DML account.
const appEnv = parseEnv(
  await readFile(new URL("../server/.env", import.meta.url), "utf8"),
);
const migrationEnv = parseEnv(
  await readFile(
    new URL("../server/.env.migrate.local", import.meta.url),
    "utf8",
  ),
);
const database = appEnv.DB_NAME || "trogon";
if (!migrationEnv.DB_USER || !migrationEnv.DB_PASSWORD)
  throw new Error(
    "Điền DB_USER và DB_PASSWORD trong server/.env.migrate.local trước.",
  );
if (migrationEnv.DB_NAME && migrationEnv.DB_NAME !== database)
  throw new Error(
    "DB_NAME của tài khoản migrate phải trùng database ứng dụng.",
  );
const host = migrationEnv.DB_HOST || appEnv.DB_HOST || "127.0.0.1";
if (!["127.0.0.1", "localhost"].includes(host))
  throw new Error("Tiện ích này chỉ chạy migration trên MySQL localhost.");
Object.assign(process.env, {
  DB_HOST: host,
  DB_PORT: migrationEnv.DB_PORT || appEnv.DB_PORT || "3306",
  DB_NAME: database,
  DB_USER: migrationEnv.DB_USER,
  DB_PASSWORD: migrationEnv.DB_PASSWORD,
});
const { migrate } = await import("../server/src/db/migrate.ts");
const { pool } = await import("../server/src/db/pool.ts");
try {
  await migrate();
  console.log(
    "Đã cập nhật cấu trúc MySQL. Tài khoản chạy web trong server/.env giữ nguyên.",
  );
} catch (error) {
  console.error("Migration thất bại:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
