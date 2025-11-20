#!/usr/bin/env node

// Test script to simulate OAuth state validation issues
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const BASE_URL = 'http://127.0.0.1:5500';

// Create a cookie jar to maintain session state
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar }));

async function testOAuthStateValidation() {
  console.log('🧪 Testing OAuth State Validation\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await client.get(`${BASE_URL}/healthz`);
    console.log('✅ Health check passed');

    // Test 2: Login to establish session
    console.log('\n2. Testing login endpoint...');
    try {
      const loginResponse = await client.get(`${BASE_URL}/login`, {
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      console.log('Login redirect status:', loginResponse.status);

      // Extract state from the redirect URL
      const redirectUrl = loginResponse.headers.location;
      const url = new URL(redirectUrl);
      const state = url.searchParams.get('state');
      console.log('State from login redirect:', state);

      // Test 3: Callback with correct state
      console.log('\n3. Testing callback with correct state...');
      try {
        const callbackResponse = await client.get(`${BASE_URL}/callback?code=fake_code&state=${state}`, {
          maxRedirects: 0,
          validateStatus: function (status) {
            return status >= 200 && status < 500;
          }
        });
        console.log('Callback response status:', callbackResponse.status);
        console.log('Callback response data:', callbackResponse.data);
      } catch (error) {
        console.log('Callback error:', error.message);
        if (error.response) {
          console.log('Callback response status:', error.response.status);
          console.log('Callback response data:', error.response.data);
        }
      }

    } catch (error) {
      console.log('Login endpoint error:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOAuthStateValidation();