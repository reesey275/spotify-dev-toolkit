---
title: "SERVICE_CARD: spotify-dev-toolkit"
description: "Service card for the Spotify Fan WebApp + Dev Toolkit, exposing curated collections/moods and read-only agent integration."
author: "Chad A. Reesey"
created_at: "2025-11-23"
updated_at: "2025-11-23"
tags:
  - service-card
  - spotify
  - music
  - collections
  - moods
  - tags-ecosystem
project: "spotify-dev-toolkit"
related_components:
  - "server.js"
  - "config/collections.yml"
  - "public/index.html"
  - "export_spotify_playlist.py"
  - ".codex/agent_spotify_curator.md"
  - ".codex/runtime/spotify_curator.profile.yml"
  - ".codex/runtime/spotify_curator.system.md"
document_type: "service_card"
status: "active"
visibility: "internal"
canonical_url: ""
codex_scope: "service:spotify-dev-toolkit"
codex_role: "service_owner"
codex_type: "service"
codex_runtime: "http+filesystem"
---

# SERVICE_CARD: spotify-dev-toolkit

## 1. Service Summary

**Name:** `spotify-dev-toolkit`  
**Type:** Internal TAGS service (Spotify Fan WebApp + Dev Toolkit)  
**Purpose:**

- Provide a **curated collections/moods API** for Spotify playlists.
- Expose a **fan-facing web UI** to browse collections, moods, and playlists.
- Offer a **Python export tool** for playlist data (CSV/HTML/TXT).
- Serve as a **data source for the Spotify Curator Codex Agent** (read-only).

This service is **NOT** a production public SaaS; it is an internal TAGS component and experimental toolkit.

---

## 2. Ownership & Contacts

- **Service Owner:** Chad A. Reesey (`spotify-dev-toolkit` maintainer)
- **Primary Repo:** (local) `~/spotify` or GitHub mirror when pushed
- **Responsibility:**
  - Keep collections config and service contract stable.
  - Ensure CI stays green (Playwright + API tests).
  - Coordinate with TAGS governance when changing endpoints or security posture.

---

## 3. Environments

### 3.1 Development

- **Base URL (local):**  
  `http://127.0.0.1:5500`

- **Start command:**

  ```bash
  cd /home/chad/spotify
  node server.js
  ```

* **Health check:**

  ```bash
  curl -s http://127.0.0.1:5500/healthz
  ```

* **Expected response:** JSON with `"status": "ok"` (or equivalent healthy marker).

### 3.2 Production (Placeholder)

* **Base URL (prod):**
  To be defined (e.g. behind nginx/Caddy + HTTPS). See `docs/deployment.md`.

* **Requirements:**

  * HTTPS termination (for future Web Playback SDK support).
  * Reverse proxy routing to Node server on internal port.
  * Same endpoint contract as dev (`/healthz`, `/api/collections`, etc.).

---

## 4. Key Endpoints (Service Contract)

All endpoints are **GET-only** for agents.

### 4.1 `GET /healthz`

* **Purpose:** Liveness probe.
* **Returns:** Small JSON payload indicating service health.
* **Used by:**

  * CI tests
  * Basic operational checks

### 4.2 `GET /api/collections`

* **Purpose:** List all available collections/moods with light playlist metadata.

* **Returns:**

  ```json
  {
    "total": <number>,
    "collections": [
      {
        "id": "chill",
        "name": "Chill Vibes",
        "description": "...",
        "category": "moods",
        "tags": ["focus", "ambient"],
        "color": "#3b82f6",
        "icon": "🧊",
        "playlists": [
          {
            "id": "37i9dQZF1...",
            "name": "Playlist Name",
            "track_count": 50,
            "cover": "https://...",
            "owner": "Spotify or user",
            "url": "https://open.spotify.com/playlist/..."
          }
        ]
      }
    ]
  }
  ```

* **Used by:**

  * Fan UI (Collections view)
  * Spotify Curator Agent (overview of all collections)

### 4.3 `GET /api/collections/:category/:id?limit=&offset=`

* **Purpose:** Get full details for a single collection.

* **Path params:**

  * `:category` — e.g. `moods`, `activities`
  * `:id` — collection id (e.g. `chill`)

* **Query params:**

  * `limit` — page size for playlists (default 50)
  * `offset` — starting index (default 0)

* **Returns:**

  ```json
  {
    "collection": {
      "id": "chill",
      "name": "Chill Vibes",
      "description": "...",
      "category": "moods",
      "tags": ["focus", "ambient"],
      "color": "#3b82f6",
      "icon": "🧊",
      "playlists": [ /* full playlist list (paged) */ ]
    },
    "pagination": {
      "total": 123,
      "limit": 50,
      "offset": 0,
      "hasNext": true,
      "hasPrevious": false
    }
  }
  ```

