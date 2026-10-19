import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { createApp } from "./app.ts";

const app = await createApp();
try {
  await pool.query("SELECT version FROM app_state WHERE id=1");
  if (config.production) {
    const [rows] = await pool.query<any[]>(
      "SELECT demoData FROM runtime_config WHERE id=1",
    );
    if (!rows.length || rows[0].demoData)
      throw new Error(
        "Production cần database sạch, không chứa tài khoản và dữ liệu demo.",
      );
  }
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  console.error(
    "Không khởi động được backend. Kiểm tra kết nối MySQL và chạy migration.",
    (error as any).code || (error as Error).message,
  );
  await pool.end();
  process.exit(1);
}
const cleanup = setInterval(async () => {
  try {
    await pool.query("DELETE FROM sessions WHERE expiresAt < UTC_TIMESTAMP(3)");
    await pool.query(
      "DELETE FROM idempotency_keys WHERE createdAt < DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)",
    );
    await pool.query(
      "DELETE FROM auth_challenges WHERE expiresAt < DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY)",
    );
    await pool.query(
      "DELETE FROM login_failures WHERE expiresAt < UTC_TIMESTAMP(3)",
    );
  } catch (error) {
    app.log.error({ err: error }, "Cleanup failed");
  }
}, 3600000);
cleanup.unref();
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    clearInterval(cleanup);
    await app.close();
    await pool.end();
    process.exit(0);
  });
