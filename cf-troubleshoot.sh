#!/bin/bash

# Cloudflare API Troubleshooting Script
# Usage: ./cf-troubleshoot.sh <api_token> [fix]

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <cloudflare_api_token> [fix]"
    echo ""
    echo "🔑 Create an API token at: https://dash.cloudflare.com/profile/api-tokens"
    echo "   Required permissions:"
    echo "   - Account: Cloudflare Tunnel: Read"
    echo "   - Zone: DNS: Edit"
    echo "   - Zone: Zone: Read"
    echo "   - Account: Account: Read"
    echo ""
    echo "💡 Add 'fix' as second argument to automatically create/update DNS records"
    exit 1
fi

CF_API_TOKEN="$1"
AUTO_FIX="${2:-false}"
DOMAIN="theangrygamershow.com"
SUBDOMAIN="sc.${DOMAIN}"

echo "🔍 Troubleshooting Cloudflare configuration for ${SUBDOMAIN}"
if [ "$AUTO_FIX" = "fix" ]; then
    echo "🔧 Auto-fix mode enabled - will attempt to create/update DNS records"
fi
echo "================================================================="

# Function to make API calls
cf_api() {
    curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
         -H "Content-Type: application/json" \
         "$@"
}

echo ""
echo "1️⃣ Getting Account Information..."
ACCOUNT_INFO=$(cf_api "https://api.cloudflare.com/client/v4/accounts")
ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | jq -r '.result[0].id // empty')

if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Failed to get account ID. Check your API token permissions."
    echo "$ACCOUNT_INFO" | jq '.errors // .'
    exit 1
fi

echo "✅ Account ID: ${ACCOUNT_ID}"

echo ""
echo "2️⃣ Getting Zone Information for ${DOMAIN}..."
ZONE_INFO=$(cf_api "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}")
ZONE_ID=$(echo "$ZONE_INFO" | jq -r '.result[0].id // empty')

if [ -z "$ZONE_ID" ]; then
    echo "❌ Failed to get zone ID for ${DOMAIN}. Make sure the domain is added to Cloudflare."
    echo "$ZONE_INFO" | jq '.errors // .'
    exit 1
fi

echo "✅ Zone ID: ${ZONE_ID}"

echo ""
echo "3️⃣ Checking DNS Records for ${SUBDOMAIN}..."
DNS_RECORDS=$(cf_api "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${SUBDOMAIN}")

echo "$DNS_RECORDS" | jq -r '.result[] | "📝 \(.type) \(.name) -> \(.content) (TTL: \(.ttl), Proxied: \(.proxied // "N/A"))"'

RECORD_COUNT=$(echo "$DNS_RECORDS" | jq '.result | length')
if [ "$RECORD_COUNT" -eq 0 ]; then
    echo "⚠️  No DNS records found for ${SUBDOMAIN}"
fi

echo ""
echo "4️⃣ Checking Cloudflare Tunnels..."
TUNNELS=$(cf_api "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel")

echo "$TUNNELS" | jq -r '.result[] | "🌐 Tunnel: \(.name) (ID: \(.id), Status: \(.status))"'

TUNNEL_COUNT=$(echo "$TUNNELS" | jq '.result | length')
if [ "$TUNNEL_COUNT" -eq 0 ]; then
    echo "⚠️  No tunnels found in this account"
fi

echo ""
echo "5️⃣ Checking Tunnel Configurations..."
echo "$TUNNELS" | jq -r '.result[] | "🔧 \(.name): \(.config.ingress // [] | map("\(.hostname // "N/A") -> \(.service // "N/A")") | join(", "))"'

echo ""
echo "6️⃣ Analyzing DNS Configuration..."
SUBDOMAIN_RECORD=$(echo "$DNS_RECORDS" | jq -r '.result[0] // empty')

if [ -n "$SUBDOMAIN_RECORD" ]; then
    RECORD_TYPE=$(echo "$SUBDOMAIN_RECORD" | jq -r '.type')
    RECORD_CONTENT=$(echo "$SUBDOMAIN_RECORD" | jq -r '.content')
    RECORD_PROXIED=$(echo "$SUBDOMAIN_RECORD" | jq -r '.proxied')
    RECORD_ID=$(echo "$SUBDOMAIN_RECORD" | jq -r '.id')
    
    echo "📋 Current DNS Record for ${SUBDOMAIN}:"
    echo "   Type: ${RECORD_TYPE}"
    echo "   Content: ${RECORD_CONTENT}"
    echo "   Proxied: ${RECORD_PROXIED}"
    
    # Check if it's pointing to a tunnel domain
    if [[ "$RECORD_CONTENT" == *".cfargotunnel.com" ]]; then
        echo "✅ DNS record points to Cloudflare Tunnel domain"
        if [ "$RECORD_PROXIED" = "true" ]; then
            echo "✅ DNS record is properly proxied"
        else
            echo "⚠️  DNS record is not proxied - traffic won't go through Cloudflare"
        fi
    else
        echo "❌ DNS record does NOT point to a tunnel domain"
        echo "   Current target: ${RECORD_CONTENT}"
        echo ""
        echo "🔧 To fix this, update the DNS record to point to your tunnel domain"
    fi
