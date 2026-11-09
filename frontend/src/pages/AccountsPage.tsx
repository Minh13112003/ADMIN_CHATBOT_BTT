import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Dialog, ErrorText, Field, inputClass, primaryClass } from '@/components/ui';
import { fetcher, loiCua, patch, post } from '@/lib/api';
import type { Account, Me } from '@/lib/types';

const TRONG = { fullName: '', email: '', password: '', employeeCode: '', position: '' };

export default function AccountsPage() {
  const { data: me, error: meError } = useSWR<Me>('/auth/me', fetcher);
  const isAdmin = me?.role === 'ADMIN';
  const { data: accounts, error, mutate } = useSWR<Account[]>(isAdmin ? '/users' : null, fetcher);
  const [form, setForm] = useState(TRONG);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [loi, setLoi] = useState('');
  const [baoXong, setBaoXong] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [target, setTarget] = useState<Account | null>(null);
  const [action, setAction] = useState<'active' | 'password'>('active');
  const [newPassword, setNewPassword] = useState('');
  const [shownPassword, setShownPassword] = useState('');
  const [dialogError, setDialogError] = useState('');
  const visibleAccounts = accounts?.filter(
    (a) =>
      (filter === 'all' || (filter === 'active' ? a.isActive : !a.isActive)) &&
      `${a.fullName} ${a.email} ${a.employeeCode ?? ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
  );

  const openAction = (account: Account, next: 'active' | 'password') => {
    setTarget(account);
    setAction(next);
    setNewPassword('');
    setShownPassword('');
    setDialogError('');
  };
  const closeAction = () => {
    setTarget(null);
    setNewPassword('');
    setShownPassword('');
    setDialogError('');
  };
  const submitAction = async () => {
    if (!target) return;
    setDangGui(true);
    setDialogError('');
    try {
      if (action === 'active') {
        await patch(`/users/${target.id}/active`, { isActive: !target.isActive });
        await mutate();
        closeAction();
      } else {
        await post(`/users/${target.id}/reset-password`, { password: newPassword });
        setShownPassword(newPassword);
        setNewPassword('');
      }
    } catch (err) {
      setDialogError(loiCua(err));
    } finally {
      setDangGui(false);
    }
  };

  const doi = (k: keyof typeof TRONG) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const gui = async (e: FormEvent) => {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    setBaoXong('');
    try {
      const u = await post<Account>('/users', form);
      setBaoXong(`Đã tạo tài khoản ${u.email}. Bạn gửi mật khẩu cho nhân viên qua kênh riêng.`);
      setForm(TRONG);
      setCreating(false);
      await mutate();
    } catch (err) {
      setLoi(loiCua(err));
    } finally {
      setDangGui(false);
    }
  };

  const xuatCsv = () => {
    const dong = [['Họ tên', 'Email', 'Vai trò', 'Mã nhân viên', 'Vị trí', 'Trạng thái', 'Đăng nhập gần nhất'], ...(visibleAccounts ?? []).map((a) => [a.fullName, a.email, a.role === 'ADMIN' ? 'Admin' : 'Sale', a.employeeCode ?? '', a.position ?? '', a.isActive ? 'Đang hoạt động' : 'Đã khoá', a.lastLoginAt ?? ''])];
    const csv = '﻿' + dong.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'tai-khoan-nhan-vien.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (meError) return <p className="p-6 text-sm text-brand-text">Không tải được thông tin tài khoản.</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted">Đang tải...</p>;

  return (
    <main className="page-layout">
      <header className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ ĐỘI NGŨ</p>
          <h1>Tài khoản nhân viên</h1>
          <p>Quản lý quyền truy cập và trạng thái của đội ngũ tư vấn.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoi('');
            setCreating(true);
          }}
          className={primaryClass}
        >
          + Tạo tài khoản
        </button>
      </header>
      <div className="summary-grid">
        {[
          { label: 'Tổng tài khoản', value: accounts?.length },
          { label: 'Đang hoạt động', value: accounts?.filter((a) => a.isActive).length },
          { label: 'Đã khoá', value: accounts?.filter((a) => !a.isActive).length },
        ].map((item) => (
          <div className="summary-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value ?? '—'}</strong>
          </div>
        ))}
      </div>
      {baoXong && (
        <p role="status" className="rounded-xl bg-green-soft p-4 text-sm text-green-ink">
          {baoXong}
        </p>
      )}
      {creating && (
        <Dialog
          title="Tạo tài khoản sale"
          variant="drawer"
          onClose={() => {
            if (!dangGui) setCreating(false);
          }}
        >
          <form onSubmit={gui} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Họ tên">
                <input required minLength={2} value={form.fullName} onChange={doi('fullName')} className={inputClass} />
              </Field>
              <Field label="Email đăng nhập">
                <input type="email" required value={form.email} onChange={doi('email')} className={inputClass} />
              </Field>
              <Field label="Mật khẩu (ít nhất 8 ký tự)">
                <input
                  type="text"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={doi('password')}
                  className={inputClass}
                />
              </Field>
              <button type="button" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface sm:col-span-2 sm:justify-self-start" onClick={() => setForm((f) => ({ ...f, password: Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 54]).join('') }))}>Tạo mật khẩu ngẫu nhiên</button>
              <Field label="Mã nhân viên (không bắt buộc)">
                <input value={form.employeeCode} onChange={doi('employeeCode')} className={inputClass} />
              </Field>
              <Field label="Vị trí (không bắt buộc)">
                <input value={form.position} onChange={doi('position')} className={inputClass} />
              </Field>
            </div>
            <ErrorText>{loi}</ErrorText>
            {baoXong && (
              <p role="status" className="text-sm font-medium text-green-ink">
                {baoXong}
              </p>
            )}
            <button type="submit" disabled={dangGui} className={`${primaryClass} self-start`}>
              {dangGui ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </form>
        </Dialog>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="min-w-48 flex-1">
            <label className="sr-only" htmlFor="account-search">
              Tìm nhân viên
            </label>
            <input
              id="account-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email hoặc mã nhân viên"
              className={inputClass}
            />
          </div>
          <div role="group" aria-label="Lọc trạng thái tài khoản" className="inline-flex rounded-lg bg-fill p-0.5 text-xs font-semibold">
            {([['all', 'Tất cả', accounts?.length], ['active', 'Đang hoạt động', accounts?.filter((x) => x.isActive).length], ['locked', 'Đã khoá', accounts?.filter((x) => !x.isActive).length]] as const).map(([key, label, n]) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-10 rounded-md px-3.5 ${filter === key ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
                {label} <span className={key === 'active' ? 'text-on' : 'text-muted'}>({n ?? 0})</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={xuatCsv} className="min-h-11 rounded-[10px] border border-field bg-surface px-4 text-sm font-semibold text-ink hover:bg-fill">Xuất CSV</button>
        </div>
        <div className="flex items-start gap-2 border-b border-amber-line bg-auto-soft px-4 py-2.5 text-xs text-amber-ink"><strong className="shrink-0">Quy tắc an toàn:</strong><span>Quản trị viên không thể tự khoá tài khoản của chính mình hoặc khoá quản trị viên cuối cùng.</span></div>
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[1100px] border-collapse text-sm"><thead><tr className="bg-fill text-left text-body"><th className="whitespace-nowrap p-4">Nhân viên</th><th className="whitespace-nowrap p-4">Vai trò</th><th className="whitespace-nowrap p-4">Mã nhân viên</th><th className="whitespace-nowrap p-4">Vị trí</th><th className="whitespace-nowrap p-4">Đang giữ</th><th className="whitespace-nowrap p-4">Đăng nhập gần nhất</th><th className="whitespace-nowrap p-4">Trạng thái</th><th className="whitespace-nowrap p-4">Thao tác</th></tr></thead><tbody>{visibleAccounts?.map((a) => <tr key={a.id} className="border-t border-line-soft hover:bg-page"><td className="whitespace-nowrap p-4"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">{a.fullName.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}</span><div><strong>{a.fullName}</strong>{a.id === me?.id && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[0.6875rem] font-bold text-brand-text">Bạn</span>}<span className="block text-xs text-muted">{a.email}</span></div></div></td><td className="whitespace-nowrap p-4"><span className={`rounded px-2 py-0.5 text-xs font-bold ${a.role === 'ADMIN' ? 'bg-brand-soft text-brand-text' : 'bg-fill text-body'}`}>{a.role === 'ADMIN' ? 'Admin (Quản trị)' : 'Sale (Tư vấn)'}</span></td><td className="whitespace-nowrap p-4">{a.employeeCode ?? 'Chưa có'}</td><td className="whitespace-nowrap p-4">{a.position ?? 'Chưa có'}</td><td className="whitespace-nowrap p-4">{a.holding ? <span className="rounded-full bg-auto px-2.5 py-1 text-xs font-bold text-auto-ink">{a.holding} khách</span> : <span className="text-muted">0</span>}</td><td className="whitespace-nowrap p-4">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td><td className="whitespace-nowrap p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.isActive ? 'bg-green-soft text-green-ink' : 'bg-fill text-muted'}`}>{a.isActive ? 'Đang hoạt động' : 'Đã khoá'}</span></td><td className="whitespace-nowrap p-4"><div className="flex gap-2"><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" disabled={a.id === me?.id && a.isActive} onClick={() => openAction(a, 'active')}>{a.isActive ? 'Khoá' : 'Mở khoá'}</button><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" disabled={a.role === 'ADMIN' && a.id !== me?.id} onClick={() => openAction(a, 'password')}>Đặt lại mật khẩu</button></div></td></tr>)}</tbody></table></div>
        <div className="account-grid xl:hidden">
          {visibleAccounts?.map((a) => (
            <article key={a.id} className="account-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{a.fullName}</h3>
                  <p className="break-all text-sm text-body">{a.email}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.isActive ? 'bg-green-soft text-on' : 'bg-fill text-muted'}`}>
                  {a.isActive ? 'Đang hoạt động' : 'Đã khoá'}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Vai trò</dt>
                <dd>{a.role === 'ADMIN' ? 'Admin' : 'Sale'}</dd>
                <dt className="text-muted">Mã nhân viên</dt>
                <dd className="break-words">{a.employeeCode ?? 'Chưa có'}</dd>
                <dt className="text-muted">Vị trí</dt>
                <dd className="break-words">{a.position ?? 'Chưa có'}</dd>
                <dt className="text-muted">Đăng nhập gần nhất</dt>
                <dd>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                <button
                  type="button"
                  onClick={() => openAction(a, 'active')}
                  disabled={a.id === me?.id && a.isActive}
                  className="min-h-11 rounded-lg border border-field px-3 text-sm font-medium text-brand-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {a.isActive ? 'Khoá tài khoản' : 'Mở khoá'}
                </button>
                <button
                  type="button"
                  onClick={() => openAction(a, 'password')}
                  disabled={a.role === 'ADMIN' && a.id !== me?.id}
                  className="min-h-11 rounded-lg border border-field px-3 text-sm font-medium text-brand-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Đặt lại mật khẩu
                </button>
              </div>
            </article>
          ))}
        </div>
        {!accounts && !error && <p className="p-4 text-sm text-muted">Đang tải danh sách tài khoản...</p>}
        {visibleAccounts?.length === 0 && <p className="p-4 text-sm text-muted">Không có tài khoản nào phù hợp.</p>}
        {error && <p className="p-4 text-sm text-brand-text">Không tải được danh sách tài khoản.</p>}
      </section>
      {target && (
        <Dialog title={action === 'active' ? (target.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản') : 'Đặt lại mật khẩu'} onClose={closeAction}>
          {shownPassword ? (
            <div>
              <p>Mật khẩu mới của {target.fullName} (chỉ hiện lần này):</p>
              <p className="my-3 break-all rounded border p-3 font-mono">{shownPassword}</p>
              <button className={primaryClass} onClick={closeAction}>
                Đã chép xong
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {action === 'active' ? (
                <div className="space-y-3 text-sm">
                  <p>Bạn muốn {target.isActive ? 'khoá' : 'mở khoá'} tài khoản nhân viên này?</p>
                  <div className="rounded-xl border border-line bg-page p-4"><strong className="block">{target.fullName}</strong><span className="text-muted">{target.employeeCode ?? 'Chưa có mã nhân viên'} · {target.email}</span>{target.holding ? <span className="ml-2 rounded-full bg-auto px-2 py-0.5 text-xs font-bold text-auto-ink">Đang giữ {target.holding} khách</span> : null}</div>
                  {target.isActive && <div className="rounded-xl border border-alert-line bg-brand-faint p-4"><strong className="text-brand-text">Sau khi khoá tài khoản</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-body"><li>Nhân viên bị đăng xuất khỏi phiên làm việc.</li><li>{target.holding ? `${target.holding} khách đang giữ (Liên hệ, Chờ xử lý) được chia lại cho nhân viên khác đang trực.` : 'Không có khách đang giữ cần chia lại.'}</li><li>Nhân viên không thể đăng nhập cho đến khi được mở khoá.</li></ul></div>}
                </div>
              ) : (
                <Field label="Mật khẩu mới (ít nhất 8 ký tự)">
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
              <ErrorText>{dialogError}</ErrorText>
              <div className="flex gap-2">
                <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={closeAction}>Huỷ</button>
                <button disabled={dangGui || (action === 'password' && newPassword.length < 8)} onClick={() => void submitAction()} className={primaryClass}>
                  {dangGui ? 'Đang lưu...' : action === 'active' ? (target.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản') : 'Đặt lại mật khẩu'}
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </main>
  );
}
