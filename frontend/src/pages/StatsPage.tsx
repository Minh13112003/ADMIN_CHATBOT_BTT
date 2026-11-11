import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import useSWR from 'swr';
import { Dialog } from '@/components/ui';
import { StatsCharts } from '@/components/stats/StatsCharts';
import { Metric, Panel, RankingBars, ReportIcon, exportCsv, initials, number, percent } from '@/components/stats/AnalyticsUI';
import { CustomerFunnel, CustomersReport, DepartmentPanel, OrdersPanel, SalesTable, TourTable } from '@/components/stats/ReportSections';
import { fetcher } from '@/lib/api';
import { thoiLuong, trieu, vnd } from '@/lib/labels';
import type { Department, Me, Stats } from '@/lib/types';
import TourInterestPage from './TourInterestPage';
import '@/components/stats/analytics.css';

type Period = 'today' | 'week' | 'month' | 'all';
type View = 'overview' | 'customers' | 'sales' | 'revenue' | 'digital';
const periods: { value: Period; label: string }[] = [{ value: 'today', label: 'Hôm nay' }, { value: 'week', label: '7 ngày gần đây' }, { value: 'month', label: 'Tháng này' }, { value: 'all', label: 'Từ trước đến nay' }];
const views: { id: View; label: string; icon: Parameters<typeof ReportIcon>[0]['type'] }[] = [{ id: 'overview', label: 'Tổng quan', icon: 'chart' }, { id: 'customers', label: 'Khách & Tour', icon: 'people' }, { id: 'sales', label: 'Hiệu suất sale', icon: 'ratio' }, { id: 'revenue', label: 'Doanh thu đã chốt', icon: 'money' }, { id: 'digital', label: 'Nhu cầu tour (Digital)', icon: 'search' }];

