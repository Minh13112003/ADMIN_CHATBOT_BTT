import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui';
import { exportCsv } from './AnalyticsUI';

/**
 * Bộ biểu đồ SVG tự vẽ cho trang Thống kê (không thêm thư viện). Biểu đồ theo thời gian tự giãn ngang
 * khi nhiều mốc và có thanh cuộn ngang; rê chuột hiện số của từng mốc.
 */

export const MAU = {
  red: '#d0021b',
  blue: '#2c4ccc',
  green: '#0e9f6e',
  amber: '#d97706',
  purple: '#7c3aed',
  slate: '#64748b',
  pink: '#db2777',
  cyan: '#0891b2',
};
export const BANG_MAU = [MAU.red, MAU.blue, MAU.green, MAU.amber, MAU.purple, MAU.slate, MAU.pink, MAU.cyan];
export const MAU_KENH = { ZALO: '#1d6cf2', WEB: MAU.red, APP: MAU.green, FACEBOOK: MAU.purple } as const;

export const so = (n: number) => Math.round(n).toLocaleString('vi-VN');
export const tienGon = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} k`;
  return so(n);
};
export const phanTram = (n: number | null | undefined, digits = 1) => (n == null ? '—' : `${(n * 100).toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Trục tròn số: 0 → max chia 4 nấc. */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return step * 4;
}

// ---------------------------------------------------------------- Khung thẻ

/** Mốc / mục người dùng bấm trên biểu đồ. */
export type Pick = { index: number; label: string };
type Ctx = { big: boolean; picked: Pick | null; onPick?: (p: Pick) => void };
const ChartCtx = createContext<Ctx>({ big: false, picked: null });
const useChart = () => useContext(ChartCtx);

export type CsvRows = (string | number)[][];
const nutVien = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-body hover:bg-fill';

/**
 * Thẻ biểu đồ (một hàng). Có nút phóng to (hộp gần toàn màn hình như "Xem thống kê" ở Nhu cầu tour) và nút Xuất file Excel (.csv).
 * Bấm vào cột / điểm / ô / dòng của biểu đồ thì mở hộp phóng to và hiện chi tiết đúng mốc đó (`detail`).
 */
