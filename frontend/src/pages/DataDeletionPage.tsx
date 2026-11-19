/**
 * Trang công khai (không cần đăng nhập) hướng dẫn khách yêu cầu xoá dữ liệu. Dùng làm "URL hướng dẫn xoá dữ liệu" khi khai ứng dụng Meta.
 * Nội dung về thời hạn và cách liên hệ cần pháp chế công ty duyệt trước khi dùng chính thức.
 */
export default function DataDeletionPage() {
  const muc = 'flex flex-col gap-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:leading-[1.7] [&_p]:text-body [&_li]:leading-[1.7] [&_li]:text-body';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 bg-surface px-6 py-10 max-sm:px-4">
      <header className="flex items-center gap-3">
        <img src="/logo.png" alt="BenThanh Tourist" width="48" height="48" className="rounded-xl" />
        <div>
          <p className="text-sm text-muted">BenThanh Tourist</p>
          <h1 className="text-2xl font-bold">Yêu cầu xoá dữ liệu cá nhân</h1>
        </div>
      </header>

      <section className={muc}>
        <h2>Dữ liệu chúng tôi lưu khi bạn nhắn tin</h2>
        <p>
          Khi bạn nhắn tin cho BenThanh Tourist qua Facebook Messenger, Zalo, website hoặc ứng dụng, chúng tôi lưu tên hiển thị, ảnh đại diện, nội dung tin nhắn (chữ, hình ảnh, tệp) và số điện thoại nếu bạn cung cấp.
          Dữ liệu này chỉ dùng để tư vấn tour và hỗ trợ đặt tour.
        </p>
      </section>

      <section className={muc}>
        <h2>Cách yêu cầu xoá dữ liệu của bạn</h2>
        <ol className="list-decimal pl-5">
          <li>Gọi tổng đài <strong>1900 6668</strong>, hoặc nhắn tin cho Fanpage BenThanh Tourist với nội dung "Yêu cầu xoá dữ liệu cá nhân".</li>
          <li>Cho chúng tôi biết tên bạn đang dùng trên Facebook hoặc Zalo, và số điện thoại bạn đã dùng khi trao đổi (nếu có) để xác nhận đúng người.</li>
          <li>Nhân viên sẽ xác nhận lại với bạn qua đúng kênh bạn đã nhắn.</li>
        </ol>
      </section>

      <section className={muc}>
        <h2>Chúng tôi xử lý như thế nào</h2>
        <p>
          Sau khi xác nhận đúng người, chúng tôi xoá hội thoại và thông tin cá nhân của bạn khỏi hệ thống tư vấn trong vòng <strong>30 ngày</strong> và thông báo lại cho bạn.
          Thông tin của đơn đặt tour đã hoàn tất có thể được giữ lại theo quy định pháp luật về kế toán, thuế.
        </p>
      </section>
    </main>
  );
}
