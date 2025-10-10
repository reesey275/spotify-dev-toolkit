const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const querystring = require("query-string");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5500;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files with cache-busting for development
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, path) => {
    // Disable caching for development
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${port}/callback`;
const SPOTIFY_USERNAME = process.env.SPOTIFY_USERNAME;

// In-memory token storage (in production, use proper session management)
let accessToken = null;
let tokenExpiry = null;
let userAccessToken = null;
let userTokenExpiry = null;

// Helper function to get Spotify access token
async function getSpotifyToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 minute early
    return accessToken;
  } catch (error) {
    console.error('Error getting Spotify token:', error.message);
    throw new Error('Failed to authenticate with Spotify');
  }
}

// Helper function to make Spotify API requests
async function spotifyRequest(endpoint) {
  const token = await getSpotifyToken();
  const response = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
}

// Helper function to get user access token
async function getUserAccessToken() {
  if (userAccessToken && userTokenExpiry && Date.now() < userTokenExpiry) {
    return userAccessToken;
  }

  // If we have a username in env, try to get a token for that user
  if (SPOTIFY_USERNAME) {
    try {
      // For demo purposes, we'll use the username from env
      // In production, this would be a proper OAuth flow
      console.log(`Using configured user: ${SPOTIFY_USERNAME}`);
      return await getSpotifyToken(); // Fallback to client credentials
    } catch (error) {
      console.error('Error getting user token:', error.message);
      throw new Error('User authentication required');
    }
  }
  
  throw new Error('User authentication required');
}

// Routes

// Main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// OAuth login route
app.get("/login", (req, res) => {
  const scope = 'playlist-read-private playlist-read-collaborative user-read-private';
  const authURL = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    });
  
  res.redirect(authURL);
});

// OAuth callback route
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    userAccessToken = response.data.access_token;
    userTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
    
    res.redirect('/?authenticated=true');
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    res.status(500).send('Authentication failed');
  }
});

// API route to get current user's playlists
app.get("/api/my-playlists", async (req, res) => {
  try {
    const { sort, limit = 50 } = req.query;
    
    console.log(`🔍 Fetching playlists for user: ${SPOTIFY_USERNAME}`);
    
    // If we have a configured username, get their playlists
    if (SPOTIFY_USERNAME) {
      try {
        console.log(`📡 Making request to: /users/${SPOTIFY_USERNAME}/playlists?limit=${limit}`);
        let playlists = await spotifyRequest(`/users/${SPOTIFY_USERNAME}/playlists?limit=${limit}`);
        
        console.log(`✅ Found ${playlists.items.length} playlists for ${SPOTIFY_USERNAME}`);
        
        // Add creation date approximation and enhance playlist data
        const enhancedPlaylists = await Promise.all(
          playlists.items.map(async (playlist) => {
            try {
              // Get first track to approximate creation date
              const tracks = await spotifyRequest(`/playlists/${playlist.id}/tracks?limit=1`);
              const createdDate = tracks.items.length > 0 ? tracks.items[0].added_at : null;
              
              return {
                ...playlist,
                created_date: createdDate,
                track_count: playlist.tracks.total
              };
            } catch (error) {
              console.log(`⚠️  Could not get tracks for playlist ${playlist.name}: ${error.message}`);
              return {
                ...playlist,
                created_date: null,
                track_count: playlist.tracks.total
              };
            }
          })
        );

        // Sort playlists based on query parameter (format: field-direction)
        if (sort) {
          const [field, direction = 'asc'] = sort.split('-');
          const isDesc = direction === 'desc';
          
          if (field === 'date') {
            enhancedPlaylists.sort((a, b) => {
              const dateA = new Date(a.created_date || 0);
              const dateB = new Date(b.created_date || 0);
              const result = dateA - dateB;
              return isDesc ? -result : result;
            });
          } else if (field === 'tracks') {
            enhancedPlaylists.sort((a, b) => {
              const result = a.track_count - b.track_count;
              return isDesc ? -result : result;
            });
          } else if (field === 'name') {
            enhancedPlaylists.sort((a, b) => {
              const result = a.name.localeCompare(b.name);
              return isDesc ? -result : result;
            });
          }
        }

        res.json({
          playlists: enhancedPlaylists,
          total: enhancedPlaylists.length,
          username: SPOTIFY_USERNAME
        });
      } catch (error) {
        console.error("Error fetching user playlists:", error.message);
        res.status(500).json({ error: `Failed to fetch playlists for user ${SPOTIFY_USERNAME}. Please check if the username is correct.` });
      }
    } else {
      res.status(401).json({ 
        error: "No username configured. Please set SPOTIFY_USERNAME in your .env file or authenticate via OAuth.",
        needsAuth: true 
      });
    }
  } catch (error) {
    console.error("Error in my-playlists endpoint:", error.message);
    res.status(500).json({ error: "Failed to fetch your playlists" });
  }
});

// API route to get featured playlists (default home view)
app.get("/api/playlists", async (req, res) => {
  try {
    const { sort, limit = 20 } = req.query;
    
    let enhancedPlaylists = [];
    
    try {
      // Try to get featured playlists from Spotify
      let playlists = await spotifyRequest(`/browse/featured-playlists?limit=${limit}`);
      
      // Enhance playlist data
      enhancedPlaylists = playlists.playlists.items.map(playlist => ({
        ...playlist,
        track_count: playlist.tracks.total,
        created_date: null // Featured playlists don't have a creation date we can access
      }));
    } catch (featuredError) {
      console.log("Featured playlists not available, trying fallback...");
      
      // Fallback: Try to get playlists from Spotify's official account
      try {
        let fallbackPlaylists = await spotifyRequest(`/users/spotify/playlists?limit=${limit}`);
        enhancedPlaylists = fallbackPlaylists.items.map(playlist => ({
          ...playlist,
          track_count: playlist.tracks.total,
          created_date: null
        }));
        
        res.json({
          playlists: enhancedPlaylists,
          total: enhancedPlaylists.length,
          source: 'fallback',
          message: 'Spotify official playlists (featured playlists unavailable)'
        });
        return;
      } catch (fallbackError) {
        // If that also fails, create some mock data to show the UI works
        console.log("Fallback also failed, using demo data...");
        enhancedPlaylists = [
          {
            id: 'demo1',
            name: 'Demo Playlist 1',
            description: 'This is a demo playlist to show the interface',
            owner: { display_name: 'Demo User' },
            tracks: { total: 25 },
            track_count: 25,
            images: [],
            external_urls: { spotify: '#' },
            created_date: null
          },
          {
            id: 'demo2', 
            name: 'Demo Playlist 2',
            description: 'Another demo playlist',
            owner: { display_name: 'Demo User' },
            tracks: { total: 40 },
            track_count: 40,
            images: [],
            external_urls: { spotify: '#' },
            created_date: null
          }
        ];
        
        res.json({
          playlists: enhancedPlaylists,
          total: enhancedPlaylists.length,
          source: 'demo',
          message: 'Demo playlists (Spotify API unavailable)'
        });
        return;
      }
    }

    // Sort playlists based on query parameter (format: field-direction)
    if (sort) {
      const [field, direction = 'asc'] = sort.split('-');
      const isDesc = direction === 'desc';
      
      if (field === 'tracks') {
        enhancedPlaylists.sort((a, b) => {
          const result = a.track_count - b.track_count;
          return isDesc ? -result : result;
        });
      } else if (field === 'name') {
        enhancedPlaylists.sort((a, b) => {
          const result = a.name.localeCompare(b.name);
          return isDesc ? -result : result;
        });
      }
    }

    // Determine data source for frontend
    let dataSource = 'featured';
    let message = 'Featured playlists from Spotify';
    
    if (enhancedPlaylists.length > 0) {
      if (enhancedPlaylists[0].id === 'demo1') {
        dataSource = 'demo';
        message = 'Demo data - Spotify API unavailable';
      } else if (enhancedPlaylists[0].owner?.display_name === 'Spotify') {
        dataSource = 'fallback';
        message = 'Showing Spotify official playlists (fallback)';
      }
    }

    res.json({
      playlists: enhancedPlaylists,
      total: enhancedPlaylists.length,
      source: dataSource,
      message: message
    });
  } catch (error) {
    console.error("Error in playlists endpoint:", error.message);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// API route to get user's public playlists
app.get("/api/user/:userId/playlists", async (req, res) => {
  try {
    const { userId } = req.params;
    const { sort, limit = 50 } = req.query;
    
    // Get user's public playlists
    let playlists = await spotifyRequest(`/users/${userId}/playlists?limit=${limit}`);
    
    // Add creation date approximation and enhance playlist data
    const enhancedPlaylists = await Promise.all(
      playlists.items.map(async (playlist) => {
        try {
          // Get first track to approximate creation date
          const tracks = await spotifyRequest(`/playlists/${playlist.id}/tracks?limit=1`);
          const createdDate = tracks.items.length > 0 ? tracks.items[0].added_at : null;
          
          return {
            ...playlist,
            created_date: createdDate,
            track_count: playlist.tracks.total
          };
        } catch (error) {
          return {
            ...playlist,
            created_date: null,
            track_count: playlist.tracks.total
          };
        }
      })
    );

    // Sort playlists based on query parameter (format: field-direction)
    if (sort) {
      const [field, direction = 'asc'] = sort.split('-');
      const isDesc = direction === 'desc';
      
      if (field === 'date') {
        enhancedPlaylists.sort((a, b) => {
          const dateA = new Date(a.created_date || 0);
          const dateB = new Date(b.created_date || 0);
          const result = dateA - dateB;
          return isDesc ? -result : result;
        });
      } else if (field === 'tracks') {
        enhancedPlaylists.sort((a, b) => {
          const result = a.track_count - b.track_count;
          return isDesc ? -result : result;
        });
      } else if (field === 'name') {
        enhancedPlaylists.sort((a, b) => {
          const result = a.name.localeCompare(b.name);
          return isDesc ? -result : result;
        });
      }
    }

    res.json({
      playlists: enhancedPlaylists,
      total: enhancedPlaylists.length,
      source: 'featured',
      message: 'Spotify featured playlists'
    });
  } catch (error) {
    console.error("Error fetching user playlists:", error.message);
    res.status(500).json({ error: "Failed to fetch user playlists. Make sure the username is correct and the user has public playlists." });
  }
});

// API route to get user information
app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await spotifyRequest(`/users/${userId}`);
    
    res.json({
      id: user.id,
      display_name: user.display_name,
      followers: user.followers.total,
      images: user.images,
      external_urls: user.external_urls
    });
  } catch (error) {
    console.error("Error fetching user info:", error.message);
    res.status(500).json({ error: "User not found or profile is private" });
  }
});

// API route to get playlist details and tracks
app.get("/api/playlist/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { sort, offset = 0, limit = 50 } = req.query;
    
    // Get playlist info first
    const playlistInfo = await spotifyRequest(`/playlists/${id}?fields=id,name,description,owner,tracks.total,images,external_urls`);
    
    let allTracks = [];
    const requestedLimit = parseInt(limit);
    const requestedOffset = parseInt(offset);
    
    // If requesting a large number of tracks, make multiple API calls
    if (requestedLimit > 50) {
      console.log(`🔄 Fetching ${requestedLimit} tracks for playlist ${playlistInfo.name} (making multiple API calls)`);
      
      const maxApiLimit = 50; // Spotify API max limit per request
      let currentOffset = requestedOffset;
      let remainingTracks = requestedLimit;
      
      while (remainingTracks > 0 && currentOffset < playlistInfo.tracks.total) {
        const batchLimit = Math.min(remainingTracks, maxApiLimit);
        console.log(`📡 Fetching batch: offset=${currentOffset}, limit=${batchLimit}`);
        
        const batchData = await spotifyRequest(`/playlists/${id}/tracks?offset=${currentOffset}&limit=${batchLimit}`);
        const batchTracks = batchData.items.filter(item => item.track && item.track.id);
        
        allTracks = allTracks.concat(batchTracks);
        
        currentOffset += batchLimit;
        remainingTracks -= batchTracks.length;
        
        // If we got fewer tracks than requested in this batch, we've reached the end
        if (batchTracks.length < batchLimit) break;
      }
      
      console.log(`✅ Fetched ${allTracks.length} tracks total`);
    } else {
      // Single API call for normal requests
      const tracksData = await spotifyRequest(`/playlists/${id}/tracks?offset=${offset}&limit=${limit}`);
      allTracks = tracksData.items.filter(item => item.track && item.track.id);
    }

    let tracks = allTracks;

    // Sort tracks based on query parameter (format: field-direction)
    if (sort) {
      const [field, direction = 'asc'] = sort.split('-');
      const isDesc = direction === 'desc';
      
      if (field === 'date') {
        tracks.sort((a, b) => {
          const dateA = new Date(a.added_at);
          const dateB = new Date(b.added_at);
          return isDesc ? dateB - dateA : dateA - dateB;
        });
      } else if (field === 'name') {
        tracks.sort((a, b) => {
          const result = a.track.name.localeCompare(b.track.name);
          return isDesc ? -result : result;
        });
      } else if (field === 'artist') {
        tracks.sort((a, b) => {
          const artistA = a.track.artists[0]?.name || '';
          const artistB = b.track.artists[0]?.name || '';
          const result = artistA.localeCompare(artistB);
          return isDesc ? -result : result;
        });
      } else if (field === 'album') {
        tracks.sort((a, b) => {
          const albumA = a.track.album?.name || '';
          const albumB = b.track.album?.name || '';
          const result = albumA.localeCompare(albumB);
          return isDesc ? -result : result;
        });
      } else if (field === 'duration') {
        tracks.sort((a, b) => {
          const result = a.track.duration_ms - b.track.duration_ms;
          return isDesc ? -result : result;
        });
      } else if (field === 'track') {
        tracks.sort((a, b) => {
          const trackA = a.track.track_number || 0;
          const trackB = b.track.track_number || 0;
          const result = trackA - trackB;
          return isDesc ? -result : result;
        });
      } else if (field === 'popularity') {
        tracks.sort((a, b) => {
          const popA = a.track.popularity || 0;
          const popB = b.track.popularity || 0;
          const result = popA - popB;
          return isDesc ? -result : result;
        });
      }
    }

    // Format tracks for frontend
    const formattedTracks = tracks.map((item, index) => ({
      id: item.track.id,
      name: item.track.name,
      artists: item.track.artists.map(artist => artist.name),
      album: item.track.album.name,
      duration_ms: item.track.duration_ms,
      duration: formatDuration(item.track.duration_ms),
      added_at: item.added_at,
      preview_url: item.track.preview_url,
      external_urls: item.track.external_urls,
      image: item.track.album.images?.[0]?.url,
      track_number: index + 1 + parseInt(offset)
    }));

    // Determine if there are more tracks available
    const hasNext = (requestedOffset + tracks.length) < playlistInfo.tracks.total;
    
    res.json({
      playlist: {
        id: playlistInfo.id,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner?.display_name || 'Unknown',
        total_tracks: playlistInfo.tracks.total,
        image: playlistInfo.images?.[0]?.url,
        external_urls: playlistInfo.external_urls
      },
      tracks: formattedTracks,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: playlistInfo.tracks.total,
        next: hasNext,
        previous: parseInt(offset) > 0
      }
    });
  } catch (error) {
    console.error("Error fetching playlist:", error.message);
    res.status(500).json({ error: "Failed to fetch playlist details" });
  }
});

// API route to search playlists
app.get("/api/search", async (req, res) => {
  try {
    const { q, type = 'playlist', limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchResults = await spotifyRequest(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`);
    
    res.json(searchResults);
  } catch (error) {
    console.error("Error searching:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// API route to get featured playlists
app.get("/api/featured", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const featuredPlaylists = await spotifyRequest(`/browse/featured-playlists?limit=${limit}`);
    
    res.json(featuredPlaylists);
  } catch (error) {
    console.error("Error fetching featured playlists:", error.message);
    res.status(500).json({ error: "Failed to fetch featured playlists" });
  }
});

// Helper function to format duration
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start the server with better error handling
const server = app.listen(port, () => {
  console.log(`🎵 Spotify Fan Website running at http://localhost:${port}`);
  console.log(`🔧 API endpoints available at http://localhost:${port}/api/`);
  console.log(`👀 Nodemon is watching for changes - edit any file and see instant updates!`);
  
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.warn("⚠️  Warning: Spotify credentials not found. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file");
  }
  
  if (SPOTIFY_USERNAME) {
    console.log(`👤 Configured user: ${SPOTIFY_USERNAME}`);
    console.log(`🎵 Your playlists will be available at: http://localhost:${port}/api/my-playlists`);
  }
});

// Handle server errors (like EADDRINUSE)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${port} is already in use. Please use 'npm run clean-start' to restart properly.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
