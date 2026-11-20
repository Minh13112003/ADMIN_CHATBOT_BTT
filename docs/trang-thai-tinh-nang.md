# Trạng thái tính năng

Đọc file này đầu mỗi phiên, cập nhật cuối mỗi việc. Chỉ đổi sang **Đã chạy thật** khi chủ dự án xác nhận đã thử trên VPS.

- **Đã chạy thật**: chủ dự án đã thử trên https://chatadmin.benthanhtourist.com và thấy đúng.
- **Chỉ test giả**: có test đơn vị / dữ liệu giả, chưa thử với hệ thống thật (Zalo, Facebook...).
- **Chưa làm**.

## Kho sticker (2026-11-19)

- Admin tải WebP tại `/stickers`, xem ảnh động và ẩn khỏi kho. Sale chỉ xem/chọn, quyền được kiểm tra ở backend.
- Bảng chọn nổi phía trên nút sticker trong khung chat: lưới 4 cột, tìm kiếm, gần đây theo tài khoản trên trình duyệt. Chọn chỉ xem trước; bấm Gửi mới tạo tin. Không tự gửi khi mở kho hoặc tải sticker lên.
- Giữ WebP để xem trong kho, chuyển GIF đủ khung hình để gửi. Zalo dùng upload/gif + media_type gif (kèm width/height); Messenger dùng attachment image với file GIF. Chưa kiểm thử gửi thật trên hai kênh.
- Migration mới: `20261119090627_sticker_library` (chỉ thêm bảng và chỉ mục). Đã chạy trên PostgreSQL thử; chưa chạy migration trên database thật từ phiên làm việc này.
- Kiểm tra trước đó: typecheck, 355 test backend + 2 test frontend, build, smoke riêng sticker đều qua. Smoke cũ dừng ở fixture tạo sale không có departmentId (không liên quan sticker).
- Website thật ngày 2026-11-19: đăng nhập được nhưng `GET /api/v1/stickers` trả 404; chưa thể nhập bộ sticker. Không gọi API gửi tin cho khách thật.
- Bộ người dùng cung cấp: 50 GIF tại `D:\Ami-Fat-Cat-Stickers`; tạo 50 WebP tại thư mục con `webp`, đối chiếu số khung hình từng file, giữ nguyên GIF gốc.
- Trạng thái: **Chỉ test giả**; giao diện cần triển khai bản mới. Bộ chọn dùng màu theo giao diện sáng/tối hiện có.
- 2026-11-20: kiểm tra lại website, đăng nhập được nhưng API sticker vẫn 404. Đã kiểm tra đủ 50 WebP trong thư mục `webp` giữ số khung hình như GIF gốc và đúng giới hạn. Đóng gói mã nguồn riêng tại `out/sticker-update-20261120.zip`; chưa nhập ảnh lên website và không gửi tin cho khách.

