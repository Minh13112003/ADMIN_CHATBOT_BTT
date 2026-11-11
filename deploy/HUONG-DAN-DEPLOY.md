# Deploy btt-chat-admin cạnh VinhSang

Mọi lệnh chạy trên server. Thay `chatadmin.benthanhtourist.com` bằng tên miền thật. Tên miền (bản ghi A) phải trỏ về IP server trước bước 3.

## 1. Đưa mã nguồn và điền cấu hình

```bash
cd /opt && git clone <địa chỉ repo> btt-chat-admin && cd btt-chat-admin/deploy
cp .env.example .env
nano .env        # điền DB_PASSWORD, JWT_SECRET, INGEST_API_KEY... (lệnh tạo chuỗi ngẫu nhiên có ghi chú trong file)
chmod 600 .env
```

## 2. Chạy các container (chưa có HTTPS)

```bash
docker compose up -d --build
docker compose ps          # postgres, backend, web đều phải "Up"
```

Lần build đầu mất vài phút và làm server chậm một lúc, nên chạy lúc ít người dùng VinhSang.

## 2b. Thử khi chưa có tên miền (bỏ qua nếu đã có)

Đặt `FRONTEND_URL=http://localhost:8081` trong `deploy/.env`, rồi thay bước 2 bằng:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build
```

Trên **máy của bạn** mở đường hầm (để cửa sổ này mở khi dùng) rồi vào http://localhost:8081:

```
ssh -L 8081:127.0.0.1:8081 <user>@<IP server>
```

Cổng 8081 chỉ mở trong server, không lộ ra internet. Khi có tên miền thì làm tiếp bước 3, đổi `FRONTEND_URL` về `https://chatadmin.benthanhtourist.com` và chạy lại bước 2 (không có file test).

## 3. Nginx giai đoạn 1 và cấp chứng chỉ

1. Mở `docker/nginx/vinhsang.conf` của VinhSang, dán vào cuối phần **map** và **KHỐI A** từ `nginx-vinhsang-chat.conf`.
2. Kiểm tra và nạp lại (từ thư mục của VinhSang):
   ```bash
   docker compose -f docker-compose.prod.yml exec nginx nginx -t
   docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```
3. Cấp chứng chỉ (từ thư mục của VinhSang). Chứng chỉ ghi vào `docker/nginx/ssl`, thư mục nginx của VinhSang đã đọc:
   ```bash
   docker run --rm \
     -v "$PWD/docker/nginx/ssl:/etc/letsencrypt" \
     -v vinhsang_certbot-webroot:/var/www/certbot \
     certbot/certbot certonly --webroot -w /var/www/certbot \
     -d chatadmin.benthanhtourist.com --email <email của bạn> --agree-tos --no-eff-email
   ```

## 4. Nginx giai đoạn 2

Dán **KHỐI B** vào cuối `vinhsang.conf`, rồi `nginx -t` và `nginx -s reload` như trên. Mở `https://chatadmin.benthanhtourist.com`.

## 5. Gia hạn chứng chỉ (90 ngày một lần)

Thêm vào `crontab -e`, chạy mỗi tuần:

```
0 4 * * 1 cd /đường/dẫn/VinhSang && docker run --rm -v "$PWD/docker/nginx/ssl:/etc/letsencrypt" -v vinhsang_certbot-webroot:/var/www/certbot certbot/certbot renew --quiet && docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

## 6. Dữ liệu và tài khoản admin (làm sau khi có file `.sql`)

Mình sẽ đưa lệnh cụ thể. File `.sql` chứa tên và số điện thoại khách: chỉ copy bằng `scp`, không gửi qua chat hay email.

## 7. Sao lưu hằng đêm

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
```
