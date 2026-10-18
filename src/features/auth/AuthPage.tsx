import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Home,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Brand } from "../../components/layout";
import { Field } from "../../components/ui";
import { useApp } from "../../app/provider";
import { client } from "../../services/client";
import { appConfig } from "../../config/app";
import { navigate } from "../../app/router";
import type { Role } from "../../domain/models";
export default function AuthPage({
  register,
  route,
}: {
  register: boolean;
  route: string;
}) {
  const { task } = useApp();
  const [role, setRole] = useState<"tenant" | "owner">(
    route.includes("role=owner") ? "owner" : "tenant",
  );
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const demo = async (role: Role) => {
    setBusy(true);
    await task(async () => {
      await client.signIn(appConfig.demoAccounts[role], appConfig.demoPassword);
      navigate("/app");
    }, "Đã mở tài khoản trải nghiệm.");
    setBusy(false);
  };
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Brand />
        <div>
          <span className="eyebrow light">
            KHÔNG GIAN TỐT HƠN, BẮT ĐẦU TỪ ĐÂY
          </span>
          <h1>
            Tìm nơi ở.
            <br />
            Tìm sự an tâm.
          </h1>
          <p>
            Từ một căn phòng phù hợp đến việc quản lý mỗi ngày. TrọGọn đồng hành
            cùng bạn.
          </p>
          <div className="auth-house">
            <Home size={100} strokeWidth={1} />
            <span className="auth-tag">Một nơi để gọi là nhà.</span>
          </div>
        </div>
        <small>© {new Date().getFullYear()} TrọGọn</small>
      </section>
      <section className="auth-form-wrap">
        <a href="#/" className="back-link">
          ← Trở về khám phá phòng
        </a>
        <div className="auth-form">
          <h2>
            {register ? "Chào mừng đến TrọGọn" : "Rất vui được gặp lại bạn"}
          </h2>
          <p>
            {register
              ? "Tạo tài khoản và bắt đầu không gian của bạn."
              : "Đăng nhập để tiếp tục hành trình của bạn."}
          </p>
          {register && (
            <div className="role-options">
              <button
                type="button"
                className={role === "tenant" ? "selected" : ""}
                onClick={() => setRole("tenant")}
              >
                <Home size={22} />
                <strong>Tôi tìm thuê</strong>
                <small>Tìm phòng & quản lý việc ở</small>
              </button>
              <button
                type="button"
                className={role === "owner" ? "selected" : ""}
                onClick={() => setRole("owner")}
              >
                <Building2 size={22} />
                <strong>Tôi là chủ trọ</strong>
                <small>Đăng phòng & quản lý cho thuê</small>
              </button>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(
                new FormData(e.currentTarget),
              ) as Record<string, string>;
              setBusy(true);
              await task(
                async () => {
                  if (register) {
                    if (values.password !== values.confirmPassword)
                      throw new Error("Hai mật khẩu chưa khớp.");
                    await client.register({
                      name: values.name,
                      email: values.email,
                      phone: values.phone,
                      password: values.password,
                      role,
                    });
                  } else await client.signIn(values.contact, values.password);
                  navigate("/app");
                },
                register ? "Tài khoản đã được tạo." : "Đăng nhập thành công.",
              );
              setBusy(false);
            }}
          >
            {register ? (
              <>
                <Field
                  label="Họ và tên"
                  name="name"
                  autoComplete="name"
                  placeholder="Nguyễn Văn An"
                  required
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@email.com"
                />
                <Field
                  label="Số điện thoại"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="09xxxxxxxx"
                  hint="Điền ít nhất email hoặc số điện thoại. Thông tin xác minh sẽ do backend cung cấp khi tích hợp."
                />
              </>
            ) : (
              <Field
                label="Email hoặc số điện thoại"
                name="contact"
                autoComplete="username"
                placeholder="Nhập email hoặc số điện thoại"
                required
              />
            )}
            <div className="password-field">
              <Field
                label="Mật khẩu"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                minLength={8}
                placeholder="Ít nhất 8 ký tự"
                required
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Hiện hoặc ẩn mật khẩu"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {register && (
              <Field
                label="Nhập lại mật khẩu"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            )}
            <button disabled={busy} className="btn primary full">
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Đã có tài khoản?" : "Bạn mới đến TrọGọn?"}{" "}
            <a href={register ? "#/login" : "#/register"}>
              {register ? "Đăng nhập" : "Tạo tài khoản miễn phí"}
            </a>
          </p>
          {appConfig.demoEnabled && appConfig.dataSource === "local" && (
            <div className="demo-accounts">
              <span>HOẶC KHÁM PHÁ BẰNG TÀI KHOẢN MẪU</span>
              <div>
                <button disabled={busy} onClick={() => demo("tenant")}>
                  <Home size={17} />
                  Người thuê
                </button>
                <button disabled={busy} onClick={() => demo("owner")}>
                  <Building2 size={17} />
                  Chủ trọ
                </button>
                <button disabled={busy} onClick={() => demo("admin")}>
                  <ShieldCheck size={17} />
                  Admin
                </button>
              </div>
              <small>
                Bản thử nghiệm lưu cục bộ. Không nhập mật khẩu hoặc dữ liệu nhạy
                cảm đang dùng thật.
              </small>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
