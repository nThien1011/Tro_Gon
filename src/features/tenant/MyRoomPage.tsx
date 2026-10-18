import {
  Home,
  MapPin,
  Users,
  CalendarDays,
  Phone,
  ArrowUpRight,
  Zap,
  Droplets,
  Check,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { buildingOf, ownerOf } from "../../domain/selectors";
import { PageTitle, Empty, Badge } from "../../components/ui";
import { money, dateText, initials } from "../../lib/format";
export default function MyRoomPage() {
  const { data, user } = useApp();
  const tenancy = data.tenancies.find(
      (t) => t.tenantId === user?.id && t.active,
    ),
    room = data.rooms.find((r) => r.id === tenancy?.roomId);
  if (!tenancy || !room)
    return (
      <>
        <PageTitle
          title="Phòng của tôi"
          description="Nơi lưu giữ thông tin về không gian sống của bạn."
        />
        <Empty
          title="Bạn chưa được gắn vào phòng"
          description="Gửi yêu cầu thuê hoặc nhờ chủ trọ thêm tài khoản email, số điện thoại của bạn vào phòng."
          action={
            <a href="#/" className="btn primary">
              Khám phá phòng trống <ArrowUpRight size={17} />
            </a>
          }
        />
      </>
    );
  const building = buildingOf(data, room),
    owner = ownerOf(data, room);
  return (
    <>
      <PageTitle
        title="Không gian của bạn"
        description={`${room.name} · ${building.name}`}
      />
      <div className="my-room-cover">
        <img
          src={room.images[0] || "/images/room-1.jpg"}
          alt="Phòng đang thuê"
        />
        <div>
          <Badge>Đang thuê</Badge>
          <h2>
            {room.name} · {building.name}
          </h2>
          <p>
            <MapPin size={16} />
            {building.address}, {building.area}, {building.city}
          </p>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel padded">
          <h3>Thông tin thuê phòng</h3>
          <div className="info-grid">
            <div>
              <span>Tiền phòng hàng tháng</span>
              <strong>{money(room.rent)}</strong>
            </div>
            <div>
              <span>Diện tích</span>
              <strong>{room.area} m²</strong>
            </div>
            <div>
              <span>Ngày vào ở</span>
              <strong>{dateText(tenancy.startDate)}</strong>
            </div>
            <div>
              <span>Ngày kết thúc dự kiến</span>
              <strong>{dateText(tenancy.endDate)}</strong>
            </div>
            <div>
              <span>Số người ở</span>
              <strong>{tenancy.people} người</strong>
            </div>
            <div>
              <span>Phí dịch vụ hàng tháng</span>
              <strong>{money(room.serviceFee)}</strong>
            </div>
          </div>
          {tenancy.note && <p className="note-text">{tenancy.note}</p>}
          <h3>Tiện ích phòng</h3>
          <div className="amenity-list">
            {room.amenities.map((a) => (
              <span key={a}>
                <Check size={15} />
                {a}
              </span>
            ))}
          </div>
        </section>
        <section className="panel padded">
          <h3>Chủ trọ của bạn</h3>
          <div className="owner-info">
            <span className="avatar large">{initials(owner.name)}</span>
            <div>
              <strong>{owner.name}</strong>
              <small>{owner.email}</small>
            </div>
          </div>
          {owner.phone && (
            <a className="btn secondary full" href={`tel:${owner.phone}`}>
              <Phone size={16} />
              {owner.phone}
            </a>
          )}
          <a href="#/app/support" className="btn primary full">
            Gửi yêu cầu hỗ trợ
          </a>
          <div className="contact-divider" />
          <div className="meter-info">
            <span>
              <Zap size={18} />
              Điện: {money(room.electricityRate)}/kWh
            </span>
            <span>
              <Droplets size={18} />
              Nước: {money(room.waterRate)}/m³
            </span>
          </div>
          <p className="muted small-text">
            Xem chỉ số từng kỳ và ảnh đồng hồ trong chi tiết hóa đơn. Thông tin
            hiện tại của phòng không thay đổi các hóa đơn đã phát hành.
          </p>
          <a href="#/app/billing" className="text-link">
            Xem hóa đơn của tôi →
          </a>
        </section>
      </div>
    </>
  );
}
