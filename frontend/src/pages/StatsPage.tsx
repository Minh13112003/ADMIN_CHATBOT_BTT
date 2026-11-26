import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import useSWR from 'swr';
import { Dialog } from '@/components/ui';
import { ChartCard, ChartSkeleton, phanTram, so, tienGon } from '@/components/stats/BoardCharts';
import { exportCsv, initials } from '@/components/stats/AnalyticsUI';
import { OrdersTable } from '@/components/stats/StatsDetails';
import { ChannelsTab, CustomersTab, RevenueTab, SalesTab, ToursTab } from '@/components/stats/StatsTabs';
import { fetcher } from '@/lib/api';
import { CHANNEL, thoiGianTruoc, thoiLuong, vnd } from '@/lib/labels';
import type { Channel, Department, Me, StatsBoard, StatsBoardRange } from '@/lib/types';
import TourInterestPage from './TourInterestPage';
import '@/components/stats/analytics.css';

type View = 'customers' | 'tours' | 'sales' | 'revenue' | 'channels' | 'digital';
export const STATS_TABS: { id: View; label: string }[] = [
  { id: 'customers', label: 'Khách & Quan tâm' },
  { id: 'tours', label: 'Tour' },
  { id: 'sales', label: 'Hiệu suất sale' },
  { id: 'revenue', label: 'Doanh thu đã chốt' },
  { id: 'channels', label: 'Kênh & Chi phí AI' },
  { id: 'digital', label: 'Nhu cầu tour' },
];
const RANGES: { key: StatsBoardRange; label: string }[] = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'quarter', label: 'Quý (theo tuần)' },
];
/** Đường dẫn cũ (?view=overview, ?view=customers...) vẫn mở được. */
const VIEW_CU: Record<string, View> = { overview: 'customers' };

type ChannelStatus = { channel: Channel; lastCustomerMessageAt: string | null; conversationsToday: number; medianSeconds: number | null; connected: boolean };

/**
 * Thống kê (thiết kế Stitch duyệt 2026-11-17): 5 mảng, mỗi biểu đồ một thẻ cả hàng.
 * Kỳ 7 ngày / 30 ngày theo ngày, quý theo tuần. Số lấy từ GET /stats/board, làm mới 5 phút.
 */
