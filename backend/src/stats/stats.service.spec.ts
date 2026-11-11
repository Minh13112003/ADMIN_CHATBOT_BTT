import { dauKy, StatsService } from './stats.service';

describe('dauKy theo giờ Việt Nam', () => {
  const now = new Date('2026-11-05T20:00:00Z'); // 03:00 ngày 06/11 giờ VN
  it('hôm nay bắt đầu từ 00:00 giờ VN', () => expect(dauKy('today', now).toISOString()).toBe('2026-11-05T17:00:00.000Z'));
  it('7 ngày tính cả hôm nay', () => expect(dauKy('week', now).toISOString()).toBe('2026-10-30T17:00:00.000Z'));
  it('từ trước tới nay không giới hạn', () => expect(dauKy('all', now).getTime()).toBe(0));
  it('tháng này từ ngày 1 giờ VN', () => expect(dauKy('month', now).toISOString()).toBe('2026-10-31T17:00:00.000Z'));
});

describe('chi tiết báo cáo theo phòng ban', () => {
  const create = () => {
    const prisma = { deal: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ id: 'd1', amount: 39980000n, conversation: { assignee: { department: { name: 'FIT' } } } }]) } };
    return { prisma, service: new StatsService(prisma as never, {} as never) };
  };
  it('giữ phạm vi phòng khi tìm khách hoặc lọc sale; phân trang ở máy chủ', async () => {
    const { prisma, service } = create();
    const result = await service.getOrders('month', ['fit'], { search: 'Trung Quốc', staffId: 'sale-1', page: 2 });
    const args = prisma.deal.findMany.mock.calls[0][0];
    expect(args.where.conversation).toEqual({ OR: [{ assignee: { departmentId: { in: ['fit'] } } }] });
    expect(args.where.closedById).toBe('sale-1');
    expect(args.where.AND[0]).toMatchObject({ status: 'CONFIRMED', voidedAt: null });
    expect(args.where.AND[1].OR).toHaveLength(4);
    expect(args.skip).toBe(20);
    expect(prisma.deal.count.mock.calls[0][0].where).toEqual(args.where);
    expect(result.items[0].amount).toBe(39980000);
    expect(result.items[0].departmentName).toBe('FIT');
  });
  it('phạm vi rỗng không biến thành toàn hệ thống; đơn vô hiệu nằm trong nhóm hủy', async () => {
    const { prisma, service } = create();
    await service.getOrders('all', [], { status: 'CANCELLED' });
    const where = prisma.deal.findMany.mock.calls[0][0].where;
    expect(where.conversation).toEqual({ OR: [{ assignee: { departmentId: { in: [] } } }] });
    expect(where.AND[0].OR).toEqual([{ status: 'CANCELLED' }, { voidedAt: { not: null } }]);
  });
});

describe('chỉ số khách và đơn không trộn đơn vị', () => {
  it('một khách có hai đơn chỉ được tính một khách chốt của sale, tổng hủy không bị giới hạn top 10', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ customers: 4n, phones: 3n, responded: 2n, converted: 1n }]).mockResolvedValueOnce([{ input: 0n, output: 0n }]),
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 's1', fullName: 'Sale FIT', department: { name: 'FIT' }, onDuty: true, _count: { assigned: 0 } }]) },
      deal: {
        findMany: jest.fn().mockResolvedValue([1, 2].map(() => ({ channel: 'WEB', tourName: 'Tour A', guests: 2, amount: 1000000n, closedById: 's1', customerId: 'c1' }))),
        groupBy: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 12 }, (_, i) => ({ tourName: `Tour ${i}`, _count: { _all: 1 }, _sum: { amount: 100n } }))),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { amount: 0n } }),
      },
      contactResponse: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new StatsService(prisma as never, { get: () => undefined } as never);
    const result = await service.get('month', ['fit']) as { closeRate: number; closed: number; staff: { closedCustomers: number; closed: number; guests: number }[]; cancelled: { count: number } };
    expect(result.closed).toBe(2);
    expect(result.closeRate).toBe(.25);
    expect(result.staff[0]).toMatchObject({ closedCustomers: 1, closed: 2, guests: 4 });
    expect(result.cancelled.count).toBe(12);
  });
});
