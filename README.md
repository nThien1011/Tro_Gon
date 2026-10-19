# TrọGọn

Nền tảng kết nối người thuê và chủ trọ, gồm guest và ba vai trò: admin, chủ trọ, người thuê. Frontend React + TypeScript; backend Node.js + Fastify + TypeScript; database MySQL 8. Ảnh lưu riêng và được kiểm tra quyền khi đọc.

## Chạy localhost trên máy này

```powershell
cd D:\EXE101\trogon-platform
.\scripts\start.ps1
```

Hoặc `npm run dev:full`. Mở http://127.0.0.1:5173. API chạy cổng 8080, Vite chuyển tiếp `/api` cùng origin. Ctrl+C dừng cả hai. Nhật ký API ở `outputs/api.log`. MySQL service phải đang chạy.

`server/.env` chứa kết nối riêng của máy, không đưa lên Git hoặc chia sẻ. Runtime account local chỉ có quyền đọc/ghi database TrọGọn. `server/.env.test` chứa tài khoản riêng cho các database kiểm thử.

## Tài khoản mẫu local

Mật khẩu chung: `TroGon@2026`.

| Vai trò    | Email                 |
| ---------- | --------------------- |
| Admin      | admin@trogon.demo     |
| Chủ trọ    | chutro@trogon.demo    |
| Người thuê | nguoithue@trogon.demo |

Tài khoản đăng nhập qua API và được lưu trong MySQL. Không có nút đổi vai trò ở chế độ API. Production từ chối database có marker chứa dữ liệu demo.

Máy local đang dùng `MAIL_TRANSPORT=file` để thử xác minh/reset mà không gửi thư thật. Mã nằm trong `server/storage/outbox/<challengeId>.json`, chỉ người có quyền truy cập máy đọc được. Khi deploy cần SMTP/SMS thật; production không cho dùng chế độ file.

## Cài máy mới

Cần Node.js 24 LTS (tối thiểu 22.13), npm và MySQL 8.0.16+.

```sh
npm ci
npm ci --prefix server
```

1. Sao chép `.env.example` thành `.env.local`; giữ data source `api` và base URL `/api/v1`.
2. Sao chép `server/.env.example` thành `server/.env`, điền kết nối tới database **riêng cho TrọGọn**. Lần đầu dùng tài khoản có quyền tạo database và bảng. Migration từ chối database có bảng không thuộc dự án.
3. Chạy `npm run db:migrate`. Với database sạch, đặt BOOTSTRAP_ADMIN_EMAIL/PASSWORD trước khi migrate để tạo admin. Với bản thử local, `npm run db:seed` chỉ chạy khi chưa có người dùng.
4. Có thể chạy `node server/node_modules/tsx/dist/cli.mjs server/src/cli.ts provision-local` bằng kết nối quản trị localhost để tạo tài khoản ứng dụng và kiểm thử riêng; chương trình không sửa tài khoản MySQL đã tồn tại.
5. Chạy `npm run dev:full`.

IndexedDB cũ vẫn giữ nguyên, không tự nhập vào MySQL. Muốn xuất/đối chiếu dữ liệu cũ có thể mở lại với `VITE_DATA_SOURCE=local`; không dùng chế độ này cho production.

## Chức năng

- Guest tìm phòng qua tỉnh/thành → quận/huyện → phường/xã, ngân sách, diện tích, tiện ích; xem ảnh và phí.
- Đăng ký email/điện thoại, cookie HttpOnly, cập nhật hồ sơ, đổi mật khẩu, xác minh và khôi phục tài khoản bằng mã dùng một lần. Không tự đăng ký admin.
- Chủ trọ quản lý tòa nhà/phòng, chỉ số, giá, ảnh và tin đăng; thêm người thuê đã đăng ký; bàn giao sau khi đối chiếu khoản thu.
- Người thuê lưu phòng, nhắn tin, đặt lịch, gửi yêu cầu thuê; xác nhận sau khi chủ trọ chấp thuận; xem phòng/hóa đơn, báo đã thanh toán và gửi sửa chữa.
- Admin duyệt/gỡ tin, khóa/mở tài khoản và thu hồi phiên, xử lý báo cáo, cấu hình và nhật ký.
- OCR thật bằng Tesseract trong trình duyệt; người dùng kiểm tra chỉ số. **Server tính lại hóa đơn từ số cũ và giá trong MySQL**, giữ snapshot đơn giá/người thuê/ngân hàng. Phát hành, lưu nháp, hủy có kiểm tra; chủ trọ xác nhận tiền hoặc phản hồi chưa nhận được.
- Ảnh đồng hồ bảo vệ theo tài khoản/tài nguyên. QR VietQR không tự thực hiện chuyển tiền.
- Chuông thông báo theo người nhận, chưa đọc/đã đọc lưu ở MySQL; mở đúng nội dung liên quan.
- Điện và nước chọn độc lập theo đồng hồ hoặc cố định/tháng. Hai bên gửi ảnh và cùng xem kết quả theo kỳ; người thuê gửi cần chủ trọ duyệt. Xem [hướng dẫn thông báo & điện nước](docs/NOTIFICATIONS_AND_METERS.md).
- Giao diện kiểm tra phiên và phiên bản dữ liệu mỗi 5 giây khi tab hoạt động, cập nhật dữ liệu giữa thiết bị qua API.

