# Kiến trúc

```text
React → AppClient → /api/v1
  → cookie session + CSRF + validate
  → MySQL transaction → khóa app_state → domain command
  → kiểm tra/lưu ảnh → ghi dòng thay đổi + audit + idempotency → commit
  → snapshot đã lọc quyền → cập nhật UI
```

`src/domain/commands.ts` là quy tắc dùng chung; backend lấy actor từ session. Giá/chỉ số/người thuê được đọc lại từ MySQL, không tin payload invoice. `server/src/domain/snapshot.ts` lọc dữ liệu trước khi trả HTTP.

## Database

Mỗi tài nguyên có bảng riêng và foreign key, không lưu toàn bộ app thành JSON blob. JSON chỉ dùng cho danh sách tiện ích/ảnh và kết quả idempotency. Repository chỉ ghi các dòng đổi; INSERT mới không upsert theo unique email. Audit/message chỉ thêm qua repository. API trả tối đa 1.000 audit gần nhất nhưng lịch sử cũ vẫn giữ ở MySQL.

Database có UNIQUE cho email/điện thoại, tên phòng trong tòa nhà, tenancy active mỗi phòng/người thuê, invoice chưa hủy mỗi phòng/kỳ, yêu cầu thuê đang mở và hội thoại theo tin/người thuê. Các generated index xử lý uniqueness theo trạng thái.

## Cạnh tranh

MVP dùng khóa dòng app_state để tuần tự hóa thay đổi. Các constraint vẫn bảo vệ khi có request đồng thời. Idempotency-Key gắn người dùng/payload; kết quả và thay đổi commit cùng transaction, payload khác dùng lại key bị từ chối. Client thử lại một lần khi lỗi mạng với cùng key.

Đây là lựa chọn ưu tiên tính đúng ở quy mô nhỏ. Khi mở rộng, thay snapshot toàn bộ bằng API phân trang/query có scope SQL và khóa theo phòng/hóa đơn. Chưa coi test chức năng là đo tải hoặc chứng nhận chịu tải lớn.

## Xác thực

- Scrypt với salt riêng, không đưa credentials ra HTTP.
- Session token 256 bit trong cookie HttpOnly/SameSite=Lax; MySQL chỉ giữ hash và hạn dùng. Production dùng Secure/prefix __Host-.
- CSRF kiểm tra cookie/token header và Origin/Sec-Fetch-Site. Dùng cùng origin, không mở CORS tùy ý.
- Đổi/reset mật khẩu hoặc khóa tài khoản thu hồi phiên. Chỉ tin địa chỉ proxy khai báo cụ thể.
- Rate limit IP và giới hạn đăng nhập sai theo liên hệ trong MySQL.
- Mã xác minh/reset chỉ lưu hash, hết hạn 10 phút, tối đa 5 lần sai, một lần dùng.
- Guest chỉ có tin/room công khai của chủ trọ đang hoạt động. Tenant chỉ có hoạt động/hóa đơn của mình. Owner chỉ quản lý dữ liệu liên quan tài sản của mình và xem dữ liệu công khai. Bank không có trong public profile, invoice giữ snapshot đúng kỳ.

## Ảnh

Frontend nén trước upload. Server kiểm tra nội dung thật bằng Sharp, giới hạn byte/pixel/thời gian, bỏ metadata và lưu WebP/UUID ngoài thư mục public. MySQL giữ URL/metadata. GET media kiểm tra quyền; biết URL không đủ để đọc ảnh đồng hồ. Lỗi transaction dọn file vừa tạo, không tự xóa ảnh lịch sử.

Khi chạy nhiều máy API cần volume chung hoặc adapter object storage. Bổ sung quota tài khoản và quy trình dọn orphan theo metadata khi mở rộng; không xóa storage để xử lý lỗi.

## Thêm chức năng

Thêm model/command và quy tắc domain; tạo migration mới; khai báo field mapping ở repository; cập nhật scope snapshot, UI và test. Không sửa migration đã áp dụng vì có checksum. Các thay đổi tính tiền/trạng thái thuê cần kiểm thử database và quyền, không chỉ giao diện.
