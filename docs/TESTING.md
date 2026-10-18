# Kiểm tra TrọGọn

## Tự động

`npm test` kiểm tra tiền, số âm/chỉ số giảm, quyền người thuê/chủ trọ, thuê trùng, đồng bộ trạng thái phòng và tin, snapshot hóa đơn, trùng kỳ, trạng thái thanh toán, hủy kỳ mới nhất, quyền hội thoại, phòng có lịch sử và xử lý kết quả OCR không nhận dạng được.

`npm run build` kiểm tra TypeScript và bundle production. `npm audit` kiểm tra dependencies. Các bài test là kiểm tra domain ở local; không chứng minh an toàn máy chủ chưa triển khai.

## Kiểm tra thủ công

1. Guest lọc TP. Hồ Chí Minh, giá dưới 4 triệu, thêm tiện ích; đổi sắp xếp. Kết quả và số lượng phải đúng.
2. Mở bản đồ, thử Gần tôi nếu muốn cấp quyền. Từ chối quyền vẫn tìm được bằng khu vực.
3. Đăng ký tenant bằng email hoặc điện thoại; đăng ký trùng bị chặn. Refresh vẫn có dữ liệu.
4. Với tenant mới, lưu phòng, nhắn tin, đặt lịch, gửi yêu cầu. Đổi sang owner để trả lời/xác nhận/chấp thuận, rồi về tenant xác nhận thuê.
5. Owner tạo tòa nhà và phòng, tải ảnh, tạo tin. Admin duyệt, guest mới thấy. Phòng bảo trì hoặc đã thuê không hiện trong danh sách.
6. Owner thêm một tài khoản tenant chưa có phòng qua email/điện thoại. Thêm trùng hoặc vượt sức chứa bị chặn. Tenant thấy phòng và giá trong Phòng của tôi.
7. Owner chốt phòng đang thuê. Phòng P201 mẫu đã có hóa đơn kỳ hiện tại; chọn P203 hoặc kỳ tiếp theo để tạo mới.
8. Tải ảnh sát vùng số, quan sát tiến độ OCR; đối chiếu và sửa nếu cần. Kiểm tra công thức bằng số đơn giản. Lưu nháp rồi mở tiếp hoặc phát hành; phát hành lặp bị chặn.
9. Tenant báo đã thanh toán: hóa đơn chỉ thành pending. Owner kiểm tra rồi xác nhận: hóa đơn thành paid. Không hủy hóa đơn đã thu.
10. Đổi đơn giá phòng, xem hóa đơn cũ vẫn giữ đơn giá cũ. Hủy hóa đơn mới nhất chưa thu khôi phục chỉ số; hóa đơn có kỳ sau phụ thuộc không hủy được.
11. Tenant gửi sửa chữa, owner phản hồi; báo cáo nền tảng do admin xử lý. Người ngoài hội thoại không gửi tin được qua command.
12. Kiểm tra 360 px và desktop: menu, biểu mẫu, hộp thoại, bảng cuộn ngang có chủ đích. Thử phím Tab/Escape trong modal, thông báo lỗi và thao tác refresh.

Ảnh OCR tổng hợp dùng để kiểm tra kỹ thuật, không đại diện cho độ chính xác trên mọi đồng hồ thật. Cần bộ dữ liệu đồng hồ thực tế có sự đồng ý của người cung cấp trước khi đánh giá tỷ lệ nhận dạng.
