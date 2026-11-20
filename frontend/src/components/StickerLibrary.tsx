import { useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher, linkTep, loiCua, patch, postForm } from '@/lib/api';
import { Dialog, ErrorText, primaryClass, secondaryClass } from './ui';

export type Sticker = { id: string; name: string; url: string; animated: boolean; width: number; height: number };

export function StickerLibrary({ manage = false, onSelect }: { manage?: boolean; onSelect?: (sticker: Sticker) => void }) {
  const { data, error, isLoading, mutate } = useSWR<Sticker[]>('/stickers', fetcher);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [hide, setHide] = useState<Sticker | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErrorText(''); setMessage('');
    let count = 0;
    try {
      const batch = Array.from(files);
      for (const [index, file] of batch.entries()) {
        // Backend giới hạn 20 upload/phút; giãn lượt khi chọn cả bộ sticker.
        if (index) await new Promise((resolve) => setTimeout(resolve, 3200));
        setMessage(`Đang tải ${index + 1}/${batch.length}: ${file.name}`);
        if (!/\.webp$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: cần file .webp tối đa 5 MB`);
        const form = new FormData(); form.append('file', file);
        await postForm('/stickers', form); count++;
      }
    } catch (e) { setErrorText(loiCua(e)); }
    finally { setMessage(count ? `Đã thêm ${count} sticker.` : ''); await mutate(); setBusy(false); }
  };
  const rows = data?.filter((s) => s.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <div className="flex min-w-0 flex-col gap-4">
    {manage && <div className="flex flex-wrap items-center gap-3">
      <input ref={input} type="file" multiple hidden accept=".webp,image/webp" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
      <button type="button" disabled={busy} className={primaryClass} onClick={() => input.current?.click()}>{busy ? 'Đang xử lý sticker…' : 'Tải sticker lên'}</button>
      <p className="text-sm text-muted">File WebP tối đa 5 MB. Giữ chuyển động nếu ảnh gốc là ảnh động.</p>
    </div>}
    <input type="search" aria-label="Tìm sticker" placeholder="Tìm sticker theo tên…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 w-full rounded-xl border border-field bg-surface px-3 text-sm" />
    {message && <p role="status" className="text-sm text-brand-text">{message}</p>}
    <ErrorText>{errorText || (error ? loiCua(error) : '')}</ErrorText>
    {error && <button type="button" className={secondaryClass} onClick={() => void mutate()}>Thử lại</button>}
    {isLoading && <p role="status" className="text-sm text-muted">Đang tải kho sticker…</p>}
    {!isLoading && !error && !rows?.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{search ? 'Không tìm thấy sticker phù hợp.' : manage ? 'Chưa có sticker. Tải file WebP đầu tiên để cả nhóm cùng sử dụng.' : 'Kho sticker đang trống. Nhờ quản trị viên tải sticker lên.'}</p>}
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {rows?.map((s) => <div key={s.id} className="min-w-0 rounded-xl border border-line bg-page p-2">
        <button type="button" disabled={!onSelect} aria-label={`Chọn sticker ${s.name}`} onClick={() => onSelect?.(s)} className="flex min-h-20 w-full flex-col items-center gap-2 rounded-lg p-1 enabled:hover:bg-brand-soft">
          <img src={linkTep(s.url)} alt={s.name} loading="lazy" className="h-20 w-full object-contain sm:h-24" />
          <span className="w-full truncate text-center text-xs" title={s.name}>{s.name}</span>
          <span className="text-[11px] text-muted">{s.animated ? 'Ảnh động' : 'Ảnh tĩnh'}</span>
        </button>
        {manage && <button type="button" disabled={busy} className="min-h-11 w-full text-xs text-muted underline hover:text-ink" onClick={() => setHide(s)}>Ẩn khỏi kho</button>}
      </div>)}
    </div>
    {hide && <Dialog title="Ẩn sticker khỏi kho?" onClose={() => { if (!busy) setHide(null); }}>
      <p className="text-sm">Ẩn “{hide.name}” để không chọn gửi thêm. Sticker trong các tin đã gửi vẫn được giữ lại.</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} className={secondaryClass} onClick={() => setHide(null)}>Huỷ</button><button type="button" disabled={busy} className={primaryClass} onClick={async () => {
        setBusy(true); setErrorText('');
        try { await patch(`/stickers/${hide.id}/hide`, {}); setHide(null); await mutate(); } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
      }}>Ẩn sticker</button></div>
    </Dialog>}
  </div>;
}
