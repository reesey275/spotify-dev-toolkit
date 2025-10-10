// Spotify Fan Website - Main JavaScript
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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupHashRouting();
        this.loadInitialData();
    }

    getViewFromUrl() {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        const validViews = ['my-playlists', 'home', 'search', 'user-search', 'top10'];
        return validViews.includes(hash) ? hash : null;
    }

    updateUrl(viewName) {
        window.location.hash = viewName;
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

    async loadInitialData() {
        this.showLoading(true);
        try {
            console.log(`🚀 Frontend: loadInitialData called for view "${this.currentView}"`);
            
            // Load data based on the current view
            if (this.currentView === 'my-playlists' || !this.currentView) {
                // Always load user playlists as they're most commonly used
                await this.loadMyPlaylists();
                this.renderMyPlaylists();
            } else {
                // For other views, let switchView handle the data loading
                // but still load user playlists in background for navigation
                await this.loadMyPlaylists();
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
            if (!response.ok) throw new Error('Failed to fetch your playlists');
            
            const data = await response.json();
            console.log('📊 Frontend: Received data:', data);
            console.log('📋 Frontend: Number of playlists:', data.playlists?.length);
            this.myPlaylists = data.playlists;
            this.currentUser = data.username;
            return this.myPlaylists;
        } catch (error) {
            console.error('❌ Frontend: Error loading your playlists:', error);
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
    }

    async handleViewSpecificData(viewName) {
        switch (viewName) {
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

    async loadMyPlaylistsView() {
        this.showLoading(true);
        try {
            await this.loadMyPlaylists();
            this.renderMyPlaylists();
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

    renderMyPlaylists() {
        console.log('🎨 Frontend: Rendering my playlists, count:', (this.myPlaylists || []).length);
        this.renderPlaylistsInContainer(this.myPlaylists || [], 'my-playlists-grid');
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