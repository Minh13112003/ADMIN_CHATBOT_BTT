import { useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher, linkTep, loiCua, patch, post, postForm } from '@/lib/api';
import { Dialog, ErrorText, Field, inputClass, primaryClass, secondaryClass } from './ui';

export type Sticker = { id: string; name: string; url: string; animated: boolean; width: number; height: number; packId: string | null; zaloStickerId?: string | null };
export type StickerPack = { id: string; name: string; active: boolean; count: number };

/** Nhóm sticker theo tệp, giữ thứ tự tệp; sticker chưa xếp tệp (hoặc tệp không còn trong danh sách) vào nhóm "Khác" ở cuối. */
export function nhomTheoTep(stickers: Sticker[], packs: StickerPack[]) {
  const ids = new Set(packs.map((p) => p.id));
  const nhom = packs.map((p) => ({ pack: p as StickerPack | null, rows: stickers.filter((s) => s.packId === p.id) }));
  const khac = stickers.filter((s) => !s.packId || !ids.has(s.packId));
  if (khac.length) nhom.push({ pack: null, rows: khac });
  return nhom;
}

export function StickerLibrary({ manage = false, onSelect }: { manage?: boolean; onSelect?: (sticker: Sticker) => void }) {
  const { data, error, isLoading, mutate } = useSWR<Sticker[]>('/stickers', fetcher);
  const packsKey = manage ? '/stickers/packs?all=1' : '/stickers/packs';
  const { data: packs, mutate: mutatePacks } = useSWR<StickerPack[]>(packsKey, fetcher);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [hide, setHide] = useState<Sticker | null>(null);
  const [uploadPack, setUploadPack] = useState('');
  const [packDialog, setPackDialog] = useState<{ pack: StickerPack | null; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lamMoi = async () => { await Promise.all([mutate(), mutatePacks()]); };

  // Chọn file xong thì mở hộp thoại để điền mã Zalo từng sticker (hoặc dán cả danh sách mã), rồi mới tải lên.
  const [moi, setMoi] = useState<{ file: File; xem: string; ma: string }[] | null>(null);
  const [dsMa, setDsMa] = useState('');

  const chonFile = (files: FileList | null) => {
    if (!files?.length) return;
    const ds = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
    const loi = ds.find((f) => !/\.(webp|gif)$/i.test(f.name) || f.size > 5 * 1024 * 1024);
    if (loi) { setErrorText(`${loi.name}: cần file .webp hoặc .gif tối đa 5 MB`); return; }
    setErrorText(''); setMessage(''); setDsMa('');
    setMoi(ds.map((file) => ({ file, xem: URL.createObjectURL(file), ma: '' })));
  };
  const dongMoi = () => { moi?.forEach((r) => URL.revokeObjectURL(r.xem)); setMoi(null); setDsMa(''); };
  // Mỗi dòng của danh sách mã điền vào một sticker theo thứ tự tên file (dòng trống bỏ qua ô đó).
  const apDungDsMa = () => {
    const dong = dsMa.split(/\r?\n/).map((x) => x.trim());
    setMoi((cu) => cu && cu.map((r, i) => ({ ...r, ma: dong[i] ?? r.ma })));
  };

  const upload = async () => {
    if (!moi?.length) return;
    setBusy(true); setErrorText(''); setMessage('');
    let count = 0;
    const hong: string[] = [];
    try {
      for (const [index, r] of moi.entries()) {
        // Backend giới hạn 20 upload/phút; giãn lượt khi chọn cả bộ sticker.
        if (index) await new Promise((resolve) => setTimeout(resolve, 3200));
        setMessage(`Đang tải ${index + 1}/${moi.length}: ${r.file.name}`);
        const form = new FormData();
        form.append('file', r.file);
        if (uploadPack) form.append('packId', uploadPack);
        if (r.ma.trim()) form.append('zaloStickerId', r.ma.trim());
        try { await postForm('/stickers', form); count++; } catch (e) { hong.push(`${r.file.name}: ${loiCua(e)}`); }
      }
    } finally {
      setMessage(count ? `Đã thêm ${count} sticker.` : '');
      if (hong.length) setErrorText(`Chưa tải được ${hong.length} sticker. ${hong.join(' · ')}`);
      dongMoi(); await lamMoi(); setBusy(false);
    }
  };

  const luuTep = async () => {
    if (!packDialog) return;
    setBusy(true); setErrorText('');
    try {
      if (packDialog.pack) await patch(`/stickers/packs/${packDialog.pack.id}`, { name: packDialog.name });
      else {
        const moi = await post<StickerPack>('/stickers/packs', { name: packDialog.name });
        setUploadPack(moi.id);
      }
      setPackDialog(null);
      await lamMoi();
    } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
  };

  const doiTrangThaiTep = async (p: StickerPack) => {
    setBusy(true); setErrorText('');
    try { await patch(`/stickers/packs/${p.id}`, { active: !p.active }); await lamMoi(); } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
  };

  const chuyenTep = async (s: Sticker, packId: string) => {
    setBusy(true); setErrorText('');
    try { await patch(`/stickers/${s.id}/pack`, { packId: packId || null }); await mutate(); await mutatePacks(); } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
  };

  const luuMaZalo = async (s: Sticker, ma: string) => {
    const moi = ma.trim();
    if (moi === (s.zaloStickerId ?? '')) return;
    setBusy(true); setErrorText(''); setMessage('');
    try { await patch(`/stickers/${s.id}/zalo`, { zaloStickerId: moi || null }); await mutate(); setMessage(moi ? `Đã gắn mã sticker Zalo cho ${s.name}.` : `Đã gỡ mã sticker Zalo của ${s.name}.`); } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
  };

  const tim = search.toLocaleLowerCase('vi');
  const rows = (data ?? []).filter((s) => s.name.toLocaleLowerCase('vi').includes(tim));
  const dsTep = packs ?? [];
  // Admin thấy cả tệp đang ẩn (không có sticker trong danh sách vì backend chỉ trả sticker dùng được).
  const nhom = nhomTheoTep(rows, dsTep).filter((g) => (manage && g.pack && !search) || g.rows.length);

  return <div className="flex min-w-0 flex-col gap-4">
    {manage && <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-col gap-1 text-sm font-medium">
        Tải vào tệp
        <select value={uploadPack} disabled={busy} onChange={(e) => setUploadPack(e.target.value)} className={inputClass}>
          <option value="">Chưa xếp tệp</option>
          {dsTep.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy} className={secondaryClass} onClick={() => setPackDialog({ pack: null, name: '' })}>Tạo tệp mới</button>
      <input ref={input} type="file" multiple hidden accept=".webp,image/webp,.gif,image/gif" onChange={(e) => { chonFile(e.target.files); e.target.value = ''; }} />
      <button type="button" disabled={busy} className={primaryClass} onClick={() => input.current?.click()}>{busy ? 'Đang xử lý…' : 'Tải sticker lên'}</button>
      <p className="basis-full text-sm text-muted">File WebP hoặc GIF tối đa 5 MB. Chọn nhiều file một lần thì hộp thoại hiện ra để điền mã Zalo cho từng sticker, hoặc dán cả danh sách mã. Giữ chuyển động nếu ảnh gốc là ảnh động. File GIF được giữ nguyên bản gốc để gửi sang Zalo. Ô "Mã sticker Zalo" dưới mỗi sticker: điền mã thì khách Zalo nhận sticker có sẵn của Zalo (chuyển động được); lấy mã bằng cách gửi sticker đó vào Zalo OA, mã hiện ở tin của khách.</p>
    </div>}
    <input type="search" aria-label="Tìm sticker" placeholder="Tìm sticker theo tên…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 w-full rounded-xl border border-field bg-surface px-3 text-sm" />
    {message && <p role="status" className="text-sm text-brand-text">{message}</p>}
    <ErrorText>{errorText || (error ? loiCua(error) : '')}</ErrorText>
    {error && <button type="button" className={secondaryClass} onClick={() => void lamMoi()}>Thử lại</button>}
    {isLoading && <p role="status" className="text-sm text-muted">Đang tải kho sticker…</p>}
    {!isLoading && !error && !nhom.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{search ? 'Không tìm thấy sticker phù hợp.' : manage ? 'Chưa có sticker. Tạo tệp rồi tải file WebP hoặc GIF đầu tiên để cả nhóm cùng sử dụng.' : 'Kho sticker đang trống. Nhờ quản trị viên tải sticker lên.'}</p>}

    {nhom.map(({ pack, rows: ds }) => <section key={pack?.id ?? 'khac'} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <h2 className="text-base font-semibold">{pack ? pack.name : 'Khác (chưa xếp tệp)'}</h2>
        <span className="text-xs text-muted">{pack ? `${pack.count} sticker` : `${ds.length} sticker`}</span>
        {pack && !pack.active && <span className="rounded-full bg-fill px-2 py-0.5 text-xs text-muted">Đang ẩn</span>}
        {manage && pack && <div className="ml-auto flex gap-2">
          <button type="button" disabled={busy} className="min-h-11 px-2 text-sm text-brand-text underline" onClick={() => setPackDialog({ pack, name: pack.name })}>Đổi tên</button>
          <button type="button" disabled={busy} className="min-h-11 px-2 text-sm text-muted underline hover:text-ink" onClick={() => void doiTrangThaiTep(pack)}>{pack.active ? 'Ẩn tệp' : 'Hiện lại tệp'}</button>
        </div>}
      </div>
      {pack && !pack.active ? <p className="text-sm text-muted">Tệp đang ẩn: sale không thấy sticker trong tệp này. Bấm "Hiện lại tệp" để dùng lại.</p>
        : !ds.length ? <p className="text-sm text-muted">Tệp chưa có sticker.</p>
        : <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {ds.map((s) => <div key={s.id} className="min-w-0 rounded-xl border border-line bg-page p-2">
            <button type="button" disabled={!onSelect} aria-label={`Chọn sticker ${s.name}`} onClick={() => onSelect?.(s)} className="flex min-h-20 w-full flex-col items-center gap-2 rounded-lg p-1 enabled:hover:bg-brand-soft">
              <img src={linkTep(s.url)} alt={s.name} loading="lazy" className="h-20 w-full object-contain sm:h-24" />
              <span className="w-full truncate text-center text-xs" title={s.name}>{s.name}</span>
              <span className="text-[11px] text-muted">{s.animated ? 'Ảnh động' : 'Ảnh tĩnh'}</span>
            </button>
            {manage && <>
              <select aria-label={`Tệp của sticker ${s.name}`} value={s.packId ?? ''} disabled={busy} onChange={(e) => void chuyenTep(s, e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-field bg-surface px-1 text-xs">
                <option value="">Chưa xếp tệp</option>
                {dsTep.filter((p) => p.active || p.id === s.packId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input key={`${s.id}-${s.zaloStickerId ?? ''}`} defaultValue={s.zaloStickerId ?? ''} maxLength={100} disabled={busy} placeholder="Mã sticker Zalo" aria-label={`Mã sticker Zalo của ${s.name}`}
                onBlur={(e) => void luuMaZalo(s, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="mt-1 min-h-11 w-full rounded-lg border border-field bg-surface px-2 text-xs" />
              <button type="button" disabled={busy} className="min-h-11 w-full text-xs text-muted underline hover:text-ink" onClick={() => setHide(s)}>Ẩn khỏi kho</button>
            </>}
          </div>)}
        </div>}
    </section>)}

    {moi && <Dialog title={`Thêm ${moi.length} sticker`} onClose={() => { if (!busy) dongMoi(); }}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tải vào tệp
          <select value={uploadPack} disabled={busy} onChange={(e) => setUploadPack(e.target.value)} className={inputClass}>
            <option value="">Chưa xếp tệp</option>
            {dsTep.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <details className="rounded-xl border border-line bg-page p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">Dán một lần danh sách mã sticker Zalo</summary>
          <p className="mb-2 text-muted">Mỗi dòng một mã, điền lần lượt cho các sticker bên dưới theo thứ tự tên file (dòng trống thì bỏ qua sticker đó).</p>
          <textarea value={dsMa} onChange={(e) => setDsMa(e.target.value)} rows={5} aria-label="Danh sách mã sticker Zalo" className={`${inputClass} font-mono text-xs`} placeholder={'fe341d6f212ac874913b\nccc330980cdde583bccc'} />
          <button type="button" disabled={!dsMa.trim() || busy} onClick={apDungDsMa} className={`${secondaryClass} mt-2`}>Điền mã vào danh sách</button>
        </details>
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {moi.map((r, i) => <li key={r.xem} className="flex items-center gap-3 rounded-xl border border-line bg-page p-2">
            <img src={r.xem} alt="" className="size-14 shrink-0 rounded-lg object-contain" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs font-medium" title={r.file.name}>{r.file.name}</span>
              <input value={r.ma} maxLength={100} disabled={busy} placeholder="Mã sticker Zalo (không bắt buộc)" aria-label={`Mã sticker Zalo của ${r.file.name}`}
                onChange={(e) => setMoi((cu) => cu && cu.map((x, j) => (j === i ? { ...x, ma: e.target.value } : x)))} className="min-h-11 w-full rounded-lg border border-field bg-surface px-2 text-xs" />
            </div>
            <button type="button" disabled={busy} aria-label={`Bỏ ${r.file.name}`} className="grid size-11 shrink-0 place-items-center text-muted hover:text-ink"
              onClick={() => { URL.revokeObjectURL(r.xem); setMoi((cu) => { const con = cu ? cu.filter((_, j) => j !== i) : null; return con?.length ? con : null; }); }}>×</button>
          </li>)}
        </ul>
        {message && <p role="status" className="text-sm text-brand-text">{message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} className={secondaryClass} onClick={dongMoi}>Huỷ</button>
          <button type="button" disabled={busy} className={primaryClass} onClick={() => void upload()}>{busy ? 'Đang tải…' : `Tải lên ${moi.length} sticker`}</button>
        </div>
      </div>
    </Dialog>}

    {packDialog && <Dialog title={packDialog.pack ? 'Đổi tên tệp sticker' : 'Tạo tệp sticker'} onClose={() => { if (!busy) setPackDialog(null); }}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void luuTep(); }}>
        <Field label="Tên tệp">
          <input autoFocus maxLength={60} value={packDialog.name} onChange={(e) => setPackDialog({ ...packDialog, name: e.target.value })} placeholder="Ví dụ: Mèo Ami" className={inputClass} />
        </Field>
        <ErrorText>{errorText}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} className={secondaryClass} onClick={() => setPackDialog(null)}>Huỷ</button>
          <button type="submit" disabled={busy || !packDialog.name.trim()} className={primaryClass}>{packDialog.pack ? 'Lưu tên' : 'Tạo tệp'}</button>
        </div>
      </form>
    </Dialog>}

    {hide && <Dialog title="Ẩn sticker khỏi kho?" onClose={() => { if (!busy) setHide(null); }}>
      <p className="text-sm">Ẩn “{hide.name}” để không chọn gửi thêm. Sticker trong các tin đã gửi vẫn được giữ lại.</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} className={secondaryClass} onClick={() => setHide(null)}>Huỷ</button><button type="button" disabled={busy} className={primaryClass} onClick={async () => {
        setBusy(true); setErrorText('');
        try { await patch(`/stickers/${hide.id}/hide`, {}); setHide(null); await lamMoi(); } catch (e) { setErrorText(loiCua(e)); } finally { setBusy(false); }
      }}>Ẩn sticker</button></div>
    </Dialog>}
  </div>;
}
