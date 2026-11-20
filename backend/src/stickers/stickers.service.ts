import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { chuanBiSticker, MAX_STICKER_BYTES } from '../common/stickers';
import { duongDanLuuTru } from '../common/attachments';
import type { TepChuanBi } from '../storage/attachments.service';

/** Sticker dùng được: chưa ẩn, và không nằm trong tệp đã ẩn. */
const DUNG_DUOC = { active: true, OR: [{ packId: null }, { pack: { active: true } }] };

@Injectable()
export class StickersService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async list() {
    const rows = await this.prisma.sticker.findMany({ where: DUNG_DUOC, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, animated: true, width: true, height: true, packId: true } });
    return rows.map((s) => ({ ...s, url: `/stickers/${s.id}/image` }));
  }

  /** Các tệp sticker. Bảng chọn trong chat chỉ cần tệp đang dùng; trang Kho sticker (admin) xem cả tệp đã ẩn. */
  async packs(caTepAn = false) {
    const rows = await this.prisma.stickerPack.findMany({
      where: caTepAn ? {} : { active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, active: true, _count: { select: { stickers: { where: { active: true } } } } },
    });
    return rows.map(({ _count, ...p }) => ({ ...p, count: _count.stickers }));
  }

  async createPack(name: string) {
    const ten = this.tenTep(name);
    if (await this.prisma.stickerPack.findUnique({ where: { name: ten } })) throw new ConflictException('Đã có tệp sticker cùng tên');
    return this.prisma.stickerPack.create({ data: { name: ten }, select: { id: true, name: true, active: true } });
  }

  async updatePack(id: string, dto: { name?: string; active?: boolean }) {
    await this.layTep(id);
    const data: { name?: string; active?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.tenTep(dto.name);
      const trung = await this.prisma.stickerPack.findUnique({ where: { name: data.name } });
      if (trung && trung.id !== id) throw new ConflictException('Đã có tệp sticker cùng tên');
    }
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.stickerPack.update({ where: { id }, data, select: { id: true, name: true, active: true } });
  }

  async upload(file: { buffer: Buffer; originalname?: string }, packId?: string) {
    if (packId) await this.layTep(packId);
    const s = await chuanBiSticker(file.buffer, file.originalname);
    const id = randomUUID();
    const webpPath = duongDanLuuTru(id, 'webp', new Date());
    const gifPath = duongDanLuuTru(id, 'gif', new Date());
    try {
      await this.storage.upload(webpPath, s.webp, 'image/webp');
      await this.storage.upload(gifPath, s.gif, 'image/gif');
      return await this.prisma.sticker.create({ data: { id, name: s.name, webpPath, gifPath, packId: packId || null,
        gifSize: s.gif.length, width: s.width, height: s.height, animated: s.animated }, select: { id: true, name: true, packId: true } });
    } catch (err) {
      await Promise.all([this.storage.xoa(webpPath), this.storage.xoa(gifPath)]);
      throw err;
    }
  }

  /** Chuyển sticker sang tệp khác (null = bỏ khỏi tệp). */
  async move(id: string, packId: string | null) {
    await this.prisma.sticker.findFirstOrThrow({ where: { id, active: true } }).catch(() => { throw new NotFoundException('Sticker không còn trong kho'); });
    if (packId) await this.layTep(packId);
    await this.prisma.sticker.update({ where: { id }, data: { packId } });
    return { ok: true };
  }

  async get(id: string) {
    const s = await this.prisma.sticker.findFirst({ where: { id, ...DUNG_DUOC } });
    if (!s) throw new NotFoundException('Sticker không còn trong kho');
    return s;
  }

  async image(id: string) {
    return this.storage.doc((await this.get(id)).webpPath, MAX_STICKER_BYTES);
  }

  async prepare(id: string): Promise<TepChuanBi> {
    const s = await this.get(id);
    return { data: await this.storage.doc(s.gifPath, MAX_STICKER_BYTES), type: 'image/gif', ext: 'gif',
      name: `${s.name}.gif`, anh: true };
  }

  async hide(id: string) {
    await this.get(id);
    await this.prisma.sticker.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  private tenTep(name: string) {
    const ten = (name ?? '').trim().replace(/\s+/g, ' ');
    if (!ten) throw new BadRequestException('Tên tệp sticker đang trống');
    if (ten.length > 60) throw new BadRequestException('Tên tệp sticker tối đa 60 ký tự');
    return ten;
  }

  private async layTep(id: string) {
    const p = await this.prisma.stickerPack.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy tệp sticker');
    return p;
  }
}
