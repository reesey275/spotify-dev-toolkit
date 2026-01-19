# Spotify Developer Toolkit - AI Coding Guidelines

## Project Overview
This is a full-stack Spotify playlist management application with:
- **Backend**: Node.js/Express REST API with Spotify Web API integration
- **Frontend**: Vanilla JavaScript single-page application
- **Export Tool**: Python CLI for playlist data export
- **Architecture**: Session-based authentication with OAuth PKCE, rate limiting, and comprehensive error handling

## Core Architecture Patterns

### API Design
- RESTful endpoints under `/api/` prefix
- Input validation using Zod schemas (e.g., `playlistIdSchema`, `paginationSchema`)
- Consistent error responses with status codes and descriptive messages
- Rate limiting per endpoint (auth: 5/15min, API: 300/min, search: 60/min)

### Authentication Flow
- OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Session management with SQLite store (`connect-sqlite3`)
- Automatic token refresh with fallback to client credentials
- User tokens prioritized over client credentials for personalized data

### Data Flow
- Frontend makes fetch requests to `/api/*` endpoints
- Backend proxies Spotify API calls with token management
- Fallback to demo/mock data when Spotify API unavailable
- Pagination support with offset/limit parameters

### Error Handling
- Centralized error middleware with development vs production modes
- Graceful degradation (e.g., featured playlists fallback to Spotify official)
- User-friendly error messages in UI with retry options

## Critical Developer Workflows

### Local Development Setup
```bash
# 1. Environment setup
cp .env.example .env  # Add Spotify credentials
npm install
python -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# 2. Development server (REQUIRED: Use screen-based workflow)
npm run dev:screen          # Start server in detached screen session
npm run dev:screen:status   # Check if server is running
npm run dev:screen:attach   # Attach to server session to view logs
npm run dev:screen:stop     # Stop server session

# ❌ NEVER use: npm run dev (blocks terminal, prevents concurrent operations)

# 3. Testing (run in separate terminal while server runs)
node test-playlist-endpoints.js  # Basic endpoint validation
curl -s http://127.0.0.1:5500/healthz  # Health check
```

### Spotify App Configuration
- Create app at https://developer.spotify.com/dashboard
- Set redirect URI to `http://127.0.0.1:5500/callback`
- Required scopes: `playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private`

### Export Tool Usage
```bash
# Export single playlist
python export_spotify_playlist.py --playlist <URL/ID> -o playlist.csv

# Generate landing page with all user playlists
python export_spotify_playlist.py --landing-page
```

## Project-Specific Conventions

### Backend Patterns
- **Token Management**: Use `getSpotifyToken()` for client creds, `getUserAccessToken()` for user auth
- **Request Wrapper**: Always use `spotifyRequest(endpoint, req, method, data)` for API calls
- **Validation**: Define Zod schemas at file top, validate all inputs
- **Sorting**: Implement client-side sorting with `field-direction` format (e.g., `name-asc`)
- **Pagination**: Support `offset`/`limit` with `hasNext`/`hasPrevious` flags

### Frontend Patterns
- **View Management**: Use `switchView(viewName)` to change SPA sections
- **Event Delegation**: Attach listeners to document for dynamic elements
- **Loading States**: Show/hide `#loading` and `#error` elements during async operations
- **Auth Checks**: Call `checkAuthStatus()` on init and after auth changes

### Python Export Patterns
- **ID Extraction**: Use `extract_playlist_id()` to handle URLs, URIs, or raw IDs
- **Track Fetching**: Paginate with `while results: ... results = sp.next(results)`
- **Output Formats**: Support CSV (DictWriter) and HTML (table with sort JS)

### Configuration
- **Environment Variables**: Required: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- **Optional**: `SPOTIFY_USER_ID`, `PORT`, `SESSION_SECRET`
- **Development**: Disable CSP and HSTS for local testing

## Key Files and Their Roles

- `server.js`: Main Express app with all routes, middleware, and Spotify integration
- `public/script.js`: Frontend SPA logic, view switching, API calls
- `public/index.html`: Single-page app structure with view containers
- `export_spotify_playlist.py`: CLI tool for playlist export in multiple formats
- `package.json`: Scripts for dev (`nodemon`), start (`node server.js`), screen-based process management
- `.env`: Spotify credentials and configuration

## Common Integration Points

### Spotify API Limits
- Handle 429 errors with retry-after headers
- Implement exponential backoff for rate limits
- Cache tokens to avoid unnecessary refreshes