## Zalo OA

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Lưu thông tin kết nối (mã hoá), nút Thay đổi | Đã chạy thật | |
| Webhook nhận tin chữ của khách | Đã chạy thật | Chữ ký kiểm bằng OA Secret Key hoặc khoá ứng dụng |
| Kết nối OAuth, tự làm mới token | Đã chạy thật | Làm mới mỗi 5 phút khi còn dưới 20 phút |
| Nhân viên trả lời từ trang này sang Zalo | Đã chạy thật | Chưa gửi được ảnh/PDF sang Zalo |
| Tên và ảnh đại diện khách | Đã chạy thật | Cần migration `customer_avatar` |
| Nhập SĐT, bắt buộc SĐT khi chốt tour | Chỉ test giả | |
| Nhập khách cũ từ Zalo | Đã chạy thật | Lần đầu lỗi do thiếu migration |
| Tin OA gửi trên ứng dụng Zalo (`oa_send_*`) | Không nhận được | 2026-11-13: OA gửi ảnh, sticker từ trang Zalo OA, máy chủ không nhận sự kiện nào (log "Tin OA gửi" trống). Tin khách gửi vẫn tới. Đang chờ chủ dự án kiểm tra danh sách sự kiện webhook trên developers.zalo.me |
| Sticker/ảnh động khách gửi | Chỉ test giả | Sticker tới ngay qua webhook (2026-11-13) nhưng đứng yên: nay giữ khung hình WebP động, nhận GIF từ Zalo |
| Ảnh/PDF/sticker khách gửi qua webhook | Chỉ test giả | Tên trường `message.attachments[].payload.url` chưa kiểm chứng |
| Ảnh/sticker khi kéo tin cũ | Đã kiểm chứng định dạng | Log thật 2026-11-13: `photo` có `thumb,url,description`; `sticker` có `url`; `link` có `links`. `nosupport` và tin không có `type` KHÔNG kèm nội dung (tệp PDF, tin thoại...): không lấy được, chỉ ghi dòng báo |
| Trích dẫn (reply) tin cũ | Không làm được | API lịch sử Zalo không trả thông tin trích dẫn |
| Trích dẫn (reply) qua webhook, tin OA | Chỉ test giả | Tên trường (`quote_msg_id`, `quote`...) chưa kiểm chứng; log "trường lạ trong message" |
| Khách thả cảm xúc → log nội bộ | Chỉ test giả | Tên sự kiện chưa kiểm chứng; log "Bỏ qua sự kiện Zalo" |
| Chatbot AI tự trả lời Zalo | Chưa làm | Đã có hướng (webhook gọi chatbot), chờ chủ dự án quyết |
| Xin SĐT qua Zalo bằng thẻ `request_user_info` | Đã bỏ nút | 2026-11-13: thẻ bắt quét QR trên Zalo PC, form nhiều ô. Chủ dự án chọn dùng mẫu trả lời nhanh "Xin số điện thoại" (phím tắt `sdt`, migration `20261113150000_mau_xin_sdt`). API và sự kiện `user_submit_info` còn trong backend, không có nút gọi |
| Gửi ảnh (JPG/PNG ≤1 MB) / PDF (≤5 MB) sang Zalo | Chỉ test giả | `/v2.0/oa/upload/image|file`, chưa kiểm chứng |
| Thanh khung 48 giờ Zalo trong khung chat | Chỉ test giả | Tính từ `lastCustomerMessageAt` |
| Kênh kết nối: trạng thái token, hạn refresh token, tin gửi lỗi, cảnh báo | Chỉ test giả | Lỗi token và số tin lỗi giữ trong bộ nhớ, khởi động lại thì mất |
| Gợi ý trả lời bằng AI | Chưa làm | Cần gọi Gemini, chờ làm đợt sau |

## Facebook Messenger (viết 2026-11-18)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Lưu xong tự kiểm tra kết nối (token đúng Trang, khớp App Secret, tự đăng ký webhook, đăng ký Trang) | Chỉ test giả | `POST /channel-settings/facebook/test`; thành công thì thẻ Facebook hiện "Đã kết nối" |
| Webhook nhận tin khách (chữ, ảnh, sticker, PDF, bấm nút, trích dẫn) | Chỉ test giả | `X-Hub-Signature-256` kiểm bằng App Secret, mã chống trùng `fb:<mid>` |
| Tên, ảnh khách từ hồ sơ Messenger | Chỉ test giả | User Profile API |
| Nhân viên trả lời từ trang này sang Messenger (chữ, ảnh, PDF) | Chỉ test giả | Gửi trước khi lưu; quá 24 giờ thì Meta từ chối, báo lỗi cho sale |
| Tin nhân viên trả lời trên Meta Business Suite | Chỉ test giả | Sự kiện `message_echoes`, bỏ tin chính hệ thống gửi (cùng App ID) |
| Dòng nhắc khung 24 giờ trong khung chat | Chỉ test giả | |

