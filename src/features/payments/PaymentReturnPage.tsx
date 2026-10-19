import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, XCircle, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { useApp } from "../../app/provider";
import { useRoute } from "../../app/router";
import { PageTitle, Empty } from "../../components/ui";
import { money, dateText } from "../../lib/format";
import { paymentApi, type PaymentDetail } from "../../services/payments";
import { paymentDate, PaymentStatus, SandboxNotice, MerchantNote } from "./shared";

const MAX_AUTOMATIC_CHECKS = 6;
export default function PaymentReturnPage() {
  const route = useRoute();
  const id = new URLSearchParams(route.split("?")[1] || "").get("transaction") || "";
  const { refresh, user } = useApp();
  const [detail, setDetail] = useState<PaymentDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const run = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const [check, setCheck] = useState(0);
  const recheck = useCallback(() => setCheck(value => value + 1), []);
  useEffect(() => {
    const current = ++run.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setDetail(undefined); setError(""); setWaiting(false); setLoading(true);
    if (!id) { setLoading(false); return; }
    const load = async () => {
      try {
        const result = await paymentApi.transaction(id);
        if (run.current !== current) return;
        setDetail(result); setError(""); setLoading(false);
        attempts++;
        if (result.transaction.status === "pending" && attempts < MAX_AUTOMATIC_CHECKS) {
          setWaiting(true);
          timer = setTimeout(() => void load(), 4000);
        } else {
          setWaiting(false);
          if (result.transaction.status === "succeeded") void refreshRef.current().catch(() => {});
        }
      } catch (error) {
        if (run.current !== current) return;
        setError(error instanceof Error ? error.message : "Chưa lấy được kết quả thanh toán.");
        setLoading(false); setWaiting(false);
      }
    };
    void load();
    return () => { run.current++; if (timer) clearTimeout(timer); };
  }, [id, check]);
  const transaction = detail?.transaction;
  const succeeded = transaction?.status === "succeeded";
  const pending = transaction?.status === "pending";
  const title = !transaction ? "Kết quả thanh toán" : succeeded ? "Thanh toán thành công" : pending ? "Đang chờ xác nhận" : transaction.status === "expired" ? "Phiên thanh toán đã hết hạn" : "Thanh toán chưa hoàn tất";
  const destination = transaction?.purpose === "subscription" ? "#/app/plans" : detail?.invoice ? `#/app/billing?invoice=${encodeURIComponent(detail.invoice.id)}` : "#/app/billing";
  return <>
    <PageTitle title="Kết quả thanh toán" description="Trạng thái được kiểm tra trực tiếp với máy chủ TrọGọn." />
    <SandboxNotice />
    {!id ? <Empty title="Thiếu mã giao dịch" description="Mở giao dịch từ lịch sử để xem kết quả đã được xác minh." action={<a className="btn primary" href="#/app/payments">Xem lịch sử giao dịch</a>} /> : <section className={`panel payment-result ${succeeded ? "success" : pending ? "pending" : transaction ? "failure" : ""}`} aria-live="polite">
      <div className="payment-result-icon">{loading ? <span className="spinner" /> : succeeded ? <CheckCircle2 size={42} /> : pending ? <Clock3 size={42} /> : <XCircle size={42} />}</div>
      <h2>{loading ? "Đang kiểm tra giao dịch…" : title}</h2>
      {error ? <div className="payment-inline-error" role="alert">{error}</div> : transaction && <>
        <p className="payment-result-description">{succeeded ? transaction.purpose === "rent" ? "Hóa đơn đã được ghi nhận thanh toán qua VNPay Sandbox. Đây là giao dịch thử nghiệm, không có tiền thật được chuyển." : "Gói dịch vụ đã được cập nhật từ kết quả VNPay Sandbox. Đây là giao dịch thử nghiệm, không thu tiền thật." : pending ? "Hệ thống chưa nhận được kết quả xác minh cuối cùng. Bạn có thể quay lại sau; không cần tạo thêm thanh toán cho cùng hóa đơn." : "Giao dịch này chưa được ghi nhận thanh toán. Kiểm tra lịch sử trước khi tạo phiên thanh toán mới."}</p>
        <div className="payment-result-amount">{money(transaction.amount)}</div>
        <PaymentStatus status={transaction.status} />
        <dl className="payment-detail-list"><div><dt>Nội dung</dt><dd>{transaction.purpose === "subscription" ? "Gói TrọGọn Pro" : detail?.invoice ? `Phòng ${detail.invoice.roomName} · ${detail.invoice.period}` : "Thanh toán hóa đơn phòng"}</dd></div><div><dt>Mã giao dịch</dt><dd>{transaction.reference}</dd></div><div><dt>Khởi tạo</dt><dd>{paymentDate(transaction.createdAt)}</dd></div>{transaction.paidAt && <div><dt>Thanh toán lúc</dt><dd>{paymentDate(transaction.paidAt)}</dd></div>}{transaction.bankCode && <div><dt>Ngân hàng thử nghiệm</dt><dd>{transaction.bankCode}</dd></div>}{transaction.transactionNo && <div><dt>Mã tại VNPay</dt><dd>{transaction.transactionNo}</dd></div>}{transaction.responseCode && <div><dt>Mã phản hồi VNPay</dt><dd>{transaction.responseCode}</dd></div>}{pending && <div><dt>Phiên có hiệu lực đến</dt><dd>{paymentDate(transaction.expiresAt)}</dd></div>}{transaction.purpose === "subscription" && succeeded && detail?.subscription && <div><dt>Gói sử dụng đến</dt><dd>{dateText(detail.subscription.endsAt)}</dd></div>}</dl>
        {waiting && <p className="payment-loading"><span className="spinner" />Đang tự kiểm tra thêm trong ít giây…</p>}
        {pending && !waiting && <p className="payment-unavailable">Chưa có kết quả cuối cùng. Chọn “Kiểm tra lại” hoặc mở lịch sử giao dịch sau.</p>}
      </>}
      <div className="payment-result-actions">{!loading && (!transaction || pending) && <button className="btn secondary" onClick={recheck} disabled={waiting}><RefreshCw size={16} />Kiểm tra lại</button>}{transaction && <a className="btn primary" href={destination}>{transaction.purpose === "subscription" ? "Xem gói dịch vụ" : "Về hóa đơn"}<ArrowRight size={17} /></a>}<a className="btn secondary" href="#/app/payments">Lịch sử giao dịch</a></div>
      <p className="payment-result-security"><ShieldCheck size={15} />Kết quả được xác minh tại máy chủ. Tham số trên đường dẫn không tự thay đổi trạng thái thanh toán.</p>
      {user?.role === "tenant" && <MerchantNote />}
    </section>}
  </>;
}
