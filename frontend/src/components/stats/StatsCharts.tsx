import { useState } from 'react';
import useSWR from 'swr';
import { Segmented } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { trieu, vnd } from '@/lib/labels';
import type { CostSource, StatsSeriesPoint } from '@/lib/types';

type Granularity = 'day' | 'week' | 'month' | 'quarter';
const format = (n: number) => n.toLocaleString('vi-VN');
const CHART_HEIGHT = 250;
const TOP = 18, BOTTOM = 42, LEFT = 62, RIGHT = 16;

export function StatsCharts({ period }: { period: 'today' | 'week' | 'month' | 'all' }) {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [metric, setMetric] = useState<'revenue' | 'deals'>('revenue');
  const series = useSWR<StatsSeriesPoint[]>(`/stats/series?granularity=${granularity}`, fetcher, { refreshInterval: 300_000 });
  const cost = useSWR<CostSource[]>(`/stats/cost-by-source?period=${period}`, fetcher, { refreshInterval: 300_000 });

  return <div className="grid min-w-0 gap-3.5">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="font-semibold">Diễn biến theo thời gian</h3><p className="text-xs text-muted">Các mốc gần nhất; khoảng này có thể khác kỳ của thẻ tổng.</p></div><Segmented label="Mốc biểu đồ" value={granularity} onChange={setGranularity} items={[{ key: 'day', label: 'Ngày' }, { key: 'week', label: 'Tuần' }, { key: 'month', label: 'Tháng' }, { key: 'quarter', label: 'Quý' }]} /></div>
    {series.error ? <p role="alert" className="text-sm text-brand-text">Không tải được biểu đồ theo thời gian.</p> : !series.data ? <p className="text-sm text-muted">Đang tải biểu đồ...</p> : <div className="grid grid-cols-1 gap-3.5 min-[1350px]:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-3.5" aria-label="Biểu đồ doanh thu và số đơn">
        <div className="mb-3 flex flex-wrap items-center gap-2"><h4 className="flex-1 font-semibold">{metric === 'revenue' ? 'Doanh thu theo mốc' : 'Số đơn đã chốt theo mốc'}</h4><Segmented label="Số liệu biểu đồ cột" value={metric} onChange={setMetric} items={[{ key: 'revenue', label: 'Doanh thu' }, { key: 'deals', label: 'Số đơn' }]} /></div>
        <p className="mb-2 text-xs text-muted">{metric === 'revenue' ? 'Đơn vị: triệu đồng' : 'Đơn vị: đơn'}. Chỉ gồm đơn đã chốt, chưa bị huỷ.</p>
        {series.data.every((point) => point[metric] === 0) ? <p className="py-8 text-center text-sm text-muted">Chưa có dữ liệu trong kỳ này.</p> : <BarChart key={`${granularity}:${metric}`} data={series.data} metric={metric} />}
        <SeriesTable data={series.data} columns={[{ key: metric, label: metric === 'revenue' ? 'Doanh thu' : 'Số đơn' }]} />
      </section>
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-3.5" aria-label="Biểu đồ khách nhắn tin và yêu cầu gặp nhân viên">
        <h4 className="font-semibold">Khách nhắn tin và yêu cầu gặp nhân viên</h4>
        <p className="mb-2 text-xs text-muted">Đơn vị: khách và yêu cầu. Mỗi điểm ứng với một mốc thời gian.</p>
        <div className="mb-2 flex flex-wrap gap-4 text-xs"><Legend color="var(--color-brand-button)" label="Khách nhắn tin" /><Legend color="var(--color-series-contact)" label="Yêu cầu gặp nhân viên" /></div>
        {series.data.every((point) => point.customers === 0 && point.contacts === 0) ? <p className="py-8 text-center text-sm text-muted">Chưa có dữ liệu trong kỳ này.</p> : <LineChart key={granularity} data={series.data} />}
        <SeriesTable data={series.data} columns={[{ key: 'customers', label: 'Khách nhắn tin' }, { key: 'contacts', label: 'Yêu cầu gặp nhân viên' }]} />
      </section>
    </div>}
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-3.5" aria-label="Chi phí theo nguồn">
      <h4 className="font-semibold">Tỷ lệ chi phí theo nguồn</h4><p className="mt-1 text-xs text-muted">Theo kỳ thống kê đang chọn. Chi phí AI là ước tính từ token đã gắn với hội thoại.</p>
      {cost.error ? <p role="alert" className="mt-3 text-sm text-brand-text">Không tải được chi phí theo nguồn.</p> : !cost.data ? <p className="mt-3 text-sm text-muted">Đang tải chi phí...</p> : <CostDonut data={cost.data} />}
    </section>
  </div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full" style={{ background: color }} />{label}</span>;
}

