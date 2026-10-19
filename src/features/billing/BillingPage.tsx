import { useEffect, useState } from "react";
import {
  Plus,
  Eye,
  Pencil,
  XCircle,
  FileText,
  Wallet,
  Clock,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { visibleRooms } from "../../domain/selectors";
import { calculateInvoice } from "../../domain/billing";
import { money, dateText, downloadFile } from "../../lib/format";
import { PageTitle, Stat, Status, Empty } from "../../components/ui";
import type { Invoice } from "../../domain/models";
import InvoiceEditor from "./InvoiceEditor";
import InvoiceDetail from "./InvoiceDetail";
import MeterReadingsPanel from "./MeterReadingsPanel";
export default function BillingPage() {
  const { data, user, execute } = useApp();
  const [editor, setEditor] = useState<Invoice | null>();
  const [selected, setSelected] = useState<string>();
  const [status, setStatus] = useState("");
  const invoiceFromUrl = new URLSearchParams(location.hash.split("?")[1]).get(
    "invoice",
  );
  const tabFromUrl = new URLSearchParams(location.hash.split("?")[1]).get(
    "tab",
  );
  const openFromUrl = new URLSearchParams(location.hash.split("?")[1]).get(
    "open",
  );
  useEffect(() => {
    if (invoiceFromUrl) setSelected(invoiceFromUrl);
  }, [invoiceFromUrl, openFromUrl]);
  useEffect(() => {
    if (tabFromUrl === "meters")
      document
        .getElementById("meter-readings")
        ?.scrollIntoView({ block: "start" });
  }, [tabFromUrl, openFromUrl]);
  if (!user) return null;
  const rooms = visibleRooms(data, user),
    all = data.invoices.filter(
      (i) =>
        user.role === "admin" ||
        (user.role === "tenant"
          ? i.tenantId === user.id && i.status !== "draft"
          : rooms.some((r) => r.id === i.roomId)),
    ),
    invoices = all
      .filter(
        (i) =>
          !status ||
          (status === "draft"
            ? i.status === "draft"
            : i.status === "issued" && i.paymentStatus === status),
      )
      .slice()
      .reverse();
  const selectedInvoice = all.find((i) => i.id === selected),
    sum = (paid: boolean) =>
      all
        .filter(
          (i) => i.status === "issued" && (i.paymentStatus === "paid") === paid,
        )
        .reduce((n, i) => n + calculateInvoice(i).total, 0);
  return (
    <>
      <PageTitle
        title={
          user.role === "tenant" ? "Hóa đơn của tôi" : "Hóa đơn & điện nước"
        }
        description="Chỉ số minh bạch, tiền phòng tính rõ từng khoản."
        action={
          user.role !== "tenant" && (
            <button className="btn primary" onClick={() => setEditor(null)}>
              <Plus size={18} />
              Chốt điện nước
            </button>
          )
        }
      />
      <div className="stats-grid three">
        <Stat
          label="Đã xác nhận thu"
          value={money(sum(true))}
          icon={<Wallet />}
        />
        <Stat
          label="Chưa hoàn tất thu"
          value={money(sum(false))}
          icon={<Clock />}
        />
        <Stat label="Tổng hóa đơn" value={all.length} icon={<FileText />} />
      </div>
      <MeterReadingsPanel />
      <div className="tabs">
        {[
          ["", "Tất cả"],
          ["unpaid", "Chưa thu"],
          ["pending", "Chờ xác nhận"],
          ["paid", "Đã thu"],
          ...(user.role === "tenant" ? [] : [["draft", "Bản nháp"]]),
        ].map(([value, label]) => (
          <button
            key={value}
            className={status === value ? "active" : ""}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kỳ / phòng</th>
                <th>Người thuê</th>
                <th>Điện / nước dùng</th>
                <th>Tổng tiền</th>
                <th>Tình trạng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const r = data.rooms.find((r) => r.id === i.roomId)!,
                  u = data.users.find((u) => u.id === i.tenantId)!,
                  total = calculateInvoice(i);
                return (
                  <tr key={i.id}>
                    <td>
                      <strong>
                        {i.period} · {r.name}
                      </strong>
                      <small>Hạn {dateText(i.dueDate)}</small>
                    </td>
                    <td>{u.name}</td>
                    <td>
                      {i.electricityBillingMode === "fixed"
                        ? "Điện cố định/tháng"
                        : `${total.electricityUsed} kWh`}
                      <small>
                        {i.waterBillingMode === "fixed"
                          ? "Nước cố định/tháng"
                          : `${total.waterUsed} m³`}
                      </small>
                    </td>
                    <td>
                      <strong>{money(total.total)}</strong>
                    </td>
                    <td>
                      <Status
                        value={
                          i.status === "issued" ? i.paymentStatus : i.status
                        }
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label="Xem hóa đơn"
                          className="icon-btn"
                          onClick={() => setSelected(i.id)}
                        >
                          <Eye size={18} />
                        </button>
                        {user.role !== "tenant" && i.status === "draft" && (
                          <button
                            aria-label="Sửa bản nháp"
                            className="icon-btn"
                            onClick={() => setEditor(i)}
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                        {user.role !== "tenant" &&
                          i.status !== "cancelled" &&
                          i.paymentStatus === "unpaid" && (
                            <button
                              aria-label="Hủy hóa đơn"
                              className="icon-btn danger"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Hủy hóa đơn này? Chỉ số phòng sẽ được khôi phục nếu đây là hóa đơn mới nhất.",
                                  )
                                )
                                  execute(
                                    {
                                      type: "invoice.cancel",
                                      payload: { id: i.id },
                                    },
                                    "Đã hủy hóa đơn.",
                                  );
                              }}
                            >
                              <XCircle size={17} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!invoices.length && (
          <Empty
            title="Chưa có hóa đơn trong danh sách"
            description={
              user.role === "tenant"
                ? "Chủ trọ sẽ phát hành hóa đơn theo từng kỳ."
                : "Tạo hóa đơn từ chỉ số mới và thông tin phòng đang có người thuê."
            }
          />
        )}
      </section>
      {editor !== undefined && (
        <InvoiceEditor
          invoice={editor || undefined}
          onClose={() => setEditor(undefined)}
        />
      )}{" "}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}
