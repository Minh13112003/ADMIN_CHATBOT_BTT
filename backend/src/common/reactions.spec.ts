import { bieuCamSau, canhBaoXoa, laBieuCam, loiSuaTin, tuMaZalo } from './reactions';
import { phanTichPhanUng } from './zalo';

describe('biểu cảm tin nhắn', () => {
  it('thả lại đúng biểu cảm đang có thì gỡ, khác thì đổi, null là gỡ', () => {
    expect(bieuCamSau(null, 'heart')).toBe('heart');
    expect(bieuCamSau('heart', 'heart')).toBeNull();
    expect(bieuCamSau('heart', 'haha')).toBe('haha');
    expect(bieuCamSau('like', null)).toBeNull();
  });
  it('đổi mã Zalo, loại ngoài 6 loại chính thì null', () => {
    expect(tuMaZalo('/-strong')).toBe('like');
    expect(tuMaZalo(':-h')).toBe('angry');
    expect(tuMaZalo('/-rose')).toBeNull();
    expect(tuMaZalo(undefined)).toBeNull();
    expect(laBieuCam('wow')).toBe(true);
    expect(laBieuCam('love')).toBe(false);
  });
  it('Zalo: sự kiện của OA không tính là khách thả; khách gỡ thì go = true', () => {
    expect(phanTichPhanUng({ event_name: 'oa_reacted_message', sender: { id: 'oa' }, message: { msg_id: 'm1', react_icon: '/-heart' } })).toBeNull();
    expect(phanTichPhanUng({ event_name: 'user_reacted_message', sender: { id: 'u1' }, message: { msg_id: 'm1', react_icon: '/-remove' } })).toMatchObject({ go: true, bieuCam: null });
  });
});

describe('sửa và xoá tin', () => {
  const tin = { senderType: 'STAFF', staffId: 'u1', internal: false, isAvailable: true, text: 'Chào anh' };
  it('chỉ người gửi sửa được tin nhân viên ở web/app', () => {
    expect(loiSuaTin(tin, 'u1', 'WEB')).toBeNull();
    expect(loiSuaTin(tin, 'u1', 'APP')).toBeNull();
    expect(loiSuaTin(tin, 'u2', 'WEB')).toMatch(/chính mình/);
    expect(loiSuaTin({ ...tin, senderType: 'CUSTOMER' }, 'u1', 'WEB')).toMatch(/nhân viên/);
    expect(loiSuaTin({ ...tin, isAvailable: false }, 'u1', 'WEB')).toMatch(/đã bị xoá/);
    expect(loiSuaTin({ ...tin, text: ' ' }, 'u1', 'WEB')).toMatch(/không có chữ/);
  });
  it('Zalo và Facebook không cho sửa vì khách vẫn thấy tin cũ', () => {
    expect(loiSuaTin(tin, 'u1', 'ZALO')).toMatch(/Zalo/);
    expect(loiSuaTin(tin, 'u1', 'FACEBOOK')).toMatch(/Facebook/);
  });
  it('xoá tin đã gửi qua Zalo/Facebook thì cảnh báo khách vẫn thấy; tin khách, log nội bộ, web thì không', () => {
    expect(canhBaoXoa('ZALO', 'STAFF', false)).toMatch(/Zalo/);
    expect(canhBaoXoa('FACEBOOK', 'BOT', false)).toMatch(/Facebook/);
    expect(canhBaoXoa('ZALO', 'CUSTOMER', false)).toBeNull();
    expect(canhBaoXoa('ZALO', 'SYSTEM', true)).toBeNull();
    expect(canhBaoXoa('WEB', 'STAFF', false)).toBeNull();
  });
});