function Axis({ width, max, formatValue }: { width: number; max: number; formatValue: (n: number) => string }) {
  const plot = CHART_HEIGHT - TOP - BOTTOM;
  return <>{(max <= 1 ? [0, 1] : [0, 0.5, 1]).map((ratio) => { const y = TOP + plot * (1 - ratio); return <g key={ratio}><line x1={LEFT} x2={width - RIGHT} y1={y} y2={y} stroke="var(--color-line)" /><text x={LEFT - 8} y={y + 4} textAnchor="end" fill="var(--color-muted)" fontSize="11">{formatValue(max * ratio)}</text></g>; })}</>;
}

function BarChart({ data, metric }: { data: StatsSeriesPoint[]; metric: 'revenue' | 'deals' }) {
  const [selected, setSelected] = useState(data.length - 1);
  const width = Math.max(610, data.length * 48 + LEFT + RIGHT);
  const plotWidth = width - LEFT - RIGHT, plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const max = Math.max(1, ...data.map((point) => point[metric]));
  const step = plotWidth / data.length;
  const shown = data[Math.min(selected, data.length - 1)];
  return <><div className="max-w-full"><svg className="w-full" height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img" aria-label={`Biểu đồ cột ${metric === 'revenue' ? 'doanh thu' : 'số đơn'} theo mốc`}><Axis width={width} max={max} formatValue={metric === 'revenue' ? (n) => (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : (n) => format(Math.round(n))} />{data.map((point, index) => {
    const value = point[metric]; const h = value / max * plotHeight; const x = LEFT + index * step + step * 0.18;
    return <g key={point.start} role="button" tabIndex={0} aria-label={`${point.label}: ${metric === 'revenue' ? vnd(value) : `${format(value)} đơn`}`} onClick={() => setSelected(index)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(index); } }}><rect x={x} y={TOP + plotHeight - h} width={step * 0.64} height={Math.max(1, h)} rx="3" fill={index === selected ? 'var(--color-brand-dark)' : 'var(--color-brand-button)'} /><rect x={LEFT + index * step} y={TOP} width={step} height={plotHeight} fill="transparent" /><title>{point.label}: {metric === 'revenue' ? vnd(value) : `${format(value)} đơn`}</title><text x={LEFT + (index + 0.5) * step} y={CHART_HEIGHT - 13} textAnchor="middle" fill="var(--color-muted)" fontSize="11">{point.label}</text></g>;
  })}</svg></div><p role="status" className="mt-2 text-sm text-body">{shown.label}: <strong className="text-ink">{metric === 'revenue' ? trieu(shown.revenue) : `${format(shown.deals)} đơn`}</strong></p></>;
}

