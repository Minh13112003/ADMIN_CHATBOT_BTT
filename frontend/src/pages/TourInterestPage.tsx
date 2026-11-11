import { Fragment, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Modal, UnderlineTabs } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { CHANNEL, thoiGianTruoc } from '@/lib/labels';
import type { Channel } from '@/lib/types';

type TourRow = { rank: number; key: string; name: string; place: string | null; askers: number; asks: number; bot: number; tag: number; firstAskedAt: string; lastAskedAt: string; price: number | null; days: number | null; nights: number | null; image: string | null };
type PlaceRow = { rank: number; name: string; askers: number; asks: number; tours: number; children: { key: string; name: string; askers: number; asks: number; rank: number; days: number | null; nights: number | null; price: number | null; image: string | null }[] };
type Summary = { tours: number; customers: number; asks: number; newTours: number; topPlace: { name: string; askers: number } | null };
type Ranking<T> = { summary: Summary; total: number; items: T[] };
type Detail = TourRow & { totalTours: number; newCustomers7d: number; closed: number; revenue: number; closeRate: number; daily: { date: string; count: number }[]; channels: Partial<Record<Channel, number>>; topTaggers: { name: string; department: string | null; count: number }[] };
type Lan = { messageId: string | null; conversationId: string; text: string; at: string; source: 'BOT' | 'TAG'; by: string | null; time: number };
type Asker = { customerId: string; name: string; phone: string | null; channel: Channel; lastAskedAt: string; asks: Lan[] };

