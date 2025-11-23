const axios = require('axios');

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// In-memory token storage (in production, use proper session management)
let accessToken = null;
let tokenExpiry = null;

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

// Check if token is fresh
function isFresh(req) {
    const t = req.session?.tokens;
    return !!t && typeof t.expires_at === "number" && (Date.now() + 30_000) < t.expires_at;
}

// Refresh access token
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
    return req.session.tokens.access_token;
}

// Save tokens to session
function saveTokens(req, { access_token, refresh_token, expires_in }) {
    const early = 60_000; // refresh 60s early
    req.session.tokens = {
        access_token,
        refresh_token: refresh_token ?? req.session.tokens?.refresh_token, // rotate if present
        expires_at: Date.now() + (expires_in * 1000) - early,
    };
}

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

module.exports = {
    getSpotifyToken,
    getUserAccessToken,
    isFresh,
    refreshAccessToken,
    saveTokens,
    spotifyRequest
};