import { Check, ArrowUpRight, Sparkles, Clock3, RefreshCw } from "lucide-react";
import { useApp } from "../../app/provider";
import { Empty, PageTitle, Badge } from "../../components/ui";
import { dateText, money } from "../../lib/format";
import type { PaymentPlan } from "../../services/payments";
import PaymentHistory from "./PaymentHistory";
import { MerchantNote, SandboxNotice, useCheckout, usePaymentCatalog } from "./shared";

function PlanCard({ plan, enabled, active }: { plan: PaymentPlan; enabled: boolean; active: boolean }) {
  const { busy, error, checkout } = useCheckout({ purpose: "subscription", planId: plan.id });
  return <article className="payment-plan-card">
    <div className="payment-plan-top"><div className="payment-plan-symbol"><Sparkles size={25} /></div><span className="payment-sandbox-tag">GÓI CHỦ TRỌ</span></div>
    <h2>{plan.name}</h2><p className="payment-plan-description">{plan.description}</p>
    <div className="payment-plan-price"><strong>{money(plan.price)}</strong><span>/ {plan.durationDays} ngày</span></div>
    <p className="payment-plan-once"><Clock3 size={15} />Thanh toán một lần · Không tự động gia hạn</p>
    <ul className="payment-plan-features">{plan.features.map(feature => <li key={feature}><Check size={17} /><span>{feature}</span></li>)}</ul>
    <button className="btn primary" disabled={!enabled || busy} onClick={() => void checkout()}>{busy ? <span className="spinner" /> : <Sparkles size={17} />}{busy ? "Đang mở VNPay…" : active ? `Gia hạn thêm ${plan.durationDays} ngày` : "Mua gói qua VNPay Sandbox"}{!busy && <ArrowUpRight size={17} />}</button>
    <small className="payment-plan-disclaimer">Thử nghiệm Sandbox, không trừ tiền thật. Gói chỉ được kích hoạt sau khi kết quả thanh toán được xác minh.</small>
    {error && <p className="error-text" role="alert">{error}</p>}
  </article>;
}
export default function PlansPage() {
  const { user } = useApp();
  const { catalog, loading, error, reload } = usePaymentCatalog();
  if (user?.role !== "owner") return <Empty title="Gói dịch vụ dành cho chủ trọ" description="Đăng nhập tài khoản chủ trọ để xem và mua gói." />;
  const active = catalog?.subscription?.status === "active";
  return <>
    <PageTitle title="Gói dịch vụ" description="Chọn gói phù hợp để quản lý nhà trọ gọn gàng hơn." />
    <SandboxNotice />
    {loading && !catalog ? <div className="payment-loading" role="status"><span className="spinner" />Đang tải các gói dịch vụ…</div> : error ? <div className="payment-inline-error" role="alert"><span>{error}</span><button className="btn secondary small" onClick={() => void reload()}><RefreshCw size={15} />Thử lại</button></div> : catalog && <>
      <div className={`payment-subscription${active ? " active" : ""}`}><div className="payment-subscription-icon"><Sparkles size={23} /></div><div><strong>{active ? "TrọGọn Pro đang hoạt động" : catalog.subscription ? "Gói Pro đã hết hạn" : "Bạn chưa có gói Pro"}</strong><p>{catalog.subscription ? `Thời hạn: ${dateText(catalog.subscription.startsAt)} – ${dateText(catalog.subscription.endsAt)}` : "Xem quyền lợi và chọn mua gói bên dưới."}</p></div><Badge tone={active ? "green" : "gray"}>{active ? "Đang sử dụng" : "Chưa kích hoạt"}</Badge></div>
      {!catalog.enabled && <div className="payment-unavailable">{catalog.reason || "VNPay Sandbox chưa được cấu hình. Bạn có thể xem gói và quay lại thanh toán sau."}</div>}
      <div className="payment-plans-grid">{catalog.plans.map(plan => <PlanCard key={plan.id} plan={plan} enabled={catalog.enabled} active={active} />)}<aside className="payment-plan-explainer"><span className="eyebrow">BẠN CẦN BIẾT</span><h2>Rõ ràng từ lúc chọn gói</h2><div><span>01</span><p>Kiểm tra quyền lợi và giá gói trước khi tiếp tục.</p></div><div><span>02</span><p>Thanh toán thử trên cổng VNPay Sandbox bằng dữ liệu thử nghiệm.</p></div><div><span>03</span><p>Khi thanh toán được xác minh, thời hạn gói cập nhật trong tài khoản. Gia hạn sẽ cộng tiếp thời gian còn lại.</p></div><MerchantNote note={catalog.merchant.note} /></aside></div>
      {!catalog.plans.length && <Empty title="Chưa có gói dịch vụ" description="Quản trị viên chưa mở bán gói nào." />}
    </>}
    <PaymentHistory purpose="subscription" title="Lịch sử mua gói" />
  </>;
}
