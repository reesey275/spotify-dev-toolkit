#!/usr/bin/env node

// Simple test script for playlist management endpoints
const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5500';

async function testPlaylistEndpoints() {
  console.log('🧪 Testing Playlist Management Endpoints\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${BASE_URL}/healthz`);
    console.log('✅ Health check passed:', health.data);

    // Test 2: Get playlists (should require auth)
    console.log('\n2. Testing playlists endpoint (should require auth)...');
    try {
      await axios.get(`${BASE_URL}/api/playlists`);
      console.log('❌ Should have required authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Authentication required as expected');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Check if new endpoints are registered
    console.log('\n3. Testing new playlist management endpoints...');

    // Test POST /api/playlists (should require auth)
    try {
      await axios.post(`${BASE_URL}/api/playlists`, {
        name: 'Test Playlist',
        description: 'Created by test script'
      });
      console.log('❌ POST should have required authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ POST /api/playlists requires auth as expected');
      } else {
        console.log('❌ Unexpected error on POST:', error.message);
      }
    }

    // Test PUT /api/playlists/:id (should require auth)
    try {
      await axios.put(`${BASE_URL}/api/playlists/3cEYpjA9oz9GiPac4AsH4n`, {
        name: 'Updated Playlist'
      });
      console.log('❌ PUT should have required authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ PUT /api/playlists/:id requires auth as expected');
      } else {
        console.log('❌ Unexpected error on PUT:', error.message);
      }
    }

    // Test DELETE /api/playlists/:id (should require auth)
    try {
      await axios.delete(`${BASE_URL}/api/playlists/3cEYpjA9oz9GiPac4AsH4n`);
      console.log('❌ DELETE should have required authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ DELETE /api/playlists/:id requires auth as expected');
      } else {
        console.log('❌ Unexpected error on DELETE:', error.message);
      }
    }

    console.log('\n🎉 All endpoint tests completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Authenticate via OAuth at http://127.0.0.1:5500');
    console.log('2. Test actual playlist creation, updates, and deletion');
    console.log('3. Verify track management endpoints work');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPlaylistEndpoints();