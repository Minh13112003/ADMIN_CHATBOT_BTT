import sharp from 'sharp';
import { chuanBiSticker, MAX_STICKER_BYTES } from './stickers';

export async function webpDong() {
  const pixels = Buffer.alloc(16 * 32 * 4);
  for (let i = 0; i < 16 * 32; i++) {
    pixels[i * 4 + (i < 256 ? 0 : 1)] = 255;
    pixels[i * 4 + 3] = i % 16 < 4 ? 0 : 255;
  }
  return sharp(pixels, { raw: { width: 16, height: 32, channels: 4, pageHeight: 16 } })
    .webp({ lossless: true, delay: [100, 200], loop: 0 }).toBuffer();
}

describe('sticker WebP', () => {
  it('giữ các khung hình, thời lượng và nền trong suốt khi chuyển GIF', async () => {
    const s = await chuanBiSticker(await webpDong(), 'xin-chao.webp');
    const [webp, gif] = await Promise.all([sharp(s.webp, { animated: true }).metadata(), sharp(s.gif, { animated: true }).metadata()]);
    expect(s).toMatchObject({ name: 'xin-chao', animated: true, width: 16, height: 16 });
    expect(webp.pages).toBe(2);
    expect(gif).toMatchObject({ pages: 2, delay: [100, 200], hasAlpha: true, loop: 0 });
    const a = await sharp(s.gif, { page: 0 }).raw().toBuffer();
    const b = await sharp(s.gif, { page: 1 }).raw().toBuffer();
    expect(a.equals(b)).toBe(false);
  });

  it('WebP tĩnh không bị mô tả thành ảnh động; thu nhỏ về 512', async () => {
    const image = await sharp({ create: { width: 700, height: 350, channels: 4, background: '#ff000080' } }).webp().toBuffer();
    expect(await chuanBiSticker(image)).toMatchObject({ animated: false, width: 512, height: 256 });
  });

  it('GIF động tải lên được giữ nguyên bản gốc để gửi, vẫn tạo WebP để hiện trên trang', async () => {
    const gif = await sharp(await webpDong(), { animated: true }).gif({ loop: 0 }).toBuffer();
    const s = await chuanBiSticker(gif, 'ami_01.gif');
    expect(s.gif.equals(gif)).toBe(true);
    expect(s).toMatchObject({ name: 'ami_01', animated: true, width: 16, height: 16 });
    expect((await sharp(s.webp, { animated: true }).metadata()).pages).toBe(2);
  });

  it('GIF lớn hơn 512 px thì thu nhỏ, không giữ bản gốc', async () => {
    const gif = await sharp({ create: { width: 800, height: 400, channels: 4, background: 'red' } }).gif().toBuffer();
    const s = await chuanBiSticker(gif, 'to.gif');
    expect(s.gif.equals(gif)).toBe(false);
    expect(s).toMatchObject({ width: 512, height: 256 });
  });

  it('từ chối giả đuôi, file hỏng và quá dung lượng', async () => {
    await expect(chuanBiSticker(Buffer.from('<svg/>'), 'x.webp')).rejects.toThrow('WebP');
    await expect(chuanBiSticker(Buffer.from('RIFFxxxxWEBPbad'))).rejects.toThrow('Không đọc được');
    await expect(chuanBiSticker(Buffer.alloc(MAX_STICKER_BYTES + 1))).rejects.toThrow('5 MB');
  });
});
