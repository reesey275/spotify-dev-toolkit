// Add this method to the SpotifyFanApp class
async loadCollectionsView() {
    console.log('🎵 Loading collections view...');

    try {
        this.showLoading(true);

        const response = await fetch('/api/collections');
        if (!response.ok) {
            throw new Error(`Failed to fetch collections: ${response.status}`);
        }

        const data = await response.json();
        console.log('📊 Collections data:', data);

        this.renderCollections(data.collections);
        this.showLoading(false);

        // Show data source message if applicable
        if (data.source && data.message) {
            this.showDataSourceMessage(data.source, data.message);
        }

    } catch (error) {
        console.error('Error loading collections:', error);
        this.showLoading(false);
        this.showError('Failed to load collections. Please try again.');
    }
}

// Add this method to render collections
renderCollections(collections) {
    const container = document.getElementById('collections-container');

    if (!collections || collections.length === 0) {
        container.innerHTML = '<p class="no-results">No collections available.</p>';
        return;
    }

    container.innerHTML = collections.map(collection => `
        <div class="collection-card" data-collection-type="${collection.category}" data-collection-id="${collection.id}">
            <div class="collection-header">
                <div class="collection-icon">${collection.icon}</div>
                <div class="collection-info">
                    <h3 class="collection-name">${this.escapeHtml(collection.name)}</h3>
                    <p class="collection-description">${this.escapeHtml(collection.description)}</p>
                    <div class="collection-tags">
                        ${collection.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
                <div class="collection-color" style="background-color: ${collection.color}"></div>
            </div>
            <div class="collection-playlists">
                ${collection.playlists.slice(0, 3).map(playlist => `
                    <div class="mini-playlist-card" onclick="app.openPlaylist('${playlist.id}')">
                        <div class="mini-playlist-image">
                            ${playlist.cover ? `<img src="${playlist.cover}" alt="${playlist.name}">` : '🎵'}
                        </div>
                        <div class="mini-playlist-info">
                            <div class="mini-playlist-name">${this.escapeHtml(playlist.name)}</div>
                            <div class="mini-playlist-details">${playlist.track_count} tracks</div>
                        </div>
                    </div>
                `).join('')}
                ${collection.playlists.length > 3 ? `
                    <div class="show-more-playlists" onclick="app.showCollectionPlaylists('${collection.category}', '${collection.id}')">
                        +${collection.playlists.length - 3} more playlists
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Add click handlers for collection cards
    container.querySelectorAll('.collection-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.collectionType;
            const id = card.dataset.collectionId;
            this.loadCollectionDetails(type, id);
        });
    });
}

// Add this method to load specific collection details
async loadCollectionDetails(type, id) {
    console.log(`🎵 Loading collection details: ${type}/${id}`);

    try {
        this.showLoading(true);

        const response = await fetch(`/api/collections/${type}/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch collection: ${response.status}`);
        }

        const data = await response.json();
        console.log('📊 Collection details:', data);

        this.renderCollectionDetails(data.collection, data.pagination);
        this.showLoading(false);

    } catch (error) {
        console.error('Error loading collection details:', error);
        this.showLoading(false);
        this.showError('Failed to load collection details. Please try again.');
    }
}

// Add this method to render collection details
renderCollectionDetails(collection, pagination) {
    const container = document.getElementById('collection-details-container');

    // Render collection header
    const headerHtml = `
        <div class="collection-header-large">
            <div class="collection-icon-large">${collection.icon}</div>
            <div class="collection-info-large">
                <h1 class="collection-title">${this.escapeHtml(collection.name)}</h1>
                <p class="collection-description-large">${this.escapeHtml(collection.description)}</p>
                <div class="collection-meta">
                    <span class="collection-category">${this.escapeHtml(collection.category)}</span>
                    <span class="collection-playlist-count">${collection.playlists.length} playlists</span>
                </div>
                <div class="collection-tags-large">
                    ${collection.tags.map(tag => `<span class="tag-large">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        </div>
    `;

    // Render playlists grid
    const playlistsHtml = `
        <div class="collection-playlists-grid">
            ${collection.playlists.map(playlist => `
                <div class="playlist-card" onclick="app.openPlaylist('${playlist.id}')">
                    <div class="playlist-image">
                        ${playlist.cover ? `<img src="${playlist.cover}" alt="${playlist.name}">` : '🎵'}
                    </div>
                    <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                    <div class="playlist-details">${playlist.track_count} tracks</div>
                    <div class="playlist-owner">by ${this.escapeHtml(playlist.owner)}</div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = headerHtml + playlistsHtml;

    // Handle pagination if needed
    if (pagination && (pagination.hasNext || pagination.hasPrevious)) {
        this.renderCollectionPagination(pagination, collection.category, collection.id);
    }
}

// Add this method to handle collection pagination
renderCollectionPagination(pagination, type, id) {
    const paginationContainer = document.getElementById('collection-pagination');

    if (pagination.total <= pagination.limit) {
        paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    paginationContainer.innerHTML = `
        <button ${!pagination.hasPrevious ? 'disabled' : ''} onclick="app.loadCollectionPage('${type}', '${id}', ${pagination.offset - pagination.limit})">
            Previous
        </button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button ${!pagination.hasNext ? 'disabled' : ''} onclick="app.loadCollectionPage('${type}', '${id}', ${pagination.offset + pagination.limit})">
            Next
        </button>
    `;
}

// Add this method to load collection pages
async loadCollectionPage(type, id, offset) {
    const limit = 20; // Match default limit
    await this.loadCollectionDetailsWithPagination(type, id, limit, offset);
}

// Add this method for paginated collection loading
async loadCollectionDetailsWithPagination(type, id, limit, offset) {
    console.log(`🎵 Loading collection page: ${type}/${id}?limit=${limit}&offset=${offset}`);

    try {
        this.showLoading(true);

        const response = await fetch(`/api/collections/${type}/${id}?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch collection page: ${response.status}`);
        }

        const data = await response.json();
        this.renderCollectionDetails(data.collection, data.pagination);
        this.showLoading(false);

    } catch (error) {
        console.error('Error loading collection page:', error);
        this.showLoading(false);
        this.showError('Failed to load collection page. Please try again.');
    }
}

// Add this method to show all playlists in a collection
showCollectionPlaylists(type, id) {
    // Navigate to the specific collection view
    this.switchView('collection-details');
    this.loadCollectionDetails(type, id);
}