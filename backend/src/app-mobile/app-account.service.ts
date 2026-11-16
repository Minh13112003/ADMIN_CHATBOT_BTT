import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';
import { AuthUser } from '../auth/auth.decorators';
import { bacThanhVien } from '../common/app-booking';
import { ghepHoTen, lyDoKhongTaoTaiKhoan, tachHoTen, taoMatKhau } from '../common/app-account';
import { chuanHoaSoDienThoai } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AppTokenPayload, docTokenApp, khoaApp } from './app-auth.guard';
import { AppExtrasService } from './app-extras.service';

const VONG_BAM = 12;
const HAN_ACCESS = '15m';
const HAN_REFRESH = '30d';

/** bcrypt chỉ đọc 72 byte đầu nên không dùng cho refresh token (JWT dài hơn nhiều): băm SHA-256. */
const bamToken = (t: string) => createHash('sha256').update(t).digest('hex');

const ngay = (v: string | null | undefined): Date | null | undefined => (v === undefined ? undefined : v ? new Date(v) : null);

export type CapNhatHoSo = {
  firstName?: string; lastName?: string; email?: string | null; dateOfBirth?: string | null; gender?: string | null;
  nationalId?: string | null; passportNumber?: string | null; passportExpiry?: string | null;
};

const CHON = {
  id: true, phone: true, email: true, dateOfBirth: true, gender: true, nationalId: true, passportNumber: true, passportExpiry: true,
  earnedPoints: true, avatarPath: true, createdAt: true, updatedAt: true, customer: { select: { name: true, avatarUrl: true } },
} as const;

