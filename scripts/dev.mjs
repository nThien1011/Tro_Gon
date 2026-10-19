import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import net from "node:net";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [
  "node_modules/vite/bin/vite.js",
  "server/node_modules/tsx/package.json",
  "server/.env",
]) {
  if (!existsSync(resolve(root, file)))
    throw new Error(`Thiếu ${file}. Xem README để cài đặt và cấu hình trước.`);
}
async function free(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
const [apiFree, webFree] = await Promise.all([free(8080), free(5173)]);
if (!apiFree || !webFree) {
  if (!apiFree && !webFree) {
    try {
      const response = await fetch("http://127.0.0.1:8080/health/ready");
      if (response.ok && (await response.json()).app === "trogon-api") {
        console.log(
          "TrọGọn đang chạy: http://127.0.0.1:5173/ · API http://127.0.0.1:8080/",
        );
        process.exit(0);
      }
    } catch {}
  }
  throw new Error(
    "Cổng 5173 hoặc 8080 đang được sử dụng. Đóng phiên chạy cũ trước khi khởi động cả hệ thống.",
  );
}
await mkdir(resolve(root, "outputs"), { recursive: true });
const log = createWriteStream(resolve(root, "outputs/api.log"), { flags: "a" });
const api = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
  cwd: resolve(root, "server"),
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
api.stdout.pipe(log);
api.stderr.pipe(log);
const children = [api];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  log.end();
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
api.once("exit", (code) => {
  if (!stopping) {
    console.error("Backend đã dừng. Xem outputs/api.log.");
    stop();
    process.exit(code || 1);
  }
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      ready = (
        await fetch("http://127.0.0.1:8080/health/ready", {
          signal: AbortSignal.timeout(500),
        })
      ).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Backend chưa sẵn sàng. Xem outputs/api.log.");
  const web = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  children.push(web);
  console.log(
    "TrọGọn: http://127.0.0.1:5173/ · MySQL qua API http://127.0.0.1:8080/ · Ctrl+C để dừng cả hai.",
  );
  web.once("exit", (code) => {
    stop();
    process.exit(code || 0);
  });
} catch (error) {
  console.error(error.message);
  stop();
  process.exit(1);
}
