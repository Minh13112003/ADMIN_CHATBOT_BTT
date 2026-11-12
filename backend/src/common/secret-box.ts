import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** Mã hoá giá trị bí mật (khoá Zalo, Facebook) trước khi lưu database. AES-256-GCM, khoá suy ra từ ENCRYPTION_KEY. */
const TIEN_TO = 'v1';

function khoa(chuoiKhoa: string) {
  return createHash('sha256').update(chuoiKhoa).digest();
}

export function maHoa(banRo: string, chuoiKhoa: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', khoa(chuoiKhoa), iv);
  const ct = Buffer.concat([c.update(banRo, 'utf8'), c.final()]);
  return [TIEN_TO, iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

/** Trả `null` khi sai khoá hoặc dữ liệu bị sửa (GCM tự phát hiện). */
export function giaiMa(chuoi: string, chuoiKhoa: string): string | null {
  const [v, iv, tag, ct] = chuoi.split(':');
  if (v !== TIEN_TO || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', khoa(chuoiKhoa), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Giao diện chỉ thấy 5 ký tự cuối: "••••••••a3f9b". Giá trị ngắn (dưới 12 ký tự) thì che hết để phần lộ không đáng kể. */
export function xemTruoc(banRo: string): string {
  return banRo.length < 12 ? '••••••••' : `••••••••${banRo.slice(-5)}`;
}
