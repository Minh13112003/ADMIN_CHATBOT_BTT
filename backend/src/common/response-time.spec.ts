import { tomTatPhanHoi } from './response-time';

describe('tomTatPhanHoi', () => {
  it('chưa có lần nào', () => expect(tomTatPhanHoi([])).toEqual({ count: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null }));
  it('số lẻ: trung vị là số giữa, một lần rất trễ không kéo lệch trung vị', () =>
    expect(tomTatPhanHoi([30, 3600, 90])).toEqual({ count: 3, avgSeconds: 1240, medianSeconds: 90, within5MinRate: 2 / 3 }));
  it('số chẵn: trung vị là trung bình 2 số giữa', () => expect(tomTatPhanHoi([60, 120, 240, 600]).medianSeconds).toBe(180));
  it('đúng 5 phút vẫn tính là nhanh', () => expect(tomTatPhanHoi([300]).within5MinRate).toBe(1));
});
