import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import useSWR, { mutate as globalMutate } from 'swr';
import { ApiError, del, fetcher, loiCua, patch, post, postForm } from '@/lib/api';
import { CHANNEL, dinhDangSo, STATUS, trieu } from '@/lib/labels';
import { useRealtime } from '@/lib/realtime';
import type { Conversation, Deal, Me, Message, MessageHit, Person, Template, TourTag } from '@/lib/types';
import { TagTourDialog, xemTinTrongChat } from './TourTags';
import { insertAtCursor, prepareQuickReply } from '@/lib/quick-reply';
import { AnhKhach, chipClass, Dialog, ErrorText, Field, inputClass, primaryClass, secondaryClass, Switch } from '../ui';
import { InfoPanel } from './InfoPanel';
import { CloseDealDialog } from './CloseDealDialog';
import { dungLuong, MessageBubble } from './MessageBubble';
import { QuickReplyPicker } from './QuickReplyPicker';
import { SoDienThoaiDialog } from './SoDienThoai';

export function ChatPane({ id, onBack }: { id: string; onBack: () => void }) {
  const convKey = `/conversations/${id}`;
  const { data: conv, error, mutate } = useSWR<Conversation>(convKey, fetcher, { refreshInterval: 30_000 });
  const { data: deals } = useSWR<Deal[]>(conv ? `/customers/${conv.customer.id}/deals` : null, fetcher);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1440);
  const [xacNhan, setXacNhan] = useState<Deal | null>(null);
  const [closeNew, setCloseNew] = useState(false);
  const [chatMenu, setChatMenu] = useState(false);
  const [headerHandover, setHeaderHandover] = useState(false);
  const [xoaHoiThoai, setXoaHoiThoai] = useState(false);
  const [capSdt, setCapSdt] = useState(false);
  const [dongBoZalo, setDongBoZalo] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [ghimTin, setGhimTin] = useState<Message | null>(null);
  const [timTin, setTimTin] = useState(false);
  const { data: tags, mutate: mutateTags } = useSWR<TourTag[]>(`/conversations/${id}/tour-tags`, fetcher);
  const { clearPing } = useRealtime();
  const daDoc = useRef(false);
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  // Digital chỉ được xem: không có khung soạn tin, không đánh dấu đã đọc.
  const chiXem = me?.role === 'DIGITAL';
  const [sp] = useSearchParams();
  const focusId = sp.get('m');

  useEffect(() => {
    if (conv && me && !chiXem && conv.status === 'UNREAD' && !daDoc.current) {
      daDoc.current = true;
      void post<Conversation>(`/conversations/${id}/read`).then((c) => mutate(c, { revalidate: false }));
    }
  }, [conv, id, mutate]);

  useEffect(() => clearPing(id), [clearPing, id]);
  useEffect(() => {
    setReplyTo(null);
    setTimTin(false);
  }, [id]);

  if (error) return <p className="m-auto p-6 text-sm text-brand-text">Không tải được hội thoại này.</p>;
  if (!conv) return <p className="m-auto p-6 text-sm text-muted">Đang tải...</p>;

  const refresh = (c: Conversation) => mutate(c, { revalidate: false });
  const donChoTatCa = deals?.filter((d) => d.status === 'PENDING' && d.conversationId === id) ?? [];
  const donCho = donChoTatCa[0];
  const choNhanVien = conv.status === 'CONTACT' && conv.mode === 'BOT';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <section aria-label="Nội dung hội thoại" className="flex min-h-0 min-w-0 flex-1 flex-col bg-page">
        <div className="flex min-h-16 items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại danh sách"
            className="flex size-11 items-center justify-center rounded-[10px] hover:bg-fill lg:hidden"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <AnhKhach ten={conv.customer.name} anh={conv.customer.avatarUrl} className="hidden size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-text sm:grid" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold" title={conv.customer.name}>
              {conv.customer.name}
            </div>
            <div className="truncate text-[0.8125rem] text-muted">{dinhDangSo(conv.customer.phone)} · {CHANNEL[conv.channel].label}</div>
          </div>
          <span className={`hidden shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1 text-[0.8125rem] font-semibold 2xl:inline ${STATUS[conv.status].className}`}>{STATUS[conv.status].label}</span>
          {!chiXem && (
            <button type="button" onClick={() => setTimTin(!timTin)} aria-label="Tìm tin nhắn trong hội thoại" aria-pressed={timTin} title="Tìm tin nhắn" className={`grid size-11 shrink-0 place-items-center rounded-lg border border-line hover:bg-fill ${timTin ? 'bg-fill' : ''}`}>
              <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
          )}
          <button className="hidden min-h-11 rounded-lg bg-brand-button px-4 text-sm font-semibold text-white sm:block" onClick={() => setCloseNew(true)}>Chốt tour</button>
          <div className="relative"><button type="button" aria-label="Thêm thao tác hội thoại" aria-expanded={chatMenu} onClick={() => setChatMenu(!chatMenu)} className="grid size-11 place-items-center rounded-lg border border-line text-xl">⋯</button>{chatMenu && <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-line bg-surface shadow-sm p-1 shadow-lg"><button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill" onClick={() => { setPanelOpen(true); setChatMenu(false); }}>Xem hồ sơ khách</button><button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill" onClick={() => { setHeaderHandover(true); setChatMenu(false); }}>Chuyển cho đồng nghiệp</button>{conv.role === 'OWNER' && <button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill" onClick={() => { void post<Conversation>(`/conversations/${id}/give-back`).then(refresh); setChatMenu(false); }}>Trả lại cho bot</button>}<button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill sm:hidden" onClick={() => { setCloseNew(true); setChatMenu(false); }}>Chốt tour</button>{me?.role === 'ADMIN' && conv.channel === 'ZALO' && <button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill" onClick={() => { setDongBoZalo(true); setChatMenu(false); }}>Đồng bộ tin cũ từ Zalo</button>}{!chiXem && <button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-fill" onClick={() => { setCapSdt(true); setChatMenu(false); }}>{conv.customer.phone ? 'Sửa số điện thoại khách' : 'Cập nhật số điện thoại khách'}</button>}{me?.role === 'ADMIN' && <button className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-brand-text hover:bg-brand-soft" onClick={() => { setXoaHoiThoai(true); setChatMenu(false); }}>Xoá hội thoại</button>}</div>}</div>
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? 'Đóng thông tin khách' : 'Mở thông tin khách'}
            aria-expanded={panelOpen}
            aria-controls="thong-tin-khach"
            className={`hidden size-11 items-center justify-center rounded-[10px] hover:bg-fill sm:flex ${panelOpen ? 'bg-fill' : ''}`}
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </button>
        </div>

        {(choNhanVien || donCho) && <div className="flex min-h-12 items-center gap-2 border-b border-amber-line bg-auto-soft px-3 py-1.5 text-sm text-amber-ink"><strong className="shrink-0">Cần làm:</strong><span className="min-w-0 flex-1 truncate">{donCho ? `Gọi khách xác nhận đơn ${donCho.tourName} (${trieu(donCho.amount)})` : conv.assignee ? `Khách chờ nhân viên ${conv.assignee.fullName}` : 'Khách đang chờ nhân viên'}</span>{conv.customer.phone && <a className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" href={`tel:${conv.customer.phone}`}>Gọi khách</a>}{donCho && <button type="button" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white" onClick={() => setXacNhan(donCho)}>Xác nhận đơn</button>}</div>}

        {timTin && <TimTinTrongChat id={id} onClose={() => setTimTin(false)} />}
        <MessageList id={id} seenAt={conv.customerSeenAt} onReply={setReplyTo} onPin={chiXem ? undefined : setGhimTin} focusId={focusId} />
        {chiXem ? <p className="border-t border-line bg-fill px-4 py-3 text-center text-sm text-muted">Bạn chỉ được xem hội thoại này.</p> : <Composer conv={conv} onChange={refresh} replyTo={replyTo} clearReply={() => setReplyTo(null)} />}
      </section>
      {panelOpen && <InfoPanel conv={conv} deals={deals} onChange={refresh} onClose={() => setPanelOpen(false)} />}
      {xacNhan && <CloseDealDialog conv={conv} deal={xacNhan} pending={donChoTatCa} onClose={() => setXacNhan(null)} onDone={refresh} />}
      {closeNew && <CloseDealDialog conv={conv} deal={null} pending={donChoTatCa} onClose={() => setCloseNew(false)} onDone={refresh} />}
      {dongBoZalo && <DongBoZaloDialog id={id} onClose={() => setDongBoZalo(false)} />}
      {capSdt && <SoDienThoaiDialog conv={conv} onClose={() => setCapSdt(false)} />}
      {xoaHoiThoai && <XoaHoiThoaiDialog id={id} ten={conv.customer.name} onClose={() => setXoaHoiThoai(false)} onXong={() => { setXoaHoiThoai(false); onBack(); void globalMutate((k) => typeof k === 'string' && (k.startsWith('/conversations') || k.startsWith('/customers') || k.startsWith('/stats')), undefined, { revalidate: true }); }} />}
      {headerHandover && <HandoverDialog conv={conv} onClose={() => setHeaderHandover(false)} onDone={refresh} />}
      {ghimTin && <TagTourDialog conv={conv} tags={tags ?? []} ghimSan={ghimTin} onClose={() => setGhimTin(null)} onDone={() => void mutateTags()} />}
    </div>
  );
}

