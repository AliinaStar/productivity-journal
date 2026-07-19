#!/bin/sh
# Container entrypoint: install the cron schedule, then hand over to crond.
set -eu

# Any explicit command wins, so one-off runs work against the same image:
#   docker compose run --rm backup /backup/restore.sh --verify latest
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

: "${BACKUP_CRON:=17 3 * * *}"
: "${BACKUP_VERIFY_CRON:=41 4 * * 1}"

# crond gives jobs a bare environment — no POSTGRES_PASSWORD, no rclone
# credentials — so persist what the scripts need. `export -p` quotes values
# correctly; `env` would mangle any passphrase containing spaces or quotes.
# Filtered to our own prefixes to avoid re-exporting read-only shell vars.
export -p | grep -E "^export (POSTGRES_|PGPASSWORD|BACKUP_|RCLONE_|TZ)" \
    > /backup/env.sh || true
chmod 600 /backup/env.sh

# >> /proc/1/fd/1 sends job output to PID 1's stdout, so every run shows up
# in `docker logs litopys_backup` instead of vanishing into cron's mailer.
{
    echo "$BACKUP_CRON /backup/backup.sh daily >> /proc/1/fd/1 2>&1"
    echo "$BACKUP_VERIFY_CRON /backup/restore.sh --verify latest >> /proc/1/fd/1 2>&1"
} > /etc/crontabs/root

echo "[backup] backup schedule: $BACKUP_CRON"
echo "[backup] verify schedule: $BACKUP_VERIFY_CRON"

exec crond -f -l 8
