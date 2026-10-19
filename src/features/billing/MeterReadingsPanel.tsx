import { useEffect, useState } from "react";
import { Camera, Check, X, Zap, Droplets } from "lucide-react";
import { useApp } from "../../app/provider";
import { visibleRooms, buildingOf } from "../../domain/selectors";
import { money, periodNow } from "../../lib/format";
import {
  Modal,
  Field,
  Select,
  Empty,
  Badge,
  Textarea,
} from "../../components/ui";
import type { Room, MeterReading } from "../../domain/models";
import type { MeterOcrResult } from "../../services/ocr";
import MeterField from "./MeterField";

function CaptureMeter({
  room,
  period,
  onClose,
}: {
  room: Room;
  period: string;
  onClose: () => void;
}) {
  const { user, execute } = useApp();
  const kinds = (["electricity", "water"] as const).filter(
    (kind) =>
      (kind === "electricity"
        ? room.electricityBillingMode
        : room.waterBillingMode) !== "fixed",
  );
  const [kind, setKind] = useState<"electricity" | "water">(
    kinds[0] || "electricity",
  );
  const [value, setValue] = useState("");
  const [photo, setPhoto] = useState("");
  const [ocr, setOcr] = useState<MeterOcrResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <Modal title={`Gửi ảnh đồng hồ · ${room.name}`} onClose={onClose}>
      <form
        className="modal-body"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!confirmed || !photo || recognizing || saving) return;
          setSaving(true);
          const ok = await execute(
            {
              type: "meter.submit",
              payload: {
                roomId: room.id,
                kind,
                period,
                value: Number(value),
                photo,
                confirmed,
                ...(ocr?.value !== null && ocr?.value !== undefined
                  ? { ocrValue: ocr.value }
                  : {}),
                ...(ocr
                  ? { ocrConfidence: ocr.confidence, ocrText: ocr.text }
                  : {}),
              },
            },
            user?.role === "tenant"
              ? "Đã gửi ảnh. Chủ trọ sẽ kiểm tra và xác nhận."
              : "Đã chia sẻ ảnh và chỉ số với người thuê.",
          );
          setSaving(false);
          if (ok) onClose();
        }}
      >
        <div className="sharing-note">
          Ảnh và kết quả được chia sẻ với chủ trọ và người thuê của phòng.{" "}
          {user?.role === "tenant"
            ? "Chủ trọ xác nhận trước khi dùng để lập hóa đơn."
            : "Bạn đối chiếu và xác nhận chỉ số khi gửi."}
        </div>
        <div className="form-grid">
          <Select
            label="Loại đồng hồ"
            value={kind}
            disabled={recognizing || saving}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setValue("");
              setPhoto("");
              setOcr(null);
              setConfirmed(false);
            }}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k === "electricity" ? "Điện (kWh)" : "Nước (m³)"}
              </option>
            ))}
          </Select>
          <Field label="Kỳ ghi chỉ số" type="month" value={period} readOnly />
        </div>
        <MeterField
          key={kind}
          kind={kind}
          previous={room[kind]}
          value={value}
          photo={photo}
          onValue={(v) => {
            setValue(v);
            setConfirmed(false);
          }}
          onPhoto={(v) => {
            setPhoto(v);
            setConfirmed(false);
          }}
          onOcr={setOcr}
          onBusy={setRecognizing}
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={recognizing || saving}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Tôi đã đối chiếu ảnh gốc, dấu thập phân và chỉ số trước khi gửi.
        </label>
        <button
          className="btn primary full"
          disabled={
            !photo || value === "" || !confirmed || recognizing || saving
          }
        >
          <Check size={17} />
          {saving
            ? "Đang lưu…"
            : user?.role === "tenant"
              ? "Gửi chủ trọ xác nhận"
              : "Xác nhận & chia sẻ chỉ số"}
        </button>
      </form>
    </Modal>
  );
}

