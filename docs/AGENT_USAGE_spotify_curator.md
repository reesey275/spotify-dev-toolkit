---
title: "Agent Usage: Spotify Curator Agent"
description: "Examples and patterns for using the Spotify Curator Codex Agent with the spotify-dev-toolkit service."
author: "Chad A. Reesey"
created_at: "2025-11-23"
updated_at: "2025-11-23"
tags:
  - spotify
  - codex-agent
  - usage
  - examples
project: "spotify-dev-toolkit"
related_components:
  - ".codex/agent_spotify_curator.md"
  - ".codex/runtime/spotify_curator.profile.yml"
  - ".codex/runtime/spotify_curator.system.md"
  - ".codex/services/SERVICE_CARD_spotify-dev-toolkit.md"
document_type: "agent_usage"
status: "active"
visibility: "internal"
canonical_url: ""
codex_scope: "service:spotify-dev-toolkit"
codex_role: "spotify_curator"
codex_type: "agent"
codex_runtime: "http+filesystem"
---

# Agent Usage: Spotify Curator Agent

## Overview

The **Spotify Curator Agent** is a **read-only Codex agent** that:

- Reads `config/collections.yml` for collection definitions
- Calls the HTTP API for live metadata:
  - `GET /api/collections`
  - `GET /api/collections/:category/:id`
- Produces **textual recommendations** for moods, activities, and workflows.

It **does not** modify playlists, configs, or infrastructure.

---

## Example 1: Onboarding a New TAGS Developer

**Goal:** Recommend collections/playlists for a new backend engineer joining TAGS.

### Example Task Prompt

```markdown
You are the Spotify Curator Agent for the TAGS ecosystem.

A new backend engineer is joining the team. They:
- Prefer rock/metal and instrumental tracks.
- Will be doing deep-focus coding 2–4 hours at a time.
- Are working mostly late night.

Using:
- `config/collections.yml`
- `GET /api/collections`
- `GET /api/collections/:category/:id`

Recommend:
1. 2–3 collections (id + name + 1–2 sentence description).
2. For each collection, 2–3 playlists with:
   - Playlist name
   - Why it fits this developer’s context.

Do not propose creating new playlists or editing configs. Textual recommendations only.
```

### Expected Agent Behavior

1. Read `config/collections.yml` to find:

   * Collections tagged with `focus`, `coding`, `deep-work`, `night`, etc.
2. Call `GET /api/collections` to fetch playlist metadata for those collections.
3. Return a short, structured answer, for example:

```markdown
### Recommended Collections

1. `chill-focus` – Chill Focus
   - For low-vocal, ambient tracks that support long coding sessions.
   - Tagged for `focus`, `ambient`, `low-energy`.

   **Playlists:**
   - `Deep Focus` – Long, atmospheric tracks that stay out of the way while you code.
   - `Night Study` – Tailored to late-night focus with minimal vocals.

2. `energy-metal` – Focused Metal
   - For times when the dev wants heavier, riff-based energy without constant vocal distraction.

   **Playlists:**
   - `Instrumental Metal Focus` – Guitar-driven, no vocals, great for backend grind.
   - `Coding Metal` – Curated for high-intensity coding bursts.
```

---

## Example 2: Mood-Based Recommendations for a Workday

**Goal:** Suggest playlists for different segments of a day: ramp-up, deep work, and cooldown.

### Example Task Prompt

```markdown
You are the Spotify Curator Agent.

Design a music plan for a TAGS engineer’s full workday using existing collections:

Segments:
- Morning ramp-up
- Midday deep work
- Late evening cooldown

For each segment:
- Pick 1–2 collections.
- Pick 2–3 playlists within those collections.
- Explain why they fit the segment.

Use only data available from:
- `config/collections.yml`
- `GET /api/collections`
- `GET /api/collections/:category/:id`
```

The agent should map segments → collections → playlists and provide short justifications.

---

## Usage Notes

* Always prefer **existing collections** over inventing new ones.
* If no suitable collection exists, the agent should:

  * Say so explicitly.
  * Optionally suggest how a human might extend `config/collections.yml` later.
* All actions remain read-only:

  * No playlist creation.
  * No config edits.
  * No CI or infra changes.

This agent is designed to be safe to call from TAGS orchestration without risking unintended mutations.

---

## Test Note for CI Maintainer Agent

This section was added by the CI maintainer agent in `CLI_AGENT_MODE=auto` to validate:

- Branch creation
- File editing
- Signed commits
- Branch push
- PR creation

If you see this, the agent executed successfully in auto mode.