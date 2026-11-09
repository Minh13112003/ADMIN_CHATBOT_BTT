import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { canChangeActive, canResetPassword } from '../common/accounts';

const rong = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value);

class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email: string;
  @IsString() @MinLength(2, { message: 'Nhập họ tên' }) @MaxLength(120) fullName: string;
  @IsString() @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' }) @MaxLength(200) password: string;
  @Transform(rong) @IsOptional() @IsString() @MaxLength(40) employeeCode?: string;
  @Transform(rong) @IsOptional() @IsString() @MaxLength(80) position?: string;
}

class DutyDto {
  @IsBoolean() onDuty: boolean;
}
class ActiveDto { @IsBoolean() isActive: boolean; }
class ResetPasswordDto { @IsString() @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' }) @MaxLength(200) password: string; }

const COT = { id: true, email: true, fullName: true, employeeCode: true, position: true, role: true, isActive: true, onDuty: true, lastLoginAt: true, createdAt: true } as const;

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService, private realtime: RealtimeGateway) {}

  /** Danh sách tài khoản: chỉ admin. */
  @Roles(Role.ADMIN)
  @Get()
  async list() {
    const users = await this.prisma.user.findMany({ select: COT, orderBy: { createdAt: 'desc' } });
    const giu = await this.prisma.conversation.groupBy({ by: ['assigneeId'], where: { assigneeId: { not: null }, status: { in: ['CONTACT', 'PENDING'] } }, _count: { _all: true } });
    return users.map((x) => ({ ...x, holding: giu.find((g) => g.assigneeId === x.id)?._count._all ?? 0 }));
  }

  /** Không có đăng ký công khai: chỉ admin tạo được tài khoản sale. */
  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email này đã có tài khoản');
    if (dto.employeeCode && (await this.prisma.user.findUnique({ where: { employeeCode: dto.employeeCode } })))
      throw new ConflictException('Mã nhân viên này đã được dùng');
    return this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        employeeCode: dto.employeeCode,
        position: dto.position,
        role: Role.SALE,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: COT,
    });
  }

  /** Đồng nghiệp để chọn khi "Nhờ đồng nghiệp". */
  @Get('colleagues')
  colleagues(@CurrentUser() me: AuthUser) {
    return this.prisma.user.findMany({
      where: { role: Role.SALE, isActive: true, id: { not: me.id } },
      select: { id: true, fullName: true, onDuty: true },
      orderBy: { fullName: 'asc' },
    });
  }

  @Patch('me/duty')
  async duty(@CurrentUser() me: AuthUser, @Body() dto: DutyDto) {
    return this.prisma.user.update({ where: { id: me.id }, data: { onDuty: dto.onDuty }, select: { onDuty: true } });
  }

  @Roles(Role.ADMIN)
  @Patch(':id/active')
  async active(@Param('id') id: string, @CurrentUser() me: AuthUser, @Body() dto: ActiveDto) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: COT });
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    const { updated, heldIds } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(738202)`;
      const activeAdmins = await tx.user.count({ where: { role: Role.ADMIN, isActive: true } });
      const error = canChangeActive(me.id, target, dto.isActive, activeAdmins);
      if (error) throw new BadRequestException(error);
      const updated = await tx.user.update({ where: { id }, data: { isActive: dto.isActive, ...(!dto.isActive ? { onDuty: false } : {}) }, select: COT });
      let heldIds: string[] = [];
      if (!dto.isActive) {
        const held = await tx.conversation.findMany({ where: { assigneeId: id, status: { in: ['CONTACT', 'PENDING'] } }, select: { id: true } });
        heldIds = held.map((c) => c.id);
        await tx.conversation.updateMany({ where: { id: { in: held.map((c) => c.id) } }, data: { assigneeId: null, contactAssignedAt: null } });
        if (held.length) await tx.message.createMany({ data: held.map((c) => ({ conversationId: c.id, senderType: 'SYSTEM' as const, internal: true, text: `Tài khoản ${target.fullName} bị khoá` })) });
      }
      return { updated, heldIds };
    });
    if (!dto.isActive) await this.realtime.disconnectUser(id);
    for (const conversationId of heldIds) this.realtime.emit('conversation:update', { id: conversationId });
    return updated;
  }

  @Roles(Role.ADMIN)
  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string, @CurrentUser() me: AuthUser, @Body() dto: ResetPasswordDto) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    const error = canResetPassword(me.id, target);
    if (error) throw new BadRequestException(error);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(dto.password, 12) } });
    return { ok: true };
  }
}
