import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { linkTep } from '@/lib/api';
import { CHANNEL } from '@/lib/labels';
import type { Attachment, Channel, Message, ReactionKey, TourCard } from '@/lib/types';

/** 6 biểu cảm như Zalo / Messenger (chủ dự án yêu cầu 2026-11-26). */
export const BIEU_CAM: { key: ReactionKey; emoji: string; ten: string }[] = [
  { key: 'like', emoji: '👍', ten: 'Thích' },
  { key: 'heart', emoji: '❤️', ten: 'Thả tim' },
  { key: 'haha', emoji: '😆', ten: 'Haha' },
  { key: 'wow', emoji: '😮', ten: 'Wow' },
  { key: 'sad', emoji: '😢', ten: 'Buồn' },
  { key: 'angry', emoji: '😡', ten: 'Phẫn nộ' },
];
const EMOJI = Object.fromEntries(BIEU_CAM.map((b) => [b.key, b.emoji])) as Record<ReactionKey, string>;

/** Thao tác trên từng tin, do khung chat truyền vào (Digital chỉ xem thì không có). */
export type ThaoTacTin = {
  meId: string;
  onReact: (m: Message, emoji: ReactionKey) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
};

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
function DinhKem({ a, tren, tron }: { a: Attachment; tren?: boolean; tron?: boolean }) {
  const href = linkTep(a.url);
  if (a.type.startsWith('image/')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={`Mở ảnh ${a.name}`} className={`block ${tren ? 'mb-1.5' : ''}`}>
        <img src={href} alt={a.name} loading="lazy" className={`max-h-72 max-w-full rounded-lg object-contain ${tron ? '' : 'bg-surface'}`} />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-ink ${tren ? 'mb-1.5' : ''}`}
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

/** Nút trả lời (trích dẫn tin này), hiện khi rê chuột như Zalo. */
function NutTraLoi({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Trả lời" aria-label="Trả lời tin này" className="grid size-8 place-items-center rounded-md text-muted hover:bg-fill hover:text-ink">
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
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


/** Đóng bảng nổi khi bấm ra ngoài hoặc nhấn Esc. */
function useDongKhiBamNgoai(mo: boolean, dong: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mo) return;
    const bam = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) dong(); };
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); };
    document.addEventListener('mousedown', bam);
    document.addEventListener('touchstart', bam);
    document.addEventListener('keydown', phim);
    return () => {
      document.removeEventListener('mousedown', bam);
      document.removeEventListener('touchstart', bam);
      document.removeEventListener('keydown', phim);
    };
  }, [mo, dong]);
  return ref;
}

/**
 * Nút mặt cười: rê chuột vào thì hiện 6 biểu cảm để chọn (màn hình cảm ứng: bấm để mở). Bảng nằm phía trên nút,
 * canh theo phía của tin (tin khách: mở sang phải; tin mình: mở sang trái) để không tràn khỏi khung chat.
 */
function NutBieuCam({ ben, dangChon, onChon }: { ben: 'trai' | 'phai'; dangChon: ReactionKey | null; onChon: (k: ReactionKey) => void }) {
  const [mo, setMo] = useState(false);
  const dong = useCallback(() => setMo(false), []);
  const ref = useDongKhiBamNgoai(mo, dong);
  return (
    <div ref={ref} className="group/bc sm:relative">
      <button
        type="button"
        onClick={() => setMo((x) => !x)}
        title="Thả biểu cảm"
        aria-label="Thả biểu cảm"
        aria-expanded={mo}
        className={`grid size-8 place-items-center rounded-md hover:bg-fill hover:text-ink ${dangChon ? 'text-brand-text' : 'text-muted'}`}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" />
        </svg>
      </button>
      {/* pb-2 nối vùng rê chuột từ nút lên bảng, rê lên không bị tắt giữa chừng */}
      <div className={`absolute bottom-full z-30 pb-2 ${ben === 'trai' ? 'left-0' : 'right-0'} ${mo ? 'block' : 'hidden group-hover/bc:block'}`}>
        <div role="menu" aria-label="Chọn biểu cảm" className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg">
          {BIEU_CAM.map((b) => (
            <button
              key={b.key}
              type="button"
              role="menuitemradio"
              aria-checked={dangChon === b.key}
              title={b.ten}
              aria-label={dangChon === b.key ? `Gỡ ${b.ten}` : b.ten}
              onClick={() => { onChon(b.key); setMo(false); }}
              className={`grid size-9 place-items-center rounded-full text-xl leading-none transition-transform duration-150 hover:scale-125 hover:bg-fill ${dangChon === b.key ? 'bg-brand-faint ring-1 ring-alert-line' : ''}`}
            >
              {b.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Nút "⋯": chỉnh sửa (tin mình gửi), sao chép, xoá. */
function NutThem({ ben, coSua, coChu, onSua, onChep, onXoa }: { ben: 'trai' | 'phai'; coSua: boolean; coChu: boolean; onSua: () => void; onChep: () => void; onXoa: () => void }) {
  const [mo, setMo] = useState(false);
  const dong = useCallback(() => setMo(false), []);
  const ref = useDongKhiBamNgoai(mo, dong);
  const muc = 'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-fill';
  return (
    // Màn hình hẹp: bảng bám theo cả hàng tin (không bám nút) để không tràn khỏi mép màn hình.
    <div ref={ref} className="sm:relative">
      <button type="button" onClick={() => setMo((x) => !x)} title="Thêm" aria-label="Thêm thao tác cho tin này" aria-expanded={mo} className="grid size-8 place-items-center rounded-md text-lg leading-none text-muted hover:bg-fill hover:text-ink">
        ⋯
      </button>
      {mo && (
        <div role="menu" className={`absolute top-full z-30 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-lg ${ben === 'trai' ? 'right-0' : 'left-0'}`}>
          {coSua && (
            <button type="button" role="menuitem" className={muc} onClick={() => { setMo(false); onSua(); }}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Chỉnh sửa
            </button>
          )}
          {coChu && (
            <button type="button" role="menuitem" className={muc} onClick={() => { setMo(false); onChep(); }}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
              Sao chép
            </button>
          )}
          <button type="button" role="menuitem" className={`${muc} text-brand-text hover:bg-brand-faint`} onClick={() => { setMo(false); onXoa(); }}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            Xoá tin nhắn
          </button>
        </div>
      )}
    </div>
  );
}

/** Biểu cảm đã thả, gắn ở góc dưới bong bóng như Zalo: các emoji khác nhau + tổng số; rê chuột xem ai thả. */
function DaThaBieuCam({ m, ben }: { m: Message; ben: 'trai' | 'phai' }) {
  const ds = m.reactions ?? [];
  if (!ds.length) return null;
  const loai = [...new Set(ds.map((r) => r.emoji))].filter((k) => EMOJI[k]);
  const ai = ds.map((r) => `${r.by}: ${BIEU_CAM.find((b) => b.key === r.emoji)?.ten ?? r.emoji}`).join('\n');
  return (
    <div className={`-mt-2 flex ${ben === 'phai' ? 'justify-end pr-2' : 'justify-start pl-2'}`}>
      <span title={ai} aria-label={`Biểu cảm: ${ai.replaceAll('\n', ', ')}`} className="relative z-[1] inline-flex items-center gap-0.5 rounded-full border border-line bg-surface px-1.5 py-px text-[0.8125rem] leading-5 shadow-sm">
        {loai.map((k) => <span key={k}>{EMOJI[k]}</span>)}
        {ds.length > 1 && <span className="ml-0.5 text-xs font-semibold text-body">{ds.length}</span>}
      </span>
    </div>
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

/** Ngày giờ đầy đủ khi bấm vào tin: "16:36 · 13/11/2026". */
const ngayGioDayDu = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};

/**
 * Khung một tin (như Zalo): bình thường chỉ có bong bóng. Rê chuột thì hiện các nút biểu cảm, ghim, trả lời, "⋯" ở cạnh tin
 * (tin mình gửi: bên trái; tin khách: bên phải; rê ở bất kỳ đâu trên cùng hàng cũng được). Bấm vào tin thì hiện người gửi, nền tảng, ngày giờ.
 * Màn hình cảm ứng không rê chuột được: bấm vào tin là hiện cả nút lẫn chi tiết.
 */
function KhungTin({ ben, children, nut, chiTiet, duoi, tren, phanUng, daSua }: { ben: 'trai' | 'phai'; children: ReactNode; nut: ReactNode; chiTiet: string; duoi?: ReactNode; tren?: ReactNode; phanUng?: ReactNode; daSua?: boolean }) {
  const [mo, setMo] = useState(false);
  const bam = (e: React.MouseEvent) => {
    // Bấm vào link, ảnh, nút bên trong thì để chúng tự xử lý.
    if ((e.target as HTMLElement).closest('a,button')) return;
    setMo((x) => !x);
  };
  return (
    // Vùng rê chuột là cả hàng ngang của tin: chuột rời bong bóng nhưng vẫn cùng hàng thì nút vẫn hiện và bấm được.
    <div className="group flex w-full min-w-0 flex-col">
    <div className={`min-w-0 max-w-[88%] sm:max-w-[72%] ${ben === 'phai' ? 'self-end' : 'self-start'}`}>
      {tren}
      <div className={`relative flex min-w-0 items-center gap-1 ${ben === 'phai' ? 'flex-row-reverse' : ''}`}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={mo}
          aria-label="Bấm để xem ngày giờ chi tiết"
          onClick={bam}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), setMo((x) => !x))}
          className="min-w-0 cursor-pointer rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {children}
        </div>
        {nut && (
          <div className={`flex shrink-0 items-center transition-opacity ${ben === 'phai' ? 'flex-row-reverse' : ''} group-hover:opacity-100 group-focus-within:opacity-100 ${mo ? 'opacity-100' : 'opacity-0'}`}>{nut}</div>
        )}
      </div>
      {phanUng}
      {daSua && !mo && <div className={`mt-0.5 text-[0.6875rem] text-muted ${ben === 'phai' ? 'text-right' : ''}`}>Đã chỉnh sửa</div>}
      {mo && <div className={`mt-0.5 text-[0.6875rem] text-muted ${ben === 'phai' ? 'text-right' : ''}`}>{[chiTiet, daSua ? 'Đã chỉnh sửa' : null].filter(Boolean).join(' · ')}</div>}
      {duoi}
    </div>
    </div>
  );
}

export function MessageBubble({ message: m, onReply, onPin, pinned = false, seen, tuKhoa, kenh, thaoTac, onCopied }: { message: Message; onReply?: (m: Message) => void; onPin?: (m: Message) => void; pinned?: boolean; seen?: boolean; tuKhoa?: string; kenh?: Channel; thaoTac?: ThaoTacTin; onCopied?: () => void }) {
  const ben: 'trai' | 'phai' = m.senderType === 'CUSTOMER' ? 'trai' : 'phai';
  const cuaToi = thaoTac ? (m.reactions ?? []).find((r) => r.actorKey === thaoTac.meId)?.emoji ?? null : null;
  const bieuCam = thaoTac && !m.internal ? <NutBieuCam ben={ben} dangChon={cuaToi} onChon={(k) => thaoTac.onReact(m, k)} /> : null;
  const ghim = onPin && !m.internal ? <NutGhim daGhim={pinned} onClick={() => onPin(m)} /> : null;
  const traLoi = onReply && !m.internal ? <NutTraLoi onClick={() => onReply(m)} /> : null;
  // Zalo / Facebook không cho sửa tin đã gửi (khách vẫn thấy tin cũ) nên không hiện "Chỉnh sửa" ở 2 kênh này.
  const coSua = !!thaoTac && m.senderType === 'STAFF' && m.staffId === thaoTac.meId && !!m.text.trim() && kenh !== 'ZALO' && kenh !== 'FACEBOOK';
  const chep = () => void navigator.clipboard?.writeText(m.text).then(() => onCopied?.(), () => undefined);
  const them = thaoTac && !m.internal ? <NutThem ben={ben} coSua={coSua} coChu={!!m.text.trim()} onSua={() => thaoTac.onEdit(m)} onChep={chep} onXoa={() => thaoTac.onDelete(m)} /> : null;
  // Thứ tự từ bong bóng ra ngoài: biểu cảm, trả lời, ghim, "⋯". Tin mình (bên phải) xếp ngược nên cũng gần bong bóng trước.
  const nut = bieuCam || ghim || traLoi || them ? <>{bieuCam}{traLoi}{ghim}{them}</> : null;
  const phanUng = <DaThaBieuCam m={m} ben={ben} />;
  const nenTang = kenh ? CHANNEL[kenh].label : null;
  // Ảnh, sticker gửi riêng (không chữ, không trích dẫn): hiện trơn như Zalo, không khung màu, không nền.
  const tron = !!m.attachment?.type.startsWith('image/') && !m.text?.trim() && !m.replyTo && !m.tours?.length;
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
      <KhungTin
        ben="trai"
        nut={nut}
        chiTiet={['Khách', nenTang, ngayGioDayDu(m.createdAt)].filter(Boolean).join(' · ')}
        phanUng={phanUng}
        tren={m.isTrigger && <div className="mb-[3px] text-xs font-semibold text-brand-text">Yêu cầu gặp nhân viên</div>}
      >
        <div
          className={
            tron
              ? `rounded-lg ${m.isTrigger ? 'ring-2 ring-brand' : ''}`
              : `whitespace-pre-line break-words rounded-[14px_14px_14px_4px] bg-surface px-3 py-2 text-sm leading-normal ${m.isTrigger ? 'border-2 border-brand' : 'border border-line'}`
          }
        >
          {m.replyTo && <Trich m={m.replyTo} />}
          {m.attachment && <DinhKem a={m.attachment} tren={!!m.text} tron={tron} />}
          <VanBan text={m.text} tuKhoa={tuKhoa} />
        </div>
      </KhungTin>
    );
  }
  const mau = m.senderType === 'STAFF' ? 'bg-brand-button text-white' : m.senderType === 'AUTO' ? 'bg-auto text-auto-ink' : 'bg-neutral-soft text-ink';
  const ai = m.senderType === 'STAFF' ? (m.staffLabel ?? 'Nhân viên') : m.senderType === 'AUTO' ? `Tự động · ${m.ruleName}` : CHANNEL.WEB.bot;
  // Thẻ xin số điện thoại đã gửi qua Zalo: vẽ giống thẻ khách thấy trên điện thoại.
  const THE = '[Thẻ xin thông tin] ';
  if (m.senderType === 'STAFF' && m.text?.startsWith(THE)) {
    const [tieuDe, ...phu] = m.text.slice(THE.length).split('\n');
    return (
      <div className="min-w-0 max-w-[88%] self-end sm:max-w-[320px]">
        <div className="overflow-hidden rounded-[14px_14px_4px_14px] border border-line bg-surface text-sm">
          <div className="grid h-24 place-items-center bg-fill">
            <img src="/logo.png" alt="" className="h-16 w-16 object-contain" />
          </div>
          <div className="px-3 py-2.5">
            <p className="font-semibold">{tieuDe}</p>
            {phu.length > 0 && <p className="mt-1 text-xs text-muted">{phu.join(' ')}</p>}
            <p className="mt-2 text-xs font-semibold text-blue-ink">Thẻ xin số điện thoại · Zalo</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted">
          {m.staffLabel ?? 'Nhân viên'} · {new Date(m.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  }
  return (
    <KhungTin
      ben="phai"
      nut={nut}
      chiTiet={[ai, nenTang, ngayGioDayDu(m.createdAt)].filter(Boolean).join(' · ')}
      phanUng={phanUng}
      daSua={!!m.editedAt}
      duoi={seen && <div className="mt-0.5 text-right text-[0.6875rem] font-medium text-green-ink">Khách đã xem</div>}
    >
      <div className={tron ? 'rounded-lg' : `whitespace-pre-line break-words rounded-[14px_14px_4px_14px] px-3 py-2 text-sm leading-normal ${mau}`}>
        {m.replyTo && <Trich m={m.replyTo} light={m.senderType === 'STAFF'} />}
        {m.attachment && <DinhKem a={m.attachment} tren={!!m.text} tron={tron} />}
        <VanBan text={m.text} tuKhoa={tuKhoa} />
        {m.tours?.map((t, i) => {
          const the = thongTinThe(t);
          return (
            <div key={i} className="mt-2 rounded-lg bg-surface px-2.5 py-2 text-ink">
              <div className="text-[0.8125rem] font-semibold">{the.ten}</div>
              {the.meta && <div className="mt-0.5 text-xs text-body">{the.meta}</div>}
            </div>
          );
        })}
      </div>
    </KhungTin>
  );
}
