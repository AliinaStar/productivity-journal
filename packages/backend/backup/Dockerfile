# pg_dump must be at least the server's version, and the prod DB runs
# pgvector/pgvector:pg17 — so pin Postgres 17 client tools here too.
FROM postgres:17-alpine

# gnupg — symmetric (passphrase) encryption of the dumps
# rclone — off-site copy to B2 / S3 / any rclone remote
# curl   — optional dead-man's-switch ping after a clean run
RUN apk add --no-cache gnupg rclone curl tzdata

COPY backup.sh restore.sh entrypoint.sh /backup/
RUN chmod +x /backup/backup.sh /backup/restore.sh /backup/entrypoint.sh

# Overrides the postgres image's own entrypoint: this container never runs a
# server, it only ever talks to the `db` service over the Docker network.
ENTRYPOINT ["/backup/entrypoint.sh"]
