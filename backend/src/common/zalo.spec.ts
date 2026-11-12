import { chuKyHopLe, chuKyZalo, phanTichSuKien, taoPkce } from './zalo';
import { createHash } from 'crypto';

describe('zalo', () => {
  const raw = '{"app_id":"123","event_name":"user_send_text","sender":{"id":"u1"},"message":{"text":"Xin chào","msg_id":"m1"},"timestamp":"1700000000000"}';

  it('chữ ký đúng công thức sha256(appId + body + timestamp + secret)', () => {
    const dung = createHash('sha256').update('123' + raw + '1700000000000' + 'sec').digest('hex');
    expect(chuKyZalo('123', raw, '1700000000000', 'sec')).toBe(dung);
  });
  it('nhận chữ ký có hoặc không có tiền tố mac=, từ chối sai hoặc thiếu', () => {
    const mac = chuKyZalo('123', raw, '1700000000000', 'sec');
    expect(chuKyHopLe(`mac=${mac}`, '123', raw, '1700000000000', 'sec')).toBe(true);
    expect(chuKyHopLe(mac, '123', raw, '1700000000000', 'sec')).toBe(true);
    expect(chuKyHopLe(mac, '123', raw + ' ', '1700000000000', 'sec')).toBe(false);
    expect(chuKyHopLe(mac, '123', raw, '1700000000000', 'khac')).toBe(false);
    expect(chuKyHopLe(undefined, '123', raw, '1700000000000', 'sec')).toBe(false);
    expect(chuKyHopLe(mac, '123', raw, '1700000000000', '')).toBe(false);
    expect(chuKyHopLe('mac=abc', '123', raw, '1700000000000', 'sec')).toBe(false);
  });
  it('PKCE: challenge là base64url(sha256(verifier)), mỗi lần khác nhau', () => {
    const a = taoPkce();
    const b = taoPkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).toBe(createHash('sha256').update(a.verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });
  it('tin chữ của khách', () => {
    const e = phanTichSuKien(JSON.parse(raw));
    expect(e).toMatchObject({ userId: 'u1', msgId: 'm1', text: 'Xin chào', laText: true, timestamp: '1700000000000' });
  });
  it('tin ảnh, tệp thành dòng báo cho nhân viên', () => {
    const e = phanTichSuKien({ event_name: 'user_send_image', sender: { id: 'u1' }, message: { msg_id: 'm2' }, timestamp: 1 });
    expect(e?.laText).toBe(false);
    expect(e?.text).toContain('ảnh');
  });
  it('bỏ qua tin do OA gửi, sự kiện theo dõi, tin rỗng, dữ liệu rác', () => {
    expect(phanTichSuKien({ event_name: 'oa_send_text', sender: { id: 'oa' }, message: { text: 'x' } })).toBeNull();
    expect(phanTichSuKien({ event_name: 'follow', follower: { id: 'u1' } })).toBeNull();
    expect(phanTichSuKien({ event_name: 'user_send_text', sender: { id: 'u1' }, message: { text: '   ' } })).toBeNull();
    expect(phanTichSuKien({ event_name: 'user_send_text', message: { text: 'a' } })).toBeNull();
    expect(phanTichSuKien(null)).toBeNull();
    expect(phanTichSuKien('rac')).toBeNull();
  });
});
