import { useState } from "react";
import { Plus, Wrench, Flag, MessageSquare } from "lucide-react";
import { useApp } from "../../app/provider";
import { visibleRooms } from "../../domain/selectors";
import type { SupportTicket } from "../../domain/models";
import {
  PageTitle,
  Empty,
  Modal,
  Field,
  Textarea,
  Select,
  Status,
  formValues,
} from "../../components/ui";
import { dateText } from "../../lib/format";
export default function SupportPage() {
  const { data, user, execute } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SupportTicket>();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    tickets = data.tickets.filter(
      (t) =>
        user.role === "admin" ||
        (user.role === "tenant"
          ? t.authorId === user.id
          : t.category === "repair" && rooms.some((r) => r.id === t.roomId)),
    );
  return (
    <>
      <PageTitle
        title={
          user.role === "admin"
            ? "Báo cáo & hỗ trợ"
            : user.role === "owner"
              ? "Yêu cầu sửa chữa"
              : "Hỗ trợ không gian sống"
        }
        description="Theo dõi vấn đề từ lúc tiếp nhận đến khi giải quyết."
        action={
          user.role === "tenant" && (
            <button className="btn primary" onClick={() => setAdding(true)}>
              <Plus size={18} />
              Gửi yêu cầu
            </button>
          )
        }
      />
      <div className="ticket-grid">
        {tickets
          .slice()
          .reverse()
          .map((t) => (
            <article className="panel ticket-card" key={t.id}>
              <div className="card-heading">
                <span
                  className={`list-icon ${t.category === "report" ? "amber" : ""}`}
                >
                  {t.category === "repair" ? (
                    <Wrench size={21} />
                  ) : (
                    <Flag size={21} />
                  )}
                </span>
                <Status value={t.status} />
              </div>
              <h3>{t.title}</h3>
              <p>{t.content}</p>
              <small>
                {data.users.find((u) => u.id === t.authorId)?.name} ·{" "}
                {t.roomId && data.rooms.find((r) => r.id === t.roomId)?.name} ·{" "}
                {dateText(t.createdAt)}
              </small>
              {t.response && (
                <div className="ticket-response">
                  <MessageSquare size={16} />
                  <p>{t.response}</p>
                </div>
              )}
              {user.role !== "tenant" && (
                <button
                  className="btn secondary small"
                  onClick={() => setEditing(t)}
                >
                  Cập nhật xử lý
                </button>
              )}
            </article>
          ))}
      </div>
      {!tickets.length && (
        <Empty
          title="Mọi thứ đang ổn"
          description="Các yêu cầu sửa chữa hoặc báo cáo sẽ xuất hiện tại đây."
        />
      )}
      {adding && (
        <Modal title="Gửi yêu cầu hỗ trợ" onClose={() => setAdding(false)}>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (
                await execute(
                  {
                    type: "ticket.create",
                    payload: formValues(e.currentTarget),
                  },
                  "Đã gửi yêu cầu.",
                )
              )
                setAdding(false);
              setBusy(false);
            }}
          >
            <Select label="Loại yêu cầu" name="category">
              <option value="repair">Sửa chữa phòng đang thuê</option>
              <option value="report">Báo cáo vấn đề với nền tảng</option>
            </Select>
            <Select label="Phòng liên quan" name="roomId">
              <option value="">Không chọn phòng</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Field label="Tiêu đề" name="title" required />
            <Textarea label="Mô tả cụ thể vấn đề" name="content" required />
            <button className="btn primary full" disabled={busy}>
              Gửi yêu cầu
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Cập nhật yêu cầu" onClose={() => setEditing(undefined)}>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await execute(
                  {
                    type: "ticket.respond",
                    payload: { ...formValues(e.currentTarget), id: editing.id },
                  },
                  "Đã cập nhật yêu cầu.",
                )
              )
                setEditing(undefined);
            }}
          >
            <h3>{editing.title}</h3>
            <Select
              label="Trạng thái"
              name="status"
              defaultValue={editing.status}
            >
              <option value="open">Mới tiếp nhận</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã giải quyết</option>
            </Select>
            <Textarea
              label="Phản hồi và kết quả xử lý"
              name="response"
              defaultValue={editing.response}
            />
            <button className="btn primary full">Lưu phản hồi</button>
          </form>
        </Modal>
      )}
    </>
  );
}
