/**
 * Phiên bản số liệu thống kê. Mỗi lần đơn đổi (chốt, xác nhận, huỷ, mở lại, booking báo trạng thái) thì tăng lên,
 * bộ nhớ tạm 5 phút của thống kê thấy khác phiên bản sẽ tính lại ngay. Nhờ vậy chốt tour xong mở Thống kê là thấy doanh thu mới,
 * không phải đợi hết 5 phút hay tải lại trang.
 */
let phien = 0;
export function thongKeDoi() {
  phien++;
}
export function phienThongKe() {
  return phien;
}
