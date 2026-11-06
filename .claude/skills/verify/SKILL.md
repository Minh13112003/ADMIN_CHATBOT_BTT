---
name: verify
description: Kiểm tra dự án trước khi báo xong việc. Dùng sau khi sửa code backend hoặc frontend, hoặc khi người dùng yêu cầu kiểm thử.
---

# Kiểm tra trước khi báo xong

Chạy từ thư mục gốc, sửa hết lỗi trước khi sang bước sau:

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm build`

Nếu đổi luồng API, chạy thêm kiểm thử toàn luồng trên **database thử, tuyệt đối không phải Supabase thật**:

```powershell
$env:DATABASE_URL = '<postgres thử, cổng 5432>'
pnpm --filter backend db:deploy
pnpm --filter backend db:seed
pnpm --filter backend create-admin admin@thu.test 'MatKhauThu123'
$env:SMOKE_ADMIN_EMAIL = 'admin@thu.test'; $env:SMOKE_ADMIN_PASSWORD = 'MatKhauThu123'
pnpm --filter backend build
node backend/dist/main.js        # chạy nền
$env:SMOKE_CONFIRM = '1'; pnpm smoke
```

Script cần database gần như trống vì giả định chỉ có 2 sale do nó tạo. Database thử phải là UTF-8: `CREATE DATABASE x ENCODING 'UTF8' LOCALE 'C' TEMPLATE template0`.

Nếu đổi giao diện, mở trang thật bằng trình duyệt và xem ở cả 1440px và 390px: chạy `pnpm simulate` để có dữ liệu giả trên database thử, kiểm tra đang tải, rỗng, lỗi, tràn ngang, lỗi console.

Báo cáo thật: bước nào đã chạy, kết quả ra sao, bước nào chưa làm được.
