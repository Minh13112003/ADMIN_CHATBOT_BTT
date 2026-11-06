import { seriesBuckets, seriesEnd } from './stats-series';

describe('mốc thống kê theo giờ Việt Nam', () => {
  it('tuần bắt đầu thứ Hai, kể cả khi UTC còn là Chủ nhật', () => {
    const b = seriesBuckets('week', 2, new Date('2026-11-01T18:00:00Z'));
    expect(b.map((x) => x.start)).toEqual(['2026-10-25T17:00:00.000Z', '2026-11-01T17:00:00.000Z']);
    expect(seriesEnd('week', b[1].start).toISOString()).toBe('2026-11-08T17:00:00.000Z');
  });
  it('qua ranh giới quý và năm', () => {
    expect(seriesBuckets('quarter', 2, new Date('2026-01-01T00:00:00Z'))).toEqual([
      { start: '2025-09-30T17:00:00.000Z', label: 'Q4/2025' },
      { start: '2025-12-31T17:00:00.000Z', label: 'Q1/2026' },
    ]);
  });
  it('năm nhuận có ngày 29/02', () => {
    expect(seriesBuckets('day', 2, new Date('2024-02-29T18:00:00Z')).map((x) => x.label)).toEqual(['29/02', '01/03']);
  });
  it('tháng không nhảy qua tháng ngắn', () => {
    expect(seriesBuckets('month', 3, new Date('2024-03-31T20:00:00Z')).map((x) => x.label)).toEqual(['02/2024', '03/2024', '04/2024']);
  });
});
