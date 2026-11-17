import { demTheoKhoang, khoangBoard, thuGioVN, trungVi, tuanSapToi, viTriMoc } from './stats-board';

describe('stats-board', () => {
  const now = new Date('2026-11-17T03:00:00Z'); // 10:00 thứ Ba 17/11 giờ VN

  it('7 ngày theo ngày, mốc đầu là 00:00 giờ VN của 6 ngày trước', () => {
    const k = khoangBoard('7d', now);
    expect(k.granularity).toBe('day');
    expect(k.buckets).toHaveLength(7);
    expect(k.from.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    expect(k.to.toISOString()).toBe('2026-11-17T17:00:00.000Z');
    expect(k.prevFrom.toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });

  it('quý là 13 tuần bắt đầu từ thứ Hai', () => {
    const k = khoangBoard('quarter', now);
    expect(k.granularity).toBe('week');
    expect(k.buckets).toHaveLength(13);
    expect(k.buckets[12].start).toBe('2026-11-15T17:00:00.000Z'); // thứ Hai 16/11 giờ VN
  });

  it('tìm đúng mốc chứa thời điểm', () => {
    const starts = [0, 10, 20];
    expect(viTriMoc(starts, 30, 15)).toBe(1);
    expect(viTriMoc(starts, 30, 20)).toBe(2);
    expect(viTriMoc(starts, 30, 30)).toBe(-1);
    expect(viTriMoc(starts, 30, -1)).toBe(-1);
  });

  it('chia khoảng, khoảng cuối không trần', () => {
    expect(demTheoKhoang([1, 2, 3, 4, 5, 12], [1, 2, 3, 5, 10])).toEqual([1, 1, 2, 1, 1]);
  });

  it('trung vị', () => {
    expect(trungVi([])).toBeNull();
    expect(trungVi([5, 1, 3])).toBe(3);
    expect(trungVi([1, 2, 3, 4])).toBe(3);
  });

  it('thứ và giờ theo giờ VN', () => {
    expect(thuGioVN(new Date('2026-11-15T18:30:00Z'))).toEqual({ thu: 0, gio: 1 }); // 01:30 thứ Hai
    expect(thuGioVN(new Date('2026-11-15T16:30:00Z'))).toEqual({ thu: 6, gio: 23 }); // 23:30 Chủ nhật
  });

  it('8 tuần tới bắt đầu từ thứ Hai tuần này', () => {
    const w = tuanSapToi(now);
    expect(w).toHaveLength(9);
    expect(w[0]).toBe('2026-11-16');
    expect(w[1]).toBe('2026-11-23');
  });
});