export default function StatsPage({ forcedView }: { forcedView?: View } = {}) {
  const [params, setParams] = useSearchParams();
  const rawView = forcedView ?? params.get('view') ?? 'customers';
  const view: View = VIEW_CU[rawView] ?? (STATS_TABS.some((t) => t.id === rawView) ? (rawView as View) : 'customers');
  const range: StatsBoardRange = RANGES.some((r) => r.key === params.get('range')) ? (params.get('range') as StatsBoardRange) : '30d';
  const departmentId = params.get('departmentId') ?? '';
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const owner = me?.role === 'ADMIN';
  const { data: departments } = useSWR<Department[]>(owner ? '/departments' : null, fetcher);
  const scope = owner ? departmentId : '';
  const query = new URLSearchParams({ range, ...(scope ? { departmentId: scope } : {}) }).toString();
  const { data: b, error, mutate, isValidating } = useSWR<StatsBoard>(me && view !== 'digital' ? `/stats/board?${query}` : null, fetcher, { refreshInterval: 300_000, keepPreviousData: true });
  const { data: kenh } = useSWR<ChannelStatus[]>(owner && view === 'channels' ? '/stats/channels' : null, fetcher, { refreshInterval: 300_000 });
  const [saleId, setSaleId] = useState<string | null>(null);
  const sale = useMemo(() => b?.sales.rows.find((r) => r.id === saleId) ?? null, [b, saleId]);
  const departmentName = owner ? (departments?.find((p) => p.id === scope)?.name ?? (scope ? 'Phòng đang chọn' : 'Toàn công ty')) : (me?.department?.name ?? 'Phòng của bạn');

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const tabUrl = (id: View) => {
    const next = new URLSearchParams(params);
    next.set('view', id);
    return `/stats?${next}`;
  };

  const exportReport = () => {
    if (!b) return;
    const head = [['Báo cáo', STATS_TABS.find((t) => t.id === view)!.label], ['Phạm vi', departmentName], ['Kỳ', RANGES.find((r) => r.key === range)!.label], ['Cập nhật', new Date(b.updatedAt).toLocaleString('vi-VN')], []];
    const body: (string | number)[][] =
      view === 'sales' ? [['Nhân viên', 'Mã NV', 'Phòng ban', 'Hội thoại xử lý', 'Phản hồi trung vị (giây)', 'Trong 5 phút', 'Đơn chốt', 'Doanh thu (VND)'], ...b.sales.rows.map((r) => [r.name, r.employeeCode ?? '', r.departmentName ?? '', r.conversations, r.medianSeconds ?? '', r.within5MinRate == null ? '' : phanTram(r.within5MinRate), r.deals, r.revenue])]
      : view === 'tours' ? [['Tour', 'Địa điểm', 'Khách quan tâm', 'Đơn chốt', 'Hành khách', 'Doanh thu (VND)'], ...b.tours.rows.map((r) => [r.name, r.place ?? '', r.interested, r.orders, r.guests, r.revenue])]
      : view === 'customers' ? [['Mốc', ...(['ZALO', 'WEB', 'APP', 'FACEBOOK'] as Channel[]).map((k) => CHANNEL[k].label), 'Khách mới', 'Khách quay lại'], ...b.buckets.map((x, i) => [x.label, b.customers.byChannelSeries.ZALO[i], b.customers.byChannelSeries.WEB[i], b.customers.byChannelSeries.APP[i], b.customers.byChannelSeries.FACEBOOK[i], b.customers.newSeries[i], b.customers.returningSeries[i]])]
      : view === 'channels' ? [['Mốc', 'Hội thoại bot', 'Hội thoại có nhân viên', 'Chi phí Gemini (VND)', 'Token'], ...b.buckets.map((x, i) => [x.label, b.channels.botSeries[i], b.channels.staffSeries[i], Math.round(b.channels.costSeries[i]), b.channels.tokenSeries[i]])]
      : [['Mốc', 'Doanh thu (VND)', 'Kỳ trước (VND)', 'Đơn', 'Hành khách'], ...b.buckets.map((x, i) => [x.label, b.revenue.series[i], b.revenue.prevSeries[i], b.revenue.dealSeries[i], b.revenue.guestSeries[i]])];
    exportCsv(`thong-ke-${view}-${range}.csv`, [...head, ...body]);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Thống kê</h1>
            <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-semibold text-body">{departmentName}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {view === 'digital' ? 'Tour khách quan tâm, tính theo tour sale ghim trên tin nhắn.' : b ? `Cập nhật ${new Date(b.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · tự làm mới mỗi 5 phút` : 'Đang lấy số liệu…'}
          </p>
        </div>
        {view !== 'digital' && (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Kỳ thống kê" className="flex gap-1 rounded-xl bg-fill p-1">
              {RANGES.map((r) => (
                <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => set('range', r.key)} className={`min-h-9 whitespace-nowrap rounded-[9px] px-3 text-xs font-semibold sm:text-sm ${range === r.key ? 'bg-surface text-brand-text shadow-sm' : 'text-body'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {owner && (
              <select aria-label="Lọc theo phòng ban" value={departmentId} onChange={(e) => set('departmentId', e.target.value)} className="h-11 max-w-56 rounded-xl border border-line bg-surface px-3 text-sm font-medium">
                <option value="">Tất cả phòng ban</option>
                {departments?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => void mutate()} disabled={isValidating} aria-label="Làm mới số liệu" className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-body hover:bg-fill disabled:opacity-50">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={isValidating ? 'animate-spin' : ''}><path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5" /></svg>
            </button>
            <button type="button" onClick={exportReport} disabled={!b} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-button px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
              Xuất file Excel (.csv)
            </button>
          </div>
        )}
      </header>

      <nav aria-label="Mảng thống kê" className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-1">
        {STATS_TABS.map((t) => (
          <Link key={t.id} to={tabUrl(t.id)} aria-current={view === t.id ? 'page' : undefined} className="whitespace-nowrap border-b-2 border-transparent pb-3 text-sm font-semibold text-muted hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-brand-text">
            {t.label}
          </Link>
        ))}
      </nav>

      {view === 'digital' ? (
        <TourInterestPage embedded />
      ) : error && !b ? (
        <div role="alert" className="rounded-2xl border border-alert-line bg-brand-faint p-4 text-sm text-alert-ink">
          Không tải được số liệu thống kê. <button type="button" className="font-semibold underline" onClick={() => void mutate()}>Thử lại</button>
        </div>
      ) : !b ? (
        <div role="status" aria-label="Đang tải" className="flex flex-col gap-4"><ChartSkeleton /><ChartSkeleton /></div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${isValidating ? 'opacity-70' : ''}`}>
          {view === 'customers' && <CustomersTab b={b} base={query} />}
          {view === 'tours' && <ToursTab b={b} base={query} />}
          {view === 'sales' && <SalesTab b={b} base={query} onSelect={setSaleId} />}
          {view === 'revenue' && <RevenueTab b={b} base={query} />}
          {view === 'channels' && <ChannelsTab b={b} base={query} status={owner && kenh ? <ChannelStatusCard rows={kenh} /> : null} />}
        </div>
      )}

      {sale && (
        <Dialog title="Chi tiết tư vấn viên" onClose={() => setSaleId(null)} variant="drawer" drawerWidth={760}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-text">{initials(sale.name)}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{sale.name}</h2>
                <p className="text-xs text-muted">{[sale.employeeCode, sale.position, sale.departmentName].filter(Boolean).join(' · ') || departmentName}</p>
              </div>
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${sale.onDuty ? 'bg-green-soft text-green-ink' : 'bg-fill text-body'}`}>{sale.onDuty ? 'Đang trực' : 'Đang nghỉ'}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ['Hội thoại xử lý', so(sale.conversations)],
                ['Đơn chốt', so(sale.deals)],
                ['Hành khách', so(sale.guests)],
                ['Phản hồi trung vị', thoiLuong(sale.medianSeconds)],
                ['Trong 5 phút', phanTram(sale.within5MinRate)],
                ['Tỷ lệ chốt', phanTram(sale.closeRate)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-fill p-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>
              ))}
            </dl>
            <div className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><span className="text-muted">Doanh thu đã chốt</span><strong className="text-brand-text">{vnd(sale.revenue)} ({tienGon(sale.revenue)})</strong></div>
            <div><h3 className="mb-2 text-sm font-bold">Đơn sale này đã chốt trong kỳ</h3><OrdersTable key={`${query}:${sale.id}`} base={query} embedded fixed={{ staffId: sale.id, status: 'CONFIRMED' }} /></div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ChannelStatusCard({ rows }: { rows: ChannelStatus[] }) {
  const show = rows.filter((r) => r.connected || r.lastCustomerMessageAt);
  return (
    <ChartCard title="Tình trạng kênh kết nối" description="Kênh đang nhận tin của khách, số khách nhắn hôm nay (từ 00:00 giờ Việt Nam)">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {show.map((r) => (
          <div key={r.channel} className="rounded-xl border border-line bg-page p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong>{CHANNEL[r.channel].label}</strong>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.connected ? 'bg-green-soft text-green-ink' : 'bg-fill text-body'}`}>{r.connected ? 'Đã kết nối' : 'Chưa kết nối'}</span>
            </div>
            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between gap-2"><dt className="text-muted">Khách nhắn hôm nay</dt><dd className="font-semibold">{so(r.conversationsToday)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Tin gần nhất</dt><dd className="font-semibold">{r.lastCustomerMessageAt ? thoiGianTruoc(r.lastCustomerMessageAt) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Phản hồi trung vị hôm nay</dt><dd className="font-semibold">{thoiLuong(r.medianSeconds)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
