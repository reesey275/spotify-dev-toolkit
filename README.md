# 🎵 Spotify Fan Website

A modern, interactive web application for exploring and managing Spotify playlists with dynamic sorting, filtering, and user-friendly features.

## ✨ Features

- **Dynamic Playlist Views**: Switch between Featured, Top 10, Recent, User Search, and Playlist Search views
- **User Discovery**: Search for any Spotify user's public playlists by username
- **Smart Sorting**: Sort playlists by name, date created, or track count
- **Track Management**: View detailed track information with sortable columns
- **Responsive Design**: Modern, Spotify-inspired UI that works on all devices
- **Real-time Search**: Search for playlists across Spotify
- **User Profiles**: View user information including follower counts and profile pictures
- **Pagination**: Navigate through large playlists efficiently
- **Interactive Elements**: Click tracks to open in Spotify

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Spotify Developer Account

### 1. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Note your `Client ID` and `Client Secret`
4. Add `http://localhost:5500/callback` to your app's redirect URIs

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:5500/callback
   SPOTIFY_USER_ID=your_spotify_username
   PORT=5500
   ```

### 3. Installation & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   
   Or start the production server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:5500`

## 📁 Project Structure

```
spotify-fan-website/
├── public/                 # Static frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles
│   ├── script.js          # Frontend JavaScript
│   └── sw.js             # Service Worker
├── server.js              # Express server with API endpoints
├── export_spotify_playlist.py  # Python export tool
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (create from .env.example)
├── .env.example          # Environment template
└── README.md             # This file
```

## 🔧 API Endpoints

- `GET /api/playlists` - Get user playlists with sorting options
- `GET /api/playlist/:id` - Get playlist details and tracks
- `GET /api/search` - Search for playlists
- `GET /api/featured` - Get featured playlists

### Query Parameters

- `sort`: Sort by `name`, `date`, or `tracks`
- `limit`: Number of results to return
- `offset`: Pagination offset

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

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for auto-reloading when files change.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app client secret | Yes |
| `SPOTIFY_REDIRECT_URI` | Redirect URI for OAuth | No |
| `SPOTIFY_USER_ID` | Default user ID for demo | No |
| `PORT` | Server port | No |

## 🚧 Troubleshooting

### Common Issues

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

For production deployment:
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