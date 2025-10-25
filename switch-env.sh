#!/bin/bash

# Environment switcher for Cloudflare tunnels
# Usage: ./switch-env.sh [dev|test|prod]

set -e

ENV=${1:-dev}

case $ENV in
    dev|test|prod)
        echo "🔄 Switching to $ENV environment..."

        # Update .env file
        sed -i "s/^CLOUDFLARED_ENV=.*/CLOUDFLARED_ENV=$ENV/" .env

        # Set the appropriate token based on environment
        case $ENV in
            dev)
                TOKEN_VAR="CLOUDFLARED_TOKEN_DEV"
                ;;
            test)
                TOKEN_VAR="CLOUDFLARED_TOKEN_TEST"
                ;;
            prod)
                TOKEN_VAR="CLOUDFLARED_TOKEN_PROD"
                ;;
        esac

        # Extract token value and set CLOUDFLARED_TOKEN
        TOKEN_VALUE=$(grep "^$TOKEN_VAR=" .env | cut -d'=' -f2-)
        if [ -z "$TOKEN_VALUE" ] || [ "$TOKEN_VALUE" = "your_${ENV}_tunnel_token_here" ]; then
            echo "❌ $TOKEN_VAR not configured in .env"
            echo "   Please set $TOKEN_VAR in your .env file"
            exit 1
        fi

        # Update or add CLOUDFLARED_TOKEN
        if grep -q "^CLOUDFLARED_TOKEN=" .env; then
            sed -i "s/^CLOUDFLARED_TOKEN=.*/CLOUDFLARED_TOKEN=$TOKEN_VALUE/" .env
        else
            echo "CLOUDFLARED_TOKEN=$TOKEN_VALUE" >> .env
        fi

        echo "✅ Switched to $ENV environment"
        echo "   Active token: $TOKEN_VAR"
        ;;
    *)
        echo "❌ Invalid environment: $ENV"
        echo "   Valid options: dev, test, prod"
        exit 1
        ;;
esac