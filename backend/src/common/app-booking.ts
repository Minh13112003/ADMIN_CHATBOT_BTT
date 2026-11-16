/**
 * Đơn đặt tour từ app Mobile (chủ dự án chốt 2026-11-16). Đơn là một dòng `deals` (nguồn APP);
 * `deals.bookingStatus` là trạng thái khách thấy trong lịch sử đặt tour.
 */

export const TRANG_THAI_DON = {
  PENDING: 'Chờ xác nhận', // Khách vừa đặt trong app, chờ sale gọi
  CONFIRMED: 'Đã xác nhận', // Sale chốt đơn, bắt đầu tính doanh thu
  DEPOSITED: 'Đã cọc', // Khách chuyển khoản cọc 50% (sale bấm; sau này API thanh toán tự đổi)
  PAID: 'Đã thanh toán', // Khách trả đủ
  ONGOING: 'Đang đi tour', // Tự đổi khi tới ngày khởi hành
  COMPLETED: 'Hoàn thành', // Tự đổi sau ngày về, cộng điểm thưởng
  CANCELLED: 'Đã huỷ',
  REFUNDED: 'Đã hoàn tiền',
} as const;
export type TrangThaiDon = keyof typeof TRANG_THAI_DON;

/** Giá trẻ em (2–15 tuổi) 80%, em bé (dưới 2 tuổi) 40% giá người lớn, như app cũ. Làm tròn từng loại khách. */
export function giaTheoKhach(giaNguoiLon: number, k: { adults: number; children: number; infants: number }): number {
  return giaNguoiLon * k.adults + Math.round(giaNguoiLon * 0.8) * k.children + Math.round(giaNguoiLon * 0.4) * k.infants;
}

/** Sale được bấm chuyển trạng thái nào (các bước còn lại do chốt đơn, khách huỷ, hoặc máy tự đổi theo ngày). */
const BUOC_TAY: Partial<Record<TrangThaiDon, TrangThaiDon[]>> = {
  DEPOSITED: ['CONFIRMED'],
  PAID: ['CONFIRMED', 'DEPOSITED'],
  REFUNDED: ['DEPOSITED', 'PAID', 'CANCELLED'],
};
export function duocChuyenTay(tu: string | null, den: TrangThaiDon): boolean {
  return !!tu && (BUOC_TAY[den] ?? []).includes(tu as TrangThaiDon);
}

/**
 * Máy tự đổi theo ngày (giờ Việt Nam, dạng YYYY-MM-DD): tới ngày khởi hành thì Đang đi tour, qua ngày về thì Hoàn thành.
 * Đơn đã xác nhận nhưng chưa cọc vẫn tự đổi (sale quên bấm thì khách vẫn được cộng điểm). Không có ngày về thì coi như đi trong ngày.
 * null = giữ nguyên.
 */
export function trangThaiTuDong(t: { status: string | null; departureDate: string | null; returnDate: string | null }, homNay: string): TrangThaiDon | null {
  if (!t.departureDate || !['CONFIRMED', 'DEPOSITED', 'PAID', 'ONGOING'].includes(t.status ?? '')) return null;
  if (homNay > (t.returnDate ?? t.departureDate)) return 'COMPLETED';
  if (homNay >= t.departureDate && t.status !== 'ONGOING') return 'ONGOING';
  return null;
}

/** 1.000 đ = 1 điểm, tính trên số tiền đơn sau voucher. */
export const diemThuong = (soTien: number) => Math.max(0, Math.floor(soTien / 1000));

/** 6 bậc thành viên theo điểm tích luỹ (giữ tỷ lệ bản cũ: Bạc = 10 triệu đồng đã đi tour). `ma` lưu ở `vouchers.tier`. */
export const BAC_THANH_VIEN = [
  { ma: 'RUBY', ten: 'Ruby', tu: 500_000 },
  { ma: 'KIM_CUONG', ten: 'Kim Cương', tu: 200_000 },
  { ma: 'BACH_KIM', ten: 'Bạch Kim', tu: 100_000 },
  { ma: 'VANG', ten: 'Vàng', tu: 50_000 },
  { ma: 'BAC', ten: 'Bạc', tu: 10_000 },
  { ma: 'DONG', ten: 'Đồng', tu: 0 },
] as const;
export type MaBac = (typeof BAC_THANH_VIEN)[number]['ma'];
export const MA_BAC = BAC_THANH_VIEN.map((b) => b.ma) as MaBac[];
export const tenBac = (ma: string | null | undefined) => BAC_THANH_VIEN.find((b) => b.ma === ma)?.ten ?? null;

export function bacThanhVien(diem: number): { ma: MaBac; ten: string; tu: number; bacSau: { ma: MaBac; ten: string; tu: number } | null } {
  const i = BAC_THANH_VIEN.findIndex((b) => diem >= b.tu);
  const bac = BAC_THANH_VIEN[i < 0 ? BAC_THANH_VIEN.length - 1 : i];
  const sau = i > 0 ? BAC_THANH_VIEN[i - 1] : null;
  return { ma: bac.ma, ten: bac.ten, tu: bac.tu, bacSau: sau ? { ma: sau.ma, ten: sau.ten, tu: sau.tu } : null };
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const homNayVN = (luc: Date) => new Date(luc.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** Đầu tháng hiện tại theo giờ Việt Nam (00:00 ngày 1, giờ VN), dạng Date. Dùng đếm lượt voucher mỗi tháng. */
export const dauThangVN = (luc: Date) => new Date(`${homNayVN(luc).slice(0, 7)}-01T00:00:00+07:00`);

/** Thông báo trong app khi đơn đổi trạng thái. null = không báo (Chờ xác nhận là lúc khách vừa tự đặt). */
export function thongBaoDon(status: string, tourName: string): { title: string; message: string } | null {
  const tour = tourName.trim() || 'tour';
  switch (status) {
    case 'CONFIRMED': return { title: 'Đơn đặt tour đã được xác nhận', message: `BenThanh Tourist đã xác nhận đơn ${tour}. Vui lòng chuyển khoản cọc 50% theo hướng dẫn của nhân viên để giữ chỗ.` };
    case 'DEPOSITED': return { title: 'Đã nhận tiền cọc', message: `BenThanh Tourist đã nhận tiền cọc cho đơn ${tour}.` };
    case 'PAID': return { title: 'Đã thanh toán đủ', message: `Đơn ${tour} đã được thanh toán đủ. Chúc bạn có chuyến đi vui vẻ!` };
    case 'ONGOING': return { title: 'Chuyến đi bắt đầu', message: `Hôm nay là ngày khởi hành ${tour}. Chúc bạn có chuyến đi thật vui!` };
    case 'COMPLETED': return { title: 'Chuyến đi đã hoàn thành', message: `Cảm ơn bạn đã đi ${tour} cùng BenThanh Tourist. Điểm thưởng đã được cộng vào tài khoản.` };
    case 'CANCELLED': return { title: 'Đơn đặt tour đã huỷ', message: `Đơn ${tour} đã được huỷ. Liên hệ BenThanh Tourist nếu bạn cần hỗ trợ.` };
    case 'REFUNDED': return { title: 'Đã hoàn tiền', message: `BenThanh Tourist đã hoàn tiền cho đơn ${tour}.` };
    default: return null;
  }
}

/** Phân trang theo dạng app cũ đọc: `{ items, meta: { total, page, limit, totalPages, hasNext, hasPrevious } }`. */
export function trangApp<T>(items: T[], total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 } };
}
