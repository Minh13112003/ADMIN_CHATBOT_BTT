import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import useSWR from 'swr';
import { inputClass } from '@/components/ui';
import { fetcher, loiCua } from '@/lib/api';

type Nhom = 'MESSAGE' | 'CONVERSATION' | 'DEAL' | 'ACCOUNT' | 'VOUCHER' | 'SETTINGS' | 'AUTH' | 'RESTORE';
type Dong = { id: string; actorId: string | null; actorName: string; actorRole: string | null; group: Nhom; action: string; summary: string; conversationId: string | null; targetId: string | null; createdAt: string };
type TrangNhatKy = {
  items: Dong[];
  hasMore: boolean;
  nextBefore: string | null;
  summary?: { total: number; groups: Partial<Record<Nhom, number>>; actors: { id: string | null; name: string; role: string | null; count: number }[] };
};

/** Màu và tên từng nhóm thao tác: chấm màu ở dòng thời gian, chip lọc ở trên. */
const NHOM: Record<Nhom, { ten: string; cham: string; chip: string }> = {
  MESSAGE: { ten: 'Tin nhắn', cham: 'bg-blue-ink', chip: 'bg-blue-soft text-blue-ink' },
  CONVERSATION: { ten: 'Hội thoại', cham: 'bg-purple-ink', chip: 'bg-purple-soft text-purple-ink' },
  DEAL: { ten: 'Đơn tour', cham: 'bg-green-ink', chip: 'bg-green-soft text-green-ink' },
  ACCOUNT: { ten: 'Tài khoản', cham: 'bg-amber-ink', chip: 'bg-amber-soft text-amber-ink' },
  VOUCHER: { ten: 'Voucher', cham: 'bg-brand', chip: 'bg-brand-faint text-brand-text' },
  SETTINGS: { ten: 'Cài đặt', cham: 'bg-neutral-ink', chip: 'bg-neutral-soft text-neutral-ink' },
  AUTH: { ten: 'Đăng nhập', cham: 'bg-muted', chip: 'bg-fill text-body' },
  RESTORE: { ten: 'Khôi phục', cham: 'bg-alert-ink', chip: 'bg-brand-soft text-brand-text' },
};
const THU_TU: Nhom[] = ['MESSAGE', 'CONVERSATION', 'DEAL', 'ACCOUNT', 'VOUCHER', 'SETTINGS', 'AUTH', 'RESTORE'];
const VAI_TRO: Record<string, string> = { ADMIN: 'Admin', SALE: 'Sale', DEPT_ADMIN: 'Admin phòng', DIGITAL: 'Digital' };