export default function MeterReadingsPanel({
  roomId: fixedRoomId,
}: {
  roomId?: string;
}) {
  const { data, user, execute } = useApp();
  const rooms = visibleRooms(data, user!).filter((r) =>
    data.tenancies.some(
      (t) =>
        t.active &&
        t.roomId === r.id &&
        (user?.role !== "tenant" || t.tenantId === user.id),
    ),
  );
  const urlParams = new URLSearchParams(location.hash.split("?")[1]);
  const roomFromUrl = urlParams.get("room") || "";
  const periodFromUrl = urlParams.get("period") || "";
  const openFromUrl = urlParams.get("open");
  const [selectedRoomId, setSelectedRoomId] = useState(roomFromUrl);
  const [period, setPeriod] = useState(
    /^\d{4}-(0[1-9]|1[0-2])$/.test(periodFromUrl) ? periodFromUrl : periodNow(),
  );
  useEffect(() => {
    if (roomFromUrl) setSelectedRoomId(roomFromUrl);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodFromUrl)) setPeriod(periodFromUrl);
  }, [roomFromUrl, periodFromUrl, openFromUrl]);
  const [capturing, setCapturing] = useState(false);
  const [rejecting, setRejecting] = useState<MeterReading>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const room =
    rooms.find((r) => r.id === (fixedRoomId || selectedRoomId)) ||
    (!fixedRoomId ? rooms[0] : undefined);
  const records = (data.meterReadings || [])
    .filter((r) => (!room || r.roomId === room.id) && r.period === period)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const locked =
    !!room &&
    data.invoices.some(
      (i) =>
        i.roomId === room.id && i.status === "issued" && i.period >= period,
    );
  const fixedOnly =
    room?.electricityBillingMode === "fixed" &&
    room?.waterBillingMode === "fixed";
  const statusNames = {
    pending: "Chờ chủ trọ xác nhận",
    accepted: "Đã xác nhận",
    rejected: "Cần gửi lại ảnh",
    superseded: "Đã có bản thay thế",
  };
  return (
    <section className="panel padded shared-meters" id="meter-readings">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MINH BẠCH ĐIỆN NƯỚC</span>
          <h3>Ảnh & chỉ số đồng hồ</h3>
          <p>Hai bên cùng xem ảnh gốc, kết quả đọc và trạng thái xác nhận.</p>
        </div>
        <button
          className="btn secondary"
          disabled={!room || locked || fixedOnly}
          onClick={() => setCapturing(true)}
        >
          <Camera size={17} />
          Gửi ảnh đồng hồ
        </button>
      </div>
      <div className="form-grid meter-filters">
        {!fixedRoomId && (
          <Select
            label="Phòng xem chỉ số"
            value={room?.id || ""}
            onChange={(e) => setSelectedRoomId(e.target.value)}
          >
            <option value="" disabled>
              Chọn phòng đang thuê
            </option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {buildingOf(data, r).name}
              </option>
            ))}
          </Select>
        )}
        <Field
          label="Kỳ xem ảnh đồng hồ"
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          required
        />
      </div>
      {room && (
        <div className="meter-policy-grid">
          {(["electricity", "water"] as const).map((kind) => {
            const fixed =
              (kind === "electricity"
                ? room.electricityBillingMode
                : room.waterBillingMode) === "fixed";
            const latest = records.find(
              (r) => r.kind === kind && r.status === "accepted",
            );
            return (
              <div key={kind}>
                {kind === "electricity" ? (
                  <Zap size={19} />
                ) : (
                  <Droplets size={19} />
                )}
                <span>
                  <strong>{kind === "electricity" ? "Điện" : "Nước"}</strong>
                  <small>
                    {fixed
                      ? `${money(kind === "electricity" ? room.electricityMonthlyFee || 0 : room.waterMonthlyFee || 0)}/tháng · cố định`
                      : latest
                        ? `Đã xác nhận: ${latest.value} ${kind === "electricity" ? "kWh" : "m³"}`
                        : `Chỉ số gốc: ${room[kind]} ${kind === "electricity" ? "kWh" : "m³"}`}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {locked && (
        <p className="muted small-text">
          Kỳ này hoặc kỳ sau đã có hóa đơn phát hành. Lịch sử ảnh vẫn được giữ;
          chọn kỳ chưa chốt để gửi ảnh mới.
        </p>
      )}
      {fixedOnly && (
        <p className="muted small-text">
          Điện và nước đang tính cố định theo tháng, không cần gửi chỉ số để
          tính tiền.
        </p>
      )}
      {!records.length ? (
        <Empty
          title="Chưa có ảnh đồng hồ trong kỳ này"
          description={
            room
              ? "Chủ trọ hoặc người thuê có thể chụp ảnh, đọc số và chia sẻ tại đây."
              : "Chưa có phòng đang thuê để ghi chỉ số."
          }
        />
      ) : (
        <div className="meter-records">
          {records.map((record) => (
            <article className="meter-record" key={record.id}>
              <a href={record.photo} target="_blank" rel="noreferrer">
                <img
                  src={record.photo}
                  alt={`Đồng hồ ${record.kind === "electricity" ? "điện" : "nước"}, chỉ số ${record.value}, kỳ ${record.period}`}
                  loading="lazy"
                />
              </a>
              <div>
                <div className="meter-record-heading">
                  <strong>
                    {record.kind === "electricity" ? "Điện" : "Nước"} ·{" "}
                    {record.previous} → {record.value}
                  </strong>
                  <Badge
                    tone={
                      record.status === "pending"
                        ? "orange"
                        : record.status === "accepted"
                          ? "green"
                          : "gray"
                    }
                  >
                    {statusNames[record.status]}
                  </Badge>
                </div>
                <p>
                  Sử dụng{" "}
                  <strong>
                    {Math.round((record.value - record.previous) * 1000) / 1000}{" "}
                    {record.kind === "electricity" ? "kWh" : "m³"}
                  </strong>{" "}
                  · Chỉ số mới − chỉ số cũ
                </p>
                <small>
                  Người gửi:{" "}
                  {data.users.find((u) => u.id === record.submittedBy)?.name ||
                    "Tài khoản đã lưu"}{" "}
                  · {new Date(record.createdAt).toLocaleString("vi-VN")}
                </small>
                {record.ocrValue !== undefined && (
                  <small>
                    Gợi ý OCR: {record.ocrValue} · tin cậy{" "}
                    {Math.round(record.ocrConfidence || 0)}%
                    {record.ocrValue !== record.value
                      ? ` · đã chỉnh thành ${record.value}`
                      : ""}
                  </small>
                )}
                {record.reviewedAt && (
                  <small>
                    Xác nhận/xử lý:{" "}
                    {data.users.find((u) => u.id === record.reviewedBy)?.name ||
                      "Chủ trọ"}{" "}
                    · {new Date(record.reviewedAt).toLocaleString("vi-VN")}
                  </small>
                )}
                {record.reason && (
                  <p className="error-text small-text">
                    Lý do: {record.reason}
                  </p>
                )}
                {user?.role !== "tenant" &&
                  record.status === "pending" &&
                  !locked && (
                    <div className="form-actions">
                      <button
                        disabled={busy}
                        className="btn secondary small"
                        onClick={() => {
                          setRejecting(record);
                          setReason("");
                        }}
                      >
                        <X size={15} />
                        Yêu cầu chụp lại
                      </button>
                      <button
                        disabled={busy}
                        className="btn primary small"
                        onClick={async () => {
                          setBusy(true);
                          await execute(
                            {
                              type: "meter.review",
                              payload: { id: record.id, accept: true },
                            },
                            "Đã xác nhận chỉ số và báo người thuê.",
                          );
                          setBusy(false);
                        }}
                      >
                        <Check size={15} />
                        Xác nhận chỉ số
                      </button>
                    </div>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      {capturing && room && (
        <CaptureMeter
          room={room}
          period={period}
          onClose={() => setCapturing(false)}
        />
      )}
      {rejecting && (
        <Modal
          title="Yêu cầu kiểm tra lại ảnh"
          onClose={() => setRejecting(undefined)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await execute(
                {
                  type: "meter.review",
                  payload: { id: rejecting.id, accept: false, reason },
                },
                "Đã gửi phản hồi đến người thuê.",
              );
              setBusy(false);
              if (ok) setRejecting(undefined);
            }}
          >
            <Textarea
              label="Lý do cần chụp lại"
              value={reason}
              maxLength={500}
              required
              onChange={(e) => setReason(e.target.value)}
            />
            <button className="btn primary" disabled={busy}>
              Gửi yêu cầu
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
