# 🎵 Spotify Developer Toolkit

A comprehensive development environment and interactive web application for Spotify playlist management, featuring automated toolkit setup, API integration, and demo outputs.

## 🛠 Developer Toolkit Setup

This repository includes a complete developer toolkit for WSL2 Ubuntu environments, optimized for social media, marketing, streaming, and web development projects.

### Quick Setup

1. **Import WSL Instance** (if using backup):
   ```bash
   wsl --import Ubuntu-22.04 C:\path\to\ubuntu-dev-toolkit.tar C:\path\to\install\location
   ```

2. **Run Toolkit Setup Script**:
   ```bash
   chmod +x setup-dev-toolkit.sh
   ./setup-dev-toolkit.sh
   ```

3. **Verify Installation**:
   ```bash
   node --version
   python3 --version
   ffmpeg -version
   ```

### What's Included in the Toolkit

- **Core Development Tools**: Node.js (LTS), Python 3, Git, build-essential
- **Media & Streaming Tools**: FFmpeg, ImageMagick, yt-dlp, streamlink
- **Database**: PostgreSQL, SQLite3
- **MCP Servers**: AI-assisted development with 8 MCP servers (Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, Time)
- **Security**: UFW firewall, fail2ban
- **Utilities**: jq, htop, ncdu, tcpdump, pandoc, exiftool

### Toolkit Domains

- Social Media & Influencers
- Marketing & Media
- Streaming & Media
- Web Development & APIs

### Backup & Distribution

To backup your configured WSL instance:
```bash
wsl --export Ubuntu-22.04 ~/ubuntu-dev-toolkit-backup.tar
```

The toolkit setup script logs all actions to `dev-toolkit-setup.log` for troubleshooting.

## 🎵 Spotify Fan Website

A modern, interactive web application for exploring and managing Spotify playlists with dynamic sorting, filtering, and user-friendly features.

## ✨ Features

- **Dynamic Playlist Views**: Switch between Featured, Top 10, Recent, User Search, and Playlist Search views
- **Collections & Moods**: Browse curated playlist collections by mood, genre, and activity with dynamic tagging and visual themes
- **User Discovery**: Search for any Spotify user's public playlists by username
- **Smart Sorting**: Sort playlists by name, date created, or track count
- **Track Management**: View detailed track information with sortable columns
- **Responsive Design**: Modern, Spotify-inspired UI that works on all devices
- **Real-time Search**: Search for playlists across Spotify
- **User Profiles**: View user information including follower counts and profile pictures
- **Pagination**: Navigate through large playlists efficiently
- **Interactive Elements**: Click tracks to open in Spotify

## 🏗️ Architecture Overview

The Spotify Fan WebApp is a full-stack application built with modern web technologies, designed for exploring and managing Spotify playlists through an intuitive interface.

### System Components

#### 🎯 Backend (Node.js/Express)
- **Server**: Express.js application with RESTful API endpoints
- **Authentication**: OAuth 2.0 with PKCE flow for Spotify integration
- **Session Management**: SQLite-based sessions with secure cookie handling
- **API Integration**: Spotify Web API client with rate limiting and token refresh
- **Data Caching**: In-memory caching for playlist metadata and API responses
- **Configuration**: YAML-based collections system for dynamic playlist groupings

#### 🎨 Frontend (Vanilla JavaScript SPA)
- **Framework**: Pure JavaScript single-page application (no frameworks)
- **Routing**: Hash-based view switching with DOM manipulation
- **State Management**: In-memory application state with event-driven updates
- **UI Components**: Responsive grid layouts with CSS Grid and Flexbox
- **Data Fetching**: Native Fetch API with async/await patterns
- **Error Handling**: User-friendly error states with retry mechanisms

#### 🐍 Export Tool (Python CLI)
- **Library**: Spotipy for Spotify API integration
- **Formats**: CSV, HTML, and plain text export options
- **Authentication**: OAuth flow for playlist access
- **Data Processing**: Pandas for data manipulation and formatting

### Data Flow

1. **User Authentication**: OAuth PKCE flow redirects to Spotify for authorization
2. **Token Management**: Access tokens cached and automatically refreshed
3. **API Requests**: Frontend fetches data from Express endpoints
4. **Spotify Proxy**: Backend proxies requests to Spotify Web API with authentication
5. **Data Processing**: Collections configured in YAML, playlists enriched with metadata
6. **Response Caching**: Playlist data cached to reduce API calls and improve performance
7. **UI Rendering**: JavaScript dynamically updates DOM with fetched data

### Key Design Patterns

- **Separation of Concerns**: Clear boundaries between server, client, and export tool
- **Stateless API**: RESTful endpoints with consistent response formats
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Mobile-First**: Responsive design with touch-friendly interactions
- **Error Resilience**: Graceful degradation with fallback content
- **Security First**: Environment-based secrets, input validation, and CORS protection

