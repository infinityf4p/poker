#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'EOF'
Delete only old, verified-name PostgreSQL backup files from a marked directory.

Usage:
  pg-backup-retention.sh [options]

Options:
  --backup-dir PATH       Marked backup directory.
  --keep-daily COUNT      Retain newest daily dumps (default: 7).
  --keep-weekly COUNT     Retain newest weekly dumps (default: 4).
  --dry-run               Print deletions without changing files.
  -h, --help              Show this help.

Only direct child regular files named poker-*.dump and their matching .sha256
sidecars can be removed. Directories and symbolic links are never removed.
EOF
}

backup_dir="${PG_BACKUP_DIR:-/var/backups/poker/postgres}"
keep_daily="${PG_BACKUP_KEEP_DAILY:-7}"
keep_weekly="${PG_BACKUP_KEEP_WEEKLY:-4}"
dry_run=false

while (($# > 0)); do
  case "$1" in
    --backup-dir)
      (($# >= 2)) || die "--backup-dir requires a value"
      backup_dir="$2"
      shift 2
      ;;
    --keep-daily)
      (($# >= 2)) || die "--keep-daily requires a value"
      keep_daily="$2"
      shift 2
      ;;
    --keep-weekly)
      (($# >= 2)) || die "--keep-weekly requires a value"
      keep_weekly="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "unknown argument: $1" ;;
  esac
done

require_positive_uint "daily retention count" "$keep_daily"
require_positive_uint "weekly retention count" "$keep_weekly"
backup_dir="$(canonical_existing_dir "backup directory" "$backup_dir")"

marker="$backup_dir/.poker-pg-backup-root"
[[ -f "$marker" && ! -L "$marker" ]] || die "refusing unmarked backup directory: $backup_dir"
[[ "$(<"$marker")" == "poker-postgresql-backups-v1" ]] || die "invalid backup directory marker: $marker"

require_command flock
require_command find
require_command sort
exec 9>"$backup_dir/.pg-backup.lock"
flock -n 9 || die "backup or retention process is already running"

deleted=0

prune_generation() {
  local pattern="$1"
  local retain="$2"
  local index=0
  local record file checksum
  while IFS= read -r -d '' record; do
    file="${record#* }"
    ((index += 1))
    [[ -f "$file" && ! -L "$file" ]] || continue
    ((index > retain)) || continue
    checksum="$file.sha256"
    if $dry_run; then
      printf 'DRY-RUN delete %q\n' "$file"
      [[ -f "$checksum" && ! -L "$checksum" ]] && printf 'DRY-RUN delete %q\n' "$checksum"
    else
      rm -f -- "$file"
      [[ -f "$checksum" && ! -L "$checksum" ]] && rm -f -- "$checksum"
    fi
    ((deleted += 1))
  done < <(
    find "$backup_dir" -xdev -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\0' | sort -z -rn
  )
}

prune_generation 'poker-daily-*.dump' "$keep_daily"
prune_generation 'poker-weekly-*.dump' "$keep_weekly"

if $dry_run; then
  log "DRY-RUN: $deleted PostgreSQL dump(s) eligible for deletion"
else
  log "retention completed: deleted $deleted PostgreSQL dump(s)"
fi
