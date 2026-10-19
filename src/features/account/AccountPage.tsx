import { useState } from "react";
import { Save, LockKeyhole, Wallet } from "lucide-react";
import { useApp } from "../../app/provider";
import { client } from "../../services/client";
import { PageTitle, Field, Select, formValues } from "../../components/ui";
import { initials } from "../../lib/format";
import { roleLabels } from "../../domain/models";
import { appConfig } from "../../config/app";
import ContactVerification from "./ContactVerification";
export default function AccountPage() {
  const { user, execute, task } = useApp();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <>
      <PageTitle
        title="Tài khoản của tôi"
        description="Quản lý thông tin liên hệ và các tùy chọn của bạn."
      />
      <div className="account-grid">
        <aside className="panel account-profile">
          <span className="avatar huge">{initials(user.name)}</span>
          <h2>{user.name}</h2>
          <p>{roleLabels[user.role]}</p>
          <small>{user.email || user.phone}</small>
        </aside>
        <div>
          {appConfig.dataSource === "api" && <ContactVerification />}
          <form
            className="panel padded"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await execute(
                { type: "profile.save", payload: formValues(e.currentTarget) },
                "Đã cập nhật hồ sơ.",
              );
              setBusy(false);
            }}
          >
            <h3>Thông tin cá nhân</h3>
            <Field
              label="Họ tên"
              name="name"
              defaultValue={user.name}
              required
            />
            <div className="form-grid">
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={user.email}
              />
              <Field
                label="Số điện thoại"
                name="phone"
                type="tel"
                defaultValue={user.phone}
              />
            </div>
            <p className="muted small-text">
              Giữ ít nhất email hoặc số điện thoại để liên kết tài khoản với
              phòng.
            </p>
            {user.role === "owner" && (
              <>
                <div className="section-divider" />
                <h3>
                  <Wallet size={19} />
                  Thông tin nhận chuyển khoản
                </h3>
                <Select
                  label="Ngân hàng"
                  name="bankBin"
                  defaultValue={user.bankBin || ""}
                >
                  <option value="">Chưa cấu hình ngân hàng</option>
                  <option value="970436">Vietcombank</option>
                  <option value="970418">BIDV</option>
                  <option value="970415">VietinBank</option>
                  <option value="970405">Agribank</option>
                  <option value="970422">MB Bank</option>
                  <option value="970407">Techcombank</option>
                  <option value="970416">ACB</option>
                  <option value="970432">VPBank</option>
                  <option value="970423">TPBank</option>
                  <option value="970403">Sacombank</option>
                </Select>
                <div className="form-grid">
                  <Field
                    label="Số tài khoản"
                    name="bankAccount"
                    pattern="[0-9]{4,25}"
                    defaultValue={user.bankAccount || ""}
                  />
                  <Field
                    label="Tên chủ tài khoản"
                    name="bankName"
                    defaultValue={user.bankName || ""}
                  />
                </div>
                <p className="muted small-text">
                  Kiểm tra kỹ thông tin trước khi phát hành hóa đơn. Thông tin
                  này được lưu cùng hóa đơn tại thời điểm phát hành.
                </p>
              </>
            )}
            <button disabled={busy} className="btn primary">
              <Save size={17} />
              Lưu thay đổi
            </button>
          </form>
          <form
            className="panel padded"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                values = formValues(f);
              setBusy(true);
              const ok = await task(async () => {
                if (values.newPassword !== values.confirmPassword)
                  throw new Error("Hai mật khẩu mới chưa khớp.");
                await client.changePassword(
                  values.oldPassword,
                  values.newPassword,
                );
              }, "Đã đổi mật khẩu.");
              if (ok) f.reset();
              setBusy(false);
            }}
          >
            <h3>
              <LockKeyhole size={19} />
              Đổi mật khẩu
            </h3>
            <Field
              label="Mật khẩu hiện tại"
              name="oldPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            <div className="form-grid">
              <Field
                label="Mật khẩu mới"
                name="newPassword"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
              <Field
                label="Nhập lại mật khẩu mới"
                name="confirmPassword"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <button disabled={busy} className="btn secondary">
              Cập nhật mật khẩu
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
