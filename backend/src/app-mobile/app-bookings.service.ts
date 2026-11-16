import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { AuthUser } from '../auth/auth.decorators';
import { bacThanhVien, dauThangVN, diemThuong, duocChuyenTay, homNayVN, tenBac, TRANG_THAI_DON, trangApp, trangThaiTuDong, type TrangThaiDon } from '../common/app-booking';
import { moTaMucGiam, trangThaiVoucher } from '../common/vouchers';
import { tomTat } from '../common/text';
import { AssignmentService } from '../conversations/assignment.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PricingService, voucherRule } from '../tours/pricing.service';
import { TourCatalogService } from '../tours/tour-catalog.service';
import { AppUser } from './app-auth.guard';
import { AppNotificationsService } from './app-notifications.service';

export type KhachDi = { fullName: string; dateOfBirth?: string | null; gender?: string | null; nationalId?: string | null; passportNumber?: string | null; phone?: string | null };
export type DatTourInput = { tourKey: string; departureKey: string; adults: number; children?: number; infants?: number; voucherCode?: string; notice?: string; guests?: KhachDi[] };

/** Đơn còn giữ chỗ (trừ vào số chỗ còn lại của đợt). */
const GIU_CHO = ['PENDING', 'CONFIRMED', 'DEPOSITED', 'PAID', 'ONGOING'];

type DonRow = Prisma.DealGetPayload<{ include: { guestList: true } }>;
const ngay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const ngaySinh = (v: string | null | undefined) => (v ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);

/**
 * Đơn đặt tour từ app Mobile (chủ dự án chốt 2026-11-16). Đơn là một dòng `deals` nguồn APP: hiện ngay trong hộp thư,
 * hội thoại lên đầu ở trạng thái Chờ xử lý, chia cho sale như đơn khách đặt qua chatbot. Giá lấy từ website, không tin giá app gửi.
 */
@Injectable()
export class AppBookingsService {
  private log = new Logger('AppBookings');

  constructor(
    private prisma: PrismaService,
    private catalog: TourCatalogService,
    private pricing: PricingService,
    private assignment: AssignmentService,
    private realtime: RealtimeGateway,
    private notifications: AppNotificationsService,
  ) {}

  /** Đơn theo dạng app cũ đang đọc (tour, departure, passengers, price...), thêm `statusLabel` tiếng Việt. */
  private raApp(d: DonRow) {
    const gia = Number(d.unitPrice ?? 0);
    const loai = (n: number | null, tiLe: number) => ({ so: n ?? 0, don: Math.round(gia * tiLe) });
    const [nl, te, eb] = [loai(d.adults ?? d.guests, 1), loai(d.children, 0.8), loai(d.infants, 0.4)];
    const status = (d.bookingStatus ?? 'PENDING') as TrangThaiDon;
    return {
      id: d.id,
      source: 'LARAVEL',
      tourKey: d.tourKey,
      tour: { id: d.tourKey, name: d.tourName, imageUrl: d.tourImage ? [d.tourImage] : [], tourCode: d.tourCode },
      departure: d.departureDate ? { id: d.departureKey, tourCode: d.tourCode, departureDate: ngay(d.departureDate), returnDate: ngay(d.returnDate), price: gia } : null,
      quantity: d.guests,
      passengers: {
        adults: nl.so, adultUnitPrice: nl.don, adultTotal: nl.so * nl.don,
        children: te.so, childUnitPrice: te.don, childTotal: te.so * te.don,
        infants: eb.so, infantUnitPrice: eb.don, infantTotal: eb.so * eb.don,
      },
      originalPrice: Number(d.subtotal ?? d.amount),
      discountAmount: Number(d.discount ?? 0),
      price: Number(d.amount),
      paymentMethod: 'AT_OFFICE',
      voucher: d.voucherCode ? { code: d.voucherCode } : null,
      notice: d.notice,
      status,
      statusLabel: TRANG_THAI_DON[status] ?? status,
      pointsAwarded: d.pointsAwarded,
      guests: d.guestList
        .sort((a, b) => a.position - b.position)
        .map((g) => ({ position: g.position, fullName: g.fullName, dateOfBirth: ngay(g.dateOfBirth), gender: g.gender, nationalId: g.nationalId, passportNumber: g.passportNumber, phone: g.phone })),
      createdAt: d.createdAt,
      updatedAt: d.bookingUpdatedAt ?? d.createdAt,
    };
  }

