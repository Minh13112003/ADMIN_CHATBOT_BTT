import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Supabase Storage qua REST (không cần thêm thư viện). Bucket phải để riêng tư: ảnh chat có thể chứa giấy tờ của khách.
 * Khoá SUPABASE_SECRET_KEY chỉ nằm ở backend, không bao giờ đưa ra frontend, app hay chatbot.
 */
@Injectable()
export class StorageService {
  private log = new Logger(StorageService.name);

  constructor(private config: ConfigService) {}

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
    return !!(this.url && this.bucket && this.config.get<string>('SUPABASE_SECRET_KEY'));
  }

  private bat() {
    if (!this.daCauHinh()) throw new ServiceUnavailableException('Chưa cấu hình nơi lưu file, tạm thời chưa gửi được ảnh hoặc file');
  }

  async upload(path: string, data: Buffer, contentType: string): Promise<void> {
    this.bat();
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
