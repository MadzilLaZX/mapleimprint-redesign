#!/usr/bin/env bash
# Auto-restarting wrapper for import-ss-catalogue.mjs. The import is idempotent (upserts by
# supplierProductId), so killing and restarting mid-category just resumes — no data loss.
# Restarts whenever the DB stops gaining new supplierProduct rows for STALL_SECONDS (covers the
# recurring silent-hang bug: process alive, DB writes stop, no error ever printed). Watches the
# DB rather than log mtime because log lines only print on category boundaries/promotions, not
# per raw-sync row, so log silence during a legitimately busy stretch would false-positive.
set -u
cd "$(dirname "$0")/.."

LOG="${1:?usage: watchdog-import.sh <logfile> <STALL_SECONDS> <PRODUCT_TYPES>}"
STALL_SECONDS="${2:-240}"
export PRODUCT_TYPES="${3:?PRODUCT_TYPES required}"
export PER_CATEGORY_LIMIT="${PER_CATEGORY_LIMIT:-9999}"

: > "$LOG"

db_progress() {
  # supplierProduct.lastSyncedAt only updates once per PRODUCT, but a single large-variant
  # product (e.g. a core tee with 150-200+ colour/size combos) can spend many minutes doing
  # one sequential DB round-trip per variant + per warehouse row before that timestamp moves
  # again — that legitimately-busy stretch looked identical to a hang. supplierVariantOffer
  # rows update continuously during that same work, so watch those instead.
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
      const r = await prisma.supplierVariantOffer.findFirst({ orderBy: { lastPriceSyncAt: 'desc' }, select: { lastPriceSyncAt: true } });
      console.log(r ? r.lastPriceSyncAt.toISOString() : '');
      await prisma.\$disconnect();
    })();
  " 2>/dev/null
}

reset_lock() {
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    (async () => {
      const running = await prisma.supplierSyncJob.findMany({ where: { status: 'running' } });
      for (const j of running) {
        await prisma.supplierSyncJob.update({ where: { id: j.id }, data: { status: 'failed', finishedAt: new Date() } });
      }
      await prisma.\$disconnect();
    })();
  " >> "$LOG" 2>&1
}

attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "[watchdog] attempt $attempt: launching import ($(date -u +%H:%M:%S))" >> "$LOG"
  node scripts/import-ss-catalogue.mjs >> "$LOG" 2>&1 &
  pid=$!

  last_ts=$(db_progress)
  last_progress=$(date +%s)

  while kill -0 "$pid" 2>/dev/null; do
    sleep 15
    cur_ts=$(db_progress)
    now=$(date +%s)
    if [ -n "$cur_ts" ] && [ "$cur_ts" != "$last_ts" ]; then
      last_ts="$cur_ts"
      last_progress="$now"
    fi
    if [ $((now - last_progress)) -gt "$STALL_SECONDS" ]; then
      echo "[watchdog] no DB activity for >${STALL_SECONDS}s (stuck at $cur_ts), killing pid $pid ($(date -u +%H:%M:%S))" >> "$LOG"
      kill -9 "$pid" 2>/dev/null
      break
    fi
    if grep -q "^Done\.\$" "$LOG" 2>/dev/null; then
      echo "[watchdog] import reported Done." >> "$LOG"
      exit 0
    fi
  done

  wait "$pid" 2>/dev/null

  if grep -q "^Done\.\$" "$LOG" 2>/dev/null; then
    echo "[watchdog] import completed successfully" >> "$LOG"
    exit 0
  fi

  echo "[watchdog] restarting after stall/exit" >> "$LOG"
  reset_lock
  sleep 3
done
