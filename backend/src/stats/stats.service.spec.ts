import { dauKy } from './stats.service';

describe('dauKy theo giờ Việt Nam', () => {
  const now = new Date('2026-11-05T20:00:00Z'); // 03:00 ngày 06/11 giờ VN
  it('hôm nay bắt đầu từ 00:00 giờ VN', () => expect(dauKy('today', now).toISOString()).toBe('2026-11-05T17:00:00.000Z'));
  it('7 ngày tính cả hôm nay', () => expect(dauKy('week', now).toISOString()).toBe('2026-10-30T17:00:00.000Z'));
  it('từ trước tới nay không giới hạn', () => expect(dauKy('all', now).getTime()).toBe(0));
  it('tháng này từ ngày 1 giờ VN', () => expect(dauKy('month', now).toISOString()).toBe('2026-10-31T17:00:00.000Z'));
});
