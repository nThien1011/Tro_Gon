import { useState } from "react";
import { Lock, Unlock, Download, Save } from "lucide-react";
import { useApp } from "../../app/provider";
import {
  PageTitle,
  SearchBox,
  Status,
  Field,
  formValues,
  Empty,
} from "../../components/ui";
import { initials, normalize, downloadFile, dateText } from "../../lib/format";
import { roleLabels } from "../../domain/models";
export function UsersPage() {
  const { data, user, execute } = useApp();
  const [q, setQ] = useState("");
  const users = data.users.filter((u) =>
    normalize(`${u.name} ${u.email} ${u.phone}`).includes(normalize(q)),
  );
  return (
    <>
      <PageTitle
        title="Quản lý người dùng"
        description="Tài khoản chủ trọ, người thuê và trạng thái hoạt động."
      />
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Tìm tên, email hoặc số điện thoại…"
        />
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="table-person">
                      <span className="avatar">{initials(u.name)}</span>
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td>{u.email || "Chưa cung cấp"}</td>
                  <td>{u.phone || "Chưa cung cấp"}</td>
                  <td>{roleLabels[u.role]}</td>
                  <td>
                    <Status value={u.active ? "active" : "cancelled"} />
                  </td>
                  <td>
                    {u.role !== "admin" && (
                      <button
                        className="btn secondary small"
                        onClick={() => {
                          if (
                            confirm(
                              `${u.active ? "Khóa" : "Mở khóa"} tài khoản ${u.name}?`,
                            )
                          )
                            execute(
                              { type: "user.toggle", payload: { id: u.id } },
                              "Đã cập nhật tài khoản.",
                            );
                        }}
                      >
                        {u.active ? <Lock size={14} /> : <Unlock size={14} />}{" "}
                        {u.active ? "Khóa" : "Mở khóa"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <Empty title="Không tìm thấy tài khoản" />}
      </section>
    </>
  );
}
export function AuditPage() {
  const { data } = useApp();
  const [q, setQ] = useState("");
  const rows = data.audit.filter((a) => a.action.includes(q));
  return (
    <>
      <PageTitle
        title="Nhật ký hoạt động"
        description="Dấu vết các thao tác quan trọng trong hệ thống."
        action={
          <button
            className="btn secondary"
            onClick={() =>
              downloadFile(
                "trogon-audit.csv",
                "\uFEFFThời gian,Người thực hiện,Thao tác\n" +
                  rows
                    .map(
                      (a) =>
                        `${a.createdAt},${data.users.find((u) => u.id === a.actorId)?.name},${a.action}`,
                    )
                    .join("\n"),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={17} />
            Xuất CSV
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Lọc thao tác, ví dụ invoice…"
        />
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Thao tác</th>
                <th>Mã sự kiện</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString("vi-VN")}</td>
                  <td>{data.users.find((u) => u.id === a.actorId)?.name}</td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td>
                    <small>{a.id.slice(0, 8)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="Chưa có hoạt động được ghi nhận" />}
      </section>
    </>
  );
}
export function SettingsPage() {
  const { data, execute } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageTitle
        title="Cấu hình nền tảng"
        description="Thiết lập mặc định cho dữ liệu tạo mới. Hóa đơn đã phát hành được giữ nguyên."
      />
      <div className="settings-layout">
        <form
          className="panel padded"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const values = formValues(e.currentTarget);
            await execute(
              {
                type: "settings.save",
                payload: {
                  ...values,
                  maintenance: values.maintenance === "on",
                },
              },
              "Đã lưu cấu hình.",
            );
            setBusy(false);
          }}
        >
          <h3>Thông tin chung</h3>
          <Field
            label="Tên nền tảng"
            name="siteName"
            defaultValue={data.settings.siteName}
            required
          />
          <Field
            label="Email hỗ trợ"
            name="supportEmail"
            type="email"
            defaultValue={data.settings.supportEmail}
            required
          />
          <h3>Đơn giá gợi ý cho phòng mới</h3>
          <div className="form-grid three">
            <Field
              label="Điện VND / kWh"
              name="electricityRate"
              type="number"
              min={0}
              defaultValue={data.settings.electricityRate}
              required
            />
            <Field
              label="Nước VND / m³"
              name="waterRate"
              type="number"
              min={0}
              defaultValue={data.settings.waterRate}
              required
            />
            <Field
              label="Dịch vụ VND / tháng"
              name="serviceFee"
              type="number"
              min={0}
              defaultValue={data.settings.serviceFee}
              required
            />
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              name="maintenance"
              defaultChecked={data.settings.maintenance}
            />
            Hiển thị thông báo bảo trì ở khu vực tìm phòng
          </label>
          <button disabled={busy} className="btn primary">
            <Save size={17} />
            Lưu cấu hình
          </button>
        </form>
        <aside className="panel padded">
          <h3>Dữ liệu và mở rộng</h3>
          <p>
            Bản frontend dùng IndexedDB để lưu trên thiết bị. Lớp dịch vụ có thể
            chuyển sang API bằng biến môi trường.
          </p>
          <a className="btn secondary full" href="#/guide">
            Hướng dẫn sử dụng
          </a>
          <button
            className="btn secondary full"
            onClick={() =>
              downloadFile("trogon-data.json", JSON.stringify(data, null, 2))
            }
          >
            <Download size={17} />
            Xuất dữ liệu JSON
          </button>
          <small className="muted">
            Bản xuất chứa thông tin người dùng và nghiệp vụ. Không bao gồm mật
            khẩu hoặc thông tin đăng nhập.
          </small>
        </aside>
      </div>
    </>
  );
}
