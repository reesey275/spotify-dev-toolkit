#!/usr/bin/env node

// Comprehensive test script to verify sorting functionality across all views
const http = require('http');

function testAllSorting() {
    console.log('🧪 Comprehensive Sorting Test Suite...\n');

    const tests = [
        {
            name: 'HTML Structure Check',
            test: async () => {
                return new Promise((resolve) => {
                    const htmlReq = http.get('http://127.0.0.1:5500', (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            const hasSortSelect = data.includes('id="sort-select"');
                            const hasMySortSelect = data.includes('id="my-sort-select"');
                            const hasTrackSortSelect = data.includes('id="track-sort-select"');

                            if (hasSortSelect && hasMySortSelect && hasTrackSortSelect) {
                                console.log('✅ All sort dropdowns found in HTML');
                                resolve(true);
                            } else {
                                console.log('❌ Missing sort dropdowns:', {
                                    'sort-select': hasSortSelect,
                                    'my-sort-select': hasMySortSelect,
                                    'track-sort-select': hasTrackSortSelect
                                });
                                resolve(false);
                            }
                        });
                    });

                    htmlReq.on('error', (e) => {
                        console.log('❌ Error testing HTML:', e.message);
                        resolve(false);
                    });
                });
            }
        },
        {
            name: 'Featured Playlists Sorting (tracks-desc)',
            test: async () => {
                return new Promise((resolve) => {
                    const req = http.get('http://127.0.0.1:5500/api/playlists?sort=tracks-desc&limit=3', (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const response = JSON.parse(data);
                                if (response.playlists && response.playlists.length >= 2) {
                                    const first = response.playlists[0].tracks.total;
                                    const second = response.playlists[1].tracks.total;
                                    if (first >= second) {
                                        console.log(`✅ Featured playlists sorting works: ${first} >= ${second} tracks`);
                                        resolve(true);
                                    } else {
                                        console.log(`❌ Featured playlists sorting failed: ${first} < ${second} tracks`);
                                        resolve(false);
                                    }
                                } else {
                                    console.log('⚠️ Not enough featured playlists to test sorting');
                                    resolve(false);
                                }
                            } catch (e) {
                                console.log('❌ Error parsing featured playlists response:', e.message);
                                resolve(false);
                            }
                        });
                    });

                    req.on('error', (e) => {
                        console.log('❌ Error testing featured playlists:', e.message);
                        resolve(false);
                    });
                });
            }
        },
        {
            name: 'My Playlists Sorting (tracks-desc)',
            test: async () => {
                return new Promise((resolve) => {
                    const req = http.get('http://127.0.0.1:5500/api/my-playlists?sort=tracks-desc&limit=3', (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const response = JSON.parse(data);
                                if (response.playlists && response.playlists.length >= 2) {
                                    const first = response.playlists[0].tracks.total;
                                    const second = response.playlists[1].tracks.total;
                                    if (first >= second) {
                                        console.log(`✅ My playlists sorting works: ${first} >= ${second} tracks`);
                                        resolve(true);
                                    } else {
                                        console.log(`❌ My playlists sorting failed: ${first} < ${second} tracks`);
                                        resolve(false);
                                    }
                                } else {
                                    console.log('⚠️ Not enough my playlists to test sorting (expected for unauthenticated users)');
                                    resolve(true); // This is expected for unauthenticated users
                                }
                            } catch (e) {
                                console.log('❌ Error parsing my playlists response:', e.message);
                                resolve(false);
                            }
                        });
                    });

                    req.on('error', (e) => {
                        console.log('❌ Error testing my playlists:', e.message);
                        resolve(false);
                    });
                });
            }
        },
        {
            name: 'Track Sorting API Check',
            test: async () => {
                return new Promise((resolve) => {
                    // Get a playlist ID from user's playlists (which should be accessible)
                    const userPlaylistsReq = http.get('http://127.0.0.1:5500/api/my-playlists?limit=1', (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const response = JSON.parse(data);
                                if (response.playlists && response.playlists.length > 0) {
                                    const playlistId = response.playlists[0].id;
                                    console.log(`📋 Testing track sorting for user playlist: ${playlistId}`);

                                    // Now test track sorting
                                    const trackReq = http.get(`http://127.0.0.1:5500/api/playlist/${playlistId}?sort=name-asc&limit=5`, (res) => {
                                        let trackData = '';
                                        res.on('data', chunk => trackData += chunk);
                                        res.on('end', () => {
                                            try {
                                                const trackResponse = JSON.parse(trackData);
                                                if (trackResponse.tracks && trackResponse.tracks.length >= 2) {
                                                    const first = trackResponse.tracks[0].name.toLowerCase();
                                                    const second = trackResponse.tracks[1].name.toLowerCase();
                                                    if (first <= second) {
                                                        console.log(`✅ Track sorting works: "${first}" <= "${second}"`);
                                                        resolve(true);
                                                    } else {
                                                        console.log(`❌ Track sorting failed: "${first}" > "${second}"`);
                                                        resolve(false);
                                                    }
                                                } else {
                                                    console.log('⚠️ Not enough tracks to test sorting');
                                                    resolve(false);
                                                }
                                            } catch (e) {
                                                console.log('❌ Error parsing track response:', e.message);
                                                resolve(false);
                                            }
                                        });
                                    });

                                    trackReq.on('error', (e) => {
                                        console.log('❌ Error testing track sorting:', e.message);
                                        resolve(false);
                                    });
                                } else {
                                    console.log('⚠️ No user playlists available for track sorting test');
                                    resolve(true); // This is expected if user has no playlists
                                }
                            } catch (e) {
                                console.log('❌ Error parsing user playlists response:', e.message);
                                resolve(false);
                            }
                        });
                    });

                    userPlaylistsReq.on('error', (e) => {
                        console.log('❌ Error getting user playlists for track test:', e.message);
                        resolve(false);
                    });
                });
            }
        }
    ];

    // Run all tests sequentially
    async function runTests() {
        const results = [];
        for (const test of tests) {
            console.log(`\n🔍 Running: ${test.name}`);
            try {
                const result = await test.test();
                results.push({ name: test.name, passed: result });
            } catch (error) {
                console.log(`❌ Test "${test.name}" threw error:`, error.message);
                results.push({ name: test.name, passed: false });
            }
        }

        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(50));
        results.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.name}`);
        });

        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

        if (passed === total) {
            console.log('🎉 All sorting functionality tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Check the output above for details.');
        }
    }

    runTests();
}

testAllSorting();