import { migrate } from "./db/migrate.ts";
import { seedDemo, bootstrapAdmin } from "./db/seed.ts";
import { pool } from "./db/pool.ts";
import { provisionLocalAccounts } from "./db/provision-local.ts";

try {
  const action = process.argv[2];
  if (["migrate", "setup"].includes(action)) {
    await migrate();
    await bootstrapAdmin();
    console.log("MySQL migration completed.");
  } else if (["seed", "seed-demo"].includes(action)) {
    await seedDemo();
    console.log(
      "Demo data initialized; existing databases are never overwritten.",
    );
  } else if (action === "provision-local") await provisionLocalAccounts();
  else throw new Error("Dùng migrate, setup hoặc seed-demo.");
} catch (error) {
  console.error(
    "Database setup failed:",
    (error as any).code || (error as Error).message,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
