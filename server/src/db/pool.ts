import mysql from "mysql2/promise";
import { config } from "../config.ts";
export const pool = mysql.createPool(config.db);

export async function createDatabase() {
  // Runtime users can re-check already applied migrations without CREATE privileges.
  try {
    const existing = await mysql.createConnection(config.db);
    await existing.end();
    return;
  } catch (error) {
    if ((error as any).code !== "ER_BAD_DB_ERROR") throw error;
  }
  const {
    database: _,
    connectionLimit: __,
    queueLimit: ___,
    ...options
  } = config.db;
  const connection = await mysql.createConnection(options);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await connection.end();
  }
}
