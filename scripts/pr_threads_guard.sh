#!/usr/bin/env bash
# pr_threads_guard.sh - Check review thread state for PR advancement (READ-ONLY)
#
# Runbook: (see CONTRIBUTING.md for workflow details)
#
# THREAD STATE MODEL (STANDARD mode):
#   BLOCKING:  (isResolved=false) AND (isOutdated=false) → Agent must fix code
#   HANDOFF:   (isResolved=false) AND (isOutdated=true)  → Ready for human review
#   RESOLVED:  (isResolved=true)                         → Done
#
# This script is READ-ONLY. It reports state, does NOT modify threads.
# In STANDARD mode, agent resolves by pushing fixes until threads become OUTDATED.
# Outdated unresolved threads indicate handoff to human review, not manual action.
#
# MODES:
#   STANDARD (default): Blocks on unresolved and not outdated threads (no --check flag implemented)
#   --strict: Blocks on ANY unresolved thread (even if outdated)
#   --strict            Strict: block on ANY isResolved=false (even if outdated)
#
# Usage:
#   scripts/pr_threads_guard.sh <PR#>           # Standard check
#   scripts/pr_threads_guard.sh <PR#> --strict  # Strict check
#
# Exit codes:
#   0 - No blocking threads
#   1 - Blocking threads exist
#   2 - Usage error
#   3 - API error

set -euo pipefail

# SCRIPT_DIR is reserved for future use (e.g., locating script resources, supporting multi-script workflows, or context-aware operations).
# Uncomment and use when script resource location is needed.
# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Temp file cleanup trap
cleanup_temp_files() {
  rm -f "/tmp/pr_title_$$" 2>/dev/null || true
}
trap cleanup_temp_files EXIT

# ─────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────

PR="${1:-}"
STRICT=false

print_usage() {
  cat << 'USAGE'
Usage: pr_threads_guard.sh <PR_NUMBER|PR_URL> [OPTIONS]

OPTIONS:
  --strict    Fail on ANY unresolved thread (even if outdated)

EXIT CODES:
  0 = No blocking threads
  1 = Blocking threads exist
  2 = Usage error
  3 = API error

THREAD STATE MODEL (STANDARD mode):
  BLOCKING:  (isResolved=false) AND (isOutdated=false) → Agent must fix code
  HANDOFF:   (isResolved=false) AND (isOutdated=true)  → Ready for human review
  RESOLVED:  (isResolved=true)                         → Done

MODES:
  STANDARD (default):
    Blocks on: BLOCKING threads only
    Agent resolves by pushing code fixes → threads become OUTDATED → non-blocking

  STRICT (--strict):
    Blocks on: ALL unresolved threads (BLOCKING + HANDOFF)
    All threads must reach RESOLVED state

EXAMPLES:
  # Standard check
  ./pr_threads_guard.sh 373

  # Strict check
  ./pr_threads_guard.sh 373 --strict
  # AGENT_CONTEXT context for merge guard is not implemented; remove reference to pr_merge_guard.sh
USAGE
}

# Check for help flag first
if [[ "${PR}" == "-h" || "${PR}" == "--help" ]]; then
  print_usage
  exit 0
fi

if [[ -z "${PR}" ]]; then
  print_usage
  exit 2
fi

# Extract PR number from URL if needed
if [[ "${PR}" =~ /pull/([0-9]+) ]]; then
  PR="${BASH_REMATCH[1]}"
fi

# Validate PR number
if [[ -z "${PR}" ]]; then
  echo "❌ PR number is empty after URL extraction"
  exit 2
fi
if ! [[ "${PR}" =~ ^[0-9]+$ ]]; then
  echo "❌ PR number must be numeric, got: '${PR}'"
  exit 2
fi
if [[ "${PR}" -le 0 ]]; then
  echo "❌ PR number must be positive, got: ${PR}"
  exit 2
fi

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT=true
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      print_usage
      exit 2
      ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Prerequisites
# ─────────────────────────────────────────────────────────────

