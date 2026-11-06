import { chuanHoaSoDienThoai, cungMotNguoi, doiGapNhanVien, gopTen, khoaTimKiem, truyVanTin } from './text';

describe('chuanHoaSoDienThoai', () => {
  it.each([
    ['0900 000 101', '0900000101'],
    ['+84900000101', '0900000101'],
    ['84900000101', '0900000101'],
    ['090-000-0101', '0900000101'],
  ])('%s -> %s', (raw, out) => expect(chuanHoaSoDienThoai(raw)).toBe(out));

  it.each(['12345', '090000010', '09000001011', 'abc'])('từ chối %s', (raw) => expect(chuanHoaSoDienThoai(raw)).toBeNull());
});

describe('cungMotNguoi', () => {
  it.each(['Hoa', 'Nguyễn Hoa', 'Thị Hoa', 'nguyen thi hoa', 'NGUYỄN THỊ HOA'])('%s khớp Nguyễn Thị Hoa', (ten) =>
    expect(cungMotNguoi(ten, 'Nguyễn Thị Hoa')).toBe(true),
  );
  it.each(['Tuấn', 'Trần Văn Nam', 'Nguyễn Tuấn'])('%s không khớp Nguyễn Thị Hoa', (ten) =>
    expect(cungMotNguoi(ten, 'Nguyễn Thị Hoa')).toBe(false),
  );
});

describe('gopTen', () => {
  it('giữ tên đầy đủ nhất và lưu cách viết cũ', () => {
    expect(gopTen('Ngọc Lan', [], 'Bùi Ngọc Lan')).toEqual({ name: 'Bùi Ngọc Lan', aliases: ['Ngọc Lan'] });
  });
  it('không lưu trùng khi chỉ khác dấu hoặc hoa thường', () => {
    expect(gopTen('Nguyễn Thị Hoa', ['Hoa'], 'nguyen thi hoa').aliases).toEqual(['Hoa']);
  });
});

describe('doiGapNhanVien', () => {
  it.each([
    'Hãy cho tôi liên hệ với nhân viên',
    'Cho tôi gặp nhân viên',
    'cho toi gap nhan vien',
    'Mình muốn kết nối với nhân viên để đổi ngày',
    'Công ty mình cần đi 30 người, nối máy nhân viên giúp mình',
    'Tôi muốn khiếu nại',
    'Tôi bị mất hộ chiếu',
  ])('nhận ra: %s', (cau) => expect(doiGapNhanVien(cau)).toBe(true));

  it.each([
    'Tour Đà Lạt giá bao nhiêu?',
    'Nhân viên hướng dẫn có đi cùng đoàn không?',
    'Tôi liên hệ đặt tour như thế nào?',
    'Có tour Trung Quốc dịp Tết không',
  ])('không nhầm: %s', (cau) => expect(doiGapNhanVien(cau)).toBe(false));
});

describe('khoaTimKiem', () => {
  it.each([
    ['Nguyễn Thị Hoà', ['nguyen', 'thi', 'hoa']],
    ['  nguyen   HOA ', ['nguyen', 'hoa']],
    ['Đặng Đức', ['dang', 'duc']],
    ['hoa hoa', ['hoa']],
    ['0993 869 012', ['0993869012']],
    ['+84 993 869 012', ['0993869012']],
    ['84993869012', ['0993869012']],
    ['869.012', ['869012']],
    ['Hoa 0993', ['hoa', '0993']],
    ['100%_', ['100']],
  ])('%s -> %j', (raw, out) => expect(khoaTimKiem(raw)).toEqual(out));

  it('chữ đã tách dấu (NFD) cho cùng kết quả', () => expect(khoaTimKiem('Phạm Quỳnh'.normalize('NFD'))).toEqual(['pham', 'quynh']));
  it.each(['', '   ', '%', '_ %'])('rỗng với %j', (raw) => expect(khoaTimKiem(raw)).toEqual([]));
});

describe('truyVanTin', () => {
  it.each([
    ['Phú Quốc', 'phu & quoc:*'],
    ['  tour   ĐÀ LẠT ', 'tour & da & lat:*'],
    ['giá 4.990.000', 'gia & 4 & 990 & 000:*'],
    ["it's & | ! (x)", 'it & s & x:*'],
    ['phu quo', 'phu & quo:*'],
  ])('%s -> %s', (raw, out) => expect(truyVanTin(raw)).toBe(out));
  it.each(['', '  ', '&|!():*', '...'])('rỗng với %j', (raw) => expect(truyVanTin(raw)).toBeNull());
});
