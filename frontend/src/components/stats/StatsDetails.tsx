import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router';
import useSWR from 'swr';
import { Pager, PAGE_SIZE } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { CHANNEL, STATUS, dinhDangSo, vnd } from '@/lib/labels';
import type { Channel, Status } from '@/lib/types';
import { exportCsv } from './AnalyticsUI';
import { phanTram, so } from './BoardCharts';

/** Bảng đơn và danh sách chi tiết của trang Thống kê. Mỗi bảng 10 dòng một trang. */

type Order = { id: string; orderCode: string | null; tourName: string; tourCode: string | null; guests: number; amount: number; status: string; voidedAt: string | null; closedAt: string; createdAt: string; channel: Channel; conversationId: string; customer: { name: string; phone: string | null }; closedBy: { fullName: string } | null; departmentName: string };
type OrderPage = { items: Order[]; total: number; page: number; pageSize: number; sumAmount: number; sumGuests: number; allAmount: number };
type DealStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED';

const KENH_LOC: { key: '' | Channel; label: string }[] = [
  { key: '', label: 'Tất cả nền tảng' },
  { key: 'WEB', label: 'Web' },
  { key: 'APP', label: 'App Mobile' },
  { key: 'ZALO', label: 'Zalo' },
  { key: 'FACEBOOK', label: 'Facebook' },
];
const TRANG_THAI: { key: DealStatus; label: string; cls: string }[] = [
  { key: 'CONFIRMED', label: 'Đã xác nhận', cls: 'bg-green-soft text-green-ink' },
  { key: 'PENDING', label: 'Chờ xác nhận', cls: 'bg-amber-soft text-amber-ink' },
  { key: 'CANCELLED', label: 'Đã huỷ', cls: 'bg-brand-soft text-brand-text' },
];
/** Mã đơn dài (id) chỉ hiện 10 ký tự đầu, rê chuột xem đủ. */
const maNgan = (ma: string) => (ma.length > 10 ? `${ma.slice(0, 10)}…` : ma);
const chonClass = 'h-10 rounded-lg border border-line bg-surface px-3 text-sm font-medium';

/**
 * Bảng đơn đặt tour. `base` là query của trang (range, departmentId). `fixed` là bộ lọc cố định khi mở từ biểu đồ
 * (khoảng ngày của một mốc, một kênh, một sale, một tour).
 */
