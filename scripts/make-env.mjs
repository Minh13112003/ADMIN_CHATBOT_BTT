// Tạo backend/.env và frontend/.env từ file mẫu, sinh sẵn khoá bí mật. Không ghi đè file đã có.
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const be = 'backend/.env';
if (existsSync(be)) console.log(`${be} đã có, giữ nguyên`);
else {
  const hex = (n) => randomBytes(n).toString('hex');
  const out = readFileSync('backend/.env.example', 'utf8')
    .replace(/^JWT_SECRET=$/m, `JWT_SECRET=${hex(48)}`)
    .replace(/^INGEST_API_KEY=$/m, `INGEST_API_KEY=${hex(32)}`);
  writeFileSync(be, out);
  console.log(`Đã tạo ${be}`);
}
const fe = 'frontend/.env';
if (existsSync(fe)) console.log(`${fe} đã có, giữ nguyên`);
else {
  copyFileSync('frontend/.env.example', fe);
  console.log(`Đã tạo ${fe}`);
}