/** Dòng tìm tin trong hội thoại đang mở: tìm cả tin cũ chưa tải (qua backend), mũi tên lên/xuống nhảy giữa các kết quả. */
function TimTinTrongChat({ id, onClose }: { id: string; onClose: () => void }) {
  const [go, setGo] = useState('');
  const [q, setQ] = useState('');
  const [viTri, setViTri] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setQ(go.trim()), 300);
    return () => clearTimeout(t);
  }, [go]);
  const { data, error, isLoading } = useSWR<MessageHit[]>(q.length >= 2 ? `/messages/search?q=${encodeURIComponent(q)}&conversationId=${id}` : null, fetcher);
  // API trả mới nhất trước; kết quả 1 là tin mới nhất, mũi tên lên đi về tin cũ hơn.
  const kq = data ?? [];
  useEffect(() => setViTri(0), [q]);
  useEffect(() => {
    const m = data?.[viTri];
    // Chỉ tin đang xem được bôi vàng; sang kết quả khác hoặc đóng tìm kiếm thì hết bôi.
    window.dispatchEvent(new CustomEvent('btt:tim-chat', { detail: m ? { id: m.id, q } : null }));
    if (m) xemTinTrongChat(m.id);
  }, [data, viTri, q]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent('btt:tim-chat', { detail: null })); }, []);
  const dem = q.length < 2 ? 'Gõ từ 2 ký tự' : isLoading ? 'Đang tìm...' : error ? 'Lỗi tìm kiếm' : kq.length ? `${viTri + 1} / ${kq.length}` : '0 kết quả';
  return (
    <div role="search" className="flex items-center gap-1 border-b focus-within:shadow-[inset_0_0_0_2px_var(--color-brand)] border-line bg-surface px-3 py-1.5 sm:px-4">
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        autoFocus
        value={go}
        onChange={(e) => setGo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && kq.length) setViTri((v) => (e.shiftKey ? (v - 1 + kq.length) % kq.length : (v + 1) % kq.length));
        }}
        placeholder="Tìm tin nhắn trong hội thoại này (không cần dấu)"
        aria-label="Tìm tin nhắn trong hội thoại này"
        className="min-h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
      />
      <span aria-live="polite" className="shrink-0 whitespace-nowrap text-xs font-semibold text-body">{dem}</span>
      <button type="button" aria-label="Kết quả cũ hơn" disabled={!kq.length} onClick={() => setViTri((v) => (v + 1) % kq.length)} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-fill disabled:opacity-40">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
      </button>
      <button type="button" aria-label="Kết quả mới hơn" disabled={!kq.length} onClick={() => setViTri((v) => (v - 1 + kq.length) % kq.length)} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-fill disabled:opacity-40">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <button type="button" aria-label="Đóng tìm tin" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-fill">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </div>
  );
}

