#!/bin/bash

# Demo Setup Script for Spotify Fan Website

echo "🎵 Welcome to the Spotify Fan Website Demo!"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
fi

echo "🔧 To fully use this website, you'll need Spotify API credentials:"
echo ""
echo "1. Go to: https://developer.spotify.com/dashboard"
echo "2. Create a new app"
echo "3. Copy your Client ID and Client Secret"
echo "4. Edit the .env file and add your credentials"
echo ""
echo "For now, you can run the demo with limited functionality:"
echo ""

read -p "Press Enter to start the demo server..."

echo ""
echo "🚀 Starting demo server..."
echo "   Visit: http://127.0.0.1:5500"
echo "   Try the 'User Search' feature with usernames like: spotify, taylorswift13, etc."
echo ""

npm start