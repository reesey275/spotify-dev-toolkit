// Spotify Fan Website - Main JavaScript

// Define Spotify Web Playback SDK callback immediately to prevent "not defined" errors
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('🎵 Spotify Web Playback SDK ready');
    // The actual player initialization will happen in the SpotifyFanApp class
    if (window.app && typeof window.app.createSpotifyPlayer === 'function') {
        window.app.createSpotifyPlayer();
    }
};

class SpotifyFanApp {
    constructor() {
        this.currentView = this.getViewFromUrl() || 'my-playlists'; // Get view from URL hash or default
        this.currentPlaylist = null;
        this.playlists = [];
        this.myPlaylists = []; // Add this to store user's playlists
        this.currentTracks = [];
        this.currentSort = '';
        this.currentOffset = 0;
        this.tracksPerPage = 50;
        this.isAuthenticated = false;
        this.currentUser = null;
        this.currentlyPlayingInterval = null; // For updating currently playing progress
        
        // Spotify Web Playback SDK
        this.player = null;
        this.deviceId = null;
        this.playerState = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing SpotifyFanApp...');
        this.setupEventListeners();
        this.setupHashRouting();
        this.checkForAuthSuccess(); // Check for authentication success parameter
        this.checkAuthStatus();
        this.loadInitialData();
        // Removed initializeSpotifyPlayer() from here - will be called after auth check
    }

