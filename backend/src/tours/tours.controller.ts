import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PricingService } from './pricing.service';
import { TourCatalogService } from './tour-catalog.service';

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
}

export class QuoteDto {
  @IsOptional() @IsString() @MaxLength(100) tourKey?: string;
  @IsString({ message: 'Chọn ngày khởi hành' }) @MaxLength(60) dayCode: string;
  @Type(() => Number) @IsInt({ message: 'Số khách không hợp lệ' }) @Min(1, { message: 'Số khách phải từ 1' }) @Max(1000) guests: number;
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional() @IsString() @MaxLength(40) voucherCode?: string;
  @IsOptional() @IsUUID() dealId?: string;
  /** Hội thoại đang chốt: để xét voucher theo bậc thành viên và lượt mỗi tháng của khách. */
  @IsOptional() @IsUUID() conversationId?: string;
  /** Có `adults` thì tính người lớn 100%, trẻ em 80%, em bé 40%; `guests` khi đó bị bỏ qua. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Cần ít nhất 1 người lớn' }) @Max(1000) adults?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) children?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) infants?: number;
}

/** Danh mục tour từ benthanhtourist.com qua backend (lưu tạm 1 giờ). Sale, admin phòng, admin toàn quyền. */
@Controller('tours')
export class ToursController {
  constructor(private catalog: TourCatalogService, private pricing: PricingService) {}

  /** Địa điểm: thể loại cụ thể nhất của mỗi tour, kèm số tour. */
  @Get('places')
  places() {
    return this.catalog.diaDiem();
  }

  @Get()
  search(@Query() q: SearchQuery) {
    return this.catalog.tim(q.search ?? '', q.categoryId);
  }

  @Get('by-code/:code')
  async byCode(@Param('code') code: string) {
    const kq = await this.catalog.theoMaDot(code.slice(0, 60));
    if (!kq) throw new NotFoundException('Không tìm thấy ngày khởi hành có mã này trên benthanhtourist.com');
    return kq;
  }

  @Get(':key')
  item(@Param('key') key: string) {
    return this.catalog.chiTietTour(key.slice(0, 100));
  }

  /** Xem trước số tiền khi chốt: giá theo ngày khởi hành × số khách − voucher. Voucher sai trả `voucherError`, không lỗi. */
  @Post('quote')
  @HttpCode(200)
  quote(@Body() dto: QuoteDto) {
    const { adults, children, infants, ...con } = dto;
    return this.pricing.bao(adults !== undefined ? { ...con, guests: adults, children: children ?? 0, infants: infants ?? 0 } : con);
  }
}
