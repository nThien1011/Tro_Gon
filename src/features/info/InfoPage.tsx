import { PageTitle } from "../../components/ui";
import { appConfig } from "../../config/app";
export default function InfoPage({ page }: { page: string }) {
  return (
    <main className="container prose-page">
      <PageTitle
        title={
          page === "/privacy"
            ? "Quyền riêng tư trong bản trải nghiệm"
            : page === "/guide"
              ? "Sử dụng TrọGọn"
              : "Một nơi ở, nhiều kết nối"
        }
      />
      {page === "/privacy" ? (
        <>
          <h2>Dữ liệu được lưu ở đâu</h2>
          <p>
            Khi cấu hình ở chế độ local, thông tin tài khoản, tin đăng, ảnh, hóa
            đơn và cuộc trò chuyện được lưu bằng IndexedDB trên trình duyệt của
            thiết bị này. Thông tin không được đồng bộ sang thiết bị khác. Xóa
            dữ liệu trang web trong trình duyệt cũng sẽ xóa các thông tin đã
            lưu.
          </p>
          <h2>Tài khoản và bảo mật</h2>
          <p>
            Đây là bản frontend phục vụ trải nghiệm và phát triển. Phân quyền
            trên giao diện và lớp nghiệp vụ không thay thế bảo mật máy chủ. Chỉ
            dùng dữ liệu thử; không nhập mật khẩu, tài liệu hoặc thông tin tài
            chính nhạy cảm đang sử dụng thật.
          </p>
          <h2>Ảnh và vị trí</h2>
          <p>
            Ảnh đồng hồ được xử lý trên trình duyệt bằng Tesseract. Mô hình OCR
            có thể được tải từ CDN trong lần đầu. Bản đồ tải ô bản đồ từ
            OpenStreetMap. Vị trí chỉ được lấy sau khi bạn chọn Gần tôi và cấp
            quyền cho trình duyệt.
          </p>
          <h2>Kiểm soát dữ liệu</h2>
          <p>
            Bạn có thể đăng xuất, đổi mật khẩu thử nghiệm hoặc xóa dữ liệu của
            trang trong cài đặt trình duyệt. Khi chuyển sang backend, cần triển
            khai chính sách lưu giữ, yêu cầu xóa dữ liệu và xác minh email hoặc
            số điện thoại ở máy chủ.
          </p>
        </>
      ) : page === "/guide" ? (
        <>
          <h2>Khách và người tìm thuê</h2>
          <p>
            Chọn khu vực, thành phố và ngân sách trên trang Khám phá phòng. Dùng
            Gần tôi để sắp xếp theo khoảng cách; chọn biểu tượng bản đồ để xem
            vị trí. Đăng nhập tài khoản người thuê để lưu phòng, nhắn tin, đặt
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
          <h2>Tài khoản mẫu</h2>
          <p>
            Mở trang Đăng nhập và chọn vai trò mẫu. Email: admin@trogon.demo,
            chutro@trogon.demo hoặc nguoithue@trogon.demo. Mật khẩu chung cho dữ
            liệu khởi tạo: {appConfig.demoPassword}. Dữ liệu và liên hệ trên các
            phòng mẫu chỉ dùng minh họa.
          </p>
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
          <h2>Bản frontend cho phát triển</h2>
          <p>
            Ứng dụng hiện cung cấp các luồng tương tác bằng dữ liệu cục bộ, với
            lớp dịch vụ riêng để tích hợp API sau này. Phòng, ảnh và liên hệ mẫu
            không phải nguồn cung đang chào thuê thật. Xem hướng dẫn và chính
            sách riêng tư trước khi trải nghiệm.
          </p>
          <a className="btn primary" href="#/">
            Khám phá TrọGọn
          </a>
        </>
      )}
    </main>
  );
}