function LineChart({ data }: { data: StatsSeriesPoint[] }) {
  const [selected, setSelected] = useState(data.length - 1);
  const width = Math.max(610, data.length * 48 + LEFT + RIGHT);
  const plotWidth = width - LEFT - RIGHT, plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const max = Math.max(1, ...data.map((p) => Math.max(p.customers, p.contacts)));
  const x = (i: number) => LEFT + (i + 0.5) * plotWidth / data.length;
  const y = (n: number) => TOP + plotHeight * (1 - n / max);
  const shown = data[Math.min(selected, data.length - 1)];
  const series = [{ key: 'customers' as const, color: 'var(--color-brand-button)', label: 'Khách nhắn tin' }, { key: 'contacts' as const, color: 'var(--color-series-contact)', label: 'Yêu cầu gặp nhân viên' }];
  return <><div className="max-w-full"><svg className="w-full" height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img" aria-label="Biểu đồ đường khách nhắn tin và yêu cầu gặp nhân viên"><Axis width={width} max={max} formatValue={(n) => format(Math.round(n))} />{series.map((s) => <g key={s.key}><polyline fill="none" stroke={s.color} strokeWidth="2.5" points={data.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')} />{data.map((p, i) => <circle key={p.start} cx={x(i)} cy={y(p[s.key])} r="5" fill={s.color}><title>{p.label}: {s.label} {format(p[s.key])}</title></circle>)}</g>)}{data.map((p, i) => <g key={p.start} role="button" tabIndex={0} aria-label={`${p.label}: ${format(p.customers)} khách nhắn, ${format(p.contacts)} yêu cầu`} onClick={() => setSelected(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } }}><rect x={LEFT + i * plotWidth / data.length} y={TOP} width={plotWidth / data.length} height={plotHeight} fill="transparent" /><text x={x(i)} y={CHART_HEIGHT - 13} textAnchor="middle" fill="var(--color-muted)" fontSize="11">{p.label}</text></g>)}</svg></div><p role="status" className="mt-2 text-sm text-body">{shown.label}: <strong className="text-ink">{format(shown.customers)} khách nhắn · {format(shown.contacts)} yêu cầu</strong></p></>;
}

function CostDonut({ data }: { data: CostSource[] }) {
  const total = data.reduce((n, item) => n + item.costVnd, 0);
  const colors = ['var(--color-brand-button)', 'var(--color-series-contact)', 'var(--color-green-ink)'];
  let offset = 0;
  return <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row"><svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={`Biểu đồ tỷ lệ chi phí: ${data.map((item) => `${item.source} ${item.connected ? vnd(item.costVnd) : 'chưa kết nối'}`).join(', ')}`}><circle cx="80" cy="80" r="58" fill="none" stroke="var(--color-fill)" strokeWidth="24" />{data.map((item, i) => { const part = total ? item.costVnd / total : 0; const dash = part * 364.4; const at = offset; offset += dash; return <circle key={item.source} cx="80" cy="80" r="58" fill="none" stroke={colors[i]} strokeWidth="24" strokeDasharray={`${dash} ${364.4 - dash}`} strokeDashoffset={-at} transform="rotate(-90 80 80)"><title>{item.source}: {vnd(item.costVnd)}</title></circle>; })}<text x="80" y="78" textAnchor="middle" fill="var(--color-ink)" fontSize="13" fontWeight="600">Tổng chi phí</text><text x="80" y="98" textAnchor="middle" fill="var(--color-ink)" fontSize="12">{trieu(total)}</text></svg><div className="w-full flex-1 space-y-2 text-sm">{data.map((item, i) => <div key={item.source} className="flex flex-wrap items-center gap-2"><Legend color={colors[i]} label={item.source === 'AI' ? 'AI bttAI' : item.source === 'ZALO' ? 'Zalo OA' : 'Facebook'} /><span className="ml-auto font-medium">{item.connected ? `${vnd(item.costVnd)} · ${(item.share * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : 'Chưa kết nối'}</span></div>)}{total === 0 && <p className="text-muted">Chưa có dữ liệu trong kỳ này.</p>}</div></div>;
}

function SeriesTable({ data, columns }: { data: StatsSeriesPoint[]; columns: { key: keyof StatsSeriesPoint; label: string }[] }) {
  return <table className="sr-only"><caption>Số liệu chi tiết theo mốc</caption><thead><tr><th scope="col">Mốc</th>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{data.map((point) => <tr key={point.start}><th scope="row">{point.label}</th>{columns.map((column) => <td key={column.key}>{point[column.key]}</td>)}</tr>)}</tbody></table>;
}