## Digital (Nhu cầu tour)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Tự nhận địa điểm khách hỏi ("tour TQ" → Trung Quốc), 1 lượt/khách/địa điểm/ngày | Chỉ test giả | Cần migration `place_interests`. Danh sách địa danh bổ sung từ `rules.py` chatbot (NZ, Maldives, Bắc Âu...) |
| Quét tin nhắn cũ (nút admin) và khi Đồng bộ tin cũ Zalo | Chỉ test giả | Theo ngày của từng tin |
| Theo địa điểm: lượt hỏi, % trên tổng, Xem thống kê ra từng tin nhắn | Chỉ test giả | Bỏ tour con (chủ dự án yêu cầu 2026-11-13) |
| Tour chi tiết xếp theo doanh thu / số đơn chốt | Chỉ test giả | |

## App Mobile (chuyển API từ backend e-commerce, xem docs/app-mobile-api.md)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Đợt 1: đăng nhập SĐT, làm mới phiên, hồ sơ, đổi mật khẩu, PIN, lưu FCM token | Chỉ test giả | Cần migration `20261116090000_app_accounts`. App chưa sửa đường dẫn nên chưa thử được từ app |
| Sale tạo tài khoản / cấp lại mật khẩu ở menu ⋯ | Chỉ test giả | Cần khách có SĐT và đơn đã chốt |
| Lệnh `create-app-account` | Chỉ test giả | |
| Đợt 2: đặt tour từ app (đơn chờ xác nhận lên đầu hộp thư), lịch sử, số chỗ còn, ngày khởi hành, voucher chung | Chỉ test giả | Cần migration `20261116100000_app_bookings` |
| Trạng thái đơn app: Đã cọc / Đã thanh toán / Đã hoàn tiền (sale bấm ở cột Đơn tour), tự Đang đi tour / Hoàn thành, cộng điểm | Chỉ test giả | API thanh toán ghi ở roadmap "Việc còn nợ" |
| Voucher theo hạng thành viên + tối đa lượt/khách/tháng (trang Voucher, app chỉ hiện mã đúng hạng) | Chỉ test giả | Cần migration `20261116110000_app_phase3` |
| Chốt tour nhập người lớn / trẻ em (80%) / em bé (40%) | Chỉ test giả | Mọi đơn, không chỉ đơn app |
| Đợt 3: thông báo trong app, tour yêu thích, góp ý, ảnh đại diện (bỏ thân nhân) | Chỉ test giả | Cần migration `20261116110000_app_phase3` |
| Đợt 4: app trỏ backend mới, tour/tin/mẹo từ website, hạng theo điểm; chatbot đặt tour và đọc hồ sơ ở backend mới | Chỉ test giả | Chưa chạy app thật. Cần đặt `EXPO_PUBLIC_API_URL` (app) và `NESTJS_BASE_URL` (chatbot) là `https://chatadmin.benthanhtourist.com`. Zalo Mini App chưa sửa |

## Giao diện

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Chưa đọc đậm + chấm xanh, Liên hệ có chuông | Chỉ test giả | 2026-11-13 |
| Xoá hội thoại (admin) | Chỉ test giả | |
| Hộp thư theo bản Stitch: bộ lọc trạng thái vào nút Bộ lọc, cột danh sách 380px | Chỉ test giả | |
| Giao diện tối mới (than ấm, bỏ tông xanh tím) | Chỉ test giả | |
| Trang cá nhân `/profile`: đổi ảnh đại diện, họ tên, mật khẩu; xem mã NV, chức vụ, đơn vị | Chỉ test giả | Cần migration `20261117090000_user_avatar`. Cài đặt bỏ mục Phiên đăng nhập & Bảo mật |
| Kênh kết nối: "Khách nhắn hôm nay" (số hội thoại có tin khách từ 00:00 giờ VN) | Chỉ test giả | Trước tên là "Hội thoại có tin khách hôm nay" |
| Tin nhắn kiểu Zalo: ẩn giờ/icon, rê chuột (cả hàng ngang) hiện ghim + trả lời, bấm tin xem nền tảng và ngày giờ, mốc ngày giữa các ngày, ảnh/sticker gửi riêng không viền | Chỉ test giả | 2026-11-17, chưa mở trình duyệt kiểm tra |
| Thống kê mới theo Stitch: 5 mảng (Khách & Quan tâm, Tour, Hiệu suất sale, Doanh thu đã chốt, Kênh & Chi phí AI) + Nhu cầu tour; kỳ 7 ngày / 30 ngày (theo ngày), quý (13 tuần, theo tuần); biểu đồ đường, miền, cột, cột chồng, tròn, phễu, bản đồ nhiệt, bong bóng, phân tán, thác nước, tần suất | Chỉ test giả | 2026-11-17. API `GET /stats/board`. Đã chạy thử truy vấn (chỉ đọc), chưa mở trình duyệt. Bản đồ nhiệt dùng giờ khách đòi gặp nhân viên (không quét bảng messages) |

