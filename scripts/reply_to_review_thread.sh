#!/usr/bin/env bash

# reply_to_review_thread.sh
# Usage: ./reply_to_review_thread.sh [--dry-run] <PR_NUMBER> <THREAD_ID> <REPLY_BODY>
# Posts an inline reply to a specific GitHub PR review thread using the GraphQL API.
#
# Requirements:
#   - gh CLI (authenticated)
#   - jq
#   - bash 4+
#
# Features:
#   - Validates CLI and jq are installed
#   - Validates reply body file exists and is <32KB
#   - Handles multi-line reply body via file or direct string
#   - Robust error handling and exit codes
#   - --dry-run mode prints mutation and variables
#
# Exit codes:
#   0 - Success
#   1 - Usage error
#   2 - Prerequisite missing
#   3 - File error (missing/too large)
#   4 - API error



set -euo pipefail

MAX_BODY_SIZE=32768  # 32KB


DRY_RUN=false


usage() {
  echo "Usage: $0 [--dry-run] <PR_NUMBER> <THREAD_ID> <REPLY_BODY>"
  echo "  --dry-run   Print the GraphQL mutation and exit without posting"
  echo "  <REPLY_BODY> can be a string or a path to a file (<32KB)"
  exit 1
}


# Parse --dry-run flag
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      break
      ;;
  esac
done


if [[ $# -lt 3 ]]; then
  usage
fi


PR_NUMBER="$1"
THREAD_ID="$2"
REPLY_BODY_ARG="$3"

# Prerequisite checks
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: gh CLI not found. Please install GitHub CLI (https://cli.github.com/) and authenticate."
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Error: jq not found. Please install jq (https://stedolan.github.io/jq/)."
  exit 2
fi

# Validate reply body (file or string)
if [[ -f "$REPLY_BODY_ARG" ]]; then
  # File input
  if [[ ! -r "$REPLY_BODY_ARG" ]]; then
    echo "❌ Error: Reply body file '$REPLY_BODY_ARG' is not readable."
    exit 3
  fi
  FILE_SIZE=$(wc -c < "$REPLY_BODY_ARG")
  if (( FILE_SIZE > MAX_BODY_SIZE )); then
    echo "❌ Error: Reply body file exceeds 32KB limit ($FILE_SIZE bytes)."
    exit 3
  fi
  REPLY_BODY="$(cat "$REPLY_BODY_ARG")"
else
  # Direct string
  if [[ -z "$REPLY_BODY_ARG" ]]; then
    echo "❌ Error: Reply body is empty."
    exit 3
  fi
  REPLY_BODY="$REPLY_BODY_ARG"
  if (( ${#REPLY_BODY} > MAX_BODY_SIZE )); then
    echo "❌ Error: Reply body string exceeds 32KB limit."
    exit 3
  fi
fi


GRAPHQL_QUERY='mutation($pullRequestReviewThreadId:ID!, $body:String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $pullRequestReviewThreadId, body: $body}) { comment { id body } } }'


if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Would post reply to thread $THREAD_ID on PR #$PR_NUMBER:"
  echo "GraphQL Mutation:"
  echo "$GRAPHQL_QUERY"
  echo "Variables:"
  echo "  pullRequestReviewThreadId: $THREAD_ID"
  echo "  body: $REPLY_BODY"
  exit 0
fi


# GraphQL mutation for inline reply
set +e
API_RESULT=$(gh api graphql -f query="$GRAPHQL_QUERY" \
  -F pullRequestReviewThreadId="$THREAD_ID" \
  -F body="$REPLY_BODY" 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "❌ Error: Failed to post reply. gh CLI returned nonzero exit code."
  echo "$API_RESULT"
  exit 4
fi

# Check for GraphQL errors
if echo "$API_RESULT" | jq -e '.errors' >/dev/null 2>&1; then
  echo "❌ Error: GitHub API returned errors:"
  echo "$API_RESULT" | jq -r '.errors[] | .message'
  exit 4
fi

echo "✅ Reply posted to thread $THREAD_ID on PR #$PR_NUMBER."