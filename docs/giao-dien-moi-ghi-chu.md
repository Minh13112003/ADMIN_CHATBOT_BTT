# Ghi chú triển khai giao diện mới

Nhánh làm việc: `giao-dien-moi`. Chưa commit hoặc push.

## Cách đối chiếu thiết kế

- Dùng nhãn chữ cùng màu cho trạng thái hội thoại, đơn và kết nối; tham khảo [GitHub Designer Checklist](https://github.com/github/annotation-toolkit/blob/main/checklists/designer-checklist.md) và [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Giữ nút thao tác chính ít nhất 44 px, có tên cho nút chỉ có biểu tượng, và có vòng focus; tham khảo [GitHub Designer Checklist](https://github.com/github/annotation-toolkit/blob/main/checklists/designer-checklist.md). Dự án yêu cầu 44 px dù WCAG cho phép vùng nhỏ hơn trong một số trường hợp.
- Đặt trạng thái đang tải, rỗng và lỗi ngay tại danh sách liên quan; tham khảo [Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/).
- Dùng được bằng bàn phím trong bảng Câu trả lời nhanh: Esc, mũi tên, Enter, Tab; tham khảo [GitHub Designer Checklist](https://github.com/github/annotation-toolkit/blob/main/checklists/designer-checklist.md).
- Giữ nội dung trong một khung cuộn khi màn hình hẹp, tránh tràn toàn trang; tham khảo mục Layout của [GitHub Designer Checklist](https://github.com/github/annotation-toolkit/blob/main/checklists/designer-checklist.md).
- Tôn trọng chế độ sáng/tối của hệ thống và giảm chuyển động, áp dụng lựa chọn ngay; tham khảo [Apple Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode).

Các danh sách tham khảo [awesome-ui-ux](https://github.com/designdetails-io/awesome-ui-ux), [awesome-design-systems](https://github.com/klaufel/awesome-design-systems), [awesome-ux-design-styles](https://github.com/anubhavsrivastava/awesome-ux-design-styles), và [awesome-styleguides](https://github.com/streamich/awesome-styleguides) được dùng để đối chiếu nguồn, không sao chép giao diện. Bố cục và nội dung sản phẩm theo các tài liệu Stitch trong repo.

## Các pha

1. Thanh bên sáng 248 px, điều hướng 10 mục theo vai trò, thanh tab điện thoại, màu nền và viền mới.
2. Khung hội thoại có dải cần làm, thao tác chốt tour, menu, hồ sơ 3 tab, bảng Câu trả lời nhanh có tìm kiếm, xem toàn văn và chèn vào con trỏ.
3. Thư viện trả lời có tạo, sửa, xoá mẫu; tạo, sửa, bật/tắt, xoá và thử quy tắc.
4. Trang Khách hàng và Quản trị tài khoản giữ dữ liệu thật; mẫu tạo tài khoản mở trong ngăn kéo, xác nhận khoá giải thích hậu quả.
5. Trang Đơn đặt tour với ba cột và API danh sách đơn; trang Lịch hẹn nhắc với nhóm thời gian, dời và hoàn thành qua API hiện có.
6. Giữ biểu đồ thống kê đã có; bổ sung hiệu suất sale và trạng thái/số liệu kênh. Zalo OA và Facebook chỉ hiển thị chưa kết nối.
7. Giữ cài đặt sáng/tối, màu nhấn, cỡ chữ, mật độ, giảm chuyển động; bổ sung thông tin tài khoản và các thao tác liên quan.

## Giới hạn kiểm tra

`pnpm typecheck`, `pnpm test` và `pnpm build` chạy được. Đã mở trang đang chạy ở `localhost:3002` trong Chrome, kiểm tra trực quan các trang Hội thoại, Khách hàng, Thư viện trả lời, Đơn đặt tour, Lịch hẹn nhắc, Hiệu suất sale, Kênh kết nối ở cửa sổ desktop 1366 px và kiểm tra Đơn đặt tour, Lịch hẹn nhắc bằng chế độ điện thoại 400 px. Chưa kiểm tra chính xác kích thước 1440 px và 390 px, chưa thử thao tác ghi với dữ liệu thật. Không chạy lệnh ghi dữ liệu giả trên Supabase.

## Đối chiếu Stitch MCP và Chrome

- Đã truy cập dự án Stitch `BenThanh Tourist Omnichannel Workspace` bằng MCP và xem các ảnh tham chiếu của Hội thoại, Khách hàng, Thư viện trả lời, Đơn đặt tour, Lịch hẹn nhắc, Thống kê, Hiệu suất sale, Kênh kết nối và Hội thoại mobile.
- Ảnh Stitch cũ có thanh bên đỏ; theo `docs/stitch/THANH-BEN-MOI.md`, giữ thanh bên sáng hiện tại. Tài khoản Chrome đang chọn màu nhấn xanh trong Cài đặt, nên nút và trạng thái được tô xanh theo lựa chọn của người dùng.
- Sau khi đối chiếu Chrome, bổ sung thanh tìm kiếm, tổng quan và cột rỗng cho Đơn đặt tour; tổng quan, lịch theo giờ và tạo lịch hẹn cho Lịch hẹn nhắc; thẻ chỉ số và doanh thu theo nhân viên cho Hiệu suất sale; thẻ trạng thái chi tiết cho Kênh kết nối; tổng quan và lọc nhanh cho Khách hàng; ẩn thanh cuộn thô trong bộ lọc Hội thoại.
