import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Database } from "../../../src/domain/models.ts";
import { pool } from "./pool.ts";

type Definition = {
  key: string;
  table: string;
  fields: string[];
  primary: string[];
  json?: string[];
  booleans?: string[];
};
const define = (
  key: string,
  table: string,
  fields: string,
  extras: Partial<Definition> = {},
): Definition => ({
  key,
  table,
  fields: fields.split(" "),
  primary: ["id"],
  ...extras,
});
export const definitions: Definition[] = [
  define(
    "users",
    "users",
    "id name email phone role active avatar bankBin bankAccount bankName emailVerified phoneVerified",
    { booleans: ["active", "emailVerified", "phoneVerified"] },
  ),
  define("credentials", "credentials", "userId salt hash", {
    primary: ["userId"],
  }),
  define(
    "buildings",
    "buildings",
    "id ownerId name address area city cityCode districtCode wardCode district ward lat lng description",
  ),
  define(
    "rooms",
    "rooms",
    "id buildingId name area capacity rent electricityRate waterRate electricityBillingMode waterBillingMode electricityMonthlyFee waterMonthlyFee serviceFee deposit electricity water status amenities images",
    { json: ["amenities", "images"] },
  ),
  define(
    "listings",
    "listings",
    "id roomId title description status createdAt reason",
  ),
  define(
    "tenancies",
    "tenancies",
    "id roomId tenantId startDate endDate active people note",
    { booleans: ["active"] },
  ),
  define(
    "invoices",
    "invoices",
    "id roomId tenantId tenantName roomName buildingName period oldElectricity newElectricity oldWater newWater electricityRate waterRate electricityBillingMode waterBillingMode electricityMonthlyFee waterMonthlyFee electricityReadingId waterReadingId rent serviceFee electricityPhoto waterPhoto status paymentStatus paymentNote createdAt dueDate paidAt bankBin bankAccount bankName",
  ),
  define(
    "appointments",
    "appointments",
    "id listingId tenantId date note status",
  ),
  define(
    "requests",
    "rental_requests",
    "id roomId tenantId date people note status",
  ),
  define("conversations", "conversations", "id listingId ownerId tenantId"),
  define("messages", "messages", "id conversationId senderId body createdAt"),
  define(
    "tickets",
    "support_tickets",
    "id authorId roomId title content category status createdAt response",
  ),
  define("favorites", "favorites", "userId listingId", {
    primary: ["userId", "listingId"],
  }),
  define("audit", "audit_logs", "id actorId action createdAt"),
  define(
    "notifications",
    "notifications",
    "id userId type title body href createdAt readAt",
  ),
  define(
    "meterReadings",
    "meter_readings",
    "id roomId tenancyId tenantId submittedBy kind period previous value photo ocrValue ocrConfidence ocrText status createdAt reviewedAt reviewedBy reason",
  ),
];

export async function readDatabase(
  connection: PoolConnection,
): Promise<Database> {
  const [states] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM app_state WHERE id = 1",
  );
  if (!states.length) throw new Error("Chưa chạy migration database.");
  const { id: _, version, ...settings } = states[0];
  settings.maintenance = Boolean(settings.maintenance);
  const result: Record<string, any> = { version: Number(version), settings };
  for (const definition of definitions) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ${definition.fields.map((f) => `\`${f}\``).join(",")} FROM \`${definition.table}\`${definition.key === "audit" ? " ORDER BY createdAt DESC LIMIT 1000" : ""}`,
    );
    result[definition.key] = rows.map((row) => {
      const value: Record<string, any> = {};
      for (const field of definition.fields) {
        if (row[field] !== null)
          value[field] = definition.booleans?.includes(field)
            ? Boolean(row[field])
            : definition.json?.includes(field) && typeof row[field] === "string"
              ? JSON.parse(row[field])
              : row[field];
      }
      if (definition.key === "users") {
        value.email ||= "";
        value.phone ||= "";
      }
      return value;
    });
  }
  result.conversations.forEach((conversation: any) => {
    conversation.messages = result.messages
      .filter((message: any) => message.conversationId === conversation.id)
      .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt))
      .map(({ conversationId: _, ...message }: any) => message);
  });
  delete result.messages;
  return result as Database;
}

const records = (db: Database, key: string): Record<string, any>[] =>
  key === "messages"
    ? db.conversations.flatMap((conversation) =>
        conversation.messages.map((message) => ({
          ...message,
          conversationId: conversation.id,
        })),
      )
    : (db as any)[key];
const recordKey = (row: Record<string, any>, definition: Definition) =>
  definition.primary.map((field) => row[field]).join("|");
const sqlValue = (
  row: Record<string, any>,
  field: string,
  definition: Definition,
) => {
  let value = row[field];
  if (["rooms", "invoices"].includes(definition.table)) {
    if (["electricityBillingMode", "waterBillingMode"].includes(field))
      value ??= "metered";
    if (["electricityMonthlyFee", "waterMonthlyFee"].includes(field))
      value ??= 0;
  }
  if (definition.booleans?.includes(field)) return value ? 1 : 0;
  if (
    value === undefined ||
    value === null ||
    (definition.key === "users" &&
      ["email", "phone"].includes(field) &&
      value === "")
  )
    return null;
  return definition.json?.includes(field) ? JSON.stringify(value) : value;
};
export async function saveDatabase(
  connection: PoolConnection,
  previous: Database,
  next: Database,
) {
  for (const definition of [...definitions].reverse()) {
    if (["audit", "messages"].includes(definition.key)) continue;
    const keys = new Set(
      records(next, definition.key).map((row) => recordKey(row, definition)),
    );
    for (const row of records(previous, definition.key))
      if (!keys.has(recordKey(row, definition))) {
        await connection.execute(
          `DELETE FROM \`${definition.table}\` WHERE ${definition.primary.map((f) => `\`${f}\` = ?`).join(" AND ")}`,
          definition.primary.map((f) => row[f]),
        );
      }
  }
  for (const definition of definitions) {
    const before = new Map(
      records(previous, definition.key).map((row) => [
        recordKey(row, definition),
        row,
      ]),
    );
    for (const row of records(next, definition.key)) {
      const original = before.get(recordKey(row, definition));
      if (
        original &&
        (definition.key === "audit" ||
          definition.key === "messages" ||
          JSON.stringify(original) === JSON.stringify(row))
      )
        continue;
      const values = definition.fields.map((field) =>
        sqlValue(row, field, definition),
      );
      if (original)
        await connection.execute(
          `UPDATE \`${definition.table}\` SET ${definition.fields.map((f) => `\`${f}\` = ?`).join(",")} WHERE ${definition.primary.map((f) => `\`${f}\` = ?`).join(" AND ")}`,
          [...values, ...definition.primary.map((f) => row[f])],
        );
      else
        await connection.execute(
          `INSERT INTO \`${definition.table}\` (${definition.fields.map((f) => `\`${f}\``).join(",")}) VALUES (${definition.fields.map(() => "?").join(",")})`,
          values,
        );
    }
  }
  const settingFields = [
    "siteName",
    "supportEmail",
    "electricityRate",
    "waterRate",
    "serviceFee",
    "maintenance",
  ] as const;
  await connection.execute(
    `UPDATE app_state SET version = ?, ${settingFields.map((f) => `\`${f}\` = ?`).join(",")} WHERE id = 1`,
    [next.version, ...settingFields.map((f) => next.settings[f])],
  );
}

export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
  write = false,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (write)
      await connection.query(
        "SELECT version FROM app_state WHERE id = 1 FOR UPDATE",
      );
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
