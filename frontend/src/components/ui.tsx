import { useEffect, useRef, useId, useState, type ReactNode } from 'react';

export function Switch({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative my-2 flex h-7 w-12 shrink-0 rounded-full p-[3px] before:absolute before:-inset-y-2 before:inset-x-0 disabled:opacity-50 ${checked ? 'justify-end bg-on' : 'justify-start bg-off'}`}
    >
      <span className="size-[22px] rounded-full bg-white" />
    </button>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-full gap-1 rounded-xl bg-fill p-1 sm:w-auto">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={value === t.key}
          onClick={() => onChange(t.key)}
          className={`min-h-11 flex-1 whitespace-nowrap rounded-[9px] px-2 text-sm font-medium sm:flex-none sm:px-4 ${value === t.key ? 'bg-surface text-ink shadow-sm' : 'text-body'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-brand-text">
      {children}
    </p>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  variant = 'modal',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'modal' | 'drawer';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`app-dialog ${variant === 'drawer' ? 'app-drawer' : ''}`}
    >
      <div className="dialog-content">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng hộp thoại" className="icon-button">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export const inputClass = 'ui-input min-h-11 w-full rounded-[10px] border border-field bg-surface px-3 text-sm font-normal text-ink';
export const primaryClass = 'ui-primary min-h-11 rounded-[10px] bg-brand-button px-4 font-semibold text-white hover:bg-brand-dark disabled:opacity-60';
export const secondaryClass = 'min-h-11 rounded-[10px] border border-field bg-surface px-4 font-medium text-ink hover:bg-fill disabled:opacity-60';
export const chipClass = 'min-h-9 rounded-full border border-field bg-surface px-2.5 text-[0.8125rem] text-neutral-ink hover:bg-fill disabled:opacity-60';

/** Nút xoá bấm 2 lần: lần đầu đổi chữ để xác nhận. */
export function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [hoi, setHoi] = useState(false);
  useEffect(() => {
    if (!hoi) return;
    const t = setTimeout(() => setHoi(false), 4000);
    return () => clearTimeout(t);
  }, [hoi]);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (hoi ? onConfirm() : setHoi(true))}
      className={`min-h-9 shrink-0 rounded-lg px-2 text-[0.8125rem] ${hoi ? 'bg-brand-button font-semibold text-white' : 'text-muted underline'}`}
    >
      {hoi ? 'Bấm lần nữa để xoá' : 'Xoá'}
    </button>
  );
}
