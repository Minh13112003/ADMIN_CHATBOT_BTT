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
      className="quick-reply-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Câu trả lời nhanh"
        className="quick-reply-dialog"
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
        <div className="quick-reply-rows">
          <div className="quick-reply-head">
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
              className={`quick-reply-row ${selected === i ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="quick-reply-pick"
                onMouseEnter={() => setSelected(i)}
                onClick={() => dung(t)}
              >
                <strong className="truncate">{t.title}{t.shortcut ? <span className="ml-2 font-mono text-xs font-normal text-muted">/{t.shortcut}</span> : null}</strong>
                <span className="line-clamp-2 text-body">{t.body}</span>
              </button>
              <button
                type="button"
                aria-label={`Xem toàn bộ nội dung ${t.title}`}
                className="quick-reply-eye"
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
          <Link className="deals-action" to="/templates" onClick={onClose}>
            Quản lý mẫu câu
          </Link>
        </footer>
      </section>
      {preview && (
        <div
          className="quick-preview-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <section
            ref={previewRef}
            role="dialog"
            aria-modal="true"
            aria-label="Toàn bộ nội dung mẫu"
            className="quick-preview"
          >
            <div className="quick-handle md:hidden" />
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
                className="deals-action flex-1"
                onClick={() => setPreview(null)}
              >
                Đóng
              </button>
              <button
                className="deals-action deals-primary flex-1"
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
