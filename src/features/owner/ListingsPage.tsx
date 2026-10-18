import { useState } from "react";
import { Plus, Pencil, Eye, EyeOff, Send } from "lucide-react";
import { useApp } from "../../app/provider";
import type { Listing } from "../../domain/models";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import {
  PageTitle,
  Empty,
  Modal,
  Field,
  Select,
  Textarea,
  Status,
  formValues,
} from "../../components/ui";
import { money } from "../../lib/format";
export default function ListingsPage({
  moderation = false,
}: {
  moderation?: boolean;
}) {
  const { data, user, execute } = useApp();
  const [editing, setEditing] = useState<Listing | null>();
  const [rejection, setRejection] = useState<Listing>();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState(moderation ? "pending" : "");
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    listings = data.listings.filter(
      (l) =>
        rooms.some((r) => r.id === l.roomId) &&
        (!filter || l.status === filter),
    );
  return (
    <>
      <PageTitle
        title={moderation ? "Kiểm duyệt tin đăng" : "Tin cho thuê"}
        description={
          moderation
            ? "Kiểm tra thông tin phòng, hình ảnh và chi phí trước khi công khai."
            : "Đưa căn phòng còn trống đến với người đang tìm nơi ở."
        }
        action={
          !moderation && (
            <button className="btn primary" onClick={() => setEditing(null)}>
              <Plus size={18} />
              Tạo tin đăng
            </button>
          )
        }
      />
      <div className="tabs">
        {[
          ["", "Tất cả"],
          ["pending", "Chờ duyệt"],
          ["published", "Đang hiển thị"],
          ["draft", "Bản nháp"],
          ["rejected", "Từ chối"],
          ["hidden", "Đã ẩn"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="listing-management">
        {listings.map((l) => {
          const room = data.rooms.find((r) => r.id === l.roomId)!;
          return (
            <article className="managed-listing" key={l.id}>
              <img src={room.images[0] || "/images/room-1.jpg"} alt={l.title} />
              <div>
                <Status value={l.status} />
                <h3>{l.title}</h3>
                <p>
                  {room.name} · {buildingOf(data, room).name} ·{" "}
                  {money(room.rent)}/tháng
                </p>
                <p className="line-clamp">{l.description}</p>
                {l.reason && <p className="error-text">Lý do: {l.reason}</p>}
                <div className="row-actions">
                  {moderation ? (
                    <>
                      <button
                        className="btn primary small"
                        disabled={l.status === "published"}
                        onClick={() =>
                          execute(
                            {
                              type: "listing.moderate",
                              payload: { id: l.id, approve: true },
                            },
                            "Tin đã được hiển thị.",
                          )
                        }
                      >
                        <Send size={15} />
                        Duyệt tin
                      </button>
                      <button
                        className="btn secondary small"
                        onClick={() => setRejection(l)}
                      >
                        Từ chối / gỡ tin
                      </button>
                      <a className="btn text small" href={`#/room/${l.id}`}>
                        <Eye size={15} />
                        Xem chi tiết
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn secondary small"
                        onClick={() => setEditing(l)}
                      >
                        <Pencil size={15} />
                        Chỉnh sửa
                      </button>
                      <button
                        className="btn text small"
                        onClick={() =>
                          execute(
                            { type: "listing.hide", payload: { id: l.id } },
                            "Đã ẩn tin.",
                          )
                        }
                      >
                        <EyeOff size={15} />
                        Ẩn tin
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!listings.length && (
        <Empty
          title="Chưa có tin trong danh sách này"
          description="Tin đăng được tạo từ phòng đang còn trống."
        />
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "Chỉnh sửa tin cho thuê" : "Tạo tin cho thuê"}
          onClose={() => setEditing(undefined)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = formValues(e.currentTarget);
              const submit =
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) === "submit";
              setBusy(true);
              if (
                await execute(
                  {
                    type: "listing.save",
                    payload: { ...values, id: editing?.id, submit },
                  },
                  submit ? "Đã gửi tin đến quản trị viên." : "Đã lưu bản nháp.",
                )
              )
                setEditing(undefined);
              setBusy(false);
            }}
          >
            <Select
              label="Phòng còn trống"
              name="roomId"
              defaultValue={editing?.roomId}
              required
            >
              <option value="">Chọn phòng</option>
              {rooms
                .filter((r) => r.status === "available")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {buildingOf(data, r).name}
                  </option>
                ))}
            </Select>
            <Field
              label="Tiêu đề"
              name="title"
              defaultValue={editing?.title}
              required
              maxLength={180}
            />
            <Textarea
              label="Mô tả phòng và điều kiện thuê"
              name="description"
              defaultValue={editing?.description}
              required
              rows={7}
            />
            <p className="muted small-text">
              Hình ảnh, tiện ích và giá được lấy từ thông tin phòng. Tin đã sửa
              cần được duyệt lại.
            </p>
            <div className="form-actions">
              <button disabled={busy} value="draft" className="btn secondary">
                Lưu nháp
              </button>
              <button disabled={busy} value="submit" className="btn primary">
                <Send size={16} />
                Gửi duyệt
              </button>
            </div>
          </form>
        </Modal>
      )}
      {rejection && (
        <Modal
          title="Phản hồi tin đăng"
          onClose={() => setRejection(undefined)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await execute(
                  {
                    type: "listing.moderate",
                    payload: {
                      id: rejection.id,
                      approve: false,
                      ...formValues(e.currentTarget),
                    },
                  },
                  "Đã gửi phản hồi.",
                )
              )
                setRejection(undefined);
            }}
          >
            <Textarea
              label="Lý do cần từ chối hoặc gỡ tin"
              name="reason"
              required
            />
            <button className="btn primary full">Gửi phản hồi</button>
          </form>
        </Modal>
      )}
    </>
  );
}