export function OrdersTable({ base, fixed = {}, title = 'Chi tiết đơn đặt tour', embedded = false }: { base: string; fixed?: { from?: string; to?: string; channel?: Channel; staffId?: string; search?: string; status?: DealStatus }; title?: string; embedded?: boolean }) {
  const [status, setStatus] = useState<DealStatus>(fixed.status ?? 'CONFIRMED');
  const [kenh, setKenh] = useState<'' | Channel>(fixed.channel ?? '');
  const [tim, setTim] = useState(fixed.search ?? '');
  const [page, setPage] = useState(1);
  const timTre = useDeferredValue(tim);
  useEffect(() => setPage(1), [status, kenh, timTre, base, fixed.from, fixed.to, fixed.staffId]);
  const q = new URLSearchParams(base);
  q.set('status', status);
  q.set('page', String(page));
  if (kenh) q.set('channel', kenh);
  if (timTre.trim()) q.set('search', timTre.trim());
  if (fixed.from) q.set('from', fixed.from);
  if (fixed.to) q.set('to', fixed.to);
  if (fixed.staffId) q.set('staffId', fixed.staffId);
  const { data, error, isLoading } = useSWR<OrderPage>(`/stats/orders?${q}`, fetcher, { keepPreviousData: true });
  const tt = TRANG_THAI.find((t) => t.key === status)!;

  const xuat = async () => {
    // Xuất mọi trang của bộ lọc hiện tại (không chỉ trang đang xem).
    const rows: (string | number)[][] = [['Mã đơn', 'Ngày', 'Khách hàng', 'SĐT', 'Nền tảng', 'Tour', 'Mã tour', 'Sale', 'Phòng', 'Số người', 'Tổng tiền (VND)', 'Trạng thái']];
    const tong = data?.total ?? 0;
    for (let p = 1; p <= Math.ceil(tong / PAGE_SIZE) && p <= 200; p++) {
      q.set('page', String(p));
      const r = await fetcher<OrderPage>(`/stats/orders?${q}`);
      for (const d of r.items) rows.push([d.orderCode ?? d.id, new Date(status === 'CONFIRMED' ? d.closedAt : d.createdAt).toLocaleDateString('vi-VN'), d.customer.name, d.customer.phone ?? '', CHANNEL[d.channel].label, d.tourName, d.tourCode ?? '', d.closedBy?.fullName ?? '', d.departmentName, d.guests, d.amount, tt.label]);
    }
    rows.push([], ['Tổng', '', '', '', '', '', '', '', '', data?.sumGuests ?? 0, data?.sumAmount ?? 0]);
    exportCsv(`don-dat-tour-${status.toLowerCase()}.csv`, rows);
  };

  const body = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!fixed.status && (
          <div role="group" aria-label="Trạng thái đơn" className="flex gap-1 rounded-xl bg-fill p-1">
            {TRANG_THAI.map((t) => (
              <button key={t.key} type="button" aria-pressed={status === t.key} onClick={() => setStatus(t.key)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${status === t.key ? 'bg-surface text-ink shadow-sm' : 'text-body'}`}>{t.label}</button>
            ))}
          </div>
        )}
        {!fixed.channel && (
          <select aria-label="Lọc theo nền tảng" value={kenh} onChange={(e) => setKenh(e.target.value as '' | Channel)} className={chonClass}>
            {KENH_LOC.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        )}
        <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mã đơn, khách, SĐT, tour…" aria-label="Tìm đơn" className={`${chonClass} min-w-0 flex-1 sm:max-w-80`} />
        <button type="button" onClick={() => void xuat()} disabled={!data?.total} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-body hover:bg-fill disabled:opacity-50">Xuất file Excel (.csv)</button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-brand-faint p-3 text-sm text-alert-ink">Không tải được danh sách đơn.</p>
      ) : !data && isLoading ? (
        <p role="status" className="p-4 text-sm text-muted">Đang tải đơn…</p>
      ) : !data?.items.length ? (
        <p className="rounded-xl bg-fill/60 p-6 text-center text-sm text-muted">Không có đơn phù hợp.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line bg-fill/60 text-left text-xs text-muted">
                <th className="px-3 py-2.5 font-medium">Mã đơn / Ngày</th>
                <th className="px-3 py-2.5 font-medium">Khách hàng</th>
                <th className="px-3 py-2.5 font-medium">Tour</th>
                <th className="px-3 py-2.5 font-medium">Nền tảng</th>
                <th className="px-3 py-2.5 font-medium">Sale / Phòng</th>
                <th className="px-3 py-2.5 text-right font-medium">Số người</th>
                <th className="px-3 py-2.5 text-right font-medium">Tổng tiền</th>
                <th className="px-3 py-2.5 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => {
                const ma = d.orderCode ?? d.id;
                return (
                  <tr key={d.id} className="border-b border-line-soft align-top hover:bg-fill/50">
                    <td className="px-3 py-3">
                      <Link to={`/inbox?c=${encodeURIComponent(d.conversationId)}`} title={`${ma} — mở hội thoại`} className="font-semibold text-blue-ink hover:underline">{maNgan(ma)} ↗</Link>
                      <div className="text-xs text-muted">{new Date(status === 'CONFIRMED' ? d.closedAt : d.createdAt).toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className="px-3 py-3"><div className="font-semibold">{d.customer.name}</div><div className="text-xs text-muted">{d.customer.phone ? dinhDangSo(d.customer.phone) : 'Chưa có SĐT'}</div></td>
                    <td className="max-w-80 px-3 py-3"><div className="font-semibold">{d.tourName}</div><div className="text-xs text-muted">{d.tourCode}</div></td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CHANNEL[d.channel].className}`}>{CHANNEL[d.channel].label}</span></td>
                    <td className="px-3 py-3"><div>{d.closedBy?.fullName ?? 'Chưa có người xác nhận'}</div><div className="text-xs text-muted">{d.departmentName}</div></td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.guests}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-blue-ink">{vnd(d.amount)}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tt.cls}`}>{tt.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 0 && (
        <>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-page px-4 py-3 text-sm">
            <span className="text-body">{status === 'CONFIRMED' ? 'Tổng doanh thu' : status === 'PENDING' ? 'Tổng giá trị đơn chờ' : 'Tổng giá trị đơn huỷ'} ({so(data.total)} đơn, {so(data.sumGuests)} khách)</span>
            <span className="flex flex-wrap items-baseline gap-x-3">
              <strong className="text-lg text-brand-text">{vnd(data.sumAmount)}</strong>
              <span className="text-xs text-muted">chiếm {phanTram(data.allAmount ? data.sumAmount / data.allAmount : null)} {status === 'CONFIRMED' ? 'doanh thu' : 'tổng giá trị'} của kỳ{kenh || timTre.trim() ? ' (theo bộ lọc đang chọn)' : ''}</span>
            </span>
          </div>
        </>
      )}
    </>
  );
  if (embedded) return body;
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </header>
      {body}
    </section>
  );
}

