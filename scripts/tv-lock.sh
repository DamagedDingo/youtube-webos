#!/usr/bin/env bash
# Serialise TV access between agents working on one machine.
#
#   scripts/tv-lock.sh '<remote command>'
#   scripts/tv-lock.sh            # interactive root shell, under the lock
#
# Takes an exclusive flock on $TV_LOCK (default /tmp/lgwebostv.lock, i.e. per
# machine, shared by every clone), then runs the command over SSH as root. A
# second agent waits for the lock instead of installing over the first one.
#
#   TV_LOCK_WAIT=30 scripts/tv-lock.sh '...'   # give up after 30 s (default 600)
#   TV_LOCK=/tmp/other.lock ...                # a second TV would use its own lock
set -euo pipefail

TV_HOST="${TV_HOST:-100.80.141.50}"
TV_KEY="${TV_KEY:-$HOME/.ssh/id_ed25519}"
TV_LOCK="${TV_LOCK:-/tmp/lgwebostv.lock}"
TV_LOCK_WAIT="${TV_LOCK_WAIT:-600}"

exec 9>"$TV_LOCK"
if ! flock -n 9; then
  holder="another process"
  if [ -r "${TV_LOCK}.who" ]; then
    read -r when who <"${TV_LOCK}.who" 2>/dev/null || true
    if [ -n "${who:-}" ] && kill -0 "${who#pid=}" 2>/dev/null; then
      holder="pid ${who#pid=} since ${when}"
    fi
  fi
  printf 'tv-lock: held by %s, waiting up to %ss\n' "$holder" "$TV_LOCK_WAIT" >&2
  if ! flock -w "$TV_LOCK_WAIT" 9; then
    printf 'tv-lock: still held after %ss, giving up\n' "$TV_LOCK_WAIT" >&2
    exit 75
  fi
fi

printf '%s pid=%s\n' "$(date -Is)" "$$" >"${TV_LOCK}.who"
trap 'rm -f -- "${TV_LOCK}.who"' EXIT

if [ "$#" -eq 0 ]; then
  exec ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$TV_KEY" "root@$TV_HOST"
fi
exec ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$TV_KEY" "root@$TV_HOST" "$*"