* **Used by:**

  * Fan UI (collection detail view with pagination)
  * Spotify Curator Agent (deep dive per collection)

---

## 5. Configuration & Dependencies

### 5.1 Environment Variables

Required:

* `SPOTIFY_CLIENT_ID`
* `SPOTIFY_CLIENT_SECRET`
* `SPOTIFY_REDIRECT_URI` (if OAuth flows are used)
* `SESSION_SECRET` (for session cookies, if enabled)
* `NODE_ENV` (`development` / `production`)
* `SPOTIFY_TOOLKIT_BASE_URL` (for agent runtime, points to this service)

Local `.env` is **git-ignored** and must never be committed. CI uses encrypted repo secrets for these values.

### 5.2 Collections Config

* **File:** `config/collections.yml`
* **Contains:**

  ```yaml
  collections:
    - id: "chill"
      name: "Chill Vibes"
      description: "Laid-back sets for focus or unwind."
      category: "moods"
      tags: ["focus", "ambient", "low-energy"]
      color: "#3b82f6"
      icon: "🧊"
      playlist_ids:
        - "37i9dQZF1..."
        - "..."
  ```

This is the **source of truth** for what collections exist and which playlists they reference.

---

## 6. Security & Hardening

The following are implemented as of `v0.1.0`:

* **GPG-signed commits mandatory** (pre-push hook verification).
* **Secret scanning** in pre-commit/pre-push:

  * Blocks obvious AWS keys, Spotify secrets, and generic tokens.
* **CORS:** Configured with:

  * Local dev/test origins (`127.0.0.1`, `localhost`) allowed.
  * Tight origin handling for prod (see `server.js` and `tests/website.spec.js`).
* **Helmet:** Security headers (CSP/HSTS/etc.) with environment toggles.
* **Rate Limiting:** Per-endpoint with CI/test bypass flags where needed.
* **Sessions:** Secure cookies (httpOnly) where sessions are used.
* **Input Validation:** Zod schemas guarding API inputs.
* **Error Handling:** Centralized handler with production-safe messages.

**Threat model:**
This is an internal TAGS tool. Exposed to the public internet only behind proper HTTPS termination and reverse proxy, if at all.

---

## 7. CI, Testing & Observability

* **Tests:** Currently ~78 tests, including:

  * Collections API
  * Website behavior (Playwright)
  * CORS correctness
  * Health check behavior
* **CI:** GitHub Actions workflow:

  * Installs dependencies
  * Boots server
  * Runs tests (Playwright + others)
  * Uses GitHub Secrets for all sensitive data
* **Logs:** Application logs output to `stdout`/`stderr`, and can be captured by systemd/PM2/log shipper in production (see `docs/deployment.md`).

---

## 8. Agent Integration

### 8.1 Spotify Curator Agent

* **Spec:** `.codex/agent_spotify_curator.md`
* **Runtime profile:** `.codex/runtime/spotify_curator.profile.yml`
* **System prompt:** `.codex/runtime/spotify_curator.system.md`

**Role:**
Read-only curator that:

* Reads `config/collections.yml` and the HTTP collections endpoints.
* Recommends collections/playlists for moods, activities, or workflows.
* Produces textual suggestions only (no code edits, no playlist mutations).

**Tools allowed:**

* `http_spotify_toolkit` → GET `/healthz`, `/api/collections`, `/api/collections/:category/:id`
* `fs_spotify_toolkit` → read `config/collections.yml`, README, deployment/docs, agent spec

Governance:
No source edits, no config edits, no shell, no external network.

---

## 9. Operational Runbook (Short Version)

**Start (dev):**

```bash
cd /home/chad/spotify
node server.js
```

**Health check:**

```bash
curl -s http://127.0.0.1:5500/healthz
```

**Run tests:**

```bash
npm test
# or for full browser suite:
npx playwright test
```

**Deploy (prod):**

* See `docs/deployment.md` for:

  * Reverse proxy examples (nginx/Caddy).
  * PM2/systemd setup.
  * TLS/HTTPS configuration.
  * Security checklist.

---

## 10. Change Management

* All changes must:

  * Pass CI (tests + lint).
  * Be GPG-signed.
  * Respect the endpoint contract described in this SERVICE_CARD.
* Any breaking changes to:

  * `/api/collections`
  * `/api/collections/:category/:id`
  * `config/collections.yml` schema

…must be reflected in:

* This SERVICE_CARD
* The agent spec
* The runtime profile (if tool behavior changes)