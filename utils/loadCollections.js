const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load and parse collections.yml
function loadCollections() {
    try {
        const configPath = path.join(__dirname, '..', 'config', 'collections.yml');
        const fileContents = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(fileContents);

        // Validate basic structure
        if (!config.collections) {
            throw new Error('collections.yml must have a "collections" key');
        }

        return config;
    } catch (error) {
        console.error('Error loading collections config:', error.message);
        throw error;
    }
}

// Get all playlist IDs from collections
function getAllPlaylistIds() {
    const config = loadCollections();
    const allIds = new Set();

    // Extract from collections
    Object.values(config.collections).forEach(category => {
        Object.values(category).forEach(collection => {
            if (collection.playlist_ids) {
                collection.playlist_ids.forEach(id => allIds.add(id));
            }
        });
    });

    return Array.from(allIds);
}

module.exports = {
    loadCollections,
    getAllPlaylistIds
};