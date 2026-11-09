import { Body, ConflictException, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AutoReplyType, Channel } from '../generated/prisma/client';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { khopTuKhoa, RuleInput } from '../common/auto-reply';
import { doiGapNhanVien } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class TemplateDto {
  @IsString() @MinLength(1, { message: 'Nhập tên mẫu' }) @MaxLength(80) title: string;
  @IsString() @MinLength(1, { message: 'Nhập nội dung' }) @MaxLength(2000) body: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9_-]{1,20}$/, { message: 'Phím tắt chỉ gồm chữ thường không dấu, số, gạch ngang hoặc gạch dưới (tối đa 20 ký tự)' }) shortcut?: string;
  @IsOptional() @IsString() @MaxLength(30) category?: string;
}

class RuleDto {
  @IsString() @MinLength(1, { message: 'Nhập tên quy tắc' }) @MaxLength(80) name: string;
  @IsEnum(AutoReplyType) type: AutoReplyType;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsString() @MinLength(1, { message: 'Nhập nội dung' }) @MaxLength(2000) body: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsEnum(Channel, { each: true }) channels?: Channel[];
}

class TestDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

class RulePatchDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsEnum(AutoReplyType) type?: AutoReplyType;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

@Controller('templates')
export class TemplatesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.quickTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: TemplateDto) {
    return this.luu(() => this.prisma.quickTemplate.create({ data: { ...this.truong(dto), createdById: me.id } }));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateDto) {
    return this.luu(() => this.prisma.quickTemplate.update({ where: { id }, data: this.truong(dto) }));
  }

  /** Nhân viên chọn mẫu để chèn vào ô nhập: tăng số lần dùng. */
  @Post(':id/use')
  @HttpCode(204)
  async use(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.quickTemplate.update({ where: { id }, data: { useCount: { increment: 1 } } });
  }

  private truong(dto: TemplateDto) {
    return {
      title: dto.title.trim(),
      body: dto.body.trim(),
      shortcut: dto.shortcut?.trim() || null,
      category: dto.category?.trim() || null,
    };
  }

  private async luu<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Phím tắt này đã có mẫu khác dùng');
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.quickTemplate.delete({ where: { id } });
  }
}

@Controller('auto-replies')
export class AutoRepliesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.autoReplyRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post()
  create(@Body() dto: RuleDto) {
    const keywords = (dto.keywords ?? []).map((k) => k.trim()).filter(Boolean);
    return this.prisma.autoReplyRule.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        keywords: dto.type === 'KEYWORD' ? keywords : [],
        body: dto.body.trim(),
        ...(dto.channels ? { channels: dto.channels } : {}),
      },
    });
  }

  /** Ô "Thử một câu của khách": cho biết hệ thống sẽ xử lý câu đó thế nào, không ghi gì vào DB. */
  @Post('test')
  @HttpCode(200)
  async test(@Body() dto: TestDto) {
    if (doiGapNhanVien(dto.text)) return { kind: 'CONTACT' };
    const rules = (await this.prisma.autoReplyRule.findMany({ where: { enabled: true } })) as RuleInput[];
    const r = rules.find((x) => x.type === 'KEYWORD' && khopTuKhoa(x, dto.text));
    return r ? { kind: 'RULE', name: r.name, body: r.body } : { kind: 'BOT' };
  }

  @Patch(':id')
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RulePatchDto) {
    return this.prisma.autoReplyRule.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.autoReplyRule.delete({ where: { id } });
  }
}
