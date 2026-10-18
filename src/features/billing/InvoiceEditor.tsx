import { useState } from "react";
import { Save, Send } from "lucide-react";
import { useApp } from "../../app/provider";
import type { Invoice } from "../../domain/models";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { calculateInvoice } from "../../domain/billing";
import { money, periodNow } from "../../lib/format";
import { Modal, Field, Select } from "../../components/ui";
import MeterField from "./MeterField";
export default function InvoiceEditor({
  invoice,
  onClose,
}: {
  invoice?: Invoice;
  onClose: () => void;
}) {
  const { data, user, execute, toast } = useApp();
  const rooms = visibleRooms(data, user!).filter(
    (r) => r.status === "occupied",
  );
  const [roomId, setRoomId] = useState(invoice?.roomId || rooms[0]?.id || "");
  const room = rooms.find((r) => r.id === roomId);
  const [period, setPeriod] = useState(invoice?.period || periodNow());
  const [electricity, setElectricity] = useState(
    invoice ? String(invoice.newElectricity) : "",
  );
  const [water, setWater] = useState(invoice ? String(invoice.newWater) : "");
  const [ep, setEp] = useState(invoice?.electricityPhoto || "");
  const [wp, setWp] = useState(invoice?.waterPhoto || "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [electricityBusy, setElectricityBusy] = useState(false);
  const [waterBusy, setWaterBusy] = useState(false);
  let total: ReturnType<typeof calculateInvoice> | null = null;
  let error = "";
  if (room && electricity !== "" && water !== "")
    try {
      total = calculateInvoice({
        oldElectricity: room.electricity,
        newElectricity: Number(electricity),
        oldWater: room.water,
        newWater: Number(water),
        electricityRate: room.electricityRate,
        waterRate: room.waterRate,
        rent: room.rent,
        serviceFee: room.serviceFee,
      });
    } catch (e) {
      error = (e as Error).message;
    }
  return (
    <Modal
      title={invoice ? "Tiếp tục hóa đơn nháp" : "Chốt điện nước & tạo hóa đơn"}
      wide
      onClose={onClose}
    >
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const issue =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
            "issue";
          if (issue && !confirmed) {
            toast(
              "Đối chiếu ảnh và xác nhận chỉ số trước khi phát hành.",
              true,
            );
            return;
          }
          setBusy(true);
          const dueDate = String(new FormData(e.currentTarget).get("dueDate"));
          if (
            await execute(
              {
                type: "invoice.save",
                payload: {
                  id: invoice?.id,
                  roomId,
                  period,
                  newElectricity: Number(electricity),
                  newWater: Number(water),
                  electricityPhoto: ep,
                  waterPhoto: wp,
                  issue,
                  dueDate,
                },
              },
              issue
                ? "Đã phát hành hóa đơn và cập nhật chỉ số."
                : "Đã lưu nháp hóa đơn.",
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <div className="form-grid">
          <Select
            label="Phòng đang thuê"
            value={roomId}
            disabled={!!invoice}
            onChange={(e) => {
              setRoomId(e.target.value);
              setElectricity("");
              setWater("");
              setEp("");
              setWp("");
              setConfirmed(false);
            }}
            required
          >
            <option value="">Chọn phòng</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {buildingOf(data, r).name}
              </option>
            ))}
          </Select>
          <Field
            label="Kỳ hóa đơn"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />
        </div>
        {room ? (
          <>
            <div className="meter-grid">
              <MeterField
                kind="electricity"
                previous={room.electricity}
                value={electricity}
                photo={ep}
                onValue={(v) => {
                  setElectricity(v);
                  setConfirmed(false);
                }}
                onPhoto={(photo) => {
                  setEp(photo);
                  setConfirmed(false);
                }}
                onBusy={setElectricityBusy}
              />
              <MeterField
                kind="water"
                previous={room.water}
                value={water}
                photo={wp}
                onValue={(v) => {
                  setWater(v);
                  setConfirmed(false);
                }}
                onPhoto={(photo) => {
                  setWp(photo);
                  setConfirmed(false);
                }}
                onBusy={setWaterBusy}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="invoice-preview">
              <div>
                <span>Tiền phòng</span>
                <strong>{money(room.rent)}</strong>
              </div>
              <div>
                <span>
                  Điện{" "}
                  {total
                    ? `${total.electricityUsed} kWh × ${money(room.electricityRate)}`
                    : ""}
                </span>
                <strong>{total ? money(total.electricity) : "—"}</strong>
              </div>
              <div>
                <span>
                  Nước{" "}
                  {total
                    ? `${total.waterUsed} m³ × ${money(room.waterRate)}`
                    : ""}
                </span>
                <strong>{total ? money(total.water) : "—"}</strong>
              </div>
              <div>
                <span>Phí dịch vụ cố định</span>
                <strong>{money(room.serviceFee)}</strong>
              </div>
              <div className="invoice-total">
                <strong>Tổng cần thanh toán</strong>
                <b>{total ? money(total.total) : "—"}</b>
              </div>
            </div>
            <Field
              label="Hạn thanh toán"
              name="dueDate"
              type="date"
              defaultValue={
                invoice?.dueDate ||
                new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
              }
              required
            />
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã đối chiếu ảnh, chỉ số và các khoản phí trước khi phát hành.
            </label>
            <div className="form-actions">
              <button
                value="draft"
                disabled={busy || electricityBusy || waterBusy || !total}
                className="btn secondary"
              >
                <Save size={16} />
                Lưu nháp
              </button>
              <button
                value="issue"
                disabled={busy || electricityBusy || waterBusy || !total}
                className="btn primary"
              >
                <Send size={16} />
                Phát hành hóa đơn
              </button>
            </div>
          </>
        ) : (
          <p>
            Chưa có phòng đang thuê để lập hóa đơn. Thêm người thuê vào phòng
            trước.
          </p>
        )}
      </form>
    </Modal>
  );
}
