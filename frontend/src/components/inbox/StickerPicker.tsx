import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { fetcher, linkTep, loiCua } from '@/lib/api';
import { nhomTheoTep, type Sticker, type StickerPack } from '../StickerLibrary';

export function rememberSticker(userId: string, id: string) {
  try {
    const key = `btt_recent_stickers_${userId}`;
    const old = JSON.parse(localStorage.getItem(key) ?? '[]');
    localStorage.setItem(key, JSON.stringify([id, ...(Array.isArray(old) ? old.filter((x) => x !== id && typeof x === 'string') : [])].slice(0, 24)));
  } catch { /* Không có bộ nhớ trình duyệt vẫn gửi được. */ }
}

export function StickerPicker({ anchor, userId, onClose, onSelect }: {
  anchor: RefObject<HTMLButtonElement | null>; userId: string; onClose: () => void; onSelect: (s: Sticker) => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<Sticker[]>('/stickers', fetcher);
  const { data: packs } = useSWR<StickerPack[]>('/stickers/packs', fetcher);
  const panel = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  // 'recent' = đã gửi gần đây, 'all' = tất cả theo tệp, còn lại là mã tệp ('khac' = chưa xếp tệp).
  const [tab, setTab] = useState('all');
  const [position, setPosition] = useState({ left: 8, bottom: 80, width: 352, maxHeight: 400 });
  const [recent] = useState<string[]>(() => {
    try { const ids = JSON.parse(localStorage.getItem(`btt_recent_stickers_${userId}`) ?? '[]'); return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []; } catch { return []; }
  });
  useEffect(() => {
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(352, window.innerWidth - 16);
      const topSpace = box.top - 16;
      setPosition({ width, left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
        bottom: window.innerHeight - box.top + 8, maxHeight: Math.max(120, Math.min(420, topSpace)) });
    };
    place(); searchInput.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.current?.focus(); }
    };
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [anchor, onClose]);
  const all = data ?? [];
  const tim = search.toLocaleLowerCase('vi');
  const khop = (s: Sticker) => s.name.toLocaleLowerCase('vi').includes(tim);
  const recentAll = recent.flatMap((id) => all.filter((s) => s.id === id));
  const nhom = nhomTheoTep(all, packs ?? []).filter((g) => g.rows.length);
  const tabs = nhom.map((g) => ({ key: g.pack?.id ?? 'khac', label: g.pack?.name ?? 'Khác' }));
  // Tab tệp đã bị ẩn / hết sticker thì quay về "Tất cả".
  const tabHienTai = tab === 'recent' || tab === 'all' || tabs.some((t) => t.key === tab) ? tab : 'all';
  // Đang tìm kiếm thì tìm trên mọi tệp.
  const sections: { title: string; rows: Sticker[] }[] = search
    ? [{ title: 'Kết quả tìm kiếm', rows: all.filter(khop) }]
    : tabHienTai === 'recent' ? [{ title: 'Đã gửi gần đây', rows: recentAll }]
    : tabHienTai === 'all' ? [...(recentAll.length ? [{ title: 'Gần đây', rows: recentAll.slice(0, 8) }] : []), ...nhom.map((g) => ({ title: g.pack?.name ?? 'Khác', rows: g.rows }))]
    : nhom.filter((g) => (g.pack?.id ?? 'khac') === tabHienTai).map((g) => ({ title: g.pack?.name ?? 'Khác', rows: g.rows }));
  const coSticker = sections.some((s) => s.rows.length);
  const tabClass = (on: boolean) => `min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-medium ${on ? 'bg-brand-soft text-brand-text' : 'text-muted hover:bg-fill'}`;
  const grid = (rows: Sticker[]) => <div className="grid grid-cols-4 gap-1">{rows.map((s) => <button key={s.id} type="button" title={s.name} aria-label={`Chọn sticker ${s.name}`} onClick={() => onSelect(s)} className="aspect-square min-h-11 min-w-0 rounded-lg p-1.5 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
    <img src={linkTep(s.url)} alt={s.name} loading="lazy" className="h-full w-full object-contain" />
  </button>)}</div>;
  return createPortal(<div ref={panel} id="chat-sticker-picker" role="dialog" aria-label="Kho sticker" style={position} className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
    <div className="flex shrink-0 items-center border-b border-line px-3"><strong className="border-b-2 border-brand py-3 text-xs uppercase tracking-wide text-brand-text">Sticker</strong><button type="button" aria-label="Đóng kho sticker" onClick={() => { onClose(); anchor.current?.focus(); }} className="ml-auto grid size-11 place-items-center text-muted">×</button></div>
    <div className="shrink-0 px-3 py-2"><input ref={searchInput} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm sticker" aria-label="Tìm kiếm sticker" className="min-h-11 w-full rounded-full border border-field bg-page px-3 text-sm" /></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
      {isLoading && <p role="status" className="py-6 text-center text-sm text-muted">Đang tải sticker…</p>}
      {error && <div role="alert" className="py-4 text-sm"><p>{loiCua(error)}</p><button type="button" onClick={() => void mutate()} className="min-h-11 text-brand-text underline">Thử lại</button></div>}
      {!isLoading && !error && !coSticker && <p className="py-6 text-center text-sm text-muted">{search ? 'Không tìm thấy sticker.' : tabHienTai === 'recent' ? 'Sticker bạn gửi sẽ xuất hiện ở đây.' : 'Chưa có sticker. Nhờ admin thêm vào kho.'}</p>}
      {sections.filter((s) => s.rows.length).map((s, i) => <section key={`${i}-${s.title}`}><h3 className="py-2 text-xs font-semibold text-muted">{s.title} · {s.rows.length}</h3>{grid(s.rows)}</section>)}
    </div>
    <div role="tablist" aria-label="Tệp sticker" className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-line px-2 py-1">
      <button type="button" role="tab" aria-selected={tabHienTai === 'recent'} title="Gần đây" aria-label="Sticker gần đây" onClick={() => setTab('recent')} className={`grid size-11 shrink-0 place-items-center rounded-lg ${tabHienTai === 'recent' ? 'bg-brand-soft text-brand-text' : 'text-muted'}`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>
      <button type="button" role="tab" aria-selected={tabHienTai === 'all'} onClick={() => setTab('all')} className={tabClass(tabHienTai === 'all')}>Tất cả</button>
      {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tabHienTai === t.key} onClick={() => setTab(t.key)} className={tabClass(tabHienTai === t.key)}>{t.label}</button>)}
    </div>
  </div>, document.body);
}
