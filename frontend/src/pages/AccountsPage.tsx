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
  const [loi, setLoi] = useState('');
  const [baoXong, setBaoXong] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [target, setTarget] = useState<Account | null>(null);
  const [action, setAction] = useState<'active' | 'password'>('active');
  const [newPassword, setNewPassword] = useState('');
  const [shownPassword, setShownPassword] = useState('');
  const [dialogError, setDialogError] = useState('');
  const visibleAccounts = accounts?.filter((a) => filter === 'all' || (filter === 'active' ? a.isActive : !a.isActive));

  const openAction = (account: Account, next: 'active' | 'password') => { setTarget(account); setAction(next); setNewPassword(''); setShownPassword(''); setDialogError(''); };
  const closeAction = () => { setTarget(null); setNewPassword(''); setShownPassword(''); setDialogError(''); };
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
    } catch (err) { setDialogError(loiCua(err)); }
    finally { setDangGui(false); }
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
      await mutate();
    } catch (err) {
      setLoi(loiCua(err));
    } finally {
      setDangGui(false);
    }
  };

  if (meError) return <p className="p-6 text-sm text-brand-text">Không tải được thông tin tài khoản.</p>;
  if (!isAdmin) return <p className="p-6 text-sm text-muted">Đang tải...</p>;

  return (
    <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold">Tài khoản nhân viên</h1>
        <p className="text-sm text-muted">Admin tạo tài khoản sale, xem thống kê và dùng hội thoại như sale.</p>
      </header>

      <form onSubmit={gui} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold">Tạo tài khoản sale</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Họ tên">
            <input required minLength={2} value={form.fullName} onChange={doi('fullName')} className={inputClass} />
          </Field>
          <Field label="Email đăng nhập">
            <input type="email" required value={form.email} onChange={doi('email')} className={inputClass} />
          </Field>
          <Field label="Mật khẩu (ít nhất 8 ký tự)">
            <input required minLength={8} autoComplete="new-password" value={form.password} onChange={doi('password')} className={inputClass} />
          </Field>
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

      <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line-soft p-4"><label className="block max-w-xs text-sm font-medium">Lọc tài khoản <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={`${inputClass} mt-1.5`}><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="locked">Đã khoá</option></select></label></div>
        <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
          <colgroup><col className="w-[15%]" /><col className="w-[23%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[11%]" /></colgroup>
          <thead>
            <tr className="text-left text-body">
              {['Họ tên', 'Email', 'Mã nhân viên', 'Vị trí', 'Vai trò', 'Trạng thái', 'Đăng nhập gần nhất', 'Thao tác'].map((h) => (
                <th key={h} scope="col" className="border-b border-line px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleAccounts?.map((a) => (
              <tr key={a.id}>
                <td className="border-b border-line-soft px-3 py-3 font-medium">{a.fullName}</td>
                <td className="break-all border-b border-line-soft px-3 py-3">{a.email}</td>
                <td className="break-words border-b border-line-soft px-3 py-3">{a.employeeCode ?? 'Chưa có'}</td>
                <td className="break-words border-b border-line-soft px-3 py-3">{a.position ?? 'Chưa có'}</td>
                <td className="border-b border-line-soft px-3 py-3">{a.role === 'ADMIN' ? 'Admin' : 'Sale'}</td>
                <td className="border-b border-line-soft px-3 py-3">{a.isActive ? 'Đang hoạt động' : 'Đã khoá'}</td>
                <td className="border-b border-line-soft px-3 py-3 text-xs">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td>
                <td className="border-b border-line-soft px-3 py-3"><div className="flex flex-col items-start gap-1"><button type="button" onClick={() => openAction(a, 'active')} disabled={a.id === me?.id && a.isActive} className="min-h-9 text-left text-brand-text underline disabled:cursor-not-allowed disabled:opacity-40">{a.isActive ? 'Khoá' : 'Mở khoá'}</button><button type="button" onClick={() => openAction(a, 'password')} disabled={a.role === 'ADMIN' && a.id !== me?.id} className="min-h-9 text-left text-brand-text underline disabled:cursor-not-allowed disabled:opacity-40">Đặt lại mật khẩu</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="divide-y divide-line-soft xl:hidden">
          {visibleAccounts?.map((a) => (
            <article key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{a.fullName}</h3>
                  <p className="break-all text-sm text-body">{a.email}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.isActive ? 'bg-green-soft text-on' : 'bg-fill text-muted'}`}>{a.isActive ? 'Đang hoạt động' : 'Đã khoá'}</span>
              </div>
              <dl className="mt-3 grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Vai trò</dt><dd>{a.role === 'ADMIN' ? 'Admin' : 'Sale'}</dd>
                <dt className="text-muted">Mã nhân viên</dt><dd className="break-words">{a.employeeCode ?? 'Chưa có'}</dd>
                <dt className="text-muted">Vị trí</dt><dd className="break-words">{a.position ?? 'Chưa có'}</dd>
                <dt className="text-muted">Đăng nhập gần nhất</dt><dd>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                <button type="button" onClick={() => openAction(a, 'active')} disabled={a.id === me?.id && a.isActive} className="min-h-11 rounded-lg border border-field px-3 text-sm font-medium text-brand-text disabled:cursor-not-allowed disabled:opacity-40">{a.isActive ? 'Khoá tài khoản' : 'Mở khoá'}</button>
                <button type="button" onClick={() => openAction(a, 'password')} disabled={a.role === 'ADMIN' && a.id !== me?.id} className="min-h-11 rounded-lg border border-field px-3 text-sm font-medium text-brand-text disabled:cursor-not-allowed disabled:opacity-40">Đặt lại mật khẩu</button>
              </div>
            </article>
          ))}
        </div>
        {!accounts && !error && <p className="p-4 text-sm text-muted">Đang tải danh sách tài khoản...</p>}
        {visibleAccounts?.length === 0 && <p className="p-4 text-sm text-muted">Không có tài khoản nào phù hợp.</p>}
        {error && <p className="p-4 text-sm text-brand-text">Không tải được danh sách tài khoản.</p>}
      </section>
      {target && <Dialog title={action === 'active' ? (target.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản') : 'Đặt lại mật khẩu'} onClose={closeAction}>
        {shownPassword ? <div><p>Mật khẩu mới của {target.fullName} (chỉ hiện lần này):</p><p className="my-3 break-all rounded border p-3 font-mono">{shownPassword}</p><button className={primaryClass} onClick={closeAction}>Đã chép xong</button></div> : <div className="space-y-3">
          {action === 'active' ? <p>Bạn muốn {target.isActive ? 'khoá' : 'mở khoá'} tài khoản {target.fullName}?</p> : <Field label="Mật khẩu mới (ít nhất 8 ký tự)"><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} /></Field>}
          <ErrorText>{dialogError}</ErrorText><div className="flex gap-2"><button onClick={closeAction}>Huỷ</button><button disabled={dangGui || (action === 'password' && newPassword.length < 8)} onClick={() => void submitAction()} className={primaryClass}>{dangGui ? 'Đang lưu...' : 'Xác nhận'}</button></div>
        </div>}
      </Dialog>}
    </main>
  );
}