    checkForAuthSuccess() {
        // Check if we just completed authentication
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('authenticated') === 'true') {
            // Clear the parameter from URL
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
            
            // Mark as authenticated
            this.isAuthenticated = true;
            
            // Show success message
            this.showAuthSuccess();
            
            // Initialize player after successful auth
            this.initializeSpotifyPlayer();
            
            // Switch to my-playlists view since user just authenticated
            this.switchView('my-playlists');
        }
    }

    showAuthSuccess() {
        // Create and show a success message
        const successDiv = document.createElement('div');
        successDiv.id = 'auth-success';
        successDiv.style.cssText = `
            position: fixed;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            font-weight: 500;
            animation: slideDown 0.3s ease-out;
        `;
        successDiv.innerHTML = '✅ Successfully logged in with Spotify!';
        
        // Add animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(successDiv);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.style.animation = 'slideDown 0.3s ease-in reverse';
                setTimeout(() => successDiv.remove(), 300);
            }
        }, 3000);
    }

    updateUrl(viewName) {
        window.location.hash = viewName;
    }

    getViewFromUrl() {
        // Extract view name from URL hash (remove the # prefix)
        const hash = window.location.hash.substring(1);
        return hash || null;
    }

    setupHashRouting() {
        // Listen for hash changes (back/forward buttons)
        window.addEventListener('hashchange', () => {
            const newView = this.getViewFromUrl();
            if (newView && newView !== this.currentView) {
                console.log(`🔄 Hash changed to: ${newView}`);
                this.switchView(newView);
            }
        });

        // Set initial view based on URL hash
        if (this.currentView !== 'my-playlists') {
            this.switchView(this.currentView);
        }
    }

    setupEventListeners() {
                // Navigation event listeners
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = btn.dataset.view;
                console.log(`🖱️ Frontend: Nav button clicked for view "${view}"`);
                this.switchView(view);
            });
        });

        // Home logo click listener
        document.getElementById('home-logo').addEventListener('click', () => {
            console.log('🏠 Home logo clicked - switching to currently playing view');
            this.switchView('currently-playing');
        });

        // Auth event listeners
        const loginBtn = document.getElementById('login-btn');
        console.log('🔍 Login button element:', loginBtn);
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('🎯 Login button clicked!');
                this.login();
            });
            console.log('✅ Login button event listener attached');
        } else {
            console.error('❌ Login button not found!');
        }

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Sort controls
        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.sortPlaylists(e.target.value);
        });

        document.getElementById('my-sort-select').addEventListener('change', (e) => {
            this.sortMyPlaylists(e.target.value);
        });

        document.getElementById('track-sort-select').addEventListener('change', (e) => {
            this.sortTracks(e.target.value);
        });

        // Playlist search
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // User search
        document.getElementById('user-search-btn').addEventListener('click', () => {
            this.performUserSearch();
        });

        document.getElementById('user-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performUserSearch();
            }
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.switchView(this.currentView === 'playlist' ? 'my-playlists' : 'my-playlists');
        });

        // Export playlist button (using event delegation since button is created dynamically)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'export-playlist-btn') {
                this.exportPlaylistToFile();
            }
        });
    }

    async checkAuthStatus() {
        try {
            // Try to access a protected endpoint to check if we're authenticated
            const response = await fetch('/api/my-playlists?limit=1');
            if (response.ok) {
                const data = await response.json();
                this.isAuthenticated = true;
                this.currentUser = data.username;
                this.updateAuthUI();
                console.log('✅ User is authenticated:', this.currentUser);
            } else {
                this.isAuthenticated = false;
                this.currentUser = null;
                this.updateAuthUI();
                console.log('❌ User is not authenticated');
            }
        } catch (error) {
            this.isAuthenticated = false;
            this.currentUser = null;
            this.updateAuthUI();
            console.log('❌ Auth check failed:', error.message);
        }
    }

    updateAuthUI() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userInfo = document.getElementById('user-info');
        const userDisplayName = document.getElementById('user-display-name');

        if (this.isAuthenticated && this.currentUser) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            userInfo.classList.remove('hidden');
            userDisplayName.textContent = this.currentUser;
        } else {
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            userInfo.classList.add('hidden');
            userDisplayName.textContent = '';
        }
    }

    login() {
        console.log('🔐 Initiating Spotify OAuth login...');
        console.log('📍 Current location:', window.location.href);
        console.log('🎯 Redirecting to: /login');
        window.location.href = '/login';
    }

    async logout() {
        try {
            console.log('🚪 Logging out...');
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Clear ALL cached user data
                this.isAuthenticated = false;
                this.currentUser = null;
                this.myPlaylists = [];
                this.playlists = [];
                this.currentPlaylist = null;
                this.currentTracks = [];
                this.currentSort = '';
                this.currentOffset = 0;

                // Clear player state
                if (this.player) {
                    this.player.disconnect();
                    this.player = null;
                }
                this.deviceId = null;
                this.playerState = null;

                // Clear any intervals
                if (this.currentlyPlayingInterval) {
                    clearInterval(this.currentlyPlayingInterval);
                    this.currentlyPlayingInterval = null;
                }

                this.updateAuthUI();
                this.switchView('home'); // Go to featured playlists
                console.log('✅ Successfully logged out and cleared all cached data');
            } else {
                console.error('❌ Logout failed');
                this.showError('Failed to logout. Please try again.');
            }
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.showError('Failed to logout. Please try again.');
        }
    }

    async loadInitialData() {
        this.showLoading(true);
        try {
            console.log(`🚀 Frontend: loadInitialData called for view "${this.currentView}"`);
            
            // Load data based on the current view
            // Prefer to show featured content first so anonymous users can browse
            // without being forced to authenticate. Load user playlists in the
            // background and surface them when available.
            if (this.currentView === 'my-playlists' || !this.currentView) {
                // Render featured playlists into the my-playlists area first
                await this.loadFeaturedPlaylists();
                this.renderPlaylists();

                // Load user playlists in background (don't block the UI)
                this.loadMyPlaylists().then(() => {
                    // If user is authenticated, render their playlists
                    if (this.isAuthenticated) this.renderMyPlaylists();
                }).catch(err => {
                    console.debug('Background my-playlists load failed:', err?.message || err);
                });
            } else {
                // For other views, let switchView handle the data loading but
                // still fetch user playlists in background for navigation
                await this.loadFeaturedPlaylists();
                this.loadMyPlaylists().catch(() => {});
            }
            
            this.showLoading(false);
            console.log('✅ Frontend: Initial data loaded successfully');
        } catch (error) {
            this.showError('Failed to load your playlists. Please check your Spotify credentials.');
            console.error('❌ Frontend: Error loading initial data:', error);
        }
    }

    async loadFeaturedPlaylists(sort = '') {
        console.log('🎵 Frontend: loadFeaturedPlaylists called');
        console.trace('📍 Call stack for loadFeaturedPlaylists');
        try {
            const response = await fetch(`/api/playlists?sort=${sort}&limit=20`);
            if (!response.ok) throw new Error('Failed to fetch featured playlists');
            
            const data = await response.json();
            this.playlists = data.playlists;
            
            // Handle different data sources
            if (data.source && data.message) {
                console.log(`📡 Frontend: Received ${data.source} data - ${data.message}`);
                this.showDataSourceMessage(data.source, data.message);
            }
            
            return this.playlists;
        } catch (error) {
            console.error('Error loading featured playlists:', error);
            throw error;
        }
    }

    async loadUserPlaylists(userId, sort = '') {
        try {
            const response = await fetch(`/api/user/${userId}/playlists?sort=${sort}&limit=50`);
            if (!response.ok) throw new Error('Failed to fetch user playlists');
            
            const data = await response.json();
            return data.playlists;
        } catch (error) {
            console.error('Error loading user playlists:', error);
            throw error;
        }
    }

    async loadMyPlaylists(sort = '') {
        try {
            console.log('🔍 Frontend: Loading my playlists...');
            const response = await fetch(`/api/my-playlists?sort=${sort}&limit=50`);
            console.log('📡 Frontend: API response status:', response.status, response.ok);
            
            if (response.status === 401) {
                // User not authenticated
                console.log('❌ User not authenticated for my-playlists');
                this.isAuthenticated = false;
                this.currentUser = null;
                this.updateAuthUI();
                this.myPlaylists = [];
                return this.myPlaylists;
            }
            
            if (!response.ok) throw new Error('Failed to fetch your playlists');
            
            const data = await response.json();
            console.log('📊 Frontend: Received data:', data);
            console.log('📋 Frontend: Number of playlists:', data.playlists?.length);
            this.myPlaylists = data.playlists;
            this.currentUser = data.username;
            
            // Only set authenticated if this is actually OAuth data, not fallback
            if (data.authenticated) {
                this.isAuthenticated = true;
                console.log('✅ User is authenticated with OAuth');
            } else {
                this.isAuthenticated = false;
                console.log('ℹ️ Showing fallback playlists (not authenticated)');
            }
            
            this.updateAuthUI();
            return this.myPlaylists;
        } catch (error) {
            console.error('❌ Frontend: Error loading your playlists:', error);
            // Don't show error for auth issues, just return empty array
            if (error.message.includes('401') || error.message.includes('auth')) {
                this.isAuthenticated = false;
                this.currentUser = null;
                this.updateAuthUI();
                this.myPlaylists = [];
                return this.myPlaylists;
            }
            throw error;
        }
    }

    async loadUserInfo(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user info');
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error loading user info:', error);
            throw error;
        }
    }

    async loadPlaylistDetails(playlistId, sort = '', offset = 0) {
        try {
            this.showLoading(true);
            const response = await fetch(`/api/playlist/${playlistId}?sort=${sort}&offset=${offset}&limit=${this.tracksPerPage}`);
            if (!response.ok) throw new Error('Failed to fetch playlist details');
            
            const data = await response.json();
            this.currentPlaylist = data.playlist;
            this.currentTracks = data.tracks;
            this.currentOffset = offset;
            
            this.renderPlaylistView(data);
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to load playlist details.');
            console.error('Error loading playlist details:', error);
        }
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        this.showLoading(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=playlist&limit=20`);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            console.log('🔍 Search API response:', data);
            
            const playlists = data.playlists?.items || [];
            console.log('🎵 Search results:', playlists.length, 'playlists found');
            if (playlists.length > 0) {
                console.log('📋 First playlist structure:', playlists[0]);
            }
            
            this.renderSearchResults(playlists);
            this.showLoading(false);
        } catch (error) {
            this.showError('Search failed. Please try again.');
            console.error('Error performing search:', error);
        }
    }

    async performUserSearch() {
        const username = document.getElementById('user-search-input').value.trim();
        if (!username) return;

        this.showLoading(true);
        try {
            // Load user info and playlists
            const [userInfo, playlists] = await Promise.all([
                this.loadUserInfo(username),
                this.loadUserPlaylists(username)
            ]);

            this.renderUserInfo(userInfo);
            this.renderUserPlaylists(playlists);
            this.showLoading(false);
        } catch (error) {
            this.showError('User not found or has no public playlists. Please check the username and try again.');
            console.error('Error performing user search:', error);
        }
    }

    switchView(viewName) {
        console.log(`🔄 Frontend: switchView called with "${viewName}"`);
        console.trace('📍 Call stack for switchView');
        
        // Update URL hash (but don't trigger hashchange event if it's already correct)
        if (window.location.hash.slice(1) !== viewName) {
            this.updateUrl(viewName);
        }
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
        }

        // Load data for specific views
        this.handleViewSpecificData(viewName);
        
        // Handle currently playing interval
        this.handleCurrentlyPlayingInterval(viewName);
    }

    handleCurrentlyPlayingInterval(viewName) {
        // Clear existing interval
        if (this.currentlyPlayingInterval) {
            clearInterval(this.currentlyPlayingInterval);
            this.currentlyPlayingInterval = null;
        }
        
        // Start new interval if currently playing view is active
        if (viewName === 'currently-playing') {
            this.currentlyPlayingInterval = setInterval(() => {
                this.loadCurrentlyPlayingView();
            }, 5000); // Update every 5 seconds
        }
    }

    async handleViewSpecificData(viewName) {
        switch (viewName) {
            case 'currently-playing':
                await this.loadCurrentlyPlayingView();
                break;
            case 'my-playlists':
                await this.loadMyPlaylistsView();
                break;
            case 'home':
                await this.loadFeaturedView();
                break;
            case 'top10':
                await this.loadTop10();
                break;
            case 'recent':
                await this.loadRecent();
                break;
            case 'search':
                // Clear previous search results
                document.getElementById('search-results').innerHTML = '';
                document.getElementById('search-input').value = '';
                break;
            case 'user-search':
                // Clear previous user search results
                document.getElementById('user-playlists').innerHTML = '';
                document.getElementById('user-info').classList.add('hidden');
                document.getElementById('user-search-input').value = '';
                break;
        }
    }

    async loadCurrentlyPlayingView() {
        console.log('🎵 Loading currently playing view...');
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/currently-playing');
            const data = await response.json();
            
            this.showLoading(false);
            
            if (response.status === 401) {
                // User not authenticated
                this.showNoTrackPlaying(true); // Pass true to show auth message
                return;
            }
            
            if (data.is_playing && data.item) {
                this.renderCurrentlyPlaying(data);
            } else {
                this.showNoTrackPlaying();
            }
            
        } catch (error) {
            console.error('Error loading currently playing:', error);
            this.showLoading(false);
            this.showNoTrackPlaying();
        }
    }

    renderCurrentlyPlaying(trackData) {
        const container = document.getElementById('currently-playing-content');
        const noTrackDiv = document.getElementById('no-track-playing');

        // Hide no track message
        noTrackDiv.classList.add('hidden');

        // Show track content
        container.classList.remove('hidden');

        const track = trackData.item;
        const progressPercent = trackData.progress_ms ? (trackData.progress_ms / track.duration_ms) * 100 : 0;

        // Format time
        const formatTime = (ms) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        // Check if player is initialized before showing controls
        const playerControls = this.player ? `
                <!-- Player Controls -->
                <div class="player-controls">
                    <button id="prev-btn" class="control-btn">⏮️</button>
                    <button id="play-pause-btn" class="control-btn play-btn">
                        ${trackData.is_playing ? '⏸️' : '▶️'}
                    </button>
                    <button id="next-btn" class="control-btn">⏭️</button>
                </div>

                <div class="volume-control">
                    <span class="volume-icon">🔊</span>
                    <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="0.5">
                </div>
        ` : `
                <!-- Player Not Initialized Message -->
                <div class="player-inactive-message">
                    <p>🎵 Web player initializing... Start playing music in Spotify to enable controls.</p>
                </div>
        `;

        container.innerHTML = `
            <img src="${track.album.images[0]?.url || '/placeholder-album.png'}"
                 alt="${track.album.name}" class="album-art">
            <div class="track-info">
                <h2 class="track-name">${track.name}</h2>
                <p class="artist-name">${track.artists.map(a => a.name).join(', ')}</p>
                <p class="album-name">${track.album.name}</p>

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-time">
                        <span>${formatTime(trackData.progress_ms || 0)}</span>
                        <span>${formatTime(track.duration_ms)}</span>
                    </div>
                </div>

                ${playerControls}

                <div style="margin-top: 1rem;">
                    <a href="${track.external_urls.spotify}" target="_blank" class="btn btn-secondary">
                        🔗 Open in Spotify Web Player
                    </a>
                </div>
            </div>
        `;

        // Add event listeners for player controls only if player is initialized
        if (this.player) {
            this.setupPlayerControls();
        }
    }

    setupPlayerControls() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.previousTrack();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextTrack();
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(parseFloat(e.target.value));
            });
        }
    }

    showNoTrackPlaying(needsAuth = false) {
        const container = document.getElementById('currently-playing-content');
        const noTrackDiv = document.getElementById('no-track-playing');
        
        container.classList.add('hidden');
        noTrackDiv.classList.remove('hidden');
        
        if (needsAuth) {
            noTrackDiv.innerHTML = `
                <div class="no-track-icon">🔐</div>
                <h3>Authentication Required</h3>
                <p>Please log in with Spotify to view your currently playing track.</p>
                <button class="btn btn-primary" onclick="app.login()">Login with Spotify</button>
            `;
        } else {
            noTrackDiv.innerHTML = `
                <div class="no-track-icon">🎵</div>
                <h3>No Track Playing</h3>
                <p>Start playing music in Spotify to see what's currently playing here.</p>
            `;
        }
    }

    async getAccessToken() {
        try {
            const response = await fetch('/api/access-token');
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Failed to get access token:', error);
            throw error;
        }
    }

    async transferPlaybackToWebPlayer() {
        if (!this.deviceId) return;
        
        try {
            await fetch('/api/transfer-playback', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    device_id: this.deviceId
                })
            });
            console.log('🎵 Playback transferred to web player');
        } catch (error) {
            console.error('Failed to transfer playback:', error);
        }
    }

    updatePlayerUI() {
        if (!this.playerState) return;
        
        const track = this.playerState.track_window.current_track;
        const isPlaying = !this.playerState.paused;
        
        // Update currently playing display if on that view
        if (this.currentView === 'currently-playing') {
            this.renderCurrentlyPlaying({
                is_playing: isPlaying,
                progress_ms: this.playerState.position,
                item: {
                    id: track.id,
                    name: track.name,
                    artists: track.artists.map(artist => ({ name: artist.name })),
                    album: {
                        name: track.album.name,
                        images: track.album.images
                    },
                    duration_ms: track.duration_ms,
                    external_urls: { spotify: track.uri.replace('spotify:track:', 'https://open.spotify.com/track/') }
                }
            });
        }
    }

    showPlayerError(message) {
        // Show error in currently playing view
        const container = document.getElementById('currently-playing-content');
        const noTrackDiv = document.getElementById('no-track-playing');
        
        container.classList.add('hidden');
        noTrackDiv.classList.remove('hidden');
        noTrackDiv.innerHTML = `
            <div class="no-track-icon">⚠️</div>
            <h3>Player Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="btn btn-primary">
                Reload Page
            </button>
        `;
    }

    // Player control methods
    async play() {
        if (this.player) {
            await this.player.resume();
        }
    }

    async pause() {
        if (this.player) {
            await this.player.pause();
        }
    }

    async nextTrack() {
        if (this.player) {
            await this.player.nextTrack();
        }
    }

    async previousTrack() {
        if (this.player) {
            await this.player.previousTrack();
        }
    }

    async seek(position) {
        if (this.player) {
            await this.player.seek(position);
        }
    }

    async setVolume(volume) {
        if (this.player) {
            await this.player.setVolume(volume);
        }
    }

    async loadMyPlaylistsView() {
        this.showLoading(true);
        try {
            await this.loadMyPlaylists();
            await this.renderMyPlaylists();
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to load your playlists.');
        }
    }

    async loadFeaturedView() {
        this.showLoading(true);
        try {
            await this.loadFeaturedPlaylists();
            this.renderPlaylists();
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to load featured playlists.');
        }
    }

    async loadTop10() {
        this.showLoading(true);
        try {
            const playlists = await this.loadFeaturedPlaylists('tracks');
            const top10 = playlists.slice(0, 10);
            this.renderPlaylistsInContainer(top10, 'top10-grid');
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to load top 10 playlists.');
        }
    }

    async loadRecent() {
        this.showLoading(true);
        try {
            // For recent, we'll use featured playlists since we don't have user auth
            const playlists = await this.loadFeaturedPlaylists();
            this.renderPlaylistsInContainer(playlists, 'recent-grid');
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to load recent playlists.');
        }
    }

    async sortPlaylists(sortBy) {
        if (!sortBy) return;
        
        this.showLoading(true);
        try {
            await this.loadFeaturedPlaylists(sortBy);
            this.renderPlaylists();
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to sort playlists.');
        }
    }

    async sortMyPlaylists(sortBy) {
        if (!sortBy) return;
        
        this.showLoading(true);
        try {
            await this.loadMyPlaylists(sortBy);
            this.renderMyPlaylists();
            this.showLoading(false);
        } catch (error) {
            this.showError('Failed to sort your playlists.');
        }
    }

    async sortTracks(sortBy) {
        if (!sortBy || !this.currentPlaylist) return;
        
        console.log('🔄 Sorting tracks by:', sortBy);
        await this.loadPlaylistDetails(this.currentPlaylist.id, sortBy, 0);
    }

    renderPlaylists() {
        this.renderPlaylistsInContainer(this.playlists, 'playlists-grid');
    }

    renderPlaylistsInContainer(playlists, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Filter out null/undefined playlists and those missing required fields
        const validPlaylists = playlists.filter(playlist => 
            playlist && 
            playlist.id && 
            playlist.name && 
            typeof playlist === 'object'
        );
        
        console.log(`🎨 Rendering ${validPlaylists.length} valid playlists out of ${playlists.length} total`);

        if (validPlaylists.length === 0) {
            container.innerHTML = '<p class="no-results">No valid playlists found.</p>';
            return;
        }

        container.innerHTML = validPlaylists.map(playlist => this.createPlaylistCard(playlist)).join('');

        // Add click handlers
        container.querySelectorAll('.playlist-card').forEach(card => {
            card.addEventListener('click', () => {
                const playlistId = card.dataset.playlistId;
                this.openPlaylist(playlistId);
            });
        });
    }

    renderSearchResults(results) {
        this.renderPlaylistsInContainer(results, 'search-results');
    }

    renderUserInfo(userInfo) {
        const userInfoContainer = document.getElementById('user-info');
        const imageUrl = userInfo.images?.[0]?.url;

        userInfoContainer.innerHTML = `
            <div class="user-avatar">
                ${imageUrl ? 
                    `<img src="${imageUrl}" alt="${userInfo.display_name}" onerror="this.parentElement.innerHTML='👤'">` : 
                    '👤'
                }
            </div>
            <div class="user-details">
                <h3>${this.escapeHtml(userInfo.display_name || userInfo.id)}</h3>
                <p>@${this.escapeHtml(userInfo.id)}</p>
                <p class="user-followers">${userInfo.followers.toLocaleString()} followers</p>
            </div>
        `;

        userInfoContainer.classList.remove('hidden');
    }

    renderUserPlaylists(playlists) {
        this.renderPlaylistsInContainer(playlists, 'user-playlists');
    }

    async renderMyPlaylists() {
        console.log('🎨 Frontend: Rendering my playlists, count:', (this.myPlaylists || []).length);
        const container = document.getElementById('my-playlists-grid');
        // If not authenticated and there are no user playlists, show a subtle
        // prompt and fall back to featured playlists so anonymous users can
        // still browse content without being forced to log in.
        if (!this.isAuthenticated && (!this.myPlaylists || this.myPlaylists.length === 0)) {
            container.innerHTML = `
                <div class="auth-fallback">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div>
                            <h3>🔐 Your playlists</h3>
                            <p class="muted">Log in to see your personal playlists and enable the web player.</p>
                        </div>
                        <div>
                            <button class="btn btn-primary" onclick="app.login()">Login with Spotify</button>
                        </div>
                    </div>
                    <hr />
                    <div id="my-playlists-fallback" class="fallback-playlists-container"></div>
                </div>
            `;

            // Load featured playlists into the fallback container
            try {
                const featured = await this.loadFeaturedPlaylists();
                this.renderPlaylistsInContainer(featured, 'my-playlists-fallback');
            } catch (err) {
                console.debug('Failed to load fallback playlists:', err?.message || err);
                container.querySelector('#my-playlists-fallback').innerHTML = '<p class="no-results">No playlists available.</p>';
            }
            return;
        }
        
        // Show playlists (either authenticated or fallback)
    this.renderPlaylistsInContainer(this.myPlaylists || [], 'my-playlists-grid');
        
        // Show a message if these are fallback playlists
        if (!this.isAuthenticated && this.myPlaylists && this.myPlaylists.length > 0) {
            this.showDataSourceMessage('fallback', `Showing playlists for ${this.currentUser} (demo mode - login for your playlists)`);
        }
    }

    createPlaylistCard(playlist) {
        // Handle different data structures safely
        const images = playlist.images || [];
        const imageUrl = Array.isArray(images) && images.length > 0 ? images[0]?.url : null;
        const trackCount = playlist.tracks?.total || playlist.track_count || 0;
        const owner = playlist.owner?.display_name || 'Unknown';
        const createdDate = playlist.created_date ? 
            new Date(playlist.created_date).toLocaleDateString() : '';

        console.log('🎨 Creating card for playlist:', playlist.name, 'Images:', images, 'ImageUrl:', imageUrl);

        return `
            <div class="playlist-card" data-playlist-id="${playlist.id}">
                <div class="playlist-image">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${this.escapeHtml(playlist.name)}" onerror="this.parentElement.innerHTML='🎵'">` : 
                        '🎵'
                    }
                </div>
                <div class="playlist-name" title="${this.escapeHtml(playlist.name)}">${this.escapeHtml(playlist.name)}</div>
                <div class="playlist-details">${trackCount} tracks</div>
                <div class="playlist-owner">by ${this.escapeHtml(owner)}</div>
                ${createdDate ? `<div class="playlist-details">${createdDate}</div>` : ''}
            </div>
        `;
    }

    openPlaylist(playlistId) {
        this.switchView('playlist');
        this.loadPlaylistDetails(playlistId);
    }

    renderPlaylistView(data) {
        const { playlist, tracks, pagination } = data;
        
        // Render playlist header
        const playlistHeader = document.getElementById('playlist-header');
        const imageUrl = playlist.image;
        
        playlistHeader.innerHTML = `
            <div class="playlist-cover">
                ${imageUrl ? 
                    `<img src="${imageUrl}" alt="${playlist.name}" onerror="this.parentElement.innerHTML='🎵'">` : 
                    '🎵'
                }
            </div>
            <div class="playlist-info">
                <h1 class="playlist-title">${this.escapeHtml(playlist.name)}</h1>
                ${playlist.description ? 
                    `<p class="playlist-description">${this.escapeHtml(playlist.description)}</p>` : ''
                }
                <div class="playlist-meta">
                    <strong>${playlist.total_tracks}</strong> tracks • 
                    by <strong>${this.escapeHtml(playlist.owner)}</strong>
                </div>
                <div class="playlist-actions">
                    <button id="export-playlist-btn" class="btn btn-secondary">
                        📄 Export as Text File
                    </button>
                </div>
            </div>
        `;

        // Render tracks
        this.renderTracks(tracks);
        
        // Render pagination if needed
        this.renderPagination(pagination);
    }

    renderTracks(tracks) {
        const tracksList = document.getElementById('tracks-list');
        
        if (tracks.length === 0) {
            tracksList.innerHTML = '<p class="no-results">No tracks found in this playlist.</p>';
            return;
        }

        tracksList.innerHTML = tracks.map(track => this.createTrackItem(track)).join('');

        // Add click handlers for external links
        tracksList.querySelectorAll('.track-item').forEach(item => {
            item.addEventListener('click', () => {
                const spotifyUrl = item.dataset.spotifyUrl;
                if (spotifyUrl) {
                    window.open(spotifyUrl, '_blank');
                }
            });
        });
    }

    createTrackItem(track) {
        const addedDate = track.added_at ? 
            new Date(track.added_at).toLocaleDateString() : '';
        const artists = Array.isArray(track.artists) ? 
            track.artists.join(', ') : track.artists;

        return `
            <div class="track-item" data-spotify-url="${track.external_urls?.spotify}">
                <div class="track-number">${track.track_number}</div>
                <div class="track-image">
                    ${track.image ? 
                        `<img src="${track.image}" alt="${track.name}" onerror="this.parentElement.innerHTML='🎵'">` : 
                        '🎵'
                    }
                </div>
                <div class="track-info">
                    <div class="track-name" title="${this.escapeHtml(track.name)}">${this.escapeHtml(track.name)}</div>
                    <div class="track-artists" title="${this.escapeHtml(artists)}">${this.escapeHtml(artists)}</div>
                </div>
                <div class="track-album" title="${this.escapeHtml(track.album)}">${this.escapeHtml(track.album)}</div>
                <div class="track-added">${addedDate}</div>
                <div class="track-duration">${track.duration}</div>
            </div>
        `;
    }

    renderPagination(pagination) {
        const paginationContainer = document.getElementById('pagination');
        
        if (pagination.total <= pagination.limit) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');
        
        const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
        const totalPages = Math.ceil(pagination.total / pagination.limit);

        paginationContainer.innerHTML = `
            <button ${!pagination.previous ? 'disabled' : ''} onclick="app.loadPage(${pagination.offset - pagination.limit})">
                Previous
            </button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button ${!pagination.next ? 'disabled' : ''} onclick="app.loadPage(${pagination.offset + pagination.limit})">
                Next
            </button>
        `;
    }

    async loadPage(offset) {
        if (!this.currentPlaylist) return;
        
        const sortSelect = document.getElementById('track-sort-select');
        const currentSort = sortSelect.value;
        
        await this.loadPlaylistDetails(this.currentPlaylist.id, currentSort, offset);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        if (show) {
            loading.classList.remove('hidden');
            error.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showError(message) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const errorMessage = document.getElementById('error-message');
        
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        errorMessage.textContent = message;
    }
    
    showDataSourceMessage(source, message) {
        // Find or create a data source indicator
        let indicator = document.getElementById('data-source-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'data-source-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 70px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                max-width: 300px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(indicator);
        }
        
        // Style based on data source
        if (source === 'demo') {
            indicator.style.backgroundColor = '#ff6b6b';
            indicator.style.color = 'white';
            indicator.innerHTML = '⚠️ ' + message;
        } else if (source === 'fallback') {
            indicator.style.backgroundColor = '#ffa726';
            indicator.style.color = 'white';
            indicator.innerHTML = '🔄 ' + message;
        } else {
            indicator.style.backgroundColor = '#4caf50';
            indicator.style.color = 'white';
            indicator.innerHTML = '✅ ' + message;
        }
        
        // Auto-hide after 5 seconds for non-demo messages
        if (source !== 'demo') {
            setTimeout(() => {
                if (indicator) indicator.remove();
            }, 5000);
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async exportPlaylistToFile() {
        if (!this.currentPlaylist) {
            this.showError('No playlist selected for export');
            return;
        }

        try {
            console.log('📄 Exporting playlist to text file:', this.currentPlaylist.name);
            
            // Get all tracks for the playlist (not just the current page)
            const response = await fetch(`/api/playlist/${this.currentPlaylist.id}?limit=500&offset=0`);
            if (!response.ok) throw new Error('Failed to fetch all tracks');
            
            const data = await response.json();
            const tracks = data.tracks || [];
            
            // Create text content
            let textContent = `Playlist: ${this.currentPlaylist.name}\n`;
            textContent += `Owner: ${this.currentPlaylist.owner}\n`;
            textContent += `Total Tracks: ${tracks.length}\n`;
            textContent += `Exported: ${new Date().toLocaleString()}\n`;
            textContent += `\n${'='.repeat(80)}\n\n`;
            
            // Add header
            textContent += `${'Track'.padEnd(5)} | ${'Song Title'.padEnd(40)} | ${'Artist'.padEnd(30)} | ${'Album'.padEnd(30)} | ${'Duration'.padEnd(8)} | ${'Added Date'.padEnd(20)}\n`;
            textContent += `${'-'.repeat(5)}-+-${'-'.repeat(40)}-+-${'-'.repeat(30)}-+-${'-'.repeat(30)}-+-${'-'.repeat(8)}-+-${'-'.repeat(20)}\n`;
            
            // Add tracks
            tracks.forEach((track, index) => {
                const trackNum = String(index + 1).padEnd(5);
                const songTitle = (track.name || 'Unknown').substring(0, 40).padEnd(40);
                const artist = (track.artists?.[0] || 'Unknown Artist').substring(0, 30).padEnd(30);
                const album = (track.album || 'Unknown Album').substring(0, 30).padEnd(30);
                
                // Convert duration from ms to mm:ss
                const duration = track.duration_ms ? 
                    `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`.padEnd(8) : 
                    'Unknown '.padEnd(8);
                
                // Format added date
                const addedDate = track.added_at ? 
                    new Date(track.added_at).toLocaleDateString().padEnd(20) : 
                    'Unknown'.padEnd(20);
                
                textContent += `${trackNum} | ${songTitle} | ${artist} | ${album} | ${duration} | ${addedDate}\n`;
            });
            
            // Create and download file
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentPlaylist.name.replace(/[^a-z0-9]/gi, '_')}_playlist.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`✅ Playlist exported: ${a.download}`);
            console.log('✅ Playlist export completed successfully');
            
        } catch (error) {
            console.error('❌ Error exporting playlist:', error);
            this.showError('Failed to export playlist. Please try again.');
        }
    }

    // Spotify Web Playback SDK Methods
    async initializeSpotifyPlayer() {
        // SDK callback is already defined globally, just create player if SDK is loaded
        if (window.Spotify) {
            this.createSpotifyPlayer();
        }
    }

    createSpotifyPlayer() {
        // Only initialize player if user is authenticated
        if (!this.isAuthenticated) {
            console.log('Player not initialized - user not authenticated');
            return;
        }

        try {
            // Get access token (handle 401/403 explicitly so we can prompt re-login)
            fetch('/api/access-token')
                .then(async (response) => {
                    if (!response.ok) {
                        console.warn('No access token available for player, status=', response.status);
                        // If token missing or invalid scopes, show error instead of redirecting
                        if (response.status === 401 || response.status === 403) {
                            console.log('Access token not available - authentication may have failed');
                            this.showError('Access token not available. Please try logging in again.');
                            // Don't redirect to avoid login loop
                            // window.location.href = '/login';
                        }
                        throw new Error('No access token available');
                    }
                    return await response.json();
                })
                .then(data => {
                    if (!data.access_token) {
                        console.warn('No access token available, player will not initialize');
                        return;
                    }

                    // Create player
                    this.player = new Spotify.Player({
                        name: 'Spotify Fan Web Player',
                        getOAuthToken: cb => { cb(data.access_token); },
                        volume: 0.5
                    });

                    // Set up player event listeners
                    this.player.addListener('ready', ({ device_id }) => {
                        console.log('Ready with Device ID', device_id);
                        this.deviceId = device_id;
                        // Removed automatic transfer - player will show but not take control
                        // this.transferPlaybackToWebPlayer();
                    });

                    this.player.addListener('not_ready', ({ device_id }) => {
                        console.log('Device ID has gone offline', device_id);
                        this.playerState = null;
                        this.updatePlayerUI(null);
                    });

                    this.player.addListener('player_state_changed', (state) => {
                        if (state) {
                            console.log('Player state changed:', state);
                            this.playerState = state;
                            this.updatePlayerUI(state);
                        } else {
                            this.playerState = null;
                            this.updatePlayerUI(null);
                        }
                    });

                    this.player.addListener('initialization_error', ({ message }) => {
                        console.error('Failed to initialize:', message);
                        this.showError('Failed to initialize Spotify player. Please check your connection.');
                    });

                    this.player.addListener('authentication_error', ({ message }) => {
                        console.error('Failed to authenticate:', message);
                        this.showError('Authentication failed. Please log in again.');
                        // Don't auto-redirect to avoid login loop
                        // setTimeout(() => { window.location.href = '/login'; }, 1200);
                    });

                    this.player.addListener('account_error', ({ message }) => {
                        console.error('Failed to validate Spotify account:', message);
                        this.showError('Spotify Premium required for Web Playback SDK.');
                    });

                    this.player.connect();
                })
                .catch(error => {
                    console.error('Error getting access token:', error);
                    this.showError('Failed to get access token for player');
                });

        } catch (error) {
            console.error('Error creating Spotify player:', error);
            this.showError('Failed to create Spotify player');
        }
    }

    async transferPlaybackToWebPlayer() {
        if (!this.deviceId) {
            console.warn('No device ID available for playback transfer');
            return;
        }
        const maxAttempts = 4;
        const baseDelay = 800; // ms

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch('/api/transfer-playback', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        device_id: this.deviceId,
                        play: false // Don't auto-play, just transfer
                    })
                });

                if (response.ok) {
                    console.log('✅ Playback transferred to web player');
                    return;
                }

                // Handle specific server responses
                if (response.status === 404) {
                    // Device not found - this can happen if the SDK hasn't fully activated on Spotify's side yet
                    console.warn(`Transfer attempt ${attempt} failed: device not found (${this.deviceId})`);
                    if (attempt < maxAttempts) {
                        const wait = baseDelay * attempt;
                        console.log(`Waiting ${wait}ms before retrying transfer...`);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    // Final failure
                    const body = await response.json().catch(() => ({}));
                    console.error('❌ Final transfer error (device not found):', body);
                    this.showError('Playback device not found — make sure Spotify is open and the web player is connected (Premium required).');
                    return;
                }

                // Other non-OK responses
                const errBody = await response.json().catch(() => ({}));
                throw new Error(`Transfer failed: ${response.status} ${JSON.stringify(errBody)}`);
            } catch (error) {
                console.error(`❌ Error transferring playback (attempt ${attempt}):`, error);
                if (attempt < maxAttempts) {
                    const wait = baseDelay * attempt;
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                this.showError('Failed to transfer playback to web player. Please ensure Spotify is open and try again.');
            }
        }
    }

    async togglePlayPause() {
        if (!this.player) return;
        
        try {
            const state = await this.player.getCurrentState();
            if (state && !state.paused) {
                await this.player.pause();
            } else {
                await this.player.resume();
            }
        } catch (error) {
            console.error('Error toggling play/pause:', error);
            this.showError('Failed to toggle playback');
        }
    }

    async nextTrack() {
        if (!this.player) return;
        
        try {
            await this.player.nextTrack();
        } catch (error) {
            console.error('Error skipping to next track:', error);
            this.showError('Failed to skip to next track');
        }
    }

    async previousTrack() {
        if (!this.player) return;
        
        try {
            await this.player.previousTrack();
        } catch (error) {
            console.error('Error going to previous track:', error);
            this.showError('Failed to go to previous track');
        }
    }

    async setVolume(volume) {
        if (!this.player) return;
        
        try {
            await this.player.setVolume(volume);
        } catch (error) {
            console.error('Error setting volume:', error);
        }
    }

    updatePlayerUI(state) {
        if (!state) return;

        // Update play/pause button
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = state.paused ? '▶️' : '⏸️';
        }

        // Update progress bar if currently playing view is active
        if (this.currentView === 'currently-playing') {
            const progressFill = document.querySelector('.progress-fill');
            const progressTime = document.querySelector('.progress-time');
            
            if (progressFill && progressTime && state.track_window.current_track) {
                const currentTrack = state.track_window.current_track;
                const progressPercent = (state.position / currentTrack.duration_ms) * 100;
                progressFill.style.width = `${progressPercent}%`;
                
                const formatTime = (ms) => {
                    const minutes = Math.floor(ms / 60000);
                    const seconds = Math.floor((ms % 60000) / 1000);
                    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                };
                
                progressTime.innerHTML = `
                    <span>${formatTime(state.position)}</span>
                    <span>${formatTime(currentTrack.duration_ms)}</span>
                `;
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SpotifyFanApp();
});

// Service Worker registration disabled for development to prevent caching issues
// Uncomment this block when ready for production
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
*/