### Development Workflow

- **Process Isolation**: Screen-based session management prevents terminal blocking
- **Hot Reloading**: Nodemon for automatic server restarts during development
- **Testing**: Playwright for end-to-end API and UI testing across browsers
- **CI/CD**: GitHub Actions with automated testing and health checks
- **Containerization**: Docker setup with multi-stage builds and security hardening

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm (v6 or higher)
- Spotify Developer Account

### ⚠️ CRITICAL: Development Workflow

**IMPORTANT**: This project uses screen-based process isolation to prevent terminal blocking. **Never use `npm run dev`** - it will block your terminal and prevent concurrent operations.

**✅ CORRECT - Always use screen commands:**
```bash
# Start development server (runs in background)
npm run dev:screen

# Check if server is running
npm run dev:screen:status

# View server logs (detach with Ctrl+A, D)
npm run dev:screen:attach

# Stop server
npm run dev:screen:stop
```

**❌ NEVER USE:**
```bash
npm run dev  # This blocks terminal - DON'T DO THIS!
```

### 1. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Note your `Client ID` and `Client Secret`
4. Add `http://127.0.0.1:5500/callback` to your app's redirect URIs

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:5500/callback
   SPOTIFY_USER_ID=your_spotify_username
   PORT=5500
   ```

### 3. Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Start the development server using screen:**
   ```bash
   npm run dev:screen
   ```
   
   Or start the production server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://127.0.0.1:5500`

## 📁 Project Structure

```
spotify-dev-toolkit/
├── setup-dev-toolkit.sh     # Automated toolkit setup script
├── dev-toolkit-setup.log    # Setup log file (generated)
├── demo outputs/            # Test outputs from playlist exports
│   ├── test-output-playlist.csv
│   ├── test-output-playlist.html
│   ├── test-output-playlist.txt
│   └── test-output-mood-shifters.txt
├── config/                  # Configuration files
│   └── collections.yml     # Collections and playlist groupings
├── public/                  # Static frontend files
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styles
│   ├── script.js           # Frontend JavaScript
│   └── sw.js              # Service Worker
├── server.js               # Express server with API endpoints
├── export_spotify_playlist.py  # Python export tool
├── package.json            # Node.js dependencies
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (create from .env.example)
├── .env.example           # Environment template
└── README.md             # This file
```

## 📊 Demo Outputs

The `demo outputs/` folder contains test outputs generated during development and testing of the Spotify playlist export functionality. These files demonstrate the various export formats (CSV, HTML, TXT) and serve as examples of the application's capabilities.

- `test-output-playlist.csv` - CSV format export
- `test-output-playlist.html` - HTML format export  
- `test-output-playlist.txt` - Plain text format export
- `test-output-mood-shifters.txt` - Example playlist export

These are included for demonstration purposes and can be regenerated using the web application or Python export tool.

## 🔧 API Endpoints

- `GET /api/playlists` - Get user playlists with sorting options
- `GET /api/playlist/:id` - Get playlist details and tracks
- `GET /api/search` - Search for playlists
- `GET /api/featured` - Get featured playlists
- `GET /api/collections` - Get all playlist collections (moods, genres, activities)
- `GET /api/collections/:type/:id` - Get specific collection details with pagination

### Query Parameters

- `sort`: Sort by `name`, `date`, or `tracks`
- `limit`: Number of results to return
- `offset`: Pagination offset

## 🎵 Collections System

The application includes a dynamic collections system for organizing playlists by mood, genre, and activity. Collections are configured in `config/collections.yml` and served via the `/api/collections` endpoints.

### Collections Configuration

Collections are defined in YAML format with the following structure:

```yaml
collections:
  moods:
    chill:
      name: "Chill Vibes"
      description: "Relaxing tracks for downtime"
      tags: ["chill", "relax", "ambient", "lo-fi"]
      color: "#4CAF50"
      icon: "🌿"
      playlist_ids:
        - "spotify_playlist_id_1"
        - "spotify_playlist_id_2"

  genres:
    indie:
      name: "Indie Gems"
      description: "Discover independent artists"
      tags: ["indie", "alternative", "folk"]
      color: "#9C27B0"
      icon: "🎸"
      playlist_ids:
        - "spotify_playlist_id_3"

  activities:
    workout:
      name: "Workout Mix"
      description: "High-energy tracks for exercise"
      tags: ["workout", "running", "gym"]
      color: "#FF9800"
      icon: "💪"
      playlist_ids:
        - "spotify_playlist_id_4"
```

### Frontend Integration