command -v gh >/dev/null || { echo "❌ gh CLI not found"; exit 3; }
command -v jq >/dev/null || { echo "❌ jq not found"; exit 3; }

# Get repo info from current directory
REPO_INFO="$(gh repo view --json owner,name 2>/dev/null)" || {
  echo "❌ Not in a GitHub repository or gh not authenticated"
  exit 3
}
OWNER="$(jq -r '.owner.login' <<<"${REPO_INFO}")"
REPO="$(jq -r '.name' <<<"${REPO_INFO}")"

# ─────────────────────────────────────────────────────────────
# GraphQL Query (READ-ONLY - no mutations)
# ─────────────────────────────────────────────────────────────

QUERY_THREADS='
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      title
      reviewThreads(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 1) {
            nodes {
              author { login }
              body
            }
          }
        }
      }
    }
  }
}
'

# ─────────────────────────────────────────────────────────────
# Fetch all threads (paginated)
# ─────────────────────────────────────────────────────────────

fetch_all_threads() {
  local all_threads="[]"
  local cursor=""
  local pr_title=""
  local page=1

  while true; do
    local query_args=(-f query="${QUERY_THREADS}" -F owner="${OWNER}" -F name="${REPO}" -F number="${PR}")
    if [[ -n "${cursor}" ]]; then
      query_args+=(-F after="${cursor}")
    fi

    local result
    result="$(gh api graphql "${query_args[@]}" 2>&1)" || {
      echo "❌ GraphQL query failed (page ${page}): ${result}"
      exit 3
    }

    # Check for API errors
    if echo "${result}" | jq -e '.errors' >/dev/null 2>&1; then
      echo "❌ API error:"
      echo "${result}" | jq -r '.errors[].message'
      exit 3
    fi

    # Check if pullRequest exists
    if echo "${result}" | jq -e '.data.repository.pullRequest == null' >/dev/null 2>&1; then
      echo "❌ Pull request #${PR} not found in ${OWNER}/${REPO}"
      echo "   Possible causes: wrong PR number, wrong repository, or insufficient permissions"
      exit 3
    fi

    # Extract title (only on first page)
    if [[ -z "${pr_title}" ]]; then
      pr_title="$(echo "${result}" | jq -r '.data.repository.pullRequest.title // "(unknown)"')"
      echo "${pr_title}" > /tmp/pr_title_$$
    fi

    # Extract threads from this page
    local page_threads
    page_threads="$(echo "${result}" | jq '.data.repository.pullRequest.reviewThreads.nodes')"
    all_threads="$(echo "${all_threads}" "${page_threads}" | jq -s 'add')"

    # Check for next page
    local has_next
    has_next="$(echo "${result}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
    if [[ "${has_next}" != "true" ]]; then
      break
    fi

    cursor="$(echo "${result}" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')"
    page=$((page + 1))

    # Safety limit
    if [[ ${page} -gt 50 ]]; then
      echo "⚠️  Warning: Stopped pagination after 50 pages (5000 threads)"
      break
    fi
  done

  echo "${all_threads}"
}

# ─────────────────────────────────────────────────────────────
# Display thread info
# ─────────────────────────────────────────────────────────────

display_threads() {
  local threads="$1"
  local count
  count="$(echo "${threads}" | jq 'length')"

  if [[ "${count}" -eq 0 ]]; then
    return 0
  fi

  echo ""
  echo "─────────────────────────────────────────────────────────────"
  while read -r thread; do
    local path_file
    path_file="$(echo "${thread}" | jq -r '.path // "(no path)"')"
    local line
    line="$(echo "${thread}" | jq -r '.line // "(no line)"')"
    local author
    author="$(echo "${thread}" | jq -r '.comments.nodes[0].author.login // "(unknown)"')"
    local body
    body="$(echo "${thread}" | jq -r '.comments.nodes[0].body // "(no body)"' | head -c 200 || true)"
    local is_outdated
    is_outdated="$(echo "${thread}" | jq -r '.isOutdated')"
    local is_resolved
    is_resolved="$(echo "${thread}" | jq -r '.isResolved')"

    echo ""
    echo "📍 ${path_file}:${line}"
    echo "   Author: ${author}"
    echo "   isResolved: ${is_resolved}"
    echo "   isOutdated: ${is_outdated}"
    echo "   Comment: ${body}..."
  done < <(echo "${threads}" | jq -c '.[]')
  echo ""
  echo "─────────────────────────────────────────────────────────────"
}

