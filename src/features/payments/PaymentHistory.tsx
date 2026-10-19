import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CreditCard, RefreshCw } from "lucide-react";
import { Empty, PageTitle } from "../../components/ui";
import { money } from "../../lib/format";
import { paymentApi, type PaymentTransaction } from "../../services/payments";
import { paymentDate, PaymentStatus, SandboxNotice } from "./shared";

export default function PaymentHistory({ purpose, invoiceId, title = "Lịch sử giao dịch" }: {
  purpose?: "rent" | "subscription";
  invoiceId?: string;
  title?: string;
}) {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setError("");
    try {
      const data = await paymentApi.history();
      if (sequence.current === current) setTransactions(data.transactions);
    } catch (error) {
      if (sequence.current === current) setError(error instanceof Error ? error.message : "Không tải được lịch sử thanh toán.");
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  const items = transactions.filter(item => (!purpose || item.purpose === purpose) && (!invoiceId || item.invoiceId === invoiceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <section className="panel payment-history">
    <div className="payment-history-heading"><div><h2>{title}</h2><p>Các giao dịch được ghi nhận từ máy chủ.</p></div><button className="btn secondary small" disabled={loading} onClick={() => void load()}><RefreshCw size={15} />{loading ? "Đang tải…" : "Làm mới"}</button></div>
    {error ? <div className="payment-inline-error" role="alert">{error}</div> : loading && !transactions.length ? <div className="payment-loading" role="status"><span className="spinner" />Đang tải giao dịch…</div> : !items.length ? <Empty title="Chưa có giao dịch" description="Giao dịch VNPay Sandbox của bạn sẽ xuất hiện tại đây." /> : <div className="payment-transactions">
      {items.map(item => <a key={item.id} className="payment-transaction" href={`#/app/payment-return?transaction=${encodeURIComponent(item.id)}`}>
        <div className="payment-transaction-icon"><CreditCard size={20} /></div>
        <div className="payment-transaction-info"><strong>{item.purpose === "rent" ? "Thanh toán hóa đơn phòng" : "Mua gói TrọGọn Pro"}</strong><span>{item.reference}</span><small>{paymentDate(item.createdAt)}{item.bankCode ? ` · ${item.bankCode}` : ""}</small></div>
        <div className="payment-transaction-total"><strong>{money(item.amount)}</strong><PaymentStatus status={item.status} /></div><ArrowUpRight size={17} className="payment-transaction-arrow" />
      </a>)}
    </div>}
  </section>;
}
export function PaymentsPage() {
  return <><PageTitle title="Giao dịch VNPay" description="Theo dõi thanh toán hóa đơn và lịch sử mua gói của bạn." /><SandboxNotice /><PaymentHistory /></>;
}
