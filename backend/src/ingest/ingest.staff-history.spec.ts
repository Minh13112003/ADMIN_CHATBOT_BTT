import { IngestService } from './ingest.service';

describe('IngestService.staffHistory', () => {
  const tao = (conv: unknown = { id: 'c1' }, identity: unknown = { customerId: 'k1' }) => {
    const prisma = {
      customerIdentity: { findUnique: jest.fn().mockResolvedValue(identity) },
      conversation: { findUnique: jest.fn().mockResolvedValue(conv), update: jest.fn() },
      message: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, svc: new IngestService(prisma as never, {} as never, {} as never, {} as never, {} as never) };
  };

  it('chỉ lấy tin nhân viên, không lấy log nội bộ; trả cũ trước mới sau', async () => {
    const { svc, prisma } = tao();
    const t = (s: number) => new Date(Date.UTC(2026, 10, 18, 1, 0, s));
    prisma.message.findMany.mockResolvedValue([
      { text: 'mới', createdAt: t(2), attachmentType: null, attachmentName: null },
      { text: 'cũ', createdAt: t(1), attachmentType: 'application/pdf', attachmentName: 'ct.pdf' },
    ]);
    const kq = await svc.staffHistory('ZALO', 'u1', '2026-11-18T00:00:00.000Z');
    expect(prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ conversationId: 'c1', internal: false, senderType: 'STAFF' });
    expect(kq.items.map((m) => m.text)).toEqual(['cũ', 'mới']);
    expect(kq.items[0]).toEqual({ createdAt: t(1), text: 'cũ', attachmentType: 'application/pdf', attachmentName: 'ct.pdf' });
  });

  it('chỉ đọc: không cập nhật hội thoại (không đánh dấu khách đã xem)', async () => {
    const { svc, prisma } = tao({ id: 'c1', mode: 'STAFF', customerSeenAt: null });
    await svc.staffHistory('ZALO', 'u1');
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('khách hoặc hội thoại chưa có thì trả rỗng; mốc sai thì báo lỗi', async () => {
    expect(await tao(null, null).svc.staffHistory('ZALO', 'x')).toEqual({ items: [] });
    expect(await tao(null).svc.staffHistory('ZALO', 'x')).toEqual({ items: [] });
    await expect(tao().svc.staffHistory('ZALO', 'u1', 'không-phải-ngày')).rejects.toThrow('Mốc thời gian không hợp lệ');
  });
});
