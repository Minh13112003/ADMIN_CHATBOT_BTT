#!/usr/bin/env bash
# Sao lưu Postgres mỗi đêm. Chạy từ cron trên server, ví dụ:
#   30 2 * * * /opt/btt-chat-admin/deploy/backup.sh >> /var/log/btt-backup.log 2>&1
# Thư mục sao lưu nên là ổ khác hoặc được đồng bộ ra ngoài server (Google Drive, S3...).
# Nằm cùng ổ với database thì ổ hỏng là mất cả hai.
set -euo pipefail
DEST="${BACKUP_DIR:-/var/backups/btt}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$DEST"
FILE="$DEST/btt-$(date +%Y%m%d-%H%M).sql.gz"
docker exec btt-postgres-1 pg_dump -U btt -d btt --no-owner | gzip > "$FILE"
chmod 600 "$FILE"   # bản sao lưu chứa tên, số điện thoại của khách
# File ảnh/PDF của khách (volume files-data). Không có file nào thì tệp vẫn tạo ra, rỗng.
FILES="$DEST/files-$(date +%Y%m%d-%H%M).tar.gz"
docker run --rm -v btt_files-data:/data:ro alpine tar czf - -C /data . > "$FILES"
chmod 600 "$FILES"
find "$DEST" -name 'files-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'btt-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) đã lưu $FILE ($(du -h "$FILE" | cut -f1))"
