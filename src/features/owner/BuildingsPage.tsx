import { useState } from "react";
import {
  Plus,
  Building2,
  MapPin,
  Pencil,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { useApp } from "../../app/provider";
import type { Building } from "../../domain/models";
import {
  PageTitle,
  Empty,
  Modal,
  Field,
  Select,
  Textarea,
  formValues,
} from "../../components/ui";
import { appConfig } from "../../config/app";
export default function BuildingsPage() {
  const { data, user, execute } = useApp();
  const [editing, setEditing] = useState<Building | null>();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const buildings = data.buildings.filter(
    (b) => user.role === "admin" || b.ownerId === user.id,
  );
  return (
    <>
      <PageTitle
        title="Tòa nhà của bạn"
        description="Mỗi tòa nhà, một không gian được chăm sóc chu đáo."
        action={
          <button className="btn primary" onClick={() => setEditing(null)}>
            <Plus size={18} />
            Thêm tòa nhà
          </button>
        }
      />
      <div className="building-grid">
        {buildings.map((b, i) => {
          const rooms = data.rooms.filter((r) => r.buildingId === b.id),
            occupied = rooms.filter((r) => r.status === "occupied").length;
          return (
            <article className="building-card" key={b.id}>
              <div className={`building-visual theme-${i % 3}`}>
                <Building2 size={80} strokeWidth={1} />
                <span>{b.city}</span>
              </div>
              <div className="building-content">
                <div className="card-heading">
                  <h3>{b.name}</h3>
                  <button
                    aria-label="Sửa tòa nhà"
                    className="icon-btn"
                    onClick={() => setEditing(b)}
                  >
                    <Pencil size={17} />
                  </button>
                </div>
                <p>
                  <MapPin size={14} />
                  {b.address}, {b.area}
                </p>
                <div className="building-numbers">
                  <span>
                    <b>{rooms.length}</b>Tổng phòng
                  </span>
                  <span>
                    <b>{occupied}</b>Đang thuê
                  </span>
                  <span>
                    <b>
                      {rooms.filter((r) => r.status === "available").length}
                    </b>
                    Còn trống
                  </span>
                </div>
                <div className="occupancy-bar">
                  <span
                    style={{
                      width: `${rooms.length ? (occupied / rooms.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="building-bottom">
                  <a href={`#/app/rooms?building=${b.id}`}>
                    Quản lý phòng <ArrowUpRight size={16} />
                  </a>
                  <button
                    className="icon-btn danger"
                    aria-label="Xóa tòa nhà"
                    onClick={() => {
                      if (
                        confirm(
                          `Xóa tòa nhà ${b.name}? Chỉ xóa được khi chưa có phòng.`,
                        )
                      )
                        execute(
                          { type: "building.delete", payload: { id: b.id } },
                          "Đã xóa tòa nhà.",
                        );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!buildings.length && (
        <Empty
          title="Tạo không gian đầu tiên của bạn"
          description="Thêm tòa nhà để bắt đầu tạo phòng và đăng tin cho thuê."
        />
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "Cập nhật tòa nhà" : "Thêm tòa nhà mới"}
          onClose={() => setEditing(undefined)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (
                await execute(
                  {
                    type: "building.save",
                    payload: {
                      ...formValues(e.currentTarget),
                      id: editing?.id,
                    },
                  },
                  "Đã lưu tòa nhà.",
                )
              )
                setEditing(undefined);
              setBusy(false);
            }}
          >
            <Field
              label="Tên tòa nhà"
              name="name"
              defaultValue={editing?.name}
              required
              placeholder="Ví dụ: Mây House"
            />
            {user.role === "admin" && !editing && (
              <Select label="Chủ trọ quản lý" name="ownerId" required>
                <option value="">Chọn chủ trọ</option>
                {data.users
                  .filter((u) => u.role === "owner" && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            )}
            <div className="form-grid">
              <Select
                label="Thành phố"
                name="city"
                defaultValue={editing?.city || appConfig.cities[0]}
                required
              >
                {[
                  ...new Set([
                    ...appConfig.cities,
                    ...buildings.map((b) => b.city),
                  ]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Field
                label="Khu vực"
                name="area"
                defaultValue={editing?.area}
                placeholder="Tên khu vực"
                required
              />
            </div>
            <Field
              label="Địa chỉ"
              name="address"
              defaultValue={editing?.address}
              required
            />
            <div className="form-grid">
              <Field
                label="Vĩ độ"
                name="lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                defaultValue={editing?.lat || 10.8035}
                required
              />
              <Field
                label="Kinh độ"
                name="lng"
                type="number"
                step="any"
                min={-180}
                max={180}
                defaultValue={editing?.lng || 106.7144}
                required
              />
            </div>
            <p className="muted small-text">
              Tọa độ được dùng để hiển thị bản đồ và tìm phòng gần người thuê.
            </p>
            <Textarea
              label="Giới thiệu tòa nhà"
              name="description"
              defaultValue={editing?.description}
            />
            <button disabled={busy} className="btn primary full">
              {busy ? "Đang lưu…" : "Lưu tòa nhà"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