type ConvRow = { id: string; channel: Channel; status: Status; at: string | null; lastMessagePreview: string | null; customer: { name: string; phone: string | null }; assignee: { fullName: string } | null };
export type DetailKind = 'customers' | 'newCustomers' | 'conversations' | 'contacts';
const TEN_KIEU: Record<DetailKind, string> = { customers: 'Khách nhắn gần nhất lúc', newCustomers: 'Khách lần đầu nhắn lúc', conversations: 'Hội thoại bắt đầu lúc', contacts: 'Khách đòi gặp nhân viên lúc' };

/** Danh sách hội thoại của một mốc trên biểu đồ (10 dòng một trang), bấm để mở hội thoại. */
export function ConversationsDetail({ base, kind, from, to, channel }: { base: string; kind: DetailKind; from: string; to: string; channel?: Channel }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [kind, from, to, channel]);
  const q = new URLSearchParams(base);
  q.delete('range');
  q.set('kind', kind);
  q.set('from', from);
  q.set('to', to);
  q.set('page', String(page));
  if (channel) q.set('channel', channel);
  const { data, error } = useSWR<{ items: ConvRow[]; total: number; page: number; pageSize: number }>(`/stats/detail?${q}`, fetcher, { keepPreviousData: true });
  if (error) return <p role="alert" className="text-sm text-alert-ink">Không tải được danh sách.</p>;
  if (!data) return <p role="status" className="text-sm text-muted">Đang tải…</p>;
  if (!data.items.length) return <p className="rounded-xl bg-fill/60 p-4 text-center text-sm text-muted">Không có hội thoại nào trong mốc này.</p>;
  return (
    <>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-fill/60 text-left text-xs text-muted">
              <th className="px-3 py-2.5 font-medium">Khách hàng</th>
              <th className="px-3 py-2.5 font-medium">Nền tảng</th>
              <th className="px-3 py-2.5 font-medium">{TEN_KIEU[kind]}</th>
              <th className="px-3 py-2.5 font-medium">Tin gần nhất</th>
              <th className="px-3 py-2.5 font-medium">Phụ trách</th>
              <th className="px-3 py-2.5 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id} className="border-b border-line-soft hover:bg-fill/50">
                <td className="px-3 py-2.5"><Link to={`/inbox?c=${encodeURIComponent(c.id)}`} className="font-semibold text-blue-ink hover:underline">{c.customer.name} ↗</Link><div className="text-xs text-muted">{c.customer.phone ? dinhDangSo(c.customer.phone) : 'Chưa có SĐT'}</div></td>
                <td className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CHANNEL[c.channel].className}`}>{CHANNEL[c.channel].label}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{c.at ? new Date(c.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                <td className="max-w-72 truncate px-3 py-2.5 text-body" title={c.lastMessagePreview ?? ''}>{c.lastMessagePreview ?? '—'}</td>
                <td className="px-3 py-2.5">{c.assignee?.fullName ?? <span className="text-muted">Bot</span>}</td>
                <td className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} />
    </>
  );
}

/** Bảng số tóm tắt của một mục (khi mục đó không có danh sách bản ghi riêng). */
export function SummaryRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-fill p-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 font-bold text-ink">{v}</dd></div>
      ))}
    </dl>
  );
}
