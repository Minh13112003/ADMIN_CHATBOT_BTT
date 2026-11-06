import { useEffect, useState, type FormEvent } from 'react';
import { loiCua, patch, post } from '@/lib/api';
import { BOOKING_STATUS, CHANNEL, DEAL_STATUS, dinhDangSo, gioTin, STATUS, STATUS_LIST, TAGS, vnd } from '@/lib/labels';
import type { Conversation, Deal, Status } from '@/lib/types';
import { chipClass, Dialog, ErrorText, Field, inputClass, primaryClass, secondaryClass } from '../ui';

export function InfoPanel({ conv, deals, onChange, onClose }: { conv: Conversation; deals: Deal[] | undefined; onChange: (c: Conversation) => unknown; onClose: () => void }) {
  const [note, setNote] = useState(conv.note ?? '');
  const [loi, setLoi] = useState('');
  const [chot, setChot] = useState<{ deal: Deal | null } | null>(null);
  const [huy, setHuy] = useState<Deal | null>(null);

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
    <aside id="thong-tin-khach" aria-label="Thông tin khách" className="fixed inset-y-0 right-0 z-30 flex w-[300px] max-w-full flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-3.5 shadow-xl lg:static lg:shrink-0 lg:shadow-none">
      {/* Màn hẹp: cột phủ lên khung chat, che mất icon 3 gạch nên cần nút đóng riêng. */}
      <button type="button" onClick={onClose} className="min-h-11 self-end rounded-[10px] px-3 text-sm font-medium underline lg:hidden">
        Đóng
      </button>
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

      <section aria-labelledby="don-dat-tour">
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
                <span className={`shrink-0 whitespace-nowrap rounded-[10px] px-2 py-0.5 text-xs font-semibold ${d.voidedAt ? DEAL_STATUS.CANCELLED.className : DEAL_STATUS[d.status].className}`}>
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
      </section>

      <FollowUp conv={conv} onChange={onChange} />

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

      <div>
        <h2 className="mb-2 text-sm font-semibold">Nhãn</h2>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((t) => {
            const on = conv.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => chay(() => patch<Conversation>(`/conversations/${conv.id}`, { tags: on ? conv.tags.filter((x) => x !== t) : [...conv.tags, t] }))}
                className={`min-h-9 rounded-full border px-2.5 text-[0.8125rem] ${on ? 'border-brand-dark bg-brand-dark text-white' : 'border-field bg-surface text-neutral-ink hover:bg-fill'}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="ghi-chu" className="mb-2 block text-sm font-semibold">
          Ghi chú nội bộ
        </label>
        <textarea
          id="ghi-chu"
          rows={3}
          placeholder="Khách không thấy ghi chú này"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (conv.note ?? '') && chay(() => patch<Conversation>(`/conversations/${conv.id}`, { note }))}
          className="w-full resize-y rounded-[10px] border border-field px-3 py-2.5 text-sm"
        />
      </div>

      {chot && <CloseDealDialog conv={conv} deal={chot.deal} onClose={() => setChot(null)} onDone={onChange} />}
      {huy && <CancelDealDialog conv={conv} deal={huy} onClose={() => setHuy(null)} onDone={onChange} />}
    </aside>
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
      await onChange(await patch<Conversation>(`/conversations/${conv.id}`, at ? { followUpAt: at.toISOString(), followUpNote: note.trim() } : { followUpAt: null }));
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
          <input aria-label="Việc cần làm khi đến hẹn" placeholder="Ví dụ: gọi lại báo giá đoàn" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          <div className="flex flex-wrap gap-1.5">
            {mocNhanh().map((m) => (
              <button key={m.label} type="button" className={chipClass} onClick={() => void luu(m.at)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input aria-label="Giờ hẹn khác" type="datetime-local" value={gio} min={chuoiGio(new Date())} onChange={(e) => setGio(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
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

/**
 * Chốt tour. Có `deal` (khách tự đặt qua chatbot, đang chờ xác nhận) thì điền sẵn và xác nhận đúng đơn đó;
 * sale sửa nếu khách đổi số người hay đợt khởi hành khi gọi điện.
 */
export function CloseDealDialog({ conv, deal, onClose, onDone }: { conv: Conversation; deal: Deal | null; onClose: () => void; onDone: (c: Conversation) => unknown }) {
  const [tourName, setTourName] = useState(deal?.tourName ?? conv.interest ?? '');
  const [tourCode, setTourCode] = useState(deal?.tourCode ?? '');
  const [guests, setGuests] = useState(String(deal?.guests ?? 1));
  const [amount, setAmount] = useState(deal ? deal.amount.toLocaleString('vi-VN') : '');
  const [orderCode, setOrderCode] = useState(deal?.orderCode ?? '');
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e: FormEvent) => {
    e.preventDefault();
    const tien = Number(amount.replace(/\D/g, ''));
    if (!tien) {
      setLoi('Nhập tổng tiền của đơn');
      return;
    }
    setDangGui(true);
    setLoi('');
    try {
      await onDone(
        await post<Conversation>(`/conversations/${conv.id}/close`, {
          ...(deal ? { dealId: deal.id } : {}),
          tourName,
          tourCode,
          guests: Number(guests),
          amount: tien,
          orderCode,
        }),
      );
      onClose();
    } catch (err) {
      setLoi(loiCua(err));
      setDangGui(false);
    }
  };

  return (
    <Dialog title={deal ? 'Xác nhận đơn khách đã đặt' : 'Chốt tour'} onClose={onClose}>
      <form onSubmit={gui} className="flex flex-col gap-3">
        {deal && <p className="text-[0.8125rem] text-body">Khách tự đặt qua bttAI. Gọi khách xác nhận, sửa lại nếu khách đổi số người hoặc đợt khởi hành.</p>}
        <Field label="Tên tour">
          <input required minLength={2} value={tourName} onChange={(e) => setTourName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Mã tour (mã đợt khởi hành)">
          <input
            required
            value={tourCode}
            onChange={(e) => setTourCode(e.target.value.toUpperCase())}
            placeholder="Ví dụ A06.FIT.TW.070227.A"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số khách">
            <input type="number" required min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tổng tiền (đồng)">
            <input
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => {
                const so = e.target.value.replace(/\D/g, '');
                setAmount(so ? Number(so).toLocaleString('vi-VN') : '');
              }}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Mã đơn (không bắt buộc)">
          <input value={orderCode} onChange={(e) => setOrderCode(e.target.value)} disabled={!!deal?.orderCode} className={inputClass} />
        </Field>
        <p className="text-xs text-muted">Mã tour lấy trên benthanhtourist.com hoặc hệ thống điều hành tour. Đơn chốt được tính vào doanh thu.</p>
        <ErrorText>{loi}</ErrorText>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Huỷ
          </button>
          <button type="submit" disabled={dangGui} className={primaryClass}>
            {deal ? 'Xác nhận chốt' : 'Chốt tour'}
          </button>
        </div>
      </form>
    </Dialog>
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
          Đơn <strong className="font-semibold">{deal.tourName}</strong> sẽ không tính doanh thu. Nếu khách đã có booking bên hệ thống đặt tour, nhớ huỷ cả ở đó.
        </p>
        <Field label="Lý do (không bắt buộc)">
          <input value={lyDo} maxLength={300} onChange={(e) => setLyDo(e.target.value)} placeholder="Ví dụ: khách đổi lịch sang năm sau" className={inputClass} />
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
