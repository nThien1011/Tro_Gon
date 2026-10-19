import { useState } from "react";
import { Save, Send, Camera } from "lucide-react";
import { useApp } from "../../app/provider";
import type { Invoice } from "../../domain/models";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { calculateInvoice } from "../../domain/billing";
import { money, periodNow } from "../../lib/format";
import { Modal, Field, Select } from "../../components/ui";

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
  const [period, setPeriod] = useState(invoice?.period || periodNow());
  const room = rooms.find((r) => r.id === roomId);
  const readings = (
    kind: "electricity" | "water",
    targetRoom = roomId,
    targetPeriod = period,
  ) =>
    (data.meterReadings || [])
      .filter(
        (r) =>
          r.roomId === targetRoom &&
          r.period === targetPeriod &&
          r.kind === kind &&
          r.status === "accepted" &&
          data.tenancies.some((t) => t.active && t.id === r.tenancyId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [electricityId, setElectricityId] = useState(
    invoice?.electricityReadingId ||
      (!invoice ? readings("electricity")[0]?.id : "") ||
      "",
  );
  const [waterId, setWaterId] = useState(
    invoice?.waterReadingId || (!invoice ? readings("water")[0]?.id : "") || "",
  );
  const [electricity, setElectricity] = useState(
    invoice
      ? String(invoice.newElectricity)
      : readings("electricity")[0]
        ? String(readings("electricity")[0].value)
        : "",
  );
  const [water, setWater] = useState(
    invoice
      ? String(invoice.newWater)
      : readings("water")[0]
        ? String(readings("water")[0].value)
        : "",
  );
  const [ep, setEp] = useState(
    invoice?.electricityPhoto || readings("electricity")[0]?.photo || "",
  );
  const [wp, setWp] = useState(
    invoice?.waterPhoto || readings("water")[0]?.photo || "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const electricityFixed = room?.electricityBillingMode === "fixed",
    waterFixed = room?.waterBillingMode === "fixed";
  const reset = (nextRoom: string, nextPeriod: string) => {
    const er = readings("electricity", nextRoom, nextPeriod)[0],
      wr = readings("water", nextRoom, nextPeriod)[0];
    setElectricityId(er?.id || "");
    setWaterId(wr?.id || "");
    setElectricity(er ? String(er.value) : "");
    setWater(wr ? String(wr.value) : "");
    setEp(er?.photo || "");
    setWp(wr?.photo || "");
    setConfirmed(false);
  };
  let total: ReturnType<typeof calculateInvoice> | null = null,
    error = "";
  if (
    room &&
    (electricityFixed || electricity !== "") &&
    (waterFixed || water !== "")
  )
    try {
      if (
        (!electricityFixed &&
          electricityId &&
          !readings("electricity").some((r) => r.id === electricityId)) ||
        (!waterFixed &&
          waterId &&
          !readings("water").some((r) => r.id === waterId))
      )
        throw new Error(
          "Chỉ số đã được thay thế. Vui lòng chọn lại bản đã xác nhận.",
        );
      total = calculateInvoice({
        ...room,
        oldElectricity: room.electricity,
        newElectricity: electricityFixed
          ? room.electricity
          : Number(electricity),
        oldWater: room.water,
        newWater: waterFixed ? room.water : Number(water),
      });
    } catch (e) {
      error = (e as Error).message;
    }
  const meterEditor = (kind: "electricity" | "water") => {
    const isElectricity = kind === "electricity",
      fixed = isElectricity ? electricityFixed : waterFixed;
    const label = isElectricity ? "Điện" : "Nước",
      unit = isElectricity ? "kWh" : "m³";
    const selectedId = isElectricity ? electricityId : waterId,
      setId = isElectricity ? setElectricityId : setWaterId;
    const value = isElectricity ? electricity : water,
      setValue = isElectricity ? setElectricity : setWater;
    const photo = isElectricity ? ep : wp,
      setPhoto = isElectricity ? setEp : setWp;
    return (
      <section className="meter-field" key={kind}>
        <h3>{label}</h3>
        {fixed ? (
          <div className="fixed-utility">
            <strong>
              {money(
                isElectricity
                  ? room!.electricityMonthlyFee || 0
                  : room!.waterMonthlyFee || 0,
              )}{" "}
              / tháng
            </strong>
            <p>Thu cố định mỗi tháng. Không cần chỉ số hoặc ảnh đồng hồ.</p>
          </div>
        ) : (
          <>
            <Select
              label={`Nguồn chỉ số ${label.toLowerCase()}`}
              value={selectedId}
              onChange={(e) => {
                const reading = readings(kind).find(
                  (r) => r.id === e.target.value,
                );
                setId(reading?.id || "");
                setValue(reading ? String(reading.value) : "");
                setPhoto(reading?.photo || "");
                setConfirmed(false);
              }}
            >
              <option value="">Nhập thủ công sau khi đối chiếu</option>
              {readings(kind).map((r) => (
                <option value={r.id} key={r.id}>
                  Đã xác nhận: {r.value} {unit} ·{" "}
                  {data.users.find((u) => u.id === r.submittedBy)?.name}
                </option>
              ))}
            </Select>
            <p className="muted small-text">
              Chỉ số cũ: {room![kind]} {unit}
            </p>
            <Field
              label={`Chỉ số ${label.toLowerCase()} mới ${unit}`}
              type="number"
              min={room![kind]}
              step="0.001"
              value={value}
              readOnly={!!selectedId}
              required
              onChange={(e) => {
                setValue(e.target.value);
                setConfirmed(false);
              }}
            />
            {photo && (
              <a href={photo} target="_blank" rel="noreferrer">
                <img
                  className="approved-meter-photo"
                  src={photo}
                  alt={`Ảnh ${label.toLowerCase()} đã xác nhận`}
                />
              </a>
            )}
            <small>
              Chọn ảnh và chỉ số đã được xác nhận ở mục “Ảnh & chỉ số đồng hồ”.
              OCR chỉ gợi ý số, không tự phát hành hóa đơn.
            </small>
          </>
        )}
      </section>
    );
  };
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
          if (!room || !total || busy) return;
          if (issue && !confirmed) {
            toast(
              "Đối chiếu ảnh, chỉ số và chi phí trước khi phát hành.",
              true,
            );
            return;
          }
          const dueDate = String(new FormData(e.currentTarget).get("dueDate"));
          setBusy(true);
          const ok = await execute(
            {
              type: "invoice.save",
              payload: {
                id: invoice?.id,
                roomId,
                period,
                newElectricity: electricityFixed
                  ? room.electricity
                  : Number(electricity),
                newWater: waterFixed ? room.water : Number(water),
                electricityReadingId: electricityFixed
                  ? undefined
                  : electricityId || undefined,
                waterReadingId: waterFixed ? undefined : waterId || undefined,
                electricityPhoto: ep,
                waterPhoto: wp,
                issue,
                dueDate,
              },
            },
            issue
              ? "Đã phát hành hóa đơn và gửi thông báo đến người thuê."
              : "Đã lưu nháp hóa đơn.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <div className="form-grid">
          <Select
            label="Phòng đang thuê"
            value={roomId}
            disabled={!!invoice}
            required
            onChange={(e) => {
              setRoomId(e.target.value);
              reset(e.target.value, period);
            }}
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
            required
            onChange={(e) => {
              setPeriod(e.target.value);
              reset(roomId, e.target.value);
            }}
          />
        </div>
        {room ? (
          <>
            <div className="sharing-note">
              Ảnh gửi từ người thuê và chủ trọ được lưu chung theo kỳ.{" "}
              <button
                type="button"
                className="btn text small"
                onClick={() => {
                  onClose();
                  document
                    .getElementById("meter-readings")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                <Camera size={16} />
                Mở mục gửi ảnh đồng hồ
              </button>
            </div>
            <div className="meter-grid">
              {meterEditor("electricity")}
              {meterEditor("water")}
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
                  {electricityFixed
                    ? "· cố định/tháng"
                    : total
                      ? `· ${total.electricityUsed} kWh × ${money(room.electricityRate)}`
                      : ""}
                </span>
                <strong>{total ? money(total.electricity) : "—"}</strong>
              </div>
              <div>
                <span>
                  Nước{" "}
                  {waterFixed
                    ? "· cố định/tháng"
                    : total
                      ? `· ${total.waterUsed} m³ × ${money(room.waterRate)}`
                      : ""}
                </span>
                <strong>{total ? money(total.water) : "—"}</strong>
              </div>
              <div>
                <span>Phí dịch vụ</span>
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
                disabled={busy || !total}
                className="btn secondary"
              >
                <Save size={16} />
                Lưu nháp
              </button>
              <button
                value="issue"
                disabled={busy || !total}
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