/** Ngày theo giờ Việt Nam dạng YYYY-MM-DD. */
const ngayVN = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const congNgay = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const gio = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const khungGio = (iso: string) => `${new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).slice(0, 2)}:00`;
const tenNgay = (iso: string, homNay: string) => {
  if (iso === homNay) return 'Hôm nay';
  if (iso === congNgay(homNay, -1)) return 'Hôm qua';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('vi-VN', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const chuDau = (ten: string) => ten.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';

export default function ActivityLogPage() {
  const homNay = ngayVN(new Date());
  const [ngay, setNgay] = useState(homNay);
  const [nhom, setNhom] = useState<Nhom | ''>('');
  const [nguoi, setNguoi] = useState('');
  const [go, setGo] = useState('');
  const [tim, setTim] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setTim(go.trim()), 350);
    return () => clearTimeout(h);
  }, [go]);

  const qs = new URLSearchParams({ date: ngay, ...(nhom ? { group: nhom } : {}), ...(nguoi ? { actorId: nguoi } : {}), ...(tim ? { search: tim } : {}) }).toString();
  // Tóm tắt trong ngày (theo nhóm, theo người) không phụ thuộc bộ lọc.
  const { data: tong } = useSWR<TrangNhatKy>(`/activity-logs?date=${ngay}`, fetcher, { refreshInterval: ngay === homNay ? 30_000 : 0 });
  const { data, error, isLoading, mutate } = useSWR<TrangNhatKy>(`/activity-logs?${qs}`, fetcher, { refreshInterval: ngay === homNay ? 30_000 : 0 });
  const [them, setThem] = useState<Dong[]>([]);
  const [moc, setMoc] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [loiThem, setLoiThem] = useState('');
  useEffect(() => {
    setThem([]);
    setMoc(null);
    setLoiThem('');
  }, [qs]);
  const tiepTheo = moc ?? data?.nextBefore ?? null;
  const conNua = moc !== null ? !!moc : !!data?.hasMore;
  const taiThem = async () => {
    if (!tiepTheo) return;
    setDangTai(true);
    setLoiThem('');
    try {
      const r = await fetcher<TrangNhatKy>(`/activity-logs?${qs}&before=${encodeURIComponent(tiepTheo)}`);
      setThem((t) => [...t, ...r.items]);
      setMoc(r.nextBefore ?? '');
    } catch (e) {
      setLoiThem(loiCua(e));
    } finally {
      setDangTai(false);
    }
  };

  const dong = useMemo(() => [...(data?.items ?? []), ...them], [data, them]);
  const theoGio = useMemo(() => {
    const ra: { gio: string; ds: Dong[] }[] = [];
    for (const d of dong) {
      const g = khungGio(d.createdAt);
      if (ra[ra.length - 1]?.gio === g) ra[ra.length - 1].ds.push(d);
      else ra.push({ gio: g, ds: [d] });
    }
    return ra;
  }, [dong]);
  const s = tong?.summary;
  const dangLoc = !!(nhom || nguoi || tim);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6 max-md:p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted">Quản trị / Admin toàn quyền</p>
          <h1 className="mt-1 text-xl font-bold">Nhật ký thao tác</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">Nhân viên đã làm gì trong ngày: nhắn tin, chốt tour, tạo tài khoản, voucher...</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1 shadow-sm">
          <button type="button" aria-label="Ngày trước" onClick={() => setNgay(congNgay(ngay, -1))} className="grid size-10 place-items-center rounded-lg text-lg hover:bg-fill">‹</button>
          <label className="relative">
            <span className="sr-only">Chọn ngày</span>
            <input type="date" value={ngay} max={homNay} onChange={(e) => e.target.value && setNgay(e.target.value)} className="min-h-10 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-ink" />
          </label>
          <button type="button" aria-label="Ngày sau" disabled={ngay >= homNay} onClick={() => setNgay(congNgay(ngay, 1))} className="grid size-10 place-items-center rounded-lg text-lg hover:bg-fill disabled:opacity-30">›</button>
          {ngay !== homNay && <button type="button" onClick={() => setNgay(homNay)} className="min-h-10 rounded-lg bg-fill px-3 text-[0.8125rem] font-semibold hover:bg-line">Hôm nay</button>}
        </div>
      </header>

      <section aria-label="Tóm tắt trong ngày" className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-[0.8125rem] text-muted">{tenNgay(ngay, homNay)}</p>
          <p className="mt-2 text-3xl font-bold">{s ? s.total.toLocaleString('vi-VN') : '–'} <span className="text-sm font-medium text-muted">thao tác</span></p>
          <p className="mt-1 text-xs text-muted">{s ? `${s.actors.length} người` : ''}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-[0.8125rem] text-muted">Theo nhân viên (bấm để lọc)</p>
          {!s ? (
            <p className="mt-3 text-sm text-muted">Đang tải...</p>
          ) : s.actors.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Chưa có thao tác nào trong ngày này.</p>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {s.actors.map((a) => {
                const chon = !!a.id && nguoi === a.id;
                return (
                  <button
                    key={`${a.id}-${a.name}`}
                    type="button"
                    disabled={!a.id}
                    aria-pressed={chon}
                    onClick={() => setNguoi(chon ? '' : (a.id ?? ''))}
                    className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left transition-colors ${chon ? 'border-brand bg-brand-faint' : 'border-line hover:bg-fill'}`}
                  >
                    <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-neutral-soft text-sm font-bold text-neutral-ink">{chuDau(a.name)}</span>
                    <span className="min-w-0">
                      <span className="block max-w-36 truncate text-sm font-semibold">{a.name}</span>
                      <span className="block text-xs text-muted">{VAI_TRO[a.role ?? ''] ?? ''}{a.role ? ' · ' : ''}{a.count.toLocaleString('vi-VN')} thao tác</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={go} onChange={(e) => setGo(e.target.value)} placeholder="Tìm trong nội dung (tên khách, mã voucher...)" aria-label="Tìm trong nhật ký" className={`${inputClass} pl-10`} />
            </div>
            {dangLoc && (
              <button type="button" onClick={() => { setNhom(''); setNguoi(''); setGo(''); }} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-text hover:bg-brand-faint">
                Bỏ lọc
              </button>
            )}
          </div>
          <div role="group" aria-label="Lọc theo loại thao tác" className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button type="button" aria-pressed={!nhom} onClick={() => setNhom('')} className={`min-h-9 shrink-0 rounded-full border px-3 text-[0.8125rem] font-semibold ${!nhom ? 'border-ink bg-ink text-surface' : 'border-field bg-surface hover:bg-fill'}`}>
              Tất cả {s ? <span className="opacity-70">{s.total}</span> : null}
            </button>
            {THU_TU.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={nhom === k}
                onClick={() => setNhom(nhom === k ? '' : k)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold ${nhom === k ? 'border-ink bg-ink text-surface' : 'border-field bg-surface hover:bg-fill'}`}
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${NHOM[k].cham}`} />
                {NHOM[k].ten}
                {s?.groups[k] ? <span className="opacity-70">{s.groups[k]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p role="status" className="p-8 text-center text-sm text-muted">Đang tải nhật ký...</p>}
        {error && (
          <p role="alert" className="p-8 text-center text-sm text-brand-text">
            Không tải được nhật ký. <button type="button" className="underline" onClick={() => void mutate()}>Thử lại</button>
          </p>
        )}
        {data && dong.length === 0 && <p className="p-10 text-center text-sm text-muted">{dangLoc ? 'Không có thao tác nào khớp bộ lọc.' : 'Chưa có thao tác nào trong ngày này.'}</p>}

        {theoGio.length > 0 && (
          <ol className="px-4 pb-2 sm:px-6">
            {theoGio.map((k) => (
              <li key={k.gio + k.ds[0].id}>
                <h2 className="sticky top-0 z-[1] -mx-4 bg-surface/95 px-4 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-muted backdrop-blur sm:-mx-6 sm:px-6">
                  {k.gio} <span className="font-medium normal-case tracking-normal">· {k.ds.length} thao tác</span>
                </h2>
                <ol className="relative ml-[4.25rem] border-l border-line max-sm:ml-3">
                  {k.ds.map((d) => (
                    <li key={d.id} className="relative pb-3 pl-5">
                      <span aria-hidden="true" className={`absolute -left-[5px] top-2 size-[9px] rounded-full ring-4 ring-surface ${NHOM[d.group]?.cham ?? 'bg-muted'}`} />
                      <time dateTime={d.createdAt} className="absolute -left-[4.25rem] top-1 w-14 text-right font-mono text-xs tabular-nums text-muted max-sm:static max-sm:mb-0.5 max-sm:block max-sm:w-auto max-sm:text-left">
                        {gio(d.createdAt)}
                      </time>
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl px-2 py-1.5 hover:bg-fill">
                        <span className="font-semibold">{d.actorName}</span>
                        {d.actorRole && <span className="text-xs text-muted">{VAI_TRO[d.actorRole] ?? d.actorRole}</span>}
                        <span className={`rounded-md px-1.5 py-px text-[0.6875rem] font-semibold ${NHOM[d.group]?.chip ?? 'bg-fill'}`}>{NHOM[d.group]?.ten ?? d.group}</span>
                        <p className="w-full min-w-0 break-words text-sm text-body">{d.summary}</p>
                        {d.conversationId && (
                          <Link to={`/inbox?c=${d.conversationId}`} className="text-[0.8125rem] font-semibold text-brand-text hover:underline">
                            Mở hội thoại →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
        {conNua && (
          <div className="flex flex-col items-center gap-2 border-t border-line p-4">
            <button type="button" disabled={dangTai} onClick={() => void taiThem()} className="min-h-11 rounded-lg border border-field bg-surface px-5 text-sm font-semibold hover:bg-fill disabled:opacity-60">
              {dangTai ? 'Đang tải...' : 'Xem thêm thao tác cũ hơn trong ngày'}
            </button>
            {loiThem && <p role="alert" className="text-sm text-brand-text">{loiThem}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
