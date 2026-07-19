#!/bin/sh
# One backup run: dump -> verify -> encrypt -> rotate -> copy off-site.
#
# Runs on a schedule from crond inside the backup container, and by hand:
#   docker compose -f docker-compose.prod.yml run --rm backup /backup/backup.sh pre-deploy
#
# The optional tag (arg 1) selects the retention set and is embedded in the
# filename, so an ad-hoc dump is never pruned by the daily rotation and is
# obvious when you list the directory a month later.
set -eu

# crond hands jobs a bare environment; entrypoint.sh persisted ours here.
if [ -f /backup/env.sh ]; then
    . /backup/env.sh
fi

TAG="${1:-daily}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="litopys-${STAMP}-${TAG}"

DEST="/backups"

: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=reporting_system}"
: "${BACKUP_KEEP_DAILY:=7}"
: "${BACKUP_KEEP_WEEKLY:=4}"
: "${BACKUP_KEEP_MONTHLY:=6}"
: "${BACKUP_KEEP_ADHOC:=10}"
: "${BACKUP_OFFSITE_REMOTE:=}"
: "${BACKUP_OFFSITE_KEEP_DAYS:=90}"
: "${BACKUP_HEALTHCHECK_URL:=}"

log()  { echo "[backup] $(date -u +%FT%TZ) $*"; }
fail() { log "FAILED: $*"; exit 1; }

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
export PGPASSWORD="$POSTGRES_PASSWORD"

# Work inside the destination mount so the final `mv` is a same-filesystem
# rename — an interrupted run can then never leave a half-written file
# sitting in the backup set looking like a good dump.
WORK="$DEST/.work.$$"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

# --- 1. Dump ---------------------------------------------------------------
# -Fc (custom format) is compressed and lets pg_restore pull out individual
# tables, which a plain SQL dump cannot do.
log "dumping ${POSTGRES_DB} from ${POSTGRES_HOST}:${POSTGRES_PORT}"
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" -Fc -f "$WORK/$BASE.dump" \
    || fail "pg_dump errored"

[ -s "$WORK/$BASE.dump" ] || fail "pg_dump produced an empty file"

# --- 2. Verify before trusting it ------------------------------------------
# pg_restore --list parses the whole archive, so a truncated or corrupt dump
# is caught now rather than on the night we actually need to restore.
pg_restore --list "$WORK/$BASE.dump" > "$WORK/toc.txt" 2>/dev/null \
    || fail "dump is unreadable by pg_restore"

# A dump that parses but contains no journal data means we pointed at the
# wrong database. Keeping it would silently rotate out the good backups.
grep -q "TABLE DATA public entry " "$WORK/toc.txt" \
    || fail "dump contains no data section for 'entry' — wrong database?"

log "dump verified ($(wc -c < "$WORK/$BASE.dump") bytes)"

# --- 3. Encrypt ------------------------------------------------------------
if [ -n "${BACKUP_GPG_PASSPHRASE:-}" ]; then
    # Passphrase goes through a file, never argv — process listings are
    # readable by every user on the host.
    printf '%s' "$BACKUP_GPG_PASSPHRASE" > "$WORK/pass"
    gpg --batch --quiet --yes --symmetric --cipher-algo AES256 \
        --passphrase-file "$WORK/pass" \
        --output "$WORK/$BASE.dump.gpg" "$WORK/$BASE.dump" \
        || fail "gpg encryption failed"
    rm -f "$WORK/$BASE.dump" "$WORK/pass"
    ARTIFACT="$BASE.dump.gpg"
else
    log "WARNING: BACKUP_GPG_PASSPHRASE is unset — storing an UNENCRYPTED dump"
    ARTIFACT="$BASE.dump"
fi

# --- 4. Publish into the retention set -------------------------------------
if [ "$TAG" = "daily" ]; then
    SET_DIR="$DEST/daily"
else
    SET_DIR="$DEST/adhoc"
fi
mkdir -p "$SET_DIR"
mv "$WORK/$ARTIFACT" "$SET_DIR/$ARTIFACT"
log "stored $SET_DIR/$ARTIFACT"

# Weekly and monthly copies are hard links, so a dump kept by three tiers
# still occupies the disk once. Removing it from `daily` leaves the other
# links (and their data) intact.
if [ "$TAG" = "daily" ]; then
    if [ "$(date -u +%u)" = "7" ]; then
        mkdir -p "$DEST/weekly"
        ln -f "$SET_DIR/$ARTIFACT" "$DEST/weekly/$ARTIFACT"
        log "promoted to weekly"
    fi
    if [ "$(date -u +%d)" = "01" ]; then
        mkdir -p "$DEST/monthly"
        ln -f "$SET_DIR/$ARTIFACT" "$DEST/monthly/$ARTIFACT"
        log "promoted to monthly"
    fi
fi

# --- 5. Rotate -------------------------------------------------------------
prune() {
    dir="$1"; keep="$2"
    [ -d "$dir" ] || return 0
    # -t sorts newest first, so everything past `keep` is the old tail.
    ls -1t "$dir" 2>/dev/null | tail -n "+$((keep + 1))" | while read -r old; do
        log "pruning $dir/$old"
        rm -f "$dir/$old"
    done
}

prune "$DEST/daily"   "$BACKUP_KEEP_DAILY"
prune "$DEST/weekly"  "$BACKUP_KEEP_WEEKLY"
prune "$DEST/monthly" "$BACKUP_KEEP_MONTHLY"
prune "$DEST/adhoc"   "$BACKUP_KEEP_ADHOC"

# --- 6. Off-site copy ------------------------------------------------------
# Deliberately last: the local copy is already safe on disk, so a network
# failure here costs us the second copy, not the backup itself.
offsite_failed=0
if [ -n "$BACKUP_OFFSITE_REMOTE" ]; then
    log "uploading to $BACKUP_OFFSITE_REMOTE"
    if rclone copyto "$SET_DIR/$ARTIFACT" \
             "$BACKUP_OFFSITE_REMOTE/$TAG/$ARTIFACT" --retries 3; then
        log "uploaded"
        # Retention on the remote side is by age: unlike the local sets we
        # cannot cheaply count objects, and B2 charges for what we keep.
        rclone delete --min-age "${BACKUP_OFFSITE_KEEP_DAYS}d" \
               "$BACKUP_OFFSITE_REMOTE/$TAG" \
            || log "WARNING: remote prune failed (upload was fine)"
    else
        log "ERROR: off-site upload failed — local copy is intact"
        offsite_failed=1
    fi
else
    log "no BACKUP_OFFSITE_REMOTE configured — local copy only"
fi

# --- 7. Heartbeat ----------------------------------------------------------
# A backup that quietly stopped running is the classic way to discover you
# have no backups. Record the last success, and ping the dead-man's-switch
# only when the run was fully clean.
if [ "$offsite_failed" = "0" ]; then
    date -u +%FT%TZ > "$DEST/LAST_SUCCESS"
    if [ -n "$BACKUP_HEALTHCHECK_URL" ]; then
        curl -fsS -m 10 "$BACKUP_HEALTHCHECK_URL" > /dev/null \
            || log "WARNING: healthcheck ping failed"
    fi
    log "done"
else
    exit 1
fi
