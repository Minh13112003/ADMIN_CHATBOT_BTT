import { duongDanLuuTru, duongDanTrongThuMuc, kiemLinkTep, kyLinkTep, loiTep, nhanRaLoaiTep, tenTepAnToan, tomTatDinhKem } from './attachments';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const PDF = Buffer.from('%PDF-1.7 noi dung');

describe('nhanRaLoaiTep', () => {
  it('nhận ra theo nội dung', () => {
    expect(nhanRaLoaiTep(JPG)?.type).toBe('image/jpeg');
    expect(nhanRaLoaiTep(PNG)?.type).toBe('image/png');
    expect(nhanRaLoaiTep(WEBP)?.type).toBe('image/webp');
    expect(nhanRaLoaiTep(PDF)).toMatchObject({ type: 'application/pdf', anh: false });
  });
  it.each([
    ['exe', Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ['html', Buffer.from('<html><script>')],
    ['svg', Buffer.from('<svg xmlns=')],
    ['rỗng', Buffer.alloc(0)],
    ['ngắn', Buffer.from([0xff, 0xd8])],
  ])('từ chối %s', (_ten, b) => expect(nhanRaLoaiTep(b)).toBeNull());
});

describe('loiTep', () => {
  it('file hợp lệ không có lỗi', () => expect(loiTep(JPG)).toBeNull());
  it('file lạ bị từ chối', () => expect(loiTep(Buffer.from('MZ....'))).toMatch(/Chỉ gửi được/));
  it('ảnh quá 10 MB', () => expect(loiTep(Buffer.concat([JPG, Buffer.alloc(10 * 1024 * 1024)]))).toMatch(/10 MB/));
  it('PDF 15 MB vẫn nhận, quá 20 MB thì không', () => {
    expect(loiTep(Buffer.concat([PDF, Buffer.alloc(15 * 1024 * 1024)]))).toBeNull();
    expect(loiTep(Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024)]))).toMatch(/20 MB/);
  });
});

describe('tenTepAnToan', () => {
  it.each([
    ['../../etc/passwd', 'jpg', 'passwd'],
    ['C:\\Users\\a\\anh cccd.jpg', 'jpg', 'anh cccd.jpg'],
    ['  ', 'pdf', 'tep.pdf'],
    ['..', 'png', 'tep.png'],
    ['a<b>c|d?.pdf', 'pdf', 'abcd.pdf'],
  ])('%j', (raw, ext, out) => expect(tenTepAnToan(raw, ext)).toBe(out));
  it('giữ dấu tiếng Việt kể cả khi multer đọc nhầm latin1', () => expect(tenTepAnToan(Buffer.from('Hộ chiếu.pdf', 'utf8').toString('latin1'), 'pdf')).toBe('Hộ chiếu.pdf'));
  it('tên quá dài bị cắt', () => expect(tenTepAnToan(`${'a'.repeat(300)}.pdf`, 'pdf').length).toBeLessThanOrEqual(120));
});

describe('đường dẫn và tóm tắt', () => {
  it('đường dẫn gồm tháng, id và đuôi', () => expect(duongDanLuuTru('t1', 'jpg', new Date('2026-11-06T03:00:00Z'))).toBe('2026-11/t1.jpg'));
  it('tin chỉ có ảnh', () => expect(tomTatDinhKem('', 'image/png', 'a.png')).toBe('[Ảnh]'));
  it('tin chỉ có PDF', () => expect(tomTatDinhKem(' ', 'application/pdf', 'bao-gia.pdf')).toBe('[Tệp] bao-gia.pdf'));
  it('có chữ thì lấy chữ', () => expect(tomTatDinhKem('Gửi anh', 'image/png', 'a.png')).toBe('Gửi anh'));
});

describe('link xem file có hạn', () => {
  const S = 'x'.repeat(40);
  const link = (id: string, exp: number) => {
    const q = new URL(kyLinkTep(S, id, exp), 'http://h').searchParams;
    return { exp: q.get('exp'), sig: q.get('sig') };
  };
  it('hợp lệ trong hạn', () => {
    const { exp, sig } = link('m1', 2000);
    expect(kiemLinkTep(S, 'm1', exp, sig, 1000)).toBe(true);
  });
  it('hết hạn', () => {
    const { exp, sig } = link('m1', 2000);
    expect(kiemLinkTep(S, 'm1', exp, sig, 2001)).toBe(false);
  });
  it('đổi sang tin khác thì sai chữ ký', () => {
    const { exp, sig } = link('m1', 2000);
    expect(kiemLinkTep(S, 'm2', exp, sig, 1000)).toBe(false);
  });
  it('kéo dài hạn thì sai chữ ký', () => {
    const { sig } = link('m1', 2000);
    expect(kiemLinkTep(S, 'm1', '9999999999', sig, 1000)).toBe(false);
  });
  it('khoá khác thì sai', () => {
    const { exp, sig } = link('m1', 2000);
    expect(kiemLinkTep('y'.repeat(40), 'm1', exp, sig, 1000)).toBe(false);
  });
  it.each([[undefined], [''], [123], ['abc']])('thiếu hoặc sai chữ ký %j', (sig) => expect(kiemLinkTep(S, 'm1', '2000', sig, 1000)).toBe(false));
  it.each([['abc'], [undefined], ['1.5']])('exp không hợp lệ %j', (exp) => expect(kiemLinkTep(S, 'm1', exp, 'x', 1000)).toBe(false));
});

describe('duongDanTrongThuMuc', () => {
  it('nhận đường dẫn do backend sinh', () => {
    expect(duongDanTrongThuMuc('/data/files', '2026-11/3f2a-bc.jpg')).toBe('/data/files/2026-11/3f2a-bc.jpg');
    expect(duongDanTrongThuMuc('/data/files/', '2026-11/a.pdf')).toBe('/data/files/2026-11/a.pdf');
  });
  it.each(['../etc/passwd', '2026-11/../x.jpg', '/abs/x.jpg', '2026-11/a/b.jpg', '2026-11/.hidden', 'x.jpg', '', 'a\\b.jpg'])('từ chối %j', (p) => {
    expect(duongDanTrongThuMuc('/data/files', p)).toBeNull();
  });
});
