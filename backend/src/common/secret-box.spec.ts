import { giaiMa, maHoa, xemTruoc } from './secret-box';

describe('secret-box', () => {
  it('mã hoá rồi giải mã ra đúng giá trị, bản mã không chứa bản rõ', () => {
    const m = maHoa('zalo-secret-123', 'khoa-1');
    expect(m).not.toContain('zalo-secret-123');
    expect(giaiMa(m, 'khoa-1')).toBe('zalo-secret-123');
  });
  it('cùng giá trị mã hoá hai lần ra hai chuỗi khác nhau', () => {
    expect(maHoa('a', 'k')).not.toBe(maHoa('a', 'k'));
  });
  it('sai khoá hoặc bị sửa thì trả null', () => {
    const m = maHoa('abc', 'khoa-1');
    expect(giaiMa(m, 'khoa-2')).toBeNull();
    expect(giaiMa(m.slice(0, -3) + 'AAA', 'khoa-1')).toBeNull();
    expect(giaiMa('rac', 'khoa-1')).toBeNull();
  });
  it('xem trước chỉ lộ 5 ký tự cuối, giá trị ngắn che hết', () => {
    expect(xemTruoc('abcdefghijkl')).toBe('••••••••hijkl');
    expect(xemTruoc('abcdefghijk')).toBe('••••••••');
    expect(xemTruoc('abc')).toBe('••••••••');
    expect(xemTruoc('x'.repeat(40)).length).toBe(13);
  });
});
