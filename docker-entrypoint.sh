#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/backend/data}"

mkdir -p "$DATA_DIR/uploads"

# Named volumes are often root-owned; the app runs as the non-root "app" user.
if [ "$(id -u)" = "0" ]; then
  chown -R app:app "$DATA_DIR"
  exec su-exec app "$@"
fi

exec "$@"