### Cross-Component Communication
- Frontend polls `/api/my-playlists` for user data
- Backend uses session cookies for auth state
- Export tool runs independently with its own auth

### External Dependencies
- **spotipy**: Python Spotify API client
- **axios**: HTTP client for backend API calls
- **express-session**: Session management
- **zod**: Runtime type validation

## Development Best Practices

### When Adding New Endpoints
1. Define Zod schema for input validation
2. Add rate limiter if needed
3. Implement auth check if required
4. Add error handling with appropriate status codes
5. Update frontend fetch calls and UI

### When Modifying Playlist Data
1. Use user access tokens (not client credentials)
2. Handle ownership checks for modify operations
3. Implement optimistic UI updates with error rollback
4. Update both API and frontend sorting logic

### When Testing Changes
1. Start server: `npm run dev:screen`
2. Test auth flows with `/login` endpoint
3. Run health checks: `curl -s http://127.0.0.1:5500/healthz`
4. Verify fallbacks work by removing Spotify credentials
5. Check mobile responsiveness in browser dev tools
6. Stop server: `npm run dev:screen:stop`

### Process Management
**Problem**: Running `npm run dev` in foreground blocks terminal, preventing concurrent operations.

**Solution**: Use screen sessions for process isolation:
```bash
# Start server in background
npm run dev:screen

# Check status
npm run dev:screen:status

# View server logs
npm run dev:screen:attach  # Detach with Ctrl+A, D

# Stop server
npm run dev:screen:stop

# Manual screen commands
screen -dmS spotify-dev bash -c 'npm run dev'  # Start detached
screen -r spotify-dev                         # Attach to session
screen -S spotify-dev -X quit                 # Kill session
```

**Benefits**:
- Server runs continuously during development
- Multiple terminals can operate concurrently
- Auto-reload functionality preserved
- No accidental process termination

## AI Agent Guidelines

### Development Server Management
**CRITICAL**: Always use screen-based process isolation for development servers.

**✅ CORRECT Workflow**:
```bash
# Start server in background
npm run dev:screen

# Run concurrent operations
curl -s http://127.0.0.1:5500/healthz
node test-playlist-endpoints.js

# Stop when done
npm run dev:screen:stop
```

**❌ NEVER DO**:
```bash
# Don't run server in foreground
npm run dev  # This blocks terminal!

# Don't run commands in same session as server
npm run dev && curl -s http://127.0.0.1:5500/healthz  # Server gets killed
```

### Automated Inline Review Reply Workflow
**Purpose:** Ensure all PR review comments are addressed inline, reproducibly, and auditable by AI agents.

**Script:** `scripts/reply_to_review_thread.sh`

**Usage:**
```bash
./scripts/reply_to_review_thread.sh <PR_NUMBER> <THREAD_ID> <REPLY_BODY>
```

- `<PR_NUMBER>`: The pull request number (e.g., 32)
- `<THREAD_ID>`: The review thread ID (e.g., PRRT_kwDOP_qztc5qCm0i)
- `<REPLY_BODY>`: The reply text, or a path to a file containing the reply

**Example:**
```bash
./scripts/reply_to_review_thread.sh 32 PRRT_kwDOP_qztc5qCm0i "Thank you, this is fixed."
```

**Workflow:**
1. Fetch open review threads for your PR using the documented GraphQL query.
2. Identify the thread ID to reply to.
3. Run the script with your reply.
4. Verify the reply appears inline on GitHub.

**Best Practices:**
- Always reply inline to code review comments for traceability.
- Use this script for all review thread replies to ensure consistency and auditability.
- Document your reply content clearly for future reference.

See `docs/CONTRIBUTING.md` and `docs/AGENT_USAGE_review_reply.md` for full details.

### Terminal Session Management
- **Background Processes**: Use screen for any long-running development processes
- **Concurrent Operations**: Run health checks, tests, and API calls in separate terminals
- **Process Isolation**: Never run server and client commands in the same terminal session
- **Status Checks**: Always verify server status before running dependent operations

### Error Prevention
- **SIGINT Protection**: Screen prevents accidental process termination from subsequent commands
- **Session Persistence**: Server continues running even if terminal closes
- **Resource Management**: Clean up screen sessions with `npm run dev:screen:stop`

### When Deploying
1. Set `NODE_ENV=production` for security headers
2. Use PM2 or similar for process management
3. Configure reverse proxy (nginx) for production
4. Enable HTTPS and proper session secrets