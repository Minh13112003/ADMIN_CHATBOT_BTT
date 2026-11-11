import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, loiCua, patch, post } from '@/lib/api';
import type { CatalogTour, Me, Place, Voucher, VoucherList, VoucherStatus } from '@/lib/types';
import { ErrorText, inputClass, Modal, primaryClass } from '@/components/ui';

const TRANG_THAI: Record<VoucherStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Hiệu lực', className: 'bg-green-soft text-green-ink' },
  SCHEDULED: { label: 'Chưa bắt đầu', className: 'bg-blue-soft text-blue-ink' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-fill text-muted' },
  PAUSED: { label: 'Tạm khoá', className: 'bg-amber-soft text-amber-ink' },
  USED_UP: { label: 'Hết lượt', className: 'bg-fill text-muted' },
};
const PHAM_VI: Record<Voucher['scope'], string> = { TOUR: 'Một tour cụ thể', CATEGORY: 'Một địa điểm', ALL: 'Toàn bộ danh mục' };

const ngay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
/** ISO -> YYYY-MM-DD theo giờ Việt Nam, cho ô chọn ngày. */
const oNgay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));
const soTien = (s: string) => Number(s.replace(/\D/g, '')) || 0;
const hienSo = (n: number | string) => (Number(n) ? Number(n).toLocaleString('vi-VN') : '');

