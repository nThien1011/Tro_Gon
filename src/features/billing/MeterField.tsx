import { useEffect, useRef, useState } from "react";
import { ScanLine, Zap, Droplets, Crop } from "lucide-react";
import { ImageUpload, Field } from "../../components/ui";
import {
  readMeter,
  fullMeterCrop,
  type MeterOcrResult,
} from "../../services/ocr";

export default function MeterField({
  kind,
  previous,
  value,
  photo,
  onValue,
  onPhoto,
  onBusy,
  onOcr,
}: {
  kind: "electricity" | "water";
  previous: number;
  value: string;
  photo: string;
  onValue: (v: string) => void;
  onPhoto: (v: string) => void;
  onBusy: (v: boolean) => void;
  onOcr?: (v: MeterOcrResult | null) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<MeterOcrResult | null>(null);
  const [error, setError] = useState("");
  const [crop, setCrop] = useState({ ...fullMeterCrop });
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  const recognize = async (image: string, region = crop) => {
    const requestId = ++sequence.current;
    onBusy(true);
    setProgress(0);
    setError("");
    setResult(null);
    onOcr?.(null);
    try {
      const r = await readMeter(
        image,
        previous,
        (n) => {
          if (requestId === sequence.current) setProgress(n);
        },
        region,
      );
      if (requestId !== sequence.current) return;
      setResult(r);
      onOcr?.(r);
      if (r.value !== null) onValue(String(r.value));
    } catch {
      if (requestId === sequence.current)
        setError(
          "Chưa đọc được ảnh. Bạn có thể thu hẹp vùng chỉ số, thử ảnh rõ hơn hoặc nhập số sau khi đối chiếu. Lần đầu OCR cần mạng để tải bộ nhận dạng.",
        );
    } finally {
      if (requestId === sequence.current) {
        setProgress(null);
        onBusy(false);
      }
    }
  };
  const unit = kind === "water" ? "m³" : "kWh";
  return (
    <section className="meter-field">
      <div className="meter-field-title">
        <span className={`list-icon ${kind === "water" ? "blue" : "amber"}`}>
          {kind === "water" ? <Droplets size={20} /> : <Zap size={20} />}
        </span>
        <div>
          <strong>Đồng hồ {kind === "water" ? "nước" : "điện"}</strong>
          <small>
            Chỉ số cũ: {previous} {unit}
          </small>
        </div>
      </div>
      <ImageUpload
        single
        disabled={progress !== null}
        images={photo ? [photo] : []}
        onChange={(images) => {
          const next = images[0] || "";
          onPhoto(next);
          onValue("");
          onOcr?.(null);
          setCrop({ ...fullMeterCrop });
          setResult(null);
          setError("");
          if (next) void recognize(next, fullMeterCrop);
        }}
      />
      {photo && (
        <>
          <details className="meter-cropper">
            <summary>
              <Crop size={16} /> Khoanh vùng chỉ số để đọc chính xác hơn
            </summary>
            <p className="muted small-text">
              Giữ phần hiển thị số trong khung xanh; tránh số sê-ri, ngày tháng
              và các chữ số khác. Với đồng hồ có phần thập phân màu đỏ, hãy kiểm
              tra dấu thập phân trước khi xác nhận.
            </p>
            <div className="meter-crop-preview">
              <img src={photo} alt="Ảnh gốc và vùng đọc OCR" />
              <div
                style={{
                  left: `${crop.left}%`,
                  top: `${crop.top}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                }}
              />
            </div>
            <div className="form-grid">
              <Field
                label={`Lề trái ${crop.left}%`}
                type="range"
                min={0}
                max={90}
                disabled={progress !== null}
                value={crop.left}
                onChange={(e) =>
                  setCrop((c) => ({
                    ...c,
                    left: +e.target.value,
                    width: Math.min(c.width, 100 - +e.target.value),
                  }))
                }
              />
              <Field
                label={`Lề trên ${crop.top}%`}
                type="range"
                min={0}
                max={90}
                disabled={progress !== null}
                value={crop.top}
                onChange={(e) =>
                  setCrop((c) => ({
                    ...c,
                    top: +e.target.value,
                    height: Math.min(c.height, 100 - +e.target.value),
                  }))
                }
              />
              <Field
                label={`Chiều rộng ${crop.width}%`}
                type="range"
                min={10}
                max={100 - crop.left}
                disabled={progress !== null}
                value={crop.width}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, width: +e.target.value }))
                }
              />
              <Field
                label={`Chiều cao ${crop.height}%`}
                type="range"
                min={10}
                max={100 - crop.top}
                disabled={progress !== null}
                value={crop.height}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, height: +e.target.value }))
                }
              />
            </div>
          </details>
          <button
            type="button"
            className="btn secondary small"
            disabled={progress !== null}
            onClick={() => void recognize(photo)}
          >
            <ScanLine size={16} />
            {progress !== null
              ? `Đang đọc ảnh ${progress}%…`
              : "Đọc lại vùng ảnh bằng OCR"}
          </button>
        </>
      )}
      {progress !== null && (
        <>
          <div className="ocr-progress">
            <span style={{ width: `${Math.max(progress, 5)}%` }} />
          </div>
          <p className="muted small-text">
            Đang nhận dạng trên thiết bị. Lần đầu có thể mất thêm thời gian tải
            mô hình.
          </p>
        </>
      )}
      {result && (
        <div className="ocr-result" role="status">
          {result.value !== null ? (
            <>
              Gợi ý OCR: <strong>{result.value}</strong> · độ tin cậy{" "}
              {Math.round(result.confidence)}%. Đối chiếu ảnh trước khi xác
              nhận.
            </>
          ) : result.candidates.length ? (
            <>
              Ảnh có nhiều số. Chọn đúng chỉ số đồng hồ hoặc khoanh lại vùng
              đọc.
              <div className="ocr-candidates">
                {result.candidates.map((n) => (
                  <button
                    type="button"
                    className="btn secondary small"
                    key={n}
                    onClick={() => onValue(String(n))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : (
            "Chưa đọc được chỉ số phù hợp. Khoanh sát vùng số, thử lại ảnh hoặc nhập số đã đối chiếu."
          )}
          {result.text && (
            <details>
              <summary>Văn bản nhận dạng</summary>
              <pre>{result.text}</pre>
            </details>
          )}
        </div>
      )}
      {error && (
        <p className="error-text small-text" role="alert">
          {error}
        </p>
      )}
      <Field
        label={`Chỉ số mới ${unit}`}
        type="number"
        step="0.001"
        min={previous}
        max={1e12}
        value={value}
        disabled={progress !== null}
        onChange={(e) => onValue(e.target.value)}
        required
      />
      {value !== "" && Number(value) >= previous && (
        <p className="meter-usage">
          Sử dụng: {Math.round((Number(value) - previous) * 1000) / 1000} {unit}{" "}
          = {value} − {previous}
        </p>
      )}
    </section>
  );
}
