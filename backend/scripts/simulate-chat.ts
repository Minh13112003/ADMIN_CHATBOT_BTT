// Giả lập chatbot đẩy tin vào để xem trang quản trị khi chưa nối chatbot thật. Chỉ dùng trên database thử.
// Chạy: pnpm simulate (backend phải đang chạy).
import 'dotenv/config';

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1/ingest`;
const headers = { 'Content-Type': 'application/json', 'x-ingest-key': process.env.INGEST_API_KEY ?? '' };

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const the = (ten: string, meta: string) => [{ ten_tour: ten, mo_ta: meta }];

async function main() {
  const hoa = { channel: 'APP', externalUserId: 'demo-app-hoa', customer: { name: 'Nguyễn Thị Hoa', phone: '0900000101' } };
  await post('inbound', { ...hoa, text: 'Có tour Trung Quốc 6 ngày dịp Tết cho 2 người không?', interest: 'Trung Quốc, dịp Tết' });
  await post('bot-reply', { ...hoa, text: 'Hiện BenThanh Tourist chưa có tour Trung Quốc nào vào dịp Tết kéo dài 6 ngày. Bên mình có tour tương tự:', tours: the('Du Lịch Trung Quốc (Tết Âm Lịch 2027)', '5 ngày 4 đêm · khởi hành 07/02/2027 · 34.990.000 đ'), model: 'gemini-3.1-flash-lite', inputTokens: 1800, outputTokens: 120 });
  await post('inbound', { ...hoa, text: 'Cho tôi gặp nhân viên, nhà tôi muốn đi đoàn 12 người' });

  const nam = { channel: 'WEB', externalUserId: 'demo-web-nam' };
  await post('identify', { ...nam, name: 'Trần Văn Nam', phone: '0900000102' });
  await post('inbound', { ...nam, text: 'Tour Đà Lạt có gì hay?', interest: 'Đà Lạt' });
  await post('bot-reply', { ...nam, text: 'Bên mình đang có tour Đà Lạt 3 ngày 2 đêm, đi đồi chè, làng hoa và nông trại cún.', tours: the('Du Lịch Đà Lạt: Thác Đamb’ri - Puppy Farm', '3 ngày 2 đêm · 3.790.000 đ'), model: 'gemini-3.1-flash-lite', inputTokens: 1500, outputTokens: 90 });

  const lan = { channel: 'WEB', externalUserId: 'demo-web-lan-may-1' };
  await post('identify', { ...lan, name: 'Ngọc Lan', phone: '0900000107' });
  await post('inbound', { ...lan, text: 'Tour Thái Lan rẻ nhất là tour nào?', interest: 'Thái Lan' });
  await post('bot-reply', { ...lan, text: 'Tour rẻ nhất hiện có là Bangkok - Pattaya, 5 ngày 4 đêm.', model: 'gemini-3.1-flash-lite', inputTokens: 1400, outputTokens: 70 });
  await post('identify', { channel: 'WEB', externalUserId: 'demo-web-lan-may-2', name: 'Bùi Ngọc Lan', phone: '0900 000 107' });
  await post('inbound', { channel: 'WEB', externalUserId: 'demo-web-lan-may-2', text: 'Cho mình xin giá đoàn 20 người' });

  const huy = { channel: 'APP', externalUserId: 'demo-app-huy', customer: { name: 'Hoàng Gia Huy', phone: '0900000108' } };
  await post('inbound', { ...huy, text: 'Tôi muốn đặt tour Bali 2 người', interest: 'Bali' });
  await post('bot-reply', { ...huy, text: 'Mình đã mở trang đặt tour Bali cho 2 khách. Bạn kiểm tra rồi bấm Đặt tour nhé.', model: 'gemini-3.1-flash-lite', inputTokens: 900, outputTokens: 40 });
  await post('deal', { ...huy, tourName: 'Du Lịch Bali: Nusa Penida - Uluwatu', guests: 2, amount: 29980000, orderCode: 'DEMO-BALI-1' });

  console.log('Đã đẩy dữ liệu giả lập vào.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
