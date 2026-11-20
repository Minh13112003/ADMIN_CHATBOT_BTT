import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { chuanBiSticker, MAX_STICKER_BYTES } from '../common/stickers';
import { duongDanLuuTru } from '../common/attachments';
import type { TepChuanBi } from '../storage/attachments.service';

@Injectable()
export class StickersService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async list() {
    const rows = await this.prisma.sticker.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, animated: true, width: true, height: true } });
    return rows.map((s) => ({ ...s, url: `/stickers/${s.id}/image` }));
  }

  async upload(file: { buffer: Buffer; originalname?: string }) {
    const s = await chuanBiSticker(file.buffer, file.originalname);
    const id = randomUUID();
    const webpPath = duongDanLuuTru(id, 'webp', new Date());
    const gifPath = duongDanLuuTru(id, 'gif', new Date());
    try {
      await this.storage.upload(webpPath, s.webp, 'image/webp');
      await this.storage.upload(gifPath, s.gif, 'image/gif');
      return await this.prisma.sticker.create({ data: { id, name: s.name, webpPath, gifPath,
        gifSize: s.gif.length, width: s.width, height: s.height, animated: s.animated }, select: { id: true, name: true } });
    } catch (err) {
      await Promise.all([this.storage.xoa(webpPath), this.storage.xoa(gifPath)]);
      throw err;
    }
  }

  async get(id: string) {
    const s = await this.prisma.sticker.findFirst({ where: { id, active: true } });
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
}
