import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApp } from "../../app/provider";
import type { Room } from "../../domain/models";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { money, normalize } from "../../lib/format";
import { appConfig } from "../../config/app";
import {
  PageTitle,
  Empty,
  Modal,
  Field,
  Select,
  SearchBox,
  Status,
  ImageUpload,
  formValues,
} from "../../components/ui";
export default function RoomsPage({ route }: { route: string }) {
  const { data, user, execute } = useApp();
  const [query, setQuery] = useState("");
  const [electricityMode, setElectricityMode] = useState("metered");
  const [waterMode, setWaterMode] = useState("metered");
  const [building, setBuilding] = useState(
    new URLSearchParams(route.split("?")[1]).get("building") || "",
  );
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Room | null>();
  const [images, setImages] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const buildings = data.buildings.filter(
      (b) => user.role === "admin" || b.ownerId === user.id,
    ),
    rooms = visibleRooms(data, user).filter(
      (r) =>
        (!building || r.buildingId === building) &&
        (!status || status === r.status) &&
        normalize(`${r.name} ${buildingOf(data, r).name}`).includes(
          normalize(query),
        ),
    );
  const edit = (room: Room | null) => {
    setElectricityMode(room?.electricityBillingMode || "metered");
    setWaterMode(room?.waterBillingMode || "metered");
    setEditing(room);
    setImages(room?.images || []);
    setAmenities(room?.amenities || []);
  };
  return (
    <>
      <PageTitle
        title="Quản lý phòng trọ"
        description="Thông tin, giá thuê và tình trạng của từng căn phòng."
        action={
          <button
            className="btn primary"
            onClick={() => edit(null)}
            disabled={!buildings.length}
          >
            <Plus size={18} />
            Thêm phòng
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Tìm tên phòng, tòa nhà…"
        />
        <select
          aria-label="Lọc tòa nhà"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
        >
          <option value="">Tất cả tòa nhà</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc tình trạng phòng"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Mọi tình trạng</option>
          <option value="available">Còn trống</option>
          <option value="occupied">Đang thuê</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Phòng / tòa nhà</th>
                <th>Diện tích</th>
                <th>Giá thuê / tháng</th>
                <th>Chỉ số hiện tại</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="table-room">
                      <img src={r.images[0] || "/images/room-1.jpg"} alt="" />
                      <div>
                        <strong>{r.name}</strong>
                        <small>{buildingOf(data, r).name}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {r.area} m²<small>Tối đa {r.capacity} người</small>
                  </td>
                  <td>
                    <strong>{money(r.rent)}</strong>
                    <small>Dịch vụ {money(r.serviceFee)}</small>
                  </td>
                  <td>
                    {r.electricityBillingMode === "fixed"
                      ? `Điện ${money(r.electricityMonthlyFee || 0)}/tháng`
                      : `${r.electricity} kWh`}
                    <small>
                      {r.waterBillingMode === "fixed"
                        ? `Nước ${money(r.waterMonthlyFee || 0)}/tháng`
                        : `${r.water} m³ nước`}
                    </small>
                  </td>
                  <td>
                    <Status value={r.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={`Sửa ${r.name}`}
                        onClick={() => edit(r)}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`Xóa ${r.name}`}
                        onClick={() => {
                          if (confirm(`Xóa phòng ${r.name}?`))
                            execute(
                              { type: "room.delete", payload: { id: r.id } },
                              "Đã xóa phòng.",
                            );
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rooms.length && (
          <Empty
            title={
              buildings.length
                ? "Chưa có phòng phù hợp"
                : "Bạn cần thêm tòa nhà trước"
            }
            action={
              !buildings.length ? (
                <a href="#/app/buildings" className="btn primary">
                  Thêm tòa nhà
                </a>
              ) : undefined
            }
          />
        )}
      </section>
      {editing !== undefined && (
        <Modal
          title={editing ? `Cập nhật ${editing.name}` : "Thêm phòng mới"}
          wide
          onClose={() => setEditing(undefined)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const values = formValues(e.currentTarget);
              if (
                await execute(
                  {
                    type: "room.save",
                    payload: {
                      ...values,
                      id: editing?.id,
                      buildingId: editing?.buildingId || values.buildingId,
                      amenities,
                      images,
                    },
                  },
                  "Đã lưu thông tin phòng.",
                )
              )
                setEditing(undefined);
              setBusy(false);
            }}
          >
            <div className="form-grid">
              <Select
                label="Tòa nhà"
                name="buildingId"
                defaultValue={
                  editing?.buildingId || building || buildings[0]?.id
                }
                disabled={!!editing}
                required
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Field
                label="Mã hoặc tên phòng"
                name="name"
                defaultValue={editing?.name}
                required
              />
            </div>
            <div className="form-grid three">
              <Field
                label="Diện tích m²"
                name="area"
                type="number"
                min={1}
                defaultValue={editing?.area || 25}
                required
              />
              <Field
                label="Số người tối đa"
                name="capacity"
                type="number"
                min={1}
                step={1}
                defaultValue={editing?.capacity || 2}
                required
              />
              <Select
                label="Tình trạng"
                name="status"
                defaultValue={editing?.status || "available"}
                disabled={editing?.status === "occupied"}
              >
                <option value="available">Còn trống</option>
                <option value="maintenance">Bảo trì</option>
                {editing?.status === "occupied" && (
                  <option value="occupied">Đang thuê</option>
                )}
              </Select>
            </div>
            <div className="form-grid">
              <Field
                label="Giá thuê VND / tháng"
                name="rent"
                type="number"
                min={0}
                step={1000}
                defaultValue={editing?.rent || 3000000}
                required
              />
              <Field
                label="Tiền cọc VND"
                name="deposit"
                type="number"
                min={0}
                step={1000}
                defaultValue={editing?.deposit || 3000000}
                required
              />
            </div>
            <h3>Cách tính điện và nước</h3>
            <div className="form-grid">
              <Select
                label="Cách tính tiền điện"
                name="electricityBillingMode"
                value={electricityMode}
                onChange={(e) => setElectricityMode(e.target.value)}
              >
                <option value="metered">Theo chỉ số đồng hồ (kWh)</option>
                <option value="fixed">Cố định mỗi tháng</option>
              </Select>
              <Select
                label="Cách tính tiền nước"
                name="waterBillingMode"
                value={waterMode}
                onChange={(e) => setWaterMode(e.target.value)}
              >
                <option value="metered">Theo chỉ số đồng hồ (m³)</option>
                <option value="fixed">Cố định mỗi tháng</option>
              </Select>
            </div>
            <div className="form-grid three">
              <Field
                key={`electricity-${electricityMode}`}
                label={
                  electricityMode === "fixed"
                    ? "Tiền điện cố định VND / tháng"
                    : "Giá điện VND / kWh"
                }
                name={
                  electricityMode === "fixed"
                    ? "electricityMonthlyFee"
                    : "electricityRate"
                }
                type="number"
                min={0}
                defaultValue={
                  electricityMode === "fixed"
                    ? (editing?.electricityMonthlyFee ?? 0)
                    : (editing?.electricityRate ??
                      data.settings.electricityRate)
                }
                required
              />
              {electricityMode === "fixed" && (
                <input
                  type="hidden"
                  name="electricityRate"
                  value={
                    editing?.electricityRate ?? data.settings.electricityRate
                  }
                />
              )}
              <Field
                key={`water-${waterMode}`}
                label={
                  waterMode === "fixed"
                    ? "Tiền nước cố định VND / tháng"
                    : "Giá nước VND / m³"
                }
                name={waterMode === "fixed" ? "waterMonthlyFee" : "waterRate"}
                type="number"
                min={0}
                defaultValue={
                  waterMode === "fixed"
                    ? (editing?.waterMonthlyFee ?? 0)
                    : (editing?.waterRate ?? data.settings.waterRate)
                }
                required
              />
              {waterMode === "fixed" && (
                <input
                  type="hidden"
                  name="waterRate"
                  value={editing?.waterRate ?? data.settings.waterRate}
                />
              )}
              <Field
                label="Phí dịch vụ VND"
                name="serviceFee"
                type="number"
                min={0}
                defaultValue={editing?.serviceFee ?? data.settings.serviceFee}
                required
              />
            </div>
            <p className="muted small-text">
              Theo đồng hồ: (chỉ số mới − chỉ số cũ) × đơn giá. Cố định: thu
              đúng mức đã đặt mỗi tháng. Thay đổi chỉ áp dụng cho hóa đơn lập
              sau đó.
            </p>
            {!editing && (
              <div className="form-grid">
                <Field
                  label="Chỉ số điện ban đầu"
                  name="electricity"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={0}
                  required
                />
                <Field
                  label="Chỉ số nước ban đầu"
                  name="water"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={0}
                  required
                />
              </div>
            )}
            <h3>Tiện ích phòng</h3>
            <div className="checkbox-grid">
              {appConfig.amenities.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={amenities.includes(a)}
                    onChange={() =>
                      setAmenities((v) =>
                        v.includes(a) ? v.filter((x) => x !== a) : [...v, a],
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
            <h3>Hình ảnh</h3>
            <ImageUpload images={images} onChange={setImages} />
            <button disabled={busy} className="btn primary full">
              {busy ? "Đang lưu…" : "Lưu phòng"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
