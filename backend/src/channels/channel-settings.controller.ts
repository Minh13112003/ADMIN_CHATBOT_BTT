import { BadRequestException, Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { giaiMa, maHoa, xemTruoc } from '../common/secret-box';
import { Channel, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Truong = { name: string; label: string; secret: boolean; hint?: string };
/** Trường cần nhập cho từng kênh. Tên trường theo tài liệu từng nền tảng; sửa ở đây khi đối chiếu bản chính thức. */
export const TRUONG_KENH: Partial<Record<Channel, Truong[]>> = {
  ZALO: [
    { name: 'oaId', label: 'ID Official Account', secret: false },
    { name: 'appId', label: 'App ID', secret: false },
    { name: 'appSecret', label: 'Khoá bí mật của ứng dụng (App Secret)', secret: true, hint: 'Dùng để kiểm tra tin Zalo gửi về đúng là của Zalo.' },
    { name: 'accessToken', label: 'Access token của OA', secret: true },
    { name: 'refreshToken', label: 'Refresh token', secret: true, hint: 'Hệ thống sẽ tự cập nhật khi Zalo cấp token mới.' },
  ],
  FACEBOOK: [
    { name: 'pageId', label: 'ID Trang', secret: false },
    { name: 'appSecret', label: 'Khoá bí mật của ứng dụng (App Secret)', secret: true },
    { name: 'pageAccessToken', label: 'Page access token', secret: true },
    { name: 'verifyToken', label: 'Mã xác minh webhook', secret: true },
  ],
};

function kenh(ten: string): Channel {
  const k = ten.toUpperCase() as Channel;
  if (!TRUONG_KENH[k]) throw new BadRequestException('Kênh này chưa hỗ trợ nhập thông tin kết nối');
  return k;
}

/** Thông tin kết nối kênh: chỉ ADMIN. API không bao giờ trả giá trị bí mật, chỉ trả "đã nhập" và đuôi 4 ký tự. */
@Roles(Role.ADMIN)
@Controller('channel-settings')
export class ChannelSettingsController {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private khoaMaHoa() {
    const k = this.config.get<string>('ENCRYPTION_KEY');
    if (!k || k.length < 32) throw new BadRequestException('Máy chủ chưa cấu hình ENCRYPTION_KEY (ít nhất 32 ký tự), nên chưa lưu được thông tin kết nối.');
    return k;
  }

  @Get(':channel')
  async xem(@Param('channel') ten: string) {
    const k = kenh(ten);
    const khoa = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    const dong = await this.prisma.channelSecret.findMany({ where: { channel: k } });
    const theoTen = new Map(dong.map((d) => [d.name, d]));
    return {
      encryptionReady: khoa.length >= 32,
      fields: TRUONG_KENH[k]!.map((t) => {
        const d = theoTen.get(t.name);
        const banRo = d && khoa ? giaiMa(d.valueEnc, khoa) : null;
        return { ...t, set: !!d, preview: d ? (banRo === null ? 'Không đọc được (khoá mã hoá đã đổi)' : t.secret ? xemTruoc(banRo) : banRo) : null, updatedAt: d?.updatedAt ?? null };
      }),
    };
  }

  /** Chỉ ghi những trường có giá trị; để trống nghĩa là giữ nguyên. */
  @Put(':channel')
  async luu(@Param('channel') ten: string, @Body() body: { values?: Record<string, unknown> }, @CurrentUser() me: AuthUser) {
    const k = kenh(ten);
    const khoa = this.khoaMaHoa();
    const hopLe = new Set(TRUONG_KENH[k]!.map((t) => t.name));
    const values = body?.values && typeof body.values === 'object' ? body.values : {};
    const cap = Object.entries(values).filter(([, v]) => typeof v === 'string' && v.trim());
    if (cap.some(([n]) => !hopLe.has(n))) throw new BadRequestException('Có trường không hợp lệ');
    if (cap.some(([, v]) => (v as string).length > 2000)) throw new BadRequestException('Giá trị quá dài');
    if (!cap.length) throw new BadRequestException('Chưa nhập giá trị nào');
    await this.prisma.$transaction(
      cap.map(([name, v]) => {
        const valueEnc = maHoa((v as string).trim(), khoa);
        return this.prisma.channelSecret.upsert({
          where: { channel_name: { channel: k, name } },
          create: { channel: k, name, valueEnc, updatedById: me.id },
          update: { valueEnc, updatedById: me.id },
        });
      }),
    );
    return this.xem(ten);
  }

  @Delete(':channel')
  async xoa(@Param('channel') ten: string) {
    const k = kenh(ten);
    await this.prisma.channelSecret.deleteMany({ where: { channel: k } });
    return this.xem(ten);
  }
}