## Lưu ý trước khi bàn giao

Những chỗ đang nới ra để thử, phải siết lại trước khi bàn giao cho công ty dùng thật:

- **Xoá voucher** (mở 2026-11-17 để thử): hiện admin toàn quyền xoá được mọi voucher, admin phòng xoá được voucher của phòng mình. **Quy tắc thật khi bàn giao:**
  - Chỉ **người tạo** voucher mới được xoá voucher đó.
  - Admin toàn quyền chỉ thấy voucher giảm bao nhiêu (%, số tiền) cho tour nào, **không thấy mã voucher**.
  - Mã voucher chỉ admin phòng ban đã tạo voucher đó mới thấy.
  - Chỗ cần sửa: `backend/src/vouchers/vouchers.controller.ts` (`remove`, `list`/`ra` ẩn `code` theo người xem) và `frontend/src/pages/VouchersPage.tsx`.
- **Tự lấy tin Zalo 30 ngày mỗi lần khởi động** (`ZALO_SYNC_ON_START`): nhiều khách thì tốn nhiều lần gọi API Zalo; khi đã ổn định có thể tắt (`ZALO_SYNC_ON_START=0`) và chỉ bấm tay khi cần.
- **Facebook: thay Page access token bằng token của Người dùng hệ thống (System User)** (ghi 2026-11-18). Token hiện tại tạo từ tài khoản Facebook cá nhân của chủ dự án nên gắn với quyền của người đó: bị gỡ quyền Trang, đổi mật khẩu hoặc nghỉ việc thì tin Messenger ngừng về. Cách bền: admin hồ sơ doanh nghiệp BenThanh Tourist vào business.facebook.com → Cài đặt doanh nghiệp → Người dùng hệ thống, tạo người dùng, gán Trang (toàn quyền) và ứng dụng (ứng dụng phải thuộc hồ sơ doanh nghiệp), tạo mã với quyền `pages_messaging`, `pages_manage_metadata` (không hết hạn), dán vào ô Page access token ở trang Kênh kết nối. Không hạ quyền của người đã tạo token hiện tại cho tới khi thay xong.
- **Facebook: ứng dụng Meta đã chạy thật ở chế độ thử (2026-11-18); còn phải gửi Xét duyệt ứng dụng và chuyển Live** để mọi khách nhắn được (xem `docs/roadmap.md`).

## Nhật ký

Mỗi dòng: ngày, việc, lệnh cập nhật VPS (ghi rõ có migration không).

- 2026-11-12: ảnh đại diện khách (**có migration** `20261112140000_customer_avatar`), nhập SĐT, nhập khách cũ. Bài học: luôn chạy `prisma migrate deploy` sau khi build.
- 2026-11-13 (4facaad): tin OA gửi, ảnh/PDF qua webhook, trích dẫn, cảm xúc; danh sách chưa đọc đậm hơn. Không có migration.
- 2026-11-13: kéo tin cũ tải ảnh/PDF, trích dẫn cho tin cũ và tin OA; thêm file này. Không có migration.

