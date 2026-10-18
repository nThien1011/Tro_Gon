import { useState } from "react";
import { Plus, LogOut } from "lucide-react";
import { useApp } from "../../app/provider";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import {
  PageTitle,
  Empty,
  Modal,
  Field,
  Select,
  Textarea,
  formValues,
  Status,
} from "../../components/ui";
import { dateText, initials } from "../../lib/format";
export default function TenantsPage() {
  const { data, user, execute } = useApp();
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    tenancies = data.tenancies.filter(
      (t) => rooms.some((r) => r.id === t.roomId) && (history || t.active),
    );
  return (
    <>
      <PageTitle
        title="Người thuê & hồ sơ ở"
        description="Gắn đúng tài khoản với phòng, giữ rõ ràng lịch sử thuê."
        action={
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Thêm người vào phòng
          </button>
        }
      />
      <div className="tabs">
        <button
          className={!history ? "active" : ""}
          onClick={() => setHistory(false)}
        >
          Đang ở
        </button>
        <button
          className={history ? "active" : ""}
          onClick={() => setHistory(true)}
        >
          Toàn bộ lịch sử
        </button>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Người đại diện</th>
                <th>Phòng</th>
                <th>Thời hạn thuê</th>
                <th>Số người</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tenancies.map((t) => {
                const u = data.users.find((u) => u.id === t.tenantId)!,
                  r = data.rooms.find((r) => r.id === t.roomId)!;
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar">{initials(u.name)}</span>
                        <div>
                          <strong>{u.name}</strong>
                          <small>{u.phone || u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{buildingOf(data, r).name}</small>
                    </td>
                    <td>
                      {dateText(t.startDate)}
                      <small>đến {dateText(t.endDate)}</small>
                    </td>
                    <td>{t.people} người</td>
                    <td>
                      <Status value={t.active ? "active" : "completed"} />
                    </td>
                    <td>
                      {t.active && (
                        <button
                          className="btn text danger small"
                          onClick={() => {
                            if (
                              confirm(
                                `Xác nhận bàn giao và kết thúc thuê của ${u.name}? Hệ thống sẽ kiểm tra hóa đơn còn nợ.`,
                              )
                            )
                              execute(
                                {
                                  type: "tenancy.end",
                                  payload: {
                                    id: t.id,
                                    date: new Date().toISOString().slice(0, 10),
                                  },
                                },
                                "Đã kết thúc thuê và mở lại phòng.",
                              );
                          }}
                        >
                          <LogOut size={15} />
                          Kết thúc thuê
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!tenancies.length && (
          <Empty title="Chưa có người thuê trong danh sách" />
        )}
      </section>
      {adding && (
        <Modal
          title="Thêm người thuê vào phòng"
          onClose={() => setAdding(false)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (
                await execute(
                  {
                    type: "tenancy.assign",
                    payload: formValues(e.currentTarget),
                  },
                  "Đã thêm người thuê và cập nhật tình trạng phòng.",
                )
              )
                setAdding(false);
              setBusy(false);
            }}
          >
            <Field
              label="Email hoặc số điện thoại đã đăng ký"
              name="contact"
              required
              placeholder="nguoithue@trogon.demo"
              hint="Người thuê cần có tài khoản trước khi được thêm vào phòng."
            />
            <Select label="Phòng còn trống" name="roomId" required>
              <option value="">Chọn phòng</option>
              {rooms
                .filter((r) => r.status === "available")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {buildingOf(data, r).name}
                  </option>
                ))}
            </Select>
            <div className="form-grid">
              <Field
                label="Ngày bắt đầu"
                name="startDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
              <Field
                label="Ngày kết thúc dự kiến"
                name="endDate"
                type="date"
                required
              />
            </div>
            <Field
              label="Số người ở"
              name="people"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
            <Textarea label="Ghi chú bàn giao và điều kiện thuê" name="note" />
            <button disabled={busy} className="btn primary full">
              {busy ? "Đang lưu…" : "Xác nhận thêm người thuê"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
