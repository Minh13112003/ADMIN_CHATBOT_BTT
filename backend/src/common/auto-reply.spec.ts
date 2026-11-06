import { chonQuyTac, khopTuKhoa, ngoaiGioLamViec, RuleInput } from './auto-reply';

const rule = (o: Partial<RuleInput>): RuleInput => ({
  id: o.name ?? 'r', name: 'r', type: 'KEYWORD', keywords: [], body: 'b', channels: ['WEB', 'APP', 'ZALO', 'FACEBOOK'], enabled: true, ...o,
});
const ctx = { channel: 'WEB', text: '', isFirstMessage: false, isOffHours: false, recentRuleNames: [] as string[] };

describe('khopTuKhoa', () => {
  it('không phân biệt dấu và hoa thường', () => {
    expect(khopTuKhoa({ keywords: ['giá đoàn'] }, 'Cho mình xin GIA DOAN 20 người')).toBe(true);
  });
  it('so theo ranh giới từ', () => {
    expect(khopTuKhoa({ keywords: ['đoàn'] }, 'doanh nghiệp')).toBe(false);
  });
});

describe('chonQuyTac', () => {
  it('bỏ qua quy tắc đang tắt hoặc sai kênh', () => {
    const rules = [rule({ name: 'tat', keywords: ['gia'], enabled: false }), rule({ name: 'zalo', keywords: ['gia'], channels: ['ZALO'] })];
    expect(chonQuyTac(rules, { ...ctx, text: 'gia' })).toBeNull();
  });
  it('tin đầu tiên được ưu tiên hơn từ khoá', () => {
    const rules = [rule({ name: 'kw', keywords: ['gia'] }), rule({ name: 'dau', type: 'FIRST_MESSAGE' })];
    expect(chonQuyTac(rules, { ...ctx, text: 'gia', isFirstMessage: true })?.name).toBe('dau');
  });
  it('ngoài giờ chỉ gửi một lần trong khoảng gần đây', () => {
    const rules = [rule({ name: 'ngoai', type: 'OFF_HOURS' })];
    expect(chonQuyTac(rules, { ...ctx, isOffHours: true })?.name).toBe('ngoai');
    expect(chonQuyTac(rules, { ...ctx, isOffHours: true, recentRuleNames: ['ngoai'] })).toBeNull();
  });
});

describe('ngoaiGioLamViec', () => {
  it('tính theo giờ Việt Nam', () => {
    expect(ngoaiGioLamViec(new Date('2026-11-05T03:00:00Z'), 8, 17.5)).toBe(false); // 10:00 VN
    expect(ngoaiGioLamViec(new Date('2026-11-05T11:00:00Z'), 8, 17.5)).toBe(true); // 18:00 VN
    expect(ngoaiGioLamViec(new Date('2026-11-05T00:30:00Z'), 8, 17.5)).toBe(true); // 07:30 VN
  });
});
