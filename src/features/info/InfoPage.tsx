import { PageTitle } from "../../components/ui";
import { appConfig } from "../../config/app";
export default function InfoPage({ page }: { page: string }) {
  return (
    <main className="container prose-page">
      <PageTitle
        title={
          page === "/privacy"
            ? "Quyền riêng tư"
            : page === "/guide"
              ? "Sử dụng TrọGọn"
              : "Một nơi ở, nhiều kết nối"
        }
      />
      {page === "/privacy" ? (
        <>
          <h2>Dữ liệu được lưu ở đâu</h2>
          <p>
            {appConfig.dataSource === "local"
              ? "Trong chế độ thử cục bộ, dữ liệu được lưu bằng IndexedDB trên trình duyệt này và không đồng bộ sang thiết bị khác."
              : "Thông tin tài khoản, phòng, tin đăng, hóa đơn và cuộc trò chuyện được lưu trên máy chủ. Ảnh được lưu riêng và chỉ được truy cập theo quyền của người dùng."}
          </p>
          <h2>Tài khoản và bảo mật</h2>
          <p>
            {appConfig.dataSource === "local"
              ? "Chế độ cục bộ phục vụ thử nghiệm, không thay thế xác thực và phân quyền máy chủ."
              : "Mật khẩu được băm trước khi lưu. Phiên đăng nhập dùng cookie HttpOnly. Chủ trọ chỉ quản lý tài sản của mình; người thuê chỉ xem hồ sơ, hóa đơn và hội thoại liên quan."}
          </p>
          <h2>Ảnh và vị trí</h2>
          <p>
            Ảnh đồng hồ được xử lý trên trình duyệt bằng Tesseract. Mô hình OCR
            có thể được tải từ CDN trong lần đầu. Tìm phòng bằng cách chọn
            tỉnh/thành phố, quận/huyện và phường/xã; không cần cấp quyền định
            vị.
          </p>
          <h2>Kiểm soát dữ liệu</h2>
          <p>
            Bạn có thể cập nhật hồ sơ, đổi mật khẩu và xác minh thông tin liên
            hệ trong Tài khoản. Thay đổi mật khẩu thu hồi các phiên cũ. Liên hệ
            quản trị viên khi cần xử lý hoặc xóa thông tin đã lưu; dữ liệu hóa
            đơn và lịch sử thuê cần được đối chiếu trước khi xử lý.
          </p>
        </>
      ) : page === "/guide" ? (
        <>
          <h2>Khách và người tìm thuê</h2>
          <p>
            Chọn tỉnh/thành phố, rồi thu hẹp theo quận/huyện và phường/xã trên
            trang Khám phá phòng. Có thể kết hợp ngân sách, tiện ích và tên
            đường. Đăng nhập tài khoản người thuê để lưu phòng, nhắn tin, đặt
            lịch hoặc gửi yêu cầu thuê.
          </p>
          <h2>Người thuê đang ở</h2>
          <p>
            Mở Phòng của tôi để xem thông tin thuê. Trong Hóa đơn, kiểm tra chỉ
            số, ảnh và phí. Nút Tôi đã thanh toán chỉ gửi thông báo; chủ trọ cần
            xác nhận sau khi nhận tiền. Gửi sửa chữa tại Hỗ trợ & sửa chữa.
          </p>
          <h2>Chủ trọ</h2>
          <p>
            Thêm tòa nhà, tạo phòng và khai báo giá điện nước cùng chỉ số ban
            đầu. Tạo tin từ phòng trống rồi gửi admin duyệt. Trong Người ở, nhập
            email hoặc số điện thoại người thuê đã đăng ký để thêm vào phòng.
            Phòng có người thuê sẽ ngừng quảng cáo.
          </p>
          <h2>Chốt điện nước</h2>
          <p>
            Chọn phòng đang thuê, kỳ thu và tải ảnh đồng hồ. Hệ thống gợi ý chỉ
            số qua OCR; kiểm tra lại phần số hiển thị trên ảnh, đặc biệt chữ số
            thập phân. Tổng tiền được tính từ tiền thuê, phí dịch vụ và chênh
            lệch chỉ số nhân đơn giá. Lưu nháp hoặc xác nhận phát hành. Không
            sửa trực tiếp hóa đơn đã phát hành.
          </p>
          <h2>Admin</h2>
          <p>
            Duyệt hoặc từ chối tin có lý do; khóa tài khoản vi phạm; xử lý báo
            cáo và cập nhật cấu hình gợi ý. Nhật ký ghi lại những thao tác thay
            đổi dữ liệu.
          </p>
          {appConfig.dataSource === "local" && (
            <>
              <h2>Tài khoản mẫu</h2>
              <p>
                Mở trang Đăng nhập và chọn vai trò mẫu. Email:
                admin@trogon.demo, chutro@trogon.demo hoặc
                nguoithue@trogon.demo. Mật khẩu chung cho dữ liệu khởi tạo:{" "}
                {appConfig.demoPassword}. Dữ liệu và liên hệ trên các phòng mẫu
                chỉ dùng minh họa.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <h2>TrọGọn kết nối người thuê và chủ trọ</h2>
          <p>
            Khám phá phòng theo khu vực, trao đổi trước khi xem và theo dõi việc
            thuê trong cùng một không gian. Chủ trọ có nơi quản lý phòng, người
            ở và hóa đơn; người thuê có nơi xem các thông tin liên quan đến
            mình.
          </p>
          <h2>Quản lý cùng một hệ thống</h2>
          <p>
            Từ đăng tin, trao đổi, xác nhận thuê đến theo dõi điện nước và hóa
            đơn, các bước được liên kết với tài khoản của bạn. Xem hướng dẫn sử
            dụng để biết cách tạo phòng, theo dõi khoản thu và gửi yêu cầu hỗ
            trợ.
          </p>
          <a className="btn primary" href="#/">
            Khám phá TrọGọn
          </a>
        </>
      )}
    </main>
  );
}
