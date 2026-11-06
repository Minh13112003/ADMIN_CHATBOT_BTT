import { useEffect, useState } from 'react';
import { Segmented, Switch } from '@/components/ui';
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
  useEffect(() => {
    applyTheme(settings);
    const color = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setSystemReduce(motion.matches); applyTheme(settings); };
    color.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => { color.removeEventListener('change', update); motion.removeEventListener('change', update); };
  }, [settings]);

  const change = (next: Partial<ThemeSettings>) => {
    const value = { ...settings, ...next };
    setSettings(value);
    saveTheme(value);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 p-4 sm:p-6">
      <header><h1 className="text-xl font-bold">Cài đặt giao diện</h1><p className="mt-1 text-sm text-muted">Thay đổi có hiệu lực ngay trên trình duyệt này.</p></header>
      <section className="space-y-6 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Tùy chọn hiển thị">
        <div className="space-y-2"><h2 className="font-semibold">Chế độ hiển thị</h2><Segmented label="Chế độ hiển thị" value={settings.mode} onChange={(mode) => change({ mode })} items={[{ key: 'light', label: 'Sáng' }, { key: 'dark', label: 'Tối' }, { key: 'system', label: 'Theo hệ thống' }]} /></div>
        <div className="space-y-2"><h2 className="font-semibold">Chủ đề màu</h2><div role="group" aria-label="Chủ đề màu" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ACCENTS.map((accent) => <button key={accent.key} type="button" aria-pressed={settings.accent === accent.key} onClick={() => change({ accent: accent.key })} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm ${settings.accent === accent.key ? 'border-brand-text bg-brand-soft font-semibold' : 'border-field bg-surface hover:bg-fill'}`}><span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-line" style={{ backgroundColor: accent.color }} />{accent.label}</button>)}</div></div>
        <div className="space-y-2"><h2 className="font-semibold">Cỡ chữ</h2><Segmented label="Cỡ chữ" value={settings.fontSize} onChange={(fontSize) => change({ fontSize })} items={[{ key: 'small', label: 'Nhỏ' }, { key: 'medium', label: 'Vừa' }, { key: 'large', label: 'Lớn' }]} /></div>
        <div className="space-y-2"><h2 className="font-semibold">Mật độ danh sách hội thoại</h2><Segmented label="Mật độ danh sách hội thoại" value={settings.density} onChange={(density) => change({ density })} items={[{ key: 'comfortable', label: 'Thoáng' }, { key: 'compact', label: 'Gọn' }]} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><div><h2 className="font-semibold">Giảm chuyển động</h2><p className="text-sm text-muted">Tắt hiệu ứng nhấp nháy ở hội thoại cần liên hệ.</p></div><Switch label="Giảm chuyển động" checked={settings.reduceMotion ?? systemReduce} onChange={(reduceMotion) => change({ reduceMotion })} /></div>
      </section>
      <button type="button" onClick={() => { setSettings({ ...DEFAULT_THEME }); saveTheme(DEFAULT_THEME); }} className="min-h-11 self-start rounded-xl border border-field bg-surface px-4 font-medium hover:bg-fill">Khôi phục mặc định</button>
    </main>
  );
}