Collections are displayed in the web interface with:
- Visual cards showing icon, name, description, and tags
- Color-coded themes for each collection
- Clickable cards that load detailed playlist views
- Pagination support for large collections

### API Usage

```javascript
// Get all collections
fetch('/api/collections')
  .then(res => res.json())
  .then(data => {
    // data.collections: array of collection objects
  });

// Get specific collection with pagination
fetch('/api/collections/moods/chill?limit=10&offset=0')
  .then(res => res.json())
  .then(data => {
    // data.collection: collection details
    // data.pagination: pagination info
  });
```

## 🎨 UI Features

### Navigation Views

- **Featured**: Spotify's featured playlists with sorting controls
- **Top 10**: Most popular featured playlists by track count  
- **Recent**: Recently featured playlists
- **User Search**: Find any user's public playlists by username
- **Search Playlists**: Search functionality across all Spotify playlists

### Playlist Features

- **Sortable Tracks**: Sort by name, artist, date added, or duration
- **Pagination**: Navigate through large playlists
- **Track Details**: View comprehensive track information
- **External Links**: Click tracks to open in Spotify

## 🛠 Development

### ⚠️ CRITICAL: Screen-Based Process Isolation

**This project requires screen-based process isolation for development.** The standard `npm run dev` command will block your terminal and prevent concurrent operations like testing, health checks, or running additional commands.

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

### Running in Development Mode

**⚠️ IMPORTANT**: This project uses screen-based process isolation to prevent terminal session conflicts. Always use the screen commands below.

```bash
# Start development server (runs in background)
npm run dev:screen

# Check server status
npm run dev:screen:status

# View server logs (detach with Ctrl+A, D)
npm run dev:screen:attach

# Stop server
npm run dev:screen:stop
```

**❌ NEVER use**: `npm run dev` (blocks terminal, prevents concurrent operations)

### Testing While Server Runs

```bash
# Health check
curl -s http://127.0.0.1:5500/healthz

# Run endpoint tests
node test-playlist-endpoints.js

# Access web interface
open http://127.0.0.1:5500
```

This uses nodemon for auto-reloading when files change, while running in an isolated screen session.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app client secret | Yes |
| `SPOTIFY_REDIRECT_URI` | Redirect URI for OAuth | No |
| `SPOTIFY_USER_ID` | Default user ID for demo | No |
| `PORT` | Server port | No |

## 🚧 Troubleshooting

### ⚠️ Most Common Issue: Terminal Blocking

**"Server keeps stopping when I run commands"**
- **Cause**: Using `npm run dev` blocks the terminal
- **Solution**: Always use `npm run dev:screen` instead
- **Why**: Screen isolates the server process, allowing concurrent operations

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
npm run dev  # Server gets killed by subsequent commands
curl -s http://127.0.0.1:5500/healthz  # Won't work if server was killed
```

### Other Common Issues

1. **"Failed to authenticate with Spotify"**
   - Check your client ID and secret in `.env`
   - Ensure your Spotify app is properly configured

2. **"No playlists found"**
   - Check if your `SPOTIFY_USER_ID` is correct
   - Try using a different user ID or remove it to use Spotify's featured playlists

3. **CORS errors**
   - Ensure your redirect URI matches exactly in the Spotify app settings
   - Check that the server is running on the correct port

### Rate Limiting

The Spotify API has rate limits. If you encounter 429 errors, wait a moment before making more requests.

## 🎵 Python Export Tool

The project includes a Python script (`export_spotify_playlist.py`) for exporting playlist data to CSV/HTML format. This tool complements the web application by providing data export capabilities.

## 📱 Mobile Responsive

The website is fully responsive and provides an optimal experience on:
- Desktop computers
- Tablets
- Mobile phones

## 🔄 Virtual Environment Setup

Since you use virtual environments for all projects, here are the setup commands:

### Node.js (using nvm)
```bash
nvm use node  # or your preferred Node version
npm install
```

### Python (if using the export tool)
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

## 🚀 Deployment

### Production Hardening Status ✅

**Security hardening completed as of v0.1.0:**

- ✅ **CORS Configuration**: Fixed to allow local origins for testing while maintaining security
- ✅ **Environment Variables**: Proper .env handling with .gitignore protection
- ✅ **CI/CD Security**: GitHub Actions uses encrypted secrets for Spotify credentials
- ✅ **Helmet Security Headers**: CSP, HSTS, and other headers configured with environment toggles
- ✅ **Rate Limiting**: Per-endpoint rate limits with configurable skip for testing
- ✅ **Session Security**: Secure session management with httpOnly cookies
- ✅ **Input Validation**: Zod schemas for all API inputs
- ✅ **Error Handling**: Production-safe error responses without sensitive data leaks
- ✅ **OAuth PKCE**: Secure authentication flow with state validation
- ✅ **Token Management**: Automatic refresh with fallback handling

**Remaining recommendations:**
- 🔄 **Credential Rotation**: Consider rotating Spotify client secret periodically
- 📚 **Deployment Documentation**: See `docs/deployment.md` for production setup
- 🔧 **Environment Toggles**: NODE_ENV checks implemented for logging and caching

### Production Deployment (Docker)

This project includes a complete Docker setup for production deployment with WSL2 optimization, security hardening, and Cloudflare Tunnel for HTTPS support (required for Web Playback SDK).

#### Prerequisites

- Docker Desktop with WSL2 integration enabled
- Cloudflare account with tunnel token
- Spotify Developer App credentials

#### Quick Docker Setup

1. **Environment Setup**:
   ```bash
   # Run the Docker setup script (works on Ubuntu/WSL2)
   ./setup-docker.sh
   ```

2. **Configure Environment**:
   ```bash
   # Copy and edit environment file
   cp .env.example .env
   # Edit .env with your credentials (see Environment Variables section below)
   ```

3. **Start Services**:
   ```bash
   # Start all services
   make up

   # Or manually with docker compose
   docker compose up -d --build
   ```

4. **Check Health**:
   ```bash
   # Check service status
   make health
   ```

#### Docker Environment Variables

Add these to your `.env` file:

```env
# Existing Spotify variables...
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=https://your-domain.com/callback  # HTTPS for Web Playback SDK

