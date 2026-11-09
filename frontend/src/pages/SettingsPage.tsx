import { useEffect, useState } from 'react';
import { Segmented, Switch } from '@/components/ui';
import useSWR from 'swr';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { fetcher, patch, post } from '@/lib/api';
import type { Me } from '@/lib/types';
import { playChime, readNotify, saveNotify } from '@/lib/notify';
import { applyTheme, DEFAULT_THEME, readTheme, saveTheme, type Accent, type ThemeSettings } from '@/lib/theme';

const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'red', label: 'Đỏ BenThanh', color: '#d0021b' },
  { key: 'blue', label: 'Xanh dương', color: '#185abc' },
  { key: 'green', label: 'Xanh lá', color: '#14784d' },
  { key: 'purple', label: 'Tím', color: '#7044aa' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<ThemeSettings>(readTheme);
  const [systemReduce, setSystemReduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const { data: me, mutate: mutateMe } = useSWR<Me>('/auth/me', fetcher);
  const [changePassword, setChangePassword] = useState(false);
  const [notify, setNotify] = useState(readNotify);
  useEffect(() => {
    applyTheme(settings);
    const color = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setSystemReduce(motion.matches);
      applyTheme(settings);
    };
    color.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => {
      color.removeEventListener('change', update);
      motion.removeEventListener('change', update);
    };
  }, [settings]);

  const change = (next: Partial<ThemeSettings>) => {
    const value = { ...settings, ...next };
    setSettings(value);
    saveTheme(value);
  };

  return (
    <main className="page-layout settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">KHÔNG GIAN CỦA BẠN</p>
          <h1>Cài đặt giao diện</h1>
          <p>Cá nhân hóa để làm việc thoải mái hơn. Các thay đổi được lưu tự động trên trình duyệt này.</p>
        </div>
      </header>
      <div className="settings-layout">
        <aside className="settings-index" aria-label="Mục cài đặt">
          <p>MỤC CÀI ĐẶT</p>
          <a href="#settings-mode">Giao diện & hiển thị</a>
          <a href="#settings-accent">Chủ đề màu</a>
          <a href="#settings-reading">Cỡ chữ & mật độ</a>
          <a href="#settings-account">Tài khoản của tôi</a>
          <a href="#settings-notify">Thông báo & Chuông</a>
          <a href="#settings-keys">Phím tắt</a>
          <a href="#settings-session">Phiên đăng nhập</a>
          <small>Thay đổi được lưu tự động trên trình duyệt này.</small>
        </aside>
        <div className="min-w-0 space-y-6">
        <section className="settings-controls space-y-6 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Tùy chọn hiển thị">
          <div id="settings-mode" className="space-y-4">
            <div><h2 className="font-semibold">1. Chế độ hiển thị</h2><p className="text-sm text-muted">Chọn giao diện phù hợp với ánh sáng nơi làm việc.</p></div>
            <Segmented
              label="Chế độ hiển thị"
              value={settings.mode}
              onChange={(mode) => change({ mode })}
              items={[
                { key: 'light', label: 'Sáng' },
                { key: 'dark', label: 'Tối' },
                { key: 'system', label: 'Theo hệ thống' },
              ]}
            />
            <div className="settings-preview-pair">
              <ThemePreview label="Giao diện sáng" dark={false} accent={settings.accent} active={settings.mode === 'light'} />
              <ThemePreview label="Giao diện tối" dark accent={settings.accent} active={settings.mode === 'dark'} />
            </div>
          </div>
          <div id="settings-accent" className="space-y-3">
            <h2 className="font-semibold">2. Chủ đề màu điểm nhấn</h2>
            <p className="text-sm text-muted">Màu dùng cho nút chính, trạng thái được chọn và biểu đồ.</p>
            <div role="group" aria-label="Chủ đề màu" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.key}
                  type="button"
                  aria-pressed={settings.accent === accent.key}
                  onClick={() => change({ accent: accent.key })}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm ${settings.accent === accent.key ? 'border-brand-text bg-brand-soft font-semibold' : 'border-field bg-surface hover:bg-fill'}`}
                >
                  <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-line" style={{ backgroundColor: accent.color }} />
                  {accent.label}
                </button>
              ))}
            </div>
          </div>
          <div id="settings-reading" className="space-y-2">
            <h2 className="font-semibold">3. Cỡ chữ</h2>
            <Segmented
              label="Cỡ chữ"
              value={settings.fontSize}
              onChange={(fontSize) => change({ fontSize })}
              items={[
                { key: 'small', label: 'Nhỏ' },
                { key: 'medium', label: 'Vừa' },
                { key: 'large', label: 'Lớn' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold">4. Mật độ danh sách hội thoại</h2>
            <Segmented
              label="Mật độ danh sách hội thoại"
              value={settings.density}
              onChange={(density) => change({ density })}
              items={[
                { key: 'comfortable', label: 'Thoáng' },
                { key: 'compact', label: 'Gọn' },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <div>
              <h2 className="font-semibold">Giảm chuyển động</h2>
              <p className="text-sm text-muted">Tắt hiệu ứng nhấp nháy ở hội thoại cần liên hệ.</p>
            </div>
            <Switch label="Giảm chuyển động" checked={settings.reduceMotion ?? systemReduce} onChange={(reduceMotion) => change({ reduceMotion })} />
          </div>
        </section>

      <section id="settings-notify" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-semibold">Thông báo & Chuông</h2>
        <p className="mb-4 text-sm text-muted">Phát tiếng chuông khi có khách đòi gặp nhân viên, đồng nghiệp chuyển khách hoặc đến giờ hẹn nhắc. Lưu trên trình duyệt này.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">Bật tiếng chuông</span>
          <div className="flex items-center gap-3">
            <button type="button" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => playChime(true)}>Nghe thử</button>
            <Switch label="Bật tiếng chuông" checked={notify.sound} onChange={(sound) => { const v = { sound }; setNotify(v); saveNotify(v); }} />
          </div>
        </div>
      </section>
      <section id="settings-session" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-semibold">Phiên đăng nhập & Bảo mật</h2>
        <p className="mb-3 text-sm text-muted">Phiên đăng nhập tự hết hạn sau 12 giờ. Hiện chưa xem được danh sách các thiết bị khác.</p>
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-2 text-sm">
          <dt className="text-muted">Thiết bị này</dt>
          <dd className="break-words">{navigator.userAgent.includes("Edg/") ? "Microsoft Edge" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Chrome") ? "Google Chrome" : "Trình duyệt khác"} · {navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Android") ? "Android" : navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Mac") ? "macOS" : "Hệ điều hành khác"}</dd>
          <dt className="text-muted">Tài khoản</dt>
          <dd>{me?.email ?? "Đang tải..."}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => setChangePassword(true)}>Đổi mật khẩu</button>
          <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={async () => { await post("/auth/logout"); window.location.href = "/login"; }}>Đăng xuất</button>
        </div>
      </section>
      <section id="settings-keys" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">Phím tắt thao tác nhanh</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ['Esc', 'Đóng bảng đang mở'],
            ['Enter', 'Chọn mẫu trong bảng Câu trả lời nhanh'],
            ['↑ ↓', 'Di chuyển giữa các mẫu'],
            ['Tab', 'Chuyển giữa các ô và nút'],
          ].map(([key, text]) => (
            <li key={key} className="flex items-center gap-3 rounded-lg bg-fill px-3 py-2">
              <kbd className="min-w-10 rounded border border-field bg-surface px-2 py-0.5 text-center font-mono text-xs font-bold">{key}</kbd>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
      <button
        type="button"
        onClick={() => {
          setSettings({ ...DEFAULT_THEME });
          saveTheme(DEFAULT_THEME);
        }}
        className="min-h-11 self-start rounded-xl border border-field bg-surface px-4 font-medium hover:bg-fill"
      >
        Khôi phục mặc định
      </button>
      <section id="settings-account" className="rounded-2xl border border-line bg-surface p-5"><h2 className="mb-3 font-semibold">Tài khoản của tôi</h2>{!me ? <p className="text-sm text-muted">Đang tải...</p> : <><p className="font-medium">{me.fullName}</p><p className="text-sm text-muted">{me.email} · {me.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên tư vấn'}</p>{me.role === 'SALE' && <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm">Đang trực, nhận khách tự động</span><Switch label="Đang trực" checked={me.onDuty} onChange={async (onDuty) => { await patch('/users/me/duty', { onDuty }); await mutateMe(); }} /></div>}<div className="mt-5 flex flex-wrap gap-2"><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => setChangePassword(true)}>Đổi mật khẩu</button><button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={async () => { await post('/auth/logout'); window.location.href = '/login'; }}>Đăng xuất</button></div></>}</section>
        </div>
      </div>
      {changePassword && <ChangePasswordDialog onClose={() => setChangePassword(false)} />}
    </main>
  );
}

function ThemePreview({ label, dark, accent, active }: { label: string; dark: boolean; accent: Accent; active: boolean }) {
  const color = ACCENTS.find((item) => item.key === accent)?.color ?? '#d0021b';
  return <div className={`theme-preview ${dark ? 'theme-preview-dark' : 'theme-preview-light'} ${active ? 'is-active' : ''}`}>
    <strong>{label}</strong><span>{active ? 'Đang áp dụng' : 'Xem trước'}</span>
    <div className="theme-preview-chat"><div className="theme-preview-person">Khách hàng · 09:18</div><p>Chào bạn, tôi muốn tìm hiểu tour Châu Âu.</p><p style={{ backgroundColor: color, color: '#fff' }}>BenThanh Tourist sẵn sàng tư vấn cho bạn.</p><div className="theme-preview-input">Nhập nội dung phản hồi...</div></div>
  </div>;
}
