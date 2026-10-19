import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui";
import { paymentApi, redirectToVnpay, type CheckoutInput, type PaymentCatalog, type PaymentTransaction } from "../../services/payments";

export const transactionLabels: Record<PaymentTransaction["status"], string> = {
  pending: "Đang chờ kết quả",
  succeeded: "Thành công",
  failed: "Không thành công",
  expired: "Đã hết hạn",
};
export function PaymentStatus({ status }: { status: PaymentTransaction["status"] }) {
  return <Badge tone={status === "succeeded" ? "green" : status === "pending" ? "orange" : status === "failed" ? "red" : "gray"}>{transactionLabels[status]}</Badge>;
}
export function paymentDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có" : date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
export function SandboxNotice({ compact = false }: { compact?: boolean }) {
  return <div className={`sandbox-notice${compact ? " compact" : ""}`}>
    <FlaskConical size={19} aria-hidden="true" />
    <div><strong>VNPay Sandbox · Thanh toán thử nghiệm</strong><p>Không thu hoặc chuyển tiền thật. Dùng thông tin thử nghiệm của VNPay, không nhập thông tin thẻ thật.</p></div>
  </div>;
}
export function MerchantNote({ note }: { note?: string }) {
  return <p className="payment-merchant-note"><ShieldCheck size={16} aria-hidden="true" /><span>{note || "Cổng VNPay Sandbox dùng tài khoản merchant của nền tảng. Trạng thái hóa đơn được cập nhật sau khi máy chủ xác minh; đây chưa phải luồng chuyển tiền trực tiếp vào tài khoản ngân hàng của chủ trọ."}</span></p>;
}
export function usePaymentCatalog() {
  const [catalog, setCatalog] = useState<PaymentCatalog>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const data = await paymentApi.catalog();
      if (current === sequence.current) setCatalog(data);
    } catch (error) {
      if (current === sequence.current) setError(error instanceof Error ? error.message : "Chưa tải được cấu hình thanh toán.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  return { catalog, loading, error, reload };
}
export function useCheckout(input: CheckoutInput) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const key = useRef({ input: JSON.stringify(input), value: crypto.randomUUID() });
  const checkout = async () => {
    if (locked.current) return;
    const serialized = JSON.stringify(input);
    if (key.current.input !== serialized) key.current = { input: serialized, value: crypto.randomUUID() };
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await paymentApi.checkout(input, key.current.value);
      redirectToVnpay(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Chưa mở được VNPay. Vui lòng thử lại.");
      locked.current = false;
      setBusy(false);
    }
  };
  return { busy, error, checkout };
}
