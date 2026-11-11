import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import useSWR from 'swr';
import { fetcher, loiCua, patch, post } from '@/lib/api';
import { BOOKING_STATUS, CHANNEL, DEAL_STATUS, dinhDangSo, gioTin, STATUS, STATUS_LIST, TAGS, vnd } from '@/lib/labels';
import type { Conversation, Deal, Me, Status } from '@/lib/types';
import { chipClass, Dialog, ErrorText, Field, inputClass, primaryClass, secondaryClass } from '../ui';
import { CloseDealDialog } from './CloseDealDialog';
import { TourTagsTab, xemTinTrongChat } from './TourTags';

export function InfoPanel({
  conv,
  deals,
  onChange,
  onClose,
}: {
  conv: Conversation;
  deals: Deal[] | undefined;
  onChange: (c: Conversation) => unknown;
  onClose: () => void;
}) {
  const [note, setNote] = useState(conv.note ?? '');
  const [loi, setLoi] = useState('');
  const [chot, setChot] = useState<{ deal: Deal | null } | null>(null);
  const [huy, setHuy] = useState<Deal | null>(null);
  const [tab, setTab] = useState<'customer' | 'tours' | 'deals'>('customer');
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const { data: tags } = useSWR<unknown[]>(`/conversations/${conv.id}/tour-tags`, fetcher);
  /** Xem tin đã ghim: ở màn hẹp cột thông tin là ngăn kéo che khung chat nên đóng lại trước. */
  const xemTin = (id: string) => {
    if (!window.matchMedia('(min-width: 1280px)').matches) onClose();
    setTimeout(() => xemTinTrongChat(id), 50);
  };

  useEffect(() => setNote(conv.note ?? ''), [conv.id, conv.note]);

  const chay = async (fn: () => Promise<Conversation>) => {
    setLoi('');
    try {
      await onChange(await fn());
    } catch (e) {
      setLoi(loiCua(e));
    }
  };
  const donChoCuaHoiThoai = deals?.find((d) => d.status === 'PENDING' && d.conversationId === conv.id) ?? null;
  const doiTrangThai = (s: Status) => {
    if (s === conv.status) return;
    // Có đơn khách tự đặt đang chờ thì chốt chính đơn đó, không tạo đơn thứ hai.
    if (s === 'CLOSED') setChot({ deal: donChoCuaHoiThoai });
    else void chay(() => post<Conversation>(`/conversations/${conv.id}/status`, { status: s }));
  };

  const xacMinh = conv.customer.phone ? (conv.customer.phoneVerified ? 'Tài khoản app' : 'Chưa xác minh') : 'Chưa có số';

  return (
    <PanelFrame onClose={onClose}>
      <aside id="thong-tin-khach" aria-label="Thông tin khách" className="flex min-w-0 flex-col gap-6">
        <div role="tablist" aria-label="Hồ sơ khách" className="flex rounded-xl bg-fill p-1 text-[0.8125rem]">{([{ key: 'customer', label: 'Khách' }, { key: 'tours', label: 'Tour quan tâm' }, { key: 'deals', label: 'Đơn tour' }] as const).map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={`relative inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-1 font-semibold ${tab === item.key ? 'bg-surface text-brand-text shadow-sm' : 'text-muted'}`} onClick={() => setTab(item.key)}>{item.label}{item.key === 'tours' && !!tags?.length && <span aria-label={`${tags.length} nhãn`} className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-brand px-1 text-[0.625rem] leading-4 text-white">{tags.length}</span>}{item.key === 'deals' && !!deals?.length && <span className="ml-1 text-xs font-medium text-muted">({deals.length})</span>}</button>)}</div>
        {tab === 'customer' && <>
        <div className="rounded-xl bg-fill p-4">
          <h2 className="font-semibold">{conv.customer.name}</h2>
          <p className="mt-1 text-sm text-muted">{dinhDangSo(conv.customer.phone)}</p>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Trạng thái</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_LIST.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={conv.status === s}
                onClick={() => doiTrangThai(s)}
                className={`min-h-11 rounded-[10px] border px-1.5 text-sm font-semibold ${conv.status === s ? `${STATUS[s].className} border-transparent` : 'border-field bg-surface text-neutral-ink hover:bg-fill'}`}
              >
                {STATUS[s].label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <ErrorText>{loi}</ErrorText>
          </div>
        </div>

        <FollowUp conv={conv} onChange={onChange} />
        <div>
          <label htmlFor="ghi-chu" className="mb-2 block text-sm font-semibold">
            Ghi chú nội bộ <span className="font-normal text-muted">(khách không thấy)</span>
          </label>
          <textarea
            id="ghi-chu"
            rows={3}
            placeholder="Ví dụ: khách đi đoàn 4 người, muốn phòng gần nhau"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (conv.note ?? '') && chay(() => patch<Conversation>(`/conversations/${conv.id}`, { note }))}
            className="w-full resize-y rounded-[10px] border border-field px-3 py-2.5 text-sm"
          />
        </div>
        </>}
        {tab === 'deals' && <section aria-labelledby="don-dat-tour">
          <h2 id="don-dat-tour" className="mb-2 text-sm font-semibold">
            Đơn đặt tour
          </h2>
          {!deals && <p className="text-[0.8125rem] text-muted">Đang tải...</p>}
          {deals && !deals.length && <p className="text-[0.8125rem] text-muted">Khách chưa có đơn nào.</p>}
          <ul className="flex flex-col gap-2">
            {deals?.map((d) => (
              <li key={d.id} className="rounded-[10px] border border-line p-2.5 text-[0.8125rem]">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 break-words font-semibold">{d.tourName}</span>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-[10px] px-2 py-0.5 text-xs font-semibold ${d.voidedAt ? DEAL_STATUS.CANCELLED.className : DEAL_STATUS[d.status].className}`}
                  >
                    {d.voidedAt ? 'Đã mở lại' : DEAL_STATUS[d.status].label}
                  </span>
                </div>
                <div className="mt-1 break-words text-body">
                  {d.tourCode ?? 'Chưa có mã tour'} · {d.guests} khách · {vnd(d.amount)}
                </div>
                <div className="text-muted">
                  {CHANNEL[d.channel].label} · {d.source === 'CHATBOT' ? 'Khách tự đặt' : 'Sale nhập'} · {gioTin(d.createdAt)}
                  {d.closedBy && d.status === 'CONFIRMED' ? ` · ${d.closedBy.fullName} chốt` : ''}
                </div>
                {d.bookingStatus && <div className="text-muted">{BOOKING_STATUS[d.bookingStatus] ?? d.bookingStatus}</div>}
                {d.status === 'PENDING' && d.conversationId === conv.id && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" className={`${chipClass} border-brand font-semibold text-brand-text`} onClick={() => setChot({ deal: d })}>
                      Xác nhận chốt
                    </button>
                    <button type="button" className={chipClass} onClick={() => setHuy(d)}>
                      Khách huỷ
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>}

        {tab === 'tours' && <TourTagsTab conv={conv} readOnly={me?.role === 'DIGITAL'} onJump={xemTin} />}
        {tab === 'customer' && <>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Khách hàng</h2>
          <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-sm">
            <dt className="text-muted">Họ tên</dt>
            <dd>{conv.customer.name}</dd>
            <dt className="text-muted">Tên từng dùng</dt>
            <dd>{conv.customer.aliases.length ? conv.customer.aliases.join(', ') : 'Không có'}</dd>
            <dt className="text-muted">Số điện thoại</dt>
            <dd>{dinhDangSo(conv.customer.phone)}</dd>
            <dt className="text-muted">Xác minh SĐT</dt>
            <dd>{xacMinh}</dd>
            <dt className="text-muted">Nguồn</dt>
            <dd>{CHANNEL[conv.channel].label}</dd>
            <dt className="text-muted">Quan tâm</dt>
            <dd>{conv.interest ?? 'Chưa rõ'}</dd>
            <dt className="text-muted">Phụ trách</dt>
            <dd>{conv.assignee?.fullName ?? 'Chưa có, bot đang trả lời'}</dd>
          </dl>
        </div>

        </>}
        {tab === 'customer' && <div>
          <h2 className="mb-2 text-sm font-semibold">Nhãn</h2>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => {
              const on = conv.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    chay(() => patch<Conversation>(`/conversations/${conv.id}`, { tags: on ? conv.tags.filter((x) => x !== t) : [...conv.tags, t] }))
                  }
                  className={`min-h-9 rounded-full border px-2.5 text-[0.8125rem] ${on ? 'border-brand-dark bg-brand-dark text-white' : 'border-field bg-surface text-neutral-ink hover:bg-fill'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>}


        {chot && <CloseDealDialog conv={conv} deal={chot.deal} pending={deals?.filter((d) => d.status === 'PENDING' && d.conversationId === conv.id) ?? []} onClose={() => setChot(null)} onDone={onChange} />}
        {huy && <CancelDealDialog conv={conv} deal={huy} onClose={() => setHuy(null)} onDone={onChange} />}
      </aside>
    </PanelFrame>
  );
}

/** Giờ hẹn mặc định theo giờ máy (giờ Việt Nam), dạng cho ô datetime-local. */
function chuoiGio(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function mocNhanh(): { label: string; at: Date }[] {
  const now = new Date();
  const motGio = new Date(now.getTime() + 3600_000);
  const chieu = new Date(now);
  chieu.setHours(16, 0, 0, 0);
  const sang = new Date(now);
  sang.setDate(sang.getDate() + 1);
  sang.setHours(9, 0, 0, 0);
  return [{ label: 'Sau 1 giờ', at: motGio }, ...(chieu > now ? [{ label: '16:00 hôm nay', at: chieu }] : []), { label: '9:00 ngày mai', at: sang }];
}

function FollowUp({ conv, onChange }: { conv: Conversation; onChange: (c: Conversation) => unknown }) {
  const [mo, setMo] = useState(false);
  const [gio, setGio] = useState('');
  const [note, setNote] = useState('');
  const [loi, setLoi] = useState('');

  const luu = async (at: Date | null) => {
    setLoi('');
    try {
      await onChange(
        await patch<Conversation>(`/conversations/${conv.id}`, at ? { followUpAt: at.toISOString(), followUpNote: note.trim() } : { followUpAt: null }),
      );
      setMo(false);
      setNote('');
      setGio('');
    } catch (e) {
      setLoi(loiCua(e));
    }
  };

  const f = conv.followUp;
  const quaHan = f && new Date(f.at) <= new Date();
  return (
    <section aria-labelledby="hen-nhac">
      <h2 id="hen-nhac" className="mb-2 text-sm font-semibold">
        Hẹn nhắc lại
      </h2>
      {f && !mo && (
        <div className={`rounded-[10px] p-2.5 text-[0.8125rem] ${quaHan ? 'bg-brand-soft text-alert-ink' : 'bg-page'}`}>
          <div className="font-semibold">
            {quaHan ? 'Đến hẹn ' : ''}
            {gioTin(f.at)}
          </div>
          {f.note && <div className="break-words">{f.note}</div>}
          {f.by && <div className="text-muted">{f.by.fullName} hẹn</div>}
          <div className="mt-2 flex gap-1.5">
            <button type="button" className={chipClass} onClick={() => setMo(true)}>
              Đổi giờ
            </button>
            <button type="button" className={chipClass} onClick={() => void luu(null)}>
              Xong, bỏ hẹn
            </button>
          </div>
        </div>
      )}
      {!f && !mo && (
        <button type="button" className={chipClass} onClick={() => setMo(true)}>
          Đặt hẹn
        </button>
      )}
      {mo && (
        <div className="flex flex-col gap-2 rounded-[10px] bg-page p-2.5">
          <input
            aria-label="Việc cần làm khi đến hẹn"
            placeholder="Ví dụ: gọi lại báo giá đoàn"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {mocNhanh().map((m) => (
              <button key={m.label} type="button" className={chipClass} onClick={() => void luu(m.at)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              aria-label="Giờ hẹn khác"
              type="datetime-local"
              value={gio}
              min={chuoiGio(new Date())}
              onChange={(e) => setGio(e.target.value)}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button type="button" className={secondaryClass} disabled={!gio} onClick={() => void luu(new Date(gio))}>
              Lưu
            </button>
          </div>
          <button type="button" className="min-h-9 self-start text-[0.8125rem] underline" onClick={() => setMo(false)}>
            Thôi
          </button>
        </div>
      )}
      <ErrorText>{loi}</ErrorText>
    </section>
  );
}

function CancelDealDialog({ conv, deal, onClose, onDone }: { conv: Conversation; deal: Deal; onClose: () => void; onDone: (c: Conversation) => unknown }) {
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const gui = async (e: FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi('');
    try {
      await onDone(await post<Conversation>(`/conversations/${conv.id}/deals/${deal.id}/cancel`, lyDo.trim() ? { reason: lyDo.trim() } : {}));
      onClose();
    } catch (err) {
      setLoi(loiCua(err));
      setDang(false);
    }
  };
  return (
    <Dialog title="Khách huỷ đơn" onClose={onClose}>
      <form onSubmit={gui} className="flex flex-col gap-3">
        <p className="text-sm text-body">
          Đơn <strong className="font-semibold">{deal.tourName}</strong> sẽ không tính doanh thu. Nếu khách đã có booking bên hệ thống đặt tour, nhớ huỷ cả ở
          đó.
        </p>
        <Field label="Lý do (không bắt buộc)">
          <input
            value={lyDo}
            maxLength={300}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Ví dụ: khách đổi lịch sang năm sau"
            className={inputClass}
          />
        </Field>
        <ErrorText>{loi}</ErrorText>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Không huỷ
          </button>
          <button type="submit" disabled={dang} className={primaryClass}>
            Huỷ đơn
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Từ 1280 px: cột hồ sơ khách nằm cạnh khung chat (như thiết kế). Nhỏ hơn: ngăn kéo. */
function PanelFrame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [rong, setRong] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const doi = () => setRong(mq.matches);
    mq.addEventListener('change', doi);
    return () => mq.removeEventListener('change', doi);
  }, []);
  if (!rong) return <Dialog title="Thông tin khách hàng" variant="drawer" onClose={onClose}>{children}</Dialog>;
  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Thông tin khách hàng</h2>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin khách" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-body hover:bg-fill">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      {children}
    </div>
  );
}
