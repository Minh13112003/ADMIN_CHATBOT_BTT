import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { ErrorText } from "@/components/ui";
import { del, fetcher, loiCua, patch, post } from "@/lib/api";
import { prepareQuickReply } from "@/lib/quick-reply";
import type { Template } from "@/lib/types";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");

/** Biến có thể chèn vào nội dung. Chỉ {tên khách} và {tên nhân viên} được thay tự động khi chèn; biến khác để nguyên cho nhân viên điền. */
const BIEN = [
  "{tên khách}",
  "{tên nhân viên}",
  "{mã tour}",
  "{tên tour}",
  "{giá tour}",
  "{ngày khởi hành}",
  "{số tiền cọc}",
  "{số hotline}",
];
const inputBox =
  "transition-[border-color,box-shadow] duration-150 hover:border-muted min-h-11 w-full rounded-[10px] border border-field bg-surface px-3 text-sm text-ink";

export default function QuickLibrary() {
  const { data, error, mutate } = useSWR<Template[]>("/templates", fetcher);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [category, setCategory] = useState("");
  const [mobileEditor, setMobileEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const chosen = data?.find((t) => t.id === selected);

  useEffect(() => {
    if (creating) {
      setTitle("");
      setBody("");
      setShortcut("");
      setCategory("");
    } else if (chosen) {
      setTitle(chosen.title);
      setBody(chosen.body);
      setShortcut(chosen.shortcut ?? "");
      setCategory(chosen.category ?? "");
    }
  }, [selected, creating, chosen?.title, chosen?.body, chosen?.shortcut, chosen?.category]);

  const choose = (id: string) => {
    setSelected(id);
    setCreating(false);
    setMobileEditor(true);
    setConfirmDelete(false);
    setMessage("");
  };
  const create = () => {
    setCreating(true);
    setSelected(null);
    setMobileEditor(true);
    setMessage("");
  };
  const insertVar = (v: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + v + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + v.length, start + v.length);
    });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const payload = {
      title,
      body,
      shortcut: shortcut.trim() || undefined,
      category: category.trim() || undefined,
    };
    try {
      const result = creating
        ? await post<Template>("/templates", payload)
        : await patch<Template>(`/templates/${selected}`, payload);
      await mutate();
      setSelected(result.id);
      setCreating(false);
      setMessage("Đã lưu mẫu trả lời.");
    } catch (err) {
      setMessage(loiCua(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!selected || !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await del(`/templates/${selected}`);
      await mutate();
      setSelected(null);
      setMobileEditor(false);
      setConfirmDelete(false);
      setMessage("Đã xoá mẫu.");
    } catch (err) {
      setMessage(loiCua(err));
    } finally {
      setBusy(false);
    }
  };

  const groups = Array.from(new Set((data ?? []).map((t) => t.category).filter((c): c is string => !!c)));
  const filtered =
    data?.filter(
      (t) =>
        (!group || t.category === group) &&
        normalize(`${t.title} ${t.body} ${t.shortcut ?? ""}`).includes(normalize(query)),
    ) ?? [];
  const showEditor = creating || !!selected;
  const preview = prepareQuickReply(body, "anh Bách", "Mai Phương", { tourName: "Pháp - Thụy Sĩ - Ý 10N9Đ", tourCode: "EUR-PARIS-2025-02", amount: 69900000 });

  return (
    <div className="grid min-h-[540px] grid-cols-[360px_minmax(0,1fr)] overflow-hidden rounded-[14px] border border-line bg-surface max-md:grid-cols-[minmax(0,1fr)]">
      <section className={`min-w-0 border-r border-line max-md:border-r-0 ${mobileEditor ? "hidden md:block" : ""}`}>
        <div className="flex items-center justify-between gap-2 p-4">
          <h2 className="text-sm font-semibold">Danh sách mẫu câu</h2>
          <button className="inline-flex min-h-11 items-center rounded-[10px] bg-brand-button px-4 text-sm font-semibold text-white hover:bg-brand-dark" onClick={create}>
            + Thêm mẫu
          </button>
        </div>
        <div className="px-3 pb-2">
          <input aria-label="Tìm mẫu trả lời" placeholder="Tìm kiếm tiêu đề, nội dung mẫu..." value={query} onChange={(e) => setQuery(e.target.value)} className={inputBox} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 pb-3" role="group" aria-label="Lọc theo nhóm">
          {[{ key: "", label: `Tất cả (${data?.length ?? 0})` }, ...groups.map((g) => ({ key: g, label: g }))].map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-semibold ${group === g.key ? "bg-strong text-on-strong" : "bg-fill text-body"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {!data && !error && <p className="p-4 text-sm text-muted">Đang tải mẫu...</p>}
          {error && (
            <p className="p-4 text-sm text-brand-text">
              Không tải được mẫu.{" "}
              <button className="underline" onClick={() => void mutate()}>Thử lại</button>
            </p>
          )}
          {data?.length === 0 && <p className="p-4 text-sm text-muted">Chưa có mẫu nào, bấm Thêm mẫu.</p>}
          {data && data.length > 0 && filtered.length === 0 && <p className="p-4 text-sm text-muted">Không tìm thấy mẫu phù hợp.</p>}
          {filtered.map((t) => (
            <button
              key={t.id}
              className={`block w-full border-b border-line-soft p-4 text-left hover:bg-fill ${selected === t.id ? "border-l-4 border-l-brand bg-brand-soft" : ""}`}
              onClick={() => choose(t.id)}
            >
              <span className="flex items-start justify-between gap-2">
                <strong className={`text-sm ${selected === t.id ? "text-brand-text" : ""}`}>{t.title}</strong>
                <span className="shrink-0 text-xs text-muted">Dùng {t.useCount ?? 0} lần</span>
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{t.body}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {t.category && <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-blue-ink">#{t.category}</span>}
                {t.shortcut && <span className="rounded bg-fill px-1.5 py-0.5 font-mono text-[0.6875rem] text-body">Phím tắt: /{t.shortcut}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={`min-w-0 p-6 max-md:p-4 ${!mobileEditor && !showEditor ? "hidden md:block" : ""}`}>
        <button className="mb-4 text-sm text-brand-text md:hidden" onClick={() => setMobileEditor(false)}>← Danh sách mẫu</button>
        {showEditor ? (
          <form onSubmit={save} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{creating ? "Thêm mẫu trả lời nhanh" : "Chỉnh sửa mẫu trả lời nhanh"}</h2>
                <p className="mt-1 text-xs text-muted">
                  {shortcut ? <>Tư vấn viên có thể gõ phím tắt <code className="rounded bg-brand-soft px-1 font-mono text-brand-text">/{shortcut}</code> trong khung chat để chèn nhanh mẫu này.</> : "Đặt phím tắt để tư vấn viên gõ nhanh trong khung chat."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!creating && (
                  <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-11 rounded-[10px] border border-alert-line bg-brand-faint px-4 text-sm font-semibold text-brand-text">
                    {confirmDelete ? "Bấm lần nữa để xoá" : "Xoá mẫu (Nhấn 2 lần)"}
                  </button>
                )}
                <button type="submit" disabled={busy} className="min-h-11 rounded-[10px] bg-brand-button px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">Lưu mẫu</button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_160px]">
              <label className="block text-sm font-semibold">Tiêu đề mẫu trả lời <span className="text-brand-text">*</span>
                <input required maxLength={80} className={`${inputBox} mt-1.5 font-normal`} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block text-sm font-semibold">Mã phím tắt gõ nhanh
                <span className="relative mt-1.5 block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">/</span>
                  <input maxLength={20} placeholder="bg-eu" className={`${inputBox} pl-7 font-mono font-normal`} value={shortcut} onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} />
                </span>
              </label>
              <label className="block text-sm font-semibold">Nhóm
                <input list="nhom-mau" maxLength={30} placeholder="Visa" className={`${inputBox} mt-1.5 font-normal`} value={category} onChange={(e) => setCategory(e.target.value.replace(/\s+/g, ""))} />
                <datalist id="nhom-mau">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              </label>
            </div>

            <div className="rounded-xl border border-dashed border-line p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <strong className="text-sm">Biến dữ liệu động (bấm để chèn vào vị trí con trỏ):</strong>
                <span className="text-muted">Tự điền khi chèn: tên khách, tên nhân viên, mã tour, tên tour, giá tour (lấy từ đơn gần nhất của khách). Biến khác giữ nguyên để nhân viên nhập.</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BIEN.map((v) => (
                  <button key={v} type="button" onClick={() => insertVar(v)} className="min-h-9 rounded-lg border border-alert-line bg-brand-faint px-2.5 font-mono text-xs text-brand-text hover:bg-brand-soft">+ {v}</button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold">
              <span className="flex items-center justify-between">
                <span>Nội dung tin nhắn mẫu <span className="text-brand-text">*</span></span>
                <span className="text-xs font-normal text-muted">Đã nhập: {body.length}/2000</span>
              </span>
              <textarea ref={area} required maxLength={2000} rows={9} className={`${inputBox} mt-1.5 resize-y py-2.5 font-normal leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <ErrorText>{message}</ErrorText>

            <div className="rounded-xl border border-line bg-page p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 rounded-full bg-blue-ink" />Giao diện xem trước thực tế (Khách hàng sẽ nhìn thấy)</h3>
                <span className="rounded bg-fill px-2 py-0.5 text-[0.6875rem] text-muted">Mô phỏng dữ liệu khách</span>
              </div>
              <div className="flex gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill text-xs font-bold">TH</span>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-2 text-sm">Cho tôi xin báo giá tour Châu Âu nhé!</div>
              </div>
              <div className="mt-3 ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-alert-line bg-brand-soft px-3 py-2 text-sm">
                {preview || "Nội dung mẫu sẽ hiển thị ở đây."}
              </div>
            </div>
          </form>
        ) : (
          <p className="p-8 text-center text-muted">Chọn một mẫu để xem và chỉnh sửa.</p>
        )}
      </section>
    </div>
  );
}
