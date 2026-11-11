import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { del, fetcher, loiCua, post } from '@/lib/api';
import { vnd } from '@/lib/labels';
import type { CatalogTour, Conversation, Message, Place, TourTag } from '@/lib/types';
import { ErrorText, inputClass, Modal, primaryClass } from '../ui';

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const ngayGio = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};
const ngay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function nguoiGui(m: { senderType: Message['senderType']; staffLabel: string | null }) {
  if (m.senderType === 'CUSTOMER') return 'Khách';
  if (m.senderType === 'STAFF') return m.staffLabel ?? 'Nhân viên';
  if (m.senderType === 'BOT') return 'Bot';
  return 'Tự động';
}

/** Cuộn khung chat tới một tin và làm nổi bật (MessageList nghe sự kiện này). */
export function xemTinTrongChat(messageId: string) {
  window.dispatchEvent(new CustomEvent('btt:xem-tin', { detail: messageId }));
}

/** Các cụm tên tour đủ đặc trưng để gợi ý tin có nhắc tới tour: "Du Lịch Trung Quốc: Ô Trấn - Hàng Châu" -> ô trấn, hàng châu, trung quốc. */
function cumTenTour(name: string) {
  return boDau(name)
    .replace(/^du lich\s*/, '')
    .split(/[:\-–,]/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);
}

