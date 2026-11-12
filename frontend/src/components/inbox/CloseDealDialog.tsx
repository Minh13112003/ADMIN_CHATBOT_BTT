import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { ApiError, fetcher, loiCua, post } from '@/lib/api';
import { CHANNEL, DEAL_STATUS, vnd } from '@/lib/labels';
import type { CatalogTour, Conversation, Deal, Quote, TourDay, TourDetail } from '@/lib/types';
import { ErrorText, inputClass, Modal, primaryClass, UnderlineTabs } from '../ui';
import { SoDienThoaiDialog } from './SoDienThoai';

const ngay = (s: string) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const nhanNgay = (d: TourDay) => `${ngay(d.departureDate)} · ${d.code} · ${vnd(d.price)}/người${d.stock !== null ? ` · ${d.stock > 0 ? `còn ${d.stock} chỗ` : 'hết chỗ'}` : ''}`;
const thoiLuong = (t: { days: number | null; nights: number | null }) => (t.days ? `${t.days}N${t.nights ?? Math.max(0, t.days - 1)}Đ` : null);
const conCho = (d: TourDay) => d.available && (d.stock === null || d.stock > 0);

/**
 * Chốt tour (thay hộp cũ, theo Stitch "Chốt tour & Đặt cọc"). Sale chỉ chọn tour, ngày khởi hành, số khách, voucher;
 * giá theo ngày khởi hành và số tiền cuối do backend tính (/tours/quote, rồi tính lại khi chốt).
 * Tab "Theo mã đơn" xác nhận đúng đơn khách đã đặt qua chatbot, không tạo đơn thứ hai.
 */
