# TrọGọn

Frontend cho nền tảng kết nối người thuê và chủ trọ, gồm guest và ba vai trò tài khoản: admin, chủ trọ, người thuê. Giao diện tiếng Việt, responsive, chia màn hình theo nghiệp vụ và tải từng nhóm tính năng khi cần.

## Trạng thái sản phẩm

Đây là **frontend có các luồng hoạt động và dữ liệu IndexedDB**, chưa phải hệ thống nhiều người dùng trên máy chủ. Dữ liệu có thể tồn tại sau khi tải lại trên cùng trình duyệt, nhưng không đồng bộ giữa thiết bị. Không dùng tài khoản hoặc dữ liệu nhạy cảm thật trong chế độ local. Phân quyền client giúp kiểm tra nghiệp vụ, không phải ranh giới bảo mật production.

`trogon-preorder` bên cạnh là công việc khảo sát cũ đã tạm dừng. Dự án hiện tại độc lập tại `trogon-platform`.

## Chạy dự án

Cần Node.js 22.13 trở lên và npm.

```sh
npm install
npm run dev
```

Nếu các dependencies đã có nhưng máy chỉ có Node, dùng PowerShell:

```powershell
.\scripts\dev.ps1
```

```sh
npm test
npm run build
npm run preview
```

Mở URL được Vite in ra. Định tuyến dạng `#/...` cho phép reload và mở trực tiếp trên hosting tĩnh.

## Tài khoản mẫu

| Vai trò    | Email                 | Mật khẩu dữ liệu khởi tạo |
| ---------- | --------------------- | ------------------------- |
| Admin      | admin@trogon.demo     | TroGon@2026               |
| Chủ trọ    | chutro@trogon.demo    | TroGon@2026               |
| Người thuê | nguoithue@trogon.demo | TroGon@2026               |

Trang đăng nhập có nút vào từng vai trò. Sidebar có lựa chọn đổi vai trò mẫu để kiểm tra hai phía. Có thể tự đăng ký chủ trọ hoặc người thuê bằng email, số điện thoại hoặc cả hai. Không tự đăng ký admin. Người thuê mẫu đang ở P201; dùng tài khoản người thuê mới để kiểm tra thêm vào phòng hoặc xác nhận thuê mới.

## Các chức năng đã có

- Guest: tìm theo thành phố/khu vực/tên đường, lọc ngân sách, diện tích, tiện ích; sắp xếp, xem bản đồ và tìm gần vị trí có cấp quyền; xem ảnh, mô tả, giá và phí.
- Tài khoản: đăng ký, đăng nhập bằng email hoặc điện thoại, kiểm tra trùng, cập nhật hồ sơ, đổi mật khẩu thử nghiệm. Mật khẩu được băm PBKDF2 với salt riêng trong local repository; đây không thay thế máy chủ xác thực.
- Chủ trọ: CRUD tòa nhà và phòng; đặt giá, phí, sức chứa, chỉ số gốc, hình ảnh và tiện ích; soạn tin nháp và gửi duyệt; thêm người thuê đã đăng ký bằng liên hệ; kết thúc thuê sau đối chiếu hóa đơn.
- Người thuê: lưu phòng, nhắn tin, đặt lịch xem, gửi/hủy yêu cầu thuê và xác nhận sau khi chủ trọ chấp thuận; xem phòng đang ở, kỳ thuê, chi phí và hóa đơn; gửi báo đã trả; gửi sửa chữa hoặc báo cáo.
- Admin: duyệt/gỡ tin kèm lý do, khóa/mở khóa tài khoản, xem tòa nhà và phòng, hóa đơn, xử lý báo cáo, cấu hình đơn giá mặc định và xem/xuất nhật ký.
- Hóa đơn: OCR ảnh điện/nước thật bằng Tesseract.js trong trình duyệt; gợi ý số và độ tin cậy; xác nhận số, tự tính chênh lệch và tiền; lưu nháp, phát hành, hủy khi được phép, giữ snapshot giá, tạo QR nếu có ngân hàng, tách thông báo trả tiền khỏi xác nhận đã thu.
- Tin nhắn và các thao tác liên quan chia sẻ cùng IndexedDB; BroadcastChannel cập nhật dữ liệu giữa các tab cùng origin. Chuyển vai trò mẫu để trả lời từ phía bên kia.

## Cấu trúc

