import { ArrowUpRight, CreditCard, RefreshCw } from "lucide-react";
import { SandboxNotice, MerchantNote, useCheckout, usePaymentCatalog } from "./shared";

export default function InvoiceVnpayPayment({
  invoiceId, disabled = false, paymentStatus = "unpaid",
}: {
  invoiceId: string;
  disabled?: boolean;
  paymentStatus?: "unpaid" | "pending" | "paid";
}) {
  const { catalog, loading, error: catalogError, reload } = usePaymentCatalog();
  const { busy, error, checkout } = useCheckout({ purpose: "rent", invoiceId });
  return <section className="invoice-vnpay" aria-label="Thanh toán hóa đơn qua VNPay Sandbox">
    <div className="payment-card-heading"><div className="payment-card-icon"><CreditCard size={22} /></div><div><h3>Thanh toán qua VNPay</h3><p>Xác nhận tự động sau khi VNPay gửi kết quả hợp lệ.</p></div><span className="payment-sandbox-tag">SANDBOX</span></div>
    <SandboxNotice compact />
    {loading ? <p className="payment-loading" role="status"><span className="spinner" />Đang kiểm tra cổng thanh toán…</p> : catalogError ? <div className="payment-inline-error" role="alert"><span>{catalogError}</span><button className="btn secondary small" onClick={() => void reload()}><RefreshCw size={14} />Thử lại</button></div> : !catalog?.enabled ? <p className="payment-unavailable">{catalog?.reason || "Cổng thanh toán đang chờ cấu hình. Bạn vẫn có thể sử dụng chuyển khoản và báo chủ trọ kiểm tra."}</p> : null}
    {paymentStatus === "pending" && <p className="payment-unavailable">Bạn đã báo chuyển khoản và đang chờ chủ trọ xác nhận. Hãy kiểm tra với chủ trọ trước khi tạo thanh toán khác.</p>}
    <button className="btn primary" disabled={disabled || busy || loading || !catalog?.enabled || paymentStatus !== "unpaid"} onClick={() => void checkout()}>
      {busy ? <span className="spinner" /> : <CreditCard size={17} />}{busy ? "Đang mở VNPay…" : paymentStatus === "paid" ? "Hóa đơn đã thanh toán" : "Thanh toán thử với VNPay"}{!busy && <ArrowUpRight size={16} />}
    </button>
    {error && <p className="error-text" role="alert">{error}</p>}
    <MerchantNote note={catalog?.merchant.note} />
  </section>;
}
