import { dongNghiepDangNhan, LockInput, nguoiPhuTrachSauKhiGui, vaiTro } from './locks';

const now = new Date('2026-11-06T10:00:00Z');
const MOT_PHUT = 60_000;
const c = (o: Partial<LockInput>): LockInput => ({ mode: 'STAFF', assigneeId: 'minh', lastStaffActivityAt: null, lastStaffActivityBy: null, ...o });
const truoc = (giay: number) => new Date(now.getTime() - giay * 1000);

describe('vaiTro', () => {
  it('chưa ai phụ trách', () => expect(vaiTro(c({ assigneeId: null }), 'thao')).toBe('UNASSIGNED'));
  it('mình phụ trách', () => expect(vaiTro(c({}), 'minh')).toBe('OWNER'));
  it('người khác phụ trách', () => expect(vaiTro(c({}), 'thao')).toBe('SUPPORT'));
});

describe('dongNghiepDangNhan', () => {
  it('đồng nghiệp vừa gõ 20 giây trước: cảnh báo', () => expect(dongNghiepDangNhan(c({ lastStaffActivityAt: truoc(20), lastStaffActivityBy: 'minh' }), 'thao', now, MOT_PHUT)).toBe('minh'));
  it('quá 1 phút: không cảnh báo', () => expect(dongNghiepDangNhan(c({ lastStaffActivityAt: truoc(61), lastStaffActivityBy: 'minh' }), 'thao', now, MOT_PHUT)).toBeNull());
  it('chính mình vừa gõ: không cảnh báo', () => expect(dongNghiepDangNhan(c({ lastStaffActivityAt: truoc(5), lastStaffActivityBy: 'thao' }), 'thao', now, MOT_PHUT)).toBeNull());
  it('chưa ai gõ', () => expect(dongNghiepDangNhan(c({}), 'thao', now, MOT_PHUT)).toBeNull());
  it('người hỗ trợ đang gõ thì người phụ trách cũng được cảnh báo', () =>
    expect(dongNghiepDangNhan(c({ lastStaffActivityAt: truoc(3), lastStaffActivityBy: 'thao' }), 'minh', now, MOT_PHUT)).toBe('thao'));
});

describe('nguoiPhuTrachSauKhiGui', () => {
  it('chưa ai phụ trách: trả lời là nhận', () => expect(nguoiPhuTrachSauKhiGui({ mode: 'BOT', assigneeId: null }, 'thao')).toEqual({ assigneeId: 'thao', nhanKhach: true, hoTro: false }));
  it('được chia cho mình, bot đang chạy: gửi là nhận', () => expect(nguoiPhuTrachSauKhiGui({ mode: 'BOT', assigneeId: 'thao' }, 'thao')).toEqual({ assigneeId: 'thao', nhanKhach: true, hoTro: false }));
  it('mình đang xử lý: không đổi gì', () => expect(nguoiPhuTrachSauKhiGui({ mode: 'STAFF', assigneeId: 'thao' }, 'thao')).toEqual({ assigneeId: 'thao', nhanKhach: false, hoTro: false }));
  it('chia cho Minh nhưng Minh chưa trả lời: Thảo trả lời trước thì nhận khách', () =>
    expect(nguoiPhuTrachSauKhiGui({ mode: 'BOT', assigneeId: 'minh' }, 'thao')).toEqual({ assigneeId: 'thao', nhanKhach: true, hoTro: false }));
  it('Minh đang xử lý: Thảo nhắn là hỗ trợ, Minh vẫn phụ trách', () =>
    expect(nguoiPhuTrachSauKhiGui({ mode: 'STAFF', assigneeId: 'minh' }, 'thao')).toEqual({ assigneeId: 'minh', nhanKhach: false, hoTro: true }));
});
