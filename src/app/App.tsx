import { lazy, Suspense, useEffect, Component, type ReactNode } from "react";
import { useApp } from "./provider";
import { useRoute } from "./router";
import { PublicLayout, AppLayout } from "../components/layout";
import { Empty } from "../components/ui";
import ExplorePage from "../features/explore/ExplorePage";
const AuthPage = lazy(() => import("../features/auth/AuthPage"));
const ResetPasswordPage = lazy(
  () => import("../features/auth/ResetPasswordPage"),
);
const RoomDetail = lazy(() => import("../features/explore/RoomDetail"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const BuildingsPage = lazy(() => import("../features/owner/BuildingsPage"));
const RoomsPage = lazy(() => import("../features/owner/RoomsPage"));
const ListingsPage = lazy(() => import("../features/owner/ListingsPage"));
const TenantsPage = lazy(() => import("../features/owner/TenantsPage"));
const MyRoomPage = lazy(() => import("../features/tenant/MyRoomPage"));
const BillingPage = lazy(() => import("../features/billing/BillingPage"));
const RentalActivityPage = lazy(
  () => import("../features/rental/RentalActivityPage"),
);
const MessagesPage = lazy(() => import("../features/messaging/MessagesPage"));
const SupportPage = lazy(() => import("../features/support/SupportPage"));
const AccountPage = lazy(() => import("../features/account/AccountPage"));
const InfoPage = lazy(() => import("../features/info/InfoPage"));
const UsersPage = lazy(() =>
  import("../features/admin/AdminPages").then((m) => ({
    default: m.UsersPage,
  })),
);
const AuditPage = lazy(() =>
  import("../features/admin/AdminPages").then((m) => ({
    default: m.AuditPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/admin/AdminPages").then((m) => ({
    default: m.SettingsPage,
  })),
);
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="startup">
        <h2>Trang đang gặp sự cố</h2>
        <p>{this.state.error}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Tải lại trang
        </button>
        <a href="#/" onClick={() => this.setState({ error: "" })}>
          Về trang chủ
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function ProtectedContent({ route }: { route: string }) {
  const { user } = useApp();
  if (!user)
    return (
      <div className="container">
        <Empty
          title="Đăng nhập để mở không gian của bạn"
          description="Tài khoản giúp liên kết phòng, yêu cầu và hóa đơn với đúng người sử dụng."
          action={
            <a href="#/login" className="btn primary">
              Đăng nhập
            </a>
          }
        />
      </div>
    );
  const section = route.split("?")[0].split("/")[2] || "";
  const role = user.role;
  const pages: Record<string, ReactNode> = {
    "": <DashboardPage />,
    account: <AccountPage />,
    billing: <BillingPage />,
    support: <SupportPage />,
  };
  if (role !== "tenant")
    Object.assign(pages, {
      buildings: <BuildingsPage />,
      rooms: <RoomsPage route={route} />,
      listings: <ListingsPage />,
      tenants: <TenantsPage />,
    });
  if (role !== "admin")
    Object.assign(pages, {
      requests: <RentalActivityPage />,
      appointments: <RentalActivityPage appointments />,
      messages: <MessagesPage route={route} />,
    });
  if (role === "tenant")
    Object.assign(pages, {
      "my-room": <MyRoomPage />,
      saved: <ExplorePage saved />,
    });
  if (role === "admin")
    Object.assign(pages, {
      moderation: <ListingsPage moderation />,
      users: <UsersPage />,
      reports: <SupportPage />,
      audit: <AuditPage />,
      settings: <SettingsPage />,
    });
  return (
    <AppLayout path={route}>
      {pages[section] || (
        <Empty
          title="Trang không thuộc quyền truy cập của bạn"
          action={
            <a href="#/app" className="btn primary">
              Về tổng quan
            </a>
          }
        />
      )}
    </AppLayout>
  );
}
export default function App() {
  const route = useRoute(),
    path = route.split("?")[0];
  const { data } = useApp();
  useEffect(() => {
    document.title = path.startsWith("/app")
      ? `Không gian của tôi · ${data.settings.siteName}`
      : path === "/login"
        ? "Đăng nhập · TrọGọn"
        : path === "/register"
          ? "Đăng ký · TrọGọn"
          : `${data.settings.siteName} — Tìm nơi ở, sống an tâm`;
  }, [path, data.settings.siteName]);
  let content: ReactNode;
  if (path === "/login" || path === "/register")
    content = (
      <AuthPage key={path} route={route} register={path === "/register"} />
    );
  else if (path === "/reset-password") content = <ResetPasswordPage />;
  else if (path.startsWith("/app"))
    content = <ProtectedContent route={route} />;
  else
    content = (
      <PublicLayout>
        {data.settings.maintenance && (
          <div className="maintenance-banner">
            TrọGọn đang bảo trì một số chức năng. Vui lòng lưu dữ liệu trước khi
            tiếp tục.
          </div>
        )}
        {path === "/" || path === "/saved" ? (
          <ExplorePage key={path} saved={path === "/saved"} />
        ) : path.startsWith("/room/") ? (
          <RoomDetail key={path} id={path.split("/")[2]} />
        ) : ["/about", "/privacy", "/guide"].includes(path) ? (
          <InfoPage page={path} />
        ) : (
          <Empty
            title="Không tìm thấy trang"
            action={
              <a href="#/" className="btn primary">
                Về trang chủ
              </a>
            }
          />
        )}
      </PublicLayout>
    );
  return (
    <ErrorBoundary key={path}>
      <Suspense
        fallback={
          <div className="page-loading">
            <span className="spinner" />
            Đang mở không gian…
          </div>
        }
      >
        {content}
      </Suspense>
    </ErrorBoundary>
  );
}