type Ky = '' | '7' | '30';
type View = 'place' | 'tour';
const TRANG = 25;
const so = (n: number) => n.toLocaleString('vi-VN');
const ngay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const gia = (v: number | null) => (v ? `${v.toLocaleString('vi-VN')} đ` : 'Chưa có giá');
const thoiLuong = (t: { days: number | null; nights: number | null }) => (t.days ? `${t.days}N${t.nights ?? Math.max(0, t.days - 1)}Đ` : null);
const pt = (n: number, d: number) => (d ? `${((n / d) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '0%');

function kyQuery(ky: Ky, kenh: string) {
  const p = new URLSearchParams();
  if (ky) p.set('days', ky);
  if (kenh) p.set('channel', kenh);
  return p;
}

/** Mở đúng tin nhắn của khách ở tab mới: hộp thư tải quanh tin đó, cuộn tới và làm nổi bật. */
const linkTin = (a: { conversationId: string; messageId: string | null }) => `/inbox?c=${a.conversationId}${a.messageId ? `&m=${a.messageId}` : ''}`;

function taiCsv(ten: string, dong: (string | number)[][]) {
  const csv = dong.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  a.click();
  URL.revokeObjectURL(url);
}

const chonClass = 'min-h-11 rounded-[9px] border border-line bg-fill px-3 text-[0.8125rem] font-semibold';
const BieuDo = <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20h18M6 20V10M12 20V4M18 20v-8" /></svg>;

function Kpi({ label, value, unit, note, hot }: { label: string; value: string; unit?: string; note?: string; hot?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <p className={`mt-2 truncate text-3xl font-bold max-md:text-2xl ${hot ? 'text-brand-text' : ''}`}>{value} {unit && <span className="text-sm font-medium text-muted">{unit}</span>}</p>
      {note && <p className="mt-1 truncate text-xs text-muted">{note}</p>}
    </div>
  );
}

function Thanh({ phanTram, dam }: { phanTram: number; dam?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-fill"><span className={`block h-full rounded-full ${dam ? 'bg-brand-button' : 'bg-body'}`} style={{ width: `${Math.max(3, phanTram)}%` }} /></span>
      <span className="w-12 text-right text-xs font-semibold text-muted">{phanTram.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%</span>
    </div>
  );
}

function NutThongKe({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold hover:bg-fill">
      {BieuDo}Xem thống kê
    </button>
  );
}

function AnhTour({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" loading="lazy" className="h-11 w-16 shrink-0 rounded-lg bg-fill object-cover" /> : <span aria-hidden="true" className="h-11 w-16 shrink-0 rounded-lg bg-fill" />;
}

function Hang({ rank }: { rank: number }) {
  return <span className={`grid size-8 place-items-center rounded-full text-sm font-bold ${rank === 1 ? 'bg-brand-button text-white' : rank <= 3 ? 'bg-brand-soft text-brand-text' : 'text-muted'}`}>{rank}</span>;
}

function BangTour({ rows, top, onOpen }: { rows: TourRow[]; top: number; onOpen: (key: string) => void }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="bg-fill text-left text-[0.6875rem] font-bold uppercase tracking-wider text-muted">
            <th className="w-16 px-4 py-3">Hạng</th>
            <th className="px-4 py-3">Tên tour</th>
            <th className="px-4 py-3 text-right">Giá / người</th>
            <th className="px-4 py-3 text-right">Khách quan tâm</th>
            <th className="px-4 py-3 text-right">Lượt</th>
            <th className="w-44 px-4 py-3">Mức độ quan tâm</th>
            <th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.key} onClick={() => onOpen(t.key)} className="cursor-pointer border-t border-line-soft hover:bg-page">
              <td className="px-4 py-3"><Hang rank={t.rank} /></td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-3">
                <AnhTour src={t.image} />
                <span className="min-w-0">
                <strong className="line-clamp-2 font-semibold">{t.name}</strong>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  {thoiLuong(t) && <span className="rounded border border-line px-1.5 py-0.5 font-semibold text-body">{thoiLuong(t)}</span>}
                  {t.place && <span className="rounded bg-amber-soft px-1.5 py-0.5 font-semibold text-amber-ink">{t.place}</span>}
                  <span className="text-muted">Gần nhất {thoiGianTruoc(t.lastAskedAt)}</span>
                </span>
                </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{gia(t.price)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right"><strong className={t.rank === 1 ? 'text-brand-text' : ''}>{so(t.askers)}</strong> khách</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-body">{so(t.asks)}</td>
              <td className="px-4 py-3"><Thanh phanTram={top ? (t.askers / top) * 100 : 0} dam={t.rank <= 3} /></td>
              <td className="px-4 py-3 text-right"><NutThongKe onClick={() => onOpen(t.key)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BangDiaDiem({ rows, onOpen }: { rows: PlaceRow[]; onOpen: (key: string) => void }) {
  const [mo, setMo] = useState<Set<string>>(() => new Set(rows[0] ? [rows[0].name] : []));
  const doiMo = (ten: string) => setMo((cu) => { const n = new Set(cu); if (n.has(ten)) n.delete(ten); else n.add(ten); return n; });
  const top = rows[0]?.askers ?? 0;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-fill text-left text-[0.6875rem] font-bold uppercase tracking-wider text-muted">
            <th className="w-16 px-4 py-3">Hạng</th>
            <th className="px-4 py-3">Địa điểm</th>
            <th className="px-4 py-3 text-right">Khách quan tâm</th>
            <th className="px-4 py-3 text-right">Lượt</th>
            <th className="px-4 py-3 text-right">Số tour có khách / Giá tour</th>
            <th className="w-44 px-4 py-3">Mức độ quan tâm</th>
            <th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const dangMo = mo.has(p.name);
            return (
              <Fragment key={p.name}>
                <tr onClick={() => doiMo(p.name)} className="cursor-pointer border-t border-line-soft hover:bg-page">
                  <td className="px-4 py-3"><Hang rank={p.rank} /></td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={`grid size-6 place-items-center rounded border border-line text-xs transition-transform ${dangMo ? 'rotate-90' : ''}`}>›</span>
                      <strong className="font-semibold">{p.name}</strong>
                      {p.rank === 1 && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand-text">Top 1</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right"><strong>{so(p.askers)}</strong> khách</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-body">{so(p.asks)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-body">{so(p.tours)} tour</td>
                  <td className="px-4 py-3"><Thanh phanTram={top ? (p.askers / top) * 100 : 0} dam={p.rank <= 3} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" aria-expanded={dangMo} aria-label={`${dangMo ? 'Thu gọn' : 'Xem'} tour của ${p.name}`} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-brand-text">{dangMo ? 'Thu gọn' : 'Xem tour'}</button>
                  </td>
                </tr>
                {dangMo && p.children.map((t) => (
                  <tr key={t.key} onClick={() => onOpen(t.key)} className="cursor-pointer border-t border-line-soft bg-brand-faint/40 hover:bg-brand-faint">
                    <td className="px-4 py-2.5 text-center text-muted">↳</td>
                    <td className="px-4 py-2.5 pl-12">
                      <span className="flex items-center gap-3">
                        <AnhTour src={t.image} />
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-medium">{t.name}</span>
                          <span className="mt-0.5 flex gap-1.5 text-xs text-muted">{thoiLuong(t) && <span>{thoiLuong(t)}</span>}<span>Hạng tour #{t.rank}</span></span>
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">{so(t.askers)} khách</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-body">{so(t.asks)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-body">{gia(t.price)}</td>
                    <td className="px-4 py-2.5"><Thanh phanTram={p.askers ? (t.askers / p.askers) * 100 : 0} /></td>
                    <td className="px-4 py-2.5 text-right"><NutThongKe onClick={() => onOpen(t.key)} /></td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Hộp "Thống kê tour" (Stitch: "Nhu cầu tour (Digital) — Chi tiết tour & Modal Thống kê tour"). */
function TourStatsModal({ tourKey, ky, kenh, onClose }: { tourKey: string; ky: Ky; kenh: string; onClose: () => void }) {
  const p = kyQuery(ky, kenh);
  p.set('key', tourKey);
  const { data: d, error } = useSWR<Detail>(`/tour-interest/detail?${p}`, fetcher);
  const { data: ds, error: loiDs } = useSWR<Asker[]>(`/tour-interest/askers?${p}`, fetcher);
  const [tab, setTab] = useState<'overview' | 'askers'>('overview');
  const [tim, setTim] = useState('');
  const [locKenh, setLocKenh] = useState('');
  const loc = useMemo(() => {
    const t = tim.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    return (ds ?? []).filter((k) => (!locKenh || k.channel === locKenh) && (!t || `${k.name} ${k.phone ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').includes(t)));
  }, [ds, tim, locKenh]);
  const cao = Math.max(1, ...(d?.daily.map((x) => x.count) ?? [1]));
  const tongKenh = d ? Object.values(d.channels).reduce((s, n) => s + (n ?? 0), 0) : 0;

  const xuat = () =>
    ds &&
    taiCsv(`khach-quan-tam-${tourKey.slice(0, 40).replace(/\W+/g, '-')}.csv`, [
      ['Khách', 'Số điện thoại', 'Kênh', 'Lần', 'Nguồn', 'Tin nhắn', 'Thời gian'],
      ...ds.flatMap((k) => k.asks.map((a) => [k.name, k.phone ?? '', CHANNEL[k.channel]?.label ?? k.channel, a.time, `Sale ghim: ${a.by ?? ''}`, a.text, new Date(a.at).toLocaleString('vi-VN')])),
    ]);

  return (
    <Modal
      title="Thống kê tour"
      width={760}
      onClose={onClose}
      footer={
        <>
          <span className="flex-1 text-[0.8125rem] text-muted">{tab === 'askers' && ds ? `Đang hiển thị ${so(loc.length)} / ${so(ds.length)} khách` : ''}</span>
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-field bg-surface px-4 text-sm font-semibold hover:bg-fill">Đóng</button>
          <button type="button" disabled={!ds?.length} onClick={xuat} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand-button px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
            Xuất danh sách
          </button>
        </>
      }
    >
      {error && <p role="alert" className="text-sm text-brand-text">Không tải được thống kê tour này.</p>}
      {!d && !error && <p role="status" className="text-sm text-muted">Đang tải thống kê...</p>}
      {d && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-2xl border border-line p-4 max-sm:flex-wrap">
            {d.image ? <img src={d.image} alt="" className="size-16 shrink-0 rounded-xl bg-fill object-cover" /> : <span aria-hidden="true" className="size-16 shrink-0 rounded-xl bg-fill" />}
            <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-5rem)]">
              <h3 className="line-clamp-2 font-semibold">{d.name}</h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {d.place && <span className="rounded border border-amber-line bg-amber-soft px-1.5 py-0.5 font-semibold text-amber-ink">{d.place}</span>}
                {thoiLuong(d) && <span className="rounded border border-line px-1.5 py-0.5 font-semibold text-body">{thoiLuong(d)}</span>}
                {d.price ? <span className="font-semibold text-brand-text">Giá từ {gia(d.price)}/người</span> : null}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-alert-line bg-brand-faint px-3 py-1.5 text-sm font-semibold text-brand-text">Hạng {d.rank} / {so(d.totalTours)} tour</span>
          </div>

          <div className="-mx-6 max-sm:-mx-4">
            <UnderlineTabs label="Thống kê tour" value={tab} onChange={setTab} items={[{ key: 'overview', label: 'Tổng quan' }, { key: 'askers', label: `Khách quan tâm (${so(d.askers)})` }]} />
          </div>

          {tab === 'overview' ? (
            <>
              <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
                {[
                  { ten: 'Khách quan tâm', so: so(d.askers), phu: d.newCustomers7d ? `+${so(d.newCustomers7d)} khách 7 ngày qua` : 'Không có khách mới 7 ngày qua', mau: d.newCustomers7d ? 'text-green-ink' : 'text-muted' },
                  { ten: 'Lượt quan tâm', so: so(d.asks), phu: `Trung bình ${(d.askers ? d.asks / d.askers : 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}/khách`, mau: 'text-muted' },
                  { ten: 'Đã chốt', so: `${so(d.closed)} đơn`, phu: d.revenue ? `Doanh thu ${so(Math.round(d.revenue / 1e6))} triệu` : 'Chưa có doanh thu', mau: d.revenue ? 'text-green-ink' : 'text-muted' },
                  { ten: 'Tỷ lệ chốt', so: pt(d.closed, d.askers), phu: 'Đơn đã chốt / khách quan tâm', mau: 'text-muted', hot: true },
                ].map((k) => (
                  <div key={k.ten} className="min-w-0 rounded-xl border border-line bg-page p-3">
                    <p className="text-xs text-muted">{k.ten}</p>
                    <p className={`mt-1 text-2xl font-bold ${k.hot ? 'text-brand-text' : ''}`}>{k.so}</p>
                    <p className={`mt-1 truncate text-xs font-medium ${k.mau}`}>{k.phu}</p>
                  </div>
                ))}
              </div>

              <section className="rounded-2xl border border-line p-4">
                <div className="flex items-baseline justify-between"><h4 className="font-semibold">Lượt quan tâm theo ngày (7 ngày qua)</h4><span className="text-xs text-muted">Tổng {so(d.daily.reduce((s, x) => s + x.count, 0))} lượt</span></div>
                <div className="mt-4 flex h-40 items-end gap-3 border-b border-line pb-1" role="img" aria-label={`Lượt quan tâm 7 ngày: ${d.daily.map((x) => x.count).join(', ')}`}>
                  {d.daily.map((x, i) => {
                    const homNay = i === d.daily.length - 1;
                    return (
                      <div key={x.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <span className={`text-xs font-semibold ${homNay ? 'text-brand-text' : 'text-body'}`}>{x.count}</span>
                        <span className={`w-full max-w-10 rounded-t ${homNay ? 'bg-brand-button' : 'bg-brand-soft'}`} style={{ height: `${Math.max(2, (x.count / cao) * 100)}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-3">
                  {d.daily.map((x, i) => (
                    <span key={x.date} className={`flex-1 text-center text-xs ${i === d.daily.length - 1 ? 'font-semibold text-brand-text' : 'text-muted'}`}>{i === d.daily.length - 1 ? 'Hôm nay' : `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`}</span>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <section className="rounded-2xl border border-line p-4">
                  <div className="flex items-baseline justify-between border-b border-line pb-2"><h4 className="font-semibold">Theo kênh tiếp cận</h4><span className="text-xs text-muted">{so(tongKenh)} khách</span></div>
                  <ul className="mt-3 flex flex-col gap-3">
                    {(['WEB', 'APP', 'ZALO', 'FACEBOOK'] as Channel[]).map((c) => {
                      const n = d.channels[c] ?? 0;
                      return (
                        <li key={c}>
                          <div className="flex justify-between text-sm"><span>{CHANNEL[c].label}</span><span><strong>{so(n)} khách</strong> <span className="text-muted">({pt(n, tongKenh)})</span></span></div>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fill"><span className={`block h-full rounded-full ${c === 'WEB' ? 'bg-brand-button' : c === 'APP' ? 'bg-brand-soft' : c === 'ZALO' ? 'bg-blue-ink' : 'bg-purple-ink'}`} style={{ width: `${tongKenh ? (n / tongKenh) * 100 : 0}%` }} /></span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section className="rounded-2xl border border-line p-4">
                  <div className="flex items-baseline justify-between border-b border-line pb-2"><h4 className="font-semibold">Sale ghim tour</h4><span className="text-xs text-muted">{so(d.asks)} lượt ghim</span></div>
                  <p className="mt-3 text-[0.6875rem] font-bold uppercase tracking-wide text-muted">Top sale gắn nhiều nhất</p>
                  {!d.topTaggers.length && <p className="mt-2 text-sm text-muted">Chưa có sale nào gắn tour này.</p>}
                  <ol className="mt-1 divide-y divide-line">
                    {d.topTaggers.map((s, i) => (
                      <li key={`${s.name}-${i}`} className="flex items-center gap-2 py-2 text-sm">
                        <span className="grid size-5 place-items-center rounded-full bg-amber-soft text-xs font-bold text-amber-ink">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{s.name}{s.department ? <span className="text-muted"> ({s.department})</span> : null}</span>
                        <strong>{so(s.count)} lượt</strong>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <p className="text-xs text-muted">Lần quan tâm đầu: {ngay(d.firstAskedAt)} · Gần nhất: {ngay(d.lastAskedAt)}</p>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm tên hoặc số điện thoại" aria-label="Tìm khách" className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-field bg-surface px-3 text-sm" />
                <select value={locKenh} onChange={(e) => setLocKenh(e.target.value)} aria-label="Lọc kênh" className={chonClass}>
                  <option value="">Mọi kênh</option>
                  {(['WEB', 'APP', 'ZALO', 'FACEBOOK'] as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL[c].label}</option>)}
                </select>
              </div>
              {!ds && !loiDs && <p role="status" className="text-sm text-muted">Đang tải danh sách khách...</p>}
              {loiDs && <p role="alert" className="text-sm text-brand-text">Không tải được danh sách khách.</p>}
              {ds && !loc.length && <p className="text-sm text-muted">Không có khách khớp.</p>}
              <ul className="flex flex-col gap-3">
                {loc.map((k) => (
                  <li key={k.customerId} className="rounded-2xl border border-line p-3.5">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-soft text-sm font-bold text-blue-ink">{k.name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{k.name}</p>
                        <p className="text-xs"><span className="font-semibold text-blue-ink">{CHANNEL[k.channel]?.label ?? k.channel}</span><span className="text-muted"> · {k.phone ?? 'Chưa có số điện thoại'}</span></p>
                      </div>
                      <span className="shrink-0 rounded-md border border-green-ink/30 bg-green-soft px-2 py-0.5 text-xs font-semibold text-green-ink">{k.asks.length} lần</span>
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {k.asks.map((a, i) => (
                        <li key={`${a.conversationId}-${a.messageId ?? i}-${a.time}`} className="rounded-xl border border-line bg-page p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className={`rounded px-1.5 py-0.5 font-semibold ${i === 0 ? 'bg-amber-ink text-white' : 'bg-neutral-ink text-white'}`}>Lần {a.time} · {ngay(a.at)}</span>
                            <span className="text-muted"><>Sale ghim: <strong className="text-ink">{a.by ?? 'nhân viên đã nghỉ'}</strong></></span>
                          </div>
                          <p className={`mt-2 border-l-[3px] bg-surface px-3 py-2 text-sm italic ${i === 0 ? 'border-amber-ink' : 'border-line'}`}>“{a.text || 'Không có tin nhắn kèm theo'}”</p>
                          <div className="mt-1.5 text-right">
                            <a href={linkTin(a)} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-brand-text hover:underline">
                              Mở tin nhắn
                              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** `embedded`: hiện trong tab "Nhu cầu tour (Digital)" của trang Thống kê, bỏ khoảng đệm và tiêu đề riêng. */
export default function TourInterestPage({ embedded = false }: { embedded?: boolean }) {
  const [view, setView] = useState<View>('tour');
  const [ky, setKy] = useState<Ky>('');
  const [kenh, setKenh] = useState('');
  const [moi, setMoi] = useState(false);
  const [full, setFull] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [trang, setTrang] = useState(0);
  const [chon, setChon] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setTrang(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const p = kyQuery(ky, kenh);
  p.set('view', view);
  p.set('take', String(full ? TRANG : view === 'place' ? 50 : 10));
  p.set('skip', String(full ? trang * TRANG : 0));
  if (moi && view === 'tour') p.set('moi', '1');
  if (full && q.trim()) p.set('search', q.trim());
  const { data, error, mutate } = useSWR<Ranking<TourRow | PlaceRow>>(`/tour-interest?${p}`, fetcher, { keepPreviousData: true });
  const dungView = !!data?.items.length && ('children' in data.items[0]) === (view === 'place');
  const tours = view === 'tour' && dungView ? (data!.items as TourRow[]) : [];
  const places = view === 'place' && dungView ? (data!.items as PlaceRow[]) : [];
  const top = tours[0]?.askers ?? 0;
  const soTrang = data ? Math.max(1, Math.ceil(data.total / TRANG)) : 1;
  const thoat = () => { setFull(false); setSearch(''); setQ(''); setTrang(0); };

  const xuat = () => {
    if (view === 'tour') taiCsv('nhu-cau-tour.csv', [['Hạng', 'Tên tour', 'Địa điểm', 'Giá / người', 'Khách quan tâm', 'Lượt ghim', 'Lần đầu', 'Gần nhất'], ...tours.map((t) => [t.rank, t.name, t.place ?? '', t.price ?? '', t.askers, t.asks, ngay(t.firstAskedAt), ngay(t.lastAskedAt)])]);
    else taiCsv('nhu-cau-theo-dia-diem.csv', [['Hạng', 'Địa điểm', 'Tour', 'Khách quan tâm', 'Lượt'], ...places.flatMap((pl) => [[pl.rank, pl.name, '', pl.askers, pl.asks], ...pl.children.map((t) => ['', pl.name, t.name, t.askers, t.asks])])]);
  };

  return (
    <main className={embedded ? 'flex w-full min-w-0 flex-col gap-5' : 'mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-5 px-8 py-6 max-[1199px]:px-6 max-md:px-4 max-md:py-5'}>
      {embedded && !full ? null : full ? (
        <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <button type="button" onClick={thoat} className="min-h-9 text-sm font-semibold text-brand-text">← Thu gọn về Top 10</button>
          <h1 className="mt-1 text-xl font-bold">Toàn bộ tour khách quan tâm{ky ? ` trong ${ky} ngày qua` : ' từ trước đến nay'}</h1>
          {data && q && <p className="mt-2 inline-block rounded-md bg-fill px-2.5 py-1 text-xs">Khớp {so(data.total)} tour · giữ nguyên thứ hạng gốc</p>}
        </header>
      ) : (
        <header>
          <h1 className="text-xl font-bold">Nhu cầu tour</h1>
          <p className="mt-1 max-w-[680px] text-sm text-muted">Tính theo tour sale ghim trên tin nhắn của khách. Xếp theo số khách; bấm một tour để xem thống kê và mở tin nhắn gốc.</p>
        </header>
      )}

      {!full && (
        <div className="-mb-2 [&>div]:px-0">
          <UnderlineTabs
            label="Cách xem"
            value={view}
            onChange={(v) => { setView(v); setTrang(0); }}
            items={[
              { key: 'place', label: <><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>Theo địa điểm</> },
              { key: 'tour', label: <><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>Theo tour chi tiết</> },
            ]}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <label className="flex items-center gap-2 text-[0.8125rem] text-muted">Thời gian
          <select value={ky} onChange={(e) => { setKy(e.target.value as Ky); setTrang(0); }} className={chonClass}>
            <option value="">Từ trước đến nay</option>
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[0.8125rem] text-muted">Kênh
          <select value={kenh} onChange={(e) => { setKenh(e.target.value); setTrang(0); }} className={chonClass}>
            <option value="">Tất cả kênh</option>
            {(['WEB', 'APP', 'ZALO', 'FACEBOOK'] as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL[c].label}</option>)}
          </select>
        </label>
        {view === 'tour' && (
          <label className="flex min-h-11 items-center gap-2 px-2 text-[0.8125rem]">
            <input type="checkbox" checked={moi} onChange={(e) => { setMoi(e.target.checked); setTrang(0); }} /> Tour mới 30 ngày
          </label>
        )}
        {full && <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên tour (không cần gõ dấu)" aria-label="Tìm tour" className="min-h-11 min-w-[220px] flex-1 rounded-[10px] border border-field bg-surface px-3 text-sm" />}
        <button type="button" disabled={!data?.items.length} onClick={xuat} className="ml-auto inline-flex min-h-11 items-center rounded-[9px] border border-field bg-surface px-4 text-[0.8125rem] font-semibold hover:bg-fill disabled:opacity-40">Xuất CSV</button>
      </div>

      {!full && (
        <div className="grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
          <Kpi label="Khách quan tâm" value={data ? so(data.summary.customers) : '—'} unit="khách" hot />
          <Kpi label="Lượt quan tâm" value={data ? so(data.summary.asks) : '—'} unit="lượt" note={data && data.summary.customers ? `Trung bình ${(data.summary.asks / data.summary.customers).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} lượt/khách` : undefined} />
          <Kpi label="Tour có khách quan tâm" value={data ? so(data.summary.tours) : '—'} unit="tour" note={data ? `${so(data.summary.newTours)} tour mới trong 30 ngày` : undefined} />
          <Kpi label="Địa điểm dẫn đầu" value={data?.summary.topPlace?.name ?? '—'} note={data?.summary.topPlace ? `${so(data.summary.topPlace.askers)} khách quan tâm` : undefined} />
        </div>
      )}

      <section aria-label={view === 'place' ? 'Theo địa điểm' : 'Theo tour chi tiết'} className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{full ? `${data ? so(data.total) : '…'} tour` : view === 'place' ? 'Nhu cầu theo địa điểm' : 'Top 10 tour khách quan tâm'}</h2>
          {!full && view === 'place' && <span className="text-xs text-muted">Bấm vào địa điểm để xem các tour</span>}
          {!full && view === 'tour' && <button type="button" onClick={() => setFull(true)} className="inline-flex min-h-11 items-center rounded-lg border border-alert-line bg-brand-faint px-4 text-[0.8125rem] font-semibold text-brand-text hover:bg-brand-soft">Phóng to – Xem toàn bộ {data ? so(data.summary.tours) : ''} tour →</button>}
        </div>
        {!data && !error && <p role="status" className="p-6 text-center text-sm text-muted">Đang tải nhu cầu tour...</p>}
        {error && <p role="alert" className="p-6 text-center text-sm text-brand-text">Không tải được dữ liệu. <button className="underline" onClick={() => void mutate()}>Thử lại</button></p>}
        {data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted">{q ? 'Không tìm thấy tour phù hợp.' : 'Chưa có khách quan tâm tour trong phạm vi và khoảng thời gian này.'}</p>}
        {!!tours.length && <BangTour rows={tours} top={top} onOpen={setChon} />}
        {!!places.length && <BangDiaDiem key={`${ky}-${kenh}`} rows={places} onOpen={setChon} />}
        <p className="border-t border-line bg-fill px-5 py-3 text-xs text-muted">Khách đếm một lần cho mỗi tour (và mỗi địa điểm). Lượt = số lần sale ghim tour.</p>
        {full && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <button type="button" disabled={trang === 0} onClick={() => setTrang(trang - 1)} className="min-h-11 rounded-lg border border-field px-4 text-sm font-semibold disabled:opacity-40">← Trước</button>
            <span className="text-sm text-muted">Trang {trang + 1}/{soTrang}</span>
            <button type="button" disabled={trang + 1 >= soTrang} onClick={() => setTrang(trang + 1)} className="min-h-11 rounded-lg border border-field px-4 text-sm font-semibold disabled:opacity-40">Sau →</button>
          </div>
        )}
      </section>
      {chon && <TourStatsModal tourKey={chon} ky={ky} kenh={kenh} onClose={() => setChon(null)} />}
    </main>
  );
}
