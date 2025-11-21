#!/usr/bin/env bash
set -euo pipefail

# Wrapper to create a GPG-signed commit with up to 3 passphrase attempts.
# Usage: ./bin/commit-signed.sh -m "message" [files...]

MAX_ATTEMPTS=3
ATTEMPT=0

while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT+1))
  if git -c commit.gpgsign=true commit -S "$@"; then
    echo "Commit created and GPG-signed."
    exit 0
  fi

  echo "GPG signing failed (attempt $ATTEMPT/$MAX_ATTEMPTS)."
  if [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; then
    echo "Please re-enter your GPG passphrase. Retrying..."
    sleep 1
  fi
done

echo "Failed to create a GPG-signed commit after $MAX_ATTEMPTS attempts."
echo "No commit was created. If you need to bypass signing for CI triggers,"
echo "use an explicit CI workflow or coordinate a signed follow-up commit."
exit 2
