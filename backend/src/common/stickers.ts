import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { nhanRaLoaiTep, tenTepAnToan } from './attachments';

export const MAX_STICKER_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

/** Đọc tất cả khung hình; không được âm thầm biến sticker động thành ảnh tĩnh. */
export async function chuanBiSticker(buffer: Buffer, originalname?: string) {
  if (buffer.length > MAX_STICKER_BYTES) throw new BadRequestException('Sticker tối đa 5 MB');
  const ext = nhanRaLoaiTep(buffer)?.ext;
  if (ext !== 'webp' && ext !== 'gif') throw new BadRequestException('Sticker phải là file WebP hoặc GIF hợp lệ');
  const laGif = ext === 'gif';
  try {
    const meta = await sharp(buffer, { animated: true, limitInputPixels: MAX_PIXELS }).metadata();
    const frames = meta.pages ?? 1;
    const height = meta.pageHeight ?? meta.height ?? 0;
    if (!meta.width || !height || frames > 300 || meta.width * height * frames > MAX_PIXELS) {
      throw new BadRequestException('Sticker quá lớn hoặc quá nhiều khung hình (tối đa 300)');
    }
    const make = () => sharp(buffer, { animated: true, limitInputPixels: MAX_PIXELS })
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true });
    const webp = await make().webp({ quality: 85, loop: 0 }).toBuffer();
    if (webp.length > MAX_STICKER_BYTES) throw new BadRequestException('Sticker sau xử lý vượt 5 MB');
    // File GIF tải lên được giữ nguyên bản gốc để gửi sang Zalo (2026-11-20: GIF tự đổi từ WebP bị Zalo trả -200; thử gửi đúng file gốc).
    // Chỉ đổi lại khi GIF gốc lớn hơn 512 px.
    const gif = laGif && meta.width <= 512 && height <= 512 ? buffer : await make().gif({ effort: 7, loop: 0 }).toBuffer();
    if (gif.length > MAX_STICKER_BYTES) throw new BadRequestException('Bản ảnh động để gửi lớn hơn 5 MB. Hãy dùng sticker ngắn hơn hoặc nhỏ hơn');
    const out = await sharp(gif, { animated: true }).metadata();
    if (frames > 1 && (out.pages ?? 1) < 2) throw new BadRequestException('Không giữ được chuyển động của sticker này');
    return { webp, gif, width: out.width!, height: out.pageHeight ?? out.height!, animated: frames > 1,
      name: tenTepAnToan(originalname, ext).replace(/\.(webp|gif)$/i, '').slice(0, 100) || 'Sticker' };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Không đọc được sticker này hoặc ảnh vượt giới hạn xử lý');
  }
}
