import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { duongDanLuuTru, kyLinkTep, loiTep, nhanRaLoaiTep, tenTepAnToan } from '../common/attachments';
import { StorageService } from './storage.service';

export type TepDaLuu = { path: string; type: string; name: string; size: number };
export type TepTraVe = { url: string; type: string; name: string; size: number };

const CANH_DAI_TOI_DA = 1600;
const HAN_LINK_NHAN_VIEN_GIAY = 12 * 3600;
export const HAN_LINK_KHACH_GIAY = 7 * 24 * 3600;

@Injectable()
export class AttachmentsService {
  constructor(private storage: StorageService, private config: ConfigService) {}

  /**
   * Kiểm tra theo nội dung file, thu nhỏ ảnh (cạnh dài tối đa 1600 px, xoay đúng chiều, bỏ EXIF gồm cả vị trí chụp)
   * rồi lưu vào Storage. Gọi SAU khi đã qua các kiểm tra khác để không lưu file rồi mới báo lỗi.
   */
  async luu(file: { buffer: Buffer; originalname?: string }): Promise<TepDaLuu> {
    const loi = loiTep(file.buffer);
    if (loi) throw new BadRequestException(loi);
    const loai = nhanRaLoaiTep(file.buffer)!;
    let data = file.buffer;
    if (loai.anh) {
      try {
        data = await sharp(file.buffer, { limitInputPixels: 80_000_000 })
          .rotate()
          .resize({ width: CANH_DAI_TOI_DA, height: CANH_DAI_TOI_DA, fit: 'inside', withoutEnlargement: true })
          .toFormat(loai.ext === 'jpg' ? 'jpeg' : loai.ext, loai.ext === 'png' ? { compressionLevel: 9 } : { quality: 82 })
          .toBuffer();
      } catch {
        throw new BadRequestException('Không đọc được ảnh này, bạn thử ảnh khác nhé');
      }
    }
    const path = duongDanLuuTru(randomUUID(), loai.ext, new Date());
    await this.storage.upload(path, data, loai.type);
    return { path, type: loai.type, name: tenTepAnToan(file.originalname, loai.ext), size: data.length };
  }

  /** Link xem có hạn cho một tin. Đường dẫn tương đối: nơi nhận tự thêm địa chỉ máy chủ. */
  link(messageId: string, giay = HAN_LINK_NHAN_VIEN_GIAY): string {
    return kyLinkTep(this.config.getOrThrow<string>('JWT_SECRET'), messageId, Math.floor(Date.now() / 1000) + giay);
  }

  /** Biến các cột đính kèm của tin thành `attachment` gửi ra ngoài, ẩn đường dẫn lưu trữ. */
  dinhKem(m: { id: string; attachmentPath: string | null; attachmentType: string | null; attachmentName: string | null; attachmentSize: number | null }, giay?: number): TepTraVe | null {
    if (!m.attachmentPath || !m.attachmentType) return null;
    return { url: this.link(m.id, giay), type: m.attachmentType, name: m.attachmentName ?? 'tep', size: m.attachmentSize ?? 0 };
  }
}