else
    echo "❌ No DNS record found for ${SUBDOMAIN}"
    echo ""
    echo "🔧 Need to create CNAME record pointing to tunnel domain"
fi

echo ""
echo "================================================================="
echo "🎯 Summary:"
echo "- Account: ${ACCOUNT_ID}"
echo "- Zone: ${ZONE_ID} (${DOMAIN})"
echo "- DNS Records for ${SUBDOMAIN}: ${RECORD_COUNT}"
echo "- Tunnels: ${TUNNEL_COUNT}"

if [ -z "$SUBDOMAIN_RECORD" ]; then
    echo ""
    echo "� ISSUE: No DNS record for ${SUBDOMAIN}"
    echo "💡 SOLUTION: Create CNAME record pointing to tunnel domain"
    echo ""
    echo "🔧 API Command to create DNS record:"
    echo "curl -X POST \"https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records\" \\"
    echo "     -H \"Authorization: Bearer ${CF_API_TOKEN}\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{"
    echo "       \"type\": \"CNAME\","
    echo "       \"name\": \"${SUBDOMAIN}\","
    echo "       \"content\": \"YOUR_TUNNEL_DOMAIN.cfargotunnel.com\","
    echo "       \"ttl\": 1,"
    echo "       \"proxied\": true"
    echo "     }'"
elif [[ "$RECORD_CONTENT" != *".cfargotunnel.com" ]]; then
    echo ""
    echo "� ISSUE: DNS record points to wrong target"
    echo "💡 SOLUTION: Update CNAME record to point to tunnel domain"
    echo ""
    echo "🔧 API Command to update DNS record:"
    echo "curl -X PUT \"https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}\" \\"
    echo "     -H \"Authorization: Bearer ${CF_API_TOKEN}\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{"
    echo "       \"type\": \"CNAME\","
    echo "       \"name\": \"${SUBDOMAIN}\","
    echo "       \"content\": \"YOUR_TUNNEL_DOMAIN.cfargotunnel.com\","
    echo "       \"ttl\": 1,"
    echo "       \"proxied\": true"
    echo "     }'"
elif [ "$RECORD_PROXIED" != "true" ]; then
    echo ""
    echo "🚨 ISSUE: DNS record is not proxied"
    echo "💡 SOLUTION: Enable proxying for the DNS record"
    echo ""
    echo "🔧 API Command to enable proxying:"
    echo "curl -X PATCH \"https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}\" \\"
    echo "     -H \"Authorization: Bearer ${CF_API_TOKEN}\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{"
    echo "       \"proxied\": true"
    echo "     }'"
else
    echo ""
    echo "✅ DNS configuration looks correct!"
    echo "🎉 The tunnel should work once DNS propagates (may take a few minutes)"
fi

echo ""
echo "================================================================="

# Auto-fix functionality
if [ "$AUTO_FIX" = "fix" ]; then
    echo "🔧 AUTO-FIX MODE: Attempting to fix DNS configuration..."
    
    # Get tunnel domain from the tunnel configuration
    TUNNEL_DOMAIN=$(echo "$TUNNELS" | jq -r '.result[0].id // empty')
    
    if [ -z "$TUNNEL_DOMAIN" ]; then
        echo "❌ Cannot determine tunnel domain automatically"
        echo "   Please check your tunnel configuration in Cloudflare dashboard"
        exit 1
    fi
    
    TUNNEL_DOMAIN="${TUNNEL_DOMAIN}.cfargotunnel.com"
    echo "🎯 Using tunnel domain: ${TUNNEL_DOMAIN}"
    
    if [ -z "$SUBDOMAIN_RECORD" ]; then
        echo "📝 Creating new CNAME record for ${SUBDOMAIN}..."
        
        CREATE_RESPONSE=$(cf_api -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
            -d "{\"type\":\"CNAME\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${TUNNEL_DOMAIN}\",\"ttl\":1,\"proxied\":true}")
        
        SUCCESS=$(echo "$CREATE_RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            echo "✅ DNS record created successfully!"
            echo "⏱️  DNS propagation may take a few minutes"
        else
            echo "❌ Failed to create DNS record:"
            echo "$CREATE_RESPONSE" | jq '.errors'
        fi
        
    elif [[ "$RECORD_CONTENT" != *".cfargotunnel.com" ]] || [ "$RECORD_PROXIED" != "true" ]; then
        echo "📝 Updating existing DNS record for ${SUBDOMAIN}..."
        
        UPDATE_RESPONSE=$(cf_api -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
            -d "{\"type\":\"CNAME\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${TUNNEL_DOMAIN}\",\"ttl\":1,\"proxied\":true}")
        
        SUCCESS=$(echo "$UPDATE_RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            echo "✅ DNS record updated successfully!"
            echo "⏱️  DNS propagation may take a few minutes"
        else
            echo "❌ Failed to update DNS record:"
            echo "$UPDATE_RESPONSE" | jq '.errors'
        fi
    else
        echo "✅ DNS record already correctly configured"
    fi
    
    echo ""
    echo "🧪 Testing the fix..."
    sleep 5
    echo "curl -I https://sc.theangrygamershow.com/healthz"
    curl -I https://sc.theangrygamershow.com/healthz 2>/dev/null | head -3
fi