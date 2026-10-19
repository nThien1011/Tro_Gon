import { useState } from "react";
import { accountApi } from "../../services/client";
import { useApp } from "../../app/provider";
import { Field, formValues } from "../../components/ui";
import { navigate } from "../../app/router";

export default function ResetPasswordPage() {
  const { task } = useApp();
  const [challengeId, setChallengeId] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="container prose-page" style={{ maxWidth: 500 }}>
      <a href="#/login" className="back-link">
        ← Trở về đăng nhập
      </a>
      <h1>Đặt lại mật khẩu</h1>
      <p>Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác nhận.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const values = formValues(event.currentTarget);
          setBusy(true);
          await task(
            async () => {
              if (!challengeId)
                setChallengeId(
                  (await accountApi.requestReset(contact)).challengeId,
                );
              else {
                if (values.password !== values.confirmPassword)
                  throw new Error("Hai mật khẩu chưa khớp.");
                await accountApi.confirmReset(
                  challengeId,
                  values.code,
                  values.password,
                );
                navigate("/login");
              }
            },
            challengeId
              ? "Mật khẩu đã được đặt lại. Đăng nhập bằng mật khẩu mới."
              : "Nếu tài khoản tồn tại, mã xác nhận sẽ được gửi.",
          );
          setBusy(false);
        }}
      >
        <Field
          label="Email hoặc số điện thoại"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          disabled={!!challengeId}
          required
        />
        {challengeId && (
          <>
            <Field
              label="Mã xác nhận"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            <Field
              label="Mật khẩu mới"
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
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
            <p className="muted small-text">
              Mã có hiệu lực 10 phút. Đổi mật khẩu sẽ đăng xuất các phiên đang
              mở.
            </p>
          </>
        )}
        <div className="form-actions">
          {challengeId && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setChallengeId("")}
            >
              Yêu cầu mã khác
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Đang xử lý…"
              : challengeId
                ? "Lưu mật khẩu mới"
                : "Gửi mã xác nhận"}
          </button>
        </div>
      </form>
    </main>
  );
}
