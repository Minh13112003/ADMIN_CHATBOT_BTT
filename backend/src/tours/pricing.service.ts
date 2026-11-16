import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { bacThanhVien, dauThangVN, giaTheoKhach } from '../common/app-booking';
import { chuanHoaMaTour } from '../common/deals';
import { chuanHoaMaVoucher, moTaMucGiam, tinhGiam, type VoucherRule } from '../common/vouchers';
import { Prisma, type Voucher } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TourCatalogService, type TourDay } from './tour-catalog.service';

/** `children`, `infants`: đơn đặt từ app tính trẻ em 80%, em bé 40% (common/app-booking.ts); khi có thì `guests` là số người lớn. */
export type QuoteInput = {
  tourKey?: string; dayCode: string; guests: number; children?: number; infants?: number; voucherCode?: string; dealId?: string; conversationId?: string;
  /** Khách dùng voucher (để xét voucher theo bậc và lượt mỗi tháng). Không có thì lấy theo hội thoại hoặc đơn. */
  customerId?: string;
};

export type Quote = {
  tourKey: string | null;
  tourName: string;
  place: string | null;
  image: string | null;
  categoryIds: number[];
  dayCode: string;
  departureDate: string | null;
  unitPrice: number;
  /** Tổng số khách. */
  guests: number;
  adults: number;
  children: number;
  infants: number;
  /** Giá/người của trẻ em (80%) và em bé (40%). */
  childPrice: number;
  infantPrice: number;
  subtotal: number;
  voucher: { id: string; code: string; label: string } | null;
  voucherError: string | null;
  discount: number;
  total: number;
  /** Giá lấy từ đơn khách đã đặt vì ngày khởi hành không còn trên website. */
  priceFromDeal: boolean;
};

export function voucherRule(v: Voucher): VoucherRule {
  return {
    type: v.type,
    value: v.value,
    maxDiscount: v.maxDiscount === null ? null : Number(v.maxDiscount),
    scope: v.scope,
    tourKey: v.tourKey,
    categoryId: v.categoryId,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    maxUses: v.maxUses,
    isActive: v.isActive,
    tier: v.tier,
    maxUsesPerCustomerMonth: v.maxUsesPerCustomerMonth,
  };
}

/**
 * Tính tiền khi chốt tour: giá theo ngày khởi hành lấy từ API tour, nhân số khách, trừ voucher.
 * Sale không gửi giá hay tổng tiền; backend tự tính để không ai sửa được giá.
 */
