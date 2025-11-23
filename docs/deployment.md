# Production Deployment Guide

This guide covers deploying the Spotify Fan Website to production.

## Prerequisites

- Node.js 18+
- Nginx or Caddy web server
- SSL certificate (Let's Encrypt recommended)
- Spotify Developer App credentials

## Environment Setup

1. Copy `.env.example` to `.env` and fill in production values:
```bash
SPOTIFY_CLIENT_ID=your_production_client_id
SPOTIFY_CLIENT_SECRET=your_production_client_secret
SPOTIFY_REDIRECT_URI=https://yourdomain.com/callback
SESSION_SECRET=strong_random_secret_here
NODE_ENV=production
PORT=3000
```

2. Set up SSL certificate for HTTPS (required for Spotify OAuth)

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Caddy Configuration (Alternative)

```caddyfile
yourdomain.com {
    reverse_proxy 127.0.0.1:3000

    # Automatic HTTPS
    tls your-email@example.com

    # Security headers
    header X-Frame-Options DENY
    header X-Content-Type-Options nosniff
    header Referrer-Policy strict-origin-when-cross-origin
}
```

## Process Management

Use PM2 for production process management:

```bash
npm install -g pm2
pm2 start server.js --name spotify-fan
pm2 startup
pm2 save
```

## Security Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Strong SESSION_SECRET set
- [ ] Spotify redirect URI updated to production domain
- [ ] NODE_ENV=production set
- [ ] Rate limiting configured appropriately
- [ ] CORS origins restricted to your domain
- [ ] Helmet security headers enabled
- [ ] Sensitive files (.env) not committed
- [ ] Dependencies audited regularly

## Monitoring

- Set up log rotation for server.log
- Monitor server health at `/healthz`
- Set up alerts for high error rates
- Regular security updates for dependencies

## Backup

- Database: SQLite file (sessions.db) - include in backups
- Environment: Keep .env secure and backed up
- Code: Use Git for version control

## Troubleshooting

- Check server logs: `pm2 logs spotify-fan`
- Verify environment variables are loaded
- Test OAuth flow with production credentials
- Ensure firewall allows traffic on port 80/443