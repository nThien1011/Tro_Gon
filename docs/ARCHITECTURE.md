# Kiến trúc và mở rộng

## Luồng dữ liệu

```text
Màn hình feature
  -> useApp.execute / client auth
  -> AppClient
      -> Local: IndexedDB transaction -> domain command -> broadcast -> refresh
      -> API: HTTP credentials include -> backend -> snapshot đã lọc quyền
```

Provider giữ snapshot phục vụ render và người đang đăng nhập. Router chỉ chọn màn hình được phép theo vai trò. Domain command kiểm tra quyền cùng quy tắc rồi mới sửa dữ liệu. IndexedDB đọc và ghi trong cùng một transaction để serialize thay đổi giữa tab. Phiên local lưu ở sessionStorage theo tab, nên các tab có thể đăng nhập các vai trò mẫu khác nhau và dùng chung dữ liệu.

## Các bất biến

1. Người thuê không tạo tòa nhà, sửa phòng, duyệt tin hoặc xác nhận đã nhận tiền.
2. Chủ trọ chỉ thay đổi tài sản, yêu cầu và hóa đơn thuộc phạm vi của mình.
3. Một phòng có một hồ sơ thuê đang hiệu lực; một tài khoản có một phòng đang thuê trong bản này. Số người không vượt sức chứa.
4. Kích hoạt thuê cập nhật phòng, tin và các yêu cầu liên quan trong cùng transaction. Phòng đã thuê bị ẩn quảng cáo.
5. Chỉ số mới không thấp hơn chỉ số đã chốt. Giá trị số âm, NaN và kỳ thu sai bị từ chối.
6. Một phòng và kỳ chỉ có một hóa đơn chưa hủy. Phát hành cập nhật chỉ số và giữ đơn giá, số lượng, phí cùng thông tin nhận tiền.
7. Thông báo đã trả và xác nhận đã thu là hai thao tác khác nhau. Không hủy hóa đơn đã thu hoặc đang chờ xác nhận.
8. Chỉ hủy hóa đơn mới nhất chưa thu khi không có kỳ sau phụ thuộc, rồi khôi phục chỉ số. Không xóa phòng có lịch sử thuê/hóa đơn.

## Khi thêm chức năng

Thêm model trong `domain/models.ts`, command có kiểm tra đầu vào và quyền, test nghiệp vụ, màn hình dưới `features/<nghiep-vu>`, rồi thêm route và menu cho vai trò phù hợp. Các command có tên theo `module.action` để dễ tìm log và khoanh vùng lỗi. Có thể tách các nhánh command ra handler theo mô đun khi nhóm hoặc backend lớn hơn.

## Khi nối backend

Không chuyển snapshot toàn bộ IndexedDB sang client thật. Backend phải trả dữ liệu tối thiểu theo quyền. Password hash không bao giờ nằm trong snapshot API. Session phải dùng cookie HttpOnly, Secure, SameSite và có hết hạn; không tin actorId, role hoặc đơn giá do client gửi. Backend lấy người thao tác từ session, đọc quyền sở hữu từ database và tính lại tiền.

Các constraint phòng/kỳ và thuê trùng phải tồn tại ở database; transaction và idempotency cần bảo vệ các request đồng thời. Cần xác minh email hoặc điện thoại, reset mật khẩu, rate limit, audit append-only, storage riêng tư cho ảnh đồng hồ, signed URL, quyền đọc hội thoại và quy trình cọc/bàn giao. Tách môi trường demo và dữ liệu thật. OCR có thể chuyển sang service backend qua `services/ocr.ts`; khóa dịch vụ chỉ nằm ở server.

## Giới hạn chủ động

Mã hiện tại không triển khai server xác thực, SMS/email OTP, tự đối soát ngân hàng, ký số hợp đồng hoặc lưu trữ đám mây. Dữ liệu local có thể bị chỉnh bằng devtools và không phải cơ chế bảo mật production. Bản đồ và OCR cần mạng; tìm theo danh sách, nhập số và tính hóa đơn vẫn hoạt động khi các dịch vụ này không sẵn sàng.
