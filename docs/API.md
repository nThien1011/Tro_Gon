# API

Base URL `/api/v1`, JSON, cookie cùng origin. Error gồm message/code/requestId, không trả SQL/password hash. Healthcheck ở root.

| Method | Path                         | Chức năng/input                                 |
| ------ | ---------------------------- | ----------------------------------------------- |
| GET    | /auth/csrf                   | Nhận token và cookie CSRF HttpOnly              |
| POST   | /auth/register               | name, email, phone, password, role owner/tenant |
| POST   | /auth/login                  | contact, password                               |
| GET    | /auth/me                     | User hiện tại hoặc null                         |
| POST   | /auth/logout                 | Hủy phiên                                       |
| POST   | /auth/password               | oldPassword, newPassword, thu hồi các phiên cũ  |
| POST   | /auth/verification/request   | channel email/phone, trả challengeId            |
| POST   | /auth/verification/confirm   | challengeId, code                               |
| POST   | /auth/password/reset/request | contact, trả challengeId và thông báo chung     |
| POST   | /auth/password/reset/confirm | challengeId, code, newPassword                  |
| GET    | /snapshot                    | Snapshot theo quyền, không chứa credentials     |
| GET    | /version                     | version/userId cho cập nhật UI                  |
| POST   | /commands                    | type/payload, bắt buộc Idempotency-Key          |
| GET    | /media/:id                   | Ảnh theo quyền, không có quyền trả 404          |
| GET    | /health/live                 | Root: process alive                             |
| GET    | /health/ready                | Root: database ready                            |

POST cần X-CSRF-Token bằng token GET csrf và cookie tương ứng. Token hết hạn lấy token mới. Không lưu session token ở localStorage. Mật khẩu 8–128 ký tự; đăng ký ít nhất email hoặc điện thoại, không tự tạo admin.

Command: building.save/delete, room.save/delete, listing.save/hide/moderate, tenancy.assign/end, request.create/respond/confirm/cancel, appointment.create/respond, conversation.start, message.send, invoice.save/cancel, payment.notify/confirm/reject, favorite.toggle, ticket.create/respond, profile.save, user.toggle, settings.save, meter.submit/review, notification.read.

Tòa nhà không cần tọa độ; server lấy tên địa danh từ mã:

```json
{
  "type": "building.save",
  "payload": {
    "name": "December",
    "cityCode": "48",
    "districtCode": "494",
    "wardCode": "20290",
    "address": "25 đường Trường Sa",
    "description": "Mô tả"
  }
}
```

Hóa đơn:

```json
{
  "type": "invoice.save",
  "payload": {
    "roomId": "room-id",
    "period": "2026-11",
    "newElectricity": 1573,
    "newWater": 125.5,
    "electricityPhoto": "data:image/jpeg;base64,...",
    "dueDate": "2026-12-05",
    "issue": true
  }
}
```

Server lấy chỉ số cũ/giá/phí/người thuê/ngân hàng từ DB. issue=false lưu nháp, true phát hành; cập nhật nháp cần id. Ảnh đổi thành URL private sau lưu. Request tối đa 12 MB; mỗi ảnh tối đa 10 MB, JPEG/PNG/WebP, tối đa 8 ảnh phòng.

payment.notify do người thuê; payment.confirm do chủ trọ/admin sau khi nhận đủ tiền; payment.reject cần reason và chỉ chuyển pending về unpaid. Không hủy invoice đã thu/chờ xác nhận. Idempotency-Key 16–80 ký tự, cùng người/key/payload trả kết quả cũ; payload khác trả 409.

Ngày thuê/dueDate dùng YYYY-MM-DD; lịch xem dùng ISO có timezone. Frontend đổi datetime-local trước gửi. Danh mục mã khu vực và tương thích dữ liệu cũ ở LOCATIONS.md.

401: chưa đăng nhập; 403: sai quyền/CSRF/origin; 409: trùng dữ liệu/key; 422: vi phạm nghiệp vụ; 429: giới hạn thao tác; 503: bảo trì/kênh gửi mã chưa cấu hình; 500: lỗi nội bộ, tra requestId trong log.

## Thông báo và chỉ số dùng chung

Snapshot có `notifications` riêng người nhận (kể cả admin), `meterReadings` theo quyền phòng/hồ sơ thuê. `notification.read` nhận `{id}` hoặc `{all: true}`, không được đọc hộ.

`room.save` thêm `electricityBillingMode`/`waterBillingMode`: `metered` hoặc `fixed`, và `electricityMonthlyFee`/`waterMonthlyFee`. Dữ liệu cũ mặc định metered. Invoice giữ snapshot mode/phí từ DB, không nhận từ client.

`meter.submit`: `{roomId, kind: "electricity" | "water", period: "YYYY-MM", value, photo, confirmed: true, ocrValue?, ocrConfidence?, ocrText?}`. Tenant chỉ gửi cho phòng đang thuê; owner/admin phải quản lý phòng. Server lấy previous/tenancy/tenant từ DB. Photo là data URL JPEG/PNG/WebP hoặc media có quyền; không dùng ảnh minh họa public. OCR metadata chỉ là gợi ý client.

`meter.review`: `{id, accept: true}` hoặc `{id, accept: false, reason}`; chỉ owner quản lý/admin duyệt pending. Bản accepted trước của cùng phòng/kỳ/loại chuyển superseded; vẫn giữ lịch sử. Unique generated key chặn nhiều bản accepted cùng phòng/kỳ/loại. Chặn duyệt sau bàn giao hoặc khi chỉ số gốc thay đổi.

`invoice.save` có thể dùng `electricityReadingId`/`waterReadingId` để lấy value/photo từ bản accepted cùng hồ sơ thuê/kỳ. Khoản fixed không cần số mới, giữ nguyên số gốc. Chi tiết ở [NOTIFICATIONS_AND_METERS.md](NOTIFICATIONS_AND_METERS.md).
