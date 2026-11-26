import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { MessageActionsService } from './message-actions.service';
import { TrashService } from './trash.service';

/** Xoá mềm, khôi phục, thả biểu cảm: kiểm tra luồng bằng database giả, không chạm database thật. */
const admin = { id: 'a1', role: 'ADMIN', fullName: 'Admin', departmentId: null, scopeIds: [] } as never;
const realtime = () => ({ emit: jest.fn(), dangGo: jest.fn(), xongGo: jest.fn() });

describe('xoá mềm hội thoại', () => {
  it('ẩn hội thoại và các tin còn hiện cùng một mốc, bỏ người phụ trách khách Liên hệ', async () => {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', isAvailable: true, status: 'CONTACT', customer: { name: 'Lan' } }), update: jest.fn((x) => x) },
      message: { updateMany: jest.fn((x) => x) },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
    const svc = new ConversationsService(prisma as never, {} as never, realtime() as never, {} as never, {} as never, {} as never);
    await expect(svc.xoaMem(admin, 'c1')).resolves.toMatchObject({ ok: true });
    const tin = prisma.message.updateMany.mock.calls[0][0];
    const hoi = prisma.conversation.update.mock.calls[0][0];
    expect(tin.where).toEqual({ conversationId: 'c1', isAvailable: true });
    expect(tin.data.deletedAt).toBe(hoi.data.deletedAt);
    expect(hoi.data).toMatchObject({ isAvailable: false, deletedById: 'a1', assigneeId: null });
  });
  it('hội thoại đã xoá thì không mở được nữa (404)', async () => {
    const prisma = { conversation: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', isAvailable: false, customer: { name: 'Lan' } }) } };
    const svc = new ConversationsService(prisma as never, {} as never, realtime() as never, {} as never, {} as never, {} as never);
    await expect(svc.xoaMem(admin, 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('tab Khôi phục', () => {
  const tao = (conv: unknown, msg?: unknown) => {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(conv), update: jest.fn((x) => x) },
      message: { updateMany: jest.fn((x) => x), findUnique: jest.fn().mockResolvedValue(msg), update: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
    const actions = { capNhatXemTruoc: jest.fn() };
    const convs = { xoaHan: jest.fn().mockResolvedValue({ ok: true }) };
    const tep = { xoaTep: jest.fn() };
    return { prisma, convs, tep, svc: new TrashService(prisma as never, realtime() as never, tep as never, convs as never, actions as never) };
  };
  const luc = new Date('2026-11-26T03:00:00Z');
  it('khôi phục hội thoại chỉ trả lại các tin bị ẩn cùng lúc xoá hội thoại', async () => {
    const { svc, prisma } = tao({ isAvailable: false, deletedAt: luc, customer: { name: 'Lan' } });
    await expect(svc.khoiPhucHoiThoai(admin, 'c1')).resolves.toMatchObject({ ok: true, name: 'Lan' });
    expect(prisma.message.updateMany.mock.calls[0][0].where).toEqual({ conversationId: 'c1', isAvailable: false, deletedAt: luc });
  });
  it('chỉ xoá hẳn được hội thoại đang ở tab Khôi phục', async () => {
    const { svc, convs } = tao({ isAvailable: true });
    await expect(svc.xoaHanHoiThoai(admin, 'c1', false)).rejects.toBeInstanceOf(NotFoundException);
    expect(convs.xoaHan).not.toHaveBeenCalled();
  });
  it('khôi phục tin của hội thoại đã xoá thì báo khôi phục hội thoại trước', async () => {
    const { svc } = tao(null, { isAvailable: false, conversationId: 'c1', conversation: { isAvailable: false, customer: { name: 'Lan' } } });
    await expect(svc.khoiPhucTin(admin, 'm1')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('xoá hẳn tin thì xoá cả file đính kèm', async () => {
    const { svc, prisma, tep } = tao(null, { isAvailable: false, conversationId: 'c1', attachmentPath: 'a/1.jpg', conversation: { isAvailable: true, customer: { name: 'Lan' } } });
    await svc.xoaHanTin(admin, 'm1');
    expect(prisma.message.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(tep.xoaTep).toHaveBeenCalledWith('a/1.jpg');
  });
});

describe('thả biểu cảm', () => {
  const tao = (kenh: string, ext: string | null, zaloLoi = false) => {
    const prisma = {
      message: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1', senderType: 'CUSTOMER', staffId: null, internal: false, isAvailable: true, text: 'Hi', externalMessageId: ext, conversation: { channel: kenh, customerId: 'k1' } }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'm1', attachmentPath: null, attachmentType: null, attachmentName: null, attachmentSize: null }),
        update: jest.fn((x) => x),
      },
      messageReaction: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn((x) => x), deleteMany: jest.fn((x) => x) },
      customerIdentity: { findFirst: jest.fn().mockResolvedValue({ externalId: 'zu1' }) },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
    const zalo = { thaCamXuc: zaloLoi ? jest.fn().mockRejectedValue(new Error('lỗi -201')) : jest.fn().mockResolvedValue({}) };
    const convs = { ra: (m: unknown) => m };
    return { prisma, zalo, svc: new MessageActionsService(prisma as never, realtime() as never, convs as never, zalo as never) };
  };
  it('tin khách Zalo: gửi mã cảm xúc sang Zalo theo msg_id', async () => {
    const { svc, zalo } = tao('ZALO', 'zalo:abc');
    await expect(svc.thaBieuCam(admin, 'c1', 'm1', 'heart')).resolves.toMatchObject({ emoji: 'heart', warning: undefined });
    expect(zalo.thaCamXuc).toHaveBeenCalledWith('zu1', 'abc', '/-heart');
  });
  it('Zalo lỗi thì vẫn lưu, trả cảnh báo', async () => {
    const { svc, prisma } = tao('ZALO', 'zalo:abc', true);
    await expect(svc.thaBieuCam(admin, 'c1', 'm1', 'like')).resolves.toMatchObject({ emoji: 'like', warning: expect.stringContaining('Zalo') });
    expect(prisma.messageReaction.upsert).toHaveBeenCalled();
  });
  it('web: không gọi Zalo, đánh dấu changedAt để khung chat web cập nhật', async () => {
    const { svc, zalo, prisma } = tao('WEB', 'web-1');
    await svc.thaBieuCam(admin, 'c1', 'm1', 'wow');
    expect(zalo.thaCamXuc).not.toHaveBeenCalled();
    expect(prisma.message.update.mock.calls[0][0].data.changedAt).toBeInstanceOf(Date);
  });
  it('biểu cảm lạ bị từ chối', async () => {
    const { svc } = tao('WEB', null);
    await expect(svc.thaBieuCam(admin, 'c1', 'm1', 'love')).rejects.toBeInstanceOf(BadRequestException);
  });
});
