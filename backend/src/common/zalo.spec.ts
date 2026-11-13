import { phanTichChiaSe, layDinhKem, layTrich, phanTichOa, phanTichPhanUng, chuanHoaChatGanDay, chuanHoaLichSu, chuKyHopLe, chuKyZalo, phanTichSuKien, taoPkce, thuCongThuc } from './zalo';
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
  it('chat gần đây: nhận ra khách là bên không phải OA, mỗi khách một dòng, mới nhất trước', () => {
    const kq = chuanHoaChatGanDay([
      { from_id: 'u1', from_display_name: 'An', from_avatar: 'https://a/1.jpg', to_id: 'oa', time: 1000, message: 'Hi' },
      { from_id: 'oa', to_id: 'u2', to_display_name: 'Bình', time: 3000, message: 'Dạ' },
      { from_id: 'u1', to_id: 'oa', from_display_name: 'An', time: 2000, message: 'Tour Đà Lạt' },
    ]);
    expect(kq.map((k) => [k.userId, k.ten, k.text])).toEqual([['u2', 'Bình', 'Dạ'], ['u1', 'An', 'Tour Đà Lạt']]);
    expect(kq[1].anh).toBe('https://a/1.jpg');
    expect(chuanHoaChatGanDay('rac')).toEqual([]);
    expect(chuanHoaChatGanDay([{ from_id: 'u1', to_id: 'oa' }])).toEqual([]);
  });
  it('chat gần đây: dùng oaId đã biết khi có', () => {
    const kq = chuanHoaChatGanDay([{ from_id: 'oa', to_id: 'u1', time: 1, message: 'x' }, { from_id: 'oa', to_id: 'u2', time: 2, message: 'y' }], 'oa');
    expect(kq.map((k) => k.userId)).toEqual(['u2', 'u1']);
  });
  it('tin OA gửi: lấy người nhận, đặt chữ thay thế cho tin không có chữ', () => {
    expect(phanTichOa({ event_name: 'oa_send_text', sender: { id: 'oa' }, recipient: { id: 'u1' }, message: { text: ' Dạ ', msg_id: 'o1' } })).toMatchObject({ userId: 'u1', msgId: 'o1', text: 'Dạ' });
    expect(phanTichOa({ event_name: 'oa_send_image', recipient: { id: 'u1' }, message: {} })?.text).toContain('ảnh');
    expect(phanTichOa({ event_name: 'user_send_text', recipient: { id: 'u1' } })).toBeNull();
    expect(phanTichOa({ event_name: 'oa_send_text', message: { text: 'x' } })).toBeNull();
  });
  it('tệp đính kèm và trích dẫn: đọc đúng, thiếu dữ liệu thì rỗng', () => {
    expect(layDinhKem({ message: { attachments: [{ type: 'image', payload: { url: 'https://z/a.jpg' } }, { type: 'file', payload: { url: 'http://x', name: 'a.pdf' } }, null] } })).toEqual([{ loai: 'image', url: 'https://z/a.jpg', ten: null }]);
    expect(layDinhKem({})).toEqual([]);
    expect(layTrich({ message: { quote_msg_id: 'q1' } })).toEqual({ msgId: 'q1', text: null });
    expect(layTrich({ message: {} })).toEqual({ msgId: null, text: null });
  });
  it('khách thả cảm xúc', () => {
    expect(phanTichPhanUng({ event_name: 'user_reacted_message', sender: { id: 'u1' }, message: { msg_id: 'm1', react_icon: '/-heart' } })).toEqual({ userId: 'u1', msgId: 'm1', camXuc: 'thả tim' });
    expect(phanTichPhanUng({ event_name: 'user_send_text', sender: { id: 'u1' } })).toBeNull();
  });
  it('lịch sử: đọc mã tin được trích dẫn và link ảnh', () => {
    const [t] = chuanHoaLichSu([{ message_id: 'm2', time: 1700000000000, from_id: 'u1', type: 'photo', message: '', url: 'https://z/a.jpg', quote_msg_id: 'm1' }], 'u1');
    expect(t).toMatchObject({ msgId: 'm2', tuKhach: true, url: 'https://z/a.jpg', trichMa: 'm1', loai: 'photo' });
  });
  it('lịch sử theo dữ liệu Zalo thật: ảnh lấy chữ ở description, nosupport và tin không có type ghi rõ là không xem được', () => {
    const [anh, ns, rong] = chuanHoaLichSu(
      [
        { message_id: 'a', time: 1, src: 1, type: 'photo', thumb: 'https://z/t.jpg', url: 'https://z/a.jpg', description: 'Ảnh hộ chiếu' },
        { message_id: 'b', time: 2, src: 0, type: 'nosupport' },
        { message_id: 'c', time: 3, src: 0, from_avatar: 'https://z/avt.jpg' },
      ],
      'u1',
    );
    expect(anh).toMatchObject({ url: 'https://z/a.jpg', chu: 'Ảnh hộ chiếu' });
    expect(ns.text).toContain('Zalo không cho xem qua API');
    expect(ns.url).toBeNull();
    expect(rong.text).toContain('Zalo không cho xem qua API');
    expect(rong.url).toBeNull();
  });
  it('lịch sử: tin loại text không có chữ vẫn tìm link lồng nhau, bỏ ảnh đại diện; tin có chữ thì không lấy link', () => {
    const [a, b] = chuanHoaLichSu(
      [
        { message_id: 'm1', time: 1, from_id: 'oa', type: 'text', message: '', from_avatar: 'https://z/avt.jpg', attachment: { payload: { url: 'https://z/b.jpg' } } },
        { message_id: 'm2', time: 2, from_id: 'oa', type: 'text', message: 'xem https://x.vn', href: 'https://x.vn' },
      ],
      'u1',
    );
    expect(a.url).toBe('https://z/b.jpg');
    expect(b.url).toBeNull();
  });
  it('khách chia sẻ thông tin: lấy số và tên, sự kiện khác thì null', () => {
    expect(phanTichChiaSe({ event_name: 'user_submit_info', sender: { id: 'u1' }, info: { phone: ' 84912345678 ', name: 'An' } })).toEqual({ userId: 'u1', phone: '84912345678', name: 'An' });
    expect(phanTichChiaSe({ event_name: 'user_submit_info', sender: { id: 'u1' }, info: {} })).toEqual({ userId: 'u1', phone: null, name: null });
    expect(phanTichChiaSe({ event_name: 'follow', sender: { id: 'u1' } })).toBeNull();
  });
});
