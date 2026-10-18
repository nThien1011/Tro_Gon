import {
  Building2,
  DoorOpen,
  Users,
  Wallet,
  ArrowUpRight,
  CalendarDays,
  FileText,
  ShieldCheck,
  Sparkles,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { calculateInvoice } from "../../domain/billing";
import { money, dateText } from "../../lib/format";
import { PageTitle, Stat, Status, Empty } from "../../components/ui";
export default function DashboardPage() {
  const { data, user } = useApp();
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    invoices = data.invoices.filter(
      (i) =>
        i.status === "issued" &&
        (user.role === "admin" ||
          (user.role === "tenant"
            ? i.tenantId === user.id
            : rooms.some((r) => r.id === i.roomId))),
    );
  const paid = invoices
      .filter((i) => i.paymentStatus === "paid")
      .reduce((s, i) => s + calculateInvoice(i).total, 0),
    debt = invoices
      .filter((i) => i.paymentStatus !== "paid")
      .reduce((s, i) => s + calculateInvoice(i).total, 0);
  const active = data.tenancies.find((t) => t.tenantId === user.id && t.active),
    myRoom = data.rooms.find((r) => r.id === active?.roomId);
  const buildingCount =
    user.role === "admin"
      ? data.buildings.length
      : data.buildings.filter((b) => b.ownerId === user.id).length;
  return (
    <>
      <PageTitle
        title={
          user.role === "admin"
            ? "Chào quản trị viên, ngày mới tốt lành 👋"
            : `Chào ${user.name.split(" ").slice(-2).join(" ")}, ngày mới tốt lành 👋`
        }
        description={
          user.role === "tenant"
            ? "Mọi thông tin về nơi ở của bạn, gọn trong một không gian."
            : "Một góc nhìn rõ ràng về hoạt động cho thuê của bạn."
        }
        action={
          <a className="btn secondary" href="#/">
            <ArrowUpRight size={17} />
            Khám phá phòng
          </a>
        }
      />
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow light">
            {user.role === "admin"
              ? "KẾT NỐI NHỮNG KHÔNG GIAN SỐNG"
              : user.role === "owner"
                ? "GỌN VIỆC QUẢN LÝ, THÊM THỜI GIAN CHO BẠN"
                : "NƠI BẠN CẢM THẤY THUỘC VỀ"}
          </span>
          <h2>
            {user.role === "tenant" ? (
              <>
                Một nơi ở tốt.
                <br />
                Một cuộc sống an tâm.
              </>
            ) : user.role === "owner" ? (
              <>
                Mỗi căn phòng,
                <br />
                một khởi đầu mới.
              </>
            ) : (
              <>
                Quản lý rõ ràng.
                <br />
                Kết nối tin cậy.
              </>
            )}
          </h2>
          <a
            href={
              user.role === "admin"
                ? "#/app/moderation"
                : user.role === "owner"
                  ? "#/app/rooms"
                  : "#/app/my-room"
            }
          >
            {user.role === "admin"
              ? "Xem tin chờ duyệt"
              : user.role === "owner"
                ? "Quản lý các phòng"
                : "Xem phòng của tôi"}
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="dashboard-illustration">
          <Building2 size={132} strokeWidth={0.8} />
          <DoorOpen size={64} strokeWidth={1} />
          <span>
            <Sparkles size={22} />
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {user.role === "tenant" ? (
          <>
            <Stat
              label="Phòng đang thuê"
              value={myRoom?.name || "Chưa có"}
              icon={<DoorOpen />}
              note={
                myRoom
                  ? buildingOf(data, myRoom).name
                  : "Bắt đầu tìm nơi ở phù hợp"
              }
            />
            <Stat
              label="Cần thanh toán"
              value={money(debt)}
              icon={<Wallet />}
              note={`${invoices.filter((i) => i.paymentStatus !== "paid").length} hóa đơn đang mở`}
            />
            <Stat
              label="Phòng đã lưu"
              value={data.favorites.filter((f) => f.userId === user.id).length}
              icon={<Building2 />}
              note="Những lựa chọn bạn quan tâm"
            />
            <Stat
              label="Yêu cầu hỗ trợ"
              value={
                data.tickets.filter(
                  (t) => t.authorId === user.id && t.status !== "resolved",
                ).length
              }
              icon={<CalendarDays />}
              note="Đang được tiếp nhận"
            />
          </>
        ) : (
          <>
            <Stat
              label="Tòa nhà"
              value={buildingCount}
              icon={<Building2 />}
              note={`${rooms.length} phòng trong hệ thống`}
            />
            <Stat
              label="Đang có người thuê"
              value={`${rooms.filter((r) => r.status === "occupied").length} / ${rooms.length}`}
              icon={<DoorOpen />}
              note={`${rooms.filter((r) => r.status === "available").length} phòng còn trống`}
            />
            <Stat
              label="Đã thu"
              value={money(paid)}
              icon={<Wallet />}
              note="Từ các hóa đơn đã xác nhận"
            />
            <Stat
              label={user.role === "admin" ? "Tin chờ duyệt" : "Còn phải thu"}
              value={
                user.role === "admin"
                  ? data.listings.filter((l) => l.status === "pending").length
                  : money(debt)
              }
              icon={user.role === "admin" ? <ShieldCheck /> : <FileText />}
              note={
                user.role === "admin"
                  ? "Cần kiểm tra nội dung"
                  : "Chưa gồm tiền cọc"
              }
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              {user.role === "tenant"
                ? "Hóa đơn gần đây"
                : "Tình trạng các phòng"}
            </h3>
            <a href={user.role === "tenant" ? "#/app/billing" : "#/app/rooms"}>
              Xem tất cả <ArrowUpRight size={15} />
            </a>
          </div>
          {user.role === "tenant" ? (
            invoices.length ? (
              invoices
                .slice(-5)
                .reverse()
                .map((i) => (
                  <div className="list-row" key={i.id}>
                    <span className="list-icon">
                      <FileText size={20} />
                    </span>
                    <div>
                      <strong>Hóa đơn tháng {i.period}</strong>
                      <small>Hạn thanh toán {dateText(i.dueDate)}</small>
                    </div>
                    <div className="row-end">
                      <strong>{money(calculateInvoice(i).total)}</strong>
                      <Status value={i.paymentStatus} />
                    </div>
                  </div>
                ))
            ) : (
              <Empty
                title="Chưa có hóa đơn"
                description="Hóa đơn chủ trọ phát hành sẽ xuất hiện ở đây."
              />
            )
          ) : rooms.length ? (
            rooms.slice(0, 5).map((r) => (
              <div className="list-row" key={r.id}>
                <span className="list-icon">
                  <DoorOpen size={20} />
                </span>
                <div>
                  <strong>{r.name}</strong>
                  <small>{buildingOf(data, r).name}</small>
                </div>
                <div className="row-end">
                  <strong>{money(r.rent)}/tháng</strong>
                  <Status value={r.status} />
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Bắt đầu với tòa nhà đầu tiên"
              action={
                <a className="btn primary" href="#/app/buildings">
                  <Plus size={16} />
                  Thêm tòa nhà
                </a>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>
              {user.role === "admin" ? "Hoạt động mới nhất" : "Việc cần chú ý"}
            </h3>
            <CalendarDays size={18} />
          </div>
          {user.role === "admin" ? (
            data.audit.length ? (
              data.audit.slice(0, 6).map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {data.users.find((u) => u.id === a.actorId)?.name}
                    </strong>
                    <p>{a.action}</p>
                    <small>{dateText(a.createdAt)}</small>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Sẵn sàng theo dõi"
                description="Các thao tác quản lý sẽ được ghi vào nhật ký."
              />
            )
          ) : (
            <>
              <a className="attention-card" href="#/app/requests">
                <span className="list-icon">
                  <Users size={21} />
                </span>
                <div>
                  <strong>Yêu cầu thuê phòng</strong>
                  <p>Xem phản hồi và điều kiện thuê</p>
                </div>
                <ArrowUpRight size={18} />
              </a>
              <a className="attention-card" href="#/app/appointments">
                <span className="list-icon amber">
                  <CalendarDays size={21} />
                </span>
                <div>
                  <strong>Lịch xem phòng</strong>
                  <p>Theo dõi những cuộc hẹn sắp tới</p>
                </div>
                <ArrowUpRight size={18} />
              </a>
              <a className="attention-card" href="#/app/support">
                <span className="list-icon purple">
                  <FileText size={21} />
                </span>
                <div>
                  <strong>Hỗ trợ & sửa chữa</strong>
                  <p>Giữ không gian sống luôn tốt</p>
                </div>
                <ArrowUpRight size={18} />
              </a>
              <div className="dashboard-tip">
                <Sparkles size={18} />
                <p>
                  {user.role === "owner"
                    ? "Cập nhật tình trạng phòng thường xuyên để người tìm thuê nhận được thông tin phù hợp."
                    : "Đối chiếu chỉ số đồng hồ và chi tiết các khoản phí trên hóa đơn trước khi thanh toán."}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