  /** Số chỗ còn của một đợt: chỗ trên website trừ khách của các đơn app còn giữ chỗ. null = website không giới hạn. */
  async choCon(tourKey: string, departureKey: string) {
    const t = await this.catalog.chiTietTour(tourKey);
    const day = t.tourDays.find((d) => d.id === departureKey);
    if (!day) throw new BadRequestException('Không tìm thấy ngày khởi hành này');
    const da = await this.prisma.deal.aggregate({ where: { source: 'APP', departureKey, bookingStatus: { in: GIU_CHO }, voidedAt: null }, _sum: { guests: true } });
    const bookedSeats = da._sum.guests ?? 0;
    return { stockQty: day.stock, bookedSeats, availableSeats: day.stock === null ? null : Math.max(0, day.stock - bookedSeats) };
  }

  async datTour(me: AppUser, dto: DatTourInput) {
    const children = dto.children ?? 0;
    const infants = dto.infants ?? 0;
    const soKhach = dto.adults + children + infants;
    if (dto.adults < 1) throw new BadRequestException('Cần ít nhất 1 người lớn');
    if (dto.guests && dto.guests.length > soKhach) throw new BadRequestException('Số hành khách nhiều hơn số khách đã chọn');

    const tour = await this.catalog.chiTietTour(dto.tourKey);
    const day = tour.tourDays.find((d) => d.id === dto.departureKey);
    if (!day) throw new BadRequestException('Ngày khởi hành này không còn trên website, vui lòng chọn ngày khác');
    if (day.departureDate < homNayVN(new Date())) throw new BadRequestException('Ngày khởi hành này đã qua');
    const cho = await this.choCon(dto.tourKey, dto.departureKey);
    if (cho.availableSeats !== null && cho.availableSeats < soKhach) throw new ConflictException(`Đợt này chỉ còn ${cho.availableSeats} chỗ`);

    const gia = await this.pricing.bao({ tourKey: dto.tourKey, dayCode: day.code, guests: dto.adults, children, infants, voucherCode: dto.voucherCode, customerId: me.customerId });
    if (gia.voucherError) throw new BadRequestException(gia.voucherError);

    const kh = await this.prisma.customer.findUniqueOrThrow({ where: { id: me.customerId }, select: { name: true } });
    const now = new Date();
    const ketQua = await this.prisma.$transaction(async (tx) => {
      if (gia.voucher) {
        // Khoá theo voucher rồi đếm lại như khi sale chốt: không vượt tổng lượt và lượt mỗi khách mỗi tháng.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'voucher:' + gia.voucher.id}))`;
        const v = await tx.voucher.findUnique({ where: { id: gia.voucher.id }, select: { maxUses: true, maxUsesPerCustomerMonth: true } });
        if (v?.maxUses && (await this.pricing.daDung(gia.voucher.id, tx)) >= v.maxUses) throw new ConflictException('Voucher này vừa dùng hết lượt');
        if (v?.maxUsesPerCustomerMonth && (await this.pricing.daDungTrongThang(gia.voucher.id, me.customerId, tx)) >= v.maxUsesPerCustomerMonth) {
          throw new ConflictException('Bạn đã dùng đủ số lần voucher này trong tháng');
        }
      }
      const conv = await tx.conversation.upsert({
        where: { customerId_channel: { customerId: me.customerId, channel: 'APP' } },
        create: { customerId: me.customerId, channel: 'APP', status: 'PENDING', lastMessageAt: now },
        update: {},
      });
      // orderCode = id đơn: chatbot đặt hộ khách thì báo lại đơn với mã này, trang quản trị nhận ra đơn đã có, không tạo đơn thứ hai.
      const maDon = randomUUID();
      const don = await tx.deal.create({
        data: {
          id: maDon, orderCode: maDon,
          conversationId: conv.id, customerId: me.customerId, channel: 'APP', source: 'APP', status: 'PENDING',
          bookingStatus: 'PENDING', bookingUpdatedAt: now, createdAt: now, closedAt: now,
          tourKey: gia.tourKey, tourName: gia.tourName, tourCode: day.code, tourImage: gia.image, departureKey: day.id,
          departureDate: new Date(`${day.departureDate}T00:00:00Z`), returnDate: day.returnDate ? new Date(`${day.returnDate}T00:00:00Z`) : null,
          adults: dto.adults, children, infants, guests: soKhach, notice: dto.notice?.trim() || null,
          unitPrice: BigInt(gia.unitPrice), subtotal: BigInt(gia.subtotal), discount: BigInt(gia.discount), amount: BigInt(gia.total),
          voucherId: gia.voucher?.id ?? null, voucherCode: gia.voucher?.code ?? null,
          guestList: dto.guests?.length
            ? { create: dto.guests.map((g, i) => ({ position: i, fullName: g.fullName.trim(), dateOfBirth: ngaySinh(g.dateOfBirth), gender: g.gender ?? null, nationalId: g.nationalId || null, passportNumber: g.passportNumber || null, phone: g.phone || null })) }
            : undefined,
        },
        include: { guestList: true },
      });
      const nguoi = conv.assigneeId ? null : await this.assignment.chia(tx, conv.lastHandlerId);
      const tien = gia.total.toLocaleString('vi-VN');
      const thanhPhan = [`${dto.adults} người lớn`, children && `${children} trẻ em`, infants && `${infants} em bé`].filter(Boolean).join(', ');
      // Đưa hội thoại lên đầu danh sách (chủ dự án yêu cầu): đổi giờ và dòng xem trước.
      const sau = await tx.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: tomTat(`Đặt tour ${gia.tourName}`),
          ...(conv.status === 'CONTACT' ? {} : { status: 'PENDING' as const }),
          ...(nguoi ? { assigneeId: nguoi.id, lastHandlerId: nguoi.id } : {}),
        },
        include: { assignee: { select: { fullName: true } } },
      });
      const ai = nguoi ? ` Hệ thống chia cho ${nguoi.fullName}.` : conv.assigneeId ? '' : ' Chưa có ai đang trực để chia.';
      const log = await tx.message.create({
        data: {
          conversationId: conv.id, senderType: 'SYSTEM', internal: true, createdAt: now,
          text: `Khách đặt ${gia.tourName} trong app (mã tour ${day.code}, khởi hành ${day.departureDate.split('-').reverse().join('/')}), ${thanhPhan}${gia.voucher ? `, voucher ${gia.voucher.code}` : ''}, ${tien} đ.${dto.notice?.trim() ? ` Ghi chú: ${dto.notice.trim()}.` : ''} Đơn chờ sale gọi xác nhận.${ai}`,
        },
      });
      return { don, conv: sau, log };
    });
    this.realtime.emit('message:new', { conversationId: ketQua.conv.id, message: ketQua.log });
    this.realtime.emit('conversation:update', { id: ketQua.conv.id });
    this.realtime.emit('contact:new', { id: ketQua.conv.id, name: kh.name, channel: 'APP', assignee: ketQua.conv.assignee?.fullName ?? null, kind: 'BOOKING' });
    return this.raApp(ketQua.don);
  }

  /** Ngày khởi hành của một tour (website), kèm số chỗ còn sau khi trừ đơn app đang giữ chỗ. */
  async dotKhoiHanh(tourKey: string) {
    const t = await this.catalog.chiTietTour(tourKey);
    const homNay = homNayVN(new Date());
    const dot = t.tourDays.filter((d) => d.departureDate >= homNay);
    const giu = await this.prisma.deal.groupBy({ by: ['departureKey'], where: { source: 'APP', departureKey: { in: dot.map((d) => d.id) }, bookingStatus: { in: GIU_CHO }, voidedAt: null }, _sum: { guests: true } });
    const daDat = new Map(giu.map((g) => [g.departureKey, g._sum.guests ?? 0]));
    return dot.map((d) => ({
      id: d.id, tourCode: d.code, code: d.code, departureDate: d.departureDate, returnDate: d.returnDate, price: d.price,
      availableSeats: d.stock === null ? null : Math.max(0, d.stock - (daDat.get(d.id) ?? 0)), available: d.available,
    }));
  }

  /**
   * Voucher admin tạo (dùng chung trang Voucher), chỉ những mã khách này đang dùng được: còn hạn, còn lượt, đúng hạng thành viên
   * (voucher theo hạng chỉ hiện cho khách đúng hạng đó), chưa dùng đủ lượt trong tháng. Tên trường theo app cũ (title, subtitle, expiry...).
   * `description` tự viết từ điều kiện, không dùng ghi chú nội bộ của admin.
   */
  async voucher(me: AppUser, page = 1, limit = 20) {
    const now = new Date();
    const tk = await this.prisma.appAccount.findUniqueOrThrow({ where: { id: me.id }, select: { earnedPoints: true } });
    const bac = bacThanhVien(tk.earnedPoints).ma;
    const ds = await this.prisma.voucher.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now }, OR: [{ tier: null }, { tier: bac }] },
      orderBy: { endsAt: 'asc' },
      take: 300,
    });
    const ids = ds.map((v) => v.id);
    const [daDung, cuaToi] = await Promise.all([
      this.prisma.deal.groupBy({ by: ['voucherId'], where: { voucherId: { in: ids }, status: 'CONFIRMED', voidedAt: null }, _count: { _all: true } }),
      this.prisma.deal.groupBy({
        by: ['voucherId'],
        where: {
          voucherId: { in: ids }, customerId: me.customerId, voidedAt: null,
          OR: [{ status: 'CONFIRMED', closedAt: { gte: dauThangVN(now) } }, { status: 'PENDING', source: 'APP', createdAt: { gte: dauThangVN(now) } }],
        },
        _count: { _all: true },
      }),
    ]);
    const dem = new Map(daDung.map((x) => [x.voucherId, x._count._all]));
    const demToi = new Map(cuaToi.map((x) => [x.voucherId, x._count._all]));
    const dung = ds.filter(
      (v) => trangThaiVoucher(voucherRule(v), now, dem.get(v.id) ?? 0) === 'ACTIVE' && !(v.maxUsesPerCustomerMonth && (demToi.get(v.id) ?? 0) >= v.maxUsesPerCustomerMonth),
    );
    const items = dung.slice((page - 1) * limit, page * limit).map((v) => {
      const dieuKien = [
        v.scope === 'ALL' ? 'Áp dụng mọi tour' : v.scope === 'TOUR' ? `Chỉ áp dụng tour ${v.tourName ?? ''}`.trim() : `Áp dụng tour ${v.categoryName ?? ''}`.trim(),
        v.tier && `Dành riêng hạng ${tenBac(v.tier)}`,
        v.maxUsesPerCustomerMonth && `Mỗi tháng dùng tối đa ${v.maxUsesPerCustomerMonth} lần (tháng này còn ${v.maxUsesPerCustomerMonth - (demToi.get(v.id) ?? 0)} lần)`,
        'Giảm một lần trên tổng đơn',
      ].filter(Boolean);
      return {
        id: v.id, code: v.code,
        title: `Giảm ${moTaMucGiam(voucherRule(v))}`,
        subtitle: v.tier ? `VOUCHER HẠNG ${(tenBac(v.tier) ?? '').toUpperCase()}` : v.scope === 'ALL' ? 'Áp dụng mọi tour' : v.scope === 'TOUR' ? `Tour ${v.tourName ?? ''}`.trim() : `Tour ${v.categoryName ?? ''}`.trim(),
        tag: v.tier ? `HẠNG ${(tenBac(v.tier) ?? '').toUpperCase()}` : v.scope, type: v.type, value: v.value, maxDiscount: v.maxDiscount === null ? null : Number(v.maxDiscount),
        tourKey: v.tourKey, categoryId: v.categoryId, tier: v.tier, maxUsesPerCustomerMonth: v.maxUsesPerCustomerMonth,
        usedThisMonth: demToi.get(v.id) ?? 0, description: dieuKien.join('. ') + '.',
        expiry: v.endsAt.toISOString(), status: true, max: v.maxUses, used: dem.get(v.id) ?? 0,
      };
    });
    return trangApp(items, dung.length, page, limit);
  }

  async lichSu(me: AppUser, page = 1, limit = 20) {
    const where = { customerId: me.customerId, source: 'APP' as const };
    const [ds, total] = await Promise.all([
      this.prisma.deal.findMany({ where, include: { guestList: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.deal.count({ where }),
    ]);
    return trangApp(ds.map((d) => this.raApp(d)), total, page, limit);
  }

  async chiTiet(me: AppUser, id: string) {
    const d = await this.prisma.deal.findFirst({ where: { id, customerId: me.customerId, source: 'APP' }, include: { guestList: true } });
    if (!d) throw new NotFoundException('Không tìm thấy đơn đặt tour');
    return this.raApp(d);
  }

  /**
   * Sale bấm Đã cọc / Đã thanh toán / Đã hoàn tiền cho đơn đặt từ app. Hoàn tiền thì đơn thôi tính doanh thu.
   * Chờ xác nhận → Đã xác nhận đi qua nút Chốt tour; Đã huỷ qua nút Khách huỷ; Đang đi tour, Hoàn thành do máy tự đổi.
   */
  async doiTrangThai(user: AuthUser, conversationId: string, dealId: string, den: 'DEPOSITED' | 'PAID' | 'REFUNDED') {
    const d = await this.prisma.deal.findFirst({ where: { id: dealId, conversationId, source: 'APP' }, select: { bookingStatus: true, tourName: true, customerId: true } });
    if (!d) throw new NotFoundException('Không tìm thấy đơn đặt từ app này');
    if (!duocChuyenTay(d.bookingStatus, den)) {
      throw new ConflictException(`Không chuyển được từ "${TRANG_THAI_DON[(d.bookingStatus ?? 'PENDING') as TrangThaiDon] ?? d.bookingStatus}" sang "${TRANG_THAI_DON[den]}"`);
    }
    const log = await this.prisma.$transaction(async (tx) => {
      // Điều kiện trạng thái cũ: hai sale bấm cùng lúc thì chỉ một lần đổi được.
      const r = await tx.deal.updateMany({ where: { id: dealId, bookingStatus: d.bookingStatus }, data: { bookingStatus: den, bookingUpdatedAt: new Date(), ...(den === 'REFUNDED' ? { status: 'CANCELLED' as const } : {}) } });
      if (!r.count) throw new ConflictException('Đơn vừa được người khác đổi trạng thái, bạn tải lại nhé');
      await this.notifications.baoDon(tx, { customerId: d.customerId, dealId, tourName: d.tourName, status: den });
      return tx.message.create({ data: { conversationId, senderType: 'SYSTEM', internal: true, text: `${user.fullName} chuyển đơn ${d.tourName} sang "${TRANG_THAI_DON[den]}"` } });
    });
    this.realtime.emit('message:new', { conversationId, message: log });
    this.realtime.emit('conversation:update', { id: conversationId });
    return { ok: true, status: den, statusLabel: TRANG_THAI_DON[den] };
  }

  /** Mỗi giờ: tới ngày khởi hành thì Đang đi tour, qua ngày về thì Hoàn thành và cộng điểm (mỗi đơn chỉ cộng một lần). */
  @Cron(CronExpression.EVERY_HOUR)
  async tuDoi(now = new Date()) {
    const homNay = homNayVN(now);
    const ds = await this.prisma.deal.findMany({
      where: { source: 'APP', voidedAt: null, bookingStatus: { in: ['CONFIRMED', 'DEPOSITED', 'PAID', 'ONGOING'] }, departureDate: { lte: new Date(`${homNay}T00:00:00Z`) } },
      select: { id: true, customerId: true, conversationId: true, tourName: true, amount: true, bookingStatus: true, departureDate: true, returnDate: true, pointsAwarded: true },
      take: 500,
    });
    let doi = 0;
    for (const d of ds) {
      const den = trangThaiTuDong({ status: d.bookingStatus, departureDate: ngay(d.departureDate), returnDate: ngay(d.returnDate) }, homNay);
      if (!den) continue;
      const diem = den === 'COMPLETED' && d.pointsAwarded === null ? diemThuong(Number(d.amount)) : null;
      await this.prisma.$transaction(async (tx) => {
        // Điều kiện bookingStatus cũ: hai máy chủ chạy cùng lúc thì chỉ một bên đổi được và cộng điểm.
        const r = await tx.deal.updateMany({ where: { id: d.id, bookingStatus: d.bookingStatus }, data: { bookingStatus: den, bookingUpdatedAt: now, ...(diem !== null ? { pointsAwarded: diem } : {}) } });
        if (!r.count) return;
        if (diem) await tx.appAccount.updateMany({ where: { customerId: d.customerId }, data: { earnedPoints: { increment: diem } } });
        await this.notifications.baoDon(tx, { customerId: d.customerId, dealId: d.id, tourName: d.tourName, status: den });
        await tx.message.create({ data: { conversationId: d.conversationId, senderType: 'SYSTEM', internal: true, text: `Đơn ${d.tourName} tự chuyển sang "${TRANG_THAI_DON[den]}"${diem ? `, cộng ${diem.toLocaleString('vi-VN')} điểm thưởng cho khách` : ''}` } });
        doi++;
      });
    }
    if (doi) this.log.log(`Tự đổi trạng thái ${doi} đơn đặt từ app`);
    return doi;
  }
}
