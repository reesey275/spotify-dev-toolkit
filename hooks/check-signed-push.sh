#!/usr/bin/env bash
set -euo pipefail

# Pre-push script run by pre-commit to reject unsigned commits being pushed.
# It reads lines from stdin in the format: <local_ref> <local_sha> <remote_ref> <remote_sha>

while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    range="$local_sha"
  else
    range="$remote_sha..$local_sha"
  fi

  # Expand commits in the range
  commits=$(git rev-list "$range" || true)
  if [ -z "$commits" ]; then
    continue
  fi

  for c in $commits; do
    status=$(git log -1 --pretty=%G? "$c" 2>/dev/null || true)
    if [ -z "$status" ]; then
      continue
    fi
    # Accept Good (G) and Good but untrusted (U)
    if [ "$status" != "G" ] && [ "$status" != "U" ]; then
      echo "ERROR: Push rejected — commit $c is not GPG-signed (status=$status)."
      echo "Fix: sign the commit, e.g. 'git commit --amend -S --no-edit' or use './bin/commit-signed.sh'"
      exit 1
    fi
  done
done

exit 0
