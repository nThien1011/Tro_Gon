# Triển khai

Bản mới chạy Node.js + MySQL, độc lập với bản Sites tĩnh trước đây. Đã chuẩn bị Dockerfile, Compose, Caddy HTTPS, job migration, volume ảnh/MySQL và CI. Chưa tự deploy lên Internet trong quá trình làm localhost.

## VPS với Docker Compose

Cần VPS có Docker/Compose, domain trỏ về IP máy chủ và cổng 80/443 mở. Không chép server/.env, .env.test, database demo hoặc node_modules từ Windows lên server.

1. Copy deploy/.env.example thành deploy/.env.
2. Điền DOMAIN; ba mật khẩu MySQL khác nhau; AUTH_SECRET ngẫu nhiên riêng; email và mật khẩu admin mới. APP_DB_PASSWORD và AUTH_SECRET cần tối thiểu 32 ký tự, có thể sinh bằng openssl rand -hex 32. APP_DB_PASSWORD chỉ chữ/số/_/-. Admin nên có ít nhất 16 ký tự.
3. Điền SMTP cho mã email. Với tài khoản chỉ dùng điện thoại cần SMS_WEBHOOK_URL/TOKEN của adapter nhà cung cấp; POST nhận to/code/purpose/message và Bearer token. Không dùng MAIL_TRANSPORT=file trong production.
4. Chạy trong thư mục deploy:

```sh
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail=100 api
```

MySQL healthy → job migrate/schema và admin bootstrap → API healthy → Caddy phục vụ HTTPS. Chỉ publish 80/443, không publish MySQL. API chạy user không phải root, filesystem read-only ngoài volume ảnh/tmp. Runtime MySQL chỉ đọc/ghi, migrator được thay schema trong database này.

Nếu subnet 172.29.45.0/24 bị trùng, sửa subnet, IP Caddy và TRUST_PROXY cùng nhau. Chỉ tin đúng proxy/CIDR, không tin mọi địa chỉ. APP_ORIGIN phải đúng HTTPS domain người dùng mở.

MySQL init chỉ chạy khi volume trống. Đổi env sau đó không tự đổi mật khẩu MySQL đã tồn tại. Cần rotate secrets và account đồng bộ; không xóa volume để xử lý mật khẩu/migration.

## Hosting Node khác

Build frontend bằng npm ci && npm run build. Cài API bằng npm ci --omit=dev --prefix server. Chạy migration bằng tài khoản quản trị schema, sau đó npm start --prefix server với runtime account. Backend phục vụ cả dist và /api/v1 trên cùng domain.

```ini
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
APP_ORIGIN=https://domain-cua-ban.vn
DB_HOST=mysql-host
DB_PORT=3306
DB_NAME=trogon
DB_USER=trogon_app
DB_PASSWORD=<secret-runtime>
AUTH_SECRET=<random-secret-at-least-32-characters>
DB_SSL=true
STORAGE_DIR=/persistent/media
```

DB_SSL=true xác minh certificate database cloud; Docker private network dùng false mặc định. Nếu không có persistent disk hoặc chạy nhiều máy, đổi adapter ảnh sang object storage/volume chung. Cookie Secure hoạt động khi proxy terminate HTTPS vì trình duyệt truy cập HTTPS.

## Dữ liệu và cập nhật

Tạo database production sạch, migrate và bootstrap admin. Không deploy DB local demo: runtime_config.demoData khiến production từ chối chạy; root MySQL và SEED_DEMO=true cũng bị chặn. Bootstrap không đổi password admin đã tồn tại.

Sao lưu trước update, kiểm tra staging, thêm migration mới thay vì sửa migration cũ. Chạy một job migration tại một thời điểm, sau đó thay API image và kiểm tra health. Khi cần chạy lại job Compose đã kết thúc, dùng up --force-recreate migrate rồi cập nhật api. Schema không tương thích cần kế hoạch rollback/restore riêng; không có rollback dữ liệu tự động.

IndexedDB cũ không tự nhập vào DB server. Giữ bản xuất để đối chiếu tài khoản/quyền sở hữu/hóa đơn trước khi nhập.

## Backup/restore

Local: npm run db:backup, cần mysqldump; có thể đặt MYSQLDUMP_BIN. Script truyền password qua environment của tiến trình, không đưa vào command line. Kết quả server/backups/<timestamp>/ gồm database.sql.gz và media/.

Kiểm tra file SQL vừa sao lưu: npm run db:verify-backup. Cần mysql client và tài khoản server/.env.test. Công cụ tạo database thử riêng, import SQL, kiểm tra các bảng nghiệp vụ/migration rồi chỉ xóa database thử vừa tạo; không ghi vào database ứng dụng.

Production: dùng mysqldump --single-transaction --no-tablespaces --skip-lock-tables --set-gtid-purged=OFF và sao lưu volume ảnh. Lưu bản sao ngoài server, mã hóa và kiểm tra restore ở DB thử độc lập. Không chỉ backup SQL vì ảnh nằm ngoài DB.

Restore vào database trống bằng tài khoản có quyền tạo bảng, nhập SQL rồi khôi phục media đúng UID của API. Kiểm tra migration checksum, số bản ghi, ảnh private, đăng nhập và hóa đơn; thu hồi session cũ trước khi chuyển lưu lượng. Không đè trực tiếp DB đang phát sinh dữ liệu mới khi chưa đối chiếu.

## Cần cấu hình khi deploy thật

Domain/VPS, database/secrets production, SMTP/SMS thật, persistent storage và backup ngoài máy. Không có tự chuyển tiền/đối soát ngân hàng. Các test local kiểm tra tính đúng nghiệp vụ, chưa thay thế đo tải lớn. Trước khi mở rộng nhiều tòa nhà/hội thoại, cần phân trang và query có scope như ARCHITECTURE.md.
