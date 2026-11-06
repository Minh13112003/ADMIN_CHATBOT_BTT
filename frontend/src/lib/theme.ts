export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'red' | 'blue' | 'green' | 'purple';
export type FontSize = 'small' | 'medium' | 'large';
export type Density = 'comfortable' | 'compact';
export type ThemeSettings = { mode: ThemeMode; accent: Accent; fontSize: FontSize; density: Density; reduceMotion: boolean | null };

export const THEME_KEY = 'btt_ui_settings';
export const DEFAULT_THEME: ThemeSettings = { mode: 'system', accent: 'red', fontSize: 'medium', density: 'comfortable', reduceMotion: null };

export function readTheme(): ThemeSettings {
  try {
    const value = JSON.parse(localStorage.getItem(THEME_KEY) ?? '{}') as Partial<ThemeSettings>;
    return {
      mode: ['light', 'dark', 'system'].includes(value.mode ?? '') ? value.mode! : 'system',
      accent: ['red', 'blue', 'green', 'purple'].includes(value.accent ?? '') ? value.accent! : 'red',
      fontSize: ['small', 'medium', 'large'].includes(value.fontSize ?? '') ? value.fontSize! : 'medium',
      density: ['comfortable', 'compact'].includes(value.density ?? '') ? value.density! : 'comfortable',
      reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : null,
    };
  } catch { return { ...DEFAULT_THEME }; }
}

export function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = settings.accent;
  root.dataset.density = settings.density;
  root.dataset.reduceMotion = settings.reduceMotion === null
    ? (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'true' : 'false')
    : String(settings.reduceMotion);
  root.style.fontSize = { small: '14px', medium: '16px', large: '18px' }[settings.fontSize];
}

export function saveTheme(settings: ThemeSettings) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(settings)); } catch { /* Trình duyệt riêng tư có thể chặn lưu. */ }
  applyTheme(settings);
}