export function TourTagsTab({ conv, readOnly, onJump }: { conv: Conversation; readOnly: boolean; onJump: (messageId: string) => void }) {
  const key = `/conversations/${conv.id}/tour-tags`;
  const { data, error, mutate } = useSWR<TourTag[]>(key, fetcher);
  const [mo, setMo] = useState(false);
  const [hoiGo, setHoiGo] = useState<string | null>(null);
  const [loi, setLoi] = useState('');
  const soLan = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data ?? []) m.set(t.tourKey, (m.get(t.tourKey) ?? 0) + 1);
    return m;
  }, [data]);

  const go = async (t: TourTag) => {
    if (hoiGo !== t.id) {
      setHoiGo(t.id);
      return;
    }
    setLoi('');
    try {
      await del(`${key}/${t.id}`);
      setHoiGo(null);
      await mutate();
    } catch (e) {
      setLoi(loiCua(e));
    }
  };

  return (
    <section aria-labelledby="tour-quan-tam" className="flex flex-col gap-4">
      {!readOnly && (
        <button type="button" onClick={() => setMo(true)} className={`${primaryClass} inline-flex w-full items-center justify-center gap-2`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
          Gắn tour quan tâm
        </button>
      )}
      <div className="flex items-baseline justify-between">
        <h2 id="tour-quan-tam" className="text-xs font-bold uppercase tracking-wide text-body">Lịch sử quan tâm tour</h2>
        <span className="text-xs text-muted">Mới nhất ở trên</span>
      </div>
      <ErrorText>{loi}</ErrorText>
      {!data && !error && <p className="text-[0.8125rem] text-muted">Đang tải...</p>}
      {error && <p className="text-[0.8125rem] text-brand-text">Không tải được danh sách tour quan tâm.</p>}
      {data && !data.length && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center">
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z" /></svg>
          <p className="text-[0.8125rem] text-muted">Chưa gắn tour nào. Gắn tour khách quan tâm để Digital theo dõi.</p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {data?.map((t, i) => {
          const nhieuLan = (soLan.get(t.tourKey) ?? 0) > 1;
          const moiNhat = data.findIndex((x) => x.tourKey === t.tourKey) === i;
          return (
            <li key={t.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
              <h3 className="line-clamp-2 text-sm font-semibold">{t.tourName}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {t.categoryName && <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-semibold text-body">{t.categoryName}</span>}
                {nhieuLan && (
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${moiNhat ? 'border-amber-line bg-amber-soft text-amber-ink' : 'border-line bg-fill text-body'}`}>
                    Lần {t.time} · {ngay(t.createdAt)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">Gắn bởi {t.createdBy?.fullName ?? 'nhân viên đã nghỉ'} · {ngayGio(t.createdAt)}</p>
              <div className="mt-2 rounded-lg border-l-[3px] border-brand bg-page px-3 py-2">
                <p className="text-xs text-muted">Tin nhắn đã ghim · {ngayGio(t.message.createdAt)}</p>
                <p className="mt-0.5 line-clamp-3 break-words text-[0.8125rem]">
                  <strong className="font-semibold">{nguoiGui(t.message)}:</strong> “{t.message.text || '(tệp đính kèm)'}”
                </p>
              </div>
              <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                <button type="button" onClick={() => onJump(t.message.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-fill">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                  Xem trong đoạn chat
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => void go(t)} className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold ${hoiGo === t.id ? 'bg-brand-button text-white' : 'border border-line text-body hover:bg-fill'}`}>
                    {hoiGo === t.id ? 'Bấm lần nữa để gỡ' : 'Gỡ nhãn'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {mo && <TagTourDialog conv={conv} tags={data ?? []} onClose={() => setMo(false)} onDone={() => void mutate()} />}
    </section>
  );
}

function AnhTour({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg bg-fill object-cover" />
  ) : (
    <span aria-hidden="true" className="size-14 shrink-0 rounded-lg bg-fill" />
  );
}

const thoiLuong = (t: CatalogTour) => (t.days ? `${t.days}N${t.nights ?? Math.max(0, t.days - 1)}Đ` : null);

/**
 * Hộp "Gắn tour quan tâm": bước 1 chọn tour từ danh mục website, bước 2 ghim đúng một tin làm bằng chứng.
 * Mở từ icon ghim trên một tin (`ghimSan`) thì tin đã chọn sẵn, chỉ còn bước chọn tour.
 */
export function TagTourDialog({ conv, tags, onClose, onDone, ghimSan }: { conv: Conversation; tags: TourTag[]; onClose: () => void; onDone: () => void; ghimSan?: Message }) {
  const [buoc, setBuoc] = useState<1 | 2>(1);
  const [noi, setNoi] = useState<number | null>(null);
  const [go, setGo] = useState('');
  const [tim, setTim] = useState('');
  const [tour, setTour] = useState<CatalogTour | null>(null);
  const [tin, setTin] = useState<string | null>(ghimSan?.id ?? null);
  const [timTin, setTimTin] = useState('');
  const [viTri, setViTri] = useState(0);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const khung = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTim(go.trim()), 300);
    return () => clearTimeout(t);
  }, [go]);

  const { data: places } = useSWR<Place[]>('/tours/places', fetcher);
  const q = new URLSearchParams({ ...(tim ? { search: tim } : {}), ...(noi !== null ? { categoryId: String(noi) } : {}) }).toString();
  const { data: tours, error: loiTour } = useSWR<CatalogTour[]>(`/tours?${q}`, fetcher, { keepPreviousData: true });
  const { data: msgs, error: loiTin } = useSWR<{ items: Message[] }>(buoc === 2 ? `/conversations/${conv.id}/messages?take=200` : null, fetcher);

  const daGan = (key: string) => tags.filter((t) => t.tourKey === key).length;
  const dsTin = useMemo(() => (msgs?.items ?? []).filter((m) => !m.internal && (m.text || m.attachment)).reverse(), [msgs]);
  const cum = useMemo(() => (tour ? cumTenTour(tour.name) : []), [tour]);
  const khop = useMemo(() => {
    const t = boDau(timTin.trim());
    return t ? dsTin.filter((m) => boDau(m.text).includes(t)).map((m) => m.id) : [];
  }, [dsTin, timTin]);

  useEffect(() => setViTri(0), [timTin]);
  useEffect(() => {
    const id = khop[viTri];
    if (id) khung.current?.querySelector(`[data-tin="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [khop, viTri]);

  const toDam = (text: string) => {
    const t = timTin.trim();
    if (!t) return text;
    const goc = boDau(text);
    const can = boDau(t);
    const out: ReactNode[] = [];
    let i = 0;
    for (let j = goc.indexOf(can); j !== -1; j = goc.indexOf(can, i)) {
      out.push(text.slice(i, j), <mark key={j} className="rounded bg-amber-soft px-0.5 font-semibold text-ink">{text.slice(j, j + t.length)}</mark>);
      i = j + t.length;
    }
    out.push(text.slice(i));
    return out;
  };

  const gan = async () => {
    if (!tour || !tin) return;
    setDang(true);
    setLoi('');
    try {
      await post(`/conversations/${conv.id}/tour-tags`, { tourKey: tour.key, messageId: tin });
      onDone();
      onClose();
    } catch (e) {
      setLoi(loiCua(e));
      setDang(false);
    }
  };

  const thanhBuoc = ghimSan ? (
    <div className="border-b border-line px-6 py-3 max-sm:px-4">
      <div className="flex gap-2 rounded-lg border-l-[3px] border-brand bg-page px-3 py-2">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-brand"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z" /></svg>
        <p className="min-w-0 text-[0.8125rem]">
          <span className="text-xs text-muted">Ghim tin · {nguoiGui(ghimSan)} · {ngayGio(ghimSan.createdAt)}</span>
          <span className="line-clamp-2 break-words">“{ghimSan.text || ghimSan.attachment?.name || 'tệp đính kèm'}”</span>
        </p>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center gap-3 border-b border-line px-6 py-3 text-sm max-sm:px-4">
      <span className={`flex items-center gap-2 ${buoc === 1 ? 'font-semibold text-brand-text' : 'text-body'}`}>
        <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${buoc === 1 ? 'bg-brand text-white' : 'border-2 border-green-ink text-green-ink'}`}>{buoc === 1 ? '1' : '✓'}</span>
        Chọn tour
      </span>
      <span aria-hidden="true" className={`h-0.5 w-10 rounded sm:w-24 ${buoc === 2 ? 'bg-brand-soft' : 'bg-line'}`} />
      <span className={`flex items-center gap-2 ${buoc === 2 ? 'font-semibold text-brand-text' : 'text-muted'}`}>
        <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${buoc === 2 ? 'bg-brand text-white' : 'bg-fill text-muted'}`}>2</span>
        Ghim tin nhắn làm bằng chứng
      </span>
    </div>
  );

  return (
    <Modal
      title="Gắn tour quan tâm cho khách"
      onClose={onClose}
      width={640}
      top={thanhBuoc}
      footer={
        <>
          {buoc === 2 && (
            <button type="button" onClick={() => setBuoc(1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold text-body hover:bg-fill">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
              Quay lại
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] px-4 text-sm font-semibold text-body hover:bg-fill">Huỷ</button>
          {buoc === 1 && !ghimSan ? (
            <button type="button" disabled={!tour} onClick={() => { setBuoc(2); setTin(null); }} className={primaryClass}>Tiếp tục</button>
          ) : (
            <button type="button" disabled={!tin || dang} onClick={() => void gan()} className={`${primaryClass} inline-flex items-center gap-2`}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>
              {dang ? 'Đang gắn...' : 'Gắn nhãn'}
            </button>
          )}
        </>
      }
    >
      {buoc === 1 ? (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Lọc theo địa điểm" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[{ id: null as number | null, name: 'Tất cả' }, ...(places ?? [])].map((p) => (
              <button
                key={p.id ?? 'all'}
                type="button"
                aria-pressed={noi === p.id}
                onClick={() => setNoi(p.id)}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-[0.8125rem] font-semibold ${noi === p.id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:bg-fill'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <input value={go} onChange={(e) => setGo(e.target.value)} placeholder="Nhập tên tour hoặc mã tour, ví dụ: Ô Trấn, A06.FIT.CN.250127" aria-label="Tìm tour theo tên hoặc mã" className={inputClass} autoFocus />
          {!tours && !loiTour && <p className="text-sm text-muted">Đang tải danh mục tour...</p>}
          {loiTour && <p className="text-sm text-brand-text">{loiCua(loiTour)}</p>}
          {tours && !tours.length && <p className="text-sm text-muted">Không có tour khớp.</p>}
          <ul className="flex flex-col gap-2">
            {tours?.map((t) => {
              const n = daGan(t.key);
              const chon = tour?.key === t.key;
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    aria-pressed={chon}
                    onClick={() => setTour(t)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left ${chon ? 'border-brand bg-brand-faint' : 'border-line hover:bg-fill'}`}
                  >
                    <AnhTour src={t.image} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold">{t.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[thoiLuong(t), t.price ? `từ ${vnd(t.price)}` : null, t.matchedDay ? `mã ${t.matchedDay.code}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {t.place && <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-semibold text-body">{t.place.name}</span>}
                      {n > 0 && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber-ink">Đã gắn {n} lần</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        tour && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-page p-3">
              <AnhTour src={tour.image} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {tour.place && <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-semibold uppercase text-body">{tour.place.name}</span>}
                  <span className="text-sm font-semibold">{tour.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {thoiLuong(tour)}
                  {tour.price ? <> · <strong className="text-brand-text">từ {vnd(tour.price)}</strong></> : null}
                </p>
              </div>
              {daGan(tour.key) > 0 && (
                <span className="shrink-0 rounded-md border border-amber-line bg-amber-soft px-2 py-1 text-xs font-semibold text-amber-ink max-sm:hidden">
                  Đã gắn {daGan(tour.key)} lần trong hội thoại này
                </span>
              )}
            </div>
            <p className="text-sm text-body">Chọn đúng một tin nhắn trong đoạn chat làm bằng chứng khách quan tâm tour này.</p>
            <div className="flex items-center gap-2 rounded-[10px] border border-field bg-surface pl-3">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={timTin} onChange={(e) => setTimTin(e.target.value)} placeholder="Tìm trong đoạn chat này" aria-label="Tìm trong đoạn chat" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
              {timTin.trim() && (
                <span className="flex shrink-0 items-center border-l border-line pl-2 text-xs font-semibold text-body">
                  {khop.length ? `${viTri + 1} / ${khop.length} kết quả` : '0 kết quả'}
                  <button type="button" aria-label="Kết quả trước" disabled={!khop.length} onClick={() => setViTri((v) => (v - 1 + khop.length) % khop.length)} className="grid size-11 place-items-center rounded-lg hover:bg-fill disabled:opacity-40">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
                  </button>
                  <button type="button" aria-label="Kết quả sau" disabled={!khop.length} onClick={() => setViTri((v) => (v + 1) % khop.length)} className="grid size-11 place-items-center rounded-lg hover:bg-fill disabled:opacity-40">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </span>
              )}
            </div>
            {!msgs && !loiTin && <p className="text-sm text-muted">Đang tải tin nhắn...</p>}
            {loiTin && <p className="text-sm text-brand-text">Không tải được tin nhắn.</p>}
            {msgs && !dsTin.length && <p className="text-sm text-muted">Hội thoại chưa có tin nào để ghim.</p>}
            <ul ref={khung} role="radiogroup" aria-label="Chọn tin làm bằng chứng" className="flex max-h-[46dvh] flex-col gap-2 overflow-y-auto rounded-xl border border-line p-2 max-sm:max-h-none">
              {dsTin.map((m) => {
                const chon = tin === m.id;
                const goiY = !chon && m.senderType === 'STAFF' && cum.some((c) => boDau(m.text).includes(c));
                const dangXem = khop[viTri] === m.id;
                return (
                  <li key={m.id} data-tin={m.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={chon}
                      onClick={() => setTin(m.id)}
                      className={`flex w-full gap-3 rounded-xl border-2 p-3 text-left ${chon ? 'border-brand bg-brand-faint' : goiY ? 'border-transparent bg-blue-soft/50' : 'border-line hover:bg-fill'} ${dangXem && !chon ? 'ring-2 ring-amber-line' : ''}`}
                    >
                      <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${chon ? 'border-brand' : 'border-field'}`}>
                        {chon && <span className="size-2.5 rounded-full bg-brand" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <strong className={`font-semibold ${chon ? 'text-brand-text' : 'text-body'}`}>{nguoiGui(m)} · {ngayGio(m.createdAt)}</strong>
                          <span className="flex-1" />
                          {chon && <span className="rounded border border-brand-soft bg-surface px-1.5 py-0.5 font-semibold text-brand-text">Đang chọn làm bằng chứng</span>}
                          {goiY && <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-body">Gợi ý: có tên tour</span>}
                        </span>
                        <span className="mt-1 block whitespace-pre-wrap break-words text-sm">{m.text ? toDam(m.text) : `(${m.attachment?.name ?? 'tệp đính kèm'})`}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}
      <div className="mt-3">
        <ErrorText>{loi}</ErrorText>
      </div>
    </Modal>
  );
}

