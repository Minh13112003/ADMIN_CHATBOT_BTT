import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { kyLinkAnh } from '../common/app-account';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AttachmentsService } from '../storage/attachments.service';
import { AppUser } from './app-auth.guard';

export type ThemYeuThich = { tourKey: string; tourName: string; tourImage?: string; durationText?: string; unitPrice?: number; departureDate?: string };

/** Ngày khởi hành dạng YYYY-MM-DD hoặc DD/MM/YYYY; khác thì null. */
function ngayKhoiHanh(v: string | undefined): Date | null {
  const t = v?.trim() ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const vn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  const s = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : vn ? `${vn[3]}-${vn[2]}-${vn[1]}` : null;
  const d = s ? new Date(`${s}T00:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** Link ảnh đại diện sống 30 ngày; app tải lại hồ sơ mỗi lần mở nên luôn có link mới. */
const HAN_ANH_GIAY = 30 * 24 * 3600;

/** Đợt 3 app Mobile: tour yêu thích, góp ý, ảnh đại diện. Thân nhân đã bỏ theo chủ dự án (2026-11-16). */
@Injectable()
export class AppExtrasService {
  constructor(private prisma: PrismaService, private config: ConfigService, private tep: AttachmentsService, private realtime: RealtimeGateway) {}

  private raYeuThich(f: { id: string; tourKey: string; tourName: string; tourImage: string | null; durationText: string | null; unitPrice: bigint | null; departureDate: Date | null; createdAt: Date }) {
    return { ...f, unitPrice: f.unitPrice === null ? null : Number(f.unitPrice), departureDate: f.departureDate ? f.departureDate.toISOString().slice(0, 10) : null };
  }

  async yeuThich(me: AppUser) {
    const ds = await this.prisma.appFavorite.findMany({ where: { accountId: me.id }, orderBy: { createdAt: 'desc' }, take: 300 });
    return ds.map((f) => this.raYeuThich(f));
  }

  async coYeuThich(me: AppUser, tourKey: string) {
    const f = await this.prisma.appFavorite.findUnique({ where: { accountId_tourKey: { accountId: me.id, tourKey } }, select: { id: true } });
    return { isFavorited: !!f };
  }

  /** Thêm lại tour đã có thì cập nhật ảnh chụp (tên, ảnh, giá), không báo lỗi. */
  async themYeuThich(me: AppUser, d: ThemYeuThich) {
    const data = {
      tourName: d.tourName.trim(), tourImage: d.tourImage || null, durationText: d.durationText || null,
      unitPrice: d.unitPrice !== undefined && d.unitPrice !== null ? BigInt(Math.round(d.unitPrice)) : null,
      departureDate: ngayKhoiHanh(d.departureDate),
    };
    const f = await this.prisma.appFavorite.upsert({ where: { accountId_tourKey: { accountId: me.id, tourKey: d.tourKey } }, create: { accountId: me.id, tourKey: d.tourKey, ...data }, update: data });
    return this.raYeuThich(f);
  }

  async boYeuThich(me: AppUser, tourKey: string) {
    await this.prisma.appFavorite.deleteMany({ where: { accountId: me.id, tourKey } });
    return { success: true };
  }

  /** Lưu góp ý, ghi log nội bộ vào hội thoại app của khách (nếu có) để sale thấy. Không đẩy hội thoại lên đầu. */
  async gopY(me: AppUser, subject: string, content: string) {
    await this.prisma.appFeedback.create({ data: { accountId: me.id, subject: subject.trim(), content: content.trim() } });
    const conv = await this.prisma.conversation.findUnique({ where: { customerId_channel: { customerId: me.customerId, channel: 'APP' } }, select: { id: true } });
    if (conv) {
      const log = await this.prisma.message.create({ data: { conversationId: conv.id, senderType: 'SYSTEM', internal: true, text: `Khách gửi góp ý trong app: ${subject.trim()}. ${content.trim()}`.slice(0, 4000) } });
      this.realtime.emit('message:new', { conversationId: conv.id, message: log });
    }
    return { success: true, message: 'Cảm ơn bạn đã đóng góp ý kiến. Ý kiến của bạn đã được ghi nhận để nâng cao chất lượng dịch vụ!' };
  }

  /** Link tuyệt đối tới ảnh đại diện (app hiện ảnh bằng link, cần cả tên miền). */
  linkAnh(accountId: string, avatarPath: string): string {
    const goc = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3002').split(',')[0].trim().replace(/\/$/, '');
    const phienBan = avatarPath.split('/').pop()?.split('.')[0]?.slice(0, 12) ?? '1';
    return `${goc}/api/v1${kyLinkAnh(this.config.getOrThrow<string>('JWT_SECRET'), accountId, phienBan, Math.floor(Date.now() / 1000) + HAN_ANH_GIAY)}`;
  }

  /** Đổi ảnh đại diện: chỉ nhận ảnh (kiểm tra theo nội dung, thu nhỏ, bỏ EXIF). Ảnh cũ bị xoá. */
  async doiAnh(me: AppUser, file: { buffer: Buffer; originalname?: string }) {
    const cb = await this.tep.chuanBi(file);
    if (!cb.anh) throw new BadRequestException('Ảnh đại diện phải là ảnh JPG, PNG hoặc WebP');
    const luu = await this.tep.luuDaChuanBi(cb);
    const cu = await this.prisma.appAccount.findUniqueOrThrow({ where: { id: me.id }, select: { avatarPath: true } });
    await this.prisma.appAccount.update({ where: { id: me.id }, data: { avatarPath: luu.path } });
    if (cu.avatarPath) await this.tep.xoaTep(cu.avatarPath);
  }

  async xoaAnh(me: AppUser) {
    const cu = await this.prisma.appAccount.findUniqueOrThrow({ where: { id: me.id }, select: { avatarPath: true } });
    if (!cu.avatarPath) return;
    await this.prisma.appAccount.update({ where: { id: me.id }, data: { avatarPath: null } });
    await this.tep.xoaTep(cu.avatarPath);
  }

  async duongDanAnh(accountId: string) {
    const t = await this.prisma.appAccount.findUnique({ where: { id: accountId }, select: { avatarPath: true, isActive: true } });
    if (!t?.avatarPath || !t.isActive) throw new NotFoundException('Không có ảnh đại diện');
    return t.avatarPath;
  }
}
