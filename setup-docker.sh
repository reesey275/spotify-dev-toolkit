#!/bin/bash

# Spotify Fan - Docker Setup Script
# This script configures the environment for Docker deployment on Ubuntu/WSL2

set -e

echo "🎵 Spotify Fan - Docker Setup"
echo "=============================="

# Check if running in WSL2 or native Ubuntu
if [[ -f /proc/version ]] && grep -q "Microsoft" /proc/version; then
    IS_WSL2=true
    echo "✅ Running in WSL2 environment"
elif [[ -f /etc/os-release ]] && grep -q "Ubuntu" /etc/os-release; then
    IS_WSL2=false
    echo "✅ Running on native Ubuntu system"
else
    echo "❌ This script is designed for Ubuntu or WSL2 environments."
    echo "   Current system may not be supported."
    exit 1
fi

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

# Update .env with current UID/GID if not set (needed for Docker user mapping)
if ! grep -q "^APP_UID=" .env; then
    echo "APP_UID=$APP_UID" >> .env
    echo "APP_GID=$APP_GID" >> .env
    echo "✅ Added APP_UID and APP_GID to .env"
else
    echo "✅ APP_UID and APP_GID already configured in .env"
fi

# Check Docker installation
if ! command -v docker &> /dev/null; then
    if [[ "$IS_WSL2" == "true" ]]; then
        echo "❌ Docker is not installed. Please install Docker Desktop for Windows and enable WSL2 integration."
    else
        echo "❌ Docker is not installed. Please install Docker using:"
        echo "   sudo apt update && sudo apt install docker.io docker-compose"
        echo "   sudo usermod -aG docker $USER"
        echo "   # Then logout and login again, or run: newgrp docker"
    fi
    exit 1
fi

echo "✅ Docker is installed"

# Check docker compose
if ! docker compose version &> /dev/null; then
    if [[ "$IS_WSL2" == "true" ]]; then
        echo "❌ Docker Compose is not available. Please ensure Docker Desktop is properly installed."
    else
        echo "❌ Docker Compose is not available. Please install it using:"
        echo "   sudo apt install docker-compose"
    fi
    exit 1
fi

echo "✅ Docker Compose is available"

# Test Docker connectivity
echo "🐳 Testing Docker connectivity..."
if ! docker ps &> /dev/null; then
    if [[ "$IS_WSL2" == "true" ]]; then
        echo "❌ Cannot connect to Docker daemon. Please ensure Docker Desktop is running and WSL2 integration is enabled."
    else
        echo "❌ Cannot connect to Docker daemon. Please ensure Docker service is running:"
        echo "   sudo systemctl start docker"
        echo "   sudo systemctl enable docker"
    fi
    exit 1
fi

echo "✅ Docker daemon is accessible"

echo ""
echo "🎉 Docker setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your credentials"
echo "2. Run 'make up' to start the services"
echo "3. Run 'make health' to check service status"
echo ""
echo "For more commands, run 'make help'"