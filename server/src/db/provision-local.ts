import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { pool } from "./pool.ts";
import { config, serverDir } from "../config.ts";

// One-time local setup using the supplied administrator connection.
// Never edits another existing MySQL account and never grants global privileges.
export async function provisionLocalAccounts() {
  if (config.production || !["127.0.0.1", "localhost"].includes(config.db.host))
    throw new Error(
      "Provision chỉ dành cho MySQL localhost trong development.",
    );
  const suffix = randomBytes(4).toString("hex");
  const appUser = `trogon_app_${suffix}`,
    testUser = `trogon_test_${suffix}`;
  const appPassword = randomBytes(32).toString("base64url"),
    testPassword = randomBytes(32).toString("base64url");
  const connection = await pool.getConnection();
  const created: string[] = [];
  try {
    for (const [user, password] of [
      [appUser, appPassword],
      [testUser, testPassword],
    ]) {
      await connection.query("CREATE USER ?@'localhost' IDENTIFIED BY ?", [
        user,
        password,
      ]);
      created.push(user);
    }
    await connection.query(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON \`${config.database}\`.* TO ?@'localhost'`,
      [appUser],
    );
    // Escape literal underscores; the final % is the only wildcard.
    await connection.query(
      "GRANT ALL PRIVILEGES ON `trogon\\_test\\_%`.* TO ?@'localhost'",
      [testUser],
    );
    const { connectionLimit: _, ...options } = config.db;
    const appCheck = await mysql.createConnection({
      ...options,
      user: appUser,
      password: appPassword,
    });
    await appCheck.query("SELECT version FROM app_state WHERE id=1");
    await appCheck.end();
    const { database: __, ...testOptions } = options;
    const testCheck = await mysql.createConnection({
      ...testOptions,
      user: testUser,
      password: testPassword,
    });
    const checkDatabase = `trogon_test_${suffix}`;
    await testCheck.query(`CREATE DATABASE \`${checkDatabase}\``);
    await testCheck.query(`DROP DATABASE \`${checkDatabase}\``);
    await testCheck.end();
    const file = resolve(serverDir, ".env");
    let contents = await readFile(file, "utf8");
    for (const [key, value] of [
      ["DB_USER", appUser],
      ["DB_PASSWORD", appPassword],
    ]) {
      const pattern = new RegExp(`^${key}=.*$`, "m");
      contents = pattern.test(contents)
        ? contents.replace(pattern, `${key}=${value}`)
        : contents + `\n${key}=${value}`;
    }
    await writeFile(file, contents, { mode: 0o600 });
    await writeFile(
      resolve(serverDir, ".env.test"),
      `DB_HOST=${config.db.host}\nDB_PORT=${config.db.port}\nDB_USER=${testUser}\nDB_PASSWORD=${testPassword}\n`,
      { mode: 0o600 },
    );
    console.log(
      "Đã tạo tài khoản ứng dụng chỉ có quyền đọc/ghi database TrọGọn và tài khoản kiểm thử riêng. Mật khẩu được lưu trong file cấu hình local.",
    );
  } catch (error) {
    for (const user of created)
      await connection
        .query("DROP USER ?@'localhost'", [user])
        .catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
