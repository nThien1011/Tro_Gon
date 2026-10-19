# Thông báo và điện/nước

## Sử dụng

- Chuông đầu trang mở thông báo riêng: số chưa đọc, lọc chưa đọc, đọc tất cả và mở nội dung liên quan. Trạng thái đọc lưu trong MySQL theo tài khoản. Tab hoạt động kiểm tra cập nhật mỗi 5 giây; chưa phải WebSocket/push khi đóng trình duyệt.
- Sửa phòng → chọn độc lập cách tính điện và nước: **Theo chỉ số đồng hồ** hoặc **Cố định mỗi tháng**. Tiền phòng và phí dịch vụ vẫn tính theo tháng. Khoản cố định thu theo phòng, không nhân số người.
- Mở **Phòng của tôi** hoặc **Hóa đơn & điện nước** → **Ảnh & chỉ số đồng hồ** → chọn phòng/kỳ chưa chốt → **Gửi ảnh đồng hồ**. Hai bên đều có thể chụp hoặc chọn ảnh.
- OCR đọc trên thiết bị bằng Tesseract. Khi ảnh có nhiều số hoặc không đọc được, khoanh đúng dãy số rồi đọc lại. Chỉ một kết quả khả dĩ mới được điền tự động; nhiều kết quả cần người dùng chọn hoặc nhập lại. Kiểm tra phần thập phân, đặc biệt các chữ số màu đỏ trên đồng hồ.
- Đối chiếu ảnh rồi xác nhận trước khi gửi. Ảnh đã nén, chỉ số gốc/mới, kỳ, người gửi, gợi ý OCR và trạng thái được lưu chung; hai bên cùng xem khi API cập nhật. OCR là gợi ý, không chứng thực chỉ số.
- Người thuê gửi → chờ chủ trọ xác nhận hoặc yêu cầu chụp lại kèm lý do. Chủ trọ gửi và xác nhận thì kết quả được chấp nhận, người thuê nhận thông báo. Bản xác nhận thay thế vẫn giữ bản trước trong lịch sử.
- Khi **Chốt điện nước**, chọn chỉ số đã xác nhận của đúng phòng/kỳ. Server lấy lại giá trị và ảnh từ bản đã xác nhận; không tin số tiền/đơn giá từ client. Có thể nhập số thủ công sau đối chiếu. Sau phát hành, người thuê nhận thông báo và xem hóa đơn.

## Tính tiền và bảo vệ dữ liệu

Theo đồng hồ: `số sử dụng = chỉ số mới − chỉ số cũ`; `tiền = làm tròn(số sử dụng × đơn giá)`.

Cố định: dùng mức VND/tháng của khoản đó, không yêu cầu số mới, không cập nhật chỉ số phòng. Ví dụ điện 91 kWh × 3.500 = 318.500đ; nước cố định 65.000đ/tháng không nhân số m³.

Hóa đơn giữ snapshot cách tính, giá, phí và chỉ số. Đổi phòng không đổi hóa đơn đã phát hành. Chặn số giảm, số gốc đã thay đổi, sai hồ sơ thuê/phòng/kỳ hoặc bản chưa duyệt. Chỉ phát hành hóa đơn mới cập nhật chỉ số gốc; gửi ảnh không tự cập nhật. Không tự xử lý thay/quay vòng đồng hồ hoặc chia phí theo ngày.

Thông báo gồm các yêu cầu thuê/lịch xem/tin nhắn/sửa chữa; tin chờ duyệt/kết quả duyệt; nhận/bàn giao phòng; thay đổi phòng/tòa nhà; ảnh/chỉ số; phát hành/hủy hóa đơn đã phát hành; phản hồi thanh toán và cập nhật tài khoản/cấu hình. Lưu/hủy nháp hóa đơn không báo người thuê.

Người thuê chỉ xem dữ liệu gắn hồ sơ thuê của mình, chủ trọ xem tài sản của mình; admin xem dữ liệu nghiệp vụ toàn hệ thống. Hộp thông báo của admin vẫn chỉ thuộc admin đó. Biết URL ảnh không đủ quyền đọc. Người thuê mới không được xem ảnh thuộc hồ sơ của người thuê cũ.

Migration 004 nạp một lần các việc đang chờ trên database đã tồn tại (tin chờ duyệt, hóa đơn chưa thu, yêu cầu thuê/sửa chữa/lịch xem đang mở); không dựng lại toàn bộ lịch sử thông báo cũ.

## Cập nhật database

Migration 003 thêm cấu hình rooms/invoices và bảng notifications/meter_readings; migration 004 khởi tạo hộp thông báo. Sau cập nhật có 24 bảng. Các migration cũ không sửa.

Khi tài khoản `server/.env` chỉ đọc/ghi: sao chép `server/.env.migrate.example` thành `server/.env.migrate.local`, điền tài khoản có quyền CREATE/ALTER trên database `trogon`, chạy `npm run db:migrate:local`, rồi khởi động lại API. File này không đưa lên Git/ZIP và không thay đổi tài khoản chạy web. Production dùng migration job theo `DEPLOYMENT.md`.

## Kiểm chứng

Đã thử nghiệp vụ/quyền/lưu ảnh bằng API trên MySQL riêng. Trên trình duyệt, ảnh kiểm tra `001573` sau khoanh vùng cho kết quả 1573, tin cậy OCR hiển thị 95%; chỉ số cũ 1482 → sử dụng 91 kWh. Đã gửi bằng người thuê và nhận/duyệt bằng chủ trọ trên giao diện.

Đây là ảnh tổng hợp, không phải tỷ lệ chính xác trên bộ ảnh đồng hồ thật. Chưa thử camera vật lý trên các điện thoại. Chưa tích hợp Gemini; không cần API key, không gửi ảnh tới API AI. Lần đầu cần mạng để tải worker/mô hình Tesseract.
