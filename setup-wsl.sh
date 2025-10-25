#!/bin/bash

# Spotify Fan - WSL2 Setup Script
# This script configures the WSL2 environment for Docker deployment

set -e

echo "🎵 Spotify Fan - WSL2 Docker Setup"
echo "=================================="

# Check if running in WSL2
if [[ ! -f /proc/version ]] || ! grep -q "Microsoft" /proc/version; then
    echo "❌ This script is designed for WSL2. Please run it in a WSL2 environment."
    exit 1
fi

echo "✅ Running in WSL2 environment"

# Get current user ID and group ID
APP_UID=$(id -u)
APP_GID=$(id -g)

echo "👤 Current user: $(whoami) (UID: $APP_UID, GID: $APP_GID)"

# Create database files if they don't exist
echo "💾 Setting up database files..."

touch sessions.db
touch spotify_cache.db

# Set proper permissions for database files
chmod 664 sessions.db
chmod 664 spotify_cache.db

echo "✅ Database files created with proper permissions"

# Check if .env file exists
if [[ ! -f .env ]]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual credentials:"
    echo "   - SPOTIFY_CLIENT_ID"
    echo "   - SPOTIFY_CLIENT_SECRET"
    echo "   - CLOUDFLARED_TOKEN"
    echo "   - SESSION_SECRET"
else
    echo "✅ .env file already exists"
fi

# Update .env with current UID/GID if not set
if ! grep -q "^APP_UID=" .env; then
    echo "APP_UID=$APP_UID" >> .env
    echo "APP_GID=$APP_GID" >> .env
    echo "✅ Added APP_UID and APP_GID to .env"
else
    echo "✅ APP_UID and APP_GID already configured in .env"
fi

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop for Windows and enable WSL2 integration."
    exit 1
fi

echo "✅ Docker is installed"

# Check docker compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please ensure Docker Desktop is properly installed."
    exit 1
fi

echo "✅ Docker Compose is available"

# Test Docker connectivity
echo "🐳 Testing Docker connectivity..."
if ! docker ps &> /dev/null; then
    echo "❌ Cannot connect to Docker daemon. Please ensure Docker Desktop is running and WSL2 integration is enabled."
    exit 1
fi

echo "✅ Docker daemon is accessible"

echo ""
echo "🎉 WSL2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your credentials"
echo "2. Run 'make up' to start the services"
echo "3. Run 'make health' to check service status"
echo ""
echo "For more commands, run 'make help'"