/** Voucher: admin phòng ban (admin chi nhánh) và admin toàn quyền. Sale chỉ nhập mã khi chốt tour. */
export default function VouchersPage() {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const { data, error, mutate } = useSWR<VoucherList>('/vouchers', fetcher);
  const [tim, setTim] = useState('');
  const [loc, setLoc] = useState<'' | VoucherStatus>('');
  const [sua, setSua] = useState<Voucher | 'new' | null>(null);
  const [daChep, setDaChep] = useState<string | null>(null);
  const [loi, setLoi] = useState('');

  const ds = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return (data?.items ?? []).filter((v) => (!loc || v.status === loc) && (!t || v.code.toLowerCase().includes(t) || (v.tourName ?? v.categoryName ?? '').toLowerCase().includes(t)));
  }, [data, tim, loc]);

  const chep = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setDaChep(code);
      setTimeout(() => setDaChep(null), 1500);
    } catch {
      /* trình duyệt chặn sao chép thì thôi */
    }
  };
  const khoa = async (v: Voucher) => {
    setLoi('');
    try {
      await patch(`/vouchers/${v.id}/active`, { isActive: !v.isActive });
      await mutate();
    } catch (e) {
      setLoi(loiCua(e));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6 max-md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted">Quản trị / {me?.role === 'ADMIN' ? 'Toàn công ty' : (me?.department?.name ?? 'Phòng của bạn')}</p>
          <h1 className="mt-1 text-xl font-bold">Danh sách voucher khuyến mãi</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">Tạo mã giảm giá cho khách đặt tour. Sale nhập mã khi chốt, hệ thống tự tính số tiền cuối.</p>
        </div>
        <button type="button" onClick={() => setSua('new')} className={`${primaryClass} inline-flex items-center gap-2`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Tạo voucher
        </button>
      </header>

      <section aria-label="Tổng quan voucher" className="grid grid-cols-3 gap-4 max-md:gap-2">
        {[
          { ten: 'Đang hiệu lực', so: data?.summary.active, phu: 'voucher', mau: 'bg-green-ink' },
          { ten: 'Đã dùng trong tháng', so: data?.summary.usedThisMonth, phu: 'lượt', mau: 'bg-blue-ink' },
          { ten: 'Sắp hết hạn (7 ngày)', so: data?.summary.expiringSoon, phu: 'voucher', mau: 'bg-amber-ink' },
        ].map((k) => (
          <div key={k.ten} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm max-md:p-3">
            <p className="flex items-start justify-between gap-1 text-[0.8125rem] text-muted max-md:text-xs">{k.ten}<span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${k.mau}`} /></p>
            <p className="mt-2 text-3xl font-bold max-md:text-2xl">{k.so ?? '–'} <span className="text-sm font-medium text-muted max-md:block max-md:text-xs">{k.phu}</span></p>
          </div>
        ))}
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm theo mã hoặc tên tour" aria-label="Tìm voucher" className={`${inputClass} pl-10`} />
          </div>
          <div className="max-sm:w-full"><select value={loc} onChange={(e) => setLoc(e.target.value as '' | VoucherStatus)} aria-label="Lọc trạng thái" className={`${inputClass} font-semibold`}>
            <option value="">Mọi trạng thái</option>
            {(Object.keys(TRANG_THAI) as VoucherStatus[]).map((s) => <option key={s} value={s}>{TRANG_THAI[s].label}</option>)}
          </select></div>
        </div>
        <div className="px-4 pt-3"><ErrorText>{loi}</ErrorText></div>
        {!data && !error && <p className="p-6 text-sm text-muted">Đang tải...</p>}
        {error && <p className="p-6 text-sm text-brand-text">Không tải được danh sách voucher.</p>}
        {data && !ds.length && <p className="p-6 text-sm text-muted">{data.items.length ? 'Không có voucher khớp bộ lọc.' : 'Chưa có voucher nào. Bấm "Tạo voucher" để bắt đầu.'}</p>}
        {!!ds.length && (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[0.8125rem]">
              <thead className="bg-page text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Mã voucher</th>
                  <th className="px-4 py-3">Mức giảm</th>
                  <th className="px-4 py-3">Áp dụng cho</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Đã dùng / Giới hạn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ds.map((v) => (
                  <tr key={v.id} className="align-middle">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-md bg-fill px-2 py-1 font-mono text-[0.8125rem] font-bold">{v.code}</span>
                        <button type="button" onClick={() => void chep(v.code)} aria-label={`Sao chép mã ${v.code}`} title="Sao chép" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-fill">
                          {daChep === v.code ? <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-green-ink"><path d="m5 12 5 5L20 7" /></svg> : <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-text">{v.label}</td>
                    <td className="px-4 py-3">
                      <span className="block max-w-64 truncate font-semibold" title={v.tourName ?? v.categoryName ?? undefined}>{v.scope === 'ALL' ? 'Mọi tour' : v.scope === 'CATEGORY' ? `Mọi tour ${v.categoryName}` : v.tourName}</span>
                      <span className="text-xs text-muted">{PHAM_VI[v.scope]}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-body">{ngay(v.startsAt)}<br />{ngay(v.endsAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{v.used}</span><span className="text-muted"> / {v.maxUses ?? 'Không giới hạn'}</span>
                      {v.maxUses !== null && <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-fill"><span className="block h-full rounded-full bg-brand-button" style={{ width: `${Math.min(100, (v.used / v.maxUses) * 100)}%` }} /></span>}
                    </td>
                    <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TRANG_THAI[v.status].className}`}>{TRANG_THAI[v.status].label}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" onClick={() => setSua(v)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold hover:bg-fill">Sửa</button>
                      <button type="button" onClick={() => void khoa(v)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-body hover:bg-fill">{v.isActive ? 'Tạm khoá' : 'Mở lại'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {sua && <VoucherDrawer voucher={sua === 'new' ? null : sua} onClose={() => setSua(null)} onDone={() => void mutate()} />}
    </main>
  );
}

function VoucherDrawer({ voucher, onClose, onDone }: { voucher: Voucher | null; onClose: () => void; onDone: () => void }) {
  const homNay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [f, setF] = useState({
    code: voucher?.code ?? '',
    type: voucher?.type ?? ('AMOUNT' as Voucher['type']),
    value: voucher ? String(voucher.value) : '',
    maxDiscount: voucher?.maxDiscount ? String(voucher.maxDiscount) : '',
    scope: voucher?.scope ?? ('ALL' as Voucher['scope']),
    tourKey: voucher?.tourKey ?? '',
    tourName: voucher?.tourName ?? '',
    categoryId: voucher?.categoryId ? String(voucher.categoryId) : '',
    startsOn: voucher ? oNgay(voucher.startsAt) : homNay,
    endsOn: voucher ? oNgay(voucher.endsAt) : '',
    maxUses: voucher?.maxUses ? String(voucher.maxUses) : '',
    note: voucher?.note ?? '',
  });
  const [timTour, setTimTour] = useState('');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const doi = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const { data: places } = useSWR<Place[]>(f.scope === 'CATEGORY' ? '/tours/places' : null, fetcher);
  const { data: tours } = useSWR<CatalogTour[]>(f.scope === 'TOUR' && timTour.trim().length >= 2 ? `/tours?search=${encodeURIComponent(timTour.trim())}` : null, fetcher);
  const maHopLe = /^[A-Z0-9_-]{3,30}$/.test(f.code);

  const luu = async () => {
    setDang(true);
    setLoi('');
    const body = {
      code: f.code,
      type: f.type,
      value: f.type === 'AMOUNT' ? soTien(f.value) : Number(f.value),
      ...(f.type === 'PERCENT' && soTien(f.maxDiscount) ? { maxDiscount: soTien(f.maxDiscount) } : {}),
      scope: f.scope,
      ...(f.scope === 'TOUR' ? { tourKey: f.tourKey } : {}),
      ...(f.scope === 'CATEGORY' ? { categoryId: Number(f.categoryId) } : {}),
      startsOn: f.startsOn,
      endsOn: f.endsOn,
      ...(Number(f.maxUses) ? { maxUses: Number(f.maxUses) } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
    };
    try {
      if (voucher) await patch(`/vouchers/${voucher.id}`, body);
      else await post('/vouchers', body);
      onDone();
      onClose();
    } catch (e) {
      setLoi(loiCua(e));
      setDang(false);
    }
  };

  const nhan = 'mb-1.5 block text-sm font-medium';
  return (
    <Modal
      sheet
      width={440}
      title={voucher ? 'Sửa voucher' : 'Tạo voucher mới'}
      subtitle="Mã giảm giá cho khách đặt tour"
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-field bg-surface px-4 text-sm font-semibold hover:bg-fill">Huỷ</button>
          <button type="button" disabled={dang} onClick={() => void luu()} className={`${primaryClass} inline-flex items-center gap-2`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 5 5L20 7" /></svg>
            {dang ? 'Đang lưu...' : 'Lưu voucher'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="v-ma" className={nhan}>Mã voucher <span className="text-brand">*</span></label>
          <div className="relative">
            <input
              id="v-ma"
              value={f.code}
              onChange={(e) => doi('code', e.target.value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/\s+/g, ''))}
              maxLength={30}
              spellCheck={false}
              className={`${inputClass} pr-10 font-mono font-bold tracking-wider`}
            />
            {maHopLe && <svg aria-label="Mã hợp lệ" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="absolute right-3 top-1/2 -translate-y-1/2 text-green-ink"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>}
          </div>
          <p className="mt-1 text-xs text-muted">Tự viết hoa, không dấu, ví dụ TET2027, BTTFIT</p>
        </div>

        <fieldset>
          <legend className={nhan}>Kiểu giảm giá</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-fill p-1">
            {([['AMOUNT', 'Theo số tiền'], ['PERCENT', 'Theo phần trăm']] as const).map(([k, ten]) => (
              <label key={k} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold ${f.type === k ? 'bg-brand-button text-white' : 'text-body'}`}>
                <input type="radio" name="kieu-giam" className="sr-only" checked={f.type === k} onChange={() => { doi('type', k); doi('value', ''); }} />
                <span aria-hidden="true" className={`size-2 rounded-full ${f.type === k ? 'bg-white' : 'border border-muted'}`} />
                {ten}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={f.type === 'PERCENT' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label htmlFor="v-gia-tri" className={nhan}>Giá trị giảm <span className="text-brand">*</span></label>
            <div className="relative">
              <input
                id="v-gia-tri"
                inputMode="numeric"
                value={f.type === 'AMOUNT' ? hienSo(soTien(f.value)) : f.value}
                onChange={(e) => doi('value', f.type === 'AMOUNT' ? String(soTien(e.target.value)) : e.target.value.replace(/\D/g, '').slice(0, 3))}
                className={`${inputClass} pr-12 font-semibold`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">{f.type === 'AMOUNT' ? 'VNĐ' : '%'}</span>
            </div>
          </div>
          {f.type === 'PERCENT' && (
            <div>
              <label htmlFor="v-toi-da" className={nhan}>Giảm tối đa (đ)</label>
              <input id="v-toi-da" inputMode="numeric" value={hienSo(soTien(f.maxDiscount))} onChange={(e) => doi('maxDiscount', String(soTien(e.target.value)))} placeholder="Không giới hạn" className={`${inputClass} font-semibold`} />
            </div>
          )}
        </div>

        <fieldset>
          <legend className={nhan}>Phạm vi áp dụng</legend>
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-page p-3">
            {([['TOUR', 'Một tour'], ['CATEGORY', 'Một địa điểm'], ['ALL', 'Mọi tour']] as const).map(([k, ten]) => (
              <div key={k}>
                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
                  <input type="radio" name="pham-vi" checked={f.scope === k} onChange={() => doi('scope', k)} className="size-4 accent-[var(--color-brand)]" />
                  <span className={f.scope === k ? 'font-semibold' : ''}>{ten}</span>
                </label>
                {k === 'TOUR' && f.scope === 'TOUR' && (
                  <div className="mb-2 ml-6 flex flex-col gap-1.5">
                    {f.tourKey && <p className="rounded-lg bg-surface px-3 py-2 text-[0.8125rem] font-semibold ring-1 ring-brand">{f.tourName}</p>}
                    <input value={timTour} onChange={(e) => setTimTour(e.target.value)} placeholder="Tìm tên tour hoặc mã đợt" aria-label="Tìm tour áp dụng" className={inputClass} />
                    {tours && (
                      <ul className="max-h-48 overflow-y-auto rounded-lg border border-line bg-surface">
                        {!tours.length && <li className="px-3 py-2 text-xs text-muted">Không có tour khớp</li>}
                        {tours.map((t) => (
                          <li key={t.key}>
                            <button type="button" onClick={() => { doi('tourKey', t.key); doi('tourName', t.name); setTimTour(''); }} className="min-h-10 w-full px-3 py-1.5 text-left text-[0.8125rem] hover:bg-fill">
                              {t.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {k === 'CATEGORY' && f.scope === 'CATEGORY' && (
                  <div className="mb-2 ml-6"><select value={f.categoryId} onChange={(e) => doi('categoryId', e.target.value)} aria-label="Địa điểm áp dụng" className={inputClass}>
                    <option value="">{places ? 'Chọn địa điểm' : 'Đang tải...'}</option>
                    {places?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.tours} tour)</option>)}
                  </select></div>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="v-tu" className={nhan}>Ngày bắt đầu <span className="text-brand">*</span></label>
            <input id="v-tu" type="date" value={f.startsOn} onChange={(e) => doi('startsOn', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="v-den" className={nhan}>Ngày kết thúc <span className="text-brand">*</span></label>
            <input id="v-den" type="date" value={f.endsOn} min={f.startsOn} onChange={(e) => doi('endsOn', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="v-luot" className={nhan}>Số lần dùng tối đa</label>
          <div className="relative">
            <input id="v-luot" inputMode="numeric" value={f.maxUses} onChange={(e) => doi('maxUses', e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Không giới hạn" className={`${inputClass} pr-12`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">lượt</span>
          </div>
        </div>

        <div>
          <label htmlFor="v-ghi-chu" className={nhan}>Ghi chú nội bộ</label>
          <textarea id="v-ghi-chu" rows={3} maxLength={500} value={f.note} onChange={(e) => doi('note', e.target.value)} className="w-full resize-y rounded-[10px] border border-field bg-surface px-3 py-2.5 text-sm" />
        </div>
        <ErrorText>{loi}</ErrorText>
      </div>
    </Modal>
  );
}
