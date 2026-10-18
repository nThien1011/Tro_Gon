import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Command, Snapshot, User } from "../domain/models";
import { client } from "../services/client";
type AppContextType = {
  data: Snapshot;
  user: User | null;
  refresh: () => Promise<void>;
  execute: (command: Command, success?: string) => Promise<boolean>;
  task: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
  toast: (text: string, error?: boolean) => void;
};
const AppContext = createContext<AppContextType | null>(null);
export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider chưa sẵn sàng.");
  return value;
};
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot>();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<
    { id: number; text: string; error?: boolean }[]
  >([]);
  const toast = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setMessages((m) => [...m, { id, text, error }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 5500);
  }, []);
  const refresh = useCallback(async () => {
    const [snapshot, session] = await Promise.all([
      client.snapshot(),
      client.me(),
    ]);
    setData(snapshot);
    setUser(session);
  }, []);
  useEffect(() => {
    client
      .initialize()
      .then(refresh)
      .catch((e) => setError(String(e.message || e)));
    return client.subscribe(() => {
      refresh().catch((e) => toast(e.message, true));
    });
  }, [refresh, toast]);
  const task = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        await refresh();
        if (success) toast(success);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Có lỗi xảy ra.", true);
        return false;
      }
    },
    [refresh, toast],
  );
  if (error)
    return (
      <main className="startup">
        <h1>Chưa mở được TrọGọn</h1>
        <p>{error}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Thử lại
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="startup">
        <div className="brand-mark">⌂</div>
        <h2>TrọGọn</h2>
        <p>Đang chuẩn bị không gian của bạn…</p>
        <span className="spinner" />
      </main>
    );
  return (
    <AppContext.Provider
      value={{
        data,
        user,
        refresh,
        task,
        toast,
        execute: (command, message) =>
          task(() => client.execute(command), message),
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`toast ${m.error ? "error" : ""}`}>
            {m.error ? "!" : "✓"} <span>{m.text}</span>
            <button
              aria-label="Đóng thông báo"
              onClick={() => setMessages((x) => x.filter((t) => t.id !== m.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
