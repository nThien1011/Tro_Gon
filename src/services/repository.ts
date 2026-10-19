import type { Database, Snapshot } from "../domain/models";
import { seedData } from "../domain/seed";
import { hashPassword } from "../lib/crypto";
import { appConfig } from "../config/app";
let database: IDBDatabase;
let initialized: Promise<void> | undefined;
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("trogon-updates")
    : undefined;
const listeners = new Set<() => void>();
channel?.addEventListener("message", () => listeners.forEach((fn) => fn()));
function announce() {
  listeners.forEach((fn) => fn());
  channel?.postMessage("changed");
}
export const repository = {
  initialize() {
    return (initialized ||= (async () => {
      database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(appConfig.databaseName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("state");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            new Error(
              "Không mở được bộ nhớ. Cho phép lưu trữ trên trình duyệt và tải lại.",
            ),
          );
      });
      const existing = await this.read();
      if (!existing) {
        const seed = seedData();
        if (!appConfig.demoEnabled) {
          for (const key of [
            "users",
            "buildings",
            "rooms",
            "listings",
            "tenancies",
            "invoices",
            "tickets",
          ] as const)
            (seed[key] as unknown[]) = [];
        }
        const credentials = await Promise.all(
          seed.users.map(async (u) => ({
            userId: u.id,
            ...(await hashPassword(appConfig.demoPassword)),
          })),
        );
        await this.replace({ ...seed, credentials });
      }
    })());
  },
  async read(): Promise<Database> {
    return new Promise((resolve, reject) => {
      const req = database
        .transaction("state")
        .objectStore("state")
        .get("main");
      req.onsuccess = () => {
        const value = req.result;
        if (value) {
          value.notifications ||= [];
          value.meterReadings ||= [];
        }
        resolve(value);
      };
      req.onerror = () => reject(req.error);
    });
  },
  async replace(value: Database) {
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction("state", "readwrite");
      tx.objectStore("state").put(value, "main");
      tx.oncomplete = () => {
        announce();
        resolve();
      };
      tx.onerror = () =>
        reject(
          new Error(
            "Không lưu được dữ liệu. Kiểm tra dung lượng bộ nhớ trình duyệt.",
          ),
        );
    });
  },
  async update(mutator: (db: Database) => Database) {
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      const req = store.get("main");
      let caught: unknown;
      req.onsuccess = () => {
        try {
          store.put(mutator(req.result), "main");
        } catch (error) {
          caught = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        announce();
        resolve();
      };
      tx.onabort = () =>
        reject(
          caught || new Error("Thao tác chưa được lưu. Vui lòng thử lại."),
        );
      tx.onerror = () =>
        reject(new Error("Bộ nhớ đầy hoặc dữ liệu chưa được lưu."));
    });
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async snapshot(): Promise<Snapshot> {
    const { credentials: _, ...snapshot } = await this.read();
    return snapshot;
  },
};
