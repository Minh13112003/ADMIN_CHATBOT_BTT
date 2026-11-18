import { createHmac } from 'crypto';
import { appSecretProof, bangNhau, chiaDoan, chuKyFacebookHopLe, loiGraph, phanTichFacebook } from './facebook';

describe('chuKyFacebookHopLe', () => {
  const goc = '{"object":"page","entry":[]}';
  const dung = `sha256=${createHmac('sha256', 'bi-mat').update(goc).digest('hex')}`;
  it('đúng khoá, đúng nội dung thì nhận', () => expect(chuKyFacebookHopLe(dung, Buffer.from(goc), 'bi-mat')).toBe(true));
  it('sai khoá, sửa nội dung, thiếu header hoặc sai định dạng thì từ chối', () => {
    expect(chuKyFacebookHopLe(dung, goc, 'khoa-khac')).toBe(false);
    expect(chuKyFacebookHopLe(dung, `${goc} `, 'bi-mat')).toBe(false);
    expect(chuKyFacebookHopLe(undefined, goc, 'bi-mat')).toBe(false);
    expect(chuKyFacebookHopLe('sha1=abc', goc, 'bi-mat')).toBe(false);
    expect(chuKyFacebookHopLe(dung, goc, '')).toBe(false);
  });
});

describe('appSecretProof, bangNhau', () => {
  it('proof là HMAC-SHA256 của token bằng App Secret', () => {
    expect(appSecretProof('tok', 'sec')).toBe(createHmac('sha256', 'sec').update('tok').digest('hex'));
  });
  it('so mã xác minh', () => {
    expect(bangNhau('abc', 'abc')).toBe(true);
    expect(bangNhau('abc', 'abd')).toBe(false);
    expect(bangNhau('abc', undefined)).toBe(false);
    expect(bangNhau('', '')).toBe(false);
  });
});

describe('phanTichFacebook', () => {
  const goi = (messaging: unknown[]) => ({ object: 'page', entry: [{ id: 'PAGE', time: 1, messaging }] });
  it('tin chữ của khách, kèm trích dẫn', () => {
    expect(phanTichFacebook(goi([{ sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 1, message: { mid: 'm1', text: ' Tour Thái ', reply_to: { mid: 'm0' } } }]))).toEqual([
      { loai: 'khach', psid: 'U1', mid: 'm1', text: 'Tour Thái', tep: [], traLoiMid: 'm0' },
    ]);
  });
  it('ảnh, sticker, tệp; bỏ link không phải https', () => {
    const [e] = phanTichFacebook(goi([{ sender: { id: 'U1' }, recipient: { id: 'PAGE' }, message: { mid: 'm2', attachments: [
      { type: 'image', payload: { url: 'https://cdn/a.jpg' } },
      { type: 'image', payload: { url: 'https://cdn/s.png', sticker_id: 369239263222822 } },
      { type: 'file', payload: { url: 'https://cdn/b.pdf' }, title: 'b.pdf' },
      { type: 'image', payload: { url: 'http://khong-an-toan' } },
    ] } }]));
    expect(e).toMatchObject({ loai: 'khach', text: '', tep: [{ loai: 'image', url: 'https://cdn/a.jpg', ten: null }, { loai: 'sticker', url: 'https://cdn/s.png', ten: null }, { loai: 'file', url: 'https://cdn/b.pdf', ten: 'b.pdf' }] });
  });
  it('tin Trang gửi (echo): khách là người nhận, giữ app_id để bỏ tin chính hệ thống gửi', () => {
    expect(phanTichFacebook(goi([{ sender: { id: 'PAGE' }, recipient: { id: 'U1' }, message: { mid: 'm3', text: 'Dạ', is_echo: true, app_id: 123 } }]))).toEqual([
      { loai: 'trang', psid: 'U1', mid: 'm3', text: 'Dạ', tep: [], appId: '123' },
    ]);
  });
  it('bấm nút thành tin chữ; bỏ đã xem, đã nhận, cảm xúc, tin rỗng, object khác', () => {
    expect(phanTichFacebook(goi([
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 5, postback: { title: 'Bắt đầu', payload: 'GET_STARTED', mid: 'p1' } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, read: { watermark: 1 } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, delivery: { mids: ['x'] } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, reaction: { mid: 'm1', action: 'react', emoji: '❤' } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, message: { mid: 'm9' } },
    ]))).toEqual([{ loai: 'khach', psid: 'U1', mid: 'p1', text: 'Bắt đầu', tep: [], traLoiMid: null }]);
    expect(phanTichFacebook({ object: 'instagram', entry: [] })).toEqual([]);
    expect(phanTichFacebook(null)).toEqual([]);
  });
});

describe('chiaDoan', () => {
  it('tin ngắn giữ nguyên, tin dài cắt ở xuống dòng hoặc khoảng trắng, không đoạn nào quá giới hạn', () => {
    expect(chiaDoan('chào', 10)).toEqual(['chào']);
    expect(chiaDoan('aaaa bbbb cccc', 10)).toEqual(['aaaa bbbb', 'cccc']);
    expect(chiaDoan('aaaaaa\nbbbbbbbbb', 10)).toEqual(['aaaaaa', 'bbbbbbbbb']);
    expect(chiaDoan('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });
});

describe('loiGraph', () => {
  it('đổi mã lỗi thường gặp thành câu dễ hiểu', () => {
    expect(loiGraph({ error: { code: 190, message: 'Invalid OAuth' } })).toMatch(/token không hợp lệ/);
    expect(loiGraph({ error: { code: 100, message: 'Invalid appsecret_proof provided' } })).toMatch(/App Secret/);
    expect(loiGraph({ error: { code: 10, error_subcode: 2018278, message: 'outside window' } })).toMatch(/24 giờ/);
    expect(loiGraph({ error: { code: 200, message: 'Requires pages_messaging' } })).toMatch(/pages_messaging/);
    expect(loiGraph({ error: { code: 1, message: 'Lạ' } })).toBe('Facebook báo lỗi 1: Lạ');
    expect(loiGraph({})).toMatch(/định dạng/);
  });
});
