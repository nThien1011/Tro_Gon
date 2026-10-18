import { useState, type ReactNode } from "react";
import {
  Home,
  Search,
  Building2,
  DoorOpen,
  Users,
  FileText,
  Megaphone,
  CalendarDays,
  MessageCircle,
  Wrench,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  Heart,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  Bell,
  ClipboardList,
  Activity,
} from "lucide-react";
import { useApp } from "../app/provider";
import { appConfig } from "../config/app";
import { client } from "../services/client";
import { navigate } from "../app/router";
import { initials } from "../lib/format";
import { roleLabels } from "../domain/models";
export function Brand() {
  return (
    <a href="#/" className="brand">
      <span className="brand-mark">
        <Home size={24} strokeWidth={2.4} />
      </span>
      <span>
        trọ<span>gọn</span>
        <i>.</i>
      </span>
    </a>
  );
}
export function DemoBanner() {
  return appConfig.dataSource === "local" ? (
    <div className="demo-banner">
      <span className="live-dot" /> Bản trải nghiệm · Phòng và tài khoản mẫu ·
      Dữ liệu lưu trên trình duyệt này
    </div>
  ) : null;
}
export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <DemoBanner />
      <header className="public-header">
        <div className="container header-inner">
          <Brand />
          <nav className={open ? "open" : ""}>
            <a href="#/" className="nav-active">
              Khám phá phòng
            </a>
            <a href="#/saved">Phòng đã lưu</a>
            <a
              href={
                user?.role === "owner"
                  ? "#/app/buildings"
                  : "#/register?role=owner"
              }
            >
              Dành cho chủ trọ <ArrowUpRight size={13} />
            </a>
          </nav>
          <div className="header-actions">
            {user ? (
              <a className="btn primary" href="#/app">
                <span className="avatar small">{initials(user.name)}</span>Không
                gian của tôi
              </a>
            ) : (
              <>
                <a className="login-link" href="#/login">
                  Đăng nhập
                </a>
                <a className="btn primary" href="#/register">
                  Đăng ký miễn phí <ArrowUpRight size={16} />
                </a>
              </>
            )}
            <button
              aria-label="Mở menu"
              className="icon-btn mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {children}
      <footer className="footer">
        <div className="container footer-main">
          <div>
            <Brand />
            <p>
              Một nơi ở phù hợp.
              <br />
              Một cuộc sống gọn hơn.
            </p>
          </div>
          <div>
            <strong>Khám phá TrọGọn</strong>
            <a href="#/">Tìm phòng trọ</a>
            <a href="#/register?role=owner">Trở thành chủ trọ</a>
            <a href="#/app">Không gian của tôi</a>
          </div>
          <div>
            <strong>Thông tin</strong>
            <a href="#/about">Về TrọGọn</a>
            <a href="#/privacy">Quyền riêng tư</a>
            <a href="#/guide">Hướng dẫn sử dụng</a>
          </div>
          <div className="footer-note">
            <span className="brand-mark pale">
              <Home />
            </span>
            <strong>Kết nối để an tâm hơn</strong>
            <p>
              Kiểm tra phòng, chi phí và điều kiện thuê trực tiếp với chủ trọ
              trước khi quyết định.
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} TrọGọn</span>
          <span>Được xây dựng cho những nơi gọi là nhà.</span>
        </div>
      </footer>
    </>
  );
}
const navOwner = [
  ["", "Tổng quan", LayoutDashboard],
  ["buildings", "Tòa nhà", Building2],
  ["rooms", "Phòng trọ", DoorOpen],
  ["listings", "Tin cho thuê", Megaphone],
  ["tenants", "Người ở", Users],
  ["billing", "Hóa đơn & điện nước", FileText],
  ["requests", "Yêu cầu thuê", ClipboardList],
  ["appointments", "Lịch xem phòng", CalendarDays],
  ["messages", "Tin nhắn", MessageCircle],
  ["support", "Yêu cầu sửa chữa", Wrench],
  ["account", "Tài khoản & ngân hàng", Settings],
] as const;
const navTenant = [
  ["", "Tổng quan", LayoutDashboard],
  ["my-room", "Phòng của tôi", Home],
  ["billing", "Hóa đơn", FileText],
  ["saved", "Phòng đã lưu", Heart],
  ["requests", "Yêu cầu thuê", ClipboardList],
  ["appointments", "Lịch xem phòng", CalendarDays],
  ["messages", "Tin nhắn", MessageCircle],
  ["support", "Hỗ trợ & sửa chữa", Wrench],
  ["account", "Tài khoản", Settings],
] as const;
const navAdmin = [
  ["", "Tổng quan", LayoutDashboard],
  ["moderation", "Duyệt tin đăng", ShieldCheck],
  ["users", "Người dùng", Users],
  ["buildings", "Tòa nhà", Building2],
  ["rooms", "Phòng trọ", DoorOpen],
  ["billing", "Hóa đơn", FileText],
  ["reports", "Báo cáo & hỗ trợ", Wrench],
  ["audit", "Nhật ký hoạt động", Activity],
  ["settings", "Cấu hình nền tảng", Settings],
  ["account", "Tài khoản", Settings],
] as const;
export function AppLayout({
  children,
  path,
}: {
  children: ReactNode;
  path: string;
}) {
  const { user, data, task } = useApp();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const links =
    user.role === "admin"
      ? navAdmin
      : user.role === "owner"
        ? navOwner
        : navTenant;
  const selected = path.split("?")[0].split("/")[2] || "";
  const title =
    links.find((x) => x[0] === selected)?.[1] || "Không gian của tôi";
  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          KHÔNG GIAN{" "}
          {user.role === "owner"
            ? "CHỦ TRỌ"
            : user.role === "admin"
              ? "QUẢN TRỊ"
              : "NGƯỜI THUÊ"}
        </div>
        <nav>
          {links.map(([key, name, Icon]) => (
            <a
              onClick={() => setOpen(false)}
              key={key}
              className={selected === key ? "active" : ""}
              href={`#/app${key ? `/${key}` : ""}`}
            >
              <Icon size={19} />
              <span>{name}</span>
              {key === "moderation" &&
                data.listings.some((l) => l.status === "pending") && (
                  <b>
                    {data.listings.filter((l) => l.status === "pending").length}
                  </b>
                )}
            </a>
          ))}
        </nav>
        <a className="explore-link" href="#/">
          <Search size={17} />
          Khám phá phòng <ArrowUpRight size={16} />
        </a>
        <div className="sidebar-bottom">
          {appConfig.demoEnabled && appConfig.dataSource === "local" && (
            <label className="demo-switch">
              <span>TRẢI NGHIỆM VAI TRÒ</span>
              <select
                aria-label="Đổi tài khoản mẫu"
                value={user.id}
                onChange={(e) => {
                  const u = data.users.find((x) => x.id === e.target.value);
                  if (u)
                    task(async () => {
                      await client.signIn(u.email, appConfig.demoPassword);
                      navigate("/app");
                    });
                }}
              >
                <option value={user.id}>
                  {roleLabels[user.role]} · {user.name}
                </option>
                {data.users
                  .filter(
                    (u) =>
                      ["admin", "owner", "tenant"].includes(u.id) &&
                      u.id !== user.id,
                  )
                  .map((u) => (
                    <option value={u.id} key={u.id}>
                      {roleLabels[u.role]} · {u.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="sidebar-profile">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </div>
            <button
              aria-label="Đăng xuất"
              className="icon-btn"
              onClick={() =>
                task(async () => {
                  await client.signOut();
                  navigate("/");
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}
      <div className="app-body">
        <header className="app-header">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Mở menu"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Không gian của tôi <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div>
            {appConfig.dataSource === "local" && (
              <span className="local-label">
                <span className="live-dot" />
                Dữ liệu trên thiết bị
              </span>
            )}
            <a
              className="icon-btn"
              href={
                user.role === "admin"
                  ? "#/app/moderation"
                  : "#/app/appointments"
              }
              aria-label="Thông báo"
            >
              <Bell size={20} />
            </a>
            <a href="#/app/account" className="avatar small">
              {initials(user.name)}
            </a>
          </div>
        </header>
        <main className="app-content">{children}</main>
        <div className="app-footer">
          TrọGọn · Không gian của bạn, quản lý theo cách của bạn.
        </div>
      </div>
    </div>
  );
}
