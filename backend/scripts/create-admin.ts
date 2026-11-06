// Tạo (hoặc đặt lại mật khẩu) tài khoản admin.
// Chạy: pnpm create-admin <email> <mật khẩu> ["Tên hiển thị"]
// Mật khẩu chỉ đi qua dòng lệnh, không lưu vào file nào. Mật khẩu có ký tự đặc biệt như # thì đặt trong dấu nháy.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { layCauHinhKetNoi } from '../src/prisma/connection';

async function main() {
  const [emailRaw, password, ten] = process.argv.slice(2);
  const email = emailRaw?.trim().toLowerCase();
  if (!email || !password) throw new Error('Cách dùng: pnpm create-admin <email> <mật khẩu> ["Tên hiển thị"]');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email không hợp lệ');
  if (password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự');

  const prisma = new PrismaClient({ adapter: new PrismaPg(layCauHinhKetNoi(process.env.DATABASE_URL)) });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const co = await prisma.user.findUnique({ where: { email } });
    if (co && co.role !== Role.ADMIN) throw new Error(`${email} đang là tài khoản sale, không đổi thành admin`);
    if (co) {
      await prisma.user.update({ where: { email }, data: { passwordHash } });
      console.log(`Admin ${email} đã có, đã đặt lại mật khẩu`);
    } else {
      await prisma.user.create({ data: { email, fullName: ten ?? 'Quản trị viên', role: Role.ADMIN, onDuty: false, passwordHash } });
      console.log(`Đã tạo admin ${email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
