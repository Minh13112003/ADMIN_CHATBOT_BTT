import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import useSWR from 'swr';
import { fetcher, patch, post } from '@/lib/api';
import { CHANNEL } from '@/lib/labels';
import { useRealtime, type Ping } from '@/lib/realtime';
import type { Channel, ConversationList, Me } from '@/lib/types';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { Switch } from './ui';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const NAV = [
  { href: '/inbox', label: 'Hội thoại', icon: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  { href: '/customers', label: 'Khách hàng', icon: <><circle cx="9" cy="8" r="4" /><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /><path d="M17 4a4 4 0 0 1 0 8" /><path d="M22 21v-1a6 6 0 0 0-3-5" /></> },
  { href: '/templates', label: 'Mẫu nhanh', icon: <path d="M13 2 4 14h7l-1 8 9-12h-7z" /> },
  { href: '/stats', label: 'Thống kê', admin: true, icon: <><path d="M5 20V11" /><path d="M12 20V4" /><path d="M19 20v-6" /></> },
  { href: '/accounts', label: 'Quản trị', admin: true, icon: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></> },
  { href: '/settings', label: 'Cài đặt', icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.5h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9L7.6 8l1.8-1.8.1.1A1.7 1.7 0 0 0 11.4 6a1.7 1.7 0 0 0 1-1.6V4h2.5v.4A1.7 1.7 0 0 0 16 6a1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.5H21a1.7 1.7 0 0 0-1.6 1.5z" /></> },
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

  const soLienHe = contacts?.items.length ?? 0;

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
    <div className="flex h-dvh min-w-0 flex-col md:flex-row">
      <nav aria-label="Điều hướng" className="flex shrink-0 items-center justify-around gap-0 bg-brand-dark p-1 text-white md:w-[88px] md:flex-col md:justify-start md:gap-1.5 md:px-1.5 md:py-3.5">
        <div className="mb-2.5 hidden size-12 shrink-0 items-center justify-center rounded-[14px] bg-white md:flex">
          <img src="/logo.png" alt="BenThanh Tourist" width="36" height="36" className="size-9 object-contain" />
        </div>
        {NAV.filter((n) => !n.admin || me.role === 'ADMIN').map((n) => {
          const dangO = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              to={n.href}
              aria-current={dangO ? 'page' : undefined}
              className={`relative flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl p-1 text-[0.625rem] font-medium leading-tight hover:bg-white/15 md:min-h-[60px] md:w-[76px] md:flex-none md:gap-1 md:whitespace-nowrap md:px-0.5 md:py-1.5 md:text-[0.71875rem] ${dangO ? 'bg-white/20' : ''}`}
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" {...stroke}>
                {n.icon}
              </svg>
              {n.label}
              {n.href === '/inbox' && soLienHe > 0 && (
                <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-brand-dark">{soLienHe}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center gap-2 border-b border-line bg-surface px-4 py-1.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.0625rem] font-bold">Quản trị hội thoại</h1>
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
              {soLienHe > 0 && <span className="absolute right-0 top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-brand-button px-1 text-[0.6875rem] font-bold text-white">{soLienHe}</span>}
            </button>
            {menu === 'bell' && (
              <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-surface p-2 shadow-xl">
                <div className="px-2 py-1.5 text-sm font-semibold">Khách đang chờ nhân viên</div>
                {contacts?.items.map((c) => (
                  <button key={c.id} type="button" onClick={() => moHoiThoai(c.id)} className="block min-h-12 w-full rounded-[10px] px-2 py-1.5 text-left hover:bg-page">
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
              <div className="absolute right-0 top-12 flex w-72 max-w-[calc(100vw-32px)] flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-xl">
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
                  <Link to="/settings" onClick={() => setMenu(null)} className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-field text-[0.8125rem] hover:bg-fill">Cài đặt</Link>
                  <button type="button" onClick={() => { setMenu(null); setDoiMk(true); }} className="min-h-9 flex-1 rounded-lg border border-field text-[0.8125rem] hover:bg-fill">
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

        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
      </div>
      {doiMk && <ChangePasswordDialog onClose={() => setDoiMk(false)} />}
    </div>
  );
}
