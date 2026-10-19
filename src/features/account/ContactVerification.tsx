import { useState } from "react";
import { useApp } from "../../app/provider";
import { accountApi } from "../../services/client";
import { Field, formValues } from "../../components/ui";

export default function ContactVerification() {
  const { user, task } = useApp();
  const [challenge, setChallenge] = useState<{ id: string; channel: string }>();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <section className="panel padded">
      <h3>Xác minh thông tin liên hệ</h3>
      <p>
        Email:{" "}
        {user.email
          ? user.emailVerified
            ? "Đã xác minh"
            : "Chưa xác minh"
          : "Chưa cung cấp"}
      </p>
      <p>
        Điện thoại:{" "}
        {user.phone
          ? user.phoneVerified
            ? "Đã xác minh"
            : "Chưa xác minh"
          : "Chưa cung cấp"}
      </p>
      {challenge ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            setBusy(true);
            if (
              await task(
                () => accountApi.confirmVerification(challenge.id, values.code),
                "Đã xác minh thông tin liên hệ.",
              )
            )
              setChallenge(undefined);
            setBusy(false);
          }}
        >
          <Field
            label={`Mã gửi đến ${challenge.channel}`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setChallenge(undefined)}
            >
              Hủy
            </button>
            <button className="btn primary" disabled={busy}>
              Xác nhận mã
            </button>
          </div>
        </form>
      ) : (
        <div className="form-actions">
          {(["email", "phone"] as const)
            .filter(
              (channel) =>
                user[channel] &&
                !(channel === "email"
                  ? user.emailVerified
                  : user.phoneVerified),
            )
            .map((channel) => (
              <button
                className="btn secondary"
                disabled={busy}
                key={channel}
                onClick={async () => {
                  setBusy(true);
                  await task(async () => {
                    const result =
                      await accountApi.requestVerification(channel);
                    setChallenge({
                      id: result.challengeId,
                      channel: channel === "email" ? user.email : user.phone,
                    });
                  }, "Đã gửi mã xác nhận.");
                  setBusy(false);
                }}
              >
                Xác minh {channel === "email" ? "email" : "điện thoại"}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
