const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const querystring = require("querystring");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const crypto = require("crypto");
const { z } = require("zod");
require("dotenv").config();

// Database for caching
const { cachePlaylists, getCachedPlaylists, fromApi } = require('./db');

// Config validation - ensure required environment variables are set
const requiredEnvVars = [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error("Please check your .env file and ensure all required variables are set.");
    process.exit(1);
  }
}

// PKCE utilities
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Token management helpers
function saveTokens(req, { access_token, refresh_token, expires_in }) {
  const early = 60_000; // refresh 60s early
  req.session.tokens = {
    access_token,
    refresh_token: refresh_token ?? req.session.tokens?.refresh_token, // rotate if present
    expires_at: Date.now() + (expires_in * 1000) - early,
  };
  logToken('save', req);
}

function isFresh(req) {
  const t = req.session?.tokens;
  return !!t && typeof t.expires_at === "number" && (Date.now() + 30_000) < t.expires_at;
}

async function refreshAccessToken(req) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const rt = req.session?.tokens?.refresh_token;
  if (!rt) {
    const e = new Error("No refresh token");
    e.status = 401;
    throw e;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: rt,
  }).toString();

  const { data } = await axios.post(
    "https://accounts.spotify.com/api/token",
    body,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: SPOTIFY_CLIENT_ID, password: SPOTIFY_CLIENT_SECRET },
    }
  );

  // Spotify may omit a new refresh_token; keep the old one
  saveTokens(req, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || rt,
    expires_in: data.expires_in,
  });
  logToken('refresh', req);
  return req.session.tokens.access_token;
}

// Logging setup
const pino = require("pino");
const logger = pino(pino.destination("server.log"));

function logToken(evt, req) {
  const t = req.session?.tokens;
  logger.info({
    evt,
    has_rt: !!t?.refresh_token,
    exp_in_s: t ? Math.round((t.expires_at - Date.now())/1000) : null,
  }, "token_event");
}

// Input validation schemas
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

const sortSchema = z.enum(['name', 'date', 'tracks', 'artist', 'album', 'duration', 'track', 'popularity']).optional();

const playlistIdSchema = z.string().regex(/^[a-zA-Z0-9]{22}$/, "Invalid Spotify playlist ID");

const userIdSchema = z.string().min(1).max(50);

const searchSchema = z.object({
  q: z.string().min(1).max(100).trim(),
  type: z.enum(['playlist', 'album', 'artist', 'track']).default('playlist'),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const app = express();
const port = process.env.PORT || 5500;

// Session configuration
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Security and performance middlewares
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for now
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.spotify.com", "https://accounts.spotify.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  } : false, // Disable CSP for development
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production' ? { policy: "same-origin" } : false, // Disable COOP for development
  crossOriginResourcePolicy: process.env.NODE_ENV === 'production' ? { policy: "same-origin" } : false, // Disable CORP for development
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
    },
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

app.use(cors({
  origin: [`http://127.0.0.1:${port}`, "http://127.0.0.1:5173"], // Allow current port and common dev ports
  credentials: true
}));

// Route-specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: 900
  },
  skipSuccessfulRequests: true // Don't count successful auth
});

const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 300, // 300 API requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: 60
  }
});

const searchLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 60, // 60 search requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many search requests, please try again later.",
    retryAfter: 60
  }
});

// Middleware
app.use(express.json({ limit: '10mb' })); // Add payload size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${port}/callback`;
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

