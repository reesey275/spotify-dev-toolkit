#!/usr/bin/env node

const { execSync } = require('child_process');

const SESSION = process.env.SPOTIFY_SCREEN_SESSION || 'spotify-dev';
const PORT = Number(process.env.PORT || 5500);

function portInUse(port) {
  try {
    // Linux: lsof; fallback to nc
    execSync(`lsof -i :${port} -sTCP:LISTEN -t`, { stdio: 'ignore' });
    return true;
  } catch {
    try { execSync(`nc -z 127.0.0.1 ${port}`, { stdio: 'ignore' }); return true; } catch { return false; }
  }
}

function validateWorkflow(mode = 'direct') {
  if (mode === 'screen') {
    // When starting screen, check if port is already in use
    if (portInUse(PORT)) {
      console.error(`❌ Port ${PORT} is already in use. Run: npm run dev:screen:stop && npm run dev:screen`);
      process.exit(1);
    }
    console.log('✅ Port check passed - starting server in screen');
    return true;
  }

  // Default: Check if we're running inside a screen session
  const inScreen = process.env.STY || process.env.TERM === 'screen';

  if (inScreen) {
    console.log('✅ Running inside screen session - workflow compliant');
    return true;
  }

  console.error('❌ Direct npm run dev not allowed outside screen session');
  console.error('💡 Correct workflow:');
  console.error('   1. Start server: npm run dev:screen');
  console.error('   2. Check status: npm run workflow:status');
  console.error('   3. Monitor logs: tail -f server.log');
  console.error('   4. Stop server: npm run dev:screen:stop');
  process.exit(1);
}

if (require.main === module) {
  const mode = process.argv[2] || 'direct';
  validateWorkflow(mode);
}

module.exports = { validateWorkflow };