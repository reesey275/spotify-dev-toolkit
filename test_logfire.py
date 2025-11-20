#!/usr/bin/env python3
"""Quick test to verify Logfire instrumentation is working."""

import sys

try:
    import logfire
    logfire.configure()
    
    logfire.info('Test: Logfire configuration successful')
    logfire.info('Test: Spotify toolkit ready', 
                 toolkit='spotify-dev-toolkit',
                 python_version=sys.version.split()[0],
                 test_status='passed')
    
    print("✅ Logfire is configured and logging")
    print("🔗 View logs at: https://logfire-us.pydantic.dev/reesey275/spotify")
    
except Exception as e:
    print(f"❌ Logfire test failed: {e}")
    sys.exit(1)