// Simplified Spotify API request function
// Simplified Spotify API request function with retry/backoff for 429s and refresh handling for 401
async function spotifyRequest(endpoint, req = null, method = 'GET', data = null, attempts = 0) {
  const max429Retries = 3;
  try {
    let token;

    // Use user token from session if available, otherwise client credentials
    if (req && req.session && req.session.tokens) {
      token = await getUserAccessToken(req);
    } else {
      token = await getSpotifyToken();
    }

    const config = {
      method,
      url: `https://api.spotify.com/v1${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    // If Spotify returned a response, inspect status
    if (error.response) {
      const status = error.response.status;
      const respData = error.response.data;
      console.error('Spotify API error:', { status, data: respData });

      // Rate limit - retry after indicated time (Retry-After header or exponential backoff)
      if (status === 429) {
        const retryAfterHeader = error.response.headers && (error.response.headers['retry-after'] || error.response.headers['Retry-After']);
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

        if (attempts < max429Retries) {
          const waitMs = retryAfterSec ? (retryAfterSec * 1000) : Math.min(1000 * Math.pow(2, attempts), 5000);
          console.warn(`Rate limited by Spotify (429). Waiting ${waitMs}ms before retrying (attempt ${attempts + 1}/${max429Retries})`);
          await new Promise(r => setTimeout(r, waitMs));
          return spotifyRequest(endpoint, req, method, data, attempts + 1);
        }

        const e = new Error(`Spotify API rate limit exceeded after ${max429Retries} retries`);
        e.status = 429;
        throw e;
      }

      // Unauthorized - try refreshing user token once
      if (status === 401 && req && req.session) {
        try {
          console.log('🔄 Token expired, attempting refresh...');
          await refreshAccessToken(req);
          return await spotifyRequest(endpoint, req, method, data, attempts + 1);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
          // Clear invalid session data
          delete req.session.tokens;
          const e = new Error('Authentication expired - please re-authenticate');
          e.status = 401;
          throw e;
        }
      }

      // Surface a helpful error for callers
      const e = new Error(`Spotify API error: ${status} - ${JSON.stringify(respData)}`);
      e.status = status;
      throw e;
    }

    // Network or other errors
    console.error('Spotify request error:', error.message);
    throw error;
  }
}



// Helper function to get user access token from session
async function getUserAccessToken(req) {
  // Check if we have a valid access token in session
  if (req.session.tokens && req.session.tokens.access_token && isFresh(req)) {
    return req.session.tokens.access_token;
  }

  // If we have a refresh token, try to refresh
  if (req.session.tokens && req.session.tokens.refresh_token) {
    return await refreshAccessToken(req);
  }

  throw new Error('User authentication required');
}

// Health check endpoint
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0"
  });
});

// Routes

// Main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// OAuth login route with PKCE and state
app.get("/login", authLimiter, (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  
  // Store PKCE verifier and state in session
  req.session.codeVerifier = codeVerifier;
  req.session.oauthState = state;
  
  // Include playback-related scopes required by the Web Playback SDK
  const scope = 'playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private streaming user-read-playback-state user-read-currently-playing user-modify-playback-state user-read-private user-read-email';
  const authURL = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });
  
  res.redirect(authURL);
});

// OAuth callback route with state validation and PKCE
app.get("/callback", authLimiter, async (req, res) => {
  const { code, state, error } = req.query;
  
  console.log('OAuth callback received:', { code: !!code, state, error });
  console.log('Session state:', req.session.oauthState);
  console.log('Session ID:', req.session.id);
  console.log('Session before token exchange:', {
    hasAccessToken: !!req.session.accessToken,
    hasRefreshToken: !!req.session.refreshToken,
    hasTokenExpiry: !!req.session.tokenExpiry
  });
  
  // Check for OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return res.status(400).send(`Authentication failed: ${error}`);
  }
  
  // Validate state parameter
  if (!state || state !== req.session.oauthState) {
    console.error('OAuth state mismatch - possible CSRF attack');
    console.error('Expected state:', req.session.oauthState);
    console.error('Received state:', state);
    return res.status(400).send('Invalid state parameter');
  }
  
  // Validate code presence
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }
  
  // Validate PKCE verifier
  if (!req.session.codeVerifier) {
    return res.status(400).send('PKCE verifier missing from session');
  }
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: req.session.codeVerifier
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    // Store tokens securely in session (not in memory)
    saveTokens(req, {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in
    });
    
    console.log('Token exchange successful, session after:', {
      hasTokens: !!req.session.tokens,
      hasAccessToken: !!req.session.tokens?.access_token,
      hasRefreshToken: !!req.session.tokens?.refresh_token,
      hasExpiry: !!req.session.tokens?.expires_at,
      expiresAt: req.session.tokens?.expires_at ? new Date(req.session.tokens.expires_at).toISOString() : null,
      sessionID: req.session.id
    });
    
    // Clear OAuth session data
    delete req.session.codeVerifier;
    delete req.session.oauthState;
    
    res.redirect('/?authenticated=true');
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    res.status(500).send('Authentication failed');
  }
});

// Logout route
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// API route to get current user's playlists
app.get("/api/my-playlists", apiLimiter, async (req, res) => {
  try {
    // Validate and sanitize input
    const { limit = 50, sort } = paginationSchema.extend({
      sort: z.string().optional()
    }).parse(req.query);
    
    // Check if user is authenticated via OAuth first
    if (req.session?.tokens?.access_token) {
      try {
        console.log('🔍 Fetching playlists for authenticated OAuth user');
        
        // Get user info first to get their Spotify ID for caching
        const user = await spotifyRequest('/me', req);
        const userId = user.id;
        
        // Check cache first for this user's playlists
        const cachedPlaylists = getCachedPlaylists('user', userId);
        if (cachedPlaylists.length > 0) {
          console.log(`✅ Returning cached playlists for user ${userId}`);
          return res.json({
            playlists: cachedPlaylists,
            total: cachedPlaylists.length,
            username: user.display_name || userId,
            authenticated: true,
            source: 'cache'
          });
        }
        
        // Cache miss - fetch from Spotify API
        let playlists = await spotifyRequest('/me/playlists?limit=' + limit, req);
        
        console.log(`✅ Found ${playlists.items.length} playlists for authenticated user`);
        
        // Add creation date approximation and enhance playlist data
        // Be careful to avoid Spotify rate limits: process playlists with limited concurrency / slight delay
        const enhancedPlaylists = [];
        for (const playlist of playlists.items) {
          try {
            // Get first track to approximate creation date
            const tracks = await spotifyRequest(`/playlists/${playlist.id}/tracks?limit=1`, req);
            const createdDate = tracks.items.length > 0 ? tracks.items[0].added_at : null;

            enhancedPlaylists.push(fromApi({
              ...playlist,
              created_date: createdDate
            }));
          } catch (error) {
            console.log(`⚠️  Could not get tracks for playlist ${playlist.name}: ${error.message}`);
            enhancedPlaylists.push(fromApi({
              ...playlist,
              created_date: null
            }));
          }

          // Small delay between requests to reduce chance of hitting rate limits
          await new Promise(r => setTimeout(r, 200));
        }

        // Cache the user's playlists
        cachePlaylists(enhancedPlaylists, 'user', userId);
        console.log(`💾 Cached ${enhancedPlaylists.length} playlists for user ${userId}`);

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

        // Get user info for the username
        const currentUser = await spotifyRequest('/me', req);
        
        res.json({
          playlists: enhancedPlaylists,
          total: enhancedPlaylists.length,
          username: user.display_name || user.id,
          authenticated: true
        });
        return;
      } catch (error) {
        console.error("Error fetching authenticated user playlists:", error.message);
        // If authentication failed, clear session and return 401
        if (error.status === 401) {
          delete req.session.tokens;
          return res.status(401).json({ 
            error: "Authentication expired", 
            message: "Please log in again to continue.",
            needsAuth: true 
          });
        }
        // If OAuth fails, fall back to configured user
      }
    }
    
    // Fallback: Use configured username if no OAuth authentication
    if (SPOTIFY_USERNAME) {
      // Check cache first
      const cachedPlaylists = getCachedPlaylists('my', SPOTIFY_USERNAME);
      if (cachedPlaylists.length > 0) {
        console.log('✅ Returning cached my playlists');
        return res.json({
          playlists: cachedPlaylists,
          total: cachedPlaylists.length,
          username: SPOTIFY_USERNAME,
          authenticated: false
        });
      }

      try {
        console.log(`� Fetching playlists for configured user: ${SPOTIFY_USERNAME}`);
        
        let playlists = await spotifyRequest(`/users/${SPOTIFY_USERNAME}/playlists?limit=${limit}`, req);
        
        console.log(`✅ Found ${playlists.items.length} playlists for ${SPOTIFY_USERNAME}`);
        
        // Add creation date approximation and enhance playlist data
        const enhancedPlaylists = await Promise.all(
          playlists.items.map(async (playlist) => {
            try {
              // Get first track to approximate creation date
              const tracks = await spotifyRequest(`/playlists/${playlist.id}/tracks?limit=1`, req);
              const createdDate = tracks.items.length > 0 ? tracks.items[0].added_at : null;
              
              return fromApi({
                ...playlist,
                created_date: createdDate
              });
            } catch (error) {
              console.log(`⚠️  Could not get tracks for playlist ${playlist.name}: ${error.message}`);
              return fromApi({
                ...playlist,
                created_date: null
              });
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

        // Cache the playlists
        cachePlaylists(enhancedPlaylists, 'my', SPOTIFY_USERNAME);

        res.json({
          playlists: enhancedPlaylists,
          total: enhancedPlaylists.length,
          username: SPOTIFY_USERNAME,
          authenticated: false
        });
      } catch (error) {
        console.error("Error fetching configured user playlists:", error.message);
        res.status(500).json({ error: `Failed to fetch playlists for user ${SPOTIFY_USERNAME}. Please check if the username is correct.` });
      }
    } else {
      res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in with Spotify to view your playlists.",
        needsAuth: true 
      });
    }
  } catch (error) {
    console.error("Error in my-playlists endpoint:", error.message);
    res.status(500).json({ error: "Failed to fetch your playlists" });
  }
});

// API route to get currently playing track
app.get("/api/currently-playing", apiLimiter, async (req, res) => {
  try {
    console.log('🎵 Fetching currently playing track...');
    
    // Check if user is authenticated
    if (!req.session?.tokens?.access_token) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in to view currently playing track" 
      });
    }
    
    // Get currently playing track from Spotify
    const currentlyPlaying = await spotifyRequest('/me/player/currently-playing', req);
    
    if (!currentlyPlaying) {
      return res.json({
        is_playing: false,
        message: "No track currently playing"
      });
    }
    
    // Enhance the response with additional track details
    const enhancedTrack = {
      is_playing: currentlyPlaying.is_playing,
      progress_ms: currentlyPlaying.progress_ms,
      item: currentlyPlaying.item ? {
        id: currentlyPlaying.item.id,
        name: currentlyPlaying.item.name,
        artists: currentlyPlaying.item.artists.map(artist => ({
          id: artist.id,
          name: artist.name
        })),
        album: {
          id: currentlyPlaying.item.album.id,
          name: currentlyPlaying.item.album.name,
          images: currentlyPlaying.item.album.images
        },
        duration_ms: currentlyPlaying.item.duration_ms,
        external_urls: currentlyPlaying.item.external_urls,
        preview_url: currentlyPlaying.item.preview_url
      } : null,
      context: currentlyPlaying.context
    };
    
    console.log(`✅ Currently playing: ${enhancedTrack.item?.name || 'Nothing'} by ${enhancedTrack.item?.artists?.[0]?.name || 'Unknown'}`);
    
    res.json(enhancedTrack);
    
  } catch (error) {
    console.error("Error in currently-playing endpoint:", error.message);
    
    // Handle authentication errors
    if (error.status === 401) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "Please log in to view currently playing track" 
      });
    }
    
    // If it's a 204 (no content) or 404 (not found) from Spotify, the user isn't playing anything
    if (error.response && (error.response.status === 204 || error.response.status === 404)) {
      return res.json({
        is_playing: false,
        message: "No track currently playing"
      });
    }
    
    res.status(500).json({ error: "Failed to fetch currently playing track" });
  }
});

// API route to get access token for Web Playback SDK
app.get("/api/access-token", apiLimiter, async (req, res) => {
  try {
    console.log('🔑 Getting access token for Web Playback SDK...');
    console.log('Session in /api/access-token:', {
      sessionID: req.session.id,
      hasTokens: !!req.session.tokens,
      hasAccessToken: !!req.session.tokens?.access_token,
      hasRefreshToken: !!req.session.tokens?.refresh_token,
      hasExpiry: !!req.session.tokens?.expires_at,
      expiresAt: req.session.tokens?.expires_at ? new Date(req.session.tokens.expires_at).toISOString() : null,
      currentTime: new Date().toISOString()
    });
    
    let token = req.session?.tokens?.access_token;
    if (!isFresh(req)) token = await refreshAccessToken(req);
    
    if (!token) {
      console.log('❌ No access token available');
      return res.status(401).json({ error: "No access token available" });
    }
    
    console.log('✅ Token is valid, returning it');
    
    // Check if token has required scopes for Web Playback SDK
    const requiredScopes = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'];
    console.log('🔍 Checking token scopes for Web Playback SDK...');
    
    try {
      // Try to make a test API call that requires the scopes
      const testResponse = await spotifyRequest('/me/player/devices', req);
      console.log('✅ Token has sufficient scopes for Web Playback SDK (devices endpoint accessible)');
      res.json({ access_token: token });
    } catch (scopeError) {
      console.error('❌ Token missing required scopes for Web Playback SDK:', scopeError.message);
      console.error('Required scopes:', requiredScopes.join(', '));
      console.error('🔄 User needs to re-authenticate to grant new scopes');
      
      // Clear the session to force re-authentication
      delete req.session.tokens;
      
      return res.status(403).json({ 
        error: "Insufficient token scopes", 
        message: "Web Playback SDK requires additional permissions. Please log in again to grant the necessary scopes.",
        needsReauth: true,
        requiredScopes: requiredScopes
      });
    }
    
  } catch (error) {
    console.error("Error getting access token:", error.message);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

// API route to check user profile and Premium status
app.get("/api/user-profile", apiLimiter, async (req, res) => {
  try {
    console.log('👤 Getting user profile for Premium check...');
    
    // Get user profile from Spotify
    const userProfile = await spotifyRequest('/me', req);
    
    console.log('User profile:', {
      id: userProfile.id,
      display_name: userProfile.display_name,
      product: userProfile.product,
      country: userProfile.country
    });
    
    res.json({
      id: userProfile.id,
      display_name: userProfile.display_name,
      product: userProfile.product, // 'premium', 'free', etc.
      country: userProfile.country,
      has_premium: userProfile.product === 'premium'
    });
    
  } catch (error) {
    console.error("Error getting user profile:", error.message);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// API route to get available playback devices
app.get("/api/devices", apiLimiter, async (req, res) => {
  try {
    console.log('📱 Getting available playback devices...');
    
    // Get available devices from Spotify
    const devices = await spotifyRequest('/me/player/devices', req);
    
    console.log('Available devices:', devices.devices?.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      is_active: d.is_active
    })));
    
    res.json(devices);
    
  } catch (error) {
    console.error("Error getting devices:", error.message);
    res.status(500).json({ error: "Failed to get devices" });
  }
});

// API route to transfer playback to web player
app.put("/api/transfer-playback", apiLimiter, async (req, res) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: "Device ID required" });
    }
    
    console.log(`🎵 Transferring playback to device: ${device_id}`);
    
    // Transfer playback to the web player
    try {
      await spotifyRequest('/me/player', req, 'PUT', {
        device_ids: [device_id],
        play: false // Don't start playing immediately
      });

      res.json({ success: true });
    } catch (err) {
      // If Spotify reports device not found, forward a 404 so client can retry/help the user
      if (err && err.status === 404) {
        console.warn('Transfer playback failed: device not found', { device_id });
        return res.status(404).json({ error: 'Device not found', message: 'The requested playback device was not found. Ensure the web player has connected and try again.' });
      }
      throw err;
    }
    
  } catch (error) {
    console.error("Error transferring playback:", error.message);
    res.status(500).json({ error: "Failed to transfer playback" });
  }
});

// API route to get featured playlists (default home view)
app.get("/api/playlists", apiLimiter, async (req, res) => {
  try {
    const { sort, limit = 20 } = req.query;
    
    // Check cache first
    const cachedPlaylists = getCachedPlaylists('featured');
    if (cachedPlaylists.length > 0) {
      console.log('✅ Returning cached featured playlists');
      return res.json({
        playlists: cachedPlaylists,
        total: cachedPlaylists.length,
        source: 'cache',
        message: 'Cached featured playlists'
      });
    }
    
    let enhancedPlaylists = [];
    
    try {
      // Try to get featured playlists from Spotify
      let playlists = await spotifyRequest(`/browse/featured-playlists?limit=${limit}`);
      
      // Enhance playlist data
      enhancedPlaylists = playlists.playlists.items.map(fromApi);
    } catch (featuredError) {
      console.log("Featured playlists not available, trying fallback...");
      
      // Fallback: Try to get playlists from Spotify's official account
      try {
        let fallbackPlaylists = await spotifyRequest(`/users/spotify/playlists?limit=${limit}`);
        enhancedPlaylists = fallbackPlaylists.items.map(fromApi);
        
        // Cache the fallback playlists
        cachePlaylists(enhancedPlaylists, 'featured');
        
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
        const demoData = [
          {
            id: 'demo1',
            name: 'Demo Playlist 1',
            description: 'This is a demo playlist to show the interface',
            owner: { display_name: 'Demo User' },
            tracks: { total: 25 },
            images: [],
            external_urls: { spotify: '#' },
            public: true,
            collaborative: false,
            followers: { total: 0 }
          },
          {
            id: 'demo2', 
            name: 'Demo Playlist 2',
            description: 'Another demo playlist',
            owner: { display_name: 'Demo User' },
            tracks: { total: 40 },
            images: [],
            external_urls: { spotify: '#' },
            public: true,
            collaborative: false,
            followers: { total: 0 }
          }
        ];
        enhancedPlaylists = demoData.map(fromApi);
        
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

    // Cache the playlists
    cachePlaylists(enhancedPlaylists, 'featured');

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
app.get("/api/user/:userId/playlists", apiLimiter, async (req, res) => {
  try {
    const { userId } = z.object({ userId: userIdSchema }).parse(req.params);
    const { limit, sort } = paginationSchema.extend({
      sort: z.string().optional()
    }).parse(req.query);
    
    // Get user's public playlists
    let playlists = await spotifyRequest(`/users/${userId}/playlists?limit=${limit}`, req);
    
    // Add creation date approximation and enhance playlist data
    // Process playlists sequentially with a small delay to avoid API rate limits
    const enhancedPlaylists = [];
    for (const playlist of playlists.items) {
      try {
        const tracks = await spotifyRequest(`/playlists/${playlist.id}/tracks?limit=1`, req);
        const createdDate = tracks.items.length > 0 ? tracks.items[0].added_at : null;
        enhancedPlaylists.push(fromApi({
          ...playlist,
          created_date: createdDate
        }));
      } catch (error) {
        enhancedPlaylists.push(fromApi({
          ...playlist,
          created_date: null
        }));
      }
      await new Promise(r => setTimeout(r, 200));
    }

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
app.get("/api/user/:userId", apiLimiter, async (req, res) => {
  try {
    const { userId } = z.object({ userId: userIdSchema }).parse(req.params);
    
    const user = await spotifyRequest(`/users/${userId}`, req);
    
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
app.get("/api/playlist/:id", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);
    const { sort, offset = 0, limit = 50 } = paginationSchema.extend({
      sort: z.string().optional()
    }).parse(req.query);
    
    // Get playlist info first
    const playlistInfo = await spotifyRequest(`/playlists/${id}?fields=id,name,description,owner,tracks.total,images,external_urls`, req);
    
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
        
        const batchData = await spotifyRequest(`/playlists/${id}/tracks?offset=${currentOffset}&limit=${batchLimit}`, req);
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
      const tracksData = await spotifyRequest(`/playlists/${id}/tracks?offset=${offset}&limit=${limit}`, req);
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
app.get("/api/search", searchLimiter, async (req, res) => {
  try {
    const { q, type = 'playlist', limit = 20 } = searchSchema.parse(req.query);
    
    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchResults = await spotifyRequest(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`, req);
    
    res.json(searchResults);
  } catch (error) {
    console.error("Error searching:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// API route to get featured playlists
app.get("/api/featured", apiLimiter, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const featuredPlaylists = await spotifyRequest(`/browse/featured-playlists?limit=${limit}`);
    
    res.json(featuredPlaylists);
  } catch (error) {
    console.error("Error fetching featured playlists:", error.message);
    res.status(500).json({ error: "Failed to fetch featured playlists" });
  }
});

// Playlist Management Endpoints

// Create a new playlist
app.post("/api/playlists", apiLimiter, async (req, res) => {
  try {
    const { name, description, public: isPublic } = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(300).optional(),
      public: z.boolean().optional()
    }).parse(req.body);

    // Get current user ID first
    const user = await spotifyRequest('/me', req);

    const playlistData = {
      name,
      description: description || '',
      public: isPublic !== false // Default to public
    };

    const newPlaylist = await spotifyRequest(`/users/${user.id}/playlists`, req, 'POST', playlistData);

    res.json({
      id: newPlaylist.id,
      name: newPlaylist.name,
      description: newPlaylist.description,
      public: newPlaylist.public,
      owner: newPlaylist.owner,
      tracks: { total: 0 },
      external_urls: newPlaylist.external_urls
    });
  } catch (error) {
    console.error("Error creating playlist:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth') || error.message.includes('expired')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

// Update playlist details
app.put("/api/playlists/:id", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);
    const { name, description, public: isPublic } = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(300).optional(),
      public: z.boolean().optional()
    }).parse(req.body);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.public = isPublic;

    await spotifyRequest(`/playlists/${id}`, req, 'PUT', updateData);

    res.json({ success: true, message: "Playlist updated successfully" });
  } catch (error) {
    console.error("Error updating playlist:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

// Delete/unfollow playlist
app.delete("/api/playlists/:id", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);

    // Get current user ID to check ownership
    const user = await spotifyRequest('/me', req);

    // Try to unfollow the playlist (works for both owned and followed playlists)
    await spotifyRequest(`/playlists/${id}/followers`, req, 'DELETE');

    res.json({ success: true, message: "Playlist removed successfully" });
  } catch (error) {
    console.error("Error deleting playlist:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// Add tracks to playlist
app.post("/api/playlists/:id/tracks", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);
    const { uris, position } = z.object({
      uris: z.array(z.string().regex(/^spotify:track:/)).min(1).max(100),
      position: z.number().min(0).optional()
    }).parse(req.body);

    const data = { uris };
    if (position !== undefined) data.position = position;

    const result = await spotifyRequest(`/playlists/${id}/tracks`, req, 'POST', data);

    res.json({
      success: true,
      added: uris.length,
      snapshot_id: result.snapshot_id
    });
  } catch (error) {
    console.error("Error adding tracks:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to add tracks to playlist" });
  }
});