## Thư mục

```text
src/
  app/                  provider, router và phân phối màn hình
  components/           UI chung và bộ chọn khu vực
  features/             auth, explore, owner, tenant, billing, admin...
  domain/               model, tính tiền và quy tắc dùng chung
  config/, data/        cấu hình và danh mục khu vực
  services/             HTTP client, OCR, ảnh, QR; IndexedDB tùy chọn
  styles/               giao diện public và tài khoản
server/
  migrations/           SQL có checksum, không sửa file đã áp dụng
  src/
    app.ts, index.ts     HTTP app và vòng đời dịch vụ
    auth/               mật khẩu, phiên, mã xác minh, chống dò đăng nhập
    db/                 pool, migration, repository, seed, provision local
    domain/             validate request và lọc snapshot theo quyền
    routes/             API tài khoản và nghiệp vụ
    media/              kiểm tra ảnh, lưu file và quyền truy cập
    http/               lỗi HTTP
  tests/                kiểm thử quyền và MySQL/HTTP
scripts/                chạy local và cập nhật danh mục
tests/                  domain, tính tiền và VietQR
deploy/                 Docker Compose, MySQL, Caddy HTTPS
.github/workflows/      CI
docs/                   kiến trúc, API, deploy và kiểm thử
```

## Kiểm tra và deploy

```sh
npm test
npm run test:server
npm run test:integration
npm run check:server
npm run build
```

Integration tạo database ngẫu nhiên `trogon_test_*`, rồi xóa đúng database bài test tạo. Dùng tài khoản trong `server/.env.test` hoặc môi trường CI; không dùng tài khoản production.

Xem [DEPLOYMENT.md](docs/DEPLOYMENT.md), [API.md](docs/API.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [TESTING.md](docs/TESTING.md) và [LOCATIONS.md](docs/LOCATIONS.md).

Nếu cần import thủ công bằng MySQL Workbench, dùng [database/trogon-schema.sql](database/trogon-schema.sql) và xem [hướng dẫn import](database/README.md). File chỉ chứa cấu trúc và cấu hình ban đầu; database localhost hiện tại đã được khởi tạo nên không cần import lại.

Khi cập nhật schema với tài khoản web chỉ có quyền đọc/ghi: tạo `server/.env.migrate.local` theo mẫu `server/.env.migrate.example`, rồi chạy `npm run db:migrate:local`. Tài khoản migration riêng không được dùng để chạy web.

`Dockerfile` đóng gói frontend/API. Docker Compose có MySQL, job migration, runtime account chỉ đọc/ghi, volume ảnh và HTTPS Caddy. Cần domain/server và SMTP/SMS của đơn vị triển khai cho các kênh xác minh thật.

Sao lưu local bằng `npm run db:backup`, cần mysqldump. SQL nén và ảnh nằm ở `server/backups/`; không chia sẻ hoặc đóng gói các bản sao riêng tư này vào source.

## Phạm vi

Hóa đơn tính trọn kỳ tháng, thanh toán đủ một lần. Chưa có tự đối soát ngân hàng, thu tiền trực tuyến, chia tiền theo ngày vào/ra, sổ cọc/hoàn cọc hoặc ký số hợp đồng. Không tự suy đoán số tiền cho các nghiệp vụ này.

OCR là gợi ý và yêu cầu kiểm tra lại. Chỉ số giảm bị chặn, cần xử lý thay đồng hồ trước. Danh mục ba cấp dùng địa danh quen thuộc theo yêu cầu, xem nguồn/phiên bản ở LOCATIONS.md. Ảnh nội thất minh họa từ Unsplash; dữ liệu khu vực MIT có giấy phép trong `src/data/locations.LICENSE.txt`.
