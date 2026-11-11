import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { locHoiThoai, phamViPhong } from '../common/scope';

/** Admin phòng và Digital chỉ chạm được hội thoại trong phạm vi phòng của mình; Digital chỉ được xem. Phạm vi lấy từ phiên đăng nhập, không tin trình duyệt. */
@Injectable()
export class ConversationScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user || (user.role !== Role.DEPT_ADMIN && user.role !== Role.DIGITAL)) return true;
    if (user.role === Role.DIGITAL && req.method !== 'GET') throw new ForbiddenException('Tài khoản Digital chỉ được xem');
    const id = req.params?.id;
    if (!id) return true;
    const scope = phamViPhong(user);
    const co = await this.prisma.conversation.count({ where: { id, ...locHoiThoai(scope) } });
    if (!co) throw new NotFoundException('Không tìm thấy hội thoại');
    return true;
  }
}
