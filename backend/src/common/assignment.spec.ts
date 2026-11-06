import { canAssignAgain, chonNguoiItViecNhat, chonNguoiXuLy } from './assignment';

const a = { id: 'a', load: 2, lastAssignedAt: new Date('2026-01-01') };
const b = { id: 'b', load: 1, lastAssignedAt: new Date('2026-01-03') };
const c = { id: 'c', load: 1, lastAssignedAt: new Date('2026-01-02') };

describe('chia việc', () => {
  it('chọn người ít khách nhất, hoà thì người lâu chưa được chia', () => {
    expect(chonNguoiItViecNhat([a, b, c])).toBe('c');
  });
  it('người chưa được chia lần nào đứng trước', () => {
    expect(chonNguoiItViecNhat([b, { id: 'moi', load: 1, lastAssignedAt: null }])).toBe('moi');
  });
  it('không còn ai đang trực thì trả null', () => {
    expect(chonNguoiItViecNhat([])).toBeNull();
    expect(chonNguoiItViecNhat([a], ['a'])).toBeNull();
  });
  it('khách cũ về người cũ nếu người đó đang trực', () => {
    expect(chonNguoiXuLy([a, b, c], 'a')).toBe('a');
  });
  it('người cũ nghỉ trực thì chia người khác', () => {
    expect(chonNguoiXuLy([b, c], 'a')).toBe('c');
  });
  it('khi chuyển người do không nhận thì bỏ qua người cũ', () => {
    expect(chonNguoiXuLy([a, b], 'a', ['a'])).toBe('b');
  });
  it('cron khác không chia lại khách vừa được nhận', () => {
    const deadline = new Date('2026-11-06T08:00:00Z');
    expect(canAssignAgain({ status: 'PENDING', mode: 'STAFF', assigneeId: null, contactAssignedAt: null }, deadline)).toBe(true);
    expect(canAssignAgain({ status: 'PENDING', mode: 'STAFF', assigneeId: 'a', contactAssignedAt: null }, deadline)).toBe(false);
    expect(canAssignAgain({ status: 'CONTACT', mode: 'BOT', assigneeId: 'a', contactAssignedAt: new Date('2026-11-06T07:59:00Z') }, deadline)).toBe(true);
    expect(canAssignAgain({ status: 'CONTACT', mode: 'BOT', assigneeId: 'a', contactAssignedAt: new Date('2026-11-06T08:01:00Z') }, deadline)).toBe(false);
  });
});
