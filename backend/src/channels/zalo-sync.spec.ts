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

  describe('nhập khách cũ', () => {
    const khach = [
      { userId: 'u1', ten: 'An', anh: 'https://a/1.jpg', gio: new Date(t0 + 5000), text: 'Hi' },
      { userId: 'u2', ten: null, anh: null, gio: new Date(t0), text: '' },
    ];
    const taoNhap = (opt: { daCo?: Record<string, string> } = {}) => {
      const tx = {
        customer: { create: jest.fn().mockResolvedValue({ id: 'kNew' }) },
        customerIdentity: { create: jest.fn().mockResolvedValue({}) },
        conversation: { create: jest.fn().mockResolvedValue({ id: 'cNew' }) },
      };
      const prisma = {
        customerIdentity: {
          findUnique: jest.fn(async ({ where }: { where: { channel_externalId: { externalId: string } } }) => (opt.daCo?.[where.channel_externalId.externalId] ? { customerId: 'kOld' } : null)),
          findFirst: jest.fn().mockResolvedValue({ externalId: 'zu' }),
        },
        conversation: {
          findUnique: jest.fn(async (a: { where: { customerId_channel?: unknown; id?: string } }) => (a.where.customerId_channel ? { id: 'cOld' } : { channel: 'ZALO', customerId: 'k', lastMessageAt: new Date(t0) })),
          update: jest.fn().mockResolvedValue({}),
        },
        message: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      };
      const zalo = { chatGanDay: jest.fn().mockResolvedValue(khach), layLichSu: jest.fn().mockResolvedValue([]), hoSoKhach: jest.fn().mockResolvedValue({ ten: 'Tên từ hồ sơ', anh: null }) };
      const realtime = { emit: jest.fn() };
      return { svc: new ZaloSyncService(prisma as never, zalo as never, realtime as never), prisma, tx, zalo, realtime };
    };
    const chay = async (svc: ZaloSyncService) => {
      svc.batDauNhapKhachCu(300, 0);
      for (let i = 0; i < 50 && svc.layTienDo().dang; i++) await new Promise((r) => setTimeout(r, 5));
      return svc.layTienDo();
    };

    it('tạo khách và hội thoại cho khách chưa có: trạng thái Đã xem, bot, không phân công; thiếu tên thì hỏi hồ sơ', async () => {
      const { svc, tx, zalo } = taoNhap();
      const td = await chay(svc);
      expect(td).toMatchObject({ dang: false, tong: 2, xong: 2, khachMoi: 2, loi: 0 });
      expect(tx.customer.create).toHaveBeenCalledWith({ data: { name: 'An', avatarUrl: 'https://a/1.jpg' } });
      expect(tx.customer.create).toHaveBeenCalledWith({ data: { name: 'Tên từ hồ sơ', avatarUrl: null } });
      expect(tx.conversation.create.mock.calls[0][0].data).toMatchObject({ channel: 'ZALO', status: 'READ', mode: 'BOT' });
      expect(zalo.hoSoKhach).toHaveBeenCalledTimes(1);
    });
    it('khách đã có hội thoại: không tạo thêm', async () => {
      const { svc, tx } = taoNhap({ daCo: { u1: 'x', u2: 'x' } });
      const td = await chay(svc);
      expect(td).toMatchObject({ xong: 2, khachMoi: 0 });
      expect(tx.conversation.create).not.toHaveBeenCalled();
    });
    it('một khách lỗi không làm dừng cả đợt; không chạy hai lần cùng lúc', async () => {
      const { svc, zalo } = taoNhap();
      zalo.layLichSu.mockRejectedValueOnce(new Error('Zalo từ chối')).mockResolvedValue([]);
      const dau = svc.batDauNhapKhachCu(300, 20);
      expect(() => svc.batDauNhapKhachCu(300, 20)).toThrow();
      expect(dau.dang).toBe(true);
      for (let i = 0; i < 100 && svc.layTienDo().dang; i++) await new Promise((r) => setTimeout(r, 5));
      expect(svc.layTienDo()).toMatchObject({ xong: 2, loi: 1, khachMoi: 1 });
    });
    it('lỗi khi lấy danh sách chat: báo lý do, không treo trạng thái đang chạy', async () => {
      const { svc, zalo } = taoNhap();
      zalo.chatGanDay.mockRejectedValue(new Error('Zalo báo lỗi -216'));
      const td = await chay(svc);
      expect(td.dang).toBe(false);
      expect(td.lyDo).toContain('-216');
    });
  });
});
