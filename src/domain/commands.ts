import type { Command, Database, User, Room, Invoice } from "./models.ts";
import { calculateInvoice } from "./billing.ts";

const id = () => crypto.randomUUID();
const fail = (message: string): never => {
  throw new Error(message);
};
const text = (v: unknown, label: string, max = 300) =>
  typeof v === "string" && v.trim() && v.length <= max
    ? v.trim()
    : fail(`${label} không hợp lệ.`);
const number = (v: unknown, label: string, min = 0) =>
  Number.isFinite(Number(v)) && Number(v) >= min
    ? Number(v)
    : fail(`${label} không hợp lệ.`);
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(new Date(v).getTime())
    ? v
    : fail("Ngày không hợp lệ.");
export function executeCommand(
  db: Database,
  actorId: string,
  command: Command,
): Database {
  const actor =
    db.users.find((u) => u.id === actorId && u.active) ||
    fail("Vui lòng đăng nhập bằng tài khoản đang hoạt động.");
  // Payloads are validated here; a future backend must apply the same checks server-side.
  const p = command.payload as Record<string, any>;
  const admin = () =>
    actor.role === "admin" || fail("Thao tác dành cho quản trị viên.");
  const tenant = () =>
    actor.role === "tenant" || fail("Thao tác dành cho người thuê.");
  const manageBuilding = (buildingId: string) => {
    const b =
      db.buildings.find((b) => b.id === buildingId) ||
      fail("Không tìm thấy tòa nhà.");
    if (
      actor.role !== "admin" &&
      !(actor.role === "owner" && b.ownerId === actor.id)
    )
      fail("Bạn không có quyền quản lý tòa nhà này.");
    return b;
  };
  const manageRoom = (roomId: string) => {
    const r =
      db.rooms.find((r) => r.id === roomId) || fail("Không tìm thấy phòng.");
    manageBuilding(r.buildingId);
    return r;
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
      .forEach(
        (r) => (r.status = r.tenantId === user.id ? "completed" : "rejected"),
      );
  };
  switch (command.type) {
    case "building.save": {
      if (!["owner", "admin"].includes(actor.role))
        fail("Chỉ chủ trọ được tạo tòa nhà.");
      const existing = p.id ? manageBuilding(p.id) : undefined;
      const lat = Number(p.lat),
        lng = Number(p.lng);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      )
        fail("Tọa độ không hợp lệ.");
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
        address: text(p.address, "Địa chỉ"),
        area: text(p.area, "Khu vực"),
        city: text(p.city, "Thành phố"),
        lat,
        lng,
        description: String(p.description || "").slice(0, 3000),
      };
      if (existing) Object.assign(existing, value);
      else db.buildings.push(value);
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
      const capacity = number(p.capacity, "Sức chứa", 1);
      if (!Number.isInteger(capacity)) fail("Sức chứa phải là số nguyên.");
      const value: Room = {
        id: existing?.id || id(),
        buildingId: p.buildingId,
        name,
        area: number(p.area, "Diện tích", 1),
        capacity,
        rent: Math.round(number(p.rent, "Giá thuê")),
        deposit: Math.round(number(p.deposit, "Tiền cọc")),
        electricityRate: Math.round(number(p.electricityRate, "Đơn giá điện")),
        waterRate: Math.round(number(p.waterRate, "Đơn giá nước")),
        serviceFee: Math.round(number(p.serviceFee, "Phí dịch vụ")),
        electricity:
          existing?.electricity ?? number(p.electricity, "Chỉ số điện gốc"),
        water: existing?.water ?? number(p.water, "Chỉ số nước gốc"),
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
                  /^(data:image\/|\/images\/|https:\/\/)/.test(x),
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
      break;
    }
    case "room.delete": {
      const r = manageRoom(p.id);
      if (
        db.tenancies.some((t) => t.roomId === r.id) ||
        db.invoices.some((i) => i.roomId === r.id)
      )
        fail(
          "Phòng có lịch sử thuê hoặc hóa đơn. Chuyển sang bảo trì thay vì xóa.",
        );
      db.rooms = db.rooms.filter((x) => x.id !== r.id);
      db.listings = db.listings.filter((l) => l.roomId !== r.id);
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
      break;
    }
    case "listing.hide": {
      const l =
        db.listings.find((l) => l.id === p.id) || fail("Tin không tồn tại.");
      manageRoom(l.roomId);
      l.status = "hidden";
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
      break;
    }
    case "tenancy.assign": {
      const r = manageRoom(p.roomId);
      const contact = String(p.contact || "")
        .trim()
        .toLowerCase()
        .replace(/^\+84/, "0");
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
      room.status = "available";
      break;
    }
    case "request.create": {
      tenant();
      const r =
        db.rooms.find((r) => r.id === p.roomId && r.status === "available") ||
        fail("Phòng không còn trống.");
      if (
        !db.listings.some((l) => l.roomId === r.id && l.status === "published")
      )
        fail("Phòng chưa mở nhận yêu cầu.");
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
      break;
    }
    case "request.respond": {
      const r =
        db.requests.find((r) => r.id === p.id) ||
        fail("Yêu cầu không tồn tại.");
      manageRoom(r.roomId);
      if (r.status !== "pending") fail("Yêu cầu đã được xử lý.");
      r.status = p.accept ? "accepted" : "rejected";
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
        fail("Không có quyền hủy yêu cầu.");
      if (!["pending", "accepted"].includes(r.status))
        fail("Yêu cầu đã kết thúc.");
      r.status = "cancelled";
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
      const value: Invoice = {
        id: existing?.id || id(),
        roomId: room.id,
        tenantId: tenancy.tenantId,
        tenantName: db.users.find((u) => u.id === tenancy.tenantId)!.name,
        roomName: room.name,
        buildingName: db.buildings.find((b) => b.id === room.buildingId)!.name,
        period: p.period,
        oldElectricity: room.electricity,
        newElectricity: number(p.newElectricity, "Chỉ số điện mới"),
        oldWater: room.water,
        newWater: number(p.newWater, "Chỉ số nước mới"),
        rent: room.rent,
        serviceFee: room.serviceFee,
        electricityRate: room.electricityRate,
        waterRate: room.waterRate,
        electricityPhoto: p.electricityPhoto,
        waterPhoto: p.waterPhoto,
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
      }
      break;
    }
    case "invoice.cancel": {
      const i =
        db.invoices.find((i) => i.id === p.id) ||
        fail("Hóa đơn không tồn tại.");
      const r = manageRoom(i.roomId);
      if (i.paymentStatus !== "unpaid" || i.status === "cancelled")
        fail("Không hủy hóa đơn đã thu hoặc đang chờ xác nhận.");
      if (
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
      break;
    }
    case "payment.notify": {
      const i =
        db.invoices.find(
          (i) =>
            i.id === p.id && i.tenantId === actor.id && i.status === "issued",
        ) || fail("Không có quyền xác nhận hóa đơn này.");
      if (i.paymentStatus !== "unpaid")
        fail("Hóa đơn đã được thông báo hoặc đã thu.");
      i.paymentStatus = "pending";
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
      break;
    }
    case "favorite.toggle": {
      tenant();
      const l =
        db.listings.find((l) => l.id === p.id) || fail("Tin không tồn tại.");
      const found = db.favorites.find(
        (f) => f.userId === actor.id && f.listingId === l.id,
      );
      db.favorites = found
        ? db.favorites.filter((f) => f !== found)
        : [...db.favorites, { userId: actor.id, listingId: l.id }];
      break;
    }
    case "appointment.create": {
      tenant();
      if (
        !db.listings.some(
          (l) => l.id === p.listingId && l.status === "published",
        )
      )
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
      break;
    }
    case "conversation.start": {
      tenant();
      const l =
        db.listings.find((l) => l.id === p.listingId) ||
        fail("Tin không tồn tại.");
      if (
        l.status !== "published" &&
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
        ) || fail("Bạn không thuộc hội thoại này.");
      c.messages.push({
        id: id(),
        senderId: actor.id,
        body: text(p.body, "Tin nhắn", 3000),
        createdAt: new Date().toISOString(),
      });
      break;
    }
    case "ticket.create": {
      if (
        p.category === "repair" &&
        !db.tenancies.some(
          (t) => t.active && t.tenantId === actor.id && t.roomId === p.roomId,
        )
      )
        fail("Chỉ gửi sửa chữa cho phòng đang thuê.");
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
      break;
    }
    case "ticket.respond": {
      const t =
        db.tickets.find((t) => t.id === p.id) || fail("Yêu cầu không tồn tại.");
      if (actor.role !== "admin") {
        if (t.category !== "repair" || !t.roomId)
          fail("Thao tác dành cho admin.");
        manageRoom(t.roomId!);
      }
      if (!["open", "in_progress", "resolved"].includes(p.status))
        fail("Trạng thái không hợp lệ.");
      t.status = p.status;
      t.response = String(p.response || "").slice(0, 3000);
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
      Object.assign(actor, { name: text(p.name, "Họ tên"), email, phone });
      if (actor.role === "owner")
        Object.assign(actor, {
          bankBin: String(p.bankBin || ""),
          bankAccount: String(p.bankAccount || "").replace(/\s/g, ""),
          bankName: String(p.bankName || "").trim(),
        });
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
      break;
    }
    default:
      fail("Thao tác chưa được hỗ trợ.");
  }
  db.version++;
  db.audit.unshift({
    id: id(),
    actorId: actor.id,
    action: command.type,
    createdAt: new Date().toISOString(),
  });
  db.audit = db.audit.slice(0, 1000);
  return db;
}
