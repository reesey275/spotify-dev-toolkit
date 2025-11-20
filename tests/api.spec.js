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
        expect(data.playlists[i-1].name.localeCompare(data.playlists[i].name)).toBeLessThanOrEqual(0);
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

  test('Rate limiting works', async ({ request }) => {
    // Make many requests quickly to trigger rate limiting
    const requests = [];
    const numRequests = 350; // More than the 300/min limit

    for (let i = 0; i < numRequests; i++) {
      requests.push(request.get('/api/playlists?limit=1'));
    }

    const responses = await Promise.all(requests);

    // Some requests should be rate limited (429 status)
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    // Check rate limit headers
    const lastResponse = responses[responses.length - 1];
    if (lastResponse.status() === 429) {
      const headers = lastResponse.headers();
      expect(headers['retry-after']).toBeTruthy();
    }
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
});