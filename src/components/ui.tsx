import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X, Upload, ImagePlus, Search, Inbox } from "lucide-react";
import { imageToDataUrl } from "../services/media";
import { useApp } from "../app/provider";
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Các thông tin mới sẽ xuất hiện tại đây.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b> *</b>}
      </span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b> *</b>}
      </span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function Textarea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} {...props} />
    </label>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  note?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),input:not([disabled]),select,textarea",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ImageUpload({
  images,
  onChange,
  single = false,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  single?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useApp();
  return (
    <div className="upload-field">
      <div className="upload-preview">
        {images.map((src, i) => (
          <div key={i}>
            <img src={src} alt={`Ảnh ${i + 1}`} />
            <button
              type="button"
              aria-label="Bỏ ảnh"
              onClick={() => onChange(images.filter((_, n) => i !== n))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <label className={`upload-button ${busy ? "disabled" : ""}`}>
        <ImagePlus size={20} />
        <span>
          {busy
            ? "Đang xử lý ảnh…"
            : single
              ? "Chụp hoặc chọn ảnh đồng hồ"
              : "Thêm ảnh phòng"}
          <small>JPG, PNG, WebP · tối đa 10 MB/ảnh</small>
        </span>
        <Upload size={17} />
        <input
          disabled={busy}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={!single}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            setBusy(true);
            try {
              const values = await Promise.all(
                files
                  .slice(0, single ? 1 : Math.max(0, 8 - images.length))
                  .map(imageToDataUrl),
              );
              onChange(single ? values : [...images, ...values]);
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
    </div>
  );
}
export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
export const statusNames: Record<string, string> = {
  available: "Còn trống",
  occupied: "Đang thuê",
  maintenance: "Bảo trì",
  draft: "Bản nháp",
  pending: "Chờ xử lý",
  published: "Đang hiển thị",
  rejected: "Từ chối",
  hidden: "Đã ẩn",
  active: "Hoạt động",
  unpaid: "Chưa thu",
  paid: "Đã thu",
  issued: "Đã phát hành",
  cancelled: "Đã hủy",
  confirmed: "Đã xác nhận",
  completed: "Hoàn tất",
  accepted: "Được chấp thuận",
  open: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
};
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        ["pending", "unpaid", "open", "in_progress"].includes(value)
          ? "orange"
          : ["cancelled", "rejected"].includes(value)
            ? "red"
            : ["draft", "hidden", "maintenance"].includes(value)
              ? "gray"
              : "green"
      }
    >
      {statusNames[value] || value}
    </Badge>
  );
}
