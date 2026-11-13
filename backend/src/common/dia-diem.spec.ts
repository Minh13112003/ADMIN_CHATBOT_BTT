import { ngayVN, timDiaDiem } from './dia-diem';

describe('timDiaDiem', () => {
  it('tour TQ, tour Tàu, tour Trung, Trung Quốc đều là Trung Quốc', () => {
    for (const c of ['Có tour TQ không em', 'tour Tàu tháng 12 giá sao', 'Bên mình có tour Trung nào phù hợp', 'Mình muốn đi Trung Quốc', 'du lịch trung quốc tết', 'TRUNG QUỐC', 'Trương Gia Giới đi mấy ngày']) {
      expect(timDiaDiem(c)).toEqual(['Trung Quốc']);
    }
  });
  it('gõ sai chính tả 1 ký tự, không dấu, viết liền', () => {
    expect(timDiaDiem('tour trung quco')).toEqual(['Trung Quốc']);
    expect(timDiaDiem('di bangkook')).toEqual(['Thái Lan']);
    expect(timDiaDiem('tour dalat 3 ngay')).toEqual(['Đà Lạt']);
    expect(timDiaDiem('di han quoc dip noel')).toEqual(['Hàn Quốc']);
  });
  it('tên ngắn dễ nhầm không bị tính khi không nói về chuyến đi', () => {
    for (const c of ['Anh Trung đã chuyển khoản', 'Mình đi tàu hoả ra ga', 'em đi trung tâm', 'Hạn thanh toán quá hạn rồi', 'Nhật ký chuyến đi', 'đi lao động', 'Thái độ nhân viên tốt', 'đi y tế']) {
      expect(timDiaDiem(c)).toEqual([]);
    }
  });
  it('nhiều địa điểm trong một câu', () => {
    expect(timDiaDiem('Phân vân giữa tour Nhật với tour Hàn')).toEqual(['Nhật Bản', 'Hàn Quốc']);
    expect(timDiaDiem('Seoul - Nami - Everland')).toEqual(['Hàn Quốc']);
  });
  it('địa danh lấy thêm từ chatbot', () => {
    expect(timDiaDiem('Có tour NZ không')).toEqual(['New Zealand']);
    expect(timDiaDiem('tour Tân Tây Lan')).toEqual(['New Zealand']);
    expect(timDiaDiem('đi Maldives mấy ngày')).toEqual(['Maldives']);
    expect(timDiaDiem('Hỏi tour Trung rồi tour New Zealand')).toEqual(['Trung Quốc', 'New Zealand']);
  });
  it('các câu thường gặp không bị nhận nhầm', () => {
    for (const c of ['tour dài ngày không em', 'Bà đến chưa con', 'cho nói chuyện với nhân viên', 'promo tháng này', 'làm quá ẩu', 'đi ngã ba']) {
      expect(timDiaDiem(c)).toEqual([]);
    }
  });
  it('rỗng thì không có gì', () => {
    expect(timDiaDiem('')).toEqual([]);
    expect(timDiaDiem('Cho mình xin giá')).toEqual([]);
  });
  it('ngày theo giờ Việt Nam', () => {
    expect(ngayVN(new Date('2026-11-12T18:00:00Z'))).toBe('2026-11-13');
    expect(ngayVN(new Date('2026-11-12T16:59:00Z'))).toBe('2026-11-12');
  });
});
