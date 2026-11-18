import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { FacebookWebhookController } from './facebook.controller';

/** Mô phỏng Meta gọi webhook: tin giả đúng định dạng Messenger, ký bằng App Secret. Không dùng database thật. */
describe('FacebookWebhookController', () => {
  const cau = { appId: '999', appSecret: 'app-secret', verifyToken: 'ma-xac-minh-123' };
  const tao = (daCoKhach = false, ketQua: Record<string, unknown> = { conversationId: 'c1', action: 'BOT' }) => {
    const fb = { doc: jest.fn().mockResolvedValue(cau), hoSoKhach: jest.fn().mockResolvedValue({ ten: 'Trần Thị Bình', anh: 'https://fb/a.jpg' }), guiTin: jest.fn().mockResolvedValue(undefined), taiTep: jest.fn().mockResolvedValue(null) };
    const ingest = { inbound: jest.fn().mockResolvedValue(ketQua), oaGui: jest.fn().mockResolvedValue({ saved: true }) };
    const prisma = {
      customerIdentity: { findUnique: jest.fn().mockResolvedValue(daCoKhach ? { customer: { id: 'k1', name: 'Khách cũ', avatarUrl: 'https://x/a.jpg', conversations: [{ lastCustomerMessageAt: new Date() }] } } : null) },
      customer: { update: jest.fn().mockResolvedValue({}) },
      message: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    return { fb, ingest, prisma, ctl: new FacebookWebhookController(fb as never, ingest as never, prisma as never) };
  };
  const goi = (ctl: FacebookWebhookController, body: object, khoa = cau.appSecret) => {
    const raw = JSON.stringify(body);
    const req = { rawBody: Buffer.from(raw), body };
    return ctl.nhan(req as never, `sha256=${createHmac('sha256', khoa).update(raw).digest('hex')}`);
  };
  const goiTin = (message: object, sender = 'PSID1', recipient = 'PAGE1') => ({ object: 'page', entry: [{ id: 'PAGE1', time: 1, messaging: [{ sender: { id: sender }, recipient: { id: recipient }, timestamp: 1, message }] }] });

  it('xác minh webhook: đúng mã trả lại challenge, sai mã thì 403', async () => {
    const { ctl } = tao();
    const res = { status: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), send: jest.fn() };
    await ctl.xacMinh({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': cau.verifyToken, 'hub.challenge': '1158201444' } } as never, res as never);
    expect(res.send).toHaveBeenCalledWith('1158201444');
    await expect(ctl.xacMinh({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'sai', 'hub.challenge': 'x' } } as never, res as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('tin khách mới: tạo hội thoại kênh FACEBOOK, tên lấy từ hồ sơ Messenger, mã chống trùng fb:<mid>', async () => {
    const { ctl, ingest, fb } = tao();
    await expect(goi(ctl, goiTin({ mid: 'm_1', text: 'Tour Nhật tháng 3 giá sao ạ' }))).resolves.toEqual({ ok: true });
    expect(fb.hoSoKhach).toHaveBeenCalledWith('PSID1');
    expect(ingest.inbound).toHaveBeenCalledWith({ channel: 'FACEBOOK', externalUserId: 'PSID1', text: 'Tour Nhật tháng 3 giá sao ạ', externalMessageId: 'fb:m_1', customer: { name: 'Trần Thị Bình' } }, undefined, undefined);
  });

  it('khách cũ: không lấy hồ sơ lại; trả lời tự động thì gửi lại qua Messenger', async () => {
    const { ctl, fb } = tao(true, { conversationId: 'c1', action: 'AUTO_REPLY', reply: 'Dạ BenThanh Tourist xin chào' });
    await goi(ctl, goiTin({ mid: 'm_2', text: 'alo' }));
    expect(fb.hoSoKhach).not.toHaveBeenCalled();
    expect(fb.guiTin).toHaveBeenCalledWith('PSID1', 'Dạ BenThanh Tourist xin chào');
  });

  it('tin Trang gửi: do chính hệ thống gửi (cùng App ID) thì bỏ; gửi từ Meta Business Suite thì ghi là tin nhân viên', async () => {
    const { ctl, ingest } = tao(true);
    await goi(ctl, goiTin({ mid: 'e_1', text: 'Dạ', is_echo: true, app_id: 999 }, 'PAGE1', 'PSID1'));
    expect(ingest.oaGui).not.toHaveBeenCalled();
    await goi(ctl, goiTin({ mid: 'e_2', text: 'Dạ em gửi giá ạ', is_echo: true, app_id: 263902037430900 }, 'PAGE1', 'PSID1'));
    expect(ingest.oaGui).toHaveBeenCalledWith({ kenh: 'FACEBOOK', userId: 'PSID1', text: 'Dạ em gửi giá ạ', msgId: 'e_2', file: undefined });
    expect(ingest.inbound).not.toHaveBeenCalled();
  });

  it('ảnh tải không được: ghi dòng chữ kèm link gốc', async () => {
    const { ctl, ingest } = tao(true);
    await goi(ctl, goiTin({ mid: 'm_3', attachments: [{ type: 'video', payload: { url: 'https://fb/v.mp4' } }] }));
    expect(ingest.inbound.mock.calls[0][0].text).toBe('[Khách gửi video: https://fb/v.mp4]');
  });

  it('sai chữ ký: 401, không lưu; chưa nhập App Secret: 503', async () => {
    const t = tao();
    await expect(goi(t.ctl, goiTin({ mid: 'm_4', text: 'x' }), 'khoa-gia')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(t.ingest.inbound).not.toHaveBeenCalled();
    t.fb.doc.mockResolvedValue({});
    await expect(goi(t.ctl, goiTin({ mid: 'm_5', text: 'x' }))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('một tin lỗi không làm hỏng cả gói (vẫn trả 200 để Meta không gửi lại mãi)', async () => {
    const { ctl, ingest } = tao(true);
    ingest.inbound.mockRejectedValueOnce(new Error('db lỗi'));
    await expect(goi(ctl, goiTin({ mid: 'm_6', text: 'x' }))).resolves.toEqual({ ok: true });
  });
});
