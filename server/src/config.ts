import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const temporaryDevelopmentSecret = randomBytes(32).toString("hex");

export const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(serverDir, ".env")))
  process.loadEnvFile(resolve(serverDir, ".env"));
const integer = (
  value: string | undefined,
  fallback: number,
  min = 1,
  max = 65535,
) => {
  const result = Number(value || fallback);
  if (!Number.isInteger(result) || result < min || result > max)
    throw new Error("Cấu hình số không hợp lệ.");
  return result;
};
export function readConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === "production";
  const origin = new URL(env.APP_ORIGIN || "http://127.0.0.1:5173").origin;
  const database = env.DB_NAME || "trogon";
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database))
    throw new Error("DB_NAME không hợp lệ.");
  if (production && !origin.startsWith("https://"))
    throw new Error("Production cần APP_ORIGIN dùng HTTPS.");
  if (production && (!env.DB_PASSWORD || env.DB_USER === "root"))
    throw new Error("Production cần tài khoản MySQL riêng và mật khẩu.");
  if (production && env.SEED_DEMO === "true")
    throw new Error("Không bật SEED_DEMO trong production.");
  if (production && env.MAIL_TRANSPORT === "file")
    throw new Error("Không dùng hộp thư giả lập trong production.");
  if (
    production &&
    (!env.AUTH_SECRET ||
      env.AUTH_SECRET.length < 32 ||
      env.AUTH_SECRET.startsWith("change-me"))
  )
    throw new Error("Production cần AUTH_SECRET ngẫu nhiên, ít nhất 32 ký tự.");
  return {
    production,
    origin,
    database,
    authSecret: env.AUTH_SECRET || temporaryDevelopmentSecret,
    host: env.HOST || "127.0.0.1",
    port: integer(env.PORT, 8080),
    sessionDays: integer(env.SESSION_DAYS, 7, 1, 30),
    storageDir: resolve(serverDir, env.STORAGE_DIR || "storage"),
    staticDir: resolve(serverDir, "../dist"),
    seedDemo: env.SEED_DEMO === "true",
    db: {
      host: env.DB_HOST || "127.0.0.1",
      port: integer(env.DB_PORT, 3306),
      user: env.DB_USER || "trogon_app",
      password: env.DB_PASSWORD || "",
      database,
      charset: "utf8mb4",
      timezone: "Z",
      decimalNumbers: true,
      dateStrings: true,
      connectionLimit: integer(env.DB_POOL_SIZE, 10, 1, 100),
      queueLimit: 100,
      connectTimeout: 10000,
      multipleStatements: false,
      ...(env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
    },
  };
}
export const config = readConfig(process.env);