// Remove tracks from playlist
app.delete("/api/playlists/:id/tracks", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);
    const { uris } = z.object({
      uris: z.array(z.string().regex(/^spotify:track:/)).min(1).max(100)
    }).parse(req.body);

    const data = {
      tracks: uris.map(uri => ({ uri }))
    };

    const result = await spotifyRequest(`/playlists/${id}/tracks`, req, 'DELETE', data);

    res.json({
      success: true,
      removed: uris.length,
      snapshot_id: result.snapshot_id
    });
  } catch (error) {
    console.error("Error removing tracks:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to remove tracks from playlist" });
  }
});

// Reorder tracks in playlist
app.put("/api/playlists/:id/tracks", apiLimiter, async (req, res) => {
  try {
    const { id } = z.object({ id: playlistIdSchema }).parse(req.params);
    const { range_start, insert_before, range_length } = z.object({
      range_start: z.number().min(0),
      insert_before: z.number().min(0),
      range_length: z.number().min(1).optional()
    }).parse(req.body);

    const data = {
      range_start,
      insert_before,
      range_length: range_length || 1
    };

    const result = await spotifyRequest(`/playlists/${id}/tracks`, req, 'PUT', data);

    res.json({
      success: true,
      snapshot_id: result.snapshot_id
    });
  } catch (error) {
    console.error("Error reordering tracks:", error.message);
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: "Failed to reorder tracks" });
  }
});

