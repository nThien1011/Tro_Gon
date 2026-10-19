import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Ruler,
  Users,
  CalendarDays,
  MessageCircle,
  Phone,
  Check,
  ArrowRight,
  Flag,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { buildingOf, ownerOf } from "../../domain/selectors";
import { money, dateText, initials } from "../../lib/format";
import { navigate } from "../../app/router";
import { buildingAddress, hasCoordinates } from "../../config/locations";
import { appConfig } from "../../config/app";
import {
  Empty,
  Badge,
  Modal,
  Field,
  Textarea,
  formValues,
} from "../../components/ui";
export default function RoomDetail({ id }: { id: string }) {
  const { data, user, execute, toast } = useApp();
  const [mode, setMode] = useState<"view" | "rent" | "report" | null>(null);
  const [image, setImage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const listing = data.listings.find((l) => l.id === id),
    room = data.rooms.find((r) => r.id === listing?.roomId);
  if (
    !listing ||
    !room ||
    (listing.status !== "published" &&
      user?.role !== "admin" &&
      ownerOf(data, room).id !== user?.id)
  )
    return (
      <div className="container">
        <Empty
          title="Tin chưa hiển thị hoặc đã ngừng cho thuê"
          action={
            <a className="btn primary" href="#/">
              Tìm phòng khác
            </a>
          }
        />
      </div>
    );
  const building = buildingOf(data, room),
    owner = ownerOf(data, room);
  const available =
    room.status === "available" && listing.status === "published";
  const requireTenant = (fn: () => void) => {
    if (!user) navigate("/login");
    else if (user.role !== "tenant")
      toast("Đăng nhập bằng tài khoản người thuê để thực hiện.");
    else fn();
  };
  return (
    <main className="container detail-page">
      <a href="#/" className="back-link">
        <ArrowLeft size={16} />
        Khám phá phòng
      </a>
      <div className="detail-title">
        <div>
          <Badge tone={available ? "green" : "gray"}>
            {available
              ? appConfig.dataSource === "local"
                ? "Còn nhận khách · Dữ liệu mẫu"
                : "Còn nhận khách"
              : "Đã ngừng nhận khách"}
          </Badge>
          <h1>{listing.title}</h1>
          <p>
            <MapPin size={17} />
            {buildingAddress(building)}
          </p>
        </div>
        <div className="detail-price">
          <strong>{money(room.rent)}</strong>
          <span>/ tháng</span>
        </div>
      </div>
      <div className="gallery">
        {(room.images.length ? room.images : ["/images/room-1.jpg"]).map(
          (src, i) => (
            <button key={i} onClick={() => setImage(src)}>
              <img src={src} alt={`Góc nhìn phòng ${i + 1}`} />
              {i === 0 && appConfig.dataSource === "local" && (
                <span>Ảnh minh họa</span>
              )}
            </button>
          ),
        )}
      </div>
      <div className="detail-grid">
        <div>
          <div className="detail-specs">
            <span>
              <Ruler />
              <strong>{room.area} m²</strong>Diện tích
            </span>
            <span>
              <Users />
              <strong>{room.capacity} người</strong>Sức chứa tối đa
            </span>
            <span>
              <MapPin />
              <strong>
                {building.ward || building.district || building.area}
              </strong>
              Khu vực
            </span>
          </div>
          <section className="detail-section">
            <h2>Một chút về căn phòng</h2>
            <p>{listing.description}</p>
            <p>{building.description}</p>
          </section>
          <section className="detail-section">
            <h2>Tiện ích cho cuộc sống của bạn</h2>
            <div className="amenity-list">
              {room.amenities.map((a) => (
                <span key={a}>
                  <Check size={17} />
                  {a}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Các khoản phí rõ ràng</h2>
            <div className="fee-table">
              {[
                ["Tiền phòng hàng tháng", money(room.rent)],
                [
                  room.electricityBillingMode === "fixed"
                    ? "Điện cố định"
                    : "Điện theo công tơ",
                  room.electricityBillingMode === "fixed"
                    ? `${money(room.electricityMonthlyFee || 0)} / tháng`
                    : `${money(room.electricityRate)} / kWh`,
                ],
                [
                  room.waterBillingMode === "fixed"
                    ? "Nước cố định"
                    : "Nước theo đồng hồ",
                  room.waterBillingMode === "fixed"
                    ? `${money(room.waterMonthlyFee || 0)} / tháng`
                    : `${money(room.waterRate)} / m³`,
                ],
                ["Phí dịch vụ cố định", `${money(room.serviceFee)} / tháng`],
                ["Tiền cọc dự kiến", money(room.deposit)],
              ].map(([a, b]) => (
                <div key={a}>
                  <span>{a}</span>
                  <strong>{b}</strong>
                </div>
              ))}
            </div>
            <p className="muted small-text">
              Tiền điện và nước phụ thuộc mức sử dụng. Kiểm tra điều kiện thuê
              và hoàn cọc trực tiếp với chủ trọ.
            </p>
          </section>
          <section className="detail-section">
            <h2>Vị trí và khu vực</h2>
            <div className="location-card">
              <MapPin size={28} />
              <div>
                <strong>{building.name}</strong>
                <p>{buildingAddress(building)}</p>
                {hasCoordinates(building) && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${building.lat}&mlon=${building.lng}#map=16/${building.lat}/${building.lng}`}
                  >
                    Mở vị trí trên bản đồ ↗
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>
        <aside>
          <div className="contact-card">
            <span className="eyebrow">TRAO ĐỔI TRỰC TIẾP</span>
            <div className="owner-info">
              <span className="avatar large">{initials(owner.name)}</span>
              <div>
                <h3>{owner.name}</h3>
                <span>
                  {appConfig.dataSource === "local"
                    ? "Chủ trọ · Tài khoản mẫu"
                    : "Chủ trọ"}
                </span>
              </div>
            </div>
            <p>
              Hỏi thêm thông tin và thống nhất lịch xem trước khi quyết định.
            </p>
            <button
              disabled={!available}
              className="btn primary full"
              onClick={() => requireTenant(() => setMode("view"))}
            >
              <CalendarDays size={18} />
              Đặt lịch xem phòng
            </button>
            <button
              className="btn secondary full"
              onClick={() =>
                requireTenant(async () => {
                  if (
                    await execute({
                      type: "conversation.start",
                      payload: { listingId: id },
                    })
                  )
                    navigate(`/app/messages?listing=${id}`);
                })
              }
            >
              <MessageCircle size={18} />
              Nhắn tin cho chủ trọ
            </button>
            {owner.phone && (
              <a className="phone-link" href={`tel:${owner.phone}`}>
                <Phone size={16} />
                {owner.phone} <small>(số mẫu)</small>
              </a>
            )}
            <div className="contact-divider" />
            <button
              disabled={!available}
              className="btn text full"
              onClick={() => requireTenant(() => setMode("rent"))}
            >
              Gửi yêu cầu thuê <ArrowRight size={17} />
            </button>
            <small>Không thu tiền hoặc giữ phòng khi đặt lịch xem.</small>
          </div>
          <button
            className="report-link"
            onClick={() => {
              if (!user) navigate("/login");
              else setMode("report");
            }}
          >
            <Flag size={14} />
            Báo cáo thông tin tin đăng
          </button>
          <p className="detail-updated">
            Cập nhật {dateText(listing.createdAt)}
          </p>
        </aside>
      </div>
      {image && (
        <Modal title="Hình ảnh phòng" wide onClose={() => setImage(undefined)}>
          <img
            className="lightbox-image"
            src={image}
            alt="Ảnh phòng phóng to"
          />
        </Modal>
      )}
      {mode && (
        <Modal
          title={
            mode === "view"
              ? "Hẹn một lần xem phòng"
              : mode === "rent"
                ? "Gửi yêu cầu thuê phòng"
                : "Báo cáo tin đăng"
          }
          onClose={() => setMode(null)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = formValues(e.currentTarget);
              setBusy(true);
              const ok = await execute(
                mode === "view"
                  ? {
                      type: "appointment.create",
                      payload: {
                        listingId: id,
                        date: values.date,
                        note: values.note,
                      },
                    }
                  : mode === "rent"
                    ? {
                        type: "request.create",
                        payload: { roomId: room.id, ...values },
                      }
                    : {
                        type: "ticket.create",
                        payload: {
                          category: "report",
                          roomId: room.id,
                          title: `Báo cáo tin ${listing.title}`,
                          content: values.note,
                        },
                      },
                mode === "report"
                  ? "Đã gửi báo cáo đến quản trị viên."
                  : "Đã gửi yêu cầu đến chủ trọ.",
              );
              setBusy(false);
              if (ok) setMode(null);
            }}
          >
            <p className="form-intro">
              {listing.title} · {room.name} · {money(room.rent)}/tháng
            </p>
            {mode !== "report" && (
              <Field
                label={
                  mode === "view"
                    ? "Ngày giờ bạn muốn đến xem"
                    : "Ngày dự kiến vào ở"
                }
                name="date"
                type={mode === "view" ? "datetime-local" : "date"}
                min={new Date()
                  .toISOString()
                  .slice(0, mode === "view" ? 16 : 10)}
                required
              />
            )}
            {mode === "rent" && (
              <Field
                label="Số người ở"
                name="people"
                type="number"
                min={1}
                max={room.capacity}
                defaultValue={1}
                required
              />
            )}
            <Textarea
              label={
                mode === "report"
                  ? "Lý do và thông tin cần kiểm tra"
                  : "Lời nhắn cho chủ trọ"
              }
              name="note"
              required={mode === "report"}
            />
            <button disabled={busy} className="btn primary full">
              {busy ? "Đang gửi…" : "Gửi yêu cầu"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
