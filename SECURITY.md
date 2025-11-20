# Security Policy

## Supported Versions

Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### For Critical Issues (Auth, Data Exposure, RCE)
- **DO NOT** open a public GitHub issue
- Email security contact or use GitHub's private vulnerability reporting
- Include: description, steps to reproduce, potential impact

### For Non-Critical Issues
- Open a GitHub issue with the `security` label
- Provide detailed reproduction steps

### What to Expect
- **Acknowledgment**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium/Low: Next release cycle

## Security Measures in Place

### Application Security
- OAuth 2.0 with PKCE for authentication
- Session-based auth with SQLite secure store
- Rate limiting on all API endpoints (auth: 5/15min, API: 300/min)
- Helmet.js security headers (CSP, HSTS, XSS protection)
- Input validation using Zod schemas
- Automatic token refresh with secure fallback

### Development Security
- CodeQL security scanning (JavaScript/TypeScript, Python)
- Automated dependency vulnerability scanning
- Playwright E2E testing for auth flows
- Logfire observability for anomaly detection

### Infrastructure Security
- Environment variable protection (.env not committed)
- Docker security scanning (planned)
- Regular dependency updates

## Known Limitations

1. **Development Mode**: CSP and HSTS disabled in development (NODE_ENV !== 'production')
2. **Session Storage**: SQLite-based (not distributed) - not suitable for multi-instance deployments
3. **Client Credentials Fallback**: Public data accessible without user auth

## Secure Configuration

### Required Environment Variables
```bash
SPOTIFY_CLIENT_ID=<your-client-id>
SPOTIFY_CLIENT_SECRET=<your-secret>  # Never commit!
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5500/callback
SESSION_SECRET=<random-256-bit-string>  # Generate with: openssl rand -base64 32
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong SESSION_SECRET (32+ characters, random)
- [ ] Enable HTTPS (required for production OAuth)
- [ ] Configure CORS allowlist (not wildcard *)
- [ ] Set up rate limiting rules for your traffic
- [ ] Use reverse proxy (nginx) with additional security headers
- [ ] Enable audit logging
- [ ] Regular security updates (npm audit, pip check)

## Security Best Practices

### For Contributors
- Never commit `.env` files or credentials
- Validate all user inputs
- Use parameterized queries (no string concatenation)
- Sanitize error messages (no stack traces in production)
- Follow principle of least privilege for API scopes

### For Deployers
- Run `npm audit` and `pip check` before deployment
- Keep Node.js and Python versions updated
- Monitor CodeQL alerts in GitHub Security tab
- Review Logfire logs for suspicious activity
- Implement backup strategy for sessions.db

## Vulnerability Disclosure Timeline

Once a fix is released:
1. Security advisory published on GitHub
2. CVE requested if applicable
3. Public disclosure after 90 days or fix deployment (whichever is sooner)
