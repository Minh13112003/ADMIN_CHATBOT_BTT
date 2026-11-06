import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, Injectable, Post, Query, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GIOI_HAN_TEP_TOI_DA } from '../common/attachments';
import { AttachmentsService } from '../storage/attachments.service';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import { Public } from '../auth/auth.decorators';
import { BookingStatusDto, BotReplyDto, CustomerInfoDto, DealDto, HistoryDto, IdentifyDto, InboundDto, InboundFileDto, UpdatesQuery, UsageDto } from './ingest.dto';
import { IngestService } from './ingest.service';

const bam = (s: string) => createHash('sha256').update(s).digest();

@Injectable()
export class IngestKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext) {
    const key = this.config.get<string>('INGEST_API_KEY');
    const got = ctx.switchToHttp().getRequest().headers['x-ingest-key'];
    if (!key || typeof got !== 'string' || !timingSafeEqual(bam(got), bam(key))) throw new UnauthorizedException('Sai khoá ingest');
    return true;
  }
}

/** Cổng cho chatbot bttAI (và kênh Zalo/Facebook sau này) đẩy dữ liệu vào. Xem docs/ingest-api.md. */
@Public()
@SkipThrottle()
@UseGuards(IngestKeyGuard)
@Controller('ingest')
export class IngestController {
  constructor(private svc: IngestService, private tep: AttachmentsService) {}

  @Post('identify')
  @HttpCode(200)
  identify(@Body() dto: IdentifyDto) {
    return this.svc.identify(dto);
  }

  @Post('inbound')
  @HttpCode(200)
  inbound(@Body() dto: InboundDto) {
    return this.svc.inbound(dto);
  }

  /** Khách gửi ảnh hoặc PDF (kèm chữ nếu có). Chatbot chuyển tiếp nguyên file, backend kiểm tra theo nội dung và lưu. */
  @Post('inbound-file')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: GIOI_HAN_TEP_TOI_DA, files: 1 } }))
  async inboundFile(@Body() dto: InboundFileDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa có file');
    let customer: CustomerInfoDto | undefined;
    if (dto.customer) {
      try {
        customer = plainToInstance(CustomerInfoDto, JSON.parse(dto.customer));
      } catch {
        throw new BadRequestException('customer phải là JSON');
      }
      if (validateSync(customer, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException('customer không hợp lệ');
    }
    // Chatbot gửi lại cùng mã thì trả kết quả cũ, không lưu file lần nữa.
    if (dto.externalMessageId && (await this.svc.daCoTin(dto.externalMessageId))) return this.svc.inbound({ channel: dto.channel, externalUserId: dto.externalUserId, text: '', externalMessageId: dto.externalMessageId });
    const luu = await this.tep.luu(file);
    return this.svc.inbound({ channel: dto.channel, externalUserId: dto.externalUserId, text: dto.text ?? '', externalMessageId: dto.externalMessageId, customer }, luu);
  }

  @Post('bot-reply')
  @HttpCode(200)
  botReply(@Body() dto: BotReplyDto) {
    return this.svc.botReply(dto);
  }

  @Post('history')
  @HttpCode(200)
  history(@Body() dto: HistoryDto) {
    return this.svc.history(dto);
  }

  @Post('usage')
  @HttpCode(204)
  usage(@Body() dto: UsageDto) {
    return this.svc.usage(dto);
  }

  @Post('deal')
  @HttpCode(200)
  deal(@Body() dto: DealDto) {
    return this.svc.deal(dto);
  }

  @Post('booking-status')
  @HttpCode(200)
  bookingStatus(@Body() dto: BookingStatusDto) {
    return this.svc.bookingStatus(dto);
  }

  @Get('updates')
  updates(@Query() q: UpdatesQuery) {
    return this.svc.updates(q.channel, q.externalUserId, q.after);
  }
}
