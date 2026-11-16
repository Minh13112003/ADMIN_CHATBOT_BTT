import { ConflictException } from '@nestjs/common';
import { AppBookingsService } from './app-bookings.service';

const TOUR = {
  key: 'tk1', name: 'Tour Nhật Bản', image: 'https://img/a.jpg', categoryIds: [1], place: null,
  tourDays: [{ id: 'd1', code: 'A06.FIT.JP.010127.A', departureDate: '2099-01-01', returnDate: '2099-01-05', price: 10_000_000, stock: 10, available: true }],
};

function dung(daDat = 0) {
  const tx = {
    conversation: {
      upsert: jest.fn(async () => ({ id: 'cv1', status: 'READ', assigneeId: null, lastHandlerId: null })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'cv1', assignee: { fullName: 'Thảo' }, ...data })),
    },
    deal: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'dl1', guestList: [], bookingUpdatedAt: null })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    message: { create: jest.fn(async ({ data }: { data: unknown }) => data) },
    appAccount: { updateMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    customer: { findUniqueOrThrow: jest.fn(async () => ({ name: 'Nguyễn Văn An' })) },
    deal: { ...tx.deal, aggregate: jest.fn(async () => ({ _sum: { guests: daDat } })), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (f: (t: typeof tx) => unknown) => f(tx)),
  };
  const catalog = { chiTietTour: jest.fn(async () => TOUR) };
  const pricing = {
    bao: jest.fn(async (i: { guests: number; children?: number; infants?: number }) => ({
      tourKey: 'tk1', tourName: 'Tour Nhật Bản', image: 'https://img/a.jpg', unitPrice: 10_000_000, guests: i.guests,
      subtotal: 10_000_000 * i.guests + 8_000_000 * (i.children ?? 0), discount: 0, total: 10_000_000 * i.guests + 8_000_000 * (i.children ?? 0), voucher: null, voucherError: null,
    })),
  };
  const assignment = { chia: jest.fn(async () => ({ id: 'u1', fullName: 'Thảo' })) };
  const realtime = { emit: jest.fn() };
  const notifications = { baoDon: jest.fn() };
  const svc = new AppBookingsService(prisma as never, catalog as never, pricing as never, assignment as never, realtime as never, notifications as never);
  return { svc, prisma, tx, pricing, realtime, notifications };
}

const me = { id: 'a1', customerId: 'c1' };

describe('AppBookingsService', () => {
  it('đặt tour: tạo đơn chờ xác nhận, hội thoại lên đầu ở trạng thái Chờ xử lý, chia sale, báo nhân viên', async () => {
    const { svc, tx, pricing, realtime } = dung();
    const r = await svc.datTour(me, { tourKey: 'tk1', departureKey: 'd1', adults: 2, children: 1, guests: [{ fullName: 'Nguyễn Văn An', dateOfBirth: '1990-01-02' }] });
    expect(pricing.bao).toHaveBeenCalledWith(expect.objectContaining({ dayCode: 'A06.FIT.JP.010127.A', guests: 2, children: 1, infants: 0, customerId: 'c1' }));
    const don = (tx.deal.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(don).toMatchObject({ source: 'APP', status: 'PENDING', bookingStatus: 'PENDING', guests: 3, channel: 'APP' });
    const hoiThoai = (tx.conversation.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(hoiThoai).toMatchObject({ status: 'PENDING', assigneeId: 'u1' });
    expect(hoiThoai.lastMessageAt).toBeInstanceOf(Date);
    expect(realtime.emit).toHaveBeenCalledWith('contact:new', expect.objectContaining({ kind: 'BOOKING' }));
    expect(r).toMatchObject({ status: 'PENDING', statusLabel: 'Chờ xác nhận', price: 28_000_000 });
  });

  it('hết chỗ thì từ chối', async () => {
    const { svc } = dung(9);
    await expect(svc.datTour(me, { tourKey: 'tk1', departureKey: 'd1', adults: 2 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('máy tự đổi: qua ngày về thì Hoàn thành và cộng điểm 1.000 đ = 1 điểm, chỉ một lần', async () => {
    const { svc, prisma, tx, notifications } = dung();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'dl1', customerId: 'c1', conversationId: 'cv1', tourName: 'Tour Nhật Bản', amount: BigInt(28_000_000), bookingStatus: 'DEPOSITED', departureDate: new Date('2026-01-01'), returnDate: new Date('2026-01-05'), pointsAwarded: null },
      { id: 'dl2', customerId: 'c1', conversationId: 'cv1', tourName: 'Tour Huế', amount: BigInt(5_000_000), bookingStatus: 'ONGOING', departureDate: new Date('2026-01-01'), returnDate: new Date('2026-01-05'), pointsAwarded: 5000 },
    ] as never);
    expect(await svc.tuDoi(new Date('2026-02-01T03:00:00Z'))).toBe(2);
    expect(tx.appAccount.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.appAccount.updateMany).toHaveBeenCalledWith({ where: { customerId: 'c1' }, data: { earnedPoints: { increment: 28_000 } } });
    expect(notifications.baoDon).toHaveBeenCalledWith(tx, expect.objectContaining({ dealId: 'dl1', status: 'COMPLETED' }));
  });

  it('sale bấm Đã cọc: đổi trạng thái và báo khách trong app', async () => {
    const { svc, prisma, tx, notifications } = dung();
    prisma.deal.findFirst.mockResolvedValue({ bookingStatus: 'CONFIRMED', tourName: 'Tour Nhật Bản', customerId: 'c1' } as never);
    await expect(svc.doiTrangThai({ id: 'u1', fullName: 'Thảo' } as never, 'cv1', 'dl1', 'DEPOSITED')).resolves.toMatchObject({ status: 'DEPOSITED', statusLabel: 'Đã cọc' });
    expect(tx.deal.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'dl1', bookingStatus: 'CONFIRMED' } }));
    expect(notifications.baoDon).toHaveBeenCalledWith(tx, { customerId: 'c1', dealId: 'dl1', tourName: 'Tour Nhật Bản', status: 'DEPOSITED' });
  });

  it('sale không chuyển sai bước (chưa xác nhận thì chưa cọc được)', async () => {
    const { svc, prisma } = dung();
    prisma.deal.findFirst.mockResolvedValue({ bookingStatus: 'PENDING', tourName: 'Tour Nhật Bản' } as never);
    await expect(svc.doiTrangThai({ id: 'u1', fullName: 'Thảo' } as never, 'cv1', 'dl1', 'DEPOSITED')).rejects.toBeInstanceOf(ConflictException);
  });
});
