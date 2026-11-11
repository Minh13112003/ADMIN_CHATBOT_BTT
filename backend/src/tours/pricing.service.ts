import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { chuanHoaMaTour } from '../common/deals';
import { chuanHoaMaVoucher, moTaMucGiam, tinhGiam, type VoucherRule } from '../common/vouchers';
import { Prisma, type Voucher } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TourCatalogService, type TourDay } from './tour-catalog.service';

export type QuoteInput = { tourKey?: string; dayCode: string; guests: number; voucherCode?: string; dealId?: string; conversationId?: string };

export type Quote = {
  tourKey: string | null;
  tourName: string;
  place: string | null;
  image: string | null;
  categoryIds: number[];
  dayCode: string;
  departureDate: string | null;
  unitPrice: number;
  guests: number;
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

    const subtotal = unitPrice * input.guests;
    let voucher: Quote['voucher'] = null;
    let voucherError: string | null = null;
    let discount = 0;
    if (input.voucherCode?.trim()) {
      const code = chuanHoaMaVoucher(input.voucherCode);
      const v = code ? await this.prisma.voucher.findUnique({ where: { code } }) : null;
      if (!v) voucherError = 'Mã voucher không tồn tại';
      else {
        const kq = tinhGiam(voucherRule(v), { subtotal, tourKey, categoryIds, now: new Date(), used: await this.daDung(v.id, this.prisma, deal?.id) });
        if (kq.ok) {
          discount = kq.discount;
          voucher = { id: v.id, code: v.code, label: moTaMucGiam(voucherRule(v)) };
        } else voucherError = kq.error;
      }
    }
    return {
      tourKey, tourName, place, image, categoryIds, dayCode,
      departureDate: day?.departureDate ?? (deal?.departureDate ? deal.departureDate.toISOString().slice(0, 10) : null),
      unitPrice, guests: input.guests, subtotal, voucher, voucherError, discount, total: subtotal - discount, priceFromDeal,
    };
  }
}
