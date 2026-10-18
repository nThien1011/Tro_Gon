import { useEffect, useState } from "react";
import { Copy, Download, CheckCheck, CreditCard } from "lucide-react";
import { useApp } from "../../app/provider";
import type { Invoice } from "../../domain/models";
import { calculateInvoice } from "../../domain/billing";
import { money, dateText } from "../../lib/format";
import { Modal, Status } from "../../components/ui";
import { createQr } from "../../services/qr";
export default function InvoiceDetail({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const { data, user, execute, toast } = useApp();
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState("");
  const room = data.rooms.find((r) => r.id === invoice.roomId)!,
    building = data.buildings.find((b) => b.id === room.buildingId)!,
    renter = data.users.find((u) => u.id === invoice.tenantId)!;
  const totals = calculateInvoice(invoice),
    reference = `TG ${invoice.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  useEffect(() => {
    if (invoice.bankBin && invoice.bankAccount)
      createQr(invoice.bankBin, invoice.bankAccount, totals.total, reference)
        .then(setQr)
        .catch((e) => setQrError(e.message));
  }, [
    invoice.id,
    invoice.bankBin,
    invoice.bankAccount,
    totals.total,
    reference,
  ]);
  return (
    <Modal
      title={`Hóa đơn ${invoice.roomName || room.name} · ${invoice.period}`}
      wide
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="invoice-heading">
          <div>
            <h2>TrọGọn</h2>
            <p>
              {invoice.buildingName || building.name} ·{" "}
              {invoice.roomName || room.name}
            </p>
            <small>Người thuê: {invoice.tenantName || renter.name}</small>
          </div>
          <div>
            <Status value={invoice.status} />
            <Status value={invoice.paymentStatus} />
            <p>Hạn thu {dateText(invoice.dueDate)}</p>
          </div>
        </div>
        <div className="meter-summary">
          <div>
            <strong>Điện</strong>
            <span>
              {invoice.oldElectricity} → {invoice.newElectricity} kWh
            </span>
            <small>Sử dụng {totals.electricityUsed} kWh</small>
            {invoice.electricityPhoto && (
              <a
                href={invoice.electricityPhoto}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={invoice.electricityPhoto}
                  alt="Ảnh đồng hồ điện của kỳ này"
                />
              </a>
            )}
          </div>
          <div>
            <strong>Nước</strong>
            <span>
              {invoice.oldWater} → {invoice.newWater} m³
            </span>
            <small>Sử dụng {totals.waterUsed} m³</small>
            {invoice.waterPhoto && (
              <a href={invoice.waterPhoto} target="_blank" rel="noreferrer">
                <img
                  src={invoice.waterPhoto}
                  alt="Ảnh đồng hồ nước của kỳ này"
                />
              </a>
            )}
          </div>
        </div>
        <div className="invoice-preview">
          <div>
            <span>Tiền phòng</span>
            <strong>{money(invoice.rent)}</strong>
          </div>
          <div>
            <span>
              Điện · {totals.electricityUsed} × {money(invoice.electricityRate)}
            </span>
            <strong>{money(totals.electricity)}</strong>
          </div>
          <div>
            <span>
              Nước · {totals.waterUsed} × {money(invoice.waterRate)}
            </span>
            <strong>{money(totals.water)}</strong>
          </div>
          <div>
            <span>Dịch vụ</span>
            <strong>{money(invoice.serviceFee)}</strong>
          </div>
          <div className="invoice-total">
            <strong>Tổng thanh toán</strong>
            <b>{money(totals.total)}</b>
          </div>
        </div>
        {invoice.status === "issued" && invoice.paymentStatus !== "paid" && (
          <section className="payment-section">
            <div>
              <h3>Thông tin chuyển khoản</h3>
              {invoice.bankAccount ? (
                <>
                  <p>
                    Số tài khoản: <strong>{invoice.bankAccount}</strong>
                  </p>
                  <p>
                    Chủ tài khoản:{" "}
                    <strong>{invoice.bankName || "Chưa cung cấp"}</strong>
                  </p>
                  <p>
                    Nội dung: <strong>{reference}</strong>
                  </p>
                  <button
                    className="btn secondary small"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(
                          `${invoice.bankAccount} | ${invoice.bankName || ""} | ${totals.total} VND | ${reference}`,
                        )
                        .then(() => toast("Đã sao chép thông tin."))
                        .catch(() =>
                          toast(
                            "Chưa sao chép được. Bạn có thể chọn và chép thông tin trên màn hình.",
                            true,
                          ),
                        )
                    }
                  >
                    <Copy size={15} />
                    Sao chép thông tin
                  </button>
                </>
              ) : (
                <p className="muted">
                  Hóa đơn này chưa có thông tin ngân hàng. Chủ trọ cấu hình ngân
                  hàng trong Tài khoản trước khi phát hành hóa đơn mới, hoặc
                  trao đổi trực tiếp về phương thức thanh toán.
                </p>
              )}
              <small>
                Thông báo đã trả cần được chủ trọ kiểm tra tiền thực nhận. Trang
                này không tự chuyển tiền.
              </small>
            </div>
            {qr ? (
              <div className="qr-code">
                <img src={qr} alt="QR chuyển khoản đúng số tiền hóa đơn" />
                <a href={qr} download={`QR-${room.name}-${invoice.period}.png`}>
                  <Download size={15} />
                  Lưu QR
                </a>
              </div>
            ) : qrError ? (
              <p className="error-text">{qrError}</p>
            ) : null}
          </section>
        )}
        {invoice.status === "issued" && invoice.paymentStatus !== "paid" && (
          <div className="form-actions">
            {user?.role === "tenant" ? (
              <button
                disabled={invoice.paymentStatus === "pending"}
                className="btn primary"
                onClick={() =>
                  execute(
                    { type: "payment.notify", payload: { id: invoice.id } },
                    "Đã báo chủ trọ kiểm tra thanh toán.",
                  )
                }
              >
                <CreditCard size={17} />
                {invoice.paymentStatus === "pending"
                  ? "Đang chờ chủ trọ xác nhận"
                  : "Tôi đã thanh toán"}
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => {
                  if (
                    confirm("Bạn đã kiểm tra và nhận đủ tiền của hóa đơn này?")
                  )
                    execute(
                      { type: "payment.confirm", payload: { id: invoice.id } },
                      "Đã xác nhận thu tiền.",
                    );
                }}
              >
                <CheckCheck size={17} />
                Xác nhận đã nhận đủ tiền
              </button>
            )}
          </div>
        )}
        {invoice.paymentStatus === "paid" && (
          <p className="success-text">
            Đã được chủ trọ xác nhận thu ngày {dateText(invoice.paidAt || "")}.
          </p>
        )}
      </div>
    </Modal>
  );
}
