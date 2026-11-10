import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import useSWR from 'swr';
import { fetcher, patch, post } from '@/lib/api';
import { CHANNEL } from '@/lib/labels';
import { useRealtime, type Ping } from '@/lib/realtime';
import type { Channel, ConversationList, Me } from '@/lib/types';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { Dialog, Switch } from './ui';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const NAV = [
  { href: '/inbox', label: 'Hội thoại', icon: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  {
    href: '/customers',
    label: 'Khách hàng',
    icon: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
        <path d="M17 4a4 4 0 0 1 0 8" />
        <path d="M22 21v-1a6 6 0 0 0-3-5" />
      </>
    ),
  },
  { href: '/deals', label: 'Đơn đặt tour', icon: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></> },
  { href: '/reminders', label: 'Lịch hẹn nhắc', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 15h8" /></> },
  { href: '/templates', label: 'Thư viện trả lời', icon: <path d="M13 2 4 14h7l-1 8 9-12h-7z" /> },
  { href: '/settings', label: 'Cài đặt hiển thị', icon: <><circle cx="12" cy="12" r="3" /><path d="M4 7h4M16 7h4M4 17h4M16 17h4" /></> },
  {
    href: '/stats',
    label: 'Thống kê',
    admin: true,
    icon: (
      <>
        <path d="M5 20V11" />
        <path d="M12 20V4" />
        <path d="M19 20v-6" />
      </>
    ),
  },
  { href: '/performance', label: 'Hiệu suất sale', admin: true, icon: <><path d="M3 18 9 12l4 3 8-9" /><path d="M16 6h5v5" /></> },
  { href: '/channels', label: 'Kênh kết nối', admin: true, icon: <><circle cx="12" cy="12" r="2" /><circle cx="4" cy="5" r="2" /><circle cx="20" cy="5" r="2" /><circle cx="12" cy="21" r="2" /><path d="m6 6 5 5m7-5-5 5m-1 3v5" /></> },
  {
    href: '/accounts',
    label: 'Quản trị tài khoản',
    admin: true,
    icon: (
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
] as { href: string; label: string; icon: ReactNode; admin?: boolean }[];

function noiDungPing(p: Ping) {
  const kenh = p.channel ? ` (${CHANNEL[p.channel as Channel]?.label ?? p.channel})` : '';
  const chia = p.assignee ? `Hệ thống chia cho ${p.assignee}.` : 'Chưa có ai đang trực.';
  switch (p.kind) {
    case 'BOOKING':
      return `${p.name}${kenh} vừa đặt tour qua bttAI, cần gọi xác nhận. ${chia}`;
    case 'SUPPORT':
      return `${p.by} vừa nhắn hỗ trợ khách ${p.name} của bạn.`;
    case 'HANDOVER':
      return `${p.by} chuyển khách ${p.name} cho bạn.`;
    case 'FOLLOWUP':
      return `Đến hẹn với khách ${p.name}${p.note ? `: ${p.note}` : ''}.`;
    default:
      return `${p.name}${kenh} vừa yêu cầu gặp nhân viên. ${chia}`;
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: me, mutate: mutateMe } = useSWR<Me>('/auth/me', fetcher);
  const { data: contacts } = useSWR<ConversationList>(me ? '/conversations?status=CONTACT' : null, fetcher);
  const { ping, clearPing, connected } = useRealtime();
  const [menu, setMenu] = useState<'bell' | 'me' | null>(null);
  const [doiMk, setDoiMk] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [thu, setThu] = useState(() => { try { return localStorage.getItem('btt-sidebar') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('btt-sidebar', thu ? '1' : '0'); } catch { /* bỏ qua */ } }, [thu]);

  const soLienHe = contacts?.counts.CONTACT ?? contacts?.items.length ?? 0;
  const soCho = soLienHe + (contacts?.counts.UNREAD ?? 0);

  const moHoiThoai = (id: string) => {
    setMenu(null);
    clearPing(id);
    navigate(`/inbox?c=${id}`);
  };

  const dangXuat = async () => {
    await post('/auth/logout');
    window.location.href = '/login';
  };

  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;

  return (
    <div className="workspace flex h-dvh min-w-0 flex-col md:flex-row">
      <div className="relative z-30 hidden h-full shrink-0 md:block">
        <aside className={`flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface transition-[width] duration-200 ${thu ? 'w-[76px]' : 'w-[248px]'}`}>
          <Link to="/inbox" title="BenThanh Tourist" className={`flex h-[72px] shrink-0 items-center gap-3 border-b border-line-soft ${thu ? 'justify-center px-0' : 'px-4'}`}>
            <img src="/logo.png" alt="" width="36" height="36" className="size-9 shrink-0 object-contain" />
            {!thu && (
              <span className="min-w-0 leading-tight">
                <strong className="block truncate text-[0.9375rem] font-extrabold tracking-tight text-ink">BENTHANH TOURIST</strong>
                <small className="block truncate text-[0.6875rem] font-medium text-muted">Quản trị hội thoại &amp; tour</small>
              </span>
            )}
          </Link>
          {[{ caption: 'BẢNG ĐIỀU KHIỂN', label: 'Điều hướng', items: NAV.filter((n) => !n.admin) }, ...(me.role === 'ADMIN' ? [{ caption: 'QUẢN TRỊ (ADMIN)', label: 'Quản trị', items: NAV.filter((n) => n.admin) }] : [])].map((group) => (
            <div key={group.caption} className="px-3 pt-4">
              {thu ? <div className="mb-2 h-px bg-line-soft" /> : <p className="px-3 pb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">{group.caption}</p>}
              <nav aria-label={group.label} className="space-y-1">
                {group.items.map((n) => (
                  <Link
                    key={n.href}
                    to={n.href}
                    title={thu ? n.label : undefined}
                    aria-current={pathname.startsWith(n.href) ? 'page' : undefined}
                    className={`relative flex h-11 items-center gap-3 whitespace-nowrap rounded-lg border-l-[3px] border-transparent text-[0.8125rem] font-medium text-body hover:bg-fill aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-text ${thu ? 'justify-center px-0' : 'px-3'}`}
                  >
                    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" className="shrink-0" {...stroke}>
                      {n.icon}
                    </svg>
                    {!thu && <span className="flex-1">{n.label}</span>}
                    {n.href === '/inbox' && soCho > 0 && (
                      <span className={`flex h-[19px] min-w-[20px] items-center justify-center rounded-full bg-brand-button px-1.5 text-[0.6875rem] font-bold text-white ${thu ? 'absolute right-0.5 top-0.5' : ''}`}>{soCho}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
          <div className="mt-auto" />
          <div className={`flex items-center gap-2.5 border-t border-line-soft p-3 ${thu ? 'justify-center' : ''}`} title={me.fullName}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-text">{me.fullName.trim().split(' ').pop()?.charAt(0)}</span>
            {!thu && (
              <div className="min-w-0">
                <strong className="block truncate text-sm">{me.fullName}</strong>
                <small className="text-xs text-muted">{me.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên tư vấn'}</small>
              </div>
            )}
          </div>
        </aside>
        <button
          type="button"
          onClick={() => setThu(!thu)}
          aria-label={thu ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          aria-expanded={!thu}
          className="absolute -right-3.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface shadow-sm text-body shadow-md hover:bg-fill"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={thu ? 'rotate-180' : ''}>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="workspace-header min-h-[72px] max-md:min-h-16 relative z-20 flex items-center gap-2 border-b border-line bg-surface px-4 py-2 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold md:text-xl">{NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'BenThanh Tourist'}</div>
            {!connected && <p className="text-xs text-brand-text">Mất kết nối tức thời, tin mới có thể đến chậm</p>}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === 'bell' ? null : 'bell')}
              aria-label={`Thông báo, ${soLienHe} khách đang chờ nhân viên`}
              aria-expanded={menu === 'bell'}
              className="relative flex size-11 items-center justify-center rounded-full hover:bg-fill"
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" {...stroke}>
                <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              {soLienHe > 0 && (
                <span className="absolute right-0 top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-brand-button px-1 text-[0.6875rem] font-bold text-white">
                  {soLienHe}
                </span>
              )}
            </button>
            {menu === 'bell' && (
              <div className="fixed right-4 top-20 w-80 max-w-[calc(100vw-32px)] sm:absolute sm:right-0 sm:top-12 rounded-2xl border border-line bg-surface shadow-sm p-2 shadow-xl">
                <div className="px-2 py-1.5 text-sm font-semibold">Khách đang chờ nhân viên</div>
                {contacts?.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => moHoiThoai(c.id)}
                    className="block min-h-12 w-full rounded-[10px] px-2 py-1.5 text-left hover:bg-page"
                  >
                    <div className="text-sm font-semibold">{c.customer.name}</div>
                    <div className="text-xs text-muted">
                      {CHANNEL[c.channel].label} · Phụ trách: {c.assignee?.fullName ?? 'Chưa có'}
                    </div>
                  </button>
                ))}
                {soLienHe === 0 && <p className="px-2 py-2.5 text-[0.8125rem] text-muted">Chưa có khách nào đang chờ.</p>}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === 'me' ? null : 'me')}
              aria-label={`Thông tin nhân viên ${me.fullName}`}
              aria-expanded={menu === 'me'}
              className="flex size-11 items-center justify-center rounded-full bg-strong font-semibold text-on-strong"
            >
              {me.fullName.trim().split(' ').pop()?.charAt(0)}
            </button>
            {menu === 'me' && (
              <div className="absolute right-0 top-12 flex w-72 max-w-[calc(100vw-32px)] flex-col gap-2.5 rounded-2xl border border-line bg-surface shadow-sm p-3.5 shadow-xl">
                <div className="text-[0.9375rem] font-semibold">{me.fullName}</div>
                <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[0.8125rem]">
                  <dt className="text-muted">Mã nhân viên</dt>
                  <dd>{me.employeeCode ?? 'Chưa có'}</dd>
                  <dt className="text-muted">Vị trí</dt>
                  <dd>{me.position ?? 'Chưa có'}</dd>
                  <dt className="text-muted">Đang giữ</dt>
                  <dd>{me.load} khách</dd>
                </dl>
                {me.role === 'SALE' && (
                  <div className="flex items-center gap-2.5 border-t border-line-soft pt-2.5">
                    <span className="flex-1 text-sm">Đang trực (nhận khách tự động)</span>
                    <Switch
                      checked={me.onDuty}
                      label="Đang trực"
                      onChange={async (v) => {
                        await patch('/users/me/duty', { onDuty: v });
                        await mutateMe();
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-2 border-t border-line-soft pt-2.5">
                  <Link
                    to="/settings"
                    onClick={() => setMenu(null)}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-field text-[0.8125rem] hover:bg-fill"
                  >
                    Cài đặt
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      setDoiMk(true);
                    }}
                    className="min-h-9 flex-1 rounded-lg border border-field text-[0.8125rem] hover:bg-fill"
                  >
                    Đổi mật khẩu
                  </button>
                  <button type="button" onClick={dangXuat} className="min-h-9 flex-1 rounded-lg border border-field text-[0.8125rem] hover:bg-fill">
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {ping && (
          <div role="status" className="flex flex-wrap items-center gap-3 bg-brand-button px-4 py-2 text-white">
            <span className="min-w-60 flex-1 font-medium">{noiDungPing(ping)}</span>
            <button type="button" onClick={() => moHoiThoai(ping.id)} className="min-h-11 rounded-[10px] bg-surface px-4 font-semibold text-brand-text">
              Mở ngay
            </button>
            <button type="button" onClick={() => clearPing()} aria-label="Đóng thông báo" className="min-h-11 rounded-[10px] px-2 text-sm underline">
              Đóng
            </button>
          </div>
        )}

        <div id="workspace-content" className="min-h-0 min-w-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
      <nav aria-label="Điều hướng điện thoại" className="z-25 flex h-[calc(56px+env(safe-area-inset-bottom))] shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden [&>a]:relative [&>a]:flex [&>a]:min-h-14 [&>a]:min-w-0 [&>a]:flex-1 [&>a]:flex-col [&>a]:items-center [&>a]:justify-center [&>a]:gap-px [&>a]:text-[0.6875rem] [&>a]:font-semibold [&>a]:text-muted [&>button]:relative [&>button]:flex [&>button]:min-h-14 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:flex-col [&>button]:items-center [&>button]:justify-center [&>button]:gap-px [&>button]:text-[0.6875rem] [&>button]:font-semibold [&>button]:text-muted [&>a[aria-current=page]]:text-brand-text [&_i]:absolute [&_i]:right-[20%] [&_i]:top-px [&_i]:grid [&_i]:h-[17px] [&_i]:min-w-[17px] [&_i]:place-items-center [&_i]:rounded-[9px] [&_i]:bg-brand-button [&_i]:text-[0.6rem] [&_i]:not-italic [&_i]:text-white md:hidden">{NAV.slice(0, 4).map((n) => <Link key={n.href} to={n.href} aria-current={pathname.startsWith(n.href) ? 'page' : undefined}><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" {...stroke}>{n.icon}</svg><span>{n.href === '/deals' ? 'Đơn tour' : n.href === '/reminders' ? 'Hẹn' : n.label}</span>{n.href === '/inbox' && soCho > 0 && <i>{soCho}</i>}</Link>)}<button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" {...stroke}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span>Thêm</span></button></nav>
      {moreOpen && <Dialog title="Thêm" variant="drawer" onClose={() => setMoreOpen(false)}><nav aria-label="Mục khác" className="flex flex-col gap-0.5">{NAV.slice(4).filter((n) => !n.admin || me.role === 'ADMIN').map((n) => <Link key={n.href} to={n.href} onClick={() => setMoreOpen(false)} aria-current={pathname.startsWith(n.href) ? 'page' : undefined} className="flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-[0.8125rem] font-medium text-body hover:bg-fill aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-text aria-[current=page]:shadow-[inset_3px_0_var(--color-brand)] [&_svg]:shrink-0"><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" {...stroke}>{n.icon}</svg><span>{n.label}</span></Link>)}</nav></Dialog>}
      {doiMk && <ChangePasswordDialog onClose={() => setDoiMk(false)} />}
    </div>
  );
}
