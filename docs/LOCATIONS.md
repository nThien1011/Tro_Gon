# Chọn khu vực và lưu địa chỉ

Form tòa nhà và trang tìm phòng dùng chung `components/LocationSelects.tsx`.

- Chọn tỉnh/thành phố trước, sau đó quận/huyện, rồi phường/xã.
- Đổi cấp trên sẽ xóa các lựa chọn cấp dưới, kể cả khi nơi khác có phường cùng tên.
- Khi tìm phòng có thể dừng ở tỉnh hoặc quận để xem toàn bộ phòng thuộc khu vực đó.
- Tòa nhà mới cần đủ ba cấp, ngoại trừ huyện không có cấp phường/xã trong danh mục. Địa chỉ riêng chỉ nhập số nhà và đường.
- Không yêu cầu tọa độ; không tự gán tọa độ trung tâm thành phố cho tòa nhà. Chức năng bản đồ và định vị đã được gỡ khỏi trang tìm phòng theo yêu cầu.

## Danh mục

`src/data/locations.json` là bản rút gọn từ [vietnamese-provinces-database v2.3.0](https://github.com/thanglequoc/vietnamese-provinces-database/releases/tag/v2.3.0), revision `e3e9c320e0f75eebb5c9b4725227e628b095e310`, phát hành 11/01/2025. Giữ giấy phép MIT ở `src/data/locations.LICENSE.txt`.

Đây là **danh mục ba cấp cũ**, dùng cho cách tìm theo địa danh quen thuộc mà sản phẩm yêu cầu, ví dụ Đà Nẵng → Ngũ Hành Sơn → Hoà Hải. Không giới thiệu đây là danh mục hành chính hiện hành và không dùng cho thủ tục pháp lý. Khi bổ sung địa chỉ hành chính hiện hành, cần giữ riêng alias địa danh cũ để người dùng vẫn tìm được; không ghi đè lịch sử địa chỉ.

Danh mục đóng gói sẵn nên các ô chọn không phụ thuộc kết nối mạng hoặc API ngoài khi sử dụng. Tái tạo từ cùng revision bằng `node scripts/update-locations.mjs`; đổi nguồn/revision cần kiểm tra mã và quan hệ cha-con trước khi phát hành.

## Dữ liệu và tương thích

Tòa nhà mới có `cityCode`, `districtCode`, `wardCode` cùng tên hiển thị `city`, `district`, `ward`. Command `building.save` kiểm tra mã phường thực sự thuộc quận và quận thuộc thành phố; không tin tên gửi từ form. `area` giữ tên quận để tương thích snapshot cũ; đây khác với `Room.area` là diện tích m².

Tòa nhà IndexedDB cũ chưa có mã được nhận diện từ tên `city` và `area` khi đọc/lọc. Không xóa dữ liệu hoặc đoán phường. Tòa nhà chưa có thông tin phường vẫn xuất hiện khi tìm cấp thành phố hoặc quận; chỉ xuất hiện ở bộ lọc phường sau khi chủ trọ bổ sung đúng phường. Các địa danh tự nhập không khớp danh mục vẫn xem được và có thể chọn lại khi sửa.

`lat`, `lng` là tùy chọn phục vụ tích hợp bản đồ sau này. Sửa địa chỉ/khu vực sẽ xóa tọa độ cũ. Backend hiện kiểm tra quan hệ mã khu vực trước khi lưu MySQL và không bắt buộc tọa độ.
