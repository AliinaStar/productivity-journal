#!/bin/sh
# Restore a dump, or verify that one is restorable.
#
#   # rehearsal: restores into a throwaway DB, counts rows, drops it
#   docker compose -f docker-compose.prod.yml run --rm backup \
#       /backup/restore.sh --verify latest
#
#   # the real thing: OVERWRITES the live database
#   docker compose -f docker-compose.prod.yml run --rm -e I_UNDERSTAND=yes \
#       backup /backup/restore.sh latest
#
# `latest` resolves to the newest file across every local retention set.
set -eu

if [ -f /backup/env.sh ]; then
    . /backup/env.sh
fi

DEST="/backups"

: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=reporting_system}"

log()  { echo "[restore] $(date -u +%FT%TZ) $*"; }
fail() { log "FAILED: $*"; exit 1; }

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
export PGPASSWORD="$POSTGRES_PASSWORD"

VERIFY=0
if [ "${1:-}" = "--verify" ]; then
    VERIFY=1
    shift
fi

SOURCE="${1:-latest}"

# --- Locate the archive ----------------------------------------------------
if [ "$SOURCE" = "latest" ]; then
    # Sort on the basename, not the full path: the timestamp is in the
    # filename, so sorting paths would order by directory first and pick
    # whatever sits in `weekly` over a newer dump in `daily`.
    SOURCE="$(find "$DEST/daily" "$DEST/weekly" "$DEST/monthly" "$DEST/adhoc" \
                   -maxdepth 1 -type f -name 'litopys-*' 2>/dev/null \
              | awk -F/ '{print $NF"\t"$0}' | sort | tail -n 1 | cut -f2-)"
    [ -n "$SOURCE" ] || fail "no backups found under $DEST"
elif [ ! -f "$SOURCE" ]; then
    # Allow a bare filename as well as a full path.
    found="$(find "$DEST" -maxdepth 2 -type f -name "$SOURCE" 2>/dev/null | head -n 1)"
    [ -n "$found" ] || fail "no such backup: $SOURCE"
    SOURCE="$found"
fi
log "source: $SOURCE"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- Decrypt if needed -----------------------------------------------------
case "$SOURCE" in
    *.gpg)
        [ -n "${BACKUP_GPG_PASSPHRASE:-}" ] \
            || fail "$SOURCE is encrypted but BACKUP_GPG_PASSPHRASE is unset"
        printf '%s' "$BACKUP_GPG_PASSPHRASE" > "$WORK/pass"
        gpg --batch --quiet --yes --decrypt \
            --passphrase-file "$WORK/pass" \
            --output "$WORK/restore.dump" "$SOURCE" \
            || fail "decryption failed — wrong passphrase?"
        rm -f "$WORK/pass"
        ARCHIVE="$WORK/restore.dump"
        ;;
    *)
        ARCHIVE="$SOURCE"
        ;;
esac

psql_target() {
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
         -d "$1" -v ON_ERROR_STOP=1 -tAq -c "$2"
}

# --- Rehearsal: restore into a scratch database and count rows -------------
if [ "$VERIFY" = "1" ]; then
    CHECK_DB="${POSTGRES_DB}_restore_check"
    log "restoring into scratch database $CHECK_DB"

    psql_target postgres "DROP DATABASE IF EXISTS \"$CHECK_DB\";"
    psql_target postgres "CREATE DATABASE \"$CHECK_DB\";"
    # The scratch DB is dropped whatever happens next, so a failed rehearsal
    # never leaves a stray database behind on the server.
    trap 'psql_target postgres "DROP DATABASE IF EXISTS \"$CHECK_DB\";" >/dev/null 2>&1; rm -rf "$WORK"' EXIT

    # --no-owner: the dump may reference roles that a fresh DB lacks; we are
    # testing that the *data* survives, not the grants.
    pg_restore -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
               -d "$CHECK_DB" --no-owner --no-privileges "$ARCHIVE" \
        || fail "pg_restore could not load the archive"

    log "row counts in the restored copy:"
    for tbl in "user" goal entry report; do
        n="$(psql_target "$CHECK_DB" "SELECT count(*) FROM \"$tbl\";")" \
            || fail "table '$tbl' is missing from the restored database"
        log "  $tbl: $n"
    done

    # The embeddings are the expensive part to regenerate — confirm they
    # survived the round trip rather than restoring as NULL.
    embedded="$(psql_target "$CHECK_DB" \
        "SELECT count(*) FROM entry WHERE embedding IS NOT NULL;")"
    log "  entries with embeddings: $embedded"

    log "VERIFIED: $SOURCE is restorable"
    exit 0
fi

# --- Real restore: destructive --------------------------------------------
[ "${I_UNDERSTAND:-}" = "yes" ] || fail \
    "this OVERWRITES $POSTGRES_DB. Re-run with -e I_UNDERSTAND=yes if that is what you want."

log "restoring into LIVE database $POSTGRES_DB"
# --clean --if-exists drops existing objects first, so the result matches the
# dump exactly instead of merging into whatever is currently there.
pg_restore -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
           -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges \
           "$ARCHIVE" \
    || fail "pg_restore reported errors — inspect the database before using it"

log "restored. Restart the API so it reconnects: docker restart litopys_api"
