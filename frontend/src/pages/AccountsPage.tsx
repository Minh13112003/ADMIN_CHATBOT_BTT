import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Dialog, ErrorText, Field, inputClass, primaryClass } from '@/components/ui';
import { fetcher, loiCua, patch, post } from '@/lib/api';
import type { Account, Department, Me } from '@/lib/types';
import { ReportIcon } from '@/components/stats/AnalyticsUI';
import '@/components/stats/analytics.css';

const VAI_TRO = { ADMIN: 'Admin toàn quyền', DEPT_ADMIN: 'Admin phòng', DIGITAL: 'Admin Digital', SALE: 'Sale (Tư vấn)' } as const;
const vaiTro = (a: Account) => (a.department?.name && (a.role === 'SALE' || a.role === 'DEPT_ADMIN') ? `${VAI_TRO[a.role]} · ${a.department.name}` : VAI_TRO[a.role]);

const TRONG = { fullName: '', email: '', password: '', employeeCode: '', position: '', role: 'SALE', departmentId: '' };

export default function AccountsPage() {
  const { data: me, error: meError } = useSWR<Me>('/auth/me', fetcher);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'DEPT_ADMIN';
  const laChu = me?.role === 'ADMIN';
  const { data: accounts, error, mutate } = useSWR<Account[]>(isAdmin ? '/users' : null, fetcher);
  const { data: phongBan, mutate: lamMoiPhong } = useSWR<Department[]>(isAdmin ? '/departments' : null, fetcher);
  const [scope, setScope] = useState<string[]>([]);
  const [tenPhong, setTenPhong] = useState('');
  const taoPhong = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post('/departments', { name: tenPhong });
      setTenPhong('');
      setLoi('');
      await lamMoiPhong();
    } catch (err) {
      setLoi(loiCua(err));
    }
  };
  const [form, setForm] = useState(TRONG);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [loi, setLoi] = useState('');
  const [baoXong, setBaoXong] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [locVaiTro, setLocVaiTro] = useState('');
  const [locPhong, setLocPhong] = useState('');
  const [target, setTarget] = useState<Account | null>(null);
  const [action, setAction] = useState<'active' | 'password'>('active');
  const [newPassword, setNewPassword] = useState('');
  const [shownPassword, setShownPassword] = useState('');
  const [dialogError, setDialogError] = useState('');
  const visibleAccounts = accounts?.filter(
    (a) =>
      (filter === 'all' || (filter === 'active' ? a.isActive : !a.isActive)) &&
      (!locVaiTro || a.role === locVaiTro) &&
      (!locPhong || a.departmentId === locPhong) &&
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
      const u = await post<Account>('/users', { ...form, role: laChu ? form.role : 'SALE', departmentId: form.role === 'DIGITAL' ? undefined : (laChu ? form.departmentId : me?.departmentId) || undefined, scopeIds: form.role === 'DIGITAL' ? scope : undefined });
      setBaoXong(`Đã tạo tài khoản ${u.email}. Bạn gửi mật khẩu cho nhân viên qua kênh riêng.`);
      setForm(TRONG);
      setScope([]);
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
    <main className="analytics-page accounts-report">
      <header className="report-heading">
        <div>
          <div className="report-eyebrow">QUẢN TRỊ ĐỘI NGŨ / {laChu ? 'TOÀN CÔNG TY' : me?.department?.name}</div>
          <h1>Tài khoản & Phân quyền phòng ban</h1>
          <p>Quản lý nhân sự, phạm vi truy cập và đội ngũ tư vấn.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoi('');
            setCreating(true);
          }}
          className="report-button primary"
        >
          + Tạo tài khoản
        </button>
      </header>
      <section className="report-role-matrix" aria-label="Phạm vi quản trị">
        {laChu && <article className="owner-role"><ReportIcon type="lock" /><span className="report-badge red">Admin toàn quyền</span><h2>Quản lý toàn công ty</h2><p>Xem tất cả phòng ban, tạo admin phòng và tài khoản sale.</p><strong>Tài khoản hiện tại của bạn giữ toàn quyền.</strong></article>}
        <article className="department-role"><ReportIcon type="people" /><span className="report-badge blue">Admin phòng ban</span><h2>{laChu ? 'Quản lý trong từng phòng' : me?.department?.name ?? 'Phòng của bạn'}</h2><p>Thống kê, hội thoại và nhân viên thuộc phạm vi phòng mình.</p><strong>Chỉ tạo sale trong phòng, không tạo admin khác.</strong></article>
        <article><ReportIcon type="message" /><span className="report-badge">Tư vấn viên</span><h2>Chăm sóc & Chốt tour</h2><p>Tiếp nhận hội thoại, tư vấn và xác nhận đơn tour theo phân công.</p><strong>Nhân sự gắn với phòng ban được chỉ định.</strong></article>
      </section>
      {laChu && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-base font-bold">Phòng ban</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {phongBan?.map((p) => <span key={p.id} className="rounded-full bg-fill px-3 py-1.5 text-sm font-medium">{p.name} · {p.members} người</span>)}
            {phongBan?.length === 0 && <span className="text-sm text-muted">Chưa có phòng ban. Tạo phòng đầu tiên (ví dụ Khách lẻ FIT, Inbound).</span>}
          </div>
          <form onSubmit={taoPhong} className="mt-3 flex flex-wrap gap-2">
            <input required minLength={2} value={tenPhong} onChange={(e) => setTenPhong(e.target.value)} placeholder="Tên phòng ban mới" className={`${inputClass} max-w-xs`} />
            <button type="submit" className={primaryClass}>Thêm phòng</button>
          </form>
        </section>
      )}
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
        {[
          { label: 'Tổng tài khoản', value: accounts?.length },
          ...(laChu ? [{ label: 'Admin toàn quyền', value: accounts?.filter((a) => a.role === 'ADMIN').length }, { label: 'Admin phòng ban', value: accounts?.filter((a) => a.role === 'DEPT_ADMIN').length }] : []),
          { label: 'Tư vấn viên (Sale)', value: accounts?.filter((a) => a.role === 'SALE').length },
          ...(laChu ? [{ label: 'Admin Digital', value: accounts?.filter((a) => a.role === 'DIGITAL').length }] : []),
          { label: 'Tạm dừng', value: accounts?.filter((a) => !a.isActive).length },
        ].map((item) => (
          <div className="rounded-2xl border border-line bg-surface shadow-sm p-5 max-md:p-3 [&_span]:block [&_span]:text-[0.8rem] [&_span]:text-muted max-md:[&_span]:text-[0.7rem] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[1.8rem] [&_strong]:font-semibold [&_strong]:tabular-nums max-md:[&_strong]:text-[1.4rem]" key={item.label}>
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
          title={laChu ? 'Tạo tài khoản' : 'Tạo tài khoản sale'}
          variant="drawer"
          onClose={() => {
            if (!dangGui) setCreating(false);
          }}
        >
          <form onSubmit={gui} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {laChu && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium">Vai trò phân quyền</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([['SALE', 'Tư vấn viên (Sale)', 'Trực chat và nhận khách'], ['DEPT_ADMIN', 'Admin phòng ban', 'Quản lý sale, thống kê của phòng'], ['DIGITAL', 'Admin Digital', 'Chỉ xem nhu cầu tour']] as const).map(([v, ten, mota]) => (
                      <label key={v} className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-xl border-2 px-3 py-2 ${form.role === v ? 'border-brand bg-brand-faint' : 'border-line'}`}>
                        <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="vai-tro" checked={form.role === v} onChange={() => setForm((f) => ({ ...f, role: v }))} />{ten}</span>
                        <span className="mt-0.5 text-xs text-muted">{mota}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {laChu && form.role !== 'DIGITAL' && (
                <Field label="Phòng ban">
                  <select required value={form.departmentId} onChange={doi('departmentId')} className={inputClass}>
                    <option value="">Chọn phòng ban</option>
                    {phongBan?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              )}
              {laChu && form.role === 'DIGITAL' && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium">Được xem nhu cầu tour của</legend>
                  <div className="flex flex-wrap gap-2">
                    {[...(phongBan ?? []), { id: 'CHUA_PHAN', name: 'Khách chưa chia cho sale', members: 0 }].map((p) => (
                      <label key={p.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
                        <input type="checkbox" checked={scope.includes(p.id)} onChange={(e) => setScope((v) => (e.target.checked ? [...v, p.id] : v.filter((x) => x !== p.id)))} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
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

      <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
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
          <select value={locVaiTro} onChange={(e) => setLocVaiTro(e.target.value)} aria-label="Lọc theo vai trò" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[0.8125rem] font-semibold">
            <option value="">Tất cả vai trò</option>
            {laChu && <option value="ADMIN">Admin toàn quyền</option>}
            {laChu && <option value="DEPT_ADMIN">Admin phòng ban</option>}
            {laChu && <option value="DIGITAL">Admin Digital</option>}
            <option value="SALE">Tư vấn viên (Sale)</option>
          </select>
          {laChu && (
            <select value={locPhong} onChange={(e) => setLocPhong(e.target.value)} aria-label="Lọc theo phòng ban" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[0.8125rem] font-semibold">
              <option value="">Tất cả phòng ban</option>
              {phongBan?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
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
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[1100px] border-collapse text-sm"><thead><tr className="bg-fill text-left text-body"><th className="whitespace-nowrap p-4">Nhân viên</th><th className="whitespace-nowrap p-4">Vai trò</th><th className="whitespace-nowrap p-4">Mã nhân viên</th><th className="whitespace-nowrap p-4">Vị trí</th><th className="whitespace-nowrap p-4">Đang giữ</th><th className="whitespace-nowrap p-4">Đăng nhập gần nhất</th><th className="whitespace-nowrap p-4">Trạng thái</th><th className="whitespace-nowrap p-4">Thao tác</th></tr></thead><tbody>{visibleAccounts?.map((a) => <tr key={a.id} className="border-t border-line-soft hover:bg-page"><td className="whitespace-nowrap p-4"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">{a.fullName.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}</span><div><strong>{a.fullName}</strong>{a.id === me?.id && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[0.6875rem] font-bold text-brand-text">Bạn</span>}<span className="block text-xs text-muted">{a.email}</span></div></div></td><td className="whitespace-nowrap p-4"><span className={`rounded px-2 py-0.5 text-xs font-bold ${a.role === 'ADMIN' ? 'bg-brand-soft text-brand-text' : 'bg-fill text-body'}`}>{vaiTro(a)}</span></td><td className="whitespace-nowrap p-4">{a.employeeCode ?? 'Chưa có'}</td><td className="whitespace-nowrap p-4">{a.position ?? 'Chưa có'}</td><td className="whitespace-nowrap p-4">{a.holding ? <span className="rounded-full bg-auto px-2.5 py-1 text-xs font-bold text-auto-ink">{a.holding} khách</span> : <span className="text-muted">0</span>}</td><td className="whitespace-nowrap p-4">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td><td className="whitespace-nowrap p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.isActive ? 'bg-green-soft text-green-ink' : 'bg-fill text-muted'}`}>{a.isActive ? 'Đang hoạt động' : 'Đã khoá'}</span></td><td className="whitespace-nowrap p-4"><div className="flex gap-2"><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" disabled={a.id === me?.id && a.isActive} onClick={() => openAction(a, 'active')}>{a.isActive ? 'Khoá' : 'Mở khoá'}</button><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" disabled={a.role === 'ADMIN' && a.id !== me?.id} onClick={() => openAction(a, 'password')}>Đặt lại mật khẩu</button></div></td></tr>)}</tbody></table></div>
        <div className="grid grid-cols-2 max-[1199px]:grid-cols-1 xl:hidden">
          {visibleAccounts?.map((a) => (
            <article key={a.id} className="border-b border-line-soft p-6 max-md:p-[18px] odd:border-r odd:border-r-line-soft max-[1199px]:odd:border-r-0">
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
                <dd>{vaiTro(a)}</dd>
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
