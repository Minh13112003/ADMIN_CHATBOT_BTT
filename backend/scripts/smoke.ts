// Kiểm thử toàn luồng trên server đang chạy, dữ liệu thật ghi vào DB nên CHỈ chạy trên database thử.
// Chạy: pnpm smoke. Cần SMOKE_CONFIRM=1 để tránh chạy nhầm vào Supabase thật.
import 'dotenv/config';
import assert from 'node:assert/strict';

if (process.env.SMOKE_CONFIRM !== '1') {
  console.error('Script ghi dữ liệu thử vào DB. Đặt SMOKE_CONFIRM=1 nếu đây là database thử.');
  process.exit(1);
}

const API = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const stamp = Date.now();

class Client {
  cookie = '';
  constructor(private ingest = false) {}
  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(this.ingest ? { 'x-ingest-key': process.env.INGEST_API_KEY ?? '' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  async login(email: string, password: string) {
    const r = await this.call('POST', '/auth/login', { email, password });
    assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`);
    return r.data;
  }
}

let ok = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  assert.ok(cond, `${name} ${detail ? JSON.stringify(detail) : ''}`);
  ok += 1;
  console.log(`  ok ${name}`);
};

async function main() {
  const anon = new Client();
  check('chưa đăng nhập bị 401', (await anon.call('GET', '/conversations')).status === 401);
  check('không có route đăng ký công khai', (await anon.call('POST', '/users', { email: 'x@x.vn', fullName: 'X Y', password: '12345678' })).status === 401);

  const admin = new Client();
  // Tạo admin thử trước bằng: pnpm create-admin <email> <mật khẩu> trên database thử.
  assert.ok(process.env.SMOKE_ADMIN_EMAIL && process.env.SMOKE_ADMIN_PASSWORD, 'Đặt SMOKE_ADMIN_EMAIL và SMOKE_ADMIN_PASSWORD (admin của database thử)');
  await admin.login(process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD);
  check('admin xem được hội thoại như sale', (await admin.call('GET', '/conversations')).status === 200);

  const mk = (ten: string) => ({ email: `${ten}.${stamp}@btt.test`, fullName: ten, password: 'matkhau123', employeeCode: `${ten}-${stamp}` });
  const [dMinh, dThao] = [mk('Minh'), mk('Thao')];
  const uMinh = await admin.call('POST', '/users', dMinh);
  const uThao = await admin.call('POST', '/users', dThao);
  check('admin tạo được sale', uMinh.status === 201 && uThao.status === 201 && !('passwordHash' in uMinh.data), uMinh);
  check('trùng email bị chặn', (await admin.call('POST', '/users', dMinh)).status === 409);

  const minh = new Client();
  await minh.login(dMinh.email, dMinh.password);
  const thao = new Client();
  await thao.login(dThao.email, dThao.password);
  check('sale không tạo được tài khoản', (await minh.call('POST', '/users', mk('Khac'))).status === 403);
  check('sale không xem được thống kê', (await minh.call('GET', '/stats?period=today')).status === 403);

  const bot = new Client(true);
  check('sai khoá ingest bị 401', (await new Client().call('POST', '/ingest/inbound', {})).status === 401);

  // Web: tên + số
  const web = { channel: 'WEB', externalUserId: `may-1-${stamp}` };
  const sdt = `09${String(stamp).slice(-8)}`;
  const id1 = await bot.call('POST', '/ingest/identify', { ...web, name: 'Nguyễn Thị Hoa', phone: sdt });
  check('khách mới không tải lịch sử', id1.status === 200 && id1.data.loadHistory === false, id1);
  check('tên khác hẳn cùng số bị từ chối', (await bot.call('POST', '/ingest/identify', { channel: 'WEB', externalUserId: `may-x-${stamp}`, name: 'Trần Tuấn', phone: sdt })).status === 409);
  const id2 = await bot.call('POST', '/ingest/identify', { channel: 'WEB', externalUserId: `may-2-${stamp}`, name: 'Thị Hoa', phone: sdt });
  check('máy khác, tên gần giống: nối hội thoại, không tải tin cũ', id2.data.conversationId === id1.data.conversationId && id2.data.loadHistory === false, id2);
  const id3 = await bot.call('POST', '/ingest/identify', { ...web, name: 'Nguyễn Thị Hoa', phone: sdt });
  check('đúng máy cũ thì tải lịch sử', id3.data.loadHistory === true, id3);
  check('số sai định dạng bị từ chối', (await bot.call('POST', '/ingest/identify', { ...web, name: 'A', phone: '123' })).status === 400);

  // Bot trả lời bình thường
  const cid = id1.data.conversationId;
  const m1 = await bot.call('POST', '/ingest/inbound', { ...web, text: 'Tour Đà Lạt giá bao nhiêu?', externalMessageId: `m1-${stamp}` });
  check('câu thường để bot trả lời', m1.data.action === 'BOT', m1);
  const dup = await bot.call('POST', '/ingest/inbound', { ...web, text: 'Tour Đà Lạt giá bao nhiêu?', externalMessageId: `m1-${stamp}` });
  check('gửi trùng không ghi 2 lần', dup.data.duplicate === true, dup);
  await bot.call('POST', '/ingest/bot-reply', { ...web, text: 'Giá 3.790.000 đ', model: 'gemini-3.1-flash-lite', inputTokens: 1000, outputTokens: 100 });

  // Từ khoá tự động
  const rule = await minh.call('POST', '/auto-replies', { name: `Giá đoàn ${stamp}`, type: 'KEYWORD', keywords: [`baogia${stamp}`], body: 'Mình cho em xin số khách nhé.' });
  check('tạo được quy tắc tự động', rule.status === 201, rule);
  const a1 = await bot.call('POST', '/ingest/inbound', { ...web, text: `cho minh xin baogia${stamp} nhe` });
  check('khớp từ khoá thì trả lời tự động', a1.data.action === 'AUTO_REPLY' && a1.data.reply === 'Mình cho em xin số khách nhé.', a1);

  // Đòi gặp nhân viên
  const c1 = await bot.call('POST', '/ingest/inbound', { ...web, text: 'Hãy cho tôi liên hệ với nhân viên' });
  check('đòi gặp nhân viên thành Liên hệ', c1.data.action === 'CONTACT', c1);
  const list = await minh.call('GET', '/conversations');
  check('Liên hệ ghim đầu danh sách', list.data.items[0].status === 'CONTACT', list.data.items[0]);
  const conv = await minh.call('GET', `/conversations/${cid}`);
  const nguoi = conv.data.assignee;
  check('hệ thống tự chia cho sale đang trực', !!nguoi, conv.data);

  const [chu, khac] = nguoi.id === uMinh.data.id ? [minh, thao] : nguoi.id === uThao.data.id ? [thao, minh] : [null, null];
  if (!chu || !khac) throw new Error('Trong DB có sale khác từ lần chạy trước, hãy dùng database mới');
  const idChu = nguoi.id;
  const idKhac = idChu === uMinh.data.id ? uThao.data.id : uMinh.data.id;
  const tenChu = nguoi.fullName;

  // Trả lời là nhận: không còn nút Nhận xử lý / Tiếp quản.
  const tl1 = await chu.call('POST', `/conversations/${cid}/messages`, { text: 'Dạ em chào chị Hoa' });
  check('người được chia trả lời luôn, không cần bấm nhận', tl1.status === 201, tl1);
  const sauTl = (await chu.call('GET', `/conversations/${cid}`)).data;
  check('trả lời là nhận: mode STAFF, Chờ xử lý, vẫn là người phụ trách', sauTl.mode === 'STAFF' && sauTl.status === 'PENDING' && sauTl.assignee.id === idChu && sauTl.role === 'OWNER', sauTl);
  check('bot im khi nhân viên đang xử lý', (await bot.call('POST', '/ingest/inbound', { ...web, text: 'Alo' })).data.action === 'STAFF');
  const lai = await bot.call('POST', '/ingest/inbound', { ...web, text: 'Cho tôi gặp nhân viên' });
  check('đang xử lý mà khách đòi lại: ghim Liên hệ, bot vẫn im', lai.data.action === 'STAFF' && (await chu.call('GET', `/conversations/${cid}`)).data.status === 'CONTACT', lai);
  check('nhân viên gửi được', (await chu.call('POST', `/conversations/${cid}/messages`, { text: 'Dạ chị cần em hỗ trợ gì ạ' })).status === 201);
  check('trả lời xong thì bỏ ghim Liên hệ', (await chu.call('GET', `/conversations/${cid}`)).data.status === 'PENDING');

  // Không khoá cứng: đồng nghiệp vẫn nhắn được, chỉ bị hỏi lại khi người kia vừa nhắn.
  const nhinKhac = (await khac.call('GET', `/conversations/${cid}`)).data;
  check('đồng nghiệp thấy ai đang nhắn', nhinKhac.role === 'SUPPORT' && nhinKhac.activeOther?.fullName === tenChu, nhinKhac);
  const chuaXacNhan = await khac.call('POST', `/conversations/${cid}/messages`, { text: 'Em bổ sung ạ' });
  check('gửi lúc đồng nghiệp đang nhắn thì được hỏi lại', chuaXacNhan.status === 409 && chuaXacNhan.data.code === 'OTHER_ACTIVE', chuaXacNhan);
  const hoTro = await khac.call('POST', `/conversations/${cid}/messages`, { text: 'Em bổ sung ạ', confirm: true });
  check('xác nhận rồi thì gửi được, ghi là hỗ trợ', hoTro.status === 201 && hoTro.data.staffLabel.includes(`hỗ trợ ${tenChu}`), hoTro);
  check('người hỗ trợ không đổi người phụ trách', (await chu.call('GET', `/conversations/${cid}`)).data.assignee.id === idChu);

  // Trả lời trích
  const tin = (await chu.call('GET', `/conversations/${cid}/messages`)).data.items as { id: string; text: string; internal: boolean }[];
  const alo = tin.find((m) => m.text === 'Alo')!;
  const trich = await chu.call('POST', `/conversations/${cid}/messages`, { text: 'Dạ em nghe ạ', replyToId: alo.id, confirm: true });
  check('trả lời trích một tin', trich.status === 201 && trich.data.replyTo?.text === 'Alo', trich);
  const noiBo = tin.find((m) => m.internal)!;
  check('không trích được log nội bộ', (await chu.call('POST', `/conversations/${cid}/messages`, { text: 'x', replyToId: noiBo.id, confirm: true })).status === 400);

  // Tin giao cho khách, log nội bộ không lọt ra ngoài
  const up = await bot.call('GET', `/ingest/updates?channel=WEB&externalUserId=${web.externalUserId}&after=2020-01-01T00:00:00Z`);
  check('khách nhận tin nhân viên', up.data.items.some((m: { text: string }) => m.text === 'Dạ em chào chị Hoa'), up);
  check('tin trích có dòng trích cho khách', up.data.items.some((m: { text: string }) => m.text === '“Alo”\nDạ em nghe ạ'), up);
  check('updates không chứa log nội bộ', !JSON.stringify(up.data).includes('nhận xử lý'));
  check('khách mở khung chat thì ghi đã xem', !!(await chu.call('GET', `/conversations/${cid}`)).data.customerSeenAt);

  // Chuyển đồng nghiệp kèm ghi chú
  const ho = await chu.call('POST', `/conversations/${cid}/handover`, { toUserId: idKhac, note: 'Khách hỏi đoàn 20 người' });
  check('chuyển khách cho đồng nghiệp', ho.data.assignee.id === idKhac, ho);
  const logChuyen = (await khac.call('GET', `/conversations/${cid}/messages`)).data.items.at(-1);
  check('log chuyển có ghi chú', logChuyen.internal && logChuyen.text.includes('Khách hỏi đoàn 20 người'), logChuyen);
  check('đồng nghiệp nhắn được ngay', (await khac.call('POST', `/conversations/${cid}/messages`, { text: 'Em tiếp nhận ạ', confirm: true })).status === 201);

  // Người trả lời trước nhận khách khi người được chia chưa trả lời
  const web2 = { channel: 'WEB', externalUserId: `may-3-${stamp}` };
  await bot.call('POST', '/ingest/identify', { ...web2, name: 'Lê Văn Bình', phone: `08${String(stamp).slice(-8)}` });
  const c2 = await bot.call('POST', '/ingest/inbound', { ...web2, text: 'Cho tôi gặp nhân viên' });
  const cid2 = c2.data.conversationId;
  const duocChia = (await minh.call('GET', `/conversations/${cid2}`)).data.assignee.id;
  const nguoiKia = duocChia === uMinh.data.id ? thao : minh;
  const idKia = duocChia === uMinh.data.id ? uThao.data.id : uMinh.data.id;
  check('người kia trả lời trước được', (await nguoiKia.call('POST', `/conversations/${cid2}/messages`, { text: 'Dạ em đây ạ' })).status === 201);
  check('người trả lời trước nhận khách', (await nguoiKia.call('GET', `/conversations/${cid2}`)).data.assignee.id === idKia);

  // Đơn khách tự đặt qua chatbot: chờ xác nhận, chưa tính doanh thu
  // Thống kê lưu tạm 5 phút theo kỳ: mỗi lần đo dùng một kỳ khác để được tính mới. Database thử mới tạo nên mọi đơn đều trong hôm nay.
  const truoc = (await admin.call('GET', '/stats?period=week')).data;
  const dat = await bot.call('POST', '/ingest/deal', { ...web, tourName: 'Đài Loan 5N4Đ', guests: 2, amount: 31_980_000, orderCode: `BK-${stamp}`, tourCode: 'a06.fit.tw.070227.a' });
  check('chatbot ghi đơn', dat.status === 200 && dat.data.ok, dat);
  const customerId = (await khac.call('GET', `/conversations/${cid}`)).data.customer.id;
  let dons = (await khac.call('GET', `/customers/${customerId}/deals`)).data;
  const donBot = dons.find((d: { orderCode: string }) => d.orderCode === `BK-${stamp}`);
  check('đơn chatbot là chờ xác nhận, mã tour viết hoa', donBot?.status === 'PENDING' && donBot.tourCode === 'A06.FIT.TW.070227.A' && donBot.source === 'CHATBOT', donBot);
  check('hội thoại chuyển Chờ xử lý, không phải Đã chốt', (await khac.call('GET', `/conversations/${cid}`)).data.status === 'PENDING');
  const giua = (await admin.call('GET', '/stats?period=month')).data;
  check('đơn chờ xác nhận chưa tính doanh thu', giua.totalRevenue === truoc.totalRevenue && giua.pending.count === truoc.pending.count + 1, { truoc: truoc.totalRevenue, giua: giua.totalRevenue, pending: giua.pending });

  // Sale gọi khách rồi xác nhận đúng đơn đó
  check('không chốt được bằng đổi trạng thái', (await khac.call('POST', `/conversations/${cid}/status`, { status: 'CLOSED' })).status === 400);
  check('thiếu mã tour thì không chốt được', (await khac.call('POST', `/conversations/${cid}/close`, { dealId: donBot.id, dayCode: 'Tour Đài Loan', guests: 2 })).status === 400);
  // Sale không gửi giá: backend lấy giá/người theo ngày khởi hành (đợt này không có trên website nên giữ giá lúc khách đặt) × 3 khách.
  const xn = await khac.call('POST', `/conversations/${cid}/close`, { dealId: donBot.id, dayCode: 'A06.FIT.TW.070227.A', guests: 3, amount: 1 });
  check('không nhận tổng tiền từ trình duyệt', xn.status === 400, xn);
  const xn2 = await khac.call('POST', `/conversations/${cid}/close`, { dealId: donBot.id, dayCode: 'A06.FIT.TW.070227.A', guests: 3 });
  check('xác nhận đơn chatbot (khách đổi thành 3 người)', xn2.status === 200 && xn2.data.status === 'CLOSED', xn2);
  dons = (await khac.call('GET', `/customers/${customerId}/deals`)).data;
  const daXn = dons.find((d: { id: string }) => d.id === donBot.id);
  check('xác nhận sửa đúng đơn cũ, không tạo đơn thứ hai', daXn.status === 'CONFIRMED' && daXn.guests === 3 && daXn.amount === 47_970_000 && dons.filter((d: { orderCode: string }) => d.orderCode === `BK-${stamp}`).length === 1, dons);
  check('xác nhận lần hai bị chặn', (await khac.call('POST', `/conversations/${cid}/close`, { dealId: donBot.id, dayCode: 'A06.FIT.TW.070227.A', guests: 1 })).status === 409);
  const sauXn = (await admin.call('GET', '/stats?period=all')).data;
  check('xác nhận rồi mới tính doanh thu', sauXn.totalRevenue === truoc.totalRevenue + 47_970_000, { truoc: truoc.totalRevenue, sau: sauXn.totalRevenue });

  // BE Mobile báo trạng thái booking
  const hoan = await bot.call('POST', '/ingest/booking-status', { orderCode: `BK-${stamp}`, status: 'REFUNDED' });
  check('booking hoàn tiền: đơn huỷ, hội thoại mở lại', hoan.data.status === 'CANCELLED' && (await khac.call('GET', `/conversations/${cid}`)).data.status === 'READ', hoan);
  const tra = await bot.call('POST', '/ingest/booking-status', { orderCode: `BK-${stamp}`, status: 'PAID' });
  check('booking thanh toán lại: đơn tính lại, hội thoại Đã chốt', tra.data.status === 'CONFIRMED' && (await khac.call('GET', `/conversations/${cid}`)).data.status === 'CLOSED', tra);
  check('booking không có trong hệ thống thì bỏ qua', (await bot.call('POST', '/ingest/booking-status', { orderCode: `KHONG-${stamp}`, status: 'PAID' })).data.matched === false);
  check('trạng thái booking lạ bị từ chối', (await bot.call('POST', '/ingest/booking-status', { orderCode: `BK-${stamp}`, status: 'DONE' })).status === 400);

  // Khách huỷ đơn chờ xác nhận
  await bot.call('POST', '/ingest/deal', { ...web, tourName: 'Phú Quốc 3N2Đ', guests: 1, amount: 5_000_000, orderCode: `BK2-${stamp}` });
  const don2 = (await khac.call('GET', `/customers/${customerId}/deals`)).data.find((d: { orderCode: string }) => d.orderCode === `BK2-${stamp}`);
  check('huỷ đơn chờ xác nhận', (await khac.call('POST', `/conversations/${cid}/deals/${don2.id}/cancel`, { reason: 'Khách đổi lịch' })).status === 200);
  check('đơn đã huỷ không huỷ lại được', (await khac.call('POST', `/conversations/${cid}/deals/${don2.id}/cancel`, {})).status === 409);

  // Chốt tour mới: ngày khởi hành phải có trên website (đợt đã qua thì bị chặn)
  check('ngày khởi hành không có trên website thì không chốt được', (await khac.call('POST', `/conversations/${cid}/close`, { dayCode: 'A06.FIT.92.220926.B', guests: 2 })).status === 400);
  await bot.call('POST', '/ingest/deal', { ...web, tourName: 'Du lịch Đà Lạt', guests: 2, amount: 7_580_000, orderCode: `DH-${stamp}`, tourCode: 'A06.FIT.92.220926.B' });
  const don3 = (await khac.call('GET', `/customers/${customerId}/deals`)).data.find((d: { orderCode: string }) => d.orderCode === `DH-${stamp}`);
  const tim3 = await khac.call('GET', `/conversations/${cid}/deals/by-order/dh-${stamp}`);
  check('tìm đơn theo mã đơn (không phân biệt hoa thường)', tim3.status === 200 && tim3.data.id === don3.id, tim3);
  const chot = await khac.call('POST', `/conversations/${cid}/close`, { dealId: don3.id, dayCode: 'A06.FIT.92.220926.B', guests: 2 });
  check('chốt theo mã đơn', chot.data.status === 'CLOSED', chot);
  check('voucher không tồn tại thì không chốt', (await khac.call('POST', '/tours/quote', { dayCode: 'A06.FIT.92.220926.B', guests: 2, dealId: don3.id, voucherCode: 'KHONG-CO' })).data.voucherError === 'Mã voucher không tồn tại');
  check('trùng mã đơn bị chặn', (await khac.call('POST', `/conversations/${cid}/close`, { dayCode: 'A06.FIT.92.220926.B', guests: 1, orderCode: `DH-${stamp}` })).status === 409);

  // Hẹn nhắc, nhãn, tìm trong tin
  const hen = await khac.call('PATCH', `/conversations/${cid}`, { followUpAt: new Date(Date.now() + 3600_000).toISOString(), followUpNote: 'Gọi lại báo giá đoàn' });
  check('đặt hẹn nhắc', hen.status === 200 && hen.data.followUp?.note === 'Gọi lại báo giá đoàn', hen);
  check('lọc hội thoại có hẹn', (await khac.call('GET', '/conversations?followUp=1')).data.items.some((c: { id: string }) => c.id === cid));
  check('bỏ hẹn', (await khac.call('PATCH', `/conversations/${cid}`, { followUpAt: null })).data.followUp === null);
  await khac.call('PATCH', `/conversations/${cid}`, { tags: ['VIP'] });
  const theoNhan = (await khac.call('GET', '/conversations?tag=VIP')).data.items;
  check('lọc theo nhãn', theoNhan.length >= 1 && theoNhan.every((c: { tags: string[] }) => c.tags.includes('VIP')), theoNhan);
  const timTin = await khac.call('GET', `/messages/search?q=${encodeURIComponent('da lat gia')}`);
  check('tìm trong nội dung tin, không dấu', timTin.status === 200 && timTin.data.some((m: { text: string }) => m.text === 'Tour Đà Lạt giá bao nhiêu?'), timTin);

  const stats = await admin.call('GET', '/stats?period=today');
  check(
    'thống kê có đủ khối, có thời gian phản hồi',
    stats.status === 200 && typeof stats.data.gemini.vnd === 'number' && Array.isArray(stats.data.tours) && stats.data.responseTime.count >= 3 && stats.data.responseTime.medianSeconds !== null,
    stats.data.responseTime,
  );

  check('sale không quản lý tài khoản', (await minh.call('PATCH', `/users/${uThao.data.id}/active`, { isActive: false })).status === 403);
  const adminMe = await admin.call('GET', '/auth/me');
  check('admin không tự khoá', (await admin.call('PATCH', `/users/${adminMe.data.id}/active`, { isActive: false })).status === 400);
  const webLock = { channel: 'WEB', externalUserId: `lock-${stamp}` };
  const lockCustomer = await bot.call('POST', '/ingest/identify', { ...webLock, name: 'Khách kiểm tra khoá', phone: `07${String(stamp).slice(-8)}` });
  check('tạo khách thử khoá', lockCustomer.status === 200, lockCustomer);
  await bot.call('POST', '/ingest/inbound', { ...webLock, text: 'Cho tôi gặp nhân viên', wantsHuman: true });
  const lockConversationId = lockCustomer.data.conversationId;
  check('sale nhận khách thử khoá', (await thao.call('POST', `/conversations/${lockConversationId}/messages`, { text: 'Em đang hỗ trợ ạ', confirm: true })).status === 201);
  const locked = await admin.call('PATCH', `/users/${uThao.data.id}/active`, { isActive: false });
  check('admin khoá sale', locked.status === 200 && locked.data.isActive === false && locked.data.onDuty === false, locked);
  const unassigned = await admin.call('GET', `/conversations/${lockConversationId}`);
  check('khách của sale bị khoá trở lại hàng chờ', unassigned.data.assignee === null, unassigned);
  await new Promise((resolve) => setTimeout(resolve, 35_000));
  const reassigned = await admin.call('GET', `/conversations/${lockConversationId}`);
  check('khách được chia lại cho sale đang trực', reassigned.data.assignee?.id === uMinh.data.id, reassigned);
  check('sale bị khoá mất quyền ngay', (await thao.call('GET', '/conversations')).status === 401);
  check('sale bị khoá không đăng nhập được', (await new Client().call('POST', '/auth/login', { email: dThao.email, password: dThao.password })).status === 401);
  const changed = await admin.call('POST', `/users/${uThao.data.id}/reset-password`, { password: 'matkhauMoi123' });
  check('admin đặt lại mật khẩu', changed.status === 201 && changed.data.ok === true, changed);
  check('admin mở khoá sale', (await admin.call('PATCH', `/users/${uThao.data.id}/active`, { isActive: true })).status === 200);
  await new Client().login(dThao.email, 'matkhauMoi123');
  check('mật khẩu mới đăng nhập được', true);

  check('đăng xuất', (await minh.call('POST', '/auth/logout')).status === 204);
  console.log(`\nĐạt ${ok} kiểm tra.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
