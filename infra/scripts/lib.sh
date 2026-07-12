#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_LIB_NAME="poker-infra"

log() {
  printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$SCRIPT_LIB_NAME" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_uint() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a non-negative integer, got: $value"
}

require_positive_uint() {
  local name="$1"
  local value="$2"

  require_uint "$name" "$value"
  ((value > 0)) || die "$name must be greater than zero"
}

require_absolute_path() {
  local name="$1"
  local value="$2"

  [[ "$value" == /* ]] || die "$name must be an absolute path: $value"
  [[ "$value" != "/" ]] || die "$name must not be the filesystem root"
  [[ "$value" != *$'\n'* ]] || die "$name must not contain newlines"
}

canonical_existing_dir() {
  local name="$1"
  local value="$2"
  local resolved

  require_absolute_path "$name" "$value"
  [[ -d "$value" ]] || die "$name is not an existing directory: $value"
  [[ ! -L "$value" ]] || die "$name must not be a symbolic link: $value"
  if ! resolved="$(cd -- "$value" 2>/dev/null && pwd -P)"; then
    die "unable to resolve $name: $value"
  fi
  [[ "$resolved" != "/" ]] || die "$name resolves to the filesystem root"
  printf '%s\n' "$resolved"
}

ensure_private_dir() {
  local path="$1"

  require_absolute_path "directory" "$path"
  if [[ -e "$path" && ! -d "$path" ]]; then
    die "path exists but is not a directory: $path"
  fi
  if [[ -L "$path" ]]; then
    die "refusing symbolic-link directory: $path"
  fi
  install -d -m 0700 -- "$path"
}

shell_quote_command() {
  local item
  for item in "$@"; do
    printf '%q ' "$item"
  done
  printf '\n'
}
