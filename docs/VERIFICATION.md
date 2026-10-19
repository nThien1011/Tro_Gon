# Kết quả kiểm tra localhost — 19/10/2026

- MySQL 8.0.46, database `trogon`, 24 bảng và 4 migration; runtime account riêng chỉ đọc/ghi, không dùng root. Đã sao lưu trước khi thêm chức năng thông báo/chỉ số.
- Frontend và API chạy ở 127.0.0.1:5173 / :8080. Đã kiểm tra đăng nhập chủ trọ, người thuê và admin bằng giao diện, đọc dữ liệu từ MySQL.
- TypeScript frontend/backend và build frontend đạt.
- File gộp `database/trogon-schema.sql` đã import thử trên database MySQL trống riêng: đủ 24 bảng, 4 migration khớp checksum, không có tài khoản người dùng. Bước import thử không ghi đè database đang chạy.
- Đã khởi động entrypoint Node ở production với database sạch riêng, bootstrap admin, phục vụ frontend đã build và đăng nhập bằng cookie __Host-/Secure/HttpOnly qua HTTP nội bộ mô phỏng phía sau reverse proxy. Chưa kiểm tra TLS tại edge.
- 32 test domain/tính tiền/VietQR/khu vực/thông báo/chỉ số đạt.
- 9 test scope dữ liệu, mật khẩu và cấu hình đạt.
- 14 kịch bản API với MySQL thật đạt (15 test tính cả nhóm), gồm cạnh tranh nhận phòng, uniqueness tại DB, idempotency, ảnh private, draft không lộ, tính lại tiền, thu tiền/bàn giao, khóa phiên, mã dùng một lần, đăng xuất, thêm người bằng số điện thoại, ảnh hai bên, duyệt và tính tiền hỗn hợp. Đã kiểm tra unique accepted ở DB, ảnh từ tenant được dùng trong hóa đơn owner và thông báo chỉ của người nhận.
- API integration dùng Fastify inject và cookie riêng cho từng vai trò; mỗi lần tạo database test riêng và dọn đúng database đó. Không phải kiểm thử tải hoặc thử nhiều thiết bị vật lý.
- Đã tạo backup SQL và khôi phục vào database test, xác nhận 5 users, 12 rooms, 1 invoice và 2 migrations của dữ liệu mẫu. Dữ liệu ứng dụng không bị ghi đè.
- Cấu hình deployment có bước kiểm tra YAML/port riêng/migration/volume/runtime account. Máy này chưa có Docker nên chưa build/chạy container, HTTPS Caddy hoặc pipeline GitHub Actions thực tế.

Local dùng hộp thư file để thử OTP, chưa gửi qua SMTP/SMS thật. Khi deploy cần cấu hình nhà cung cấp, domain, secrets, database sạch và persistent storage. Không đưa database demo hoặc tài khoản mẫu lên production; ứng dụng có chặn marker demo khi chạy production.

Các ảnh đồng hồ API đã thử quyền đọc/ghi, nhưng backup hiện tại chưa có ảnh người dùng tải lên vì database demo chỉ dùng ảnh minh họa public. Trước khi vận hành cần kiểm tra restore cả dữ liệu và ảnh thật ở staging.
