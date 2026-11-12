import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

/** Xoá hội thoại (admin): kiểm tra luồng bằng database giả, không chạm database thật. */
describe('ConversationsService.xoaHoiThoai', () => {
  const admin = { id: 'a1', role: 'ADMIN', fullName: 'Admin', departmentId: null, scopeIds: [] } as never;
  const tao = (opt: { daCo?: boolean; donChot?: number; conLai?: number; files?: string[] } = {}) => {
    const tx = {
      conversation: { delete: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(opt.conLai ?? 0) },
      customer: { delete: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(opt.daCo === false ? null : { id: 'c1', customerId: 'k1', customer: { name: 'Khách thử' } }) },
      deal: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: opt.donChot ?? 0 }, _sum: { amount: BigInt(5_000_000) } }) },
      message: { findMany: jest.fn().mockResolvedValue((opt.files ?? []).map((attachmentPath) => ({ attachmentPath }))) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const tep = { xoaTep: jest.fn().mockResolvedValue(undefined) };
    const realtime = { emit: jest.fn() };
    const svc = new ConversationsService(prisma as never, {} as never, realtime as never, tep as never, {} as never, {} as never);
    return { svc, prisma, tx, tep, realtime };
  };

  it('hội thoại không tồn tại: 404', async () => {
    const { svc } = tao({ daCo: false });
    await expect(svc.xoaHoiThoai(admin, 'c1', false)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('có đơn đã chốt mà không force: 409 HAS_DEALS, chưa xoá gì', async () => {
    const { svc, tx } = tao({ donChot: 2 });
    await expect(svc.xoaHoiThoai(admin, 'c1', false)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.conversation.delete).not.toHaveBeenCalled();
  });
  it('có đơn đã chốt và force: xoá', async () => {
    const { svc, tx } = tao({ donChot: 2 });
    await expect(svc.xoaHoiThoai(admin, 'c1', true)).resolves.toMatchObject({ ok: true });
    expect(tx.conversation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
  it('khách không còn hội thoại nào: xoá luôn khách; còn thì giữ khách', async () => {
    const a = tao({ conLai: 0 });
    await expect(a.svc.xoaHoiThoai(admin, 'c1', false)).resolves.toMatchObject({ customerDeleted: true });
    expect(a.tx.customer.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    const b = tao({ conLai: 1 });
    await expect(b.svc.xoaHoiThoai(admin, 'c1', false)).resolves.toMatchObject({ customerDeleted: false });
    expect(b.tx.customer.delete).not.toHaveBeenCalled();
  });
  it('xoá file đính kèm và báo giao diện làm mới', async () => {
    const { svc, tep, realtime } = tao({ files: ['a/1.jpg', 'a/2.pdf'] });
    await svc.xoaHoiThoai(admin, 'c1', false);
    expect(tep.xoaTep).toHaveBeenCalledTimes(2);
    expect(realtime.emit).toHaveBeenCalledWith('conversation:update', { id: 'c1' });
  });
});
