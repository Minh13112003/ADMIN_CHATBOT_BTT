import { BadRequestException } from '@nestjs/common';
import { ZaloSyncService } from './zalo-sync.service';

describe('ZaloSyncService', () => {
  const t0 = new Date('2026-11-10T03:00:00Z').getTime();
  const tin = [
    { msgId: 'a', tuKhach: true, text: 'Hi', thoiGian: new Date(t0) },
    { msgId: 'b', tuKhach: false, text: 'Dạ chào anh', thoiGian: new Date(t0 + 60_000) },
    { msgId: 'c', tuKhach: true, text: 'Tour Đà Lạt', thoiGian: new Date(t0 + 120_000) },
  ];
  const tao = (opt: { kenh?: string; daCoMa?: string[]; gan?: { text: string; createdAt: Date; senderType: string }[]; lichSu?: typeof tin } = {}) => {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue({ channel: opt.kenh ?? 'ZALO', customerId: 'k1' }) },
      customerIdentity: { findFirst: jest.fn().mockResolvedValue({ externalId: 'zu1' }) },
      message: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce((opt.daCoMa ?? []).map((m) => ({ externalMessageId: `zalo:${m}` })))
          .mockResolvedValueOnce(opt.gan ?? []),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const zalo = { layLichSu: jest.fn().mockResolvedValue(opt.lichSu ?? tin) };
    const realtime = { emit: jest.fn() };
    return { svc: new ZaloSyncService(prisma as never, zalo as never, realtime as never), prisma, zalo, realtime };
  };

  it('chỉ dùng cho hội thoại Zalo', async () => {
    await expect(tao({ kenh: 'WEB' }).svc.dongBo('c1')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('thêm tin chưa có: khách là CUSTOMER, OA là STAFF gắn nhãn "Zalo OA", giữ giờ gốc, mã zalo:<id>', async () => {
    const { svc, prisma, realtime } = tao();
    await expect(svc.dongBo('c1')).resolves.toEqual({ them: 3, tong: 3 });
    const goi = prisma.message.createMany.mock.calls[0][0];
    expect(goi.data.map((d: { senderType: string }) => d.senderType)).toEqual(['CUSTOMER', 'STAFF', 'CUSTOMER']);
    expect(goi.data[1]).toMatchObject({ staffLabel: 'Zalo OA', externalMessageId: 'zalo:b', createdAt: new Date(t0 + 60_000) });
    expect(goi.skipDuplicates).toBe(true);
    expect(realtime.emit).toHaveBeenCalledWith('conversation:update', { id: 'c1' });
  });
  it('bỏ tin đã có theo mã', async () => {
    const { svc, prisma } = tao({ daCoMa: ['a', 'b'] });
    await expect(svc.dongBo('c1')).resolves.toEqual({ them: 1, tong: 3 });
    expect(prisma.message.createMany.mock.calls[0][0].data).toHaveLength(1);
  });
  it('bỏ tin trùng nội dung và gần giờ dù mã khác (tin nhận trực tiếp qua webhook)', async () => {
    const { svc } = tao({ gan: [{ text: 'Tour Đà Lạt', createdAt: new Date(t0 + 120_000 + 5000), senderType: 'CUSTOMER' }] });
    await expect(svc.dongBo('c1')).resolves.toEqual({ them: 2, tong: 3 });
  });
  it('không có gì mới thì không ghi và không báo làm mới', async () => {
    const { svc, prisma, realtime } = tao({ daCoMa: ['a', 'b', 'c'] });
    await expect(svc.dongBo('c1')).resolves.toEqual({ them: 0, tong: 3 });
    expect(prisma.message.createMany).not.toHaveBeenCalled();
    expect(realtime.emit).not.toHaveBeenCalled();
  });
});
