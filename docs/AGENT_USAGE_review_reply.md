---
title: "Agent Usage: Review Reply Agent"
description: "Patterns and scripts for automated inline review replies in the spotify-dev-toolkit."
author: "Chad A. Reesey"
created_at: "2026-01-19"
updated_at: "2026-01-19"
tags:
  - review
  - github
  - automation
  - codex-agent
project: "spotify-dev-toolkit"
related_components:
  - "scripts/reply_to_review_thread.sh"
document_type: "agent_usage"
status: "active"
visibility: "internal"
codex_scope: "service:spotify-dev-toolkit"
codex_role: "review_reply"
codex_type: "agent"
codex_runtime: "cli"
---

# Agent Usage: Review Reply Agent

## Overview

The **Review Reply Agent** automates posting inline replies to GitHub PR review threads using the GraphQL API and the provided script. This ensures all review comments are addressed in a reproducible, auditable way.

---

## Example: Automated Inline Review Reply

**Goal:** Post a reply to a specific review thread on a PR.

### Task Prompt

```markdown
You are the Review Reply Agent for spotify-dev-toolkit.

A reviewer left a blocking comment on PR #32, thread ID PRRT_kwDOP_qztc5qCm0i. Post the following reply inline:

"Thank you for the feedback! The latest commit restores all helpful documentation and context to .env.example."
```

### Agent Behavior

1. Uses `scripts/reply_to_review_thread.sh` to post the reply.
  - Validates `gh` and `jq` are installed and authenticated.
  - Validates reply body file exists, is readable, and <32KB (or string is <32KB).
  - Handles errors with clear exit codes.
  - Supports `--dry-run` for safe preview.
2. Verifies the reply appears inline on GitHub.
3. Documents the action in OPLOG.

### Example Command

```bash
./scripts/reply_to_review_thread.sh 32 PRRT_kwDOP_qztc5qCm0i "Thank you for the feedback! The latest commit restores all helpful documentation and context to .env.example."
```

### Example OPLOG

[OPLOG]
**ACTION:** Post inline review reply to PR #32, thread PRRT_kwDOP_qztc5qCm0i.

**COMMANDS EXECUTED:**
1. `./scripts/reply_to_review_thread.sh 32 PRRT_kwDOP_qztc5qCm0i "..."`

**EFFECT:**
- Reply posted inline to the review thread.
- Action is reproducible and auditable.

---

## Usage Notes

- Always use the script for inline review replies to ensure traceability.
- Fetch thread IDs using the documented GraphQL query.
- Document all actions in OPLOG for auditability.
- Do not use for general PR comments—inline replies only.
- Script will exit with clear error if `gh` or `jq` are missing, or if reply body is too large or unreadable.
- Use `--dry-run` to preview mutation and variables before posting.
- See `docs/CONTRIBUTING.md` for full workflow, error codes, and troubleshooting.

---

## Script Reference

See `docs/CONTRIBUTING.md` for full workflow and script usage details.
