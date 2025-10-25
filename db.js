const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Initialize database
const dbDir = process.env.DOCKER_CONTAINER ? '/app/data' : path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'spotify_cache.db');

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    track_count INTEGER,
    image TEXT,
    external_urls TEXT,
    created_date TEXT,
    public INTEGER, -- boolean stored as 0/1
    collaborative INTEGER, -- boolean stored as 0/1
    followers_total INTEGER,
    updated_at INTEGER NOT NULL,
    cache_type TEXT NOT NULL, -- 'featured', 'user', 'my'
    user_id TEXT -- for user-specific playlists
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    name TEXT NOT NULL,
    artists TEXT NOT NULL, -- JSON array
    album TEXT,
    duration_ms INTEGER,
    added_at TEXT,
    track_number INTEGER,
    popularity INTEGER,
    external_urls TEXT,
    preview_url TEXT,
    image TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_playlists_cache_type_user ON playlists (cache_type, user_id);
  CREATE INDEX IF NOT EXISTS idx_playlists_updated ON playlists (updated_at);
  CREATE INDEX IF NOT EXISTS idx_tracks_playlist ON tracks (playlist_id);
`);

// Prepared statements
const insertPlaylist = db.prepare(`
  INSERT OR REPLACE INTO playlists (id, name, description, owner, track_count, image, external_urls, created_date, public, collaborative, followers_total, updated_at, cache_type, user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTrack = db.prepare(`
  INSERT OR REPLACE INTO tracks (id, playlist_id, name, artists, album, duration_ms, added_at, track_number, popularity, external_urls, preview_url, image, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getPlaylists = db.prepare(`
  SELECT * FROM playlists
  WHERE cache_type = ? AND (user_id = ? OR user_id IS NULL)
  AND updated_at > ?
  ORDER BY name
`);

const getTracks = db.prepare(`
  SELECT * FROM tracks
  WHERE playlist_id = ?
  ORDER BY track_number
`);

const deleteOldCache = db.prepare(`
  DELETE FROM playlists WHERE updated_at < ?
`);

const deleteOldTracks = db.prepare(`
  DELETE FROM tracks WHERE updated_at < ?
`);

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

// Safe JSON parsing utility
const safeJson = (s, fallback) => {
  try {
    return JSON.parse(s ?? "");
  } catch {
    return fallback;
  }
};

// Normalize playlist from API response
function fromApi(playlist) {
  return {
    id: playlist.id,
    name: playlist.name ?? "",
    description: playlist.description ?? "",
    public: !!playlist.public,
    collaborative: !!playlist.collaborative,
    images: Array.isArray(playlist.images) ? playlist.images : [],
    owner: { display_name: playlist.owner?.display_name ?? "Unknown" },
    external_urls: { spotify: playlist.external_urls?.spotify ?? null },
    tracks: { total: playlist.tracks?.total ?? 0 },
    followers: { total: playlist.followers?.total ?? 0 },
  };
}

// Normalize playlist from database row
function fromCache(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    public: !!row.public,
    collaborative: !!row.collaborative,
    images: safeJson(row.image, []),
    owner: { display_name: row.owner ?? "Unknown" },
    external_urls: safeJson(row.external_urls, { spotify: null }),
    tracks: { total: Number(row.track_count ?? 0) },
    followers: { total: Number(row.followers_total ?? 0) },
  };
}

function cachePlaylists(playlists, cacheType, userId = null) {
  const now = Date.now();
  const insertMany = db.transaction((playlists) => {
    for (const playlist of playlists) {
      // Normalize the playlist data before caching
      const normalized = fromApi(playlist);
      
      insertPlaylist.run(
        normalized.id,
        normalized.name,
        normalized.description,
        normalized.owner.display_name,
        normalized.tracks.total,
        JSON.stringify(normalized.images),
        JSON.stringify(normalized.external_urls),
        playlist.created_date || null, // Keep original created_date if available
        normalized.public ? 1 : 0,
        normalized.collaborative ? 1 : 0,
        normalized.followers.total,
        now,
        cacheType,
        userId
      );
    }
  });
  insertMany(playlists);
}

function cacheTracks(playlistId, tracks) {
  const now = Date.now();
  const insertMany = db.transaction((tracks) => {
    for (const track of tracks) {
      insertTrack.run(
        track.id,
        playlistId,
        track.name,
        JSON.stringify(track.artists),
        track.album,
        track.duration_ms,
        track.added_at,
        track.track_number,
        track.popularity,
        JSON.stringify(track.external_urls),
        track.preview_url,
        track.image,
        now
      );
    }
  });
  insertMany(tracks);
}

function getCachedPlaylists(cacheType, userId = null, maxAge = CACHE_DURATION) {
  const cutoff = Date.now() - maxAge;
  const rows = getPlaylists.all(cacheType, userId, cutoff);
  return rows.map(fromCache);
}

function getCachedTracks(playlistId) {
  const rows = getTracks.all(playlistId);
  return rows.map(row => ({
    ...row,
    artists: JSON.parse(row.artists || '[]'),
    external_urls: JSON.parse(row.external_urls || '{}')
  }));
}

function cleanupOldCache(maxAge = CACHE_DURATION * 24) { // Clean up caches older than 24 hours
  const cutoff = Date.now() - maxAge;
  deleteOldCache.run(cutoff);
  deleteOldTracks.run(cutoff);
}

// Run cleanup on startup
cleanupOldCache();

module.exports = {
  cachePlaylists,
  cacheTracks,
  getCachedPlaylists,
  getCachedTracks,
  cleanupOldCache,
  fromApi,
  fromCache
};