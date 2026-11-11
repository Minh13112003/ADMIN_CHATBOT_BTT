# API tour của benthanhtourist.com

Nguồn danh mục tour cho: gắn nhãn tour quan tâm, mẫu tour trong khung chat, hộp Chốt tour, thống kê Digital. Đã gọi thử ngày 11/11/2026, chỉ đọc, không cần đăng nhập.

## 1. Danh sách thể loại (địa điểm)

```
GET https://benthanhtourist.com/api/tour/categories
Header bắt buộc: Accept: application/json
```

Thiếu header `Accept` thì máy chủ trả mã 302 và chuyển về trang chủ (HTML), không phải lỗi mạng.

Trả về:

```json
{ "error": false, "data": [ { "hash": 1, "name": "Trong Nước" }, { "hash": 2, "name": "Nước Ngoài" }, ... ], "message": null }
```

- 121 thể loại lúc thử. Lẫn cả nhóm lớn (Trong Nước, Nước Ngoài, Free & Easy) và quốc gia (Đan Mạch, Thụy Điển, Úc, Mỹ...).
- `hash` là số dùng làm `category_id` ở API 2.
- **Chưa rõ:** API không trả quan hệ cha - con (quốc gia nào thuộc Nước Ngoài). Muốn chỉ hiện quốc gia làm "địa điểm" thì phải lọc hoặc khai báo tay.

## 2. Tour thuộc một thể loại

```
GET https://benthanhtourist.com/api/tour/category?category_id=48
```

Trả về danh sách có phân trang (12 tour mỗi trang, xem `meta.last_page`, `links.next`):

| Trường | Ví dụ | Ghi chú |
|---|---|---|
| `id` | `62d824c840d64e325922f3a9fb3740b91789354135` | Dùng làm `tour_key` ở API 3 |
| `code` | `A06.FIT.92.241126.A` | Mã **đợt khởi hành gần nhất**, không phải mã của cả tour |
| `name` | Du Lịch Miền Tây: Tiền Giang - Cần Thơ | |
| `image` | link ảnh 600px | |
| `departure_place`, `destination_place` | TP. Hồ Chí Minh, Cần Thơ | |
| `days`, `nights` | 2, 1 | |
| `departure_date`, `destination_date` | 2026-11-24, 2026-11-25 | Của đợt gần nhất |
| `price` | 2490000 | Giá/người của đợt gần nhất |
| `is_available` | true | |

## 3. Chi tiết một tour

```
GET https://benthanhtourist.com/api/tour/item?tour_key=62d824c840d64e325922f3a9fb3740b91789354135
```

Gồm mọi trường của API 2, thêm:

- `images[]`: ảnh tour.
- `stock_qty`: số chỗ còn của đợt chính.
- `tour_days[]`: **các ngày khởi hành còn lại**, không gồm ngày gần nhất (ngày gần nhất nằm ở cấp gốc: `code`, `departure_date`, `price`, `stock_qty`). Backend gộp cả hai. Mỗi phần tử có `id`, `code` (mã đợt, ví dụ `A06.FIT.92.081226.A`), `departure_date`, `destination_date`, `stock_qty`, `price`, `is_available`.
- `plans[]`: lịch trình từng ngày (`day`, `title`, `eats`, `content` dạng HTML).
- `tour_price_included`, `tour_price_not_included`, `warning_note`, `cancel_booking`, `tuts_booking_payment`, `punishment_cancel_booking`, `warning_note_visa`: HTML.

## Điểm cần lưu ý khi dùng

- **Mã tour và mã đợt là hai thứ khác nhau.** Một tour có nhiều ngày khởi hành, mỗi ngày một `code` riêng (`...241126.A`, `...081226.A`). Nhãn "tour quan tâm" gắn theo **tour**; mã đợt và giá chỉ dùng khi **chốt**.
- **Chưa chắc `id` của tour có giữ nguyên khi đợt gần nhất đã qua.** Ví dụ trên: `id` ở API 2 trùng với tour, còn các phần tử `tour_days` có `id` khác. Nếu `id` đổi theo đợt gần nhất thì không dùng được làm khoá lâu dài. Cần kiểm tra bằng cách gọi lại cùng tour sau ngày 24/11/2026, hoặc hỏi đội làm website. Cho tới lúc đó, nhãn lưu cả `id`, tên tour và thể loại.
- Phần đầu mã như `A06.FIT.92` **không duy nhất** (quy tắc trong `business-rules.md`), không dùng để nhận ra tour.
- Gọi API từ backend, lưu tạm (ví dụ 1 giờ), không gọi từ trình duyệt mỗi lần gõ tìm.
