# File SQL để import

Database `trogon` trên máy hiện tại đã được khởi tạo. Không cần import lại để chạy localhost.

`trogon-schema.sql` là cấu trúc database MySQL 8 để khởi tạo trên máy khác. File tạo database `trogon`, 24 bảng, cấu hình ban đầu và lịch sử migration tương ứng. Không chứa dữ liệu phòng mẫu, tài khoản, mật khẩu hay phiên đăng nhập.

Trong MySQL Workbench: kết nối MySQL → **File → Open SQL Script** → chọn `trogon-schema.sql` → chạy toàn bộ script bằng nút tia sét → Refresh mục **Schemas**. Chỉ dùng với database mới dành riêng cho TrọGọn. Nếu đổi tên database, sửa cả hai dòng `CREATE DATABASE` và `USE`, đồng thời đổi `DB_NAME` trong `server/.env`.

Sau import, cấu hình `server/.env` theo `server/.env.example`. Backend vẫn sử dụng `server/migrations` để theo dõi những lần nâng cấp tiếp theo; không sửa các migration đã chạy.

- Môi trường phát triển: có thể chạy `npm run db:seed` một lần để tạo tài khoản/phòng mẫu trên database trống, sau khi đã cài dependencies ở thư mục gốc và `server`.
- Production: không nạp dữ liệu mẫu. Cấu hình `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`, rồi chạy `npm run db:migrate` để tạo admin theo hướng dẫn `docs/DEPLOYMENT.md`.

Cách khuyến nghị khi triển khai vẫn là `npm run db:migrate`; SQL gộp là lựa chọn dành cho người muốn import thủ công. Tạo lại file sau khi thêm migration bằng `node scripts/export-schema.mjs`.
