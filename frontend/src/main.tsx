import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
// Be Vietnam Pro, không dùng Rubik: Google Fonts không có bộ chữ tiếng Việt cho Rubik, dấu sẽ bị lẫn font.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './globals.css';
import { App } from './App';
import { applyTheme, readTheme } from './lib/theme';

applyTheme(readTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(readTheme()));
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyTheme(readTheme()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
