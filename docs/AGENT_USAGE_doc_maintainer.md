---
title: "Agent Usage: Doc Maintainer Agent"
description: "Examples and patterns for using the Doc Maintainer Codex Agent with the spotify-dev-toolkit service."
author: "Chad A. Reesey"
created_at: "2025-11-23"
updated_at: "2025-11-23"
tags:
  - docs
  - maintenance
  - service-cards
project: "spotify-dev-toolkit"
related_components:
  - ".codex/agent_doc_maintainer.md"
  - ".codex/runtime/doc_maintainer.profile.yml"
  - ".codex/runtime/doc_maintainer.system.md"
document_type: "agent_usage"
status: "active"
visibility: "internal"
canonical_url: ""
codex_scope: "service:spotify-dev-toolkit"
codex_role: "doc_maintainer"
codex_type: "agent"
codex_runtime: "cli"
---

# Agent Usage: Doc Maintainer Agent

## Overview

The **Doc Maintainer Agent** is a **CLI-enabled Codex agent** that:

- Maintains documentation in `docs/` directory
- Updates SERVICE_CARD files in `.codex/services/`
- Updates AGENT_USAGE files in `docs/`
- Adds missing documentation for new features
- Fixes typos, formatting, and outdated information

It **does not** modify code, CI, or business logic.

---

## Example: Successful Auto-Mode Doc Update

**Goal:** Add missing AGENT_USAGE file for a new agent.

### Task Prompt

```markdown
You are the Doc Maintainer Agent for spotify-dev-toolkit.

A new agent 'doc_maintainer' has been added but lacks AGENT_USAGE documentation.
Create docs/AGENT_USAGE_doc_maintainer.md with examples and patterns.
Include an OPLOG example from a successful run.
```

### Agent Behavior

1. Checks existing AGENT_USAGE files for patterns.
2. Creates new file with proper frontmatter and structure.
3. Adds example OPLOG from CI maintainer.
4. Commits with GPG signature.
5. Pushes branch and creates PR.

### Example OPLOG

[OPLOG]
**ACTION:** Create missing AGENT_USAGE documentation for doc_maintainer agent.

**COMMANDS EXECUTED:**
1. `git checkout -b add-doc-maintainer-usage` - Created new branch for doc update.
2. Created `docs/AGENT_USAGE_doc_maintainer.md` - Added new usage doc with examples and patterns.
3. `git add docs/AGENT_USAGE_doc_maintainer.md && git commit -S -m "Add AGENT_USAGE_doc_maintainer.md with examples"` - Staged, signed, and committed the change.
4. `git push origin add-doc-maintainer-usage` - Pushed the branch to remote.
5. `gh pr create --title "Add AGENT_USAGE_doc_maintainer.md" --body "Adds usage documentation for the doc maintainer agent with examples and patterns." --base main` - Created PR targeting main.

**EFFECT:**
- Branch `add-doc-maintainer-usage` created and pushed.
- Commit signed and pushed.
- PR created with new documentation.
- OPLOG accurately reflects the executed actions.

---

## Usage Notes

* Always follow existing doc patterns and frontmatter.
* Include related components in frontmatter.
* Add examples with task prompts and expected behavior.
* Emit OPLOG for all doc updates in auto mode.
* Require approval for critical docs like SERVICE_CARDs.

This agent ensures documentation stays current and useful.</content>
<parameter name="filePath">/home/chad/spotify/docs/AGENT_USAGE_doc_maintainer.md