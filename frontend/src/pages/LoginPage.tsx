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
      await post<{ role: string }>('/auth/login', { email, password });
      window.location.href = '/inbox';
    } catch (err) {
      setLoi(loiCua(err));
      setDangGui(false);
    }
  };

  return (
    <main className="login-layout">
      <aside className="login-story">
        <img src="/logo.png" alt="BenThanh Tourist" width="64" height="64" className="rounded-2xl bg-white p-2" />
        <h2>
          Mỗi cuộc trò chuyện.
          <br />
          Một hành trình mới.
        </h2>
        <p>Kết nối khách hàng, phối hợp cùng đội ngũ và đồng hành trong từng chuyến đi.</p>
      </aside>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={gui} className="flex w-full max-w-sm flex-col gap-5">
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
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <ErrorText>{loi}</ErrorText>
          <button type="submit" disabled={dangGui} className={primaryClass}>
            {dangGui ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
          <p className="text-center text-xs text-muted">Chưa có tài khoản? Liên hệ quản trị viên để được cấp.</p>
        </form>
      </div>
    </main>
  );
}
