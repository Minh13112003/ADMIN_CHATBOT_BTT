import type { ReactNode } from 'react';
import { linkTep } from '@/lib/api';
import { CHANNEL, gioTin } from '@/lib/labels';
import type { Attachment, Message, TourCard } from '@/lib/types';

// Thẻ tour do chatbot gửi, tên trường theo chuan_hoa_the_tour trong D:\ChatBot\main.py.
function thongTinThe(t: TourCard) {
  const chu = (...keys: string[]) => {
    for (const k of keys) {
      const v = t[k];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number' && v > 0) return v;
    }
    return null;
  };
  const gia = chu('gia');
  const soNgay = chu('so_ngay');
  const ngayGoc = chu('ngay_khoi_hanh');
  const ngay = typeof ngayGoc === 'string' ? ngayGoc.slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : ngayGoc;
  return {
    ten: String(chu('ten_tour', 'ten', 'name') ?? 'Tour'),
    meta: [
      soNgay ? `${soNgay} ngày` : null,
      ngay ? `khởi hành ${ngay}` : null,
      typeof gia === 'number' ? `${gia.toLocaleString('vi-VN')} đ` : gia,
      chu('mo_ta'),
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

const NGUOI_GUI: Record<Message['senderType'], string> = { CUSTOMER: 'Khách', BOT: 'bttAI', AUTO: 'Tự động', STAFF: 'Nhân viên', SYSTEM: 'Hệ thống' };

function Trich({ m, light }: { m: NonNullable<Message['replyTo']>; light?: boolean }) {
  return (
    <div className={`mb-1.5 border-l-[3px] pl-2 text-xs ${light ? 'border-white/70 text-white/90' : 'border-field text-body'}`}>
      <div className="font-semibold">{NGUOI_GUI[m.senderType]}</div>
      <div className="line-clamp-2 whitespace-pre-line break-words">{m.text}</div>
    </div>
  );
}

export const dungLuong = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Ảnh hiện ngay trong khung chat (bấm để mở bản đầy đủ ở tab mới); PDF hiện thành thẻ mở file. */
function DinhKem({ a, tren }: { a: Attachment; tren?: boolean }) {
  const href = linkTep(a.url);
  if (a.type.startsWith('image/')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={`Mở ảnh ${a.name}`} className={`block ${tren ? 'mb-1.5' : ''}`}>
        <img src={href} alt={a.name} loading="lazy" className="max-h-72 max-w-full rounded-lg bg-surface object-contain" />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-[10px] bg-surface px-2.5 py-1.5 text-ink ${tren ? 'mb-1.5' : ''}`}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-brand"
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </svg>
      <span className="min-w-0">
        <span className="line-clamp-2 break-all text-[0.8125rem] font-semibold">{a.name}</span>
        <span className="block text-xs text-body">PDF · {dungLuong(a.size)}</span>
      </span>
    </a>
  );
}

function NutTraLoi({ onClick, align }: { onClick: () => void; align: 'left' | 'right' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 px-2 text-[0.6875rem] font-medium text-body underline-offset-2 hover:underline ${align === 'right' ? 'ml-1' : 'mr-1'}`}
    >
      Trả lời
    </button>
  );
}

/** Icon ghim: lưu tin này làm bằng chứng khách quan tâm một tour. */
function NutGhim({ onClick, daGhim }: { onClick: () => void; daGhim: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ghim tour quan tâm"
      aria-label="Ghim tour quan tâm cho tin này"
      className={`grid size-8 place-items-center rounded-md hover:bg-fill hover:text-brand-text ${daGhim ? 'text-brand-text' : 'text-muted'}`}
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill={daGhim ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z" />
      </svg>
    </button>
  );
}


/** Bỏ dấu từng ký tự nhưng giữ nguyên độ dài chuỗi, để vị trí tìm thấy khớp với chữ gốc. */
function boDau(t: string) {
  return Array.from(t, (c) => (c === 'đ' ? 'd' : c === 'Đ' ? 'D' : c.normalize('NFD').charAt(0))).join('').toLowerCase();
}

/** Chữ tin nhắn, bôi vàng các từ đang tìm (không phân biệt hoa thường và dấu). */
function VanBan({ text, tuKhoa }: { text: string; tuKhoa?: string }) {
  const tu = (tuKhoa ?? '').split(/\s+/).map(boDau).filter(Boolean);
  if (!tu.length) return <>{text}</>;
  const goc = boDau(text);
  const doan: [number, number][] = [];
  for (const t of tu) {
    for (let i = goc.indexOf(t); i !== -1; i = goc.indexOf(t, i + t.length)) doan.push([i, i + t.length]);
  }
  if (!doan.length) return <>{text}</>;
  doan.sort((a, b) => a[0] - b[0]);
  const gop: [number, number][] = [];
  for (const d of doan) {
    const cuoi = gop[gop.length - 1];
    if (cuoi && d[0] <= cuoi[1]) cuoi[1] = Math.max(cuoi[1], d[1]);
    else gop.push([...d]);
  }
  const ra: ReactNode[] = [];
  let tu0 = 0;
  gop.forEach(([a, b], i) => {
    if (a > tu0) ra.push(text.slice(tu0, a));
    ra.push(<mark key={i} className="rounded-sm bg-yellow-300/70 px-0.5 text-inherit">{text.slice(a, b)}</mark>);
    tu0 = b;
  });
  if (tu0 < text.length) ra.push(text.slice(tu0));
  return <>{ra}</>;
}

export function MessageBubble({ message: m, onReply, onPin, pinned = false, seen, tuKhoa }: { message: Message; onReply?: (m: Message) => void; onPin?: (m: Message) => void; pinned?: boolean; seen?: boolean; tuKhoa?: string }) {
  const ghim = onPin && !m.internal ? <NutGhim daGhim={pinned} onClick={() => onPin(m)} /> : null;
  if (m.senderType === 'SYSTEM') {
    return (
      <div
        className={`max-w-[90%] self-center rounded-xl px-3 py-[5px] text-center text-xs ${m.internal ? 'bg-auto text-auto-ink' : 'bg-line text-neutral-ink'}`}
      >
        {m.text}
      </div>
    );
  }
  if (m.senderType === 'CUSTOMER') {
    return (
      <div className="min-w-0 max-w-[88%] self-start sm:max-w-[72%]">
        {m.isTrigger && <div className="mb-[3px] text-xs font-semibold text-brand-text">Yêu cầu gặp nhân viên</div>}
        <div
          className={`whitespace-pre-line break-words rounded-[14px_14px_14px_4px] bg-surface px-3 py-2 text-sm leading-normal ${m.isTrigger ? 'border-2 border-brand' : 'border border-line'}`}
        >
          {m.replyTo && <Trich m={m.replyTo} />}
          {m.attachment && <DinhKem a={m.attachment} tren={!!m.text} />}
          <VanBan text={m.text} tuKhoa={tuKhoa} />
        </div>
        <div className="mt-0.5 flex items-center text-[0.6875rem] text-muted">
          Khách · {gioTin(m.createdAt)}
          {onReply && <NutTraLoi align="right" onClick={() => onReply(m)} />}
          {ghim}
        </div>
      </div>
    );
  }
  const mau = m.senderType === 'STAFF' ? 'bg-brand-button text-white' : m.senderType === 'AUTO' ? 'bg-auto text-auto-ink' : 'bg-neutral-soft text-ink';
  const ai = m.senderType === 'STAFF' ? (m.staffLabel ?? 'Nhân viên') : m.senderType === 'AUTO' ? `Tự động · ${m.ruleName}` : CHANNEL.WEB.bot;
  return (
    <div className="min-w-0 max-w-[88%] self-end sm:max-w-[72%]">
      <div className={`whitespace-pre-line break-words rounded-[14px_14px_4px_14px] px-3 py-2 text-sm leading-normal ${mau}`}>
        {m.replyTo && <Trich m={m.replyTo} light={m.senderType === 'STAFF'} />}
        {m.attachment && <DinhKem a={m.attachment} tren={!!m.text} />}
        <VanBan text={m.text} tuKhoa={tuKhoa} />
        {m.tours?.map((t, i) => {
          const the = thongTinThe(t);
          return (
            <div key={i} className="mt-2 rounded-[10px] bg-surface px-2.5 py-2 text-ink">
              <div className="text-[0.8125rem] font-semibold">{the.ten}</div>
              {the.meta && <div className="mt-0.5 text-xs text-body">{the.meta}</div>}
            </div>
          );
        })}
      </div>
      <div className="mt-0.5 flex items-center justify-end text-[0.6875rem] text-muted">
        {ghim}
        <span>
          {ai} · {gioTin(m.createdAt)}
          {seen && <span className="ml-1 font-medium text-green-ink">· Khách đã xem</span>}
        </span>
      </div>
    </div>
  );
}
