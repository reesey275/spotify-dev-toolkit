import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('GET /healthz - health check', async ({ request }) => {
    const response = await request.get('/healthz');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('uptime');
  });

  test('GET /api/playlists - featured playlists', async ({ request }) => {
    const response = await request.get('/api/playlists?limit=3');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('playlists');
    expect(Array.isArray(data.playlists)).toBeTruthy();
    expect(data.playlists.length).toBeLessThanOrEqual(3);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('source');

    // Check playlist structure
    if (data.playlists.length > 0) {
      const playlist = data.playlists[0];
      expect(playlist).toHaveProperty('id');
      expect(playlist).toHaveProperty('name');
      expect(playlist).toHaveProperty('description');
      expect(playlist).toHaveProperty('owner');
      expect(playlist).toHaveProperty('tracks');
      expect(playlist).toHaveProperty('images');
    }
  });

  test('GET /api/playlists with sorting', async ({ request }) => {
    const response = await request.get('/api/playlists?limit=5&sort=name-asc');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.playlists.length).toBeLessThanOrEqual(5);

    // Check if playlists are sorted by name
    if (data.playlists.length > 1) {
      for (let i = 1; i < data.playlists.length; i++) {
        expect(data.playlists[i - 1].name.localeCompare(data.playlists[i].name)).toBeLessThanOrEqual(0);
      }
    }
  });

  test('GET /api/user/:userId/playlists - user playlists', async ({ request }) => {
    // Test with the configured user from .env
    const response = await request.get('/api/user/reesey275/playlists?limit=2');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('playlists');
    expect(Array.isArray(data.playlists)).toBeTruthy();
  });

  test('GET /api/playlist/:id - individual playlist', async ({ request }) => {
    // Use demo playlist ID that works with fallback data
    const playlistId = 'demo1';

    const response = await request.get(`/api/playlist/${playlistId}?limit=10`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('playlist');
    expect(data).toHaveProperty('tracks');
    expect(data).toHaveProperty('pagination');

    // Check playlist structure
    expect(data.playlist).toHaveProperty('id', playlistId);
    expect(data.playlist).toHaveProperty('name');
    expect(data.playlist).toHaveProperty('description');

    // Check tracks structure
    expect(Array.isArray(data.tracks)).toBeTruthy();
    if (data.tracks.length > 0) {
      const track = data.tracks[0];
      expect(track).toHaveProperty('id');
      expect(track).toHaveProperty('name');
      expect(track).toHaveProperty('artists');
      expect(track).toHaveProperty('album');
      expect(track).toHaveProperty('duration_ms');
    }
  });

  test('GET /api/search - search functionality', async ({ request }) => {
    const response = await request.get('/api/search?q=rock&type=playlist&limit=3');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('playlists');
    expect(data).toHaveProperty('tracks');
    expect(data).toHaveProperty('albums');
    expect(data).toHaveProperty('artists');
  });

  test('Invalid playlist ID returns 400', async ({ request }) => {
    const response = await request.get('/api/playlist/invalid-id');

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('Non-existent endpoint returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent');

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('CORS preflight request works', async ({ request }) => {
    const response = await request.fetch('/api/playlists', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://127.0.0.1:8080',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeTruthy();
    expect(headers['access-control-allow-methods']).toContain('GET');
  });

  test('GET /api/collections - collections endpoint', async ({ request }) => {
    const response = await request.get('/api/collections');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('collections');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('timestamp');
    expect(Array.isArray(data.collections)).toBeTruthy();
    expect(data.total).toBeGreaterThan(0);

    // Check collection structure
    if (data.collections.length > 0) {
      const collection = data.collections[0];
      expect(collection).toHaveProperty('id');
      expect(collection).toHaveProperty('name');
      expect(collection).toHaveProperty('description');
      expect(collection).toHaveProperty('category');
      expect(collection).toHaveProperty('tags');
      expect(collection).toHaveProperty('color');
      expect(collection).toHaveProperty('icon');
      expect(collection).toHaveProperty('playlists');
      expect(Array.isArray(collection.playlists)).toBeTruthy();

      // Check playlist structure
      if (collection.playlists.length > 0) {
        const playlist = collection.playlists[0];
        expect(playlist).toHaveProperty('id');
        expect(playlist).toHaveProperty('name');
        expect(playlist).toHaveProperty('description');
        expect(playlist).toHaveProperty('cover');
        expect(playlist).toHaveProperty('url');
        expect(playlist).toHaveProperty('owner');
        expect(playlist).toHaveProperty('track_count');
        expect(typeof playlist.track_count).toBe('number');
      }
    }
  });

  test('GET /api/collections/:type/:id - specific collection', async ({ request }) => {
    // Test with a known collection (chill from moods)
    const response = await request.get('/api/collections/moods/chill');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('collection');
    expect(data).toHaveProperty('pagination');
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('timestamp');

    // Check collection structure
    const collection = data.collection;
    expect(collection).toHaveProperty('id', 'chill');
    expect(collection).toHaveProperty('name');
    expect(collection).toHaveProperty('description');
    expect(collection).toHaveProperty('category', 'moods');
    expect(collection).toHaveProperty('tags');
    expect(collection).toHaveProperty('color');
    expect(collection).toHaveProperty('icon');
    expect(collection).toHaveProperty('playlists');
    expect(Array.isArray(collection.playlists)).toBeTruthy();
  });

  test('GET /api/collections/:type/:id with pagination', async ({ request }) => {
    const response = await request.get('/api/collections/moods/chill?limit=2&offset=0');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.collection.playlists.length).toBeLessThanOrEqual(2);

    const pagination = data.pagination;
    expect(pagination).toHaveProperty('offset', 0);
    expect(pagination).toHaveProperty('limit', 2);
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('hasNext');
    expect(pagination).toHaveProperty('hasPrevious');
  });

  test('Rate limiting works', async ({ request }) => {
    // Use unique test ID to ensure rate limit bucket isolation
    const testId = Math.random().toString(36).substring(7);

    // Make requests until we hit the rate limit
    let response;
    let count = 0;
    do {
      response = await request.get(`/api/test-rate-limit?test=${testId}`);
      count++;
      // Add delay to avoid hitting rate limit too quickly
      await new Promise(r => setTimeout(r, 100));
    } while (response.ok() && count < 150); // Safety limit

    expect(response.status()).toBe(429);
    expect(count).toBeGreaterThan(5); // Should hit limit before safety
  });
});