// Chỉ chạy với server/database thử riêng. Không gọi API gửi thật của Zalo hoặc Meta.
import assert from 'node:assert/strict';
import sharp from 'sharp';

async function main() {
  assert.equal(process.env.SMOKE_CONFIRM, '1', 'Cần SMOKE_CONFIRM=1 trên server thử');
  const base = `http://localhost:${process.env.PORT ?? 4409}/api/v1`;
  const login = async (email: string, password: string) => {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 200);
    return r.headers.getSetCookie()[0].split(';')[0];
  };
  const admin = await login(process.env.SMOKE_ADMIN_EMAIL!, process.env.SMOKE_ADMIN_PASSWORD!);
  const call = (path: string, cookie = admin, method = 'GET', body?: unknown) => fetch(`${base}${path}`, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const stamp = Date.now();
  const department = await (await call('/departments', admin, 'POST', { name: `Thử sticker ${stamp}` })).json() as { id: string };
  const account = { email: `stickers-${stamp}@test.vn`, password: 'StickerSale123!', fullName: 'Sale thử sticker', employeeCode: `ST-${stamp}`, departmentId: department.id };
  assert.equal((await call('/users', admin, 'POST', account)).status, 201);
  const sale = await login(account.email, account.password);
  assert.equal((await call('/stickers', '')).status, 401);
  assert.equal((await call('/stickers', sale)).status, 200);

  const raw = Buffer.alloc(32 * 64 * 4);
  for (let i = 0; i < 32 * 64; i++) { raw[i * 4 + (i < 1024 ? 0 : 1)] = 255; raw[i * 4 + 3] = i % 32 < 8 ? 0 : 255; }
  const webp = await sharp(raw, { raw: { width: 32, height: 64, channels: 4, pageHeight: 32 } }).webp({ lossless: true, delay: [400, 600], loop: 0 }).toBuffer();
  const upload = (cookie: string, bytes = webp) => {
    const form = new FormData(); form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/webp' }), 'thu-chuyen-dong.webp');
    return fetch(`${base}/stickers`, { method: 'POST', headers: { cookie }, body: form });
  };
  assert.equal((await upload(sale)).status, 403);
  assert.equal((await upload(admin, Buffer.from('not a webp'))).status, 400);
  const response = await upload(admin);
  assert.equal(response.status, 201);
  const sticker = await response.json() as { id: string };
  const listed = await (await call('/stickers', sale)).json() as Array<{ id: string; url: string; animated: boolean }>;
  const entry = listed.find((s) => s.id === sticker.id)!;
  assert.equal(entry.animated, true);
  assert.equal((await call(entry.url, '')).status, 401);
  const preview = await call(entry.url, sale);
  assert.equal((await sharp(Buffer.from(await preview.arrayBuffer()), { animated: true }).metadata()).pages, 2);

  const identified = await fetch(`${base}/ingest/identify`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ingest-key': process.env.INGEST_API_KEY! },
    body: JSON.stringify({ channel: 'WEB', externalUserId: `sticker-${stamp}`, name: 'Khách thử sticker', phone: `09${String(stamp).slice(-8)}` }) });
  assert.equal(identified.status, 200);
  const conv = { id: (await identified.json() as { conversationId: string }).conversationId };
  const sent = await call(`/conversations/${conv.id}/messages/sticker`, sale, 'POST', { stickerId: sticker.id, confirm: true });
  assert.equal(sent.status, 201, await sent.clone().text());
  const message = await sent.json() as { attachment: { url: string; type: string } };
  assert.equal(message.attachment.type, 'image/gif');
  const download = async () => Buffer.from(await (await fetch(`${base}${message.attachment.url}`)).arrayBuffer());
  assert.equal((await sharp(await download(), { animated: true }).metadata()).pages, 2);
  assert.equal((await call(`/stickers/${sticker.id}/hide`, sale, 'PATCH', {})).status, 403);
  assert.equal((await call(`/stickers/${sticker.id}/hide`, admin, 'PATCH', {})).status, 200);
  assert.equal((await call(`/conversations/${conv.id}/messages/sticker`, sale, 'POST', { stickerId: sticker.id, confirm: true })).status, 404);
  assert.equal((await sharp(await download(), { animated: true }).metadata()).pages, 2);
  // Giữ một sticker hoạt động để kiểm tra giao diện trên database thử.
  assert.equal((await upload(admin)).status, 201);
  console.log('PASS sticker API: quyền admin/sale/ẩn danh, WebP giả, ảnh động, gửi tin WEB, ẩn sticker không làm mất lịch sử.');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