// Helper function to format duration
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Central error handling middleware
app.use((error, req, res, next) => {
  // Log error details for debugging
  console.error('🚨 Server Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Handle different types of errors
  if (error.response) {
    // API error (from axios)
    const status = error.response.status;
    const message = error.response.data?.error?.message || error.message;
    
    if (status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: error.response.headers['retry-after'] || 60
      });
    }
    
    return res.status(status).json({
      error: 'API Error',
      message: isDevelopment ? message : 'External service error',
      status: status
    });
  }
  
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'External service temporarily unavailable'
    });
  }
  
  // Generic server error
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start the server with better error handling
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`🎵 Spotify Fan Website running at http://127.0.0.1:${port}`);
  console.log(`🔧 API endpoints available at http://127.0.0.1:${port}/api/`);
  console.log(`👀 Nodemon is watching for changes - edit any file and see instant updates!`);
  
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.warn("⚠️  Warning: Spotify credentials not found. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file");
  }
  
  if (!process.env.SESSION_SECRET) {
    console.warn("⚠️  Warning: SESSION_SECRET not set in .env file. Sessions will be invalidated on server restart!");
  }
  
  if (SPOTIFY_USERNAME) {
    console.log(`👤 Configured user: ${SPOTIFY_USERNAME}`);
    console.log(`🎵 Your playlists will be available at http://127.0.0.1:${port}/api/my-playlists`);
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
