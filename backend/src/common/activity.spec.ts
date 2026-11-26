import { khoangNgayVN, moTaThaoTac } from './activity';

const goi = (method: string, path: string, o: { params?: Record<string, string>; body?: Record<string, unknown>; ketQua?: unknown; khach?: string; doiTuong?: string } = {}) =>
  moTaThaoTac({ method, path: `/api/v1${path}`, params: o.params ?? {}, body: o.body, ketQua: o.ketQua, khach: o.khach, doiTuong: o.doiTuong });

describe('nhật ký thao tác', () => {
  it('nhắn tin: ghi tên khách và nội dung rút gọn, gắn hội thoại', () => {
    expect(goi('POST', '/conversations/:id/messages', { params: { id: 'c1' }, body: { text: 'Dạ tour Thái Lan còn chỗ ạ' }, ketQua: { id: 'm1' }, khach: 'Lan' })).toEqual({
      group: 'MESSAGE', action: 'message.send', summary: 'Nhắn cho khách Lan: "Dạ tour Thái Lan còn chỗ ạ"', conversationId: 'c1', targetId: 'm1',
    });
  });
  it('không bao giờ chép mật khẩu vào nhật ký', () => {
    const tao = goi('POST', '/users', { body: { fullName: 'Thảo', email: 'thao@btt.vn', password: 'MatKhau123!', role: 'SALE' }, ketQua: { id: 'u9' } });
    expect(tao?.summary).toBe('Tạo tài khoản Thảo (thao@btt.vn, sale)');
    expect(JSON.stringify(tao)).not.toContain('MatKhau123');
    const datLai = goi('POST', '/users/:id/reset-password', { params: { id: 'u9' }, body: { password: 'MatKhau456!' }, doiTuong: 'Thảo' });
    expect(datLai?.summary).toBe('Đặt lại mật khẩu cho Thảo');
    expect(JSON.stringify(datLai)).not.toContain('MatKhau456');
    expect(JSON.stringify(goi('POST', '/auth/change-password', { body: { currentPassword: 'a', newPassword: 'MatKhauMoi' } }))).not.toContain('MatKhauMoi');
    expect(JSON.stringify(goi('PUT', '/channel-settings/:channel', { params: { channel: 'zalo' }, body: { appSecret: 'BiMat' } }))).not.toContain('BiMat');
  });
  it('voucher dùng mã đọc trước khi xoá', () => {
    expect(goi('DELETE', '/vouchers/:id', { params: { id: 'v1' }, ketQua: { ok: true }, doiTuong: 'TET2027' })?.summary).toBe('Xoá voucher TET2027');
    expect(goi('PATCH', '/vouchers/:id/active', { params: { id: 'v1' }, body: { isActive: false }, doiTuong: 'TET2027' })?.summary).toBe('Tạm khoá voucher TET2027');
  });
  it('biểu cảm, sửa, xoá tin', () => {
    expect(goi('POST', '/conversations/:id/messages/:messageId/reaction', { params: { id: 'c1', messageId: 'm1' }, ketQua: { emoji: 'heart' }, khach: 'Lan' })?.summary).toBe('Thả "thả tim" vào tin với khách Lan');
    expect(goi('POST', '/conversations/:id/messages/:messageId/reaction', { params: { id: 'c1', messageId: 'm1' }, ketQua: { emoji: null }, khach: 'Lan' })?.summary).toBe('Gỡ biểu cảm khỏi tin với khách Lan');
    expect(goi('DELETE', '/conversations/:id/messages/:messageId', { params: { id: 'c1', messageId: 'm1' }, ketQua: { text: 'Giá 5 triệu' }, khach: 'Lan' })?.summary).toBe('Xoá tin với khách Lan: "Giá 5 triệu"');
  });
  it('bỏ qua thao tác đọc, route của khách app, chatbot và webhook', () => {
    expect(goi('POST', '/conversations/:id/read', { params: { id: 'c1' } })).toBeNull();
    expect(goi('POST', '/app/bookings')).toBeNull();
    expect(goi('POST', '/ingest/inbound')).toBeNull();
    expect(goi('POST', '/webhooks/zalo')).toBeNull();
  });
  it('route ghi chưa có mô tả riêng vẫn được ghi', () => {
    expect(goi('POST', '/something/new')).toMatchObject({ action: 'other', summary: 'Thao tác khác: POST /something/new' });
  });
  it('ngày theo giờ Việt Nam', () => {
    const k = khoangNgayVN('2026-11-26')!;
    expect(k.tu.toISOString()).toBe('2026-11-25T17:00:00.000Z');
    expect(k.den.toISOString()).toBe('2026-11-26T17:00:00.000Z');
    expect(khoangNgayVN('26/11/2026')).toBeNull();
  });
});
