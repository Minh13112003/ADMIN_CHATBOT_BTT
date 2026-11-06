import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// strictPort: cổng 3002 bận thì báo lỗi, không tự nhảy sang cổng khác (backend chỉ cho phép đúng địa chỉ FRONTEND_URL).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port: 3002, strictPort: true },
  preview: { port: 3002, strictPort: true },
});
