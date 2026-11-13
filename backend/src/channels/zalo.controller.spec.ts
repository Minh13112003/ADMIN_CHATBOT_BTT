import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { chuKyZalo } from '../common/zalo';
import { ZaloWebhookController } from './zalo.controller';

/** Mô phỏng Zalo gọi webhook: tin giả đúng định dạng, ký bằng OA Secret Key. Không dùng database thật. */
describe('ZaloWebhookController', () => {
  const cau = { appId: '111', oaSecretKey: 'oa-secret' };
  const tao = (daCoKhach = false, ketQua: Record<string, unknown> = { conversationId: 'c1', action: 'BOT' }) => {
    const zalo = { doc: jest.fn().mockResolvedValue(cau), hoSoKhach: jest.fn().mockResolvedValue({ ten: 'Nguyễn Văn An', anh: 'https://s120-ava-talk.zadn.vn/a.jpg' }), guiTin: jest.fn().mockResolvedValue(undefined) };
    const ingest = { inbound: jest.fn().mockResolvedValue(ketQua) };
    const prisma = {
      customerIdentity: { findUnique: jest.fn().mockResolvedValue(daCoKhach ? { customer: { id: 'k1', name: 'Khách cũ', avatarUrl: 'https://x/a.jpg', conversations: [{ lastCustomerMessageAt: new Date() }] } } : null) },
      customer: { update: jest.fn().mockResolvedValue({}) },
    };
    const sync = { dongBo: jest.fn().mockResolvedValue({ them: 0, tong: 0 }) };
    return { zalo, ingest, prisma, sync, ctl: new ZaloWebhookController(zalo as never, ingest as never, prisma as never, sync as never) };
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
    expect(zalo.hoSoKhach).toHaveBeenCalledWith('zalo-user-1');
    expect(ingest.inbound).toHaveBeenCalledWith({ channel: 'ZALO', externalUserId: 'zalo-user-1', text: 'Cho mình hỏi tour Đà Lạt', externalMessageId: 'zalo:abc123', customer: { name: 'Nguyễn Văn An' } }, undefined, undefined);
    expect(zalo.guiTin).not.toHaveBeenCalled();
  });
  it('khách mới: kéo tin cũ về (chạy nền); lỗi kéo tin cũ không làm hỏng việc nhận tin', async () => {
    const { ctl, sync } = tao(false);
    sync.dongBo.mockRejectedValue(new Error('Zalo từ chối'));
    await expect(goi(ctl, tinGia)).resolves.toEqual({ ok: true });
    expect(sync.dongBo).toHaveBeenCalledWith('c1');
  });
  it('khách cũ: không gọi lấy hồ sơ lại', async () => {
    const { ctl, zalo, ingest } = tao(true);
    await goi(ctl, tinGia);
    expect(zalo.hoSoKhach).not.toHaveBeenCalled();
    expect(ingest.inbound.mock.calls[0][0].customer).toBeUndefined();
  });
  it('khách cũ chưa có ảnh và tên "Khách chưa rõ tên": cập nhật ảnh và tên từ hồ sơ Zalo', async () => {
    const t = tao(true);
    t.prisma.customerIdentity.findUnique.mockResolvedValue({ customer: { id: 'k1', name: 'Khách chưa rõ tên', avatarUrl: null, conversations: [{ lastCustomerMessageAt: new Date() }] } });
    await goi(t.ctl, tinGia);
    expect(t.prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { avatarUrl: 'https://s120-ava-talk.zadn.vn/a.jpg', name: 'Nguyễn Văn An' } });
  });
  it('khách đã có ảnh nhưng quay lại sau hơn 12 giờ: lấy lại ảnh (link Zalo có thể hết hạn)', async () => {
    const t = tao(true);
    t.prisma.customerIdentity.findUnique.mockResolvedValue({ customer: { id: 'k1', name: 'An', avatarUrl: 'https://cu/a.jpg', conversations: [{ lastCustomerMessageAt: new Date(Date.now() - 13 * 3600_000) }] } });
    await goi(t.ctl, tinGia);
    expect(t.zalo.hoSoKhach).toHaveBeenCalled();
    expect(t.prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { avatarUrl: 'https://s120-ava-talk.zadn.vn/a.jpg' } });
  });
  it('sai chữ ký hoặc nội dung bị sửa: 401, không lưu gì', async () => {
    const { ctl, ingest } = tao();
    await expect(goi(ctl, tinGia, true)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(goi(ctl, tinGia, false, (r) => r.replace('Đà Lạt', 'Hà Nội'))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('không có OA Secret Key nhưng ký bằng khoá bí mật ứng dụng: vẫn nhận', async () => {
    const { ctl, zalo, ingest } = tao();
    zalo.doc.mockResolvedValue({ appId: '111', appSecret: 'app-secret' });
    const raw = JSON.stringify(tinGia);
    const mac = chuKyZalo('111', raw, '1700000000000', 'app-secret');
    await expect(ctl.nhan({ rawBody: Buffer.from(raw), body: tinGia } as never, `mac=${mac}`, undefined)).resolves.toEqual({ ok: true });
    expect(ingest.inbound).toHaveBeenCalledTimes(1);
    await expect(ctl.nhan({ rawBody: Buffer.from(raw), body: tinGia } as never, 'mac=sai', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('chưa nhập khoá nào: từ chối 503, không nhận tin chưa kiểm chứng', async () => {
    const { ctl, zalo, ingest } = tao();
    zalo.doc.mockResolvedValue({ appId: '111' });
    await expect(goi(ctl, tinGia)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('yêu cầu thử của Zalo (không có sự kiện): trả 200 kể cả khi chưa nhập khoá, không lưu gì', async () => {
    const { ctl, zalo, ingest } = tao();
    zalo.doc.mockResolvedValue({});
    for (const body of [{}, { timestamp: '1' }]) {
      await expect(ctl.nhan({ rawBody: Buffer.from(JSON.stringify(body)), body } as never, undefined, undefined)).resolves.toEqual({ ok: true, ping: true });
    }
    await expect(ctl.nhan({ rawBody: Buffer.from(''), body: undefined } as never, undefined, undefined)).resolves.toEqual({ ok: true, ping: true });
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('tin mẫu "This is testing message" của Zalo: trả 200 không cần chữ ký, không lưu gì', async () => {
    const { ctl, ingest } = tao();
    const mau = { app_id: '111', event_name: 'user_send_text', sender: { id: 'x' }, message: { text: 'This is testing message', msg_id: 'This is message_id' }, timestamp: '1' };
    await expect(ctl.nhan({ rawBody: Buffer.from(JSON.stringify(mau)), body: mau } as never, 'mac=khongdung', undefined)).resolves.toEqual({ ok: true, test: true });
    // Chỉ đúng nội dung mẫu; tin khác thì vẫn phải kiểm tra chữ ký.
    const gia = { ...mau, message: { text: 'Tin khác', msg_id: 'This is message_id' } };
    await expect(ctl.nhan({ rawBody: Buffer.from(JSON.stringify(gia)), body: gia } as never, 'mac=khongdung', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('sự kiện theo dõi: bỏ qua, không lưu', async () => {
    const { ctl, ingest } = tao();
    const r = await goi(ctl, { ...tinGia, event_name: 'follow' });
    expect(r).toEqual({ ok: true, ignored: true });
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('nhân viên trả lời trên ứng dụng Zalo OA (oa_send_text): ghi thành tin nhân viên, không qua luồng tin khách', async () => {
    const { ctl, ingest } = tao();
    const oaGui = jest.fn().mockResolvedValue({ saved: true });
    (ingest as Record<string, unknown>).oaGui = oaGui;
    const r = await goi(ctl, { ...tinGia, event_name: 'oa_send_text', sender: { id: 'oa-1' }, recipient: { id: 'zalo-user-1' }, message: { text: 'Dạ chào anh', msg_id: 'o1' } });
    expect(r).toEqual({ ok: true });
    expect(oaGui).toHaveBeenCalledWith({ userId: 'zalo-user-1', text: 'Dạ chào anh', msgId: 'o1', file: undefined });
    expect(ingest.inbound).not.toHaveBeenCalled();
  });
  it('khách gửi ảnh: tải về lưu, ghi tin kèm tệp; không tải được thì ghi dòng chữ kèm link', async () => {
    const t = tao();
    const file = { path: 'a/b.jpg', type: 'image/jpeg', name: 'anh.jpg', size: 10 };
    (t.zalo as Record<string, unknown>).taiTep = jest.fn().mockResolvedValueOnce(file).mockResolvedValueOnce(null);
    const body = { ...tinGia, event_name: 'user_send_image', message: { msg_id: 'i1', attachments: [{ type: 'image', payload: { url: 'https://z/1.jpg' } }, { type: 'image', payload: { url: 'https://z/2.jpg' } }] } };
    await goi(t.ctl, body);
    expect(t.ingest.inbound).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: '', externalMessageId: 'zalo:i1' }), file, undefined);
    expect(t.ingest.inbound).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: expect.stringContaining('https://z/2.jpg'), externalMessageId: 'zalo:i1:1' }), undefined, undefined);
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
