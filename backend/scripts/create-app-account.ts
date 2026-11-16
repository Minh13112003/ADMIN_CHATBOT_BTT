// Tạo (hoặc đặt lại mật khẩu) tài khoản app Mobile cho khách, không cần qua hộp thư.
// Chạy: pnpm --filter backend create-app-account <số điện thoại> '<mật khẩu>' ["Họ tên"]
// Trên VPS: docker compose run --rm backend ./node_modules/.bin/tsx scripts/create-app-account.ts 0914438603 '<mật khẩu>'
// Mật khẩu chỉ đi qua dòng lệnh, không lưu vào file nào. Có ký tự đặc biệt như # thì đặt trong dấu nháy đơn.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { chuanHoaSoDienThoai } from '../src/common/text';
import { PrismaClient } from '../src/generated/prisma/client';
import { layCauHinhKetNoi } from '../src/prisma/connection';

async function main() {
  const [phoneRaw, password, ten] = process.argv.slice(2);
  if (!phoneRaw || !password) throw new Error("Cách dùng: create-app-account <số điện thoại> '<mật khẩu>' [\"Họ tên\"]");
  const phone = chuanHoaSoDienThoai(phoneRaw);
  if (!phone) throw new Error('Số điện thoại không hợp lệ (cần dạng 0xxxxxxxxx)');
  if (password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự');

  const prisma = new PrismaClient({ adapter: new PrismaPg(layCauHinhKetNoi(process.env.DATABASE_URL)) });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const kh = (await prisma.customer.findUnique({ where: { phone }, select: { id: true, name: true } })) ?? (await prisma.customer.create({ data: { name: ten?.trim() || `Khách ${phone}`, phone }, select: { id: true, name: true } }));
    const daCo = await prisma.appAccount.findUnique({ where: { customerId: kh.id }, select: { id: true } });
    const tk = await prisma.appAccount.upsert({
      where: { customerId: kh.id },
      create: { customerId: kh.id, phone, passwordHash },
      update: { passwordHash, phone, isActive: true, refreshTokenHash: null },
    });
    // Danh tính kênh APP = id tài khoản, để chatbot trong app và đơn đặt tour vào cùng một khách.
    await prisma.customerIdentity.upsert({ where: { channel_externalId: { channel: 'APP', externalId: tk.id } }, create: { channel: 'APP', externalId: tk.id, customerId: kh.id }, update: {} });
    console.log(daCo ? `Tài khoản app ${phone} (${kh.name}) đã có, đã đặt lại mật khẩu` : `Đã tạo tài khoản app ${phone} cho khách ${kh.name}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
