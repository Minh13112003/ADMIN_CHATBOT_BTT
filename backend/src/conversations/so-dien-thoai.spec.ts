import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

/** Nhập số điện thoại cho khách và chặn chốt tour khi chưa có số. Database giả. */
describe('Số điện thoại khách', () => {
  const sale = { id: 's1', role: 'SALE', fullName: 'Sale A', departmentId: null, scopeIds: [] } as never;
  const tao = (conv: { phone: string | null }, trung?: { id: string; name: string } | null) => {
    const prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(trung ?? null), update: jest.fn().mockReturnValue('upd') },
      message: { create: jest.fn().mockReturnValue('msg') },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const realtime = { emit: jest.fn() };
    const svc = new ConversationsService(prisma as never, {} as never, realtime as never, {} as never, {} as never, {} as never);
    (svc as unknown as { lay: unknown }).lay = jest.fn().mockResolvedValue({ id: 'c1', customerId: 'k1', customer: { name: 'Minh Trang', phone: conv.phone } });
    (svc as unknown as { get: unknown }).get = jest.fn().mockResolvedValue({ id: 'c1' });
    return { svc, prisma, realtime };
  };

  it('số hợp lệ: chuẩn hoá về 0xxxxxxxxx, lưu, ghi log nội bộ, báo làm mới', async () => {
    const { svc, prisma, realtime } = tao({ phone: null });
    await svc.capNhatSoDienThoai(sale, 'c1', '+84 912 345 678');
    expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { phone: '0912345678', phoneVerified: false } });
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ senderType: 'SYSTEM', internal: true, text: expect.stringContaining('0912345678') }) });
    expect(realtime.emit).toHaveBeenCalledWith('conversation:update', { id: 'c1' });
  });
  it('số sai định dạng: 400, không lưu', async () => {
    const { svc, prisma } = tao({ phone: null });
    await expect(svc.capNhatSoDienThoai(sale, 'c1', '12345')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('số đã thuộc khách khác: 409, không tự gộp', async () => {
    const { svc, prisma } = tao({ phone: null }, { id: 'k9', name: 'Khách khác' });
    await expect(svc.capNhatSoDienThoai(sale, 'c1', '0912345678')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('nhập lại đúng số đang có: không ghi gì', async () => {
    const { svc, prisma } = tao({ phone: '0912345678' });
    await svc.capNhatSoDienThoai(sale, 'c1', '0912 345 678');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('chốt tour khi khách chưa có số: 400 NEED_PHONE', async () => {
    const { svc } = tao({ phone: null });
    await expect(svc.close(sale, 'c1', {} as never)).rejects.toMatchObject({ response: { code: 'NEED_PHONE' } });
  });
});
