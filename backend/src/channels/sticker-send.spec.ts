import sharp from 'sharp';
import { ZaloService } from './zalo.service';
import { FacebookService } from './facebook.service';

describe('gửi sticker GIF qua kênh', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  const gif = async () => ({ data: await sharp({ create: { width: 20, height: 12, channels: 4, background: 'red' } }).gif().toBuffer(), type: 'image/gif', name: 'chao.gif', anh: true });

  it('Zalo upload/gif rồi gửi media_type gif kèm chiều rộng và chiều cao', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-id' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { message_id: 'msg-id' } }) });
    global.fetch = calls;
    await svc.guiTep('user', await gif(), '');
    expect(calls.mock.calls[0][0]).toBe('https://openapi.zalo.me/v2.0/oa/upload/gif');
    const body = JSON.parse(calls.mock.calls[1][1].body);
    expect(body.message.attachment.payload.elements).toEqual([{ media_type: 'gif', attachment_id: 'gif-id', width: 20, height: 12 }]);
  });

  it('tin GIF không có trường text; chữ của sale gửi thành tin riêng sau ảnh', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-id' } }) })
      .mockResolvedValue({ ok: true, json: async () => ({ error: 0, data: { message_id: 'msg-id' } }) });
    global.fetch = calls;
    await svc.guiTep('user', await gif(), 'chào');
    expect(calls).toHaveBeenCalledTimes(3);
    expect(calls.mock.calls[1][0]).toBe('https://openapi.zalo.me/v3.0/oa/message/cs');
    expect(JSON.parse(calls.mock.calls[1][1].body).message).not.toHaveProperty('text');
    expect(JSON.parse(calls.mock.calls[2][1].body).message).toEqual({ text: 'chào' });
  });

  it('attachment_id bị Zalo trả -200 thì thử gửi bằng url có chữ ký, không dùng API v2.0 đã ngừng', async () => {
    const svc = new ZaloService({} as never, { get: (k: string) => (k === 'FRONTEND_URL' ? 'https://admin.example' : '') } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-id' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: -200, message: 'Send message failed' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { message_id: 'msg-id' } }) });
    global.fetch = calls;
    await svc.guiTep('user', { ...(await gif()), linkGif: '/stickers/abc/gif?exp=1&sig=x' }, '');
    expect(calls).toHaveBeenCalledTimes(3);
    expect(calls.mock.calls.map((c) => c[0])).not.toContain('https://openapi.zalo.me/v2.0/oa/message');
    const body = JSON.parse(calls.mock.calls[2][1].body);
    expect(body.message.attachment.payload.elements).toEqual([{ media_type: 'gif', url: 'https://admin.example/api/v1/stickers/abc/gif?exp=1&sig=x', width: 20, height: 12 }]);
  });

  it('Zalo không nhận ảnh động ở mọi cách thì gửi khung đầu dạng PNG kèm chữ qua đường gửi ảnh', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-id' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: -200, message: 'Send message failed' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: -200, message: 'Send message failed' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'png-id' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { message_id: 'msg-id' } }) });
    global.fetch = calls;
    await svc.guiTep('user', { ...(await gif()), linkGif: '/stickers/abc/gif?exp=1&sig=x' }, 'chào');
    expect(calls.mock.calls[3][0]).toBe('https://openapi.zalo.me/v2.0/oa/upload/image');
    const uploaded = (calls.mock.calls[3][1].body as FormData).get('file') as Blob;
    expect(uploaded.type).toBe('image/png');
    const body = JSON.parse(calls.mock.calls[4][1].body);
    expect(body.message.text).toBe('chào');
    expect(body.message.attachment.payload.elements).toEqual([{ media_type: 'image', attachment_id: 'png-id' }]);
  });

  it('GIF lớn bị từ chối thì thử thêm bản nhỏ 240px trước khi gửi ảnh tĩnh', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const to = { data: await sharp({ create: { width: 480, height: 480, channels: 4, background: 'red' } }).gif().toBuffer(), type: 'image/gif', name: 'to.gif', anh: true };
    const calls = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-id' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: -200, message: 'Send message failed' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { attachment_id: 'gif-nho' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 0, data: { message_id: 'msg-id' } }) });
    global.fetch = calls;
    await svc.guiTep('user', to, '');
    expect(calls).toHaveBeenCalledTimes(4);
    expect(calls.mock.calls[2][0]).toBe('https://openapi.zalo.me/v2.0/oa/upload/gif');
    expect(JSON.parse(calls.mock.calls[3][1].body).message.attachment.payload.elements).toEqual([{ media_type: 'gif', attachment_id: 'gif-nho', width: 240, height: 240 }]);
  });

  it('Zalo từ chối mọi lần tải lên thì báo lỗi, không gửi tin', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: -1, message: 'rejected' }) });
    global.fetch = calls;
    await expect(svc.guiTep('user', await gif(), '')).rejects.toThrow('Zalo không nhận');
    // Tải GIF lên, rồi tải PNG thay thế, đều bị từ chối: không có lần gọi gửi tin nào.
    expect(calls.mock.calls.map((c) => c[0])).toEqual(['https://openapi.zalo.me/v2.0/oa/upload/gif', 'https://openapi.zalo.me/v2.0/oa/upload/image']);
  });

  it('Messenger gửi đúng GIF multipart với loại image', async () => {
    const svc = new FacebookService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ pageAccessToken: 'test-token', appSecret: 'test-secret', pageId: 'page' });
    const calls = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: 'msg-id' }) });
    global.fetch = calls;
    const file = await gif();
    await svc.guiTep('user', file, '');
    const body = calls.mock.calls[0][1].body as FormData;
    expect(JSON.parse(body.get('message') as string).attachment.type).toBe('image');
    const uploaded = body.get('filedata') as Blob;
    expect(uploaded.type).toBe('image/gif');
    expect(Buffer.from(await uploaded.arrayBuffer()).equals(file.data)).toBe(true);
  });
});
