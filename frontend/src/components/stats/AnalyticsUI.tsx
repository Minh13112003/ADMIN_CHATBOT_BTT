import type { ReactNode } from 'react';
export const number = (n: number) => n.toLocaleString('vi-VN');
export const percent = (n: number | null | undefined) => n == null ? '—' : `${(n * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
export const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
export function ReportIcon({ type = 'chart' }: { type?: 'chart' | 'people' | 'message' | 'check' | 'money' | 'ratio' | 'download' | 'refresh' | 'lock' | 'search' }) {
  const paths = {
    chart: <path d="M4 19V10m8 9V4m8 15v-7M2 21h20" />,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" /></>,
    message: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM7 8h10M7 12h6" />,
    check: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></>,
    money: <><rect x="2" y="5" width="20" height="14" rx="3" /><circle cx="12" cy="12" r="3" /><path d="M5 9v6m14-6v6" /></>,
    ratio: <><path d="m5 19 14-14" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    refresh: <path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}
export function Metric({ label, value, note, tone = 'slate', icon = 'chart' }: { label: string; value: string; note: string; tone?: string; icon?: Parameters<typeof ReportIcon>[0]['type'] }) {
  return <article className={`report-metric tone-${tone}`}><div className="report-metric-label"><span>{label}</span><span className="metric-symbol"><ReportIcon type={icon} /></span></div><strong title={value}>{value}</strong><p>{note}</p></article>;
}
export function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`report-panel ${className}`}><header className="report-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header><div className="report-panel-body">{children}</div></section>;
}
export function Empty({ children = 'Chưa có dữ liệu trong kỳ này.' }: { children?: ReactNode }) {
  return <div className="report-empty"><ReportIcon /><p>{children}</p></div>;
}
export function RankingBars({ rows, format, color = 'var(--color-brand-button)' }: { rows: { key: string; label: string; value: number; detail?: string; onClick?: () => void }[]; format: (value: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return rows.length ? <div className="report-ranking">{rows.map((r, i) => <div className="report-ranking-row" key={r.key}><div><span>{String(i + 1).padStart(2, '0')}</span>{r.onClick ? <button onClick={r.onClick}>{r.label}</button> : <b>{r.label}</b>}<strong>{format(r.value)}</strong></div><div className="report-track"><span style={{ width: `${r.value / max * 100}%`, background: color, opacity: 1 - Math.min(i * .12, .45) }} /></div>{r.detail && <small>{r.detail}</small>}</div>)}</div> : <Empty />;
}
export function exportCsv(name: string, rows: (string | number)[][]) {
  const csv = '\uFEFF' + rows.map(row => row.map(value => { const text = String(value); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"'; }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
