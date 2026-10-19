import { useState } from "react";
import { Bell, CheckCheck, ArrowUpRight } from "lucide-react";
import { useApp } from "../../app/provider";
import { Modal, Empty } from "../../components/ui";
import { navigate } from "../../app/router";

export default function NotificationBell() {
  const { data, user, execute } = useApp();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const all = (data.notifications || [])
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = all.filter((n) => !n.readAt).length;
  const list = all.filter((n) => !unreadOnly || !n.readAt);
  return (
    <>
      <button
        type="button"
        className="icon-btn notification-bell"
        aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <Modal title="Thông báo của bạn" onClose={() => setOpen(false)}>
          <div className="notification-toolbar">
            <div className="tabs">
              <button
                className={!unreadOnly ? "active" : ""}
                onClick={() => {
                  setUnreadOnly(false);
                  setLimit(30);
                }}
              >
                Tất cả
              </button>
              <button
                className={unreadOnly ? "active" : ""}
                onClick={() => {
                  setUnreadOnly(true);
                  setLimit(30);
                }}
              >
                Chưa đọc ({unread})
              </button>
            </div>
            <button
              className="btn text small"
              disabled={!unread || busy}
              onClick={async () => {
                setBusy(true);
                await execute({
                  type: "notification.read",
                  payload: { all: true },
                });
                setBusy(false);
              }}
            >
              <CheckCheck size={16} /> Đọc tất cả
            </button>
          </div>
          <div className="notification-list">
            {!list.length && (
              <Empty
                title={
                  unreadOnly ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo"
                }
                description="Yêu cầu, tin nhắn, chỉ số đồng hồ và thay đổi liên quan đến bạn sẽ xuất hiện tại đây."
              />
            )}
            {list.slice(0, limit).map((n) => (
              <button
                key={n.id}
                disabled={busy}
                className={`notification-item ${!n.readAt ? "unread" : ""}`}
                onClick={async () => {
                  setBusy(true);
                  const ok =
                    n.readAt ||
                    (await execute({
                      type: "notification.read",
                      payload: { id: n.id },
                    }));
                  setBusy(false);
                  if (ok) {
                    setOpen(false);
                    navigate(
                      `${n.href}${n.href.includes("?") ? "&" : "?"}notice=${n.id}&open=${Date.now()}`,
                    );
                  }
                }}
              >
                <span className="notification-indicator" />
                <span>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <small>{new Date(n.createdAt).toLocaleString("vi-VN")}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
            {list.length > limit && (
              <button
                className="btn secondary full"
                onClick={() => setLimit((n) => n + 30)}
              >
                Xem thông báo trước đó
              </button>
            )}
          </div>
          <p className="notification-footnote">
            Tự cập nhật khi trang đang mở. Nhấn vào thông báo để xem nội dung
            liên quan.
          </p>
        </Modal>
      )}
    </>
  );
}
