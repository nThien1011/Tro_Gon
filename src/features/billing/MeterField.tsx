import { useState } from "react";
import { ScanLine, Zap, Droplets, RefreshCw } from "lucide-react";
import { ImageUpload, Field } from "../../components/ui";
import { readMeter } from "../../services/ocr";
export default function MeterField({
  kind,
  previous,
  value,
  photo,
  onValue,
  onPhoto,
  onBusy,
}: {
  kind: "electricity" | "water";
  previous: number;
  value: string;
  photo: string;
  onValue: (v: string) => void;
  onPhoto: (v: string) => void;
  onBusy: (v: boolean) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const recognize = async (image: string) => {
    onBusy(true);
    setProgress(0);
    setError("");
    setResult("Đang tải bộ nhận dạng. Lần đầu có thể cần thêm thời gian.");
    try {
      const r = await readMeter(image, previous, setProgress);
      if (r.value !== null) {
        onValue(String(r.value));
        setResult(
          `Gợi ý OCR: ${r.value} · độ tin cậy ${Math.round(r.confidence)}%. Đối chiếu lại ảnh trước khi chốt.`,
        );
      } else {
        setResult(
          "Chưa tìm thấy chỉ số phù hợp. Cắt ảnh sát phần hiển thị hoặc nhập chỉ số đã kiểm tra.",
        );
      }
    } catch {
      setError(
        "Chưa đọc được ảnh. Kiểm tra kết nối để tải mô hình OCR hoặc nhập chỉ số sau khi xem ảnh.",
      );
    } finally {
      setProgress(null);
      onBusy(false);
    }
  };
  return (
    <section className="meter-field">
      <div className="meter-field-title">
        <span className={`list-icon ${kind === "water" ? "blue" : "amber"}`}>
          {kind === "water" ? <Droplets size={20} /> : <Zap size={20} />}
        </span>
        <div>
          <strong>{kind === "water" ? "Đồng hồ nước" : "Đồng hồ điện"}</strong>
          <small>
            Chỉ số cũ: {previous} {kind === "water" ? "m³" : "kWh"}
          </small>
        </div>
      </div>
      <ImageUpload
        single
        images={photo ? [photo] : []}
        onChange={(images) => {
          onPhoto(images[0] || "");
          if (images[0]) recognize(images[0]);
          else {
            setResult("");
            setError("");
          }
        }}
      />
      {photo && (
        <button
          type="button"
          className="btn text small"
          disabled={progress !== null}
          onClick={() => recognize(photo)}
        >
          <ScanLine size={16} />
          {progress !== null
            ? `Đang phân tích ${progress}%…`
            : "Đọc lại ảnh bằng OCR"}
        </button>
      )}
      {progress !== null && (
        <div className="ocr-progress">
          <span style={{ width: `${Math.max(progress, 5)}%` }} />
        </div>
      )}
      {result && <p className="ocr-result">{result}</p>}
      {error && <p className="error-text small-text">{error}</p>}
      <Field
        label={`Chỉ số mới ${kind === "water" ? "m³" : "kWh"}`}
        type="number"
        step="any"
        min={previous}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        required
      />
    </section>
  );
}