@Injectable()
export class AppAccountService {
  /** Bản băm giả để so khi SĐT chưa có tài khoản. */
  private bamGia = bcrypt.hash(randomUUID(), VONG_BAM);

  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, private realtime: RealtimeGateway, private extras?: AppExtrasService) {}

  /** Hồ sơ theo đúng tên trường app cũ đang đọc (firstName, lastName, phonenumber...). Có hạng thành viên (`tier`) theo điểm tích luỹ. */
  async hoSo(id: string) {
    const t = await this.prisma.appAccount.findUnique({ where: { id }, select: CHON });
    if (!t) throw new NotFoundException('Không tìm thấy tài khoản');
    const { customer, phone, avatarPath, ...con } = t;
    // Ảnh khách tải lên trong app; chưa có thì dùng ảnh lấy từ kênh khác (Zalo) nếu có.
    const avatarUrl = avatarPath && this.extras ? this.extras.linkAnh(t.id, avatarPath) : customer.avatarUrl;
    // Điểm chỉ để xét bậc (chủ dự án chốt 2026-11-16), không trừ tiền: rewardPoints giữ tên trường cũ, bằng điểm tích luỹ. Bỏ mã giới thiệu.
    return { ...con, ...tachHoTen(customer.name), fullName: customer.name, phonenumber: phone, role: 'USER', avatarUrl, age: null, rewardPoints: t.earnedPoints, tier: bacThanhVien(t.earnedPoints) };
  }

  private async capToken(id: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: id, typ: 'access' } satisfies AppTokenPayload, { secret: khoaApp(this.config), expiresIn: HAN_ACCESS }),
      this.jwt.signAsync({ sub: id, typ: 'refresh', jti: randomUUID() } satisfies AppTokenPayload, { secret: khoaApp(this.config), expiresIn: HAN_REFRESH }),
    ]);
    await this.prisma.appAccount.update({ where: { id }, data: { refreshTokenHash: bamToken(refreshToken) } });
    return { accessToken, refreshToken };
  }

  /** Đăng nhập bằng SĐT + mật khẩu. `identifier` giữ tên trường của app cũ. Sai SĐT hay sai mật khẩu đều báo chung một câu. */
  async dangNhap(identifier: string, password: string) {
    const phone = chuanHoaSoDienThoai(identifier);
    const t = phone ? await this.prisma.appAccount.findUnique({ where: { phone }, select: { id: true, passwordHash: true, isActive: true } }) : null;
    // Vẫn so mật khẩu khi không có tài khoản để thời gian trả lời như nhau (không dò được số nào đã có tài khoản).
    const dung = await bcrypt.compare(password, t?.passwordHash ?? (await this.bamGia));
    if (!t || !dung) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    if (!t.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá, vui lòng liên hệ BenThanh Tourist');
    await this.prisma.appAccount.update({ where: { id: t.id }, data: { lastLoginAt: new Date() } });
    return { ...(await this.capToken(t.id)), user: await this.hoSo(t.id) };
  }

  /** Đổi refresh token cũ lấy cặp token mới. Refresh token chỉ dùng được một lần (dùng lại token cũ là bị từ chối). */
  async lamMoi(header: string | undefined) {
    const p = await docTokenApp(this.jwt, this.config, header, 'refresh');
    const token = header!.slice(7).trim();
    const t = await this.prisma.appAccount.findUnique({ where: { id: p.sub }, select: { id: true, isActive: true, refreshTokenHash: true } });
    if (!t?.isActive || !t.refreshTokenHash || t.refreshTokenHash !== bamToken(token)) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    return this.capToken(t.id);
  }

  async dangXuat(id: string) {
    await this.prisma.appAccount.update({ where: { id }, data: { refreshTokenHash: null, fcmToken: null } });
  }

  /** Sửa hồ sơ. Đổi họ tên thì đổi luôn tên khách trong trang quản trị, tên cũ giữ ở danh sách tên khác để vẫn tìm được. */
  async capNhatHoSo(id: string, d: CapNhatHoSo) {
    const t = await this.prisma.appAccount.findUniqueOrThrow({ where: { id }, select: { customerId: true, customer: { select: { name: true, aliases: true } } } });
    const cu = tachHoTen(t.customer.name);
    const tenMoi = d.firstName !== undefined || d.lastName !== undefined ? ghepHoTen(d.lastName ?? cu.lastName, d.firstName ?? cu.firstName) : null;
    await this.prisma.$transaction([
      this.prisma.appAccount.update({
        where: { id },
        data: {
          email: d.email === undefined ? undefined : d.email?.trim().toLowerCase() || null,
          dateOfBirth: ngay(d.dateOfBirth), gender: d.gender, nationalId: d.nationalId, passportNumber: d.passportNumber, passportExpiry: ngay(d.passportExpiry),
        },
      }),
      ...(tenMoi && tenMoi !== t.customer.name
        ? [this.prisma.customer.update({ where: { id: t.customerId }, data: { name: tenMoi, aliases: [...new Set([...t.customer.aliases, t.customer.name])] } })]
        : []),
    ]);
    return this.hoSo(id);
  }

  async doiMatKhau(id: string, cu: string, moi: string) {
    const t = await this.prisma.appAccount.findUniqueOrThrow({ where: { id }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(cu, t.passwordHash))) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    // Đổi mật khẩu thì các máy khác đang đăng nhập phải đăng nhập lại.
    await this.prisma.appAccount.update({ where: { id }, data: { passwordHash: await bcrypt.hash(moi, VONG_BAM), refreshTokenHash: null } });
    return { message: 'Đổi mật khẩu thành công' };
  }

  async trangThaiPin(id: string) {
    const t = await this.prisma.appAccount.findUniqueOrThrow({ where: { id }, select: { pinHash: true } });
    return { hasPin: !!t.pinHash };
  }

  async datPin(id: string, pin: string) {
    const t = await this.prisma.appAccount.findUniqueOrThrow({ where: { id }, select: { pinHash: true } });
    if (t.pinHash) throw new BadRequestException('PIN đã được thiết lập. Vui lòng dùng chức năng đổi PIN.');
    await this.prisma.appAccount.update({ where: { id }, data: { pinHash: await bcrypt.hash(pin, VONG_BAM) } });
    return { message: 'Thiết lập mã PIN thành công' };
  }

  async kiemPin(id: string, pin: string) {
    const t = await this.prisma.appAccount.findUniqueOrThrow({ where: { id }, select: { pinHash: true } });
    if (!t.pinHash) throw new BadRequestException('Tài khoản chưa thiết lập mã PIN');
    if (!(await bcrypt.compare(pin, t.pinHash))) throw new BadRequestException('Mã PIN không chính xác');
    return { success: true };
  }

  async doiPin(id: string, cu: string, moi: string) {
    await this.kiemPin(id, cu);
    await this.prisma.appAccount.update({ where: { id }, data: { pinHash: await bcrypt.hash(moi, VONG_BAM) } });
    return { message: 'Đổi mã PIN thành công' };
  }

  async luuFcm(id: string, fcmToken: string) {
    await this.prisma.appAccount.update({ where: { id }, data: { fcmToken } });
    return { success: true };
  }

  // ===== Phía nhân viên =====

  /** Tình trạng tài khoản app của khách trong hội thoại, cho menu ⋯ (không bao giờ trả mật khẩu). */
  async trangThai(conversationId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { customerId: true, customer: { select: { phone: true, appAccount: { select: { phone: true, createdAt: true, lastLoginAt: true, isActive: true } } } } },
    });
    if (!c) throw new NotFoundException('Không tìm thấy hội thoại');
    const soDonDaChot = await this.prisma.deal.count({ where: { customerId: c.customerId, status: 'CONFIRMED', voidedAt: null } });
    return { account: c.customer.appAccount, canCreate: !c.customer.appAccount && !lyDoKhongTaoTaiKhoan({ phone: c.customer.phone, soDonDaChot }), reason: lyDoKhongTaoTaiKhoan({ phone: c.customer.phone, soDonDaChot }) };
  }

  /**
   * Sale bấm "Tạo tài khoản app" (hoặc "Cấp lại mật khẩu" nếu đã có). Mật khẩu chỉ trả về MỘT lần cho sale gửi khách,
   * không lưu dạng đọc được, không ghi vào log. Cấp lại mật khẩu thì máy đang đăng nhập bị đăng xuất.
   */
  async taoHoacCapLai(user: AuthUser, conversationId: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { customerId: true, customer: { select: { phone: true, name: true, appAccount: { select: { id: true } } } } } });
    if (!c) throw new NotFoundException('Không tìm thấy hội thoại');
    const daCo = c.customer.appAccount;
    if (!daCo) {
      const soDonDaChot = await this.prisma.deal.count({ where: { customerId: c.customerId, status: 'CONFIRMED', voidedAt: null } });
      const lyDo = lyDoKhongTaoTaiKhoan({ phone: c.customer.phone, soDonDaChot });
      if (lyDo === 'NEED_PHONE') throw new BadRequestException({ code: lyDo, message: 'Khách chưa có số điện thoại. Cập nhật số điện thoại trước khi tạo tài khoản' });
      if (lyDo) throw new BadRequestException({ code: lyDo, message: 'Chỉ tạo tài khoản app cho khách đã chốt tour' });
    }
    const matKhau = taoMatKhau(randomInt);
    const passwordHash = await bcrypt.hash(matKhau, VONG_BAM);
    if (daCo) await this.prisma.appAccount.update({ where: { id: daCo.id }, data: { passwordHash, refreshTokenHash: null, isActive: true } });
    else {
      const tk = await this.prisma.appAccount.create({ data: { customerId: c.customerId, phone: c.customer.phone!, passwordHash, createdById: user.id } });
      // Danh tính kênh APP = id tài khoản: chatbot trong app gửi mã này, tin và đơn đặt tour vào cùng một khách.
      await this.prisma.customerIdentity.upsert({ where: { channel_externalId: { channel: 'APP', externalId: tk.id } }, create: { channel: 'APP', externalId: tk.id, customerId: c.customerId }, update: {} });
    }
    const log = await this.prisma.message.create({
      data: { conversationId, senderType: 'SYSTEM', internal: true, text: `${user.fullName} đã ${daCo ? 'cấp lại mật khẩu' : 'tạo tài khoản'} app BenThanh Tourist cho khách (đăng nhập bằng số ${c.customer.phone})` },
    });
    this.realtime.emit('message:new', { conversationId, message: log });
    return { phone: c.customer.phone!, password: matKhau, created: !daCo };
  }
}
