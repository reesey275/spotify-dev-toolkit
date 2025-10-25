#!/bin/bash

echo "🔍 Spotify Dev Workflow Status:"
echo "📊 Screen Sessions: $(screen -ls 2>/dev/null | grep -c spotify-dev || echo 0)"
echo "🌐 Port 5500: $(lsof -i :5500 >/dev/null 2>&1 && echo '✅ In use' || echo '❌ Free')"
echo "📝 Recent Logs: $(tail -1 server.log 2>/dev/null || echo 'No logs')"
echo "🗂️  Sessions DB: $([ -f sessions.db ] && echo '✅ Exists' || echo '❌ Missing')"
echo ""
echo "🚀 Quick Commands:"
echo "   Start:  npm run dev:screen"
echo "   Status: npm run workflow:status"
echo "   Stop:   npm run dev:screen:stop"
echo "   Logs:   tail -f server.log"