// Tạo các mẫu trả lời nhanh và quy tắc tự động mặc định. Chạy lại an toàn: không ghi đè dữ liệu đã có.
// Tài khoản admin tạo riêng bằng: pnpm create-admin <email> <mật khẩu>
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { layCauHinhKetNoi } from '../src/prisma/connection';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg(layCauHinhKetNoi(process.env.DATABASE_URL)) });

async function main() {
  if ((await prisma.quickTemplate.count()) === 0) {
    await prisma.quickTemplate.createMany({
      data: [
        { title: 'Chào khách', body: 'Dạ em là nhân viên BenThanh Tourist, em hỗ trợ mình ngay ạ.' },
        { title: 'Xin thông tin đoàn', body: 'Dạ mình cho em xin số lượng khách và ngày dự kiến đi để em báo giá nhé.' },
        { title: 'Hẹn gọi lại', body: 'Dạ em sẽ gọi lại cho mình trong ít phút nữa, mình để ý điện thoại giúp em ạ.' },
      ],
    });
  }

  if ((await prisma.autoReplyRule.count()) === 0) {
    await prisma.autoReplyRule.createMany({
      data: [
        { name: 'Hỏi giá đoàn', type: 'KEYWORD', keywords: ['giá đoàn', 'báo giá đoàn', 'đi đoàn'], body: 'Dạ mình cho em xin số lượng khách và ngày dự kiến đi để em báo giá nhé.', enabled: true },
        { name: 'Ngoài giờ', type: 'OFF_HOURS', body: 'Dạ hiện đã ngoài giờ làm việc, nhân viên sẽ phản hồi mình vào đầu giờ làm việc tiếp theo ạ.', enabled: false },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
