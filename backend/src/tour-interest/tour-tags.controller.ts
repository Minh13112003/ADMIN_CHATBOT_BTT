import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { ConversationScopeGuard } from '../conversations/scope.guard';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TourCatalogService } from '../tours/tour-catalog.service';

class TagDto {
  @IsString({ message: 'Chọn tour' }) @MaxLength(100) tourKey: string;
  @IsUUID('all', { message: 'Chọn một tin nhắn làm bằng chứng' }) messageId: string;
}

/**
 * Nhãn "tour quan tâm" của một hội thoại. Mỗi nhãn ghim đúng một tin; cùng tour gắn lại sau là nhãn mới (Lần 2...).
 * ConversationScopeGuard giới hạn admin phòng và Digital trong phạm vi phòng; Digital chỉ xem.
 */
@Controller('conversations/:id/tour-tags')
@UseGuards(ConversationScopeGuard)
export class TourTagsController {
  constructor(private prisma: PrismaService, private catalog: TourCatalogService, private realtime: RealtimeGateway) {}

  @Get()
  @Roles(Role.SALE, Role.ADMIN, Role.DEPT_ADMIN, Role.DIGITAL)
  async list(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.prisma.tourInterestTag.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        createdBy: { select: { fullName: true } },
        message: { select: { id: true, text: true, senderType: true, staffLabel: true, createdAt: true } },
      },
    });
    const lan = new Map<string, number>();
    return rows
      .map((r) => {
        const n = (lan.get(r.tourKey) ?? 0) + 1;
        lan.set(r.tourKey, n);
        return { id: r.id, tourKey: r.tourKey, tourName: r.tourName, categoryName: r.categoryName, createdAt: r.createdAt, createdBy: r.createdBy, time: n, message: r.message };
      })
      .reverse();
  }

  private async log(id: string, text: string) {
    const m = await this.prisma.message.create({ data: { conversationId: id, senderType: 'SYSTEM', internal: true, text }, select: { id: true, senderType: true, text: true, internal: true, createdAt: true } });
    this.realtime.emit('message:new', { conversationId: id, message: { ...m, attachment: null } });
    this.realtime.emit('conversation:update', { id });
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TagDto) {
    const msg = await this.prisma.message.findFirst({ where: { id: dto.messageId, conversationId: id }, select: { id: true, internal: true } });
    if (!msg) throw new NotFoundException('Không tìm thấy tin nhắn trong hội thoại này');
    if (msg.internal) throw new BadRequestException('Không ghim được ghi chú nội bộ, hãy chọn tin của khách hoặc sale');
    // Tên tour và địa điểm lấy từ danh mục ở backend, không tin chữ trình duyệt gửi.
    const { tours } = await this.catalog.danhMuc();
    const t = tours.get(dto.tourKey) ?? (await this.catalog.chiTietTour(dto.tourKey));
    const tag = await this.prisma.tourInterestTag.create({
      data: { conversationId: id, messageId: msg.id, tourKey: t.key, tourName: t.name, categoryId: t.place?.id ?? null, categoryName: t.place?.name ?? null, createdById: me.id },
    });
    await this.log(id, `${me.fullName} gắn tour quan tâm: ${t.name}`);
    return tag;
  }

  @Delete(':tagId')
  async remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('tagId', ParseUUIDPipe) tagId: string) {
    const tag = await this.prisma.tourInterestTag.findFirst({ where: { id: tagId, conversationId: id } });
    if (!tag) throw new NotFoundException('Không tìm thấy nhãn');
    await this.prisma.tourInterestTag.delete({ where: { id: tagId } });
    await this.log(id, `${me.fullName} gỡ nhãn tour quan tâm: ${tag.tourName}`);
    return { ok: true };
  }
}