export function ChartCard({ title, description, legend, action, children, className = '', csv, detail, hint }: {
  title: string;
  description?: string;
  legend?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Dữ liệu của thẻ để xuất file Excel (.csv). */
  csv?: { file: string; rows: () => CsvRows };
  /** Chi tiết khi bấm một mốc (danh sách đơn, khách...). */
  detail?: (p: Pick) => ReactNode;
  /** Dòng gợi ý trong hộp phóng to khi chưa bấm mốc nào. */
  hint?: string;
}) {
  const [big, setBig] = useState(false);
  const [picked, setPicked] = useState<Pick | null>(null);
  const xuat = csv ? () => exportCsv(csv.file, [[title], ...(description ? [[description]] : []), [], ...csv.rows()]) : undefined;
  const nutXuat = xuat && (
    <button type="button" onClick={xuat} className={nutVien}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
      Xuất file Excel (.csv)
    </button>
  );
  const chon = (p: Pick) => { setPicked(p); setBig(true); };
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {nutXuat}
          <button type="button" onClick={() => { setPicked(null); setBig(true); }} aria-label={`Phóng to biểu đồ ${title}`} title="Phóng to" className={`${nutVien} !px-2`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          </button>
        </div>
      </header>
      {(legend || action) && <div className="-mt-1 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-body">{legend}{action}</div>}
      <ChartCtx.Provider value={{ big: false, picked: null, onPick: chon }}>{children}</ChartCtx.Provider>
      {big && (
        <Modal
          title={title}
          subtitle={description}
          width={1440}
          onClose={() => setBig(false)}
          footer={
            <>
              <span className="flex-1 text-[0.8125rem] text-muted">{picked ? `Đang xem: ${picked.label}` : (hint ?? 'Bấm vào cột, điểm, ô hoặc dòng để xem chi tiết.')}</span>
              {nutXuat}
              <button type="button" onClick={() => setBig(false)} className="min-h-11 rounded-lg border border-field bg-surface px-4 text-sm font-semibold hover:bg-fill">Đóng</button>
            </>
          }
        >
          {(legend || action) && <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-body">{legend}{action}</div>}
          <ChartCtx.Provider value={{ big: true, picked, onPick: setPicked }}>{children}</ChartCtx.Provider>
          {picked && detail && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">Chi tiết: {picked.label}</h3>
                <button type="button" onClick={() => setPicked(null)} className="text-xs font-semibold text-brand-text hover:underline">Bỏ chọn</button>
              </div>
              {detail(picked)}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {i.dashed ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </>
  );
}

export function Empty({ children = 'Chưa có số liệu trong kỳ này.' }: { children?: ReactNode }) {
  return <p className="flex min-h-32 items-center justify-center rounded-xl bg-fill/60 px-4 text-center text-sm text-muted">{children}</p>;
}

export function Kpi({ label, value, note, delta, tone = 'ink' }: { label: string; value: string; note?: string; delta?: number | null; tone?: 'ink' | 'red' | 'green' | 'blue' }) {
  const color = tone === 'red' ? 'text-brand-text' : tone === 'green' ? 'text-green-ink' : tone === 'blue' ? 'text-blue-ink' : 'text-ink';
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {delta != null && Number.isFinite(delta) && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold ${delta >= 0 ? 'bg-green-soft text-green-ink' : 'bg-brand-soft text-brand-text'}`}>
            {delta >= 0 ? '+' : ''}{phanTram(delta, 0)}
          </span>
        )}
      </div>
      <strong className={`mt-2 block truncate text-2xl font-bold tracking-tight ${color}`} title={value}>{value}</strong>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </article>
  );
}

// ---------------------------------------------------------------- Biểu đồ theo mốc (đường, miền, cột)

export type Series = { name: string; color: string; values: (number | null)[]; dashed?: boolean; area?: boolean };
type Kind = 'line' | 'stack-area' | 'percent' | 'bar' | 'stack-bar';

export function TimeChart({
  labels,
  series,
  kind = 'line',
  format = so,
  overlay,
  overlayFormat = so,
  height = 260,
  minPer = 36,
  highlightLast = false,
}: {
  labels: string[];
  series: Series[];
  kind?: Kind;
  format?: (n: number) => string;
  /** Đường vẽ trên trục phải (ví dụ số hành khách trên cột đơn chốt). */
  overlay?: Series;
  overlayFormat?: (n: number) => string;
  height?: number;
  minPer?: number;
  highlightLast?: boolean;
}) {
  const [ref, box] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { big, picked, onPick } = useChart();
  const n = labels.length;
  const W = Math.max(box, n * (big ? Math.round(minPer * 1.3) : minPer), 280);
  const H = big ? Math.round(height * 1.6) : height;
  const L = 52;
  const R = overlay ? 52 : 14;
  const T = 14;
  const B = 30;
  const pw = W - L - R;
  const ph = H - T - B;
  const band = n ? pw / n : pw;
  const cx = (i: number) => L + band * (i + 0.5);

  const val = (s: Series, i: number) => s.values[i] ?? 0;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + val(s, i), 0));
  const stacked = kind === 'stack-area' || kind === 'stack-bar' || kind === 'percent';
  const max = kind === 'percent' ? 1 : niceMax(stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const y = (v: number) => T + ph - (v / max) * ph;
  const oMax = overlay ? niceMax(Math.max(0, ...overlay.values.map((v) => v ?? 0))) : 1;
  const oy = (v: number) => T + ph - (v / oMax) * ph;
  const ticks = [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  const every = Math.max(1, Math.ceil(54 / band));

  // Giá trị cộng dồn cho dạng chồng.
  const base = series.map((_, si) => labels.map((__, i) => {
    let acc = 0;
    for (let k = 0; k < si; k++) acc += val(series[k], i);
    return kind === 'percent' ? (totals[i] ? acc / totals[i] : 0) : acc;
  }));
  const top = series.map((s, si) => labels.map((_, i) => base[si][i] + (kind === 'percent' ? (totals[i] ? val(s, i) / totals[i] : 0) : val(s, i))));

  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((x - L) / band);
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div ref={ref} className="relative w-full overflow-x-auto pb-1 [scrollbar-width:thin]">
      {box > 0 && (
        <div className="relative" style={{ width: W }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ')} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={() => { if (hover != null && onPick) onPick({ index: hover, label: labels[hover] }); }} className={`block select-none ${onPick ? 'cursor-pointer' : ''}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-line-soft" strokeWidth={1} />
                <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[10px]">{kind === 'percent' ? phanTram(t, 0) : format(t)}</text>
              </g>
            ))}
            {overlay && [0, 1, 2, 3, 4].map((k) => (
              <text key={k} x={W - R + 8} y={oy((oMax * k) / 4) + 4} className="fill-muted text-[10px]">{overlayFormat((oMax * k) / 4)}</text>
            ))}
            {picked && picked.index < n && <rect x={L + band * picked.index} y={T} width={band} height={ph} className="fill-brand-soft" />}
            {hover != null && <rect x={L + band * hover} y={T} width={band} height={ph} className="fill-fill" opacity={0.7} />}

            {(kind === 'bar' || kind === 'stack-bar') && series.map((s, si) => labels.map((_, i) => {
              const v = val(s, i);
              if (!v) return null;
              const inner = Math.min(band * 0.7, 44);
              const bw = kind === 'bar' ? inner / series.length : inner;
              const x = cx(i) - inner / 2 + (kind === 'bar' ? si * bw : 0);
              const y1 = kind === 'bar' ? y(v) : y(top[si][i]);
              const y0 = kind === 'bar' ? y(0) : y(base[si][i]);
              const last = highlightLast && i === n - 1;
              return <rect key={`${si}-${i}`} x={x + 0.5} y={y1} width={Math.max(1, bw - 1)} height={Math.max(0, y0 - y1)} rx={kind === 'bar' ? 3 : 0} fill={s.color} opacity={hover == null || hover === i ? (last || !highlightLast ? 1 : 0.8) : 0.55} />;
            }))}

            {(kind === 'stack-area' || kind === 'percent') && series.map((s, si) => {
              const up = labels.map((_, i) => [cx(i), y(top[si][i])] as [number, number]);
              const down = labels.map((_, i) => [cx(i), y(base[si][i])] as [number, number]).reverse();
              return (
                <g key={s.name}>
                  <path d={`${path(up)}L${down.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`} fill={s.color} opacity={0.75} />
                  <path d={path(up)} fill="none" stroke={s.color} strokeWidth={1.5} />
                </g>
              );
            })}

            {kind === 'line' && series.map((s, si) => {
              const pts = labels.map((_, i) => (s.values[i] == null ? null : ([cx(i), y(s.values[i]!)] as [number, number])));
              const segs: [number, number][][] = [];
              let cur: [number, number][] = [];
              for (const p of pts) {
                if (p) cur.push(p);
                else if (cur.length) { segs.push(cur); cur = []; }
              }
              if (cur.length) segs.push(cur);
              const id = `g${si}-${s.name.replace(/\W/g, '')}`;
              return (
                <g key={s.name}>
                  {s.area && (
                    <>
                      <defs>
                        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      {segs.map((sg, k) => <path key={k} d={`${path(sg)}L${sg.at(-1)![0]},${y(0)}L${sg[0][0]},${y(0)}Z`} fill={`url(#${id})`} />)}
                    </>
                  )}
                  {segs.map((sg, k) => <path key={k} d={path(sg)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.6 : 2.2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
                  {hover != null && pts[hover] && <circle cx={pts[hover]![0]} cy={pts[hover]![1]} r={4} fill="var(--color-surface)" stroke={s.color} strokeWidth={2} />}
                  {n <= 14 && !s.dashed && pts.map((p, i) => p && hover !== i && <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={s.color} />)}
                </g>
              );
            })}

            {overlay && (() => {
              const pts = labels.map((_, i) => [cx(i), oy(overlay.values[i] ?? 0)] as [number, number]);
              return (
                <g>
                  <path d={path(pts)} fill="none" stroke={overlay.color} strokeWidth={2} strokeLinejoin="round" />
                  {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 4.5 : 3} fill="var(--color-surface)" stroke={overlay.color} strokeWidth={2} />)}
                </g>
              );
            })()}

            {labels.map((lb, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every) ? (
              <text key={i} x={cx(i)} y={H - 10} textAnchor="middle" className={`text-[10px] ${highlightLast && i === n - 1 ? 'fill-brand-text font-semibold' : 'fill-muted'}`}>{lb}</text>
            ) : null)}
          </svg>
          {big && picked && picked.index < n && hover == null && (
            <div className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-brand/40 bg-surface px-3 py-2 text-xs text-ink shadow-lg" style={{ top: 4, left: Math.min(Math.max(cx(picked.index) + 12, 0), W - 200) }}>
              <div className="mb-1 font-semibold text-brand-text">{labels[picked.index]}</div>
              {series.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.values[picked.index] == null ? '—' : format(s.values[picked.index]!)}</span>
                </div>
              ))}
              {overlay && <div className="flex justify-between gap-4"><span>{overlay.name}</span><span className="font-semibold">{overlayFormat(overlay.values[picked.index] ?? 0)}</span></div>}
            </div>
          )}
          {hover != null && (
            <div className="pointer-events-none absolute z-10 min-w-36 rounded-lg bg-strong px-3 py-2 text-xs text-on-strong shadow-lg" style={{ top: 4, left: Math.min(Math.max(cx(hover) + 12, 0), W - 180) }}>
              <div className="mb-1 font-semibold">{labels[hover]}</div>
              {series.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.values[hover] == null ? '—' : kind === 'percent' ? `${format(s.values[hover]!)} (${phanTram(totals[hover] ? s.values[hover]! / totals[hover] : 0, 0)})` : format(s.values[hover]!)}</span>
                </div>
              ))}
              {stacked && kind !== 'percent' && series.length > 1 && <div className="mt-1 flex justify-between gap-4 border-t border-white/20 pt-1"><span>Tổng</span><span className="font-semibold">{format(totals[hover])}</span></div>}
              {overlay && (
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: overlay.color }} />{overlay.name}</span>
                  <span className="font-semibold tabular-nums">{overlayFormat(overlay.values[hover] ?? 0)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Cột ngang có xếp hạng

export function HBars({ rows, format = so, max }: { rows: { label: string; value: number; detail?: string; color?: string; sub?: { value: number; color: string; label: string } }[]; format?: (n: number) => string; max?: number }) {
  const { picked, onPick } = useChart();
  if (!rows.length) return <Empty />;
  const m = max ?? Math.max(1, ...rows.map((r) => Math.max(r.value, r.sub?.value ?? 0)));
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} onClick={onPick ? () => onPick({ index: i, label: r.label }) : undefined} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-1 py-0.5 sm:grid-cols-[minmax(140px,280px)_minmax(0,1fr)_auto] ${onPick ? 'cursor-pointer hover:bg-fill' : ''} ${picked?.index === i ? 'bg-brand-soft' : ''}`}>
          <span className="min-w-0 truncate text-sm font-medium text-ink" title={r.label}><span className="mr-1.5 text-muted tabular-nums">{i + 1}.</span>{r.label}</span>
          <span className="col-span-2 row-start-2 flex flex-col gap-1 sm:col-span-1 sm:row-start-auto">
            <span className="h-2.5 overflow-hidden rounded-full bg-fill"><span className="block h-full rounded-full" style={{ width: `${(r.value / m) * 100}%`, background: r.color ?? BANG_MAU[0], opacity: 1 - Math.min(i, 8) * 0.07 }} /></span>
            {r.sub && <span className="h-1.5 overflow-hidden rounded-full bg-fill" title={r.sub.label}><span className="block h-full rounded-full" style={{ width: `${(r.sub.value / m) * 100}%`, background: r.sub.color }} /></span>}
          </span>
          <span className="text-right text-sm font-semibold tabular-nums text-ink">{format(r.value)}{r.detail && <span className="ml-1 text-xs font-normal text-muted">{r.detail}</span>}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- Biểu đồ tròn (donut) kèm bảng

export function Donut({ items, center, centerLabel, format = so }: { items: { label: string; value: number; color: string; detail?: string }[]; center: string; centerLabel: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { big, picked, onPick } = useChart();
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total) return <Empty />;
  const pick = (i: number) => onPick?.({ index: i, label: items[i].label });
  const R = 70;
  const r = 48;
  let a0 = -Math.PI / 2;
  const arcs = items.map((it) => {
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${(90 + rad * Math.cos(a)).toFixed(2)},${(90 + rad * Math.sin(a)).toFixed(2)}`;
    const d = it.value === total
      ? `M90,${90 - R}A${R},${R} 0 1 1 89.99,${90 - R}L89.99,${90 - r}A${r},${r} 0 1 0 90,${90 - r}Z`
      : `M${p(a0, R)}A${R},${R} 0 ${large} 1 ${p(a1, R)}L${p(a1, r)}A${r},${r} 0 ${large} 0 ${p(a0, r)}Z`;
    a0 = a1;
    return d;
  });
  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
      <svg width={big ? 260 : 180} height={big ? 260 : 180} viewBox="0 0 180 180" role="img" aria-label={centerLabel} className="shrink-0">
        {arcs.map((d, i) => items[i].value > 0 && <path key={i} d={d} fill={items[i].color} stroke="var(--color-surface)" strokeWidth={2} opacity={(hover ?? picked?.index) == null || (hover ?? picked?.index) === i ? 1 : 0.4} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => pick(i)} className={onPick ? 'cursor-pointer' : ''} />)}
        <text x={90} y={88} textAnchor="middle" className="fill-ink text-[18px] font-bold">{hover == null ? center : format(items[hover].value)}</text>
        <text x={90} y={106} textAnchor="middle" className="fill-muted text-[10px]">{hover == null ? centerLabel : items[hover].label}</text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-3">
        {items.map((it, i) => (
          <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => pick(i)} className={`rounded-lg px-1 py-0.5 ${onPick ? 'cursor-pointer hover:bg-fill' : ''} ${picked?.index === i ? 'bg-brand-soft' : ''}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 font-medium text-ink"><span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: it.color }} /><span className="truncate">{it.label}</span></span>
              <span className="shrink-0 tabular-nums"><strong className="text-ink">{format(it.value)}</strong><span className="ml-1 text-xs text-muted">({phanTram(it.value / total)})</span></span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full" style={{ width: `${(it.value / total) * 100}%`, background: it.color }} /></div>
            {it.detail && <p className="mt-1 text-xs text-muted">{it.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Bản đồ nhiệt thứ × giờ

const THU = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
export function Heatmap({ cells }: { cells: number[][] }) {
  const { picked, onPick } = useChart();
  const max = Math.max(0, ...cells.flat());
  if (!max) return <Empty>Chưa có lượt khách cần nhân viên trong kỳ này.</Empty>;
  const muc = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const nen = ['bg-fill', 'bg-brand/15', 'bg-brand/35', 'bg-brand/65', 'bg-brand'];
  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
      <table className="w-full min-w-[760px] border-separate border-spacing-[3px] text-[10px]">
        <thead>
          <tr>
            <th className="w-16" />
            {Array.from({ length: 24 }, (_, h) => <th key={h} scope="col" className="font-medium text-muted">{h}h</th>)}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, d) => (
            <tr key={d}>
              <th scope="row" className={`whitespace-nowrap pr-2 text-left text-xs font-semibold ${d === 6 ? 'text-brand-text' : 'text-ink'}`}>{THU[d]}</th>
              {row.map((v, h) => (
                <td key={h} title={`${THU[d]}, ${h}h–${h + 1}h: ${v} lượt`} onClick={onPick ? () => onPick({ index: d * 24 + h, label: `${THU[d]}, ${h}h–${h + 1}h: ${v} lượt` }) : undefined} className={`h-7 rounded text-center tabular-nums ${nen[muc(v)]} ${muc(v) >= 3 ? 'font-semibold text-white' : 'text-body'} ${onPick ? 'cursor-pointer hover:ring-2 hover:ring-ink/40' : ''} ${picked?.index === d * 24 + h ? 'ring-2 ring-ink' : ''}`}>{v || ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted">Ít {nen.map((c) => <span key={c} className={`inline-block size-3 rounded-sm ${c}`} />)} Nhiều</div>
    </div>
  );
}

// ---------------------------------------------------------------- Phân tán / bong bóng

export function Scatter({ points, xLabel, yLabel, formatX = so, formatY = so, height = 320 }: { points: { label: string; x: number; y: number; r?: number; color?: string; detail?: string }[]; xLabel: string; yLabel: string; formatX?: (n: number) => string; formatY?: (n: number) => string; height?: number }) {
  const [ref, box] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { big, picked, onPick } = useChart();
  if (!points.length) return <Empty />;
  const W = Math.max(box, 520);
  const H = big ? Math.round(height * 1.5) : height;
  const L = 56;
  const R = 24;
  const T = 18;
  const B = 42;
  const xMax = niceMax(Math.max(...points.map((p) => p.x)));
  const yMax = niceMax(Math.max(...points.map((p) => p.y)));
  const rMax = Math.max(1, ...points.map((p) => p.r ?? 0));
  const sx = (v: number) => L + (v / xMax) * (W - L - R);
  const sy = (v: number) => T + (H - T - B) - (v / yMax) * (H - T - B);
  const rad = (p: (typeof points)[number]) => (p.r == null ? 7 : 6 + Math.sqrt(p.r / rMax) * 22);
  const order = points.map((_, i) => i).sort((a, b) => rad(points[b]) - rad(points[a]));
  return (
    <div ref={ref} className="relative w-full overflow-x-auto pb-1 [scrollbar-width:thin]">
      {box > 0 && (
        <div className="relative" style={{ width: W }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} theo ${xLabel}`} className="block">
            {[0, 1, 2, 3, 4].map((k) => (
              <g key={k}>
                <line x1={L} x2={W - R} y1={sy((yMax * k) / 4)} y2={sy((yMax * k) / 4)} className="stroke-line-soft" />
                <text x={L - 8} y={sy((yMax * k) / 4) + 4} textAnchor="end" className="fill-muted text-[10px]">{formatY((yMax * k) / 4)}</text>
                <line x1={sx((xMax * k) / 4)} x2={sx((xMax * k) / 4)} y1={T} y2={H - B} className="stroke-line-soft" />
                <text x={sx((xMax * k) / 4)} y={H - B + 16} textAnchor="middle" className="fill-muted text-[10px]">{formatX((xMax * k) / 4)}</text>
              </g>
            ))}
            <text x={W - R} y={H - 6} textAnchor="end" className="fill-body text-[11px] font-semibold">{xLabel} →</text>
            <text x={L} y={T - 4} className="fill-body text-[11px] font-semibold">↑ {yLabel}</text>
            {order.map((i) => {
              const p = points[i];
              const c = p.color ?? BANG_MAU[i % BANG_MAU.length];
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.({ index: i, label: p.label })} className={onPick ? 'cursor-pointer' : ''}>
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={rad(p)} fill={c} fillOpacity={hover === i || picked?.index === i ? 0.5 : 0.22} stroke={c} strokeWidth={picked?.index === i ? 3 : 1.5} />
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={c} />
                </g>
              );
            })}
            {points.length <= 12 && points.map((p, i) => <text key={i} x={sx(p.x)} y={sy(p.y) - rad(p) - 4} textAnchor="middle" className="pointer-events-none fill-ink text-[10px] font-semibold">{p.label.length > 22 ? `${p.label.slice(0, 21)}…` : p.label}</text>)}
          </svg>
          {hover != null && (
            <div className="pointer-events-none absolute z-10 max-w-64 rounded-lg bg-strong px-3 py-2 text-xs text-on-strong shadow-lg" style={{ top: Math.max(0, sy(points[hover].y) - 70), left: Math.min(sx(points[hover].x) + 14, W - 260) }}>
              <div className="font-semibold">{points[hover].label}</div>
              <div>{xLabel}: {formatX(points[hover].x)}</div>
              <div>{yLabel}: {formatY(points[hover].y)}</div>
              {points[hover].detail && <div>{points[hover].detail}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Phễu

export function Funnel({ steps }: { steps: { label: string; value: number; note?: string }[] }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <Empty />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : s.value;
        const last = i === steps.length - 1;
        return (
          <div key={s.label} className={`flex flex-col rounded-xl border p-4 ${last ? 'border-green-ink/30 bg-green-soft/50' : 'border-line bg-page'}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-muted">Bước {i + 1}</span>
              <span className={`rounded px-1.5 py-0.5 font-semibold ${last ? 'bg-green-soft text-green-ink' : 'bg-fill text-body'}`}>{phanTram(s.value / first)}</span>
            </div>
            <strong className="mt-1 text-sm text-ink">{s.label}</strong>
            <span className="mt-2 text-2xl font-bold tabular-nums text-ink">{so(s.value)}</span>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full" style={{ width: `${(s.value / first) * 100}%`, background: last ? MAU.green : MAU.red, opacity: last ? 1 : 1 - i * 0.18 }} /></div>
            <span className="mt-2 text-xs text-muted">{i ? <>Chuyển từ bước trước: <strong className="text-ink">{phanTram(prev ? s.value / prev : null)}</strong></> : (s.note ?? 'Điểm bắt đầu')}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Thác nước (giá tour → voucher → doanh thu)

export function Waterfall({ steps, format = tienGon }: { steps: { label: string; value: number; kind: 'total' | 'minus' }[]; format?: (n: number) => string }) {
  const [ref, box] = useWidth<HTMLDivElement>();
  const max = niceMax(Math.max(1, ...steps.map((s) => Math.abs(s.value))));
  if (!steps[0]?.value) return <Empty />;
  const W = Math.max(box, 420);
  const H = 240;
  const L = 56;
  const T = 20;
  const B = 34;
  const band = (W - L - 14) / steps.length;
  const y = (v: number) => T + (H - T - B) - (v / max) * (H - T - B);
  let run = 0;
  return (
    <div ref={ref} className="w-full overflow-x-auto pb-1">
      {box > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Giá tour trừ voucher ra doanh thu" className="block">
          {[0, 1, 2, 3, 4].map((k) => (
            <g key={k}>
              <line x1={L} x2={W - 14} y1={y((max * k) / 4)} y2={y((max * k) / 4)} className="stroke-line-soft" />
              <text x={L - 8} y={y((max * k) / 4) + 4} textAnchor="end" className="fill-muted text-[10px]">{format((max * k) / 4)}</text>
            </g>
          ))}
          {steps.map((s, i) => {
            const bw = Math.min(band * 0.55, 90);
            const x = L + band * i + (band - bw) / 2;
            let y0: number;
            let y1: number;
            if (s.kind === 'total') { y0 = y(0); y1 = y(s.value); run = s.value; }
            else { y1 = y(run); run -= s.value; y0 = y(run); }
            const c = s.kind === 'minus' ? MAU.amber : i === steps.length - 1 ? MAU.green : MAU.slate;
            return (
              <g key={s.label}>
                <rect x={x} y={y1} width={bw} height={Math.max(1, y0 - y1)} rx={4} fill={c} />
                <text x={x + bw / 2} y={y1 - 6} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{s.kind === 'minus' ? '−' : ''}{format(s.value)}</text>
                <text x={x + bw / 2} y={H - 12} textAnchor="middle" className="fill-body text-[11px]">{s.label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Giữ chỗ khi đang tải. */
export function ChartSkeleton() {
  const [ok, setOk] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOk(true), 150); return () => clearTimeout(t); }, []);
  return ok ? <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" /> : null;
}
