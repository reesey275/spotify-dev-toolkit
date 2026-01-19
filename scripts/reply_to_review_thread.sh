#!/usr/bin/env bash
# reply_to_review_thread.sh
# Usage: ./reply_to_review_thread.sh [--dry-run] <PR_NUMBER> <THREAD_ID> <REPLY_BODY>
# Posts an inline reply to a specific GitHub PR review thread using the GraphQL API.
# Requires: gh CLI (authenticated), jq

set -euo pipefail

DRY_RUN=false

usage() {
  echo "Usage: $0 [--dry-run] <PR_NUMBER> <THREAD_ID> <REPLY_BODY>"
  echo "  --dry-run   Print the GraphQL mutation and exit without posting"
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
REPLY_BODY="$3"

# Optionally, allow multi-line reply body via file
if [[ -f "$REPLY_BODY" ]]; then
  REPLY_BODY="$(cat "$REPLY_BODY")"
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
gh api graphql -f query="$GRAPHQL_QUERY" \
  -F pullRequestReviewThreadId="$THREAD_ID" \
  -F body="$REPLY_BODY"

echo "✅ Reply posted to thread $THREAD_ID on PR #$PR_NUMBER."