function MessageList({ id, seenAt, onReply, onPin, focusId }: { id: string; seenAt: string | null; onReply: (m: Message) => void; onPin?: (m: Message) => void; focusId?: string | null }) {
  // Mở từ báo cáo nhu cầu tour: tải quanh đúng tin được trỏ tới, rồi cuộn tới và làm nổi bật.
  const { data, error } = useSWR<{ items: Message[]; hasMore: boolean }>(focusId ? `/conversations/${id}/messages?around=${focusId}` : `/conversations/${id}/messages`, fetcher);
  const daCuon = useRef<string | null>(null);
  const [, setSp] = useSearchParams();
  const { data: tags } = useSWR<TourTag[]>(`/conversations/${id}/tour-tags`, fetcher);
  const ghim = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of tags ?? []) m.set(t.message.id, [...(m.get(t.message.id) ?? []), t.tourName]);
    return m;
  }, [tags]);
  const [noiBat, setNoiBat] = useState<string | null>(null);
  const [danhDau, setDanhDau] = useState<{ id: string; q: string } | null>(null);
  useEffect(() => {
    const nghe = (e: Event) => setDanhDau((e as CustomEvent<{ id: string; q: string } | null>).detail);
    window.addEventListener('btt:tim-chat', nghe);
    return () => window.removeEventListener('btt:tim-chat', nghe);
  }, []);
  useEffect(() => {
    const nghe = (e: Event) => {
      const mid = (e as CustomEvent<string>).detail;
      const el = document.getElementById(`msg-${mid}`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setNoiBat(mid);
        setTimeout(() => setNoiBat((x) => (x === mid ? null : x)), 2000);
      } else {
        // Tin cũ chưa tải: tải lại quanh tin đó.
        setSp((cur) => { const n = new URLSearchParams(cur); n.set('m', mid); return n; }, { replace: true });
      }
    };
    window.addEventListener('btt:xem-tin', nghe);
    return () => window.removeEventListener('btt:xem-tin', nghe);
  }, [setSp]);
  useEffect(() => {
    if (!focusId || !data || daCuon.current === focusId) return;
    const el = document.getElementById(`msg-${focusId}`);
    if (el) {
      daCuon.current = focusId;
      el.scrollIntoView({ block: 'center' });
    }
  }, [focusId, data]);
  const [older, setOlder] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | null>(null);
  const [dangTai, setDangTai] = useState(false);

  useEffect(() => {
    setOlder([]);
    setHasOlder(null);
  }, [id]);

  const coThem = hasOlder ?? data?.hasMore ?? false;
  const taiCu = async () => {
    const dau = older[0] ?? data?.items[0];
    if (!dau) return;
    setDangTai(true);
    try {
      const r = await fetcher<{ items: Message[]; hasMore: boolean }>(`/conversations/${id}/messages?before=${encodeURIComponent(dau.createdAt)}`);
      setOlder((o) => [...r.items, ...o]);
      setHasOlder(r.hasMore);
    } finally {
      setDangTai(false);
    }
  };

  const tatCa = [...older, ...(data?.items ?? [])];
  // "Khách đã xem" chỉ đặt dưới tin nhân viên mới nhất mà khung chat phía khách đã lấy về.
  const tinNhanVienCuoi = [...tatCa].reverse().find((m) => m.senderType === 'STAFF');
  const daXem = !!(seenAt && tinNhanVienCuoi && new Date(seenAt) >= new Date(tinNhanVienCuoi.createdAt));

  return (
    // column-reverse giữ khung cuộn ở tin mới nhất mà không cần tự cuộn bằng JS.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-2">
        {coThem && (
          <button type="button" onClick={taiCu} disabled={dangTai} className={`${chipClass} self-center`}>
            {dangTai ? 'Đang tải...' : 'Xem tin cũ hơn'}
          </button>
        )}
        {tatCa.map((m) => (
          <div key={m.id} id={`msg-${m.id}`} className={`flex min-w-0 flex-col transition-colors duration-500 ${focusId === m.id || noiBat === m.id ? 'rounded-xl bg-amber-soft/60 p-1.5 ring-2 ring-amber-line' : ''}`}>
            <MessageBubble message={m} onReply={onReply} onPin={onPin} pinned={ghim.has(m.id)} tuKhoa={danhDau?.id === m.id ? danhDau.q : undefined} seen={daXem && m.id === tinNhanVienCuoi?.id} />
            {ghim.get(m.id)?.map((ten, i) => (
              <span key={i} className={`mt-1 inline-flex max-w-full items-center gap-1.5 self-start rounded-lg border border-alert-line bg-brand-faint px-2 py-1 text-xs font-semibold text-brand-text ${m.senderType === 'CUSTOMER' ? '' : 'self-end'}`}>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z" /></svg>
                <span className="truncate">Tour: {ten}</span>
              </span>
            ))}
          </div>
        ))}
        {!data && !error && <p className="text-center text-sm text-muted">Đang tải tin nhắn...</p>}
        {error && <p className="text-center text-sm text-brand-text">Không tải được tin nhắn.</p>}
        {data && data.items.length === 0 && <p className="text-center text-sm text-muted">Chưa có tin nhắn nào.</p>}
      </div>
    </div>
  );
}