- 2026-11-13: Digital tự nhận địa điểm, xếp tour theo doanh thu/đơn chốt. **Có migration** `20261113090000_place_interests`.
- 2026-11-13: hộp thư theo Stitch, gửi ảnh/PDF và xin SĐT qua Zalo, trạng thái Zalo ở Kênh kết nối, giao diện tối mới. Không có migration mới (ngoài `place_interests` ở trên).
- 2026-11-13: tin cũ Zalo hiện "[OA gửi tin nhắn qua Zalo...]" (loại text, không chữ): nay tìm link ở mọi trường, tải tệp không lọc theo loại, log "Lịch sử Zalo tin không chữ". Không có migration. VPS build lỗi EOF do hết RAM (3,3 GB) và 47 GB bộ nhớ đệm build: dọn `docker builder prune -f`, build từng cái.
- 2026-11-13: bảng Theo địa điểm bỏ tour con, thêm % và hộp tin nhắn; quét tin cũ; thêm địa danh từ chatbot; khách chia sẻ số thì đẩy hội thoại lên đầu. Bỏ nút Xin số điện thoại, thay bằng mẫu trả lời nhanh. **Có migration** `20261113150000_mau_xin_sdt` (chỉ thêm 1 mẫu).
- 2026-11-16: Voucher theo hạng + lượt/tháng, chốt tour nhập người lớn/trẻ em/em bé, App Mobile đợt 3 (thông báo, yêu thích, góp ý, ảnh đại diện; bỏ thân nhân), sửa app và chatbot sang backend mới. **Có migration** `20261116110000_app_phase3`.
- 2026-11-16: App Mobile đợt 2 (đặt tour, trạng thái đơn, điểm thưởng 6 bậc, voucher chung, ngày khởi hành). **Có migration** `20261116100000_app_bookings`.
- 2026-11-16: App Mobile đợt 1 (tài khoản app, đăng nhập SĐT, hồ sơ, PIN; sale tạo tài khoản trong menu ⋯; lệnh create-app-account). **Có migration** `20261116090000_app_accounts`. Sticker WebP động, nhận GIF từ Zalo (không migration).
- 2026-11-13: danh sách hội thoại ghi người gửi tin cuối ("Bạn:", "Khách:", tên đồng nghiệp, "Zalo OA:"), đọc 1 dòng/hội thoại qua chỉ mục. Không có migration.
- 2026-11-13: hộp thống kê địa điểm thêm biểu đồ 7 ngày, tin nhắn dạng bảng 10 dòng/trang có nút số trang, bộ lọc kênh chỉ hiện kênh có tin. Chỉ frontend, không có migration.
- 2026-11-17: trang cá nhân (ảnh, họ tên, mật khẩu), form tạo tài khoản rộng hơn, bỏ Phiên đăng nhập trong Cài đặt, đổi tên "Khách nhắn hôm nay". **Có migration** `20261117090000_user_avatar`.
- 2026-11-17: tin nhắn kiểu Zalo (rê chuột, bấm xem chi tiết, mốc ngày). Chỉ frontend, không có migration.
- 2026-11-17: trang Thống kê làm lại theo thiết kế Stitch, API mới `GET /stats/board?range=7d|30d|quarter` (một lần gọi đủ 5 mảng, lưu tạm 5 phút); `/stats/orders` nhận thêm `range`. Không có migration.
- 2026-11-17: lấy tin cũ Zalo theo **30 ngày gần đây** (trước: tối đa 300 khách, 50 tin mỗi khách nên thiếu tin cũ): nút ở hộp kết nối Zalo đổi thành "Lấy tin 30 ngày từ Zalo", "Đồng bộ tin cũ" từng hội thoại cũng lấy 30 ngày (tối đa 1.000 tin/khách), xong tự nhận diện địa điểm quan tâm. Không có migration.
- 2026-11-17: form tạo tài khoản có thêm vai trò **Admin toàn quyền** (chỉ admin toàn quyền tạo, không gắn phòng ban). Không có migration.
- 2026-11-19: sửa chatbot theo báo cáo thử Zalo: chatbot đọc tin nhân viên (API mới `GET /ingest/staff-history`, chỉ đọc), báo nhân viên sớm khi khách để lại SĐT (chỉ khi hồ sơ chưa có số) / đoàn công ty / chỉ cần vé máy bay hoặc khách sạn lẻ, giá theo độ tuổi (2-11 tuổi 80%, dưới 2 tuổi 40%), quy tắc nêu số chỗ, sửa 2 câu viết sẵn hiểu sai. Thử lại 58 lượt: Đúng 12 → 24, Sai 16 → 9. Chatbot chưa nối vào Zalo/Facebook nên tác dụng ngay ở web và app. Sửa ở `D:\ChatBot` (repo riêng, chưa commit). Không có migration.
- 2026-11-19: Facebook thử thật với tài khoản tester: tin về Hộp thư, trả lời sang Messenger đều chạy, nhưng khách hiện "Khách chưa rõ tên", không có ảnh. Đọc hồ sơ khách giờ thử lần lượt nhiều bộ trường (`name,first_name,last_name,profile_pic` → bỏ bớt) để thiếu tên vẫn lấy được ảnh, và lý do thất bại gần nhất hiện ở thẻ Facebook trang Kênh kết nối. Token đã có `pages_read_engagement` (thẻ hiện đúng tên Trang) nhưng log VPS vẫn báo "Unsupported get request" khi đọc hồ sơ khách (Meta không cho đọc `/{psid}` với tester), nên thêm đường thứ hai lấy tên từ `/me/conversations?user_id=`; ảnh đại diện có thể vẫn trống tới khi ứng dụng Live. Chưa xác nhận trên VPS. Không có migration.
- 2026-11-19: thử chatbot lần 3 với 9 khách Zalo mới (41 lượt, chưa sửa gì thêm): Đúng 13, An toàn 10, Tạm ổn 11, Sai 7. Lỗi mới: luồng đặt tour chạy ở Zalo (hỏi tour không hiện danh sách, chọn sai ngày, nuốt SĐT nên không báo nhân viên), câu viết sẵn "chưa có tour X tháng Y" hiểu sai câu khách trả lời nhân viên, gợi ý tour khởi hành ngay hôm đó, thẻ tour lạc đề. Chưa có hội thoại thật nào sale trả lời trong chatadmin. Chi tiết ở `docs/thu-chatbot-voi-tin-zalo.md` mục "Lần 3". Không đổi code, không có migration.
- 2026-11-19: sửa chatbot (`D:\ChatBot`, repo riêng, chưa commit) theo lần thử 3 và các quyết định của chủ dự án: Zalo/Facebook vẫn tư vấn, gọi khách theo tên kênh, nhưng không chạy luồng đặt tour, khách muốn đặt thì báo nhân viên (sale chủ động nhắn); chỉ gợi ý tour khởi hành từ 3 ngày sau; tin có số điện thoại kèm câu hỏi thì báo nhân viên và AI vẫn trả lời; nhận số nước ngoài (+61); nhân viên vừa hỏi hoặc câu nhiều nơi / ngày thì không dùng câu viết sẵn. Chạy lại: bộ mới Đúng 13 → 20, Sai 7 → 1; bộ cũ Sai 9 → 7. Ngày 2026-11-20 thêm: khách nêu ngày đi dưới 3 ngày nữa thì báo nhân viên (không gợi ý tour khác); khách nói "đăng ký / book / giữ chỗ / chốt" không kèm chữ "tour" trên Zalo/Facebook cũng báo nhân viên. Test chatbot: 632 → 636, 4 test hỏng đều về tour Dubai / Istanbul (dữ liệu tour: Dubai chỉ còn ngày đã qua, Istanbul khởi hành 22/11 bị quy tắc 3 ngày ẩn), không phải lỗi code. Không đổi code trang quản trị, không có migration. Chủ dự án nói rõ "đơn tạm → booking thật trên benthanhtourist.com" là việc làm sau (đã ghi `docs/roadmap.md`).
- 2026-11-20: sticker (tiếp phần Codex làm ở commit 2a6b998). Gửi sticker sang Zalo thật bị `-200 Send message failed`: sửa theo SDK chính thức của Zalo (luôn có `text`, thử v3 `/cs` rồi v2.0 `/oa/message`), cả hai bị từ chối thì gửi khung đầu dạng PNG. Thêm **tệp sticker** (trang Kho sticker tạo / đổi tên / ẩn tệp, chuyển sticker giữa các tệp; bảng chọn trong chat chia tab theo tệp). **Có migration** `20261120023150_sticker_packs` (thêm bảng `sticker_packs`, cột `stickers.packId`, không có DROP). Chưa thử gửi lại sang Zalo thật, chưa bấm thử giao diện trên trình duyệt.
- 2026-11-18: thử chatbot bttAI với 10 khách Zalo thật (58 lượt, gộp tin khách nhắn liên tiếp), báo cáo ở `docs/thu-chatbot-voi-tin-zalo.md`. Trang công khai `/xoa-du-lieu` (hướng dẫn xoá dữ liệu, chưa commit). Không có migration.
- 2026-11-18: sửa kết nối Facebook: chạy thật báo lỗi 100 (cần `pages_read_engagement`) ở bước kiểm tra token, nay kiểm bằng `debug_token` (App ID + App Secret), kiểm luôn loại token, đúng Trang, đủ quyền `pages_messaging`, `pages_manage_metadata`; hộp kết quả không tràn ngang. Mọi hộp thoại bấm ra ngoài (nền mờ) là đóng, so theo toạ độ. Không có migration.
- 2026-11-18: **nối Facebook Messenger**: webhook `GET/POST /webhooks/facebook`, gửi trả lời, hồ sơ khách, ghi tin trả lời trên Meta Business Suite; hộp kết nối thêm ô App ID, lưu xong tự kiểm tra kết nối (vòng xoay, hộp báo thành công/thất bại từng bước), tự đăng ký webhook và Trang; thẻ Facebook hiện "Đã kết nối" sau khi kiểm tra thành công; khung chat nhắc khung 24 giờ. API mới `POST /channel-settings/facebook/test`, `GET /channel-settings/facebook/status`. Không có migration.
- 2026-11-17: mọi bảng 10 dòng một trang; biểu đồ Thống kê có nút phóng to (hộp gần toàn màn hình), bấm cột/điểm/ô/dòng xem chi tiết đúng mốc (danh sách đơn hoặc hội thoại), mỗi thẻ có nút "Xuất file Excel (.csv)"; bảng Chi tiết đơn đặt tour: mã đơn rút gọn 10 ký tự, cột Nền tảng có lọc, dòng tổng doanh thu và tỷ trọng; chốt tour xong mở Thống kê thấy ngay (xoá bộ nhớ tạm khi đơn đổi); bấm ra ngoài đóng hộp tài khoản; thanh bên rộng hơn; khung chat ẩn nhãn trạng thái khi mở cột thông tin khách; tạo tài khoản và đặt lại mật khẩu hiện nội dung đăng nhập để sao chép, đặt lại mật khẩu tự sinh 12 ký tự; xoá voucher (đang thử, xem Lưu ý trước khi bàn giao); máy chủ khởi động tự lấy tin Zalo 30 ngày. API mới `GET /stats/detail`, `DELETE /vouchers/:id`; `/stats/orders` thêm `channel`, `from`, `to`, 10 đơn/trang. Không có migration.

Lệnh cập nhật VPS chuẩn (migrate an toàn kể cả khi không có gì mới):

```
cd /opt/btt-chat-admin && git pull && cd deploy
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build backend web
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy
docker compose restart backend
```
