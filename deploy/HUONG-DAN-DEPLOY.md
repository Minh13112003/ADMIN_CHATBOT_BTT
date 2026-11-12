# Deploy btt-chat-admin cạnh VinhSang (dùng thẳng tên miền)

Mọi lệnh chạy trên server (SSH vào). Địa chỉ dùng: **https://chatadmin.benthanhtourist.com**, đi qua proxy Cloudflare (đám mây cam), bản ghi A trỏ về IP server, chế độ SSL/TLS của Cloudflare là **Full**.

## 1. Tải mã và điền cấu hình

```bash
cd /opt && sudo git clone https://github.com/Minh13112003/ADMIN_CHATBOT_BTT.git btt-chat-admin
sudo chown -R $USER btt-chat-admin && cd btt-chat-admin && git checkout giao-dien-moi
cd deploy
cp .env.example .env
nano .env
chmod 600 .env
```

Trong `.env` điền:
- `DB_PASSWORD`: `openssl rand -hex 24`
- `JWT_SECRET`: `openssl rand -hex 48`
- `INGEST_API_KEY`: `openssl rand -hex 32`
- `FRONTEND_URL=https://chatadmin.benthanhtourist.com` (đã có sẵn trong file mẫu)

## 2. Chạy các container

```bash
docker compose up -d --build
docker compose ps          # postgres, backend, web đều phải "Up"
```

Lần build đầu mất vài phút và làm server chậm một lúc, nên chạy lúc ít người dùng VinhSang.

## 3. Cho nginx của VinhSang chuyển tên miền về dự án

1. Mở `docker/nginx/vinhsang.conf` của VinhSang, dán vào **cuối file** toàn bộ nội dung `deploy/nginx-vinhsang-chat.conf`.
2. Kiểm tra cú pháp trước, đúng mới nạp lại (từ thư mục của VinhSang):
   ```bash
   docker compose -f docker-compose.prod.yml exec nginx nginx -t
   docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```
   Nếu `nginx -t` báo lỗi thì **không** nạp lại, báo mình dòng lỗi. VinhSang vẫn chạy bình thường.
3. Kiểm tra: mở https://chatadmin.benthanhtourist.com/api/v1/health phải thấy `{"ok":true}`, và https://chatadmin.benthanhtourist.com thấy trang đăng nhập.

## 4. Nạp dữ liệu từ Supabase

Làm theo các bước nạp dữ liệu (`scp` file `.sql` lên server, nạp vào Postgres, `prisma migrate deploy`, khởi động lại backend). Sau đó đăng nhập bằng tài khoản cũ.

## 5. Sao lưu hằng đêm

```bash
chmod +x /opt/btt-chat-admin/deploy/backup.sh
crontab -e   # thêm:  30 2 * * * /opt/btt-chat-admin/deploy/backup.sh >> /var/log/btt-backup.log 2>&1
```

Đồng bộ thư mục `/var/backups/btt` ra nơi khác ngoài server (Google Drive, S3...). Backup cùng ổ với database thì ổ hỏng là mất cả hai.

## Cập nhật bản mới sau này

```bash
cd /opt/btt-chat-admin && git pull && cd deploy
docker compose up -d --build
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy   # khi có migration mới
docker compose restart backend
```

Bản 2026-11-12 có migration mới `channel_secrets` và cần biến `ENCRYPTION_KEY` trong `deploy/.env`:
```bash
grep -q '^ENCRYPTION_KEY=.' .env || echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```
Khoá này giữ nguyên về sau (đổi khoá thì phải nhập lại thông tin Zalo/Facebook) và nên sao lưu cùng file `.env`.

## Phương án dự phòng khi tên miền chưa chạy được

Dùng `docker-compose.test.yml` (cổng 8081 chỉ mở trong server) và đường hầm SSH từ máy bạn:
`docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build`, `ssh -L 8081:127.0.0.1:8081 <user>@<IP>`, rồi mở http://localhost:8081 (đặt tạm `FRONTEND_URL=http://localhost:8081`).
