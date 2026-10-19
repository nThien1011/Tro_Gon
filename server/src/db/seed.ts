import { randomUUID } from "node:crypto";
import { seedData } from "../../../src/domain/seed.ts";
import { hashPassword } from "../auth/password.ts";
import { transaction, readDatabase, saveDatabase } from "./repository.ts";
import { config } from "../config.ts";
import { contactInput, passwordInput } from "../domain/input.ts";

export async function seedDemo() {
  if (config.production)
    throw new Error("Không nạp dữ liệu mẫu trong production.");
  const snapshot = seedData();
  snapshot.users.forEach((user) => {
    user.emailVerified = false;
    user.phoneVerified = false;
  });
  const credentials = await Promise.all(
    snapshot.users.map(async (user) => ({
      userId: user.id,
      ...(await hashPassword("TroGon@2026")),
    })),
  );
  await transaction(async (connection) => {
    const before = await readDatabase(connection);
    if (before.users.length)
      throw new Error(
        "Database đã có người dùng; không ghi đè hoặc nạp mẫu lặp.",
      );
    await saveDatabase(connection, before, { ...snapshot, credentials });
    await connection.execute(
      "UPDATE runtime_config SET demoData=TRUE WHERE id=1",
    );
  }, true);
}
export async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL,
    password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const contact = contactInput(email, ""),
    credential = await hashPassword(passwordInput(password));
  await transaction(async (connection) => {
    const db = await readDatabase(connection),
      before = structuredClone(db);
    if (db.users.some((u) => u.role === "admin")) return;
    const id = randomUUID();
    db.users.push({
      id,
      name: "Quản trị TrọGọn",
      ...contact,
      role: "admin",
      active: true,
      emailVerified: false,
      phoneVerified: false,
    });
    db.credentials.push({ userId: id, ...credential });
    db.version++;
    db.audit.unshift({
      id: randomUUID(),
      actorId: id,
      action: "admin.bootstrap",
      createdAt: new Date().toISOString(),
    });
    await saveDatabase(connection, before, db);
  }, true);
}
