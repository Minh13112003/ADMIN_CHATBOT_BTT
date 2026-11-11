import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, stat, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { duongDanTrongThuMuc } from '../common/attachments';

/**
 * Nơi lưu ảnh/PDF. Hai chế độ, chọn bằng biến môi trường:
 * - `STORAGE_DIR` (thư mục trên ổ đĩa server): ưu tiên, dùng khi tự chạy trên VPS. Nhớ gắn volume vào thư mục này
 *   và sao lưu cùng database.
 * - Supabase Storage qua REST (SUPABASE_URL, SUPABASE_BUCKET, SUPABASE_SECRET_KEY): bucket phải để riêng tư,
 *   ảnh chat có thể chứa giấy tờ của khách. Khoá chỉ nằm ở backend.
 * Cả hai đều chỉ lưu đường dẫn tương đối (`2026-11/<uuid>.jpg`), nên đổi chế độ không phải sửa database
 * (nhưng file cũ phải được chép sang nơi mới).
 */
@Injectable()
export class StorageService {
  private log = new Logger(StorageService.name);

  constructor(private config: ConfigService) {}

  private get thuMuc() {
    return (this.config.get<string>('STORAGE_DIR') ?? '').trim();
  }
  /** Đang lưu trên ổ đĩa server (khác Supabase: file được backend phát trực tiếp, không chuyển hướng). */
  get laODia() {
    return !!this.thuMuc;
  }
  private get url() {
    return (this.config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  }
  private get bucket() {
    return this.config.get<string>('SUPABASE_BUCKET') ?? '';
  }
  private get headers() {
    const key = this.config.get<string>('SUPABASE_SECRET_KEY') ?? '';
    return { apikey: key, Authorization: `Bearer ${key}` };
  }

  daCauHinh() {
    return this.laODia || !!(this.url && this.bucket && this.config.get<string>('SUPABASE_SECRET_KEY'));
  }

  private bat() {
    if (!this.daCauHinh()) throw new ServiceUnavailableException('Chưa cấu hình nơi lưu file, tạm thời chưa gửi được ảnh hoặc file');
  }

  async upload(path: string, data: Buffer, contentType: string): Promise<void> {
    this.bat();
    if (this.laODia) return this.ghiODia(path, data);
    let res: Response;
    try {
      res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${path}`, {
        method: 'POST',
        headers: { ...this.headers, 'content-type': contentType, 'cache-control': 'private, max-age=3600' },
        body: new Uint8Array(data),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      this.log.warn(`Không tải lên được Storage: ${(e as Error).name}`);
      throw new ServiceUnavailableException('Không lưu được file, bạn thử lại sau ít phút nhé');
    }
    if (!res.ok) {
      this.log.warn(`Storage trả ${res.status} khi tải lên`);
      throw new ServiceUnavailableException('Không lưu được file, bạn thử lại sau ít phút nhé');
    }
  }

  /** Ghi vào file tạm rồi đổi tên: đang ghi dở mà server tắt thì không để lại file hỏng với tên thật. */
  private async ghiODia(path: string, data: Buffer) {
    const dich = duongDanTrongThuMuc(this.thuMuc, path);
    if (!dich) throw new ServiceUnavailableException('Không lưu được file, bạn thử lại sau ít phút nhé');
    const tam = `${dich}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(dich), { recursive: true });
      await writeFile(tam, data, { mode: 0o640 });
      await rename(tam, dich);
    } catch (e) {
      this.log.error(`Không ghi được file vào ${this.thuMuc}: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Không lưu được file, bạn thử lại sau ít phút nhé');
    }
  }

  /** Chế độ ổ đĩa: thư mục gốc (tuyệt đối) và đường dẫn tương đối của file nếu tồn tại, ngược lại null. */
  async tepODia(path: string): Promise<{ root: string; rel: string } | null> {
    if (!this.laODia) return null;
    const f = duongDanTrongThuMuc(this.thuMuc, path);
    if (!f) return null;
    try {
      return (await stat(f)).isFile() ? { root: this.thuMuc, rel: path } : null;
    } catch {
      return null;
    }
  }

  /** Link tải trực tiếp từ Supabase, sống ngắn (mặc định 60 giây), chỉ để backend chuyển hướng ngay. */
  async linkTam(path: string, giay = 60): Promise<string | null> {
    this.bat();
    try {
      const res = await fetch(`${this.url}/storage/v1/object/sign/${this.bucket}/${path}`, {
        method: 'POST',
        headers: { ...this.headers, 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: giay }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const { signedURL } = (await res.json()) as { signedURL?: string };
      return signedURL ? `${this.url}/storage/v1${signedURL}` : null;
    } catch {
      return null;
    }
  }
}
