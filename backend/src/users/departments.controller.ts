import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../generated/prisma/client';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { phamViPhong } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

class DepartmentDto {
  @IsString() @MinLength(2, { message: 'Nhập tên phòng ban' }) @MaxLength(60) name: string;
}

@Controller('departments')
export class DepartmentsController {
  constructor(private prisma: PrismaService) {}

  /** Admin thấy mọi phòng; admin phòng chỉ thấy phòng mình; Digital thấy các phòng được cấp (để lọc báo cáo). */
  @Roles(Role.ADMIN, Role.DEPT_ADMIN, Role.DIGITAL)
  @Get()
  async list(@CurrentUser() me: AuthUser) {
    const pham = phamViPhong(me);
    const rows = await this.prisma.department.findMany({
      where: pham === null ? {} : { id: { in: pham } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
    return rows.map((d) => ({ id: d.id, name: d.name, members: d._count.users }));
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: DepartmentDto) {
    const name = dto.name.trim();
    if (await this.prisma.department.findUnique({ where: { name } })) throw new ConflictException('Phòng ban này đã có');
    return this.prisma.department.create({ data: { name }, select: { id: true, name: true } });
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async rename(@Param('id') id: string, @Body() dto: DepartmentDto) {
    const name = dto.name.trim();
    if (!(await this.prisma.department.findUnique({ where: { id } }))) throw new NotFoundException('Không tìm thấy phòng ban');
    const trung = await this.prisma.department.findUnique({ where: { name } });
    if (trung && trung.id !== id) throw new BadRequestException('Tên phòng ban đã có');
    return this.prisma.department.update({ where: { id }, data: { name }, select: { id: true, name: true } });
  }
}