export default function StatsPage({ forcedView }: { forcedView?: View }) {
  const [params, setParams] = useSearchParams();
  const period = periods.some(p => p.value === params.get('period')) ? params.get('period') as Period : 'month';
  const departmentId = params.get('departmentId') ?? '';
  const view = forcedView ?? (views.some(v => v.id === params.get('view')) ? params.get('view') as View : 'overview');
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const owner = me?.role === 'ADMIN';
  const { data: departments } = useSWR<Department[]>(owner ? '/departments' : null, fetcher);
  const scope = owner ? departmentId : '';
  const query = new URLSearchParams({ period, ...(scope ? { departmentId: scope } : {}) }).toString();
  const { data: s, error, mutate, isValidating } = useSWR<Stats>(me ? `/stats?${query}` : null, fetcher, { refreshInterval: 300_000 });
  const [selectedSale, setSelectedSale] = useState<Stats['staff'][number] | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const departmentName = owner ? departments?.find(p => p.id === scope)?.name ?? (scope ? 'Phòng đang chọn' : 'Toàn công ty') : me?.department?.name ?? 'Phòng của bạn';
  const changeFilter = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setSelectedSale(null); setParams(next); };
  const tabUrl = (tab: View) => { const next = new URLSearchParams({ period, ...(scope ? { departmentId: scope } : {}) }); if (tab !== 'sales') next.set('view', tab); return `${tab === 'sales' ? '/performance' : '/stats'}?${next}`; };
  const exportReport = () => {
    if (!s) return;
    exportCsv(`bao-cao-${view}-${period}.csv`, [['Báo cáo', views.find(v => v.id === view)!.label], ['Phạm vi', departmentName], ['Kỳ', periods.find(p => p.value === period)!.label], ['Cập nhật', s.updatedAt], [], ...(view === 'sales'
      ? [['Nhân viên', 'Phòng ban', 'Lượt trả lời', 'Khách chốt', 'Đơn chốt', 'Doanh thu (VND)'], ...s.staff.filter(p => p.isSale).map(p => [p.name, p.departmentName ?? '', p.responses, p.closedCustomers ?? '', p.closed, p.revenue])]
      : [['Tour', 'Đơn xác nhận', 'Hành khách', 'Doanh thu (VND)'], ...s.tours.map(t => [t.name, t.orders, t.guests, t.revenue])])]);
  };
  const sales = s?.staff.filter(p => p.isSale) ?? [];
  const refresh = () => { void mutate(); setRefreshVersion(v => v + 1); };
  const departmentPanel = s && <DepartmentPanel s={s} owner={!!owner} scope={scope} name={departmentName} onSelect={id => changeFilter('departmentId', id)} />;
  return <div className="analytics-page">
    <header className="report-heading"><div><div className="report-eyebrow">BÁO CÁO KINH DOANH <span>/</span> {departmentName}</div><h1>{view === 'digital' ? 'Nhu cầu tour (Digital)' : view === 'sales' ? 'Hiệu suất đội ngũ tư vấn' : view === 'revenue' ? 'Doanh thu đã chốt' : view === 'customers' ? 'Khách hàng & Tour' : owner && !scope ? 'Tổng quan kinh doanh' : `Thống kê phòng ${departmentName}`}</h1><p>{view === 'digital' ? 'Tour khách quan tâm, tính theo tour sale ghim trên tin nhắn. Bấm "Xem thống kê" để xem chi tiết từng tour.' : view === 'sales' ? 'Theo dõi chất lượng phản hồi và kết quả chốt tour của từng nhân viên.' : 'Từ cuộc hội thoại đến đơn tour — mọi chỉ số trong cùng phạm vi quản lý.'}</p></div><div className="report-actions"><button className="report-button" onClick={refresh} disabled={isValidating}><ReportIcon type="refresh" />{isValidating ? 'Đang cập nhật' : 'Làm mới'}</button>{view !== 'digital' && <button className="report-button primary" onClick={exportReport} disabled={!s}><ReportIcon type="download" />Xuất báo cáo CSV</button>}</div></header>
    <nav className="report-tabs" aria-label="Báo cáo quản trị">{views.map(tab => <Link key={tab.id} to={tabUrl(tab.id)} aria-current={view === tab.id ? 'page' : undefined}><ReportIcon type={tab.icon} />{tab.label}</Link>)}</nav>
    {view === 'digital' ? <TourInterestPage embedded /> : <>
    <section className="report-filters" aria-label="Bộ lọc báo cáo"><div className="report-filter-fields"><label><span>Kỳ báo cáo</span><select value={period} onChange={e => changeFilter('period', e.target.value)}>{periods.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>{owner ? <label><span>Phòng ban</span><select aria-label="Lọc theo phòng ban" value={departmentId} onChange={e => changeFilter('departmentId', e.target.value)}><option value="">Tất cả phòng ban</option>{departments?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <div className="report-scope"><ReportIcon type="lock" /><span>Phạm vi cố định<strong>{departmentName}</strong></span></div>}</div><div className="report-filter-meta"><span className={`report-badge ${owner ? 'green' : 'blue'}`}><ReportIcon type="lock" />{owner ? 'Admin toàn quyền' : 'Admin phòng ban'}</span><small>{s ? `Cập nhật ${new Date(s.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Tự làm mới mỗi 5 phút` : 'Đang lấy số liệu'}</small></div></section>
    {error ? <div className="report-error" role="alert">Không tải được báo cáo. <button onClick={refresh}>Thử lại</button></div> : !s ? <div className="report-loading" role="status"><div /><div /><div /><span>Đang tải báo cáo…</span></div> : <>
      {view === 'overview' && <>
        <div className="report-kpis six"><Metric label="Khách nhắn tin" value={number(s.customers)} note={`${number(s.phones)} khách có số điện thoại`} icon="people" /><Metric label="Khách được phản hồi" value={s.conversion ? number(s.conversion.respondedCustomers) : '—'} note="Đã phản hồi yêu cầu gặp nhân viên" tone="blue" icon="message" /><Metric label="Khách chốt tour" value={s.conversion ? number(s.conversion.closedCustomers) : '—'} note="Trong nhóm khách nhắn tin của kỳ" tone="green" icon="check" /><Metric label="Tỷ lệ chốt khách" value={s.conversion ? percent(s.closeRate) : '—'} note="Khách chốt / khách nhắn tin" tone="purple" icon="ratio" /><Metric label="Đơn đã xác nhận" value={number(s.closed)} note={`${number(s.guests)} hành khách đi tour`} tone="amber" icon="check" /><Metric label="Doanh thu đã chốt" value={trieu(s.totalRevenue)} note="Loại trừ đơn chờ và đơn hủy" tone="red" icon="money" /></div>
        {s.pending.count > 0 && <div className="report-notice"><span className="notice-icon">!</span><div><strong>{number(s.pending.count)} đơn tour đang chờ xác nhận</strong><p>Tổng giá trị {vnd(s.pending.amount)} · Tất cả thời gian, chưa tính vào doanh thu đã chốt.</p></div><Link to={tabUrl('revenue')}>Xem báo cáo đơn →</Link></div>}
        <div className="report-grid overview-grid"><Panel title="Hành trình chuyển đổi" description="Cùng nhóm khách nhắn tin trong kỳ"><CustomerFunnel s={s} /><div className="report-panel-foot">Phản hồi yêu cầu tư vấn trung vị <strong>{thoiLuong(s.responseTime.medianSeconds)}</strong></div></Panel><StatsCharts key={`${query}:${refreshVersion}:overview`} period={period} departmentId={scope} showCost={false} compact /></div>
        <div className="report-grid">{departmentPanel}<Panel title="Tour đóng góp doanh thu cao nhất" description="Top 5 tour từ đơn đã xác nhận" action={<Link className="report-text-link" to={tabUrl('revenue')}>Xem tất cả →</Link>}><RankingBars rows={s.tours.slice(0, 5).map(t => ({ key: t.name, label: t.name, value: t.revenue, detail: `${number(t.orders)} đơn · ${number(t.guests)} hành khách` }))} format={trieu} /></Panel></div><TourTable s={s} />
      </>}
      {view === 'revenue' && <>
        <div className="report-kpis four"><Metric label="Doanh thu đã chốt" value={trieu(s.totalRevenue)} note="Tổng tiền đơn xác nhận còn hiệu lực" tone="red" icon="money" /><Metric label="Đơn đã xác nhận" value={number(s.closed)} note="Không bao gồm đơn chờ và đơn hủy" icon="check" /><Metric label="Tổng hành khách" value={number(s.guests)} note="Số người đi tour trên đơn đã chốt" tone="blue" icon="people" /><Metric label="Giá trị bình quân đơn" value={s.closed ? vnd(s.totalRevenue / s.closed) : '—'} note="Doanh thu / số đơn đã xác nhận" tone="green" icon="money" /></div>
        <div className="report-grid overview-grid"><StatsCharts key={`${query}:${refreshVersion}:revenue`} period={period} departmentId={scope} showCost={false} revenueOnly compact />{departmentPanel}</div><TourTable s={s} /><OrdersPanel key={`${query}:${refreshVersion}`} query={query} />
      </>}
      {view === 'customers' && <CustomersReport s={s} query={query} refreshVersion={refreshVersion} />}
      {view === 'sales' && <>
        <div className="report-kpis four"><Metric label="Phản hồi trung vị" value={thoiLuong(s.responseTime.medianSeconds)} note={`${number(s.responseTime.count)} lượt yêu cầu được phản hồi`} icon="message" tone="blue" /><Metric label="Phản hồi trong 5 phút" value={percent(s.responseTime.within5MinRate)} note="Tính trên các lượt yêu cầu đã phản hồi" icon="ratio" tone="green" /><Metric label="Đội ngũ tư vấn" value={number(sales.length)} note={`${sales.filter(p => p.onDuty).length} nhân viên đang trực`} icon="people" /><Metric label="Doanh thu của sale" value={trieu(sales.reduce((v, p) => v + p.revenue, 0))} note={`${number(sales.reduce((v, p) => v + p.closed, 0))} đơn do sale xác nhận`} tone="red" icon="money" /></div>
        <div className="report-grid"><Panel title="Doanh thu chốt theo nhân sự" description="Nhấp tên để xem chi tiết tư vấn viên"><RankingBars rows={sales.slice(0, 6).map(p => ({ key: p.id ?? p.name, label: p.name, value: p.revenue, onClick: () => setSelectedSale(p) }))} format={trieu} /></Panel><Panel title="Chất lượng phản hồi khách hàng" description="Tỷ lệ phản hồi yêu cầu tư vấn trong 5 phút"><RankingBars rows={sales.filter(p => p.within5MinRate !== null).slice(0, 6).map(p => ({ key: p.id ?? p.name, label: p.name, value: p.within5MinRate! * 100, detail: `${number(p.responses)} lượt trả lời · Trung vị ${thoiLuong(p.medianSeconds)}`, onClick: () => setSelectedSale(p) }))} format={n => percent(n / 100)} color="var(--color-on)" /></Panel></div><SalesTable sales={sales} onSelect={setSelectedSale} />
      </>}
      <footer className="report-footer"><span><span className="report-dot" />Dữ liệu trong phạm vi {departmentName.toLocaleLowerCase('vi')}</span><span>Doanh thu từ đơn đã xác nhận · Không phải tiền thực thu</span></footer>
    </>}
    </>}
    {selectedSale && <Dialog title="Chi tiết hiệu suất tư vấn viên" onClose={() => setSelectedSale(null)} variant="drawer"><div className="analytics-page report-sale-detail"><div className="sale-profile"><span className="report-avatar large">{initials(selectedSale.name)}</span><div><h2>{selectedSale.name}</h2><p>{selectedSale.departmentName ?? departmentName}</p><span className={`report-badge ${selectedSale.onDuty ? 'green' : ''}`}>{selectedSale.onDuty ? 'Đang trực' : 'Đang nghỉ'}</span></div></div><div className="report-detail-kpis">{[['Khách chốt', selectedSale.closedCustomers == null ? '—' : number(selectedSale.closedCustomers)], ['Đơn xác nhận', number(selectedSale.closed)], ['Hành khách', selectedSale.guests == null ? '—' : number(selectedSale.guests)], ['Lượt trả lời', number(selectedSale.responses)], ['Trung vị phản hồi', thoiLuong(selectedSale.medianSeconds)], ['Trong 5 phút', percent(selectedSale.within5MinRate)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="report-sale-revenue"><span>Doanh thu đã chốt</span><strong>{vnd(selectedSale.revenue)}</strong></div>{selectedSale.id && <OrdersPanel key={`${query}:${selectedSale.id}`} query={`${query}&staffId=${encodeURIComponent(selectedSale.id)}`} compact />}</div></Dialog>}
  </div>;
}