# ─────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────

echo "== Fetching review threads for PR #${PR} =="
THREADS="$(fetch_all_threads)"
PR_TITLE="$(cat /tmp/pr_title_$$ 2>/dev/null || echo "(unknown)")"
rm -f /tmp/pr_title_$$



# ─────────────────────────────────────────────────────────────
# Three-bucket thread counts (state model)
# ─────────────────────────────────────────────────────────────
TOTAL_THREADS="$(echo "${THREADS}" | jq 'length')"
RESOLVED_COUNT="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == true)] | length')"
UNRESOLVED_TOTAL="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == false)] | length')"
UNRESOLVED_ACTIVE="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == false and .isOutdated == false)] | length')"
UNRESOLVED_OUTDATED="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == false and .isOutdated == true)] | length')"

# Determine blocking count based on mode
if [[ "${STRICT}" == "true" ]]; then
  MODE_DESC="STRICT (any unresolved → blocks merge)"
  BLOCKING_COUNT="${UNRESOLVED_TOTAL}"
  BLOCKING_THREADS="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == false)]')"
else
  MODE_DESC="STANDARD (unresolved AND not outdated → blocks merge)"
  BLOCKING_COUNT="${UNRESOLVED_ACTIVE}"
  BLOCKING_THREADS="$(echo "${THREADS}" | jq '[.[] | select(.isResolved == false and .isOutdated == false)]')"
fi

echo ""
echo "== PR #${PR}: ${PR_TITLE} =="
echo "Mode: ${MODE_DESC}"
echo ""
echo "Thread Summary:"
echo "  🔴 BLOCKING: ${UNRESOLVED_ACTIVE}  (agent must fix)"
echo "  🟡 HANDOFF:  ${UNRESOLVED_OUTDATED}  (ready for human review)"
echo "  ✅ RESOLVED: ${RESOLVED_COUNT}"
echo "  ─────────────────────"
echo "  📊 Total:    ${TOTAL_THREADS}"

# ─────────────────────────────────────────────────────────────
# Exit with appropriate status
# ─────────────────────────────────────────────────────────────

if [[ "${BLOCKING_COUNT}" -eq 0 ]]; then
  echo ""
  echo "✅ No blocking review threads. Safe to proceed."
  exit 0
fi

echo ""
echo "❌ POLICY VIOLATION: ${BLOCKING_COUNT} unresolved review thread(s) block merge."
echo ""

# Mode-specific guidance (STANDARD vs STRICT have different resolution paths)
if [[ "${STRICT}" == "true" ]]; then
  echo "Resolution required (STRICT mode - human action needed):"
  echo "  1. Push code fix → thread becomes OUTDATED (but still blocks in STRICT)"
  echo "  2. Human clicks 'Resolve' in GitHub WebUI → thread becomes RESOLVED"
  echo ""
  echo "In STRICT mode, ALL unresolved threads block merge regardless of outdated status."
  echo "Human must explicitly resolve each thread in GitHub WebUI."
else
  echo "Agent action required (STANDARD mode):"
  echo "  1. Fix code issues in threads below"
  echo "  2. Push fixes → threads become OUTDATED → move to HANDOFF"
  echo "  3. Re-run guard to confirm BLOCKING=0"
fi

display_threads "${BLOCKING_THREADS}"

echo ""
if [[ "${STRICT}" == "true" ]]; then
  echo "STRICT mode: All threads must reach RESOLVED state."
else
  echo "STANDARD mode: Fix code → push → re-run guard."
fi
exit 1
