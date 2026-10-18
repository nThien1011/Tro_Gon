import { appConfig } from "../config/app";
import type { Command, Snapshot, User } from "../domain/models";
import { executeCommand } from "../domain/commands";
import { hashPassword } from "../lib/crypto";
import { normalizeContact } from "../lib/format";
import { repository } from "./repository";
export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "owner" | "tenant";
};
export interface AppClient {
  initialize(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  me(): Promise<User | null>;
  signIn(contact: string, password: string): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  signOut(): Promise<void>;
  execute(command: Command): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  subscribe(fn: () => void): () => void;
}
const SESSION_KEY = "trogon.session";
const localClient: AppClient = {
  initialize: () => repository.initialize(),
  snapshot: () => repository.snapshot(),
  subscribe: (fn) => repository.subscribe(fn),
  async me() {
    const db = await repository.read();
    return (
      db.users.find(
        (u) => u.id === sessionStorage.getItem(SESSION_KEY) && u.active,
      ) || null
    );
  },
  async signIn(contact, password) {
    const db = await repository.read();
    const key = normalizeContact(contact);
    const user = db.users.find(
      (u) => u.email === key || (u.phone && u.phone === key),
    );
    const cred = db.credentials.find((c) => c.userId === user?.id);
    if (
      !user ||
      !cred ||
      (await hashPassword(password, cred.salt)).hash !== cred.hash
    )
      throw new Error("Email, số điện thoại hoặc mật khẩu chưa đúng.");
    if (!user.active)
      throw new Error("Tài khoản đã bị khóa. Liên hệ quản trị viên.");
    sessionStorage.setItem(SESSION_KEY, user.id);
    return user;
  },
  async register(input) {
    const email = normalizeContact(input.email),
      phone = normalizeContact(input.phone);
    if (!email && !phone)
      throw new Error("Nhập ít nhất email hoặc số điện thoại.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Email không hợp lệ.");
    if (phone && !/^0\d{9}$/.test(phone))
      throw new Error("Số điện thoại cần có 10 chữ số.");
    if (input.password.length < 8)
      throw new Error("Mật khẩu cần ít nhất 8 ký tự.");
    if (!input.name.trim() || !["owner", "tenant"].includes(input.role))
      throw new Error("Thông tin đăng ký không hợp lệ.");
    const user: User = {
      id: crypto.randomUUID(),
      name: input.name.trim().slice(0, 100),
      email,
      phone,
      role: input.role,
      active: true,
    };
    const credential = {
      userId: user.id,
      ...(await hashPassword(input.password)),
    };
    await repository.update((db) => {
      if (
        db.users.some(
          (u) => (email && u.email === email) || (phone && u.phone === phone),
        )
      )
        throw new Error("Email hoặc số điện thoại đã được đăng ký.");
      db.users.push(user);
      db.credentials.push(credential);
      db.version++;
      return db;
    });
    sessionStorage.setItem(SESSION_KEY, user.id);
    return user;
  },
  async signOut() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  async execute(command) {
    const user = await this.me();
    if (!user) throw new Error("Vui lòng đăng nhập.");
    await repository.update((db) => executeCommand(db, user.id, command));
  },
  async changePassword(oldPassword, newPassword) {
    if (newPassword.length < 8)
      throw new Error("Mật khẩu mới cần ít nhất 8 ký tự.");
    const user = await this.me();
    if (!user) throw new Error("Vui lòng đăng nhập.");
    const db = await repository.read(),
      existing = db.credentials.find((c) => c.userId === user.id)!;
    if ((await hashPassword(oldPassword, existing.salt)).hash !== existing.hash)
      throw new Error("Mật khẩu hiện tại chưa đúng.");
    const next = { userId: user.id, ...(await hashPassword(newPassword)) };
    await repository.update((state) => {
      state.credentials = state.credentials.map((c) =>
        c.userId === user.id ? next : c,
      );
      return state;
    });
  },
};
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Không kết nối được máy chủ.");
  return body;
}
const apiClient: AppClient = {
  async initialize() {},
  snapshot: () => request("/snapshot"),
  me: () => request("/auth/me"),
  signIn: (contact, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ contact, password }),
    }),
  register: (input) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  signOut: () => request("/auth/logout", { method: "POST" }),
  execute: (command) =>
    request("/commands", { method: "POST", body: JSON.stringify(command) }),
  changePassword: (oldPassword, newPassword) =>
    request("/auth/password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  subscribe: () => () => {},
};
export const client = appConfig.dataSource === "api" ? apiClient : localClient;
