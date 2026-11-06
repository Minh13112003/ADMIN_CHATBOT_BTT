export type Granularity = 'day' | 'week' | 'month' | 'quarter';

const VN_MS = 7 * 60 * 60 * 1000;

/** Mốc được tính theo lịch Việt Nam rồi chuyển lại thành UTC để truy vấn PostgreSQL. */
export function seriesBuckets(granularity: Granularity, periods: number, now = new Date()) {
  const local = new Date(now.getTime() + VN_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const mondayOffset = (local.getUTCDay() + 6) % 7;
  const current = granularity === 'day' ? Date.UTC(year, month, day)
    : granularity === 'week' ? Date.UTC(year, month, day - mondayOffset)
    : granularity === 'month' ? Date.UTC(year, month, 1)
    : Date.UTC(year, Math.floor(month / 3) * 3, 1);

  return Array.from({ length: periods }, (_, index) => {
    const step = index - periods + 1;
    const d = new Date(current);
    if (granularity === 'day') d.setUTCDate(d.getUTCDate() + step);
    if (granularity === 'week') d.setUTCDate(d.getUTCDate() + step * 7);
    if (granularity === 'month') d.setUTCMonth(d.getUTCMonth() + step);
    if (granularity === 'quarter') d.setUTCMonth(d.getUTCMonth() + step * 3);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const dd = d.getUTCDate();
    const label = granularity === 'quarter' ? `Q${Math.floor(m / 3) + 1}/${y}`
      : granularity === 'month' ? `${String(m + 1).padStart(2, '0')}/${y}`
      : `${String(dd).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`;
    return { start: new Date(d.getTime() - VN_MS).toISOString(), label };
  });
}

export function seriesEnd(granularity: Granularity, start: string) {
  const d = new Date(new Date(start).getTime() + VN_MS);
  if (granularity === 'day') d.setUTCDate(d.getUTCDate() + 1);
  if (granularity === 'week') d.setUTCDate(d.getUTCDate() + 7);
  if (granularity === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  if (granularity === 'quarter') d.setUTCMonth(d.getUTCMonth() + 3);
  return new Date(d.getTime() - VN_MS);
}