```text
src/
  app/                 # provider, router và phân phối màn hình theo vai trò
  components/          # layout và UI dùng chung
  config/app.ts        # cấu hình, tiện ích, thành phố và tài khoản mẫu
  domain/
    models.ts          # kiểu dữ liệu nghiệp vụ
    commands.ts        # quy tắc thay đổi dữ liệu và kiểm tra quyền
    billing.ts         # phép tính hóa đơn và phân tích kết quả OCR
    selectors.ts       # phạm vi phòng theo vai trò
    seed.ts            # dữ liệu minh họa, không phải phòng thật
  features/
    explore/           # tìm phòng, chi tiết, bản đồ
    auth/              # đăng nhập, đăng ký
    dashboard/         # tổng quan theo vai trò
    owner/             # tòa nhà, phòng, tin đăng và người ở
    tenant/            # không gian phòng đang thuê
    billing/           # OCR, biên soạn và xem hóa đơn
    rental/            # lịch xem và yêu cầu thuê
    messaging/         # hội thoại
    support/           # sửa chữa, báo cáo, phản hồi
    account/           # thông tin tài khoản và ngân hàng
    admin/             # người dùng, cấu hình, nhật ký
    info/              # hướng dẫn và thông tin riêng tư
  services/
    client.ts          # hợp đồng AppClient, adapter local và HTTP
    repository.ts      # IndexedDB, cập nhật nguyên tử, subscribe
    ocr.ts             # Tesseract và vòng đời worker
    media.ts           # kiểm tra và nén ảnh
    qr.ts              # EMV VietQR và CRC
  lib/                 # format, khoảng cách, password hash
  styles/              # global, public và workspace
tests/                 # kiểm thử quy tắc tiền, quyền và trạng thái
docs/                  # kiến trúc, API contract và kiểm thử
public/images/         # ảnh minh họa đã tải về
```

Không đặt logic tính tiền vào JSX. Mọi thay đổi nghiệp vụ đi qua `AppClient.execute`, rồi `domain/commands.ts` ở local hoặc máy chủ khi tích hợp. `services/media.ts`, `ocr.ts` và `qr.ts` là điểm thay thế dịch vụ độc lập.

## Cấu hình

Sao chép `.env.example` thành `.env.local`:

```ini
VITE_DATA_SOURCE=local
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_DEMO_ENABLED=true
```

Đổi `VITE_DATA_SOURCE=api` khi backend triển khai đúng hợp đồng trong `docs/API.md`. Các biến `VITE_*` được đưa vào mã trình duyệt; không đặt API key bí mật ở đây. Sau khi đổi env cần restart dev hoặc build lại.

`src/config/app.ts` quản lý giới hạn ảnh và tiện ích. Admin thay đổi đơn giá gợi ý cho phòng mới; chủ trọ tự cấu hình đơn giá thực tế cho từng phòng. Đơn giá này không phải tư vấn về mức thu điện nước. Thành phố/khu vực trong seed là dữ liệu minh họa và cần thay bằng danh mục chính thức khi đưa vào hoạt động.

## OCR và tiền

Tesseract tải bộ nhận dạng trong lần đầu, cần internet. Ảnh rõ và chụp sát vùng số sẽ cho kết quả tốt hơn. OCR là gợi ý có thể sai, đặc biệt đồng hồ kim, chữ số màu hoặc dấu thập phân. Hệ thống yêu cầu kiểm tra trước khi phát hành và cho phép sửa tay. Không giả lập chỉ số khi nhận dạng thất bại.

Tiền điện = (số mới - số cũ) × đơn giá. Tiền nước tính tương tự. Tổng = tiền thuê + điện + nước + phí cố định. Tiền làm tròn đến VND. Bản hiện tại lập hóa đơn trọn tháng; chia tiền ngày vào/ra, nhiều lần trả, sổ cọc/hoàn cọc và thay đồng hồ cần backend cùng quy trình chi tiết ở đợt kế tiếp. Chỉ số giảm bị chặn thay vì tự tính sai.

Không có cổng thanh toán hoặc đối soát ngân hàng. Nút Tôi đã thanh toán chỉ gửi thông báo. QR cần chủ trọ cấu hình tài khoản ngân hàng trước khi phát hành; tài khoản mẫu không cài sẵn số nhận tiền thật.

## Kiểm thử và bảo trì

Xem `docs/TESTING.md` và `docs/ARCHITECTURE.md`. Thay đổi quy tắc tính tiền, trạng thái thuê hoặc quyền cần bổ sung test tương ứng. Không xóa IndexedDB để xử lý lỗi mà chưa xuất dữ liệu cần giữ. Muốn khởi tạo lại dữ liệu mẫu, xóa dữ liệu của origin trong công cụ trình duyệt; việc này xóa toàn bộ dữ liệu thử của origin đó.

## Ảnh và thư viện

Ảnh nội thất minh họa từ Unsplash, lưu local để trang không phụ thuộc máy chủ ảnh khi xem. Các ID ảnh gốc: `1522708323590-d24dbb6b0267`, `1502672260266-1c1ef2d93688`, `1493809842364-78817add7ffb`, `1484154218962-a197022b5858`, `1560448204-e02f11c3d0e2`. Bản đồ Leaflet dùng ô bản đồ OpenStreetMap và có attribution. OCR: https://github.com/naptha/tesseract.js. Build: https://vite.dev/guide/static-deploy.html.