function Composer({
  conv,
  onChange,
  replyTo,
  clearReply,
}: {
  conv: Conversation;
  onChange: (c: Conversation) => unknown;
  replyTo: Message | null;
  clearReply: () => void;
}) {
  const id = conv.id;
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const { data: rules } = useSWR<{ enabled: boolean }[]>('/auto-replies', fetcher);
  const { sendTyping, typing } = useRealtime();
  const [draft, setDraft] = useState('');
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [hoiLai, setHoiLai] = useState<string | null>(null);
  const lanGo = useRef(0);
  const [tep, setTep] = useState<File | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const { data: mauNhanh } = useSWR<Template[]>('/templates', fetcher);
  const { data: deals } = useSWR<Deal[]>(`/customers/${conv.customer.id}/deals`, fetcher);
  const goiPhimTat = /^\/[a-z0-9_-]*$/.test(draft) ? (mauNhanh ?? []).filter((t) => t.shortcut && t.shortcut.startsWith(draft.slice(1))).slice(0, 5) : [];
  const chonGoiY = (t: Template) => {
    void post(`/templates/${t.id}/use`).catch(() => undefined);
    go(prepareQuickReply(t.body, conv.customer.name, me?.fullName ?? '{tên nhân viên}', deals?.find((d) => d.status === 'PENDING') ?? deals?.[0]));
    requestAnimationFrame(() => textarea.current?.focus());
  };
  const textarea = useRef<HTMLTextAreaElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  const chonTep = useRef<HTMLInputElement>(null);
  const xemTruoc = useMemo(() => (tep && tep.type.startsWith('image/') ? URL.createObjectURL(tep) : null), [tep]);
  useEffect(
    () => () => {
      if (xemTruoc) URL.revokeObjectURL(xemTruoc);
    },
    [xemTruoc],
  );

  useEffect(() => {
    setDraft('');
    setLoi('');
    setTep(null);
  }, [id]);

  // Khung gõ 1 dòng, tự cao theo nội dung (tối đa max-h-40 rồi cuộn).
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  /** Kiểm tra sơ bộ cho người dùng khỏi chờ tải lên rồi mới biết lỗi. Backend kiểm tra lại theo nội dung file. */
  const nhanTep = (f: File | undefined | null) => {
    if (!f) return;
    const anh = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type);
    if (!anh && f.type !== 'application/pdf') return setLoi('Chỉ gửi được ảnh (JPG, PNG, WebP) hoặc file PDF');
    if (anh && f.size > 10 * 1024 * 1024) return setLoi('Ảnh quá lớn, tối đa 10 MB');
    if (!anh && f.size > 20 * 1024 * 1024) return setLoi('File PDF quá lớn, tối đa 20 MB');
    setLoi('');
    setTep(f);
  };

  const go = useCallback(
    (v: string) => {
      setDraft(v);
      // Báo đang gõ tối đa mỗi 5 giây: đồng nghiệp thấy "đang soạn tin" và được hỏi lại nếu bấm gửi cùng lúc.
      if (v && Date.now() - lanGo.current > 5000) {
        lanGo.current = Date.now();
        sendTyping(id);
      }
    },
    [id, sendTyping],
  );
  const chooseQuick = (body: string) => {
    const value = prepareQuickReply(body, conv.customer.name, me?.fullName ?? '{tên nhân viên}', deals?.find((d) => d.status === 'PENDING') ?? deals?.[0]);
    const next = insertAtCursor(draft, value, caret.current.start, caret.current.end);
    go(next);
    setQuickOpen(false);
    requestAnimationFrame(() => { textarea.current?.focus(); const position = caret.current.start + value.length; textarea.current?.setSelectionRange(position, position); });
  };

  const guiThat = async (confirm: boolean) => {
    const nd = draft.trim();
    if ((!nd && !tep) || dangGui) return;
    setDangGui(true);
    setLoi('');
    try {
      if (tep) {
        const f = new FormData();
        f.append('file', tep);
        if (nd) f.append('text', nd);
        if (confirm) f.append('confirm', 'true');
        if (replyTo) f.append('replyToId', replyTo.id);
        await postForm(`/conversations/${id}/messages/file`, f);
      } else {
        await post(`/conversations/${id}/messages`, { text: nd, ...(confirm ? { confirm: true } : {}), ...(replyTo ? { replyToId: replyTo.id } : {}) });
      }
      setTep(null);
      setDraft('');
      setHoiLai(null);
      clearReply();
      lanGo.current = 0;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OTHER_ACTIVE') setHoiLai(err.message);
      else setLoi(loiCua(err));
    } finally {
      setDangGui(false);
    }
  };
  const gui = (e: FormEvent) => {
    e.preventDefault();
    void guiThat(false);
  };

  const quyTacBat = rules?.filter((r) => r.enabled).length ?? 0;
  const autoText = !conv.autoReplyOn ? 'Đang tắt cho khách này' : conv.mode === 'STAFF' ? 'Tạm dừng vì nhân viên đang nhắn' : `${quyTacBat} quy tắc đang bật`;
  const dangSoan = typing[id];
  const bot = CHANNEL[conv.channel].bot;
  const goiY =
    conv.role === 'SUPPORT'
      ? conv.mode === 'BOT'
        ? `Đã chia cho ${conv.assignee?.fullName} nhưng chưa ai trả lời. Bạn trả lời trước thì nhận khách.`
        : `${conv.assignee?.fullName} phụ trách khách này. Tin bạn gửi ghi là hỗ trợ ${conv.assignee?.fullName}.`
      : conv.mode === 'BOT'
        ? conv.role === 'OWNER'
          ? `Bạn phụ trách khách này, ${bot} đang trả lời. Bạn trả lời thì ${bot} dừng.`
          : `${bot} đang trả lời khách này. Bạn trả lời thì nhận khách, ${bot} dừng.`
        : null;

  return (
    <div className="chat-composer max-h-[55%] overflow-y-auto max-md:max-h-1/2 max-md:pb-[max(8px,env(safe-area-inset-bottom))] flex min-w-0 shrink-0 flex-col gap-1.5 border-t border-line bg-surface px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-xs text-body">
        <span className="-my-2 flex shrink-0 origin-left scale-[0.8]">
          <Switch
            checked={conv.autoReplyOn}
            label="Bật trả lời tự động cho hội thoại này"
            onChange={(v) => patch<Conversation>(`/conversations/${id}`, { autoReplyOn: v }).then(onChange)}
          />
        </span>
        <span className="-ml-1.5 shrink-0 whitespace-nowrap">
          <strong className="font-semibold">Tự động</strong> · {autoText}
        </span>
        {goiY && <span className="hidden min-w-0 flex-1 truncate text-muted md:inline" title={goiY}>· {goiY}</span>}
        <Link to="/templates" className="ml-auto flex min-h-8 shrink-0 items-center px-1 text-xs text-body underline">
          Mẫu nhanh
        </Link>
      </div>

      {(dangSoan || conv.activeOther) && (
        <div role="status" className="flex items-center gap-2 text-xs font-medium text-amber-ink">
          <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-typing" />
          {dangSoan ? `${dangSoan} đang soạn tin cho khách này` : `${conv.activeOther?.fullName} đang nhắn với khách này`}
        </div>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 rounded-[10px] border-l-4 border-brand bg-page py-1 pl-2.5 pr-1 text-[0.8125rem]">
          <span className="min-w-0 flex-1 truncate">
            Trả lời: <span className="text-body">“{replyTo.text}”</span>
          </span>
          <button
            type="button"
            onClick={clearReply}
            aria-label="Bỏ trích tin"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-fill"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
      {tep && (
        <div className="flex items-center gap-2 rounded-[10px] border border-line bg-page py-1 pl-1.5 pr-1 text-[0.8125rem]">
          {xemTruoc ? (
            <img src={xemTruoc} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-brand">
              PDF
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{tep.name}</span>
            <span className="block text-xs text-body">{dungLuong(tep.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => setTep(null)}
            aria-label="Bỏ file đính kèm"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-fill"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
      {goiPhimTat.length > 0 && <ul aria-label="Gợi ý phím tắt" className="mb-2 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">{goiPhimTat.map((t) => <li key={t.id}><button type="button" onClick={() => chonGoiY(t)} className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-brand-soft"><code className="rounded bg-fill px-1.5 font-mono text-xs">/{t.shortcut}</code><strong className="truncate">{t.title}</strong></button></li>)}</ul>}
      <form onSubmit={gui} className="composer-input flex items-end gap-1.5 rounded-xl border border-field bg-surface p-1.5 focus-within:border-brand">
        <input
          ref={chonTep}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hidden
          onChange={(e) => {
            nhanTep(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => chonTep.current?.click()}
          aria-label="Đính kèm ảnh hoặc PDF"
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-field bg-surface hover:bg-fill"
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
          >
            <path d="m21 12-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
          </svg>
        </button>
        <textarea
          ref={textarea}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
              e.preventDefault();
              void guiThat(false);
            }
          }}
          aria-label="Tin nhắn gửi khách"
          placeholder="Nhập tin nhắn gửi khách"
          value={draft}
          onChange={(e) => go(e.target.value)}
          onSelect={(e) => { caret.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
          onPaste={(e) => {
            const f = Array.from(e.clipboardData.files)[0];
            if (f) {
              e.preventDefault();
              nhanTep(f);
            }
          }}
          maxLength={4000}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-normal"
        />
        <button type="button" title="Câu trả lời nhanh" aria-label="Câu trả lời nhanh" className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface shadow-sm text-brand-text hover:bg-brand-soft" onClick={() => setQuickOpen(true)}><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg></button>
        <button type="submit" disabled={dangGui || (!draft.trim() && !tep)} className={primaryClass}>
          {dangGui ? 'Đang gửi…' : 'Gửi'}
        </button>
      </form>
      <ErrorText>{loi}</ErrorText>

      {hoiLai && (
        <Dialog title="Đồng nghiệp đang nhắn" onClose={() => setHoiLai(null)}>
          <p className="text-sm text-body">{hoiLai} Khách có thể nhận 2 câu trả lời gần nhau.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={secondaryClass} onClick={() => setHoiLai(null)}>
              Để tôi chờ
            </button>
            <button type="button" className={primaryClass} disabled={dangGui} onClick={() => void guiThat(true)}>
              Vẫn gửi
            </button>
          </div>
        </Dialog>
      )}
      {quickOpen && <QuickReplyPicker onClose={() => { setQuickOpen(false); requestAnimationFrame(() => textarea.current?.focus()); }} onChoose={chooseQuick} />}
    </div>
  );
}

function HandoverDialog({ conv, onClose, onDone }: { conv: Conversation; onClose: () => void; onDone: (c: Conversation) => unknown }) {
  const { data: colleagues, error } = useSWR<(Person & { onDuty: boolean })[]>('/users/colleagues', fetcher);
  const ds = colleagues?.filter((c) => c.id !== conv.assignee?.id) ?? [];
  const [toUserId, setTo] = useState('');
  const [note, setNote] = useState('');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);

  const gui = async (e: FormEvent) => {
    e.preventDefault();
    if (!toUserId) {
      setLoi('Chọn người nhận');
      return;
    }
    setDang(true);
    setLoi('');
    try {
      await onDone(await post<Conversation>(`/conversations/${conv.id}/handover`, { toUserId, ...(note.trim() ? { note: note.trim() } : {}) }));
      onClose();
    } catch (err) {
      setLoi(loiCua(err));
      setDang(false);
    }
  };

  return (
    <Dialog title="Chuyển khách cho đồng nghiệp" onClose={onClose}>
      <form onSubmit={gui} className="flex flex-col gap-3">
        <Field label="Người nhận">
          <select value={toUserId} onChange={(e) => setTo(e.target.value)} className={inputClass}>
            <option value="">{colleagues ? (ds.length ? 'Chọn đồng nghiệp' : 'Không có đồng nghiệp nào') : 'Đang tải...'}</option>
            {ds.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.onDuty ? '' : ' (đang nghỉ)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ghi chú cho người nhận (không bắt buộc)">
          <textarea
            rows={3}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: khách hỏi đoàn 20 người, đã báo giá sơ bộ"
            className="w-full resize-y rounded-[10px] border border-field px-3 py-2.5 text-sm"
          />
        </Field>
        <p className="text-xs text-muted">Ghi chú nằm trong log nội bộ, khách không thấy.</p>
        <ErrorText>{error ? 'Không tải được danh sách đồng nghiệp.' : loi}</ErrorText>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>
            Huỷ
          </button>
          <button type="submit" disabled={dang} className={primaryClass}>
            Chuyển
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Admin toàn quyền xoá hẳn hội thoại (dọn dữ liệu thử). Hai bước: xác nhận, rồi nếu có đơn đã chốt thì cảnh báo thêm. */
function XoaHoiThoaiDialog({ id, ten, onClose, onXong }: { id: string; ten: string; onClose: () => void; onXong: () => void }) {
  const [donChot, setDonChot] = useState<{ count: number; amount: number } | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const xoa = async (force: boolean) => {
    setDang(true);
    setLoi('');
    try {
      await del(`/conversations/${id}${force ? '?force=1' : ''}`);
      onXong();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'HAS_DEALS') {
        const m = /(\d+) đơn/.exec(e.message);
        setDonChot({ count: Number(m?.[1] ?? 1), amount: 0 });
      } else setLoi(loiCua(e));
      setDang(false);
    }
  };
  return (
    <Dialog title="Xoá hội thoại" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Xoá hẳn hội thoại với <strong>{ten}</strong>? Toàn bộ tin nhắn, đơn, nhãn tour quan tâm và file đính kèm sẽ mất, <strong>không khôi phục được</strong>. Nếu khách không còn hội thoại nào khác thì khách cũng bị xoá.
        </p>
        {donChot && (
          <p role="alert" className="rounded-lg border border-alert-line bg-brand-faint px-3 py-2 text-sm text-brand-text">
            Hội thoại này có <strong>{donChot.count} đơn đã chốt</strong> đang tính vào doanh thu. Xoá sẽ làm số liệu thống kê doanh thu giảm theo. Bạn vẫn muốn xoá?
          </p>
        )}
        <ErrorText>{loi}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>Huỷ</button>
          <button type="button" disabled={dang} onClick={() => void xoa(!!donChot)} className={primaryClass}>
            {dang ? 'Đang xoá...' : donChot ? 'Vẫn xoá' : 'Xoá hội thoại'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Admin kéo tin cũ của khách Zalo từ Zalo về hội thoại (chỉ ghi lại, không báo nhân viên, không trả lời tự động). */
function DongBoZaloDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [dang, setDang] = useState(false);
  const [kq, setKq] = useState<{ them: number; tong: number } | null>(null);
  const [loi, setLoi] = useState('');
  const chay = async () => {
    setDang(true);
    setLoi('');
    try {
      setKq(await post<{ them: number; tong: number }>(`/conversations/${id}/zalo-history`));
      await globalMutate((k) => typeof k === 'string' && k.startsWith(`/conversations/${id}`), undefined, { revalidate: true });
    } catch (e) {
      setLoi(loiCua(e));
    } finally {
      setDang(false);
    }
  };
  return (
    <Dialog title="Đồng bộ tin cũ từ Zalo" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">Lấy lại các tin gần đây giữa OA và khách này từ Zalo (tối đa 50 tin). Tin đã có trong hệ thống được bỏ qua. Việc này chỉ ghi lại lịch sử, không gửi gì cho khách và không báo nhân viên.</p>
        {kq && <p role="status" className="rounded-lg border border-green-soft bg-green-soft/40 px-3 py-2 text-sm text-green-ink">{kq.tong === 0 ? 'Zalo không trả tin nào.' : `Đã thêm ${kq.them} tin cũ (Zalo trả ${kq.tong} tin).`}</p>}
        <ErrorText>{loi}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>Đóng</button>
          <button type="button" disabled={dang} onClick={() => void chay()} className={primaryClass}>{dang ? 'Đang lấy...' : kq ? 'Lấy lại' : 'Đồng bộ'}</button>
        </div>
      </div>
    </Dialog>
  );
}
