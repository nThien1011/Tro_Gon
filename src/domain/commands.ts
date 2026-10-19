import type {
  Command,
  Database,
  User,
  Room,
  Invoice,
  MeterReading,
  UtilityBillingMode,
} from "./models.ts";
import { calculateInvoice } from "./billing.ts";
import { resolveLocation } from "../config/locations.ts";
import { BusinessError } from "./errors.ts";
import { notifyUsers } from "./notifications.ts";

const id = () => crypto.randomUUID();
const fail = (
  message: string,
  statusCode = 422,
  code = "BUSINESS_RULE",
): never => {
  throw new BusinessError(message, statusCode, code);
};
const deny = (message: string): never => fail(message, 403, "FORBIDDEN");
const text = (v: unknown, label: string, max = 300) =>
  typeof v === "string" && v.trim() && v.length <= max
    ? v.trim()
    : fail(`${label} không hợp lệ.`);
const number = (v: unknown, label: string, min = 0, max = 1e12) =>
  v !== "" && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max
    ? Number(v)
    : fail(`${label} không hợp lệ.`);
const meter = (value: unknown, label: string) => {
  const amount = number(value, label);
  const rounded = Math.round(amount * 1000) / 1000;
  if (Math.abs(rounded - amount) > 1e-8)
    fail(`${label} chỉ hỗ trợ tối đa 3 chữ số thập phân.`);
  return rounded;
};
const date = (v: unknown) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) ||
    !Number.isFinite(new Date(v).getTime())
  )
    return fail("Ngày không hợp lệ.");
  if (v.length === 10 && new Date(v).toISOString().slice(0, 10) !== v)
    return fail("Ngày không hợp lệ.");
  return v;
};
export function executeCommand(
  db: Database,
  actorId: string,
  command: Command,
): Database {
  const actor =
    db.users.find((u) => u.id === actorId && u.active) ||
    fail(
      "Vui lòng đăng nhập bằng tài khoản đang hoạt động.",
      401,
      "UNAUTHENTICATED",
    );
  db.notifications ||= [];
  db.meterReadings ||= [];
  // Shared validation is executed on the server before persistence.
  const p = command.payload as Record<string, any>;
  const admins = () =>
    db.users.filter((u) => u.role === "admin").map((u) => u.id);
  const ownerId = (roomId: string) =>
    db.buildings.find(
      (b) => b.id === db.rooms.find((r) => r.id === roomId)?.buildingId,
    )?.ownerId;
  const roomPeople = (roomId: string) => [
    ownerId(roomId),
    ...db.tenancies
      .filter((t) => t.roomId === roomId && t.active)
      .map((t) => t.tenantId),
  ];
  const notify = (
    recipients: (string | undefined)[],
    title: string,
    body: string,
    href: string,
  ) => notifyUsers(db, recipients, command.type, title, body, href, actor.id);
  const billingMode = (
    value: unknown,
    fallback: UtilityBillingMode = "metered",
  ): UtilityBillingMode =>
    value === undefined
      ? fallback
      : value === "metered" || value === "fixed"
        ? value
        : fail("Cách tính điện/nước không hợp lệ.");
  const admin = () =>
    actor.role === "admin" || deny("Thao tác dành cho quản trị viên.");
  const tenant = () =>
    actor.role === "tenant" || deny("Thao tác dành cho người thuê.");
  const manageBuilding = (buildingId: string) => {
    const b =
      db.buildings.find((b) => b.id === buildingId) ||
      fail("Không tìm thấy tòa nhà.");
    if (
      actor.role !== "admin" &&
      !(actor.role === "owner" && b.ownerId === actor.id)
    )
      deny("Bạn không có quyền quản lý tòa nhà này.");
    return b;
  };
  const manageRoom = (roomId: string) => {
    const r =
      db.rooms.find((r) => r.id === roomId) || fail("Không tìm thấy phòng.");
    manageBuilding(r.buildingId);
    return r;
  };
  const publicRoom = (roomId: string) => {
    const room = db.rooms.find(
      (r) => r.id === roomId && r.status === "available",
    );
    const building = db.buildings.find((b) => b.id === room?.buildingId);
    return (
      !!room &&
      db.users.some((u) => u.id === building?.ownerId && u.active) &&
      db.listings.some((l) => l.roomId === roomId && l.status === "published")
    );
  };
  const assign = (room: Room, user: User, values: Record<string, any>) => {
    if (room.status !== "available") fail("Phòng không còn trống.");
    if (!user.active || user.role !== "tenant")
      fail("Chỉ có thể thêm người thuê đang hoạt động.");
    if (
      db.tenancies.some(
        (t) => t.active && (t.roomId === room.id || t.tenantId === user.id),
      )
    )
      fail("Phòng hoặc người thuê đã có hồ sơ thuê đang hiệu lực.");
    const people = number(values.people, "Số người", 1);
    if (!Number.isInteger(people) || people > room.capacity)
      fail("Số người vượt sức chứa của phòng.");
    const startDate = date(values.startDate || values.date),
      endDate = date(
        values.endDate ||
          `${new Date(startDate).getFullYear() + 1}${startDate.slice(4)}`,
      );
    if (new Date(endDate) <= new Date(startDate))
      fail("Ngày kết thúc phải sau ngày bắt đầu.");
    db.tenancies.push({
      id: id(),
      roomId: room.id,
      tenantId: user.id,
      active: true,
      startDate,
      endDate,
      people,
      note: String(values.note || "").slice(0, 1000),
    });
    room.status = "occupied";
    db.listings
      .filter((l) => l.roomId === room.id)
      .forEach((l) => (l.status = "hidden"));
    db.requests
      .filter(
        (r) =>
          r.roomId === room.id && ["pending", "accepted"].includes(r.status),
      )
      .forEach((r) => {
        r.status = r.tenantId === user.id ? "completed" : "rejected";
        if (r.tenantId !== user.id)
          notify(
            [r.tenantId],
            "Phòng đã có người nhận",
            `Yêu cầu thuê phòng ${room.name} đã kết thúc vì phòng không còn trống.`,
            "/app/requests",
          );
      });
    notify(
      [user.id],
      "Đã xác nhận nhận phòng",
      `${user.name} đã được gắn vào phòng ${room.name}.`,
      "/app/my-room",
    );
    notify(
      [ownerId(room.id)],
      "Đã xác nhận nhận phòng",
      `${user.name} đã được gắn vào phòng ${room.name}.`,
      "/app/tenants",
    );
  };
  switch (command.type) {
    case "building.save": {
      if (!["owner", "admin"].includes(actor.role))
        deny("Chỉ chủ trọ được tạo tòa nhà.");
      const existing = p.id ? manageBuilding(p.id) : undefined;
      const location =
        resolveLocation({
          cityCode: String(p.cityCode || ""),
          districtCode: String(p.districtCode || ""),
          wardCode: String(p.wardCode || ""),
        }) ||
        fail("Chọn tỉnh / thành phố, quận / huyện và phường / xã hợp lệ.");
      const address = text(p.address, "Địa chỉ");
      const sameLocation =
        existing?.cityCode === location.city.code &&
        existing?.districtCode === location.district.code &&
        existing?.wardCode === (location.ward?.code || "") &&
        existing?.address === address;
      const ownerId =
        existing?.ownerId || (actor.role === "admin" ? p.ownerId : actor.id);
      if (
        !db.users.some(
          (u) => u.id === ownerId && u.role === "owner" && u.active,
        )
      )
        fail("Chọn chủ trọ hợp lệ.");
      const value = {
        id: existing?.id || id(),
        ownerId,
        name: text(p.name, "Tên tòa nhà"),
        address,
        area: location.district.name,
        city: location.city.name,
        cityCode: location.city.code,
        districtCode: location.district.code,
        wardCode: location.ward?.code || "",
        district: location.district.name,
        ward: location.ward?.name || "",
        lat: sameLocation ? existing?.lat : undefined,
        lng: sameLocation ? existing?.lng : undefined,
        description: String(p.description || "").slice(0, 3000),
      };
      if (existing) Object.assign(existing, value);
      else db.buildings.push(value);
      notify(
        [
          ownerId,
          ...db.tenancies
            .filter(
              (t) =>
                t.active &&
                db.rooms.some(
                  (r) => r.id === t.roomId && r.buildingId === value.id,
                ),
            )
            .map((t) => t.tenantId),
        ],
        "Thông tin tòa nhà đã cập nhật",
        `Tòa nhà ${value.name} có thông tin mới.`,
        "/app",
      );
      break;
    }
    case "building.delete": {
      const b = manageBuilding(p.id);
      if (db.rooms.some((r) => r.buildingId === b.id))
        fail("Cần xử lý các phòng trong tòa nhà trước khi xóa.");
      db.buildings = db.buildings.filter((x) => x.id !== b.id);
      break;
    }
    case "room.save": {
      manageBuilding(p.buildingId);
      const existing = p.id ? manageRoom(p.id) : undefined;
      if (existing && existing.buildingId !== p.buildingId)
        fail("Không chuyển phòng sang tòa nhà khác khi sửa.");
      const name = text(p.name, "Tên phòng", 80);
      if (
        db.rooms.some(
          (r) =>
            r.buildingId === p.buildingId && r.name === name && r.id !== p.id,
        )
      )
        fail("Tên phòng đã có trong tòa nhà.");
      const capacity = number(p.capacity, "Sức chứa", 1, 1000);
      if (!Number.isInteger(capacity)) fail("Sức chứa phải là số nguyên.");
      const value: Room = {
        id: existing?.id || id(),
        buildingId: p.buildingId,
        name,
        area: number(p.area, "Diện tích", 1, 1000000),
        capacity,
        rent: Math.round(number(p.rent, "Giá thuê")),
        deposit: Math.round(number(p.deposit, "Tiền cọc")),
        electricityRate: Math.round(number(p.electricityRate, "Đơn giá điện")),
        waterRate: Math.round(number(p.waterRate, "Đơn giá nước")),
        electricityBillingMode: billingMode(
          p.electricityBillingMode,
          existing?.electricityBillingMode,
        ),
        waterBillingMode: billingMode(
          p.waterBillingMode,
          existing?.waterBillingMode,
        ),
        electricityMonthlyFee: Math.round(
          number(
            p.electricityMonthlyFee ?? existing?.electricityMonthlyFee ?? 0,
            "Tiền điện cố định",
          ),
        ),
        waterMonthlyFee: Math.round(
          number(
            p.waterMonthlyFee ?? existing?.waterMonthlyFee ?? 0,
            "Tiền nước cố định",
          ),
        ),
        serviceFee: Math.round(number(p.serviceFee, "Phí dịch vụ")),
        electricity:
          existing?.electricity ?? meter(p.electricity, "Chỉ số điện gốc"),
        water: existing?.water ?? meter(p.water, "Chỉ số nước gốc"),
        status:
          existing?.status === "occupied"
            ? "occupied"
            : p.status === "maintenance"
              ? "maintenance"
              : "available",
        amenities: Array.isArray(p.amenities)
          ? p.amenities
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 20)
          : [],
        images: Array.isArray(p.images)
          ? p.images
              .filter(
                (x: unknown) =>
                  typeof x === "string" &&
                  (x.startsWith("data:image/") ||
                    x.startsWith("/images/") ||
                    x.startsWith("/api/v1/media/") ||
                    x.startsWith("https://")),
              )
              .slice(0, 8)
          : [],
      };
      if (existing) Object.assign(existing, value);
      else db.rooms.push(value);
      if (value.status === "maintenance")
        db.listings
          .filter((l) => l.roomId === value.id)
          .forEach((l) => (l.status = "hidden"));
      notify(
        roomPeople(value.id),
        "Thông tin phòng đã cập nhật",
        `Phòng ${value.name} đã cập nhật thông tin hoặc cách tính chi phí. Hóa đơn đã phát hành giữ nguyên.`,
        "/app",
      );
      break;
    }
    case "room.delete": {
      const r = manageRoom(p.id);
      const listingIds = db.listings
        .filter((l) => l.roomId === r.id)
        .map((l) => l.id);
      if (
        db.tenancies.some((t) => t.roomId === r.id) ||
        db.invoices.some((i) => i.roomId === r.id) ||
        db.requests.some((x) => x.roomId === r.id) ||
        db.appointments.some((x) => listingIds.includes(x.listingId)) ||
        db.conversations.some((x) => listingIds.includes(x.listingId)) ||
        db.tickets.some((x) => x.roomId === r.id) ||
        db.meterReadings.some((x) => x.roomId === r.id)
      )
        fail(
          "Phòng có lịch sử thuê hoặc hóa đơn. Chuyển sang bảo trì thay vì xóa.",
        );
      db.rooms = db.rooms.filter((x) => x.id !== r.id);
      db.listings = db.listings.filter((l) => l.roomId !== r.id);
      db.favorites = db.favorites.filter(
        (f) => !listingIds.includes(f.listingId),
      );
      break;
    }
    case "listing.save": {
      const room = manageRoom(p.roomId);
      if (room.status !== "available")
        fail("Chỉ đăng tin cho phòng còn trống.");
      const existing = p.id
        ? db.listings.find((l) => l.id === p.id && l.roomId === room.id) ||
          fail("Tin không tồn tại.")
        : db.listings.find((l) => l.roomId === room.id);
      const value = {
        id: existing?.id || id(),
        roomId: room.id,
        title: text(p.title, "Tiêu đề", 180),
        description: text(p.description, "Mô tả", 5000),
        status: p.submit ? ("pending" as const) : ("draft" as const),
        createdAt: new Date().toISOString(),
        reason: "",
      };
      if (existing) Object.assign(existing, value);
      else db.listings.push(value);
      if (p.submit)
        notify(
          admins(),
          "Có tin đăng cần duyệt",
          `${actor.name} gửi tin “${value.title}”.`,
          "/app/moderation",
        );
      break;
    }
    case "listing.hide": {
      const l =
        db.listings.find((l) => l.id === p.id) || fail("Tin không tồn tại.");
      manageRoom(l.roomId);
      l.status = "hidden";
      notify(
        [ownerId(l.roomId)],
        "Tin cho thuê đã được ẩn",
        l.title,
        "/app/listings",
      );
      break;
    }
    case "listing.moderate": {
      admin();
      const l =
        db.listings.find((l) => l.id === p.id) || fail("Tin không tồn tại.");
      if (
        p.approve &&
        db.rooms.find((r) => r.id === l.roomId)?.status !== "available"
      )
        fail("Phòng hiện không còn trống.");
      l.status = p.approve ? "published" : "rejected";
      l.reason = p.approve ? "" : text(p.reason, "Lý do từ chối");
      notify(
        [ownerId(l.roomId)],
        p.approve ? "Tin đăng đã được duyệt" : "Tin đăng cần điều chỉnh",
        `${l.title}${l.reason ? ` · ${l.reason}` : ""}`,
        "/app/listings",
      );
      break;
    }
    case "tenancy.assign": {
      const r = manageRoom(p.roomId);
      const rawContact = String(p.contact || "").trim();
      const contact = rawContact.includes("@")
        ? rawContact.toLowerCase()
        : rawContact.replace(/[\s().-]/g, "").replace(/^\+84/, "0");
      const u =
        db.users.find(
          (u) =>
            u.email.toLowerCase() === contact ||
            (u.phone && u.phone === contact),
        ) ||
        fail(
          "Người thuê cần đăng ký tài khoản bằng email hoặc số điện thoại này trước.",
        );
      assign(r, u, p);
      break;
    }
    case "tenancy.end": {
      const t =
        db.tenancies.find((t) => t.id === p.id && t.active) ||
        fail("Hồ sơ thuê không tồn tại.");
      const room = manageRoom(t.roomId);
      if (
        db.invoices.some(
          (i) =>
            i.roomId === room.id &&
            i.tenantId === t.tenantId &&
            i.status === "issued" &&
            i.paymentStatus !== "paid",
        )
      )
        fail(
          "Cần đối chiếu và hoàn tất các hóa đơn chưa thu trước khi kết thúc thuê.",
        );
      t.active = false;
      t.endDate = date(p.date);
      if (t.endDate < t.startDate)
        fail("Ngày kết thúc phải từ ngày bắt đầu thuê.");
      db.invoices
        .filter(
          (i) =>
            i.roomId === room.id &&
            i.tenantId === t.tenantId &&
            i.status === "draft",
        )
        .forEach((i) => (i.status = "cancelled"));
      room.status = "available";
      notify(
        [t.tenantId, ownerId(room.id)],
        "Đã kết thúc thuê phòng",
        `Hồ sơ thuê phòng ${room.name} đã được bàn giao.`,
        "/app",
      );
      break;
    }
    case "request.create": {
      tenant();
      const r =
        db.rooms.find((r) => r.id === p.roomId && r.status === "available") ||
        fail("Phòng không còn trống.");
      if (!publicRoom(r.id)) fail("Phòng chưa mở nhận yêu cầu.");
      if (db.tenancies.some((t) => t.active && t.tenantId === actor.id))
        fail(
          "Bạn đã có phòng đang thuê. Hoàn tất bàn giao trước khi thuê phòng mới.",
        );
      if (
        db.requests.some(
          (x) =>
            x.tenantId === actor.id &&
            x.roomId === r.id &&
            ["pending", "accepted"].includes(x.status),
        )
      )
        fail("Bạn đã gửi yêu cầu cho phòng này.");
      const people = number(p.people, "Số người", 1);
      if (!Number.isInteger(people) || people > r.capacity)
        fail("Số người vượt sức chứa.");
      db.requests.push({
        id: id(),
        roomId: r.id,
        tenantId: actor.id,
        date: date(p.date),
        people,
        note: String(p.note || "").slice(0, 1000),
        status: "pending",
      });
      notify(
        [ownerId(r.id)],
        "Có yêu cầu thuê phòng mới",
        `${actor.name} muốn thuê phòng ${r.name}.`,
        "/app/requests",
      );
      break;
    }
    case "request.respond": {
      const r =
        db.requests.find((r) => r.id === p.id) ||
        fail("Yêu cầu không tồn tại.");
      manageRoom(r.roomId);
      if (r.status !== "pending") fail("Yêu cầu đã được xử lý.");
      if (
        p.accept &&
        db.rooms.find((room) => room.id === r.roomId)?.status !== "available"
      )
        fail("Phòng không còn trống.");
      r.status = p.accept ? "accepted" : "rejected";
      notify(
        [r.tenantId],
        p.accept
          ? "Yêu cầu thuê được chấp thuận"
          : "Yêu cầu thuê đã được phản hồi",
        p.accept
          ? "Chủ trọ đã đồng ý. Mở yêu cầu để xác nhận nhận phòng."
          : "Chủ trọ chưa thể tiếp nhận yêu cầu thuê này.",
        "/app/requests",
      );
      break;
    }
    case "request.confirm": {
      tenant();
      const r =
        db.requests.find(
          (r) =>
            r.id === p.id && r.tenantId === actor.id && r.status === "accepted",
        ) || fail("Yêu cầu chưa được chấp thuận.");
      const room =
        db.rooms.find((x) => x.id === r.roomId) || fail("Phòng không tồn tại.");
      assign(room, actor, r);
      break;
    }
    case "request.cancel": {
      const r =
        db.requests.find((r) => r.id === p.id && r.tenantId === actor.id) ||
        deny("Không có quyền hủy yêu cầu.");
      if (!["pending", "accepted"].includes(r.status))
        fail("Yêu cầu đã kết thúc.");
      r.status = "cancelled";
      notify(
        [ownerId(r.roomId)],
        "Người thuê đã hủy yêu cầu",
        `${actor.name} đã hủy yêu cầu thuê phòng.`,
        "/app/requests",
      );
      break;
    }
    case "meter.submit": {
      const room =
        db.rooms.find((r) => r.id === p.roomId) ||
        fail("Không tìm thấy phòng.");
      const tenancy =
        db.tenancies.find((t) => t.active && t.roomId === room.id) ||
        fail("Phòng chưa có người thuê.");
      if (actor.role === "tenant") {
        if (tenancy.tenantId !== actor.id)
          deny("Chỉ gửi ảnh cho phòng bạn đang thuê.");
      } else manageRoom(room.id);
      if (p.kind !== "electricity" && p.kind !== "water")
        fail("Loại đồng hồ không hợp lệ.");
      const kind = p.kind as "electricity" | "water";
      if (
        (kind === "electricity"
          ? room.electricityBillingMode
          : room.waterBillingMode) === "fixed"
      )
        fail(
          "Khoản phí này đang tính cố định theo tháng, không cần chốt đồng hồ.",
        );
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period))
        fail("Kỳ ghi chỉ số không hợp lệ.");
      if (
        db.invoices.some(
          (i) =>
            i.roomId === room.id &&
            i.status === "issued" &&
            i.period >= p.period,
        )
      )
        fail(
          "Kỳ này hoặc kỳ sau đã có hóa đơn phát hành; không gửi lại chỉ số.",
        );
      if (p.confirmed !== true)
        fail("Cần đối chiếu và xác nhận chỉ số từ ảnh.");
      if (
        typeof p.photo !== "string" ||
        !/^(data:image\/(jpeg|png|webp);base64,|\/api\/v1\/media\/)/.test(
          p.photo,
        )
      )
        fail("Cần chụp hoặc tải ảnh đồng hồ thực tế.");
      const value = meter(p.value, "Chỉ số mới");
      if (value < room[kind])
        fail("Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.");
      if (
        db.meterReadings.some(
          (r) =>
            r.roomId === room.id &&
            r.tenancyId === tenancy.id &&
            r.kind === kind &&
            r.period === p.period &&
            r.submittedBy === actor.id &&
            r.status === "pending",
        )
      )
        fail("Bạn đã có ảnh đang chờ chủ trọ xác nhận cho kỳ này.");
      const reading: MeterReading = {
        id: id(),
        roomId: room.id,
        tenancyId: tenancy.id,
        tenantId: tenancy.tenantId,
        submittedBy: actor.id,
        kind,
        period: p.period,
        previous: room[kind],
        value,
        photo: p.photo,
        ocrValue:
          p.ocrValue === undefined || p.ocrValue === null
            ? undefined
            : meter(p.ocrValue, "Gợi ý OCR"),
        ocrConfidence:
          p.ocrConfidence === undefined || p.ocrConfidence === null
            ? undefined
            : Math.round(
                number(p.ocrConfidence, "Độ tin cậy OCR", 0, 100) * 100,
              ) / 100,
        ocrText: String(p.ocrText || "").slice(0, 500),
        status: actor.role === "tenant" ? "pending" : "accepted",
        createdAt: new Date().toISOString(),
      };
      if (reading.status === "accepted") {
        db.meterReadings
          .filter(
            (r) =>
              r.roomId === room.id &&
              r.period === reading.period &&
              r.kind === kind &&
              r.status === "accepted",
          )
          .forEach((r) => (r.status = "superseded"));
        reading.reviewedBy = actor.id;
        reading.reviewedAt = reading.createdAt;
      }
      db.meterReadings.push(reading);
      notify(
        [ownerId(room.id), tenancy.tenantId],
        "Có ảnh đồng hồ mới",
        `${actor.name} gửi chỉ số ${kind === "electricity" ? "điện" : "nước"} ${value} cho phòng ${room.name}, kỳ ${p.period}${reading.status === "pending" ? " · đang chờ xác nhận" : " · đã xác nhận"}.`,
        `/app/billing?tab=meters&room=${room.id}&period=${reading.period}`,
      );
      break;
    }
    case "meter.review": {
      const reading =
        db.meterReadings.find((r) => r.id === p.id) ||
        fail("Không tìm thấy lần ghi chỉ số.");
      const room = manageRoom(reading.roomId);
      if (reading.status !== "pending") fail("Chỉ số này đã được xử lý.");
      if (!db.tenancies.some((t) => t.id === reading.tenancyId && t.active))
        fail("Hồ sơ thuê đã kết thúc.");
      if (
        db.invoices.some(
          (i) =>
            i.roomId === room.id &&
            i.status === "issued" &&
            i.period >= reading.period,
        )
      )
        fail("Kỳ này đã được chốt hóa đơn.");
      if (p.accept) {
        if (
          (reading.kind === "electricity"
            ? room.electricityBillingMode
            : room.waterBillingMode) === "fixed"
        )
          fail("Khoản phí này đã đổi sang cố định theo tháng.");
        if (reading.previous !== room[reading.kind])
          fail("Chỉ số gốc đã thay đổi. Cần chụp và gửi lại ảnh.");
        db.meterReadings
          .filter(
            (r) =>
              r.roomId === room.id &&
              r.period === reading.period &&
              r.kind === reading.kind &&
              r.status === "accepted",
          )
          .forEach((r) => (r.status = "superseded"));
      }
      reading.status = p.accept ? "accepted" : "rejected";
      reading.reason = p.accept ? "" : text(p.reason, "Lý do từ chối ảnh", 500);
      reading.reviewedBy = actor.id;
      reading.reviewedAt = new Date().toISOString();
      notify(
        [reading.tenantId, reading.submittedBy, ownerId(room.id)],
        p.accept
          ? "Chỉ số đồng hồ đã được xác nhận"
          : "Ảnh đồng hồ cần kiểm tra lại",
        `Phòng ${room.name}, kỳ ${reading.period}${reading.reason ? ` · ${reading.reason}` : " · có thể dùng chỉ số này để lập hóa đơn"}.`,
        `/app/billing?tab=meters&room=${room.id}&period=${reading.period}`,
      );
      break;
    }
    case "notification.read": {
      if (p.all === true)
        db.notifications
          .filter((n) => n.userId === actor.id && !n.readAt)
          .forEach((n) => (n.readAt = new Date().toISOString()));
      else {
        const notification =
          db.notifications.find(
            (n) => n.id === p.id && n.userId === actor.id,
          ) || deny("Không có quyền truy cập thông báo này.");
        notification.readAt ||= new Date().toISOString();
      }
      break;
    }
    case "invoice.save": {
      const room = manageRoom(p.roomId);
      const tenancy =
        db.tenancies.find((t) => t.active && t.roomId === room.id) ||
        fail("Phòng chưa có người thuê.");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period))
        fail("Kỳ hóa đơn không hợp lệ.");
      const existing = p.id
        ? db.invoices.find((i) => i.id === p.id && i.roomId === room.id)
        : db.invoices.find(
            (i) =>
              i.roomId === room.id &&
              i.period === p.period &&
              i.status !== "cancelled",
          );
      if (p.id && !existing) fail("Không tìm thấy hóa đơn nháp cần cập nhật.");
      if (existing && existing.tenantId !== tenancy.tenantId)
        fail("Hóa đơn thuộc hồ sơ thuê trước. Cần xử lý trước khi lập kỳ mới.");
      if (existing && existing.status !== "draft")
        fail("Hóa đơn kỳ này đã phát hành. Không được ghi đè.");
      if (
        db.invoices.some(
          (i) =>
            i.roomId === room.id &&
            i.period > p.period &&
            i.status === "issued",
        )
      )
        fail("Không phát hành lùi kỳ sau hóa đơn mới hơn.");
      const owner = db.users.find(
        (u) => u.id === manageBuilding(room.buildingId).ownerId,
      )!;
      const selectedReading = (kind: "electricity" | "water") => {
        const readingId = p[kind + "ReadingId"];
        if (!readingId) return undefined;
        const reading =
          db.meterReadings.find(
            (r) =>
              r.id === readingId &&
              r.roomId === room.id &&
              r.tenancyId === tenancy.id &&
              r.kind === kind &&
              r.period === p.period &&
              r.status === "accepted",
          ) ||
          fail(
            "Chỉ số được chọn chưa được xác nhận hoặc không thuộc phòng/kỳ này.",
          );
        if (reading.previous !== room[kind])
          fail("Chỉ số gốc đã thay đổi. Chọn lại lần ghi chỉ số phù hợp.");
        return reading;
      };
      const electricityFixed = room.electricityBillingMode === "fixed",
        waterFixed = room.waterBillingMode === "fixed";
      const er = electricityFixed ? undefined : selectedReading("electricity");
      const wr = waterFixed ? undefined : selectedReading("water");
      const value: Invoice = {
        id: existing?.id || id(),
        roomId: room.id,
        tenantId: tenancy.tenantId,
        tenantName: db.users.find((u) => u.id === tenancy.tenantId)!.name,
        roomName: room.name,
        buildingName: db.buildings.find((b) => b.id === room.buildingId)!.name,
        period: p.period,
        oldElectricity: room.electricity,
        newElectricity: electricityFixed
          ? room.electricity
          : (er?.value ?? meter(p.newElectricity, "Chỉ số điện mới")),
        oldWater: room.water,
        newWater: waterFixed
          ? room.water
          : (wr?.value ?? meter(p.newWater, "Chỉ số nước mới")),
        rent: room.rent,
        serviceFee: room.serviceFee,
        electricityRate: room.electricityRate,
        waterRate: room.waterRate,
        electricityBillingMode: room.electricityBillingMode || "metered",
        waterBillingMode: room.waterBillingMode || "metered",
        electricityMonthlyFee: room.electricityMonthlyFee || 0,
        waterMonthlyFee: room.waterMonthlyFee || 0,
        electricityReadingId: er?.id,
        waterReadingId: wr?.id,
        electricityPhoto: electricityFixed
          ? undefined
          : er?.photo || p.electricityPhoto,
        waterPhoto: waterFixed ? undefined : wr?.photo || p.waterPhoto,
        status: p.issue ? "issued" : "draft",
        paymentStatus: "unpaid",
        createdAt: existing?.createdAt || new Date().toISOString(),
        dueDate: date(p.dueDate),
        bankBin: owner.bankBin || "",
        bankAccount: owner.bankAccount || "",
        bankName: owner.bankName || "",
      };
      calculateInvoice(value);
      if (existing) Object.assign(existing, value);
      else db.invoices.push(value);
      if (p.issue) {
        room.electricity = value.newElectricity;
        room.water = value.newWater;
        db.meterReadings
          .filter(
            (r) =>
              r.roomId === room.id &&
              r.period === value.period &&
              r.status === "pending",
          )
          .forEach((r) => {
            r.status = "superseded";
            r.reviewedAt = new Date().toISOString();
            r.reviewedBy = actor.id;
            r.reason =
              "Kỳ này đã được chốt hóa đơn; bản đề xuất này không được sử dụng.";
          });
        notify(
          [value.tenantId],
          "Bạn có hóa đơn mới",
          `Phòng ${room.name}, kỳ ${value.period}. Mở hóa đơn để xem các khoản phí và ảnh đồng hồ.`,
          `/app/billing?invoice=${value.id}`,
        );
      }
      break;
    }
    case "invoice.cancel": {
      const i =
        db.invoices.find((i) => i.id === p.id) ||
        fail("Hóa đơn không tồn tại.");
      const r = manageRoom(i.roomId);
      const wasIssued = i.status === "issued";
      if (i.paymentStatus !== "unpaid" || i.status === "cancelled")
        fail("Không hủy hóa đơn đã thu hoặc đang chờ xác nhận.");
      if (
        i.status === "issued" &&
        db.invoices.some(
          (x) =>
            x.roomId === r.id && x.period > i.period && x.status === "issued",
        )
      )
        fail("Có hóa đơn kỳ sau phụ thuộc chỉ số. Cần xử lý từ kỳ mới nhất.");
      if (i.status === "issued") {
        r.electricity = i.oldElectricity;
        r.water = i.oldWater;
      }
      i.status = "cancelled";
      if (wasIssued)
        notify(
          [i.tenantId],
          "Hóa đơn đã được hủy",
          `Hóa đơn kỳ ${i.period} đã được chủ trọ hủy.`,
          `/app/billing?invoice=${i.id}`,
        );
      break;
    }
    case "payment.notify": {
      const i =
        db.invoices.find(
          (i) =>
            i.id === p.id && i.tenantId === actor.id && i.status === "issued",
        ) || deny("Không có quyền xác nhận hóa đơn này.");
      if (i.paymentStatus !== "unpaid")
        fail("Hóa đơn đã được thông báo hoặc đã thu.");
      i.paymentStatus = "pending";
      i.paymentNote = "";
      notify(
        [ownerId(i.roomId)],
        "Người thuê báo đã thanh toán",
        `${actor.name} báo đã thanh toán hóa đơn kỳ ${i.period}. Vui lòng đối chiếu tiền thực nhận.`,
        `/app/billing?invoice=${i.id}`,
      );
      break;
    }
    case "payment.reject": {
      const i =
        db.invoices.find((i) => i.id === p.id && i.status === "issued") ||
        fail("Hóa đơn không tồn tại.");
      manageRoom(i.roomId);
      if (i.paymentStatus !== "pending")
        fail("Hóa đơn chưa có thông báo thanh toán đang chờ.");
      i.paymentStatus = "unpaid";
      i.paymentNote = text(p.reason, "Lý do chưa xác nhận", 500);
      notify(
        [i.tenantId],
        "Thanh toán cần đối chiếu lại",
        `Kỳ ${i.period} · ${i.paymentNote}`,
        `/app/billing?invoice=${i.id}`,
      );
      break;
    }
    case "payment.confirm": {
      const i =
        db.invoices.find((i) => i.id === p.id && i.status === "issued") ||
        fail("Hóa đơn không tồn tại.");
      manageRoom(i.roomId);
      if (i.paymentStatus === "paid") fail("Hóa đơn đã thu.");
      i.paymentStatus = "paid";
      i.paidAt = new Date().toISOString();
      notify(
        [i.tenantId],
        "Thanh toán đã được xác nhận",
        `Chủ trọ xác nhận đã nhận đủ tiền hóa đơn kỳ ${i.period}.`,
        `/app/billing?invoice=${i.id}`,
      );
      break;
    }
    case "favorite.toggle": {
      tenant();
      const l =
        db.listings.find((l) => l.id === p.id) || fail("Tin không tồn tại.");
      const found = db.favorites.find(
        (f) => f.userId === actor.id && f.listingId === l.id,
      );
      if (!found && !publicRoom(l.roomId))
        fail("Chỉ lưu được phòng đang công khai và còn trống.");
      db.favorites = found
        ? db.favorites.filter((f) => f !== found)
        : [...db.favorites, { userId: actor.id, listingId: l.id }];
      break;
    }
    case "appointment.create": {
      tenant();
      const targetListing = db.listings.find((l) => l.id === p.listingId);
      if (!targetListing || !publicRoom(targetListing.roomId))
        fail("Tin không còn nhận lịch xem.");
      if (new Date(date(p.date)).getTime() <= Date.now())
        fail("Chọn thời gian trong tương lai.");
      db.appointments.push({
        id: id(),
        tenantId: actor.id,
        listingId: p.listingId,
        date: p.date,
        note: String(p.note || "").slice(0, 1000),
        status: "pending",
      });
      notify(
        [ownerId(targetListing!.roomId)],
        "Có lịch hẹn xem phòng mới",
        `${actor.name} gửi yêu cầu xem phòng.`,
        "/app/appointments",
      );
      break;
    }
    case "appointment.respond": {
      const a =
        db.appointments.find((x) => x.id === p.id) ||
        fail("Lịch không tồn tại.");
      if (["completed", "cancelled"].includes(a.status))
        fail("Lịch đã kết thúc, không thể thay đổi trạng thái.");
      if (p.status === "completed" && a.status !== "confirmed")
        fail("Cần xác nhận lịch trước khi ghi nhận đã xem.");
      if (actor.id === a.tenantId && p.status === "cancelled")
        a.status = "cancelled";
      else {
        const l = db.listings.find((l) => l.id === a.listingId)!;
        manageRoom(l.roomId);
        if (!["confirmed", "completed", "cancelled"].includes(p.status))
          fail("Trạng thái không hợp lệ.");
        a.status = p.status;
      }
      const appointmentListing = db.listings.find((l) => l.id === a.listingId)!;
      notify(
        [a.tenantId, ownerId(appointmentListing.roomId)],
        "Lịch xem phòng đã cập nhật",
        `Lịch hẹn có trạng thái ${a.status === "confirmed" ? "đã xác nhận" : a.status === "completed" ? "đã hoàn tất" : "đã hủy"}.`,
        "/app/appointments",
      );
      break;
    }
    case "conversation.start": {
      tenant();
      const l =
        db.listings.find((l) => l.id === p.listingId) ||
        fail("Tin không tồn tại.");
      if (
        !publicRoom(l.roomId) &&
        !db.conversations.some(
          (c) => c.listingId === l.id && c.tenantId === actor.id,
        )
      )
        fail("Tin chưa công khai hoặc đã ngừng nhận liên hệ mới.");
      const room = db.rooms.find((r) => r.id === l.roomId)!;
      const ownerId = db.buildings.find(
        (b) => b.id === room.buildingId,
      )!.ownerId;
      if (
        !db.conversations.some(
          (c) => c.listingId === l.id && c.tenantId === actor.id,
        )
      )
        db.conversations.push({
          id: id(),
          listingId: l.id,
          ownerId,
          tenantId: actor.id,
          messages: [],
        });
      break;
    }
    case "message.send": {
      const c =
        db.conversations.find(
          (c) => c.id === p.id && [c.ownerId, c.tenantId].includes(actor.id),
        ) || deny("Bạn không thuộc hội thoại này.");
      c.messages.push({
        id: id(),
        senderId: actor.id,
        body: text(p.body, "Tin nhắn", 3000),
        createdAt: new Date().toISOString(),
      });
      notify(
        [c.ownerId, c.tenantId],
        `Tin nhắn mới từ ${actor.name}`,
        String(p.body).slice(0, 180),
        `/app/messages?conversation=${c.id}`,
      );
      break;
    }
    case "ticket.create": {
      if (
        p.category !== "repair" &&
        p.roomId &&
        !publicRoom(p.roomId) &&
        !db.tenancies.some(
          (t) => t.tenantId === actor.id && t.roomId === p.roomId,
        ) &&
        !db.rooms.some(
          (r) =>
            r.id === p.roomId &&
            db.buildings.some(
              (b) => b.id === r.buildingId && b.ownerId === actor.id,
            ),
        ) &&
        actor.role !== "admin"
      )
        deny("Không có quyền báo cáo phòng này.");
      if (
        p.category === "repair" &&
        !db.tenancies.some(
          (t) => t.active && t.tenantId === actor.id && t.roomId === p.roomId,
        )
      )
        deny("Chỉ gửi sửa chữa cho phòng đang thuê.");
      db.tickets.push({
        id: id(),
        authorId: actor.id,
        roomId: p.roomId || undefined,
        category: p.category === "repair" ? "repair" : "report",
        title: text(p.title, "Tiêu đề"),
        content: text(p.content, "Nội dung", 3000),
        status: "open",
        createdAt: new Date().toISOString(),
      });
      notify(
        p.category === "repair" ? [ownerId(p.roomId)] : admins(),
        p.category === "repair" ? "Có yêu cầu sửa chữa mới" : "Có báo cáo mới",
        `${actor.name} · ${p.title}`,
        p.category === "repair" ? "/app/support" : "/app/reports",
      );
      break;
    }
    case "ticket.respond": {
      const t =
        db.tickets.find((t) => t.id === p.id) || fail("Yêu cầu không tồn tại.");
      if (actor.role !== "admin") {
        if (t.category !== "repair" || !t.roomId)
          deny("Thao tác dành cho admin.");
        manageRoom(t.roomId!);
      }
      if (!["open", "in_progress", "resolved"].includes(p.status))
        fail("Trạng thái không hợp lệ.");
      t.status = p.status;
      t.response = String(p.response || "").slice(0, 3000);
      notify(
        [t.authorId],
        "Yêu cầu hỗ trợ đã được phản hồi",
        `${t.title}${t.response ? ` · ${t.response}` : ""}`,
        "/app/support",
      );
      break;
    }
    case "user.toggle": {
      admin();
      const u =
        db.users.find((u) => u.id === p.id) ||
        fail("Người dùng không tồn tại.");
      if (u.id === actor.id || u.role === "admin")
        fail("Không khóa tài khoản quản trị.");
      u.active = !u.active;
      if (u.active)
        notify(
          [u.id],
          "Tài khoản đã được mở lại",
          "Bạn có thể tiếp tục sử dụng TrọGọn.",
          "/app/account",
        );
      break;
    }
    case "profile.save": {
      const email = String(p.email || "")
          .trim()
          .toLowerCase(),
        phone = String(p.phone || "")
          .replace(/[\s().-]/g, "")
          .replace(/^\+84/, "0");
      if (!email && !phone) fail("Cần ít nhất email hoặc số điện thoại.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Email không hợp lệ.");
      if (phone && !/^0\d{9}$/.test(phone))
        fail("Số điện thoại cần có 10 chữ số.");
      if (
        db.users.some(
          (u) =>
            u.id !== actor.id &&
            ((email && u.email === email) || (phone && u.phone === phone)),
        )
      )
        fail("Email hoặc số điện thoại đã được sử dụng.");
      if (actor.email !== email) actor.emailVerified = false;
      if (actor.phone !== phone) actor.phoneVerified = false;
      Object.assign(actor, { name: text(p.name, "Họ tên"), email, phone });
      if (actor.role === "owner") {
        const bankBin = String(p.bankBin || ""),
          bankAccount = String(p.bankAccount || "").replace(/\s/g, ""),
          bankName = String(p.bankName || "").trim();
        if (
          (bankBin || bankAccount || bankName) &&
          (!/^\d{6}$/.test(bankBin) ||
            !/^\d{4,25}$/.test(bankAccount) ||
            !bankName ||
            bankName.length > 150)
        )
          fail("Thông tin nhận chuyển khoản chưa đầy đủ hoặc không hợp lệ.");
        Object.assign(actor, { bankBin, bankAccount, bankName });
      }
      notifyUsers(
        db,
        [actor.id],
        command.type,
        "Thông tin tài khoản đã cập nhật",
        "Thông tin liên hệ hoặc ngân hàng của bạn vừa được thay đổi.",
        "/app/account",
      );
      break;
    }
    case "settings.save": {
      admin();
      Object.assign(db.settings, {
        siteName: text(p.siteName, "Tên nền tảng"),
        supportEmail: text(p.supportEmail, "Email hỗ trợ"),
        electricityRate: Math.round(number(p.electricityRate, "Đơn giá điện")),
        waterRate: Math.round(number(p.waterRate, "Đơn giá nước")),
        serviceFee: Math.round(number(p.serviceFee, "Phí dịch vụ")),
        maintenance: Boolean(p.maintenance),
      });
      notify(
        db.users.map((u) => u.id),
        "Cấu hình nền tảng đã cập nhật",
        p.maintenance
          ? "TrọGọn đang bật chế độ bảo trì."
          : "TrọGọn vừa cập nhật thông tin hoặc cấu hình chung. Đơn giá từng phòng và hóa đơn đã phát hành giữ nguyên.",
        "/app",
      );
      break;
    }
    default:
      fail("Thao tác chưa được hỗ trợ.");
  }
  db.version++;
  if (command.type === "notification.read") return db;
  db.audit.unshift({
    id: id(),
    actorId: actor.id,
    action: command.type,
    createdAt: new Date().toISOString(),
  });
  db.audit = db.audit.slice(0, 1000);
  return db;
}
