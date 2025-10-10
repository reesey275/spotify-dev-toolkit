#!/bin/bash

# Spotify Fan Website - Quick Start Script

echo "🎵 Spotify Fan Website Setup"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📋 Setting up environment file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your Spotify credentials:"
    echo "   - SPOTIFY_CLIENT_ID"
    echo "   - SPOTIFY_CLIENT_SECRET"
    echo "   - SPOTIFY_USER_ID (optional)"
    echo ""
    echo "Get credentials at: https://developer.spotify.com/dashboard"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting Spotify Fan Website..."
echo "   Server will run at: http://localhost:5500"
echo "   Press Ctrl+C to stop"
echo ""

# Start the server
npm start