function CloseDealForm({
  conv,
  deal,
  pending,
  onClose,
  onDone,
}: {
  conv: Conversation;
  /** Đơn chờ xác nhận được bấm từ thanh "Cần làm" hoặc danh sách đơn: mở thẳng tab Theo mã đơn. */
  deal: Deal | null;
  /** Các đơn chờ xác nhận của hội thoại, để chọn nhanh khi đơn không có mã. */
  pending: Deal[];
  onClose: () => void;
  onDone: (c: Conversation) => unknown;
}) {
  const [tab, setTab] = useState<'tour' | 'order'>(deal || pending.length ? 'order' : 'tour');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);

  // Tab Theo mã tour
  const [go, setGo] = useState('');
  const [tim, setTim] = useState('');
  const [moDs, setMoDs] = useState(false);
  const [tourKey, setTourKey] = useState<string | null>(null);
  const [dayCode, setDayCode] = useState('');

  // Tab Theo mã đơn
  const [maDon, setMaDon] = useState(deal?.orderCode ?? '');
  const [don, setDon] = useState<Deal | null>(deal);
  const [loiDon, setLoiDon] = useState('');
  const [dangTaiDon, setDangTaiDon] = useState(false);

  // Chung
  const [guests, setGuests] = useState(deal?.guests ?? 1);
  const [voucherGo, setVoucherGo] = useState('');
  const [voucher, setVoucher] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTim(go.trim()), 300);
    return () => clearTimeout(t);
  }, [go]);

  const { data: ketQua } = useSWR<CatalogTour[]>(tab === 'tour' && moDs && tim ? `/tours?search=${encodeURIComponent(tim)}` : null, fetcher);
  // Đơn chatbot: tìm tour theo mã đợt trong đơn để có ảnh, các ngày khởi hành.
  const { data: theoMa, error: loiTheoMa } = useSWR<{ tour: TourDetail; day: TourDay }>(tab === 'order' && don?.tourCode ? `/tours/by-code/${encodeURIComponent(don.tourCode)}` : null, fetcher, { shouldRetryOnError: false });
  const keyChiTiet = tab === 'tour' ? tourKey : (theoMa?.tour.key ?? null);
  const { data: tour, error: loiTour } = useSWR<TourDetail>(keyChiTiet ? `/tours/${keyChiTiet}` : null, fetcher);

  useEffect(() => {
    if (tab === 'order' && don) setDayCode(don.tourCode ?? '');
  }, [tab, don]);

  // Đơn có sẵn mã thì tải ngay để sale khỏi gõ lại.
  const daTai = useRef(false);
  useEffect(() => {
    if (daTai.current) return;
    daTai.current = true;
    const dau = deal ?? (pending.length === 1 ? pending[0] : null);
    if (dau) chonDon(dau);
  }, []);

  function chonDon(d: Deal) {
    setDon(d);
    setMaDon(d.orderCode ?? '');
    setGuests(d.guests);
    setLoiDon('');
  }

  const taiDon = async () => {
    const ma = maDon.trim();
    if (!ma) return;
    setDangTaiDon(true);
    setLoiDon('');
    try {
      chonDon(await fetcher<Deal>(`/conversations/${conv.id}/deals/by-order/${encodeURIComponent(ma)}`));
    } catch (e) {
      setDon(null);
      setLoiDon(e instanceof ApiError && e.status === 404 ? 'Không tìm thấy đơn có mã này trong hội thoại' : loiCua(e));
    } finally {
      setDangTaiDon(false);
    }
  };

  const chonTour = (t: CatalogTour) => {
    setTourKey(t.key);
    setGo(t.name);
    setMoDs(false);
    setDayCode(t.matchedDay?.code ?? '');
  };

  // Chọn ngày gần nhất còn chỗ khi vừa chọn tour.
  useEffect(() => {
    if (tab === 'tour' && tour && !dayCode) {
      const dau = tour.tourDays.find(conCho) ?? tour.tourDays[0];
      if (dau) setDayCode(dau.code);
    }
  }, [tab, tour, dayCode]);

  const dangDon = tab === 'order';
  const ngayChon = tour?.tourDays.find((d) => d.code === dayCode) ?? null;
  const toiDa = ngayChon?.stock ?? null;
  const duThongTin = !!dayCode && guests >= 1 && (dangDon ? !!don && don.status === 'PENDING' : !!tourKey);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loiQuote, setLoiQuote] = useState('');
  useEffect(() => {
    if (!duThongTin) {
      setQuote(null);
      setLoiQuote('');
      return;
    }
    let bo = false;
    const t = setTimeout(() => {
      post<Quote>('/tours/quote', {
        dayCode,
        guests,
        ...(dangDon ? (theoMa ? { tourKey: theoMa.tour.key } : {}) : { tourKey }),
        ...(dangDon && don ? { dealId: don.id } : {}),
        ...(voucher ? { voucherCode: voucher } : {}),
      })
        .then((q) => !bo && (setQuote(q), setLoiQuote('')))
        .catch((e) => !bo && (setQuote(null), setLoiQuote(loiCua(e))));
    }, 250);
    return () => {
      bo = true;
      clearTimeout(t);
    };
  }, [duThongTin, dayCode, guests, voucher, tourKey, dangDon, don, theoMa]);

  const doiTab = (t: 'tour' | 'order') => {
    setTab(t);
    setDayCode(t === 'order' ? (don?.tourCode ?? '') : '');
    setGuests(t === 'order' && don ? don.guests : 1);
    setLoi('');
  };

  const chot = async () => {
    if (!quote || quote.voucherError) return;
    setDang(true);
    setLoi('');
    try {
      await onDone(
        await post<Conversation>(`/conversations/${conv.id}/close`, {
          dayCode,
          guests,
          ...(quote.tourKey ? { tourKey: quote.tourKey } : {}),
          ...(dangDon && don ? { dealId: don.id } : {}),
          ...(quote.voucher ? { voucherCode: quote.voucher.code } : {}),
        }),
      );
      onClose();
    } catch (e) {
      setLoi(loiCua(e));
      setDang(false);
    }
  };

  const theTour = (t: { image: string | null; name: string; place: { name: string } | null; days: number | null; nights: number | null } | null, tenDuPhong?: string) => (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-page p-2">
      {t?.image ? <img src={t.image} alt="" className="h-11 w-16 shrink-0 rounded-lg bg-fill object-cover" /> : <span aria-hidden="true" className="h-11 w-16 shrink-0 rounded-lg bg-fill" />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{t?.name ?? tenDuPhong}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
          {t?.place && <span className="font-semibold text-brand-text">{t.place.name}</span>}
          {t && thoiLuong(t) && <span className="rounded bg-fill px-1.5 py-0.5 font-semibold text-body">{thoiLuong(t)}</span>}
        </p>
      </div>
    </div>
  );

  const oNgay = (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium">
        <label htmlFor="ngay-khoi-hanh">Ngày khởi hành &amp; mã đợt <span className="text-brand">*</span></label>
        <span className="text-xs font-normal text-muted">Giá tự lấy theo ngày, không sửa được</span>
      </div>
      {tour ? (
        <select id="ngay-khoi-hanh" value={dayCode} onChange={(e) => setDayCode(e.target.value)} className={inputClass}>
          {!tour.tourDays.some((d) => d.code === dayCode) && <option value={dayCode}>{dayCode ? `${dayCode} (không còn trên website)` : 'Chọn ngày khởi hành'}</option>}
          {tour.tourDays.map((d) => (
            <option key={d.code} value={d.code} disabled={!conCho(d) && d.code !== dayCode}>
              {nhanNgay(d)}
            </option>
          ))}
        </select>
      ) : (
        <select id="ngay-khoi-hanh" disabled className={inputClass} value={dayCode}>
          <option value={dayCode}>{dayCode || (dangDon ? 'Tải đơn trước' : 'Chọn tour trước')}</option>
        </select>
      )}
    </div>
  );

  const oSoKhach = (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-sm font-medium">
        <span id="so-khach">Số khách <span className="text-brand">*</span></span>
        {toiDa !== null && <span className="text-xs font-normal text-muted">(tối đa {toiDa})</span>}
      </div>
      <div className="flex items-center gap-3">
        <div role="group" aria-labelledby="so-khach" className="flex items-center rounded-[10px] border border-field bg-surface">
          <button type="button" aria-label="Bớt một khách" disabled={guests <= 1} onClick={() => setGuests((g) => Math.max(1, g - 1))} className="grid size-11 place-items-center text-lg disabled:opacity-40">−</button>
          <input
            aria-label="Số khách"
            inputMode="numeric"
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Math.min(1000, Number(e.target.value.replace(/\D/g, '')) || 1)))}
            className="h-11 w-12 border-x border-field text-center text-sm font-semibold"
          />
          <button type="button" aria-label="Thêm một khách" disabled={toiDa !== null && guests >= toiDa} onClick={() => setGuests((g) => g + 1)} className="grid size-11 place-items-center text-lg disabled:opacity-40">+</button>
        </div>
      </div>
    </div>
  );

  const oVoucher = (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="ma-voucher" className="text-sm font-medium">Mã voucher giảm giá</label>
      <div className="flex gap-2">
        <input
          id="ma-voucher"
          value={voucherGo}
          onChange={(e) => setVoucherGo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setVoucher(voucherGo.trim()))}
          placeholder="Không bắt buộc"
          spellCheck={false}
          className={`${inputClass} font-mono ${quote?.voucherError ? 'border-brand' : ''}`}
        />
        <button type="button" disabled={!voucherGo.trim() || !duThongTin} onClick={() => setVoucher(voucherGo.trim())} className="min-h-11 shrink-0 rounded-[10px] bg-ink px-4 text-sm font-semibold text-surface disabled:opacity-50">
          Áp dụng
        </button>
      </div>
      {quote?.voucher && (
        <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg border border-green-ink/30 bg-green-soft px-2 py-1 text-xs font-semibold text-green-ink" title={`Voucher ${quote.voucher.code}: ${quote.voucher.label}, giảm một lần trên tổng đơn`}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0"><path d="m5 12 5 5L20 7" /></svg>
          <span className="truncate">{quote.voucher.label} · giảm {vnd(quote.discount)}</span>
          <button type="button" aria-label="Bỏ voucher" onClick={() => { setVoucher(''); setVoucherGo(''); }} className="-my-1 -mr-1 grid size-7 shrink-0 place-items-center rounded hover:bg-green-ink/10">×</button>
        </span>
      )}
      {quote?.voucherError && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-alert-line bg-brand-faint px-2.5 py-1.5 text-xs font-medium text-brand-text">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          {quote.voucherError}
        </p>
      )}
    </div>
  );

  // Số khách và voucher cùng một hàng cho hộp ngắn lại, không phải cuộn.
  const hangKhachVoucher = (
    <div className="grid items-start gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      {oSoKhach}
      {oVoucher}
    </div>
  );

  const tongTien = (
    <div className="rounded-xl bg-fill px-3.5 py-2.5 text-sm">
      {quote ? (
        <>
          <div className="flex justify-between gap-3 text-body"><span>Giá tour: {vnd(quote.unitPrice)} × {quote.guests} khách</span><span className="whitespace-nowrap font-semibold text-ink">{vnd(quote.subtotal)}</span></div>
          <div className="mt-1 flex justify-between gap-3 text-body">
            <span>Voucher{quote.voucher ? ` (${quote.voucher.code})` : voucher ? ` (${voucher})` : ''}</span>
            <span className={`whitespace-nowrap ${quote.discount ? 'font-semibold text-green-ink' : 'text-muted'}`}>{quote.discount ? `−${vnd(quote.discount)}` : '0 đ'}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <span className="font-semibold">Số tiền cuối cùng</span>
            <span className="whitespace-nowrap text-xl font-bold text-brand-text">{vnd(quote.total)}</span>
          </div>
          {quote.priceFromDeal && <p className="mt-2 text-xs text-amber-ink">Ngày khởi hành không còn trên website, giữ giá/người lúc khách đặt.</p>}
        </>
      ) : (
        <p className="text-muted">{loiQuote || (duThongTin ? 'Đang tính tiền...' : 'Chọn tour, ngày khởi hành và số khách để tính tiền.')}</p>
      )}
    </div>
  );

  return (
    <Modal
      title="Chốt tour"
      onClose={onClose}
      width={600}
      top={
        <UnderlineTabs
          label="Cách chốt tour"
          value={tab}
          onChange={doiTab}
          items={[
            { key: 'tour', label: <><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>Theo mã tour</> },
            { key: 'order', label: <><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>Theo mã đơn</> },
          ]}
        />
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-field bg-surface px-4 text-sm font-semibold hover:bg-fill">Huỷ</button>
          <span className="flex-1" />
          <button type="button" disabled={!quote || !!quote.voucherError || dang} onClick={() => void chot()} className={`${primaryClass} inline-flex items-center gap-2`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
            {dang ? 'Đang lưu...' : dangDon ? 'Xác nhận đơn' : 'Chốt tour'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {tab === 'tour' ? (
          <>
            <div className="relative flex flex-col gap-1">
              <label htmlFor="tim-tour" className="text-sm font-medium">Mã tour / Tên tour <span className="text-brand">*</span></label>
              <div className="relative">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input
                  id="tim-tour"
                  value={go}
                  onChange={(e) => { setGo(e.target.value); setMoDs(true); setTourKey(null); setDayCode(''); }}
                  onFocus={() => setMoDs(true)}
                  placeholder="Nhập mã đợt (A06.FIT.CN.200127.A) hoặc tên tour"
                  autoComplete="off"
                  aria-expanded={moDs && !!tim}
                  aria-controls="ds-tour"
                  className={`${inputClass} pl-10`}
                  autoFocus
                />
              </div>
              {moDs && tim && (
                <ul id="ds-tour" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
                  {!ketQua && <li className="px-3 py-2 text-sm text-muted">Đang tìm...</li>}
                  {ketQua && !ketQua.length && <li className="px-3 py-2 text-sm text-muted">Không có tour khớp trên benthanhtourist.com</li>}
                  {ketQua?.map((t) => (
                    <li key={t.key}>
                      <button type="button" role="option" aria-selected={tourKey === t.key} onClick={() => chonTour(t)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-fill">
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 font-semibold">{t.name}</span>
                          <span className="text-xs text-muted">{[t.place?.name, thoiLuong(t), t.matchedDay ? `mã ${t.matchedDay.code}` : t.price ? `từ ${vnd(t.price)}` : null].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {tourKey && (tour ? theTour(tour) : loiTour ? <p className="text-sm text-brand-text">{loiCua(loiTour)}</p> : <p className="text-sm text-muted">Đang tải tour...</p>)}
            {oNgay}
            {hangKhachVoucher}
            {tongTien}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                <label htmlFor="ma-don">Mã đơn đặt <span className="text-brand">*</span></label>
                {don && <span className="min-w-0 flex-1 truncate text-xs font-normal text-muted">{don.source === 'CHATBOT' ? 'Khách đặt qua bttAI' : 'Sale nhập'} · {CHANNEL[conv.channel].label}</span>}
                {don && <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-semibold ${don.voidedAt ? DEAL_STATUS.CANCELLED.className : DEAL_STATUS[don.status].className}`}>{don.voidedAt ? 'Đã mở lại' : DEAL_STATUS[don.status].label}</span>}
              </div>
              <div className="flex gap-2">
                <input
                  id="ma-don"
                  value={maDon}
                  onChange={(e) => setMaDon(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void taiDon())}
                  placeholder="Ví dụ BTT-2611-0982"
                  spellCheck={false}
                  className={`${inputClass} font-mono ${loiDon ? 'border-brand' : ''}`}
                />
                <button type="button" disabled={!maDon.trim() || dangTaiDon} onClick={() => void taiDon()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] bg-ink px-4 text-sm font-semibold text-surface disabled:opacity-50">
                  {dangTaiDon ? 'Đang tải...' : 'Tải đơn'}
                </button>
              </div>
              {loiDon && <p role="alert" className="text-xs font-medium text-brand-text">{loiDon}</p>}
            </div>
            {!don && pending.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Hoặc chọn đơn chờ xác nhận của khách</p>
                {pending.map((d) => (
                  <button key={d.id} type="button" onClick={() => chonDon(d)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-fill">
                    <span className="min-w-0"><span className="block truncate font-semibold">{d.tourName}</span><span className="text-xs text-muted">{d.tourCode ?? 'Chưa có mã đợt'} · {d.guests} khách · {vnd(d.amount)}</span></span>
                    <span className="shrink-0 text-xs font-semibold text-brand-text">Chọn</span>
                  </button>
                ))}
              </div>
            )}
            {don && don.status !== 'PENDING' && <p className="rounded-lg bg-fill px-3 py-2 text-sm text-body">{don.status === 'CONFIRMED' ? 'Đơn này đã được chốt.' : 'Đơn này đã huỷ.'}</p>}
            {don && don.status === 'PENDING' && (
              <>
                <div className="flex flex-col gap-1">
                  {theoMa ? theTour(theoMa.tour) : theTour(null, don.tourName)}
                  {!don.tourCode && <p className="text-xs text-amber-ink">Đơn chưa có mã đợt khởi hành, không tính được giá. Dùng tab Theo mã tour.</p>}
                  {don.tourCode && loiTheoMa && <p className="text-xs text-muted">Không tìm thấy mã đợt {don.tourCode} trên website, giữ giá/người lúc khách đặt.</p>}
                </div>
                {oNgay}
                {hangKhachVoucher}
                {tongTien}
              </>
            )}
          </>
        )}
        <ErrorText>{loi}</ErrorText>
      </div>
    </Modal>
  );
}

/** Chốt tour bắt buộc có số điện thoại: chưa có thì hỏi số trước, nhập xong form chốt tự mở (dữ liệu hội thoại được làm mới). */
export function CloseDealDialog(props: Parameters<typeof CloseDealForm>[0]) {
  if (!props.conv.customer.phone) {
    return <SoDienThoaiDialog conv={props.conv} lyDo="Cần số điện thoại của khách trước khi chốt tour. Bạn xin số từ khách rồi nhập vào đây." onClose={props.onClose} />;
  }
  return <CloseDealForm {...props} />;
}
