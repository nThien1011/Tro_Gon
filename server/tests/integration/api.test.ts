import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const testEnv = fileURLToPath(new URL("../../.env.test", import.meta.url));
if (existsSync(testEnv))
  Object.assign(process.env, parseEnv(readFileSync(testEnv, "utf8")));
const testDatabase = `trogon_test_${suffix}`;
process.env.DB_NAME = testDatabase;
process.env.NODE_ENV = "test";
process.env.MAIL_TRANSPORT = "file";
process.env.STORAGE_DIR = `../outputs/backend-tests/${suffix}`;
const { config } = await import("../../src/config.ts");
const { migrate } = await import("../../src/db/migrate.ts");
const { seedDemo } = await import("../../src/db/seed.ts");
const { pool } = await import("../../src/db/pool.ts");
const { createApp } = await import("../../src/app.ts");
const { calculateInvoice } = await import("../../../src/domain/billing.ts");

test(
  "MySQL + HTTP: phân quyền, thuê phòng, hóa đơn, ảnh và tài khoản",
  { timeout: 120000 },
  async (t) => {
    await migrate();
    await seedDemo();
    const app = await createApp(false);
    let sequence = 10;
    class Client {
      cookies = new Map<string, string>();
      csrf = "";
      id = "";
      ip = `127.0.0.${sequence++}`;
      async call(
        method: "GET" | "POST",
        path: string,
        body?: any,
        key?: string,
      ) {
        const response = await app.inject({
          method,
          url: "/api/v1" + path,
          remoteAddress: this.ip,
          headers: {
            cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join(";"),
            origin: config.origin,
            ...(method === "POST" ? { "x-csrf-token": this.csrf } : {}),
            ...(body !== undefined
              ? { "content-type": "application/json" }
              : {}),
            ...(key ? { "idempotency-key": key } : {}),
          },
          ...(body !== undefined ? { payload: body } : {}),
        });
        const cookies = response.headers["set-cookie"];
        for (const cookie of cookies
          ? Array.isArray(cookies)
            ? cookies
            : [cookies]
          : []) {
          const [pair] = cookie.split(";");
          const index = pair.indexOf("=");
          this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      }
      async init() {
        const response = await this.call("GET", "/auth/csrf");
        assert.equal(response.statusCode, 200, response.body);
        this.csrf = response.json().token;
        return this;
      }
      async login(contact: string, password = "TroGon@2026") {
        const response = await this.call("POST", "/auth/login", {
          contact,
          password,
        });
        assert.equal(response.statusCode, 200, response.body);
        this.id = response.json().id;
      }
      async register(email: string) {
        const response = await this.call("POST", "/auth/register", {
          name: email.split("@")[0],
          email,
          phone: "",
          password: "Test-pass@2026",
          role: "tenant",
        });
        assert.equal(response.statusCode, 201, response.body);
        this.id = response.json().id;
      }
      async command(type: string, payload: any, key = randomUUID()) {
        return this.call("POST", "/commands", { type, payload }, key);
      }
      async snapshot() {
        const response = await this.call("GET", "/snapshot");
        assert.equal(response.statusCode, 200, response.body);
        return response.json();
      }
    }
    const guest = await new Client().init(),
      owner = await new Client().init(),
      admin = await new Client().init(),
      otherOwner = await new Client().init();
    const a = await new Client().init(),
      b = await new Client().init();
    let buildingId = "",
      roomId = "",
      listingId = "",
      invoiceId = "",
      winner = a,
      loser = b,
      photoUrl = "";
    const expectStatus = (
      response: { statusCode: number; body: string },
      status = 200,
    ) => assert.equal(response.statusCode, status, response.body);
    try {
      await t.test("CSRF và origin được kiểm tra trước khi ghi", async () => {
        const denied = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { contact: "admin@trogon.demo", password: "TroGon@2026" },
        });
        expectStatus(denied, 403);
        const cross = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          headers: {
            origin: "https://evil.example",
            "x-csrf-token": guest.csrf,
            cookie: [...guest.cookies].map(([k, v]) => `${k}=${v}`).join(";"),
          },
          payload: { contact: "admin@trogon.demo", password: "TroGon@2026" },
        });
        expectStatus(cross, 403);
      });
      await owner.login("chutro@trogon.demo");
      await admin.login("admin@trogon.demo");
      await otherOwner.login("quanghuy@trogon.demo");
      await a.register("tenant-a@example.test");
      await b.register("tenant-b@example.test");
      await t.test("không đăng ký trùng hoặc tự đăng ký admin", async () => {
        expectStatus(
          await guest.call("POST", "/auth/register", {
            name: "Duplicate",
            email: "tenant-a@example.test",
            phone: "",
            password: "Test-pass@2026",
            role: "tenant",
          }),
          409,
        );
        expectStatus(
          await guest.call("POST", "/auth/register", {
            name: "Admin",
            email: "admin-new@example.test",
            phone: "",
            password: "Test-pass@2026",
            role: "admin",
          }),
          422,
        );
        const snapshot = await guest.snapshot();
        assert.equal(snapshot.invoices.length, 0);
        assert.equal(snapshot.tenancies.length, 0);
        assert.equal("credentials" in snapshot, false);
        assert.equal(
          snapshot.users.some((u: any) => u.id === a.id),
          false,
        );
      });
      await t.test(
        "chủ trọ tạo tòa nhà Hòa Hải và phòng, không cần tọa độ",
        async () => {
          expectStatus(
            await owner.command("building.save", {
              name: "Nhà kiểm thử Hòa Hải",
              address: "25 đường mẫu",
              cityCode: "48",
              districtCode: "494",
              wardCode: "20290",
            }),
          );
          buildingId = (await owner.snapshot()).buildings.find(
            (x: any) => x.name === "Nhà kiểm thử Hòa Hải",
          ).id;
          expectStatus(
            await owner.command("room.save", {
              buildingId,
              name: "P101",
              area: 25,
              capacity: 2,
              rent: 3000000,
              deposit: 3000000,
              electricityRate: 3500,
              waterRate: 18000,
              serviceFee: 100000,
              electricity: 100,
              water: 10,
              status: "available",
              amenities: ["Wifi"],
              images: ["/images/room-1.jpg"],
            }),
          );
          roomId = (await owner.snapshot()).rooms.find(
            (x: any) => x.buildingId === buildingId,
          ).id;
          expectStatus(
            await otherOwner.command("room.delete", { id: roomId }),
            403,
          );
          expectStatus(
            await owner.command("user.toggle", { id: a.id, role: "admin" }),
            403,
          );
          expectStatus(
            await a.command("building.save", {
              name: "Không được phép",
              address: "Đường mẫu",
              cityCode: "48",
              districtCode: "494",
              wardCode: "20290",
            }),
            403,
          );
        },
      );
      await t.test("tin chỉ hiển thị sau khi admin duyệt", async () => {
        expectStatus(
          await owner.command("listing.save", {
            roomId,
            title: "Phòng thử Hòa Hải",
            description: "Thông tin thử nghiệm",
            submit: true,
          }),
        );
        listingId = (await owner.snapshot()).listings.find(
          (l: any) => l.roomId === roomId,
        ).id;
        assert.equal(
          (await guest.snapshot()).listings.some(
            (l: any) => l.id === listingId,
          ),
          false,
        );
        expectStatus(
          await guest.command("listing.moderate", {
            id: listingId,
            approve: true,
          }),
          401,
        );
        expectStatus(
          await admin.command("listing.moderate", {
            id: listingId,
            approve: true,
          }),
        );
        assert.ok(
          (await guest.snapshot()).rooms.some((r: any) => r.id === roomId),
        );
      });
      await t.test(
        "idempotency không đảo lưu phòng khi request lặp",
        async () => {
          const key = randomUUID();
          expectStatus(
            await a.command("favorite.toggle", { id: listingId }, key),
          );
          expectStatus(
            await a.command("favorite.toggle", { id: listingId }, key),
          );
          assert.equal(
            (await a.snapshot()).favorites.filter(
              (f: any) => f.listingId === listingId,
            ).length,
            1,
          );
          expectStatus(
            await a.command("favorite.toggle", { id: "l2" }, key),
            409,
          );
        },
      );
      await t.test("tin nhắn và lịch xem chỉ thuộc đúng hai phía", async () => {
        expectStatus(await a.command("conversation.start", { listingId }));
        const conversation = (await a.snapshot()).conversations.find(
          (c: any) => c.listingId === listingId,
        );
        expectStatus(
          await a.command("message.send", {
            id: conversation.id,
            body: "Tôi muốn xem phòng",
          }),
        );
        expectStatus(
          await b.command("message.send", {
            id: conversation.id,
            body: "Xâm nhập",
          }),
          403,
        );
        assert.equal(
          (await otherOwner.snapshot()).conversations.some(
            (c: any) => c.id === conversation.id,
          ),
          false,
        );
        expectStatus(
          await a.command("appointment.create", {
            listingId,
            date: new Date(Date.now() + 86400000).toISOString(),
            note: "Lịch thử",
          }),
        );
        const appointment = (await owner.snapshot()).appointments.find(
          (x: any) => x.listingId === listingId,
        );
        expectStatus(
          await owner.command("appointment.respond", {
            id: appointment.id,
            status: "confirmed",
          }),
        );
      });
      await t.test(
        "hai người cùng xác nhận thuê chỉ có một người nhận được phòng",
        async () => {
          for (const client of [a, b])
            expectStatus(
              await client.command("request.create", {
                roomId,
                date: "2026-10-01",
                people: 1,
                note: "",
              }),
            );
          const requests = (await owner.snapshot()).requests.filter(
            (r: any) => r.roomId === roomId,
          );
          for (const request of requests)
            expectStatus(
              await owner.command("request.respond", {
                id: request.id,
                accept: true,
              }),
            );
          const ra = requests.find((r: any) => r.tenantId === a.id),
            rb = requests.find((r: any) => r.tenantId === b.id);
          const results = await Promise.all([
            a.command("request.confirm", { id: ra.id }),
            b.command("request.confirm", { id: rb.id }),
          ]);
          assert.equal(
            results.filter((r) => r.statusCode === 200).length,
            1,
            JSON.stringify(results.map((r) => r.body)),
          );
          winner = results[0].statusCode === 200 ? a : b;
          loser = winner === a ? b : a;
          const active = (await admin.snapshot()).tenancies.filter(
            (t: any) => t.roomId === roomId && t.active,
          );
          assert.equal(active.length, 1);
          assert.equal(active[0].tenantId, winner.id);
          assert.equal(
            (await guest.snapshot()).rooms.some((r: any) => r.id === roomId),
            false,
          );
          await assert.rejects(
            pool.execute(
              "INSERT INTO tenancies(id,roomId,tenantId,startDate,endDate,active,people,note) SELECT ?,roomId,?,startDate,endDate,active,people,note FROM tenancies WHERE id=?",
              [randomUUID(), loser.id, active[0].id],
            ),
            (error: any) => error.code === "ER_DUP_ENTRY",
          );
        },
      );
      await t.test(
        "server tính lại tiền, lưu ảnh riêng tư và chặn chỉ số giảm",
        async () => {
          expectStatus(
            await owner.command("invoice.save", {
              roomId,
              period: "2026-10",
              newElectricity: 99,
              newWater: 15,
              dueDate: "2026-11-10",
              issue: true,
            }),
            422,
          );
          const image = await sharp({
            create: { width: 20, height: 20, channels: 3, background: "white" },
          })
            .png()
            .toBuffer();
          const baseInvoice = {
            roomId,
            period: "2026-10",
            newElectricity: 150,
            newWater: 15,
            dueDate: "2026-11-10",
          };
          expectStatus(
            await owner.command("invoice.save", {
              ...baseInvoice,
              issue: false,
              electricityPhoto:
                "data:image/png;base64," + image.toString("base64"),
            }),
          );
          const draft = (await owner.snapshot()).invoices.find(
            (i: any) => i.roomId === roomId,
          );
          assert.equal(
            (await winner.snapshot()).invoices.some(
              (i: any) => i.id === draft.id,
            ),
            false,
          );
          expectStatus(
            await winner.call(
              "GET",
              draft.electricityPhoto.replace("/api/v1", ""),
            ),
            404,
          );
          expectStatus(
            await owner.command("invoice.save", {
              ...baseInvoice,
              id: draft.id,
              issue: true,
              electricityPhoto: draft.electricityPhoto,
              rent: 1,
              electricityRate: 1,
              oldElectricity: 149,
            }),
          );
          const invoice = (await winner.snapshot()).invoices.find(
            (i: any) => i.roomId === roomId,
          );
          invoiceId = invoice.id;
          photoUrl = invoice.electricityPhoto;
          assert.equal(calculateInvoice(invoice).total, 3365000);
          assert.equal(invoice.rent, 3000000);
          assert.equal(invoice.oldElectricity, 100);
          assert.ok(photoUrl.startsWith("/api/v1/media/"));
          expectStatus(
            await winner.call("GET", photoUrl.replace("/api/v1", "")),
            200,
          );
          expectStatus(
            await guest.call("GET", photoUrl.replace("/api/v1", "")),
            404,
          );
          expectStatus(
            await loser.call("GET", photoUrl.replace("/api/v1", "")),
            404,
          );
          assert.equal(
            (await otherOwner.snapshot()).invoices.some(
              (i: any) => i.id === invoiceId,
            ),
            false,
          );
          expectStatus(
            await owner.command("invoice.save", {
              roomId,
              period: "2026-10",
              newElectricity: 160,
              newWater: 16,
              dueDate: "2026-11-10",
              issue: true,
            }),
            422,
          );
          await assert.rejects(
            pool.execute(
              "INSERT INTO invoices(id,roomId,tenantId,period,oldElectricity,newElectricity,oldWater,newWater,electricityRate,waterRate,rent,serviceFee,status,paymentStatus,createdAt,dueDate) SELECT ?,roomId,tenantId,period,oldElectricity,newElectricity,oldWater,newWater,electricityRate,waterRate,rent,serviceFee,status,paymentStatus,createdAt,dueDate FROM invoices WHERE id=?",
              [randomUUID(), invoiceId],
            ),
            (error: any) => error.code === "ER_DUP_ENTRY",
          );
        },
      );
      await t.test(
        "thông báo đã trả, từ chối, xác nhận thu và bàn giao đúng thứ tự",
        async () => {
          const tenancy = (await owner.snapshot()).tenancies.find(
            (t: any) => t.roomId === roomId && t.active,
          );
          expectStatus(
            await owner.command("tenancy.end", {
              id: tenancy.id,
              date: "2026-11-01",
            }),
            422,
          );
          expectStatus(
            await winner.command("payment.confirm", { id: invoiceId }),
            403,
          );
          expectStatus(
            await winner.command("payment.notify", { id: invoiceId }),
          );
          assert.equal(
            (await owner.snapshot()).invoices.find(
              (i: any) => i.id === invoiceId,
            ).paymentStatus,
            "pending",
          );
          expectStatus(
            await owner.command("payment.reject", {
              id: invoiceId,
              reason: "Chưa thấy khoản chuyển",
            }),
          );
          expectStatus(
            await winner.command("payment.notify", { id: invoiceId }),
          );
          expectStatus(
            await owner.command("payment.confirm", { id: invoiceId }),
          );
          expectStatus(
            await owner.command("invoice.cancel", { id: invoiceId }),
            422,
          );
          expectStatus(
            await owner.command("tenancy.end", {
              id: tenancy.id,
              date: "2026-11-01",
            }),
          );
          assert.equal(
            (await winner.snapshot()).tenancies.find(
              (t: any) => t.id === tenancy.id,
            ).active,
            false,
          );
        },
      );
      await t.test(
        "khóa tài khoản thu hồi phiên và đổi mật khẩu thu hồi các phiên cũ",
        async () => {
          const contact =
            winner === a ? "tenant-a@example.test" : "tenant-b@example.test";
          const oldCookies = new Map(winner.cookies);
          expectStatus(await admin.command("user.toggle", { id: winner.id }));
          assert.equal((await winner.call("GET", "/auth/me")).json(), null);
          expectStatus(
            await winner.command("favorite.toggle", { id: "l2" }),
            401,
          );
          expectStatus(await admin.command("user.toggle", { id: winner.id }));
          await winner.login(contact, "Test-pass@2026");
          expectStatus(
            await winner.call("POST", "/auth/password", {
              oldPassword: "Test-pass@2026",
              newPassword: "New-pass@2026",
            }),
          );
          const old = await new Client().init();
          old.cookies = oldCookies;
          assert.equal((await old.call("GET", "/auth/me")).json(), null);
          expectStatus(
            await guest.call("POST", "/auth/login", {
              contact,
              password: "Test-pass@2026",
            }),
            401,
          );
          await winner.login(contact, "New-pass@2026");
        },
      );
      await t.test(
        "mã xác minh và khôi phục mật khẩu dùng một lần",
        async () => {
          const response = await winner.call(
            "POST",
            "/auth/verification/request",
            { channel: "email" },
          );
          expectStatus(response);
          const id = response.json().challengeId;
          const outbox = JSON.parse(
            await readFile(
              resolve(config.storageDir, "outbox", `${id}.json`),
              "utf8",
            ),
          );
          expectStatus(
            await winner.call("POST", "/auth/verification/confirm", {
              challengeId: id,
              code: outbox.code,
            }),
          );
          assert.equal(
            (await winner.call("GET", "/auth/me")).json().emailVerified,
            true,
          );
          expectStatus(
            await winner.call("POST", "/auth/verification/confirm", {
              challengeId: id,
              code: outbox.code,
            }),
            422,
          );
          // Permit a different purpose immediately in this integration test.
          await pool.execute(
            "UPDATE auth_challenges SET expiresAt=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE userId=?",
            [winner.id],
          );
          const contact =
            winner === a ? "tenant-a@example.test" : "tenant-b@example.test";
          const reset = await guest.call(
            "POST",
            "/auth/password/reset/request",
            { contact },
          );
          expectStatus(reset);
          const resetId = reset.json().challengeId,
            resetMail = JSON.parse(
              await readFile(
                resolve(config.storageDir, "outbox", `${resetId}.json`),
                "utf8",
              ),
            );
          expectStatus(
            await guest.call("POST", "/auth/password/reset/confirm", {
              challengeId: resetId,
              code: "000000",
              newPassword: "Reset-pass@2026",
            }),
            422,
          );
          expectStatus(
            await guest.call("POST", "/auth/password/reset/confirm", {
              challengeId: resetId,
              code: resetMail.code,
              newPassword: "Reset-pass@2026",
            }),
          );
          assert.equal((await winner.call("GET", "/auth/me")).json(), null);
          await winner.login(contact, "Reset-pass@2026");
          expectStatus(
            await guest.call("POST", "/auth/password/reset/confirm", {
              challengeId: resetId,
              code: resetMail.code,
              newPassword: "Another-pass@2026",
            }),
            422,
          );
        },
      );
      await t.test(
        "API vẫn đọc được dữ liệu đã lưu khi mở phiên mới",
        async () => {
          const reloaded = await new Client().init();
          await reloaded.login("chutro@trogon.demo");
          assert.equal(
            (await reloaded.snapshot()).invoices.find(
              (i: any) => i.id === invoiceId,
            ).paymentStatus,
            "paid",
          );
          assert.ok(
            (await admin.snapshot()).audit.some(
              (entry: any) => entry.action === "invoice.save",
            ),
          );
          expectStatus(await reloaded.call("POST", "/auth/logout"));
          assert.equal((await reloaded.call("GET", "/auth/me")).json(), null);
        },
      );
      await t.test(
        "chủ trọ thêm tài khoản điện thoại vào phòng và bàn giao",
        async () => {
          const phoneTenant = await new Client().init();
          const registered = await phoneTenant.call("POST", "/auth/register", {
            name: "Người thuê điện thoại",
            email: "",
            phone: "0900000099",
            password: "Test-pass@2026",
            role: "tenant",
          });
          expectStatus(registered, 201);
          phoneTenant.id = registered.json().id;
          expectStatus(
            await owner.command("room.save", {
              buildingId,
              name: "P102",
              area: 20,
              capacity: 2,
              rent: 2500000,
              deposit: 2500000,
              electricityRate: 3500,
              waterRate: 18000,
              serviceFee: 0,
              electricity: 0,
              water: 0,
              status: "available",
              amenities: [],
              images: [],
            }),
          );
          const target = (await owner.snapshot()).rooms.find(
            (r: any) => r.buildingId === buildingId && r.name === "P102",
          );
          expectStatus(
            await owner.command("tenancy.assign", {
              roomId: target.id,
              contact: "+84 900 000 099",
              people: 1,
              startDate: "2026-10-01",
              endDate: "2027-10-01",
              note: "",
            }),
          );
          const tenancy = (await phoneTenant.snapshot()).tenancies.find(
            (t: any) => t.roomId === target.id && t.active,
          );
          assert.ok(tenancy);
          expectStatus(
            await owner.command("tenancy.end", {
              id: tenancy.id,
              date: "2026-11-01",
            }),
          );
        },
      );
      await t.test(
        "ảnh chỉ số chia sẻ hai bên, duyệt, tính tiền hỗn hợp và thông báo bền vững",
        async () => {
          const meterTenant = await new Client().init();
          await meterTenant.login("nguoithue@trogon.demo");
          const target = (await owner.snapshot()).rooms.find(
            (r: any) => r.id === "r1",
          );
          const png = await sharp({
            create: { width: 80, height: 50, channels: 3, background: "white" },
          })
            .png()
            .toBuffer();
          const photo = "data:image/png;base64," + png.toString("base64");
          const payload = {
            roomId: target.id,
            kind: "electricity",
            period: "2030-06",
            value: target.electricity + 10.5,
            photo,
            confirmed: true,
            ocrValue: target.electricity + 10,
            ocrConfidence: 89,
          };
          const replayKey = randomUUID();
          expectStatus(
            await meterTenant.command("meter.submit", payload, replayKey),
          );
          expectStatus(
            await meterTenant.command("meter.submit", payload, replayKey),
          );
          const readings = (await meterTenant.snapshot()).meterReadings.filter(
            (r: any) => r.roomId === target.id,
          );
          assert.equal(readings.length, 1);
          const reading = readings[0];
          assert.equal(reading.status, "pending");
          assert.equal(reading.previous, target.electricity);
          assert.match(reading.photo, /^\/api\/v1\/media\//);
          assert.ok(
            (await owner.snapshot()).meterReadings.some(
              (r: any) => r.id === reading.id,
            ),
          );
          assert.ok(
            !(await otherOwner.snapshot()).meterReadings.some(
              (r: any) => r.id === reading.id,
            ),
          );
          assert.ok(!(await guest.snapshot()).meterReadings.length);
          for (const c of [meterTenant, owner, admin])
            expectStatus(
              await c.call("GET", reading.photo.replace("/api/v1", "")),
            );
          for (const c of [guest, otherOwner])
            expectStatus(
              await c.call("GET", reading.photo.replace("/api/v1", "")),
              404,
            );
          expectStatus(
            await meterTenant.command("meter.review", {
              id: reading.id,
              accept: true,
            }),
            403,
          );
          expectStatus(
            await otherOwner.command("meter.review", {
              id: reading.id,
              accept: true,
            }),
            403,
          );
          expectStatus(
            await owner.command("meter.review", {
              id: reading.id,
              accept: true,
            }),
          );
          const before = await owner.snapshot();
          const notices = before.notifications.filter(
            (n: any) => n.type === "meter.submit" && n.body.includes("2030-06"),
          );
          assert.equal(notices.length, 1);
          expectStatus(
            await meterTenant.command("notification.read", {
              id: notices[0].id,
            }),
            403,
          );
          expectStatus(
            await owner.command("notification.read", { id: notices[0].id }),
          );
          assert.ok(
            (await owner.snapshot()).notifications.find(
              (n: any) => n.id === notices[0].id,
            ).readAt,
          );
          expectStatus(
            await owner.command("room.save", {
              ...target,
              waterBillingMode: "fixed",
              waterMonthlyFee: 65000,
            }),
          );
          expectStatus(
            await meterTenant.command("meter.submit", {
              ...payload,
              kind: "water",
              value: target.water + 1,
            }),
            422,
          );
          expectStatus(
            await owner.command("invoice.save", {
              roomId: target.id,
              period: "2030-06",
              electricityReadingId: reading.id,
              newElectricity: 999999,
              newWater: 999999,
              electricityRate: 1,
              waterMonthlyFee: 1,
              rent: 1,
              dueDate: "2030-07-05",
              issue: true,
            }),
          );
          const invoice = (await meterTenant.snapshot()).invoices.find(
            (i: any) => i.roomId === target.id && i.period === "2030-06",
          );
          assert.equal(invoice.newElectricity, reading.value);
          assert.equal(invoice.electricityPhoto, reading.photo);
          assert.equal(invoice.newWater, target.water);
          assert.equal(invoice.waterBillingMode, "fixed");
          assert.equal(calculateInvoice(invoice).electricity, 36750);
          assert.equal(calculateInvoice(invoice).water, 65000);
          assert.equal(invoice.rent, target.rent);
          assert.ok(
            (await meterTenant.snapshot()).notifications.some(
              (n: any) =>
                n.type === "invoice.save" && n.href.includes(invoice.id),
            ),
          );
          expectStatus(
            await owner.command("room.save", {
              ...target,
              waterBillingMode: "fixed",
              waterMonthlyFee: 99000,
            }),
          );
          assert.equal(
            calculateInvoice(
              (await meterTenant.snapshot()).invoices.find(
                (i: any) => i.id === invoice.id,
              ),
            ).water,
            65000,
          );
          expectStatus(await meterTenant.command("meter.submit", payload), 422);
          const ownerPayload = {
            ...payload,
            period: "2030-07",
            value: reading.value + 2,
          };
          expectStatus(await owner.command("meter.submit", ownerPayload));
          expectStatus(
            await owner.command("meter.submit", {
              ...ownerPayload,
              value: reading.value + 3,
            }),
          );
          const shared = (await meterTenant.snapshot()).meterReadings.filter(
            (r: any) => r.roomId === target.id && r.period === "2030-07",
          );
          assert.equal(shared.length, 2);
          assert.equal(
            shared.filter((r: any) => r.status === "accepted").length,
            1,
          );
          assert.equal(
            shared.filter((r: any) => r.status === "superseded").length,
            1,
          );
          const accepted = shared.find((r: any) => r.status === "accepted");
          expectStatus(
            await meterTenant.call(
              "GET",
              accepted.photo.replace("/api/v1", ""),
            ),
          );
          assert.ok(
            (await meterTenant.snapshot()).notifications.some(
              (n: any) =>
                n.type === "meter.submit" &&
                n.href.includes("period=2030-07") &&
                n.href.includes(`room=${target.id}`),
            ),
          );
          await assert.rejects(
            pool.execute(
              "INSERT INTO meter_readings(id,roomId,tenancyId,tenantId,submittedBy,kind,period,previous,value,photo,status,createdAt) SELECT ?,roomId,tenancyId,tenantId,submittedBy,kind,period,previous,value,photo,status,createdAt FROM meter_readings WHERE id=?",
              [randomUUID(), accepted.id],
            ),
            (error: any) => error.code === "ER_DUP_ENTRY",
          );
          const another = await new Client().init();
          await another.login("nguoithue@trogon.demo");
          assert.ok(
            (await another.snapshot()).notifications.some(
              (n: any) => n.type === "meter.review",
            ),
          );
          expectStatus(
            await another.command("notification.read", { all: true }),
          );
          assert.ok(
            (await another.snapshot()).notifications.every(
              (n: any) => n.readAt,
            ),
          );
        },
      );
    } finally {
      await app.close();
      await pool.end();
      assert.match(testDatabase, /^trogon_test_[a-f0-9]{12}$/);
      const {
        database: _,
        connectionLimit: __,
        ...connectionOptions
      } = config.db;
      const cleanup = await mysql.createConnection(connectionOptions);
      await cleanup.query(`DROP DATABASE \`${testDatabase}\``);
      await cleanup.end();
    }
  },
);
