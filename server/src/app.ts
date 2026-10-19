import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { randomToken } from "./auth/password.ts";
import { HttpError } from "./http/errors.ts";
import { BusinessError } from "../../src/domain/errors.ts";
import { authRoutes } from "./routes/auth.ts";
import { platformRoutes } from "./routes/platform.ts";

export async function createApp(logging = true) {
  const app = Fastify({
    bodyLimit: 12 * 1024 * 1024,
    logger: logging
      ? {
          level: process.env.LOG_LEVEL || "info",
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            "res.headers.set-cookie",
          ],
        }
      : false,
    trustProxy: process.env.TRUST_PROXY
      ? process.env.TRUST_PROXY.split(",").map((v) => v.trim())
      : false,
  });
  // Register before plugins: their encapsulated route contexts inherit this handler.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError)
      return reply.code(error.statusCode).send({
        message: error.message,
        code: error.code,
        requestId: request.id,
      });
    if (error instanceof BusinessError)
      return reply.code(error.statusCode).send({
        message: error.message,
        code: error.code,
        requestId: request.id,
      });
    const code = (error as any).code;
    if (code === "ER_DUP_ENTRY")
      return reply.code(409).send({
        message:
          "Dữ liệu bị trùng hoặc thao tác đã được xử lý. Vui lòng tải lại.",
        code: "CONFLICT",
        requestId: request.id,
      });
    if (
      [
        "ER_ROW_IS_REFERENCED_2",
        "ER_NO_REFERENCED_ROW_2",
        "ER_CHECK_CONSTRAINT_VIOLATED",
      ].includes(code)
    )
      return reply.code(422).send({
        message: "Dữ liệu tham chiếu hoặc trạng thái nghiệp vụ chưa hợp lệ.",
        code: "CONSTRAINT",
        requestId: request.id,
      });
    if ((error as any).statusCode && (error as any).statusCode < 500)
      return reply.code((error as any).statusCode).send({
        message:
          (error as any).statusCode === 429
            ? "Thao tác quá nhanh. Vui lòng thử lại sau."
            : "Yêu cầu không hợp lệ hoặc quá lớn.",
        requestId: request.id,
      });
    request.log.error({ err: error, requestId: request.id }, "Request failed");
    reply.code(500).send({
      message: "Máy chủ gặp sự cố. Vui lòng thử lại sau.",
      requestId: request.id,
    });
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://tessdata.projectnaptha.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
  });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    if (
      (request.headers.origin && request.headers.origin !== config.origin) ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      throw new HttpError(403, "Nguồn yêu cầu không được phép.", "CSRF");
    const cookieToken =
        request.cookies[
          config.production ? "__Host-trogon_csrf" : "trogon_csrf"
        ],
      headerToken = request.headers["x-csrf-token"];
    if (
      !cookieToken ||
      typeof headerToken !== "string" ||
      cookieToken.length !== 43 ||
      headerToken.length !== 43 ||
      !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
    )
      throw new HttpError(
        403,
        "Phiên bảo vệ đã hết hạn. Vui lòng thử lại.",
        "CSRF",
      );
  });
  app.get("/api/v1/auth/csrf", async (_request, reply) => {
    const token = randomToken();
    reply.setCookie(
      config.production ? "__Host-trogon_csrf" : "trogon_csrf",
      token,
      {
        path: "/",
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
        maxAge: 3600,
      },
    );
    return { token };
  });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(platformRoutes, { prefix: "/api/v1" });
  app.get("/health/live", async () => ({ status: "ok", app: "trogon-api" }));
  app.get("/health/ready", async () => {
    await pool.query("SELECT version FROM app_state WHERE id=1");
    return { status: "ok", app: "trogon-api" };
  });
  if (existsSync(config.staticDir))
    await app.register(staticFiles, {
      root: config.staticDir,
      index: ["index.html"],
      setHeaders: (response, path) =>
        response.header(
          "Cache-Control",
          path.endsWith("index.html")
            ? "no-cache"
            : path.includes("assets")
              ? "public, max-age=31536000, immutable"
              : "public, max-age=3600",
        ),
    });
  return app;
}
