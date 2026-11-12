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
          <button type="button" onClick={onClose} aria-label="Đóng hộp thoại" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-body hover:bg-fill">
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

/**
 * Hộp thoại theo thiết kế Stitch: chấm đỏ + tiêu đề, thân cuộn bên trong, chân hộp cố định chứa nút.
 * `sheet` = ngăn kéo bên phải. Dưới 640 px thành toàn màn hình. Nền sau làm mờ (::backdrop của .app-dialog).
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
  sheet,
  top,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  sheet?: boolean;
  /** Phần dính dưới tiêu đề, không cuộn (thanh tab, thanh bước). */
  top?: ReactNode;
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
      style={{ ['--w' as string]: `${width}px` }}
      className={`app-dialog app-modal ${sheet ? 'app-sheet' : ''}`}
    >
      <div className={`flex flex-col ${sheet ? 'h-full' : 'max-h-[calc(100dvh-32px)] max-sm:h-dvh max-sm:max-h-dvh'}`}>
        <header className="flex items-center gap-3 border-b border-line px-6 py-2.5 max-sm:px-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-[0.8125rem] text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng hộp thoại" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-body hover:bg-fill">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </header>
        {top}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 max-sm:px-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-page px-6 py-3 max-sm:px-4">{footer}</footer>}
      </div>
    </dialog>
  );
}

/** Thanh tab gạch chân đỏ như hộp Chốt tour của Stitch. */
export function UnderlineTabs<T extends string>({ items, value, onChange, label }: { items: { key: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-6 [scrollbar-width:none] max-sm:px-4 [&::-webkit-scrollbar]:hidden">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${value === t.key ? 'border-brand text-brand-text' : 'border-transparent text-muted hover:text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
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

export const inputClass = 'transition-[border-color,box-shadow] duration-150 hover:border-muted min-h-11 w-full rounded-[10px] border border-field bg-surface px-3 text-sm font-normal text-ink';
export const primaryClass = 'text-sm shadow-[0_2px_3px_#0000000d] min-h-11 rounded-[10px] bg-brand-button px-4 font-semibold text-white hover:bg-brand-dark disabled:opacity-60';
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

/** "2026-12-11" -> "11/12/2026"; chuỗi rỗng hoặc sai thì trả rỗng. */
function isoSangHienThi(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Ô nhập ngày kiểu dd/mm/yyyy (ô ngày của trình duyệt hiện theo ngôn ngữ máy, thường là mm/dd/yyyy). Giá trị ra vào là "yyyy-mm-dd". */
export function NhapNgay({ id, value, onChange, className, min }: { id?: string; value: string; onChange: (iso: string) => void; className?: string; min?: string }) {
  const [chu, setChu] = useState(() => isoSangHienThi(value));
  useEffect(() => {
    // Chỉ đồng bộ khi giá trị bên ngoài đổi khác với chữ đang gõ (ví dụ mở sửa voucher khác).
    setChu((cu) => {
      const hopLe = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cu);
      const iso = hopLe ? `${hopLe[3]}-${hopLe[2]}-${hopLe[1]}` : '';
      return iso === value ? cu : isoSangHienThi(value);
    });
  }, [value]);
  const doi = (raw: string) => {
    const so = raw.replace(/\D/g, '').slice(0, 8);
    const hienThi = [so.slice(0, 2), so.slice(2, 4), so.slice(4, 8)].filter(Boolean).join('/');
    setChu(hienThi);
    if (so.length === 8) {
      const [d, m, y] = [Number(so.slice(0, 2)), Number(so.slice(2, 4)), Number(so.slice(4, 8))];
      const t = new Date(Date.UTC(y, m - 1, d));
      const dung = t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
      onChange(dung ? `${so.slice(4, 8)}-${so.slice(2, 4)}-${so.slice(0, 2)}` : '');
    } else onChange('');
  };
  const sai = chu.length === 10 && !value;
  const nhoHon = !!value && !!min && value < min;
  return (
    <>
      <input id={id} inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" maxLength={10} value={chu} onChange={(e) => doi(e.target.value)} aria-invalid={sai || nhoHon} className={className} />
      {(sai || nhoHon) && <span className="mt-1 block text-xs text-brand-text">{sai ? 'Ngày không hợp lệ' : 'Phải sau hoặc bằng ngày bắt đầu'}</span>}
    </>
  );
}

/** Ảnh đại diện khách: có link thì hiện ảnh, không có hoặc ảnh lỗi thì hiện chữ cái cuối của tên. `className` lo kích thước và màu nền của chữ. */
export function AnhKhach({ ten, anh, className }: { ten: string; anh?: string | null; className: string }) {
  const [loi, setLoi] = useState(false);
  useEffect(() => setLoi(false), [anh]);
  if (anh && !loi) {
    return <img src={anh} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setLoi(true)} className={`${className} object-cover`} />;
  }
  return <span aria-hidden="true" className={className}>{ten.trim().split(' ').pop()?.charAt(0)}</span>;
}
