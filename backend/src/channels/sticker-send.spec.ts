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

  it('Zalo từ chối upload thì không gửi tin', async () => {
    const svc = new ZaloService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ accessToken: 'test-token' });
    const calls = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: -1, message: 'rejected' }) });
    global.fetch = calls;
    await expect(svc.guiTep('user', await gif(), '')).rejects.toThrow('Zalo không nhận');
    expect(calls).toHaveBeenCalledTimes(1);
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
