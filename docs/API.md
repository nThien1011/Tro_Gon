# Hợp đồng backend dự kiến

Đây là hợp đồng của HTTP adapter đã viết, chưa có server triển khai kèm. Base URL do `VITE_API_BASE_URL` cấu hình. Response dùng JSON trực tiếp, lỗi trả `{ "message": "Thông báo có thể hiển thị" }` cùng mã HTTP phù hợp. Cookie session do server quản lý.

| Method | Path           | Request                                              | Response                                                                  |
| ------ | -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | /snapshot      | Cookie session nếu có                                | Snapshot theo `domain/models.ts`, đã lọc theo quyền, không có credentials |
| GET    | /auth/me       | Cookie session                                       | User công khai của session hoặc null                                      |
| POST   | /auth/login    | contact, password                                    | User và Set-Cookie                                                        |
| POST   | /auth/register | name, email, phone, password, role owner hoặc tenant | User và Set-Cookie                                                        |
| POST   | /auth/logout   | Cookie session                                       | JSON, xóa session                                                         |
| POST   | /auth/password | oldPassword, newPassword                             | JSON                                                                      |
| POST   | /commands      | type, payload                                        | JSON kết quả; UI sẽ lấy lại snapshot                                      |

Guest chỉ nhận tin published, phòng available, thông tin chủ trọ công bố và danh mục. Tenant nhận các đối tượng của mình. Owner nhận tài sản và các yêu cầu liên quan. Admin có quyền quản trị nhưng vẫn áp dụng giới hạn dữ liệu riêng theo chính sách của sản phẩm.

## Các command

- `building.save`, `building.delete`
- `room.save`, `room.delete`
- `listing.save`, `listing.hide`, `listing.moderate`
- `tenancy.assign`, `tenancy.end`
- `request.create`, `request.respond`, `request.confirm`, `request.cancel`
- `appointment.create`, `appointment.respond`
- `conversation.start`, `message.send`
- `invoice.save`, `invoice.cancel`
- `payment.notify`, `payment.confirm`
- `favorite.toggle`
- `ticket.create`, `ticket.respond`
- `profile.save`, `user.toggle`, `settings.save`

Payload và điều kiện tham chiếu `domain/commands.ts`. Ví dụ:

```json
{
  "type": "invoice.save",
  "payload": {
    "roomId": "room-id",
    "period": "2026-11",
    "newElectricity": 1573,
    "newWater": 125.5,
    "electricityPhoto": "private-object-reference",
    "waterPhoto": "private-object-reference",
    "dueDate": "2026-12-05",
    "issue": true
  }
}
```

Server lấy chỉ số cũ, đơn giá, người thuê và ngân hàng từ dữ liệu có quyền truy cập. Khi chuyển sang ảnh cloud, bổ sung upload adapter; không gửi Base64 lớn trong snapshot lâu dài. Khi muốn REST theo tài nguyên, thay HTTP adapter mà giữ nguyên các màn hình và tính toán trình bày.
