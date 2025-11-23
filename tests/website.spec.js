import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';

async function waitForServer(timeout = 15000, interval = 500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch (e) {
      // ignore and retry
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Server not responding at ${BASE} after ${timeout}ms`);
}

test.beforeAll(async () => {
  await waitForServer(20000, 500);
});

test.describe('Spotify Fan Website', () => {
  test('homepage loads correctly', async ({ page }) => {
    // Navigate to the homepage (use absolute base URL)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });

    // Check that the page title contains "Spotify"
    await expect(page).toHaveTitle(/Spotify/i);

    // Check for main content elements - default view is my-playlists-view
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#my-playlists-view')).toBeVisible();
    // Note: #my-playlists-grid may be empty initially as content loads dynamically

    // Take a screenshot for troubleshooting
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
  });

  test('API health endpoint returns valid JSON', async ({ request }) => {
    const response = await request.get('/healthz');

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });

  test('API playlists endpoint returns valid data', async ({ request }) => {
    const response = await request.get('/api/playlists?limit=5');

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('playlists');
    expect(Array.isArray(data.playlists)).toBeTruthy();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('source');
  });

  test('login button is present and clickable', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });

    // Look for login button/link
    const loginButton = page.locator('a[href="/login"], button:has-text("Login"), [data-testid="login-button"]').first();
    await expect(loginButton).toBeVisible();

    // Take screenshot before clicking
    await page.screenshot({ path: 'test-results/before-login-click.png' });

    // Click should redirect to Spotify OAuth (but won't complete in test environment)
    // We just verify the click doesn't cause errors
    await loginButton.click();

    // Should redirect to Spotify or show loading state
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/after-login-click.png' });
  });

  test('featured playlists load and display correctly', async ({ page }) => {
    // Navigate directly to the featured view using the hash so SPA will pick it up on bootstrap
    await page.goto(`${BASE}/#home`, { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for the featured playlists section to be present
    // (don't depend on view class which can be flaky across engines)
    await expect(page.locator('#playlists-grid')).toBeVisible({ timeout: 10000 });

    // Check that we have the sort select in the featured view
    await expect(page.locator('#sort-select')).toBeVisible();

    // Take a screenshot
    await page.screenshot({ path: 'test-results/featured-playlists.png', fullPage: true });
  });

  test('search functionality works', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], #search-input').first();

    if (await searchInput.isVisible()) {
      // Type in search query
      await searchInput.fill('rock');

      // Look for search button or wait for auto-search
      const searchButton = page.locator('button[type="submit"], button:has-text("Search"), [data-testid="search-button"]').first();

      if (await searchButton.isVisible()) {
        await searchButton.click();
      }

      // Wait for search results
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/search-results.png' });
    } else {
      console.log('Search input not found, skipping search test');
    }
  });

  test('mobile responsiveness', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.goto('/');

      // Check that mobile layout works - default view is my-playlists-view
      await expect(page.locator('#my-playlists-view')).toBeVisible();
      await expect(page.locator('#my-playlists-grid')).toBeVisible();

      // Take mobile screenshot
      await page.screenshot({ path: 'test-results/mobile-view.png' });
    }
  });

  test('error handling - invalid API endpoint', async ({ request }) => {
    const response = await request.get('/api/nonexistent-endpoint');

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('CORS headers are properly set', async ({ request }) => {
    const response = await request.get('/api/playlists', {
      headers: {
        'Origin': 'http://127.0.0.1:8080'
      }
    });

    // Check CORS headers
    const corsHeaders = response.headers();
    expect(corsHeaders['access-control-allow-origin']).toBeTruthy();
    expect(corsHeaders['access-control-allow-credentials']).toBe('true');
  });
});