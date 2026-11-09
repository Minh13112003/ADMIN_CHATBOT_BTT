import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import useSWR from "swr";
import { fetcher, post } from "@/lib/api";
import type { Template } from "@/lib/types";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
export function QuickReplyPicker({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (body: string) => void;
}) {
  const { data, error, mutate } = useSWR<Template[]>("/templates", fetcher);
  const dung = (t: Template) => {
    void post(`/templates/${t.id}/use`).catch(() => undefined);
    onChoose(t.body);
  };
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  const [selected, setSelected] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const rows = useMemo(
    () =>
      data?.filter((t) =>
        normalize(`${t.title} ${t.body}`).includes(normalize(query.trim())),
      ) ?? [],
    [data, query],
  );
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    setSelected(0);
  }, [query]);
  useEffect(() => {
    if (preview) previewRef.current?.querySelector('button')?.focus();
    else searchRef.current?.focus();
  }, [preview]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (preview) setPreview(null);
        else onClose();
      }
      if (event.key === "Tab") {
        const scope = preview ? previewRef.current : dialogRef.current;
        const controls = Array.from(scope?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
        return;
      }
      if (preview) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((n) => Math.min(n + 1, rows.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((n) => Math.max(n - 1, 0));
      }
      if (event.key === "Enter" && (event.target === searchRef.current || event.target === document.body) && rows[selected]) {
        event.preventDefault();
        dung(rows[selected]);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose, onChoose, preview, rows, selected]);
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[rgb(12_18_28/55%)] p-4 max-md:p-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Câu trả lời nhanh"
        className="flex max-h-[80dvh] w-[min(720px,100%)] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_22px_80px_rgb(0_0_0/20%)] max-md:h-dvh max-md:max-h-none max-md:w-full max-md:rounded-none"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <span
            aria-hidden="true"
            className="rounded-lg bg-brand-soft p-2 text-brand-text"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Câu trả lời nhanh</h2>
            <p className="text-sm text-muted">
              Chọn mẫu để chèn vào khung hội thoại
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng câu trả lời nhanh"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-lg hover:bg-fill"
          >
            ×
          </button>
        </header>
        <div className="p-4">
          <input
            ref={searchRef}
            aria-label="Tìm theo tiêu đề hoặc nội dung"
            placeholder="Tìm theo tiêu đề hoặc nội dung..."
            className="w-full rounded-lg border border-field bg-surface px-3 py-2.5"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 grid grid-cols-[1fr_2fr] bg-fill py-2.5 pl-5 pr-14 text-xs font-bold text-muted max-md:hidden">
            <span>Tiêu đề</span>
            <span>Nội dung mẫu</span>
          </div>
          {!data && !error && (
            <p className="p-6 text-center text-muted">Đang tải mẫu câu...</p>
          )}
          {error && (
            <p className="p-6 text-center text-brand-text">
              Không tải được mẫu câu.{" "}
              <button className="underline" onClick={() => void mutate()}>
                Thử lại
              </button>
            </p>
          )}
          {data && data.length === 0 && (
            <p className="p-6 text-center text-muted">
              Chưa có mẫu nào.{" "}
              <Link
                className="text-brand-text underline"
                to="/templates"
                onClick={onClose}
              >
                Mở Thư viện trả lời
              </Link>
            </p>
          )}
          {data && data.length > 0 && rows.length === 0 && (
            <p className="p-6 text-center text-muted">
              Không tìm thấy mẫu phù hợp.
            </p>
          )}
          {rows.map((t, i) => (
            <div
              key={t.id}
              className={`flex min-h-16 items-stretch border-t border-line-soft hover:bg-brand-soft hover:shadow-[inset_4px_0_var(--color-brand)] max-md:min-h-[72px] ${selected === i ? "bg-brand-soft shadow-[inset_4px_0_var(--color-brand)]" : ""}`}
            >
              <button
                type="button"
                className="grid min-w-0 flex-1 grid-cols-[1fr_2fr] items-center gap-4 py-2.5 pl-5 pr-2 text-left text-[0.8125rem] max-md:flex max-md:flex-col max-md:items-start max-md:gap-[3px] [&>*]:min-w-0"
                onMouseEnter={() => setSelected(i)}
                onClick={() => dung(t)}
              >
                <strong className="truncate">{t.title}{t.shortcut ? <span className="ml-2 font-mono text-xs font-normal text-muted">/{t.shortcut}</span> : null}</strong>
                <span className="line-clamp-2 text-body">{t.body}</span>
              </button>
              <button
                type="button"
                aria-label={`Xem toàn bộ nội dung ${t.title}`}
                className="grid w-12 shrink-0 place-items-center text-body"
                onClick={() => setPreview(t)}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <footer className="flex justify-end border-t border-line p-4">
          <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" to="/templates" onClick={onClose}>
            Quản lý mẫu câu
          </Link>
        </footer>
      </section>
      {preview && (
        <div
          className="fixed inset-0 z-[75] grid place-items-center bg-[rgb(12_18_28/25%)] p-4 max-md:items-end max-md:p-0"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <section
            ref={previewRef}
            role="dialog"
            aria-modal="true"
            aria-label="Toàn bộ nội dung mẫu"
            className="flex max-h-[65dvh] w-[min(420px,100%)] flex-col overflow-hidden rounded-2xl border border-brand bg-surface shadow-[0_20px_70px_rgb(0_0_0/20%)] max-md:max-h-[50dvh] max-md:w-full max-md:rounded-b-none max-md:rounded-t-3xl max-md:border-line"
          >
            <div className="mx-auto mt-2.5 h-1 w-[42px] rounded bg-field md:hidden" />
            <header className="flex items-start justify-between gap-2 border-b border-line p-4">
              <div>
                <h3 className="font-semibold">Toàn bộ nội dung mẫu</h3>
                <p className="mt-1 text-sm text-muted">{preview.title}</p>
              </div>
              <button
                className="grid size-11 place-items-center"
                aria-label="Đóng xem trước"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm leading-relaxed">
              {preview.body}
            </div>
            <footer className="flex gap-2 border-t border-line p-4">
              <button
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface flex-1"
                onClick={() => setPreview(null)}
              >
                Đóng
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white flex-1"
                onClick={() => dung(preview)}
              >
                Dùng mẫu này
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
