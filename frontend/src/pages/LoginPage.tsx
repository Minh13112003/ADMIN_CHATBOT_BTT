import { useState, type FormEvent } from 'react';
import { ErrorText, Field, inputClass, primaryClass } from '@/components/ui';
import { loiCua, post } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e: FormEvent) => {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    try {
      const u = await post<{ role: string }>('/auth/login', { email, password });
      window.location.href = '/inbox';
    } catch (err) {
      setLoi(loiCua(err));
      setDangGui(false);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={gui} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-[14px] bg-brand-dark text-[0.9375rem] font-bold text-white">BTT</div>
          <div>
            <h1 className="text-lg font-bold">Quản trị hội thoại</h1>
            <p className="text-sm text-muted">Đăng nhập bằng tài khoản được cấp</p>
          </div>
        </div>
        <Field label="Email">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Mật khẩu">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <ErrorText>{loi}</ErrorText>
        <button type="submit" disabled={dangGui} className={primaryClass}>
          {dangGui ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <p className="text-center text-xs text-muted">Chưa có tài khoản? Liên hệ quản trị viên để được cấp.</p>
      </form>
    </main>
  );
}
