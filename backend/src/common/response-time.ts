// Thời gian sale trả lời khách đòi gặp nhân viên. Hàm thuần, có test ở response-time.spec.ts.

/** Mốc "trả lời nhanh" trên trang thống kê: 5 phút. */
export const NHANH_GIAY = 5 * 60;

/** Trung bình, trung vị (ít bị một lần trả lời rất trễ kéo lệch) và tỷ lệ trả lời trong 5 phút. */
export function tomTatPhanHoi(giay: number[]): { count: number; avgSeconds: number | null; medianSeconds: number | null; within5MinRate: number | null } {
  if (!giay.length) return { count: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null };
  const xep = [...giay].sort((a, b) => a - b);
  const giua = Math.floor(xep.length / 2);
  const median = xep.length % 2 ? xep[giua] : Math.round((xep[giua - 1] + xep[giua]) / 2);
  return {
    count: xep.length,
    avgSeconds: Math.round(xep.reduce((a, b) => a + b, 0) / xep.length),
    medianSeconds: median,
    within5MinRate: xep.filter((s) => s <= NHANH_GIAY).length / xep.length,
  };
}
