/**
 * Phiên đăng nhập trượt: mỗi lần dùng trang (sau ít nhất 1 giờ từ lần cấp trước) backend cấp lại cookie,
 * nên đang dùng hằng ngày thì không bị đăng xuất. Không mở trang quá `ngay` ngày thì phải đăng nhập lại.
 * Tối đa `toiDaNgay` ngày kể từ lúc đăng nhập bằng mật khẩu thì bắt đăng nhập lại dù vẫn dùng.
 */
export const GIAN_CACH_GIA_HAN_GIAY = 3600;

export interface CauHinhPhien {
  ngay: number;
  toiDaNgay: number;
}

export function cauHinhPhien(ngay?: string, toiDaNgay?: string): CauHinhPhien {
  const so = (v: string | undefined, md: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : md;
  };
  const n = so(ngay, 7);
  return { ngay: n, toiDaNgay: Math.max(n, so(toiDaNgay, 30)) };
}

/** `auth`: giây lúc đăng nhập bằng mật khẩu (token cũ không có thì lấy `iat`). */
export function nenGiaHan(token: { iat?: number; auth?: number }, nowGiay: number, ch: CauHinhPhien): boolean {
  if (!token.iat) return false;
  const auth = token.auth ?? token.iat;
  return nowGiay - token.iat >= GIAN_CACH_GIA_HAN_GIAY && nowGiay - auth < ch.toiDaNgay * 86_400;
}

/** Hạn của token mới (giây), không vượt mốc tối đa tính từ lúc đăng nhập. */
export function hanToken(auth: number, nowGiay: number, ch: CauHinhPhien): number {
  return Math.max(1, Math.min(ch.ngay * 86_400, auth + ch.toiDaNgay * 86_400 - nowGiay));
}
