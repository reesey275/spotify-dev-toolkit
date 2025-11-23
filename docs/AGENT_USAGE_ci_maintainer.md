---
title: "Agent Usage: CI Maintainer Agent"
description: "Examples and patterns for using the CI Maintainer Codex Agent with the spotify-dev-toolkit service."
author: "Chad A. Reesey"
created_at: "2025-11-23"
updated_at: "2025-11-23"
tags:
  - ci
  - github-actions
  - maintenance
project: "spotify-dev-toolkit"
related_components:
  - ".codex/agent_ci_maintainer.md"
  - ".codex/runtime/ci_maintainer.profile.yml"
document_type: "agent_usage"
status: "active"
visibility: "internal"
canonical_url: ""
codex_scope: "service:spotify-dev-toolkit"
codex_role: "ci_maintainer"
codex_type: "agent"
codex_runtime: "cli"
---

# Agent Usage: CI Maintainer Agent

## Overview

The **CI Maintainer Agent** is a **CLI-enabled Codex agent** that:

- Diagnoses failing GitHub Actions runs and logs.
- Updates CI workflow YAML files for runner labels, test fixes, cache/timeouts.
- Updates tests when clearly flaky or out of sync.
- Creates PRs with minimal, safe changes to restore green CI.

It **does not** modify application business logic, secrets, or protected branches without approval.

---

## Example: Successful Auto-Mode CI Fix (PR #27)

**Goal:** Fix CI failure due to unsupported Node version in test matrix.

### Task Prompt

```markdown
You are the CI Maintainer Agent for spotify-dev-toolkit.

CI is failing with "npm warn EBADENGINE Unsupported engine" for Node 18.x.
The package.json requires Node >=20.
Update the CI workflow to remove Node 18.x from the matrix.
Create a PR with the fix.
```

### Agent Behavior

1. Inspects CI logs to confirm Node 18.x engine mismatch.
2. Updates `.github/workflows/ci.yml` to change `node-version: [18.x, 20.x]` to `[20.x]`.
3. Commits with GPG signature.
4. Pushes branch and creates PR.

### Example OPLOG

[OPLOG]
**ACTION:** Diagnose and fix failing CI runs by updating workflow matrix to remove unsupported Node versions.

**COMMANDS EXECUTED:**
1. `git checkout -b fix-ci-node-versions` - Created new branch for the CI fix.
2. Edited `.github/workflows/ci.yml` - Changed node-version matrix from [18.x, 20.x] to [20.x] to match package.json engines requirement.
3. `git add .github/workflows/ci.yml && git commit -S -m "Fix CI: Remove unsupported Node 18.x from test matrix"` - Staged, signed, and committed the change.
4. `git push origin fix-ci-node-versions` - Pushed the branch to remote.
5. `gh pr create --title "Fix CI: Remove unsupported Node 18.x from test matrix" --body "CI is failing because Node 18.x is not supported by package engines (>=20). Removing 18.x from the matrix to fix the failures." --base main` - Created PR targeting main.

**EFFECT:**
- Branch `fix-ci-node-versions` created and pushed.
- Commit `cab8345` signed and pushed.
- PR #27 created at https://github.com/reesey275/spotify-dev-toolkit/pull/27.
- This should resolve the CI failures by ensuring all test jobs run on supported Node versions (>=20).
- OPLOG accurately reflects the executed actions and expected impact.

---

## Usage Notes

* Always prefer **minimal changes** to restore green CI.
* If diagnosis requires reading logs, use `gh run view <id> --log`.
* For workflow updates, target `.github/workflows/` files.
* Emit OPLOG for all mutation tasks in auto mode.
* Respect guardrails: no business logic, no secrets, no history rewrites.

This agent is designed to be safe to call from TAGS orchestration for CI triage without risking unintended changes.</content>
<parameter name="filePath">/home/chad/spotify/docs/AGENT_USAGE_ci_maintainer.md