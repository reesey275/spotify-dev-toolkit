const { test, expect } = require('@playwright/test');

test.describe('API Collections Endpoint', () => {
    test('GET /healthz returns healthy status', async ({ request }) => {
        const response = await request.get('/healthz');

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('healthy');
    });

    test('GET /api/collections returns collections data', async ({ request }) => {
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

                // If playlist has error, it's a placeholder for unavailable data
                if (playlist.error) {
                    expect(playlist.error).toBe(true);
                } else {
                    // Only check full properties if no error
                    expect(playlist).toHaveProperty('cover');
                    expect(playlist).toHaveProperty('url');
                    expect(playlist).toHaveProperty('owner');
                    expect(playlist).toHaveProperty('track_count');
                    expect(typeof playlist.track_count).toBe('number');
                }
            }
        }
    });

    test('GET /api/collections/:type/:id returns specific collection', async ({ request }) => {
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

    test('GET /api/collections/:type/:id with pagination works', async ({ request }) => {
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
});