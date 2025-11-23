const express = require('express');
const router = express.Router();
const { loadCollections } = require('../utils/loadCollections');
const { spotifyRequest } = require('../utils/spotify');

// Simple in-memory cache for playlist metadata
const playlistCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper function to get cached playlist data or fetch from API
async function getPlaylistMetadata(playlistId, req) {
    const cacheKey = playlistId;
    const now = Date.now();

    // Check cache first
    if (playlistCache.has(cacheKey)) {
        const cached = playlistCache.get(cacheKey);
        if (now - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        // Cache expired, remove it
        playlistCache.delete(cacheKey);
    }

    try {
        // Fetch from Spotify API
        const playlistData = await spotifyRequest(`/playlists/${playlistId}?fields=id,name,description,images,external_urls,owner,tracks.total`, req);

        const metadata = {
            id: playlistData.id,
            name: playlistData.name,
            description: playlistData.description,
            cover: playlistData.images?.[0]?.url,
            url: playlistData.external_urls?.spotify,
            owner: playlistData.owner?.display_name,
            track_count: playlistData.tracks?.total || 0
        };

        // Cache the result
        playlistCache.set(cacheKey, {
            data: metadata,
            timestamp: now
        });

        return metadata;
    } catch (error) {
        console.warn(`Failed to fetch playlist ${playlistId}:`, error.message);
        throw error;
    }
}

// GET /api/collections
// Returns collections with playlist metadata
router.get('/', async (req, res) => {
    try {
        const config = loadCollections();
        const collections = [];

        // Process each category (moods, genres, activities)
        for (const [categoryKey, category] of Object.entries(config.collections)) {
            for (const [collectionKey, collection] of Object.entries(category)) {
                const collectionData = {
                    id: collectionKey,
                    name: collection.name,
                    description: collection.description,
                    category: categoryKey,
                    tags: collection.tags || [],
                    color: collection.color,
                    icon: collection.icon,
                    playlists: []
                };

                // Fetch metadata for each playlist ID
                if (collection.playlist_ids) {
                    for (const playlistId of collection.playlist_ids) {
                        try {
                            // Fetch playlist metadata from cache or Spotify
                            const metadata = await getPlaylistMetadata(playlistId, req);
                            collectionData.playlists.push(metadata);
                        } catch (error) {
                            // Add placeholder for failed playlists
                            collectionData.playlists.push({
                                id: playlistId,
                                name: 'Playlist Unavailable',
                                description: 'This playlist could not be loaded',
                                error: true
                            });
                        }
                        // Small delay to avoid rate limiting when not cached
                        if (!playlistCache.has(playlistId)) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                collections.push(collectionData);
            }
        }

        res.json({
            collections,
            total: collections.length,
            source: 'config',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /api/collections:', error.message);
        res.status(500).json({ error: 'Failed to load collections' });
    }
});

// GET /api/collections/:type/:id
// Returns specific collection details with playlist metadata
router.get('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const config = loadCollections();

        if (!config.collections[type] || !config.collections[type][id]) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const collection = config.collections[type][id];
        const playlistIds = collection.playlist_ids || [];

        const collectionData = {
            id,
            name: collection.name,
            description: collection.description,
            category: type,
            tags: collection.tags || [],
            color: collection.color,
            icon: collection.icon,
            playlists: []
        };

        // Fetch metadata for playlists in this collection with pagination
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);

        for (const playlistId of playlistIds.slice(startIndex, endIndex)) {
            try {
                const metadata = await getPlaylistMetadata(playlistId, req);
                collectionData.playlists.push(metadata);
            } catch (error) {
                collectionData.playlists.push({
                    id: playlistId,
                    name: 'Playlist Unavailable',
                    description: 'This playlist could not be loaded',
                    error: true
                });
            }
            // Small delay to avoid rate limiting when not cached
            if (!playlistCache.has(playlistId)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const hasNext = endIndex < playlistIds.length;

        res.json({
            collection: collectionData,
            pagination: {
                offset: parseInt(offset),
                limit: parseInt(limit),
                total: playlistIds.length,
                hasNext: hasNext,
                hasPrevious: startIndex > 0
            },
            source: 'config',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /api/collections/:type/:id:', error.message);
        res.status(500).json({ error: 'Failed to load collection details' });
    }
});

module.exports = router;