# Docker Configuration
DOCKER_CONTAINER=true
NODE_ENV=production
SESSION_SECRET=your_secure_random_string_here

# WSL2 User Permissions (auto-detected by setup-docker.sh)
APP_UID=1000
APP_GID=1000

# Cloudflare Tunnel Configuration (Environment-Specific)
CLOUDFLARED_TOKEN_DEV=your_dev_tunnel_token_here
CLOUDFLARED_TOKEN_TEST=your_test_tunnel_token_here
CLOUDFLARED_TOKEN_PROD=your_prod_tunnel_token_here
CLOUDFLARED_ENV=dev  # Active environment: dev/test/prod
```

#### Docker Commands

```bash
# Start services
make up

# View logs
make logs

# Check health
make health

# Restart services
make restart

# Stop services
make down

# Clean up (removes containers, volumes, images)
make clean

# Open shell in app container
make shell
```

#### Environment Switching

Switch between development, testing, and production environments:

```bash
# Switch to development environment
make dev

# Switch to testing environment
make test

# Switch to production environment
make prod

# Manual environment switching
./switch-env.sh dev   # or test/prod
```

#### Tunnel Control

Control Cloudflare tunnel traffic for demos and testing:

```bash
# Start tunnel (enable external access)
make tunnel-on

# Stop tunnel (disable external access)
make tunnel-off

# Check tunnel status
make health
```

#### Cloudflare Tunnel Setup

1. **Create Tunnel**:
   ```bash
   # Install cloudflared CLI
   # Follow: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/
   ```

2. **Get Token**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Create a new token with Tunnel permissions
   - Add token to `.env` as `CLOUDFLARED_TOKEN`

3. **Configure DNS**:
   - Point your domain to the tunnel
   - Update `SPOTIFY_REDIRECT_URI` to use HTTPS

#### Security Features

- **Non-root containers**: App runs as nodejs user (uid 1001)
- **Read-only filesystem**: Prevents unauthorized modifications
- **Dropped capabilities**: Removes unnecessary Linux capabilities
- **Secure secrets**: Environment variables for sensitive data
- **Isolated networks**: App and tunnel communicate via Docker network

#### WSL2 Optimization

- **File ownership**: Proper UID/GID mapping prevents permission issues
- **Volume mounts**: Database files persist with correct permissions
- **Hot reload**: Development mode with volume mounting
- **Resource sharing**: Seamless integration with Windows Docker Desktop

#### Troubleshooting Docker

**Services won't start**:
```bash
# Check logs
make logs

# Validate configuration
make config

# Check Docker daemon
docker ps
```

**Permission issues**:
```bash
# Re-run Docker setup
./setup-docker.sh

# Check file ownership
ls -la *.db
```

**Tunnel connection fails**:
```bash
# Verify token
echo $CLOUDFLARED_TOKEN

# Check tunnel logs
docker compose logs cloudflared
```

**Web Playback SDK issues**:
- Ensure HTTPS redirect URI in Spotify app settings
- Verify Cloudflare tunnel is providing HTTPS
- Check browser console for DRM/EME errors

### Traditional Production Deployment

For non-Docker deployment:
1. Set environment variables on your server
2. Use a process manager like PM2
3. Consider using a reverse proxy like nginx
4. Enable HTTPS for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.