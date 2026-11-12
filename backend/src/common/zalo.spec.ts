import { chuanHoaLichSu, chuKyHopLe, chuKyZalo, phanTichSuKien, taoPkce, thuCongThuc } from './zalo';
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
  it('chẩn đoán: chỉ trả tên cặp khớp, không lộ khoá', () => {
    const mac = createHash('sha256').update(raw + 'k2').digest('hex');
    const kq = thuCongThuc(`mac=${mac}`, '123', raw, '1', { appSecret: 'k1', oaSecretKey: 'k2' });
    expect(kq).toEqual(['oaSecretKey:sha(R+K)']);
    const mac2 = createHash('sha256').update('123' + 'k1' + raw + '1').digest('hex');
    expect(thuCongThuc(mac2, '123', raw, '1', { appSecret: 'k1' })).toContain('appSecret:sha(A+K+R+T)');
    expect(thuCongThuc(undefined, '123', raw, '1', { appSecret: 'k1' })).toEqual([]);
  });
  it('lịch sử: xếp cũ trước, phân biệt khách và OA, tin không phải chữ thành dòng báo', () => {
    const kq = chuanHoaLichSu(
      [
        { message_id: 'b', from_id: 'oa1', time: 2000, type: 'text', message: 'Dạ chào anh' },
        { message_id: 'a', from_id: 'u1', time: 1000, type: 'text', message: 'Hi' },
        { message_id: 'c', from_id: 'u1', time: 3000, type: 'photo' },
        { message_id: '', from_id: 'u1', time: 4000, type: 'text', message: 'bỏ vì thiếu mã' },
        { message_id: 'd', from_id: 'u1', type: 'text', message: 'bỏ vì thiếu giờ' },
      ],
      'u1',
    );
    expect(kq.map((t) => [t.msgId, t.tuKhach])).toEqual([['a', true], ['b', false], ['c', true]]);
    expect(kq[0].text).toBe('Hi');
    expect(kq[2].text).toContain('photo');
    expect(chuanHoaLichSu('rac', 'u1')).toEqual([]);
  });
  it('lịch sử: không có from_id thì dùng src (1 = khách)', () => {
    const kq = chuanHoaLichSu([{ message_id: 'a', src: 1, time: 1, message: 'x' }, { message_id: 'b', src: 0, time: 2, message: 'y' }], 'u1');
    expect(kq.map((t) => t.tuKhach)).toEqual([true, false]);
  });
});