@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService, private catalog: TourCatalogService) {}

  /** Số lần voucher đã dùng: đơn đã chốt còn tính doanh thu. Không lưu bộ đếm để mở lại hội thoại tự trả lượt. */
  daDung(voucherId: string, tx: Prisma.TransactionClient = this.prisma, truDealId?: string) {
    return tx.deal.count({ where: { voucherId, status: 'CONFIRMED', voidedAt: null, ...(truDealId ? { id: { not: truDealId } } : {}) } });
  }

  /**
   * Số lần một khách đã dùng voucher trong tháng này (giờ Việt Nam): đơn đã chốt còn tính, cộng đơn app đang chờ xác nhận
   * (giữ lượt để khách không đặt nhiều đơn cùng lúc vượt giới hạn). Không đếm đơn đang được xác nhận.
   */
  daDungTrongThang(voucherId: string, customerId: string, tx: Prisma.TransactionClient = this.prisma, truDealId?: string, now = new Date()) {
    const dau = dauThangVN(now);
    return tx.deal.count({
      where: {
        voucherId, customerId, voidedAt: null,
        ...(truDealId ? { id: { not: truDealId } } : {}),
        OR: [{ status: 'CONFIRMED', closedAt: { gte: dau } }, { status: 'PENDING', source: 'APP', createdAt: { gte: dau } }],
      },
    });
  }

  /** Bậc hiện tại của khách theo điểm tài khoản app. Khách chưa có tài khoản app thì không có bậc (null). */
  async bacCuaKhach(customerId: string, tx: Prisma.TransactionClient = this.prisma): Promise<string | null> {
    const t = await tx.appAccount.findUnique({ where: { customerId }, select: { earnedPoints: true, isActive: true } });
    return t?.isActive ? bacThanhVien(t.earnedPoints).ma : null;
  }

  async bao(input: QuoteInput): Promise<Quote> {
    const dayCode = chuanHoaMaTour(input.dayCode);
    if (!dayCode) throw new BadRequestException('Mã tour chưa đúng. Nhập mã đợt khởi hành, ví dụ A06.FIT.TW.070227.A');
    const deal = input.dealId
      ? await this.prisma.deal.findFirst({ where: { id: input.dealId, ...(input.conversationId ? { conversationId: input.conversationId } : {}) } })
      : null;
    if (input.dealId && !deal) throw new NotFoundException('Không tìm thấy đơn này');

    let tourKey: string | null = null;
    let tourName = deal?.tourName ?? '';
    let place: string | null = null;
    let image: string | null = null;
    let categoryIds: number[] = [];
    let day: TourDay | null = null;
    if (input.tourKey) {
      const t = await this.catalog.chiTietTour(input.tourKey);
      day = t.tourDays.find((d) => d.code === dayCode) ?? null;
      ({ key: tourKey, name: tourName, image, categoryIds } = t);
      place = t.place?.name ?? null;
    } else {
      const thay = await this.catalog.theoMaDot(dayCode).catch(() => null);
      if (thay) {
        day = thay.day;
        ({ key: tourKey, name: tourName, image, categoryIds } = thay.tour);
        place = thay.tour.place?.name ?? null;
      }
    }

    let unitPrice: number;
    let priceFromDeal = false;
    if (day) {
      if (!day.price) throw new BadRequestException('Ngày khởi hành này chưa có giá trên website');
      unitPrice = day.price;
    } else if (deal && deal.tourCode?.toUpperCase() === dayCode && deal.guests > 0) {
      // Đơn khách đặt qua chatbot mà đợt đã qua hoặc website tạm hỏng: giữ giá/người lúc khách đặt.
      unitPrice = deal.unitPrice !== null ? Number(deal.unitPrice) : Math.round(Number(deal.amount) / deal.guests);
      tourKey = tourKey ?? deal.tourKey;
      priceFromDeal = true;
    } else {
      throw new BadRequestException('Không tìm thấy ngày khởi hành có mã này trên benthanhtourist.com');
    }

    const subtotal =
      input.children !== undefined || input.infants !== undefined
        ? giaTheoKhach(unitPrice, { adults: input.guests, children: input.children ?? 0, infants: input.infants ?? 0 })
        : unitPrice * input.guests;
    let voucher: Quote['voucher'] = null;
    let voucherError: string | null = null;
    let discount = 0;
    if (input.voucherCode?.trim()) {
      const code = chuanHoaMaVoucher(input.voucherCode);
      const v = code ? await this.prisma.voucher.findUnique({ where: { code } }) : null;
      if (!v) voucherError = 'Mã voucher không tồn tại';
      else {
        const now = new Date();
        let customerTier: string | null = null;
        let usedByCustomerThisMonth = 0;
        if (v.tier || v.maxUsesPerCustomerMonth) {
          const customerId =
            input.customerId ??
            deal?.customerId ??
            (input.conversationId ? (await this.prisma.conversation.findUnique({ where: { id: input.conversationId }, select: { customerId: true } }))?.customerId : undefined);
          if (customerId) {
            customerTier = await this.bacCuaKhach(customerId);
            usedByCustomerThisMonth = await this.daDungTrongThang(v.id, customerId, this.prisma, deal?.id, now);
          }
        }
        const kq = tinhGiam(voucherRule(v), { subtotal, tourKey, categoryIds, now, used: await this.daDung(v.id, this.prisma, deal?.id), customerTier, usedByCustomerThisMonth });
        if (kq.ok) {
          discount = kq.discount;
          voucher = { id: v.id, code: v.code, label: moTaMucGiam(voucherRule(v)) };
        } else voucherError = kq.error;
      }
    }
    return {
      tourKey, tourName, place, image, categoryIds, dayCode,
      departureDate: day?.departureDate ?? (deal?.departureDate ? deal.departureDate.toISOString().slice(0, 10) : null),
      unitPrice, guests: input.guests + (input.children ?? 0) + (input.infants ?? 0),
      adults: input.guests, children: input.children ?? 0, infants: input.infants ?? 0,
      childPrice: Math.round(unitPrice * 0.8), infantPrice: Math.round(unitPrice * 0.4), subtotal, voucher, voucherError, discount, total: subtotal - discount, priceFromDeal,
    };
  }
}
