import type { Channel, RuleType, Status } from './types';

export const STATUS: Record<Status, { label: string; className: string }> = {
  CONTACT: { label: 'Liên hệ', className: 'bg-status-contact text-white' },
  UNREAD: { label: 'Chưa xem', className: 'bg-blue-soft text-blue-ink' },
  READ: { label: 'Đã xem', className: 'bg-neutral-soft text-neutral-ink' },
  PENDING: { label: 'Chờ xử lý', className: 'bg-amber-soft text-amber-ink' },
  CLOSED: { label: 'Đã chốt', className: 'bg-green-soft text-green-ink' },
};
export const STATUS_LIST: Status[] = ['CONTACT', 'UNREAD', 'READ', 'PENDING', 'CLOSED'];

// Zalo và Facebook chưa kết nối: connected = false thì nút lọc bị khoá.
export const CHANNEL: Record<Channel, { label: string; short: string; bot: string; className: string; connected: boolean }> = {
  WEB: { label: 'bttAI Web', short: 'Web', bot: 'bttAI', className: 'bg-blue-soft text-blue-ink', connected: true },
  APP: { label: 'bttAI App', short: 'App', bot: 'bttAI', className: 'bg-green-soft text-green-ink', connected: true },
  ZALO: { label: 'Zalo OA', short: 'Zalo', bot: 'Bot Zalo', className: 'bg-blue-soft text-blue-ink', connected: false },
  FACEBOOK: { label: 'Facebook', short: 'Facebook', bot: 'Bot Facebook', className: 'bg-purple-soft text-purple-ink', connected: false },
};
export const CHANNEL_LIST: Channel[] = ['WEB', 'APP', 'ZALO', 'FACEBOOK'];

export const RULE_TYPE: Record<RuleType, string> = { FIRST_MESSAGE: 'Tin nhắn đầu tiên', KEYWORD: 'Theo từ khoá', OFF_HOURS: 'Ngoài giờ làm việc' };

export const DEAL_STATUS: Record<'PENDING' | 'CONFIRMED' | 'CANCELLED', { label: string; className: string }> = {
  PENDING: { label: 'Chờ xác nhận', className: 'bg-amber-soft text-amber-ink' },
  CONFIRMED: { label: 'Đã chốt', className: 'bg-green-soft text-green-ink' },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-neutral-soft text-neutral-ink' },
};

/** Trạng thái booking BE Mobile báo về (enum BookingStatus bên D:\E-Commerce\Backend\e-commerce). */
export const BOOKING_STATUS: Record<string, string> = {
  PENDING: 'Booking chờ xử lý',
  CONFIRMED: 'Booking đã giữ chỗ',
  PAID: 'Đã thanh toán',
  ONGOING: 'Đang đi tour',
  COMPLETED: 'Đã đi xong',
  CANCELLED: 'Booking đã huỷ',
  REFUNDED: 'Đã hoàn tiền',
};

/** "2 phút 5 giây", "45 giây", "1 giờ 3 phút". */
export function thoiLuong(giay: number | null) {
  if (giay === null) return 'Chưa có';
  if (giay < 60) return `${giay} giây`;
  const phut = Math.floor(giay / 60);
  if (phut < 60) return giay % 60 ? `${phut} phút ${giay % 60} giây` : `${phut} phút`;
  return `${Math.floor(phut / 60)} giờ ${phut % 60} phút`;
}

export const TAGS = ['Khách đoàn', 'Tour Tết', 'Nước ngoài', 'Trong nước', 'Cần gọi lại'];

export const dinhDangSo = (phone: string | null) => (phone ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : 'Chưa có số điện thoại');

export function thoiGianTruoc(iso: string) {
  const phut = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (phut < 1) return 'Vừa xong';
  if (phut < 60) return `${phut} phút`;
  if (phut < 1440) return `${Math.floor(phut / 60)} giờ`;
  return `${Math.floor(phut / 1440)} ngày`;
}

export function gioTin(iso: string) {
  const d = new Date(iso);
  const gio = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? gio : `${d.toLocaleDateString('vi-VN')} ${gio}`;
}

export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;
export const trieu = (n: number) => (n === 0 ? '0 đ' : `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`);
