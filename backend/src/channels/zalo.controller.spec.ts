import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { chuKyZalo } from '../common/zalo';
import { ZaloWebhookController } from './zalo.controller';

/** Mô phỏng Zalo gọi webhook: tin giả đúng định dạng, ký bằng OA Secret Key. Không dùng database thật. */
describe('ZaloWebhookController', () => {
  const cau = { appId: '111', oaSecretKey: 'oa-secret' };
  const tao = (daCoKhach = false, ketQua: Record<string, unknown> = { conversationId: 'c1', action: 'BOT' }) => {
    const zalo = { doc: jest.fn().mockResolvedValue(cau), tenKhach: jest.fn().mockResolvedValue('Nguyễn Văn An'), guiTin: jest.fn().mockResolvedValue(undefined) };
    const ingest = { inbound: jest.fn().mockResolvedValue(ketQua) };
    const prisma = { customerIdentity: { findUnique: jest.fn().mockResolvedValue(daCoKhach ? { id: 'i1' } : null) } };
    return { zalo, ingest, prisma, ctl: new ZaloWebhookController(zalo as never, ingest as never, prisma as never) };
  };
  const goi = (ctl: ZaloWebhookController, body: object, macSai = false, bienDoi?: (raw: string) => string) => {
    const raw = JSON.stringify(body);
    const mac = chuKyZalo(cau.appId, raw, String((body as { timestamp: unknown }).timestamp), cau.oaSecretKey);
    const req = { rawBody: Buffer.from(bienDoi ? bienDoi(raw) : raw), body };
    return ctl.nhan(req as never, macSai ? 'mac=deadbeef' : `mac=${mac}`, undefined);
  };
  const tinGia = { app_id: '111', event_name: 'user_send_text', sender: { id: 'zalo-user-1' }, recipient: { id: 'oa-1' }, message: { text: 'Cho mình hỏi tour Đà Lạt', msg_id: 'abc123' }, timestamp: '1700000000000' };

  it('tin đúng chữ ký: tạo hội thoại kênh ZALO kèm tên lấy từ hồ sơ khách', async () => {
    const { ctl, ingest, zalo } = tao();
    await expect(goi(ctl, tinGia)).resolves.toEqual({ ok: true });
    expect(zalo.tenKhach).toHaveBeenCalledWith('zalo-user-1');
    expect(ingest.inbound).toHaveBeenCalledWith({ channel: 'ZALO', externalUserId: 'zalo-user-1', text: 'Cho mình hỏi tour Đà Lạt', externalMessageId: 'zalo:abc123', customer: { name: 'Nguyễn Văn An' } });
    expect(zalo.guiTin).not.toHaveBeenCalled();
  });
  it('khách cũ: không gọi lấy hồ sơ lại', async () => {
    const { ctl, zalo, ingest } = tao(true);
    await goi(ctl, tinGia);
    expect(zalo.tenKhach).not.toHaveBeenCalled();
    expect(ingest.inbound.mock.calls[0][0].customer).toBeUndefined();
  });
  it('sai chữ ký hoặc nội dung bị sửa: 401, không lưu gì', async () => {
    const { ctl, ingest } = tao();
    await expect(goi(ctl, tinGia, true)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(goi(ctl, tinGia, false, (r) => r.replace('Đà Lạt', 'Hà Nội'))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('chưa nhập OA Secret Key: từ chối 503, không nhận tin chưa kiểm chứng', async () => {
    const { ctl, zalo, ingest } = tao();
    zalo.doc.mockResolvedValue({ appId: '111' });
    await expect(goi(ctl, tinGia)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('sự kiện không phải tin khách (OA gửi, theo dõi): bỏ qua', async () => {
    const { ctl, ingest } = tao();
    const r = await goi(ctl, { ...tinGia, event_name: 'oa_send_text' });
    expect(r).toEqual({ ok: true, ignored: true });
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('khách đòi gặp nhân viên: gửi lại câu báo qua Zalo; tin trùng thì không gửi lại', async () => {
    const a = tao(true, { conversationId: 'c1', action: 'CONTACT', reply: 'Đã báo nhân viên' });
    await goi(a.ctl, tinGia);
    expect(a.zalo.guiTin).toHaveBeenCalledWith('zalo-user-1', 'Đã báo nhân viên');
    const b = tao(true, { conversationId: 'c1', action: 'CONTACT', reply: 'Đã báo nhân viên', duplicate: true });
    await goi(b.ctl, tinGia);
    expect(b.zalo.guiTin).not.toHaveBeenCalled();
  });
  it('gửi trả lời lỗi thì vẫn báo nhận tin thành công cho Zalo', async () => {
    const t = tao(true, { conversationId: 'c1', action: 'AUTO_REPLY', reply: 'Xin chào' });
    t.zalo.guiTin.mockRejectedValue(new Error('hết hạn'));
    await expect(goi(t.ctl, tinGia)).resolves.toEqual({ ok: true });
  });
});
