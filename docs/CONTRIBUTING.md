# Contributing to Spotify Dev Toolkit

Thank you for your interest in contributing! This document provides guidelines and workflows for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Security](#security)

## Getting Started

### Prerequisites

- **Node.js**: v20+ (for backend server)
- **Python**: 3.12+ (for export CLI tool)
- **Git**: With GPG signing configured
- **Spotify Developer Account**: For API credentials

### Initial Setup

1. **Clone the repository**
```bash
git clone https://github.com/reesey275/spotify-dev-toolkit.git
cd spotify-dev-toolkit
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your Spotify credentials:
# - SPOTIFY_CLIENT_ID
# - SPOTIFY_CLIENT_SECRET
# - SPOTIFY_REDIRECT_URI=http://127.0.0.1:5500/callback
# - SESSION_SECRET (generate with: openssl rand -base64 32)
```

3. **Install dependencies**
```bash
# Node.js dependencies
npm install

# Python dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

4. **Configure GPG signing** (required)
```bash
# Generate GPG key if you don't have one
gpg --full-generate-key

# Configure Git to use your key
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
```

## Development Workflow

### Screen-Based Development Server

**CRITICAL**: Always use screen-based process isolation for the development server.

```bash
# Start server in background (RECOMMENDED)
npm run dev:screen

# Check server status
npm run dev:screen:status

# View server logs (detach with Ctrl+A, D)
npm run dev:screen:attach

# Stop server
npm run dev:screen:stop

# ❌ NEVER use: npm run dev (blocks terminal, prevents concurrent operations)
```

## MCP Servers (Local Model Context Protocol)

This project can integrate with local MCP servers (e.g., Logfire MCP, Playwright MCP).
We provide a safe template and local instructions in `.logfire/`.

Quick setup:

1. Copy the template and add your tokens locally (do NOT commit):

```bash
cp .logfire/mcp_servers.toml.template .logfire/mcp_servers.toml
# Edit .logfire/mcp_servers.toml and set LOGFIRE_READ_TOKEN or other env values
```

2. Authenticate with Logfire and set the project (one-time):

```bash
logfire auth
uv run logfire projects use <your-project-name>
```

3. Start the MCP server locally (using `uvx`):

```bash
# Example: start logfire-mcp with read token in env
LOGFIRE_READ_TOKEN=your_read_token uvx logfire-mcp@latest
```

Notes:
- Keep `.logfire/logfire_credentials.json` and `.logfire/mcp_servers.toml` out of git.
- Use environment variables or CI secrets when configuring MCP servers in automated workflows.


**Why screen sessions?**
- Server runs continuously during development
- Multiple terminals can operate concurrently
- Auto-reload functionality preserved
- No accidental process termination
- Enables concurrent testing and health checks

### Running Tests

```bash
# Health check (run in separate terminal while server runs)
curl -s http://127.0.0.1:5500/healthz

# Playwright E2E tests
npx playwright test                 # All tests
npx playwright test --headed        # With browser UI
npx playwright test tests/api.spec.js  # API tests only
npx playwright test tests/website.spec.js  # UI tests only

# View test report
npx playwright show-report

# Python export tool test
python test_logfire.py
```

### Code Quality

```bash
# Security scanning
npm audit                           # Check for vulnerable dependencies
pip check                           # Check Python packages

# Manual code review
# - Check for hardcoded credentials
# - Validate input sanitization
# - Review error messages (no stack traces in production)
```

## Testing

### Test Structure

- **`tests/api.spec.js`**: Backend API endpoint tests
- **`tests/website.spec.js`**: Frontend UI and integration tests
- **`playwright.config.js`**: Multi-browser test configuration

### Writing Tests

```javascript
// Example API test
test('GET /api/endpoint', async ({ request }) => {
  const response = await request.get('/api/endpoint');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data).toHaveProperty('expectedField');
});

// Example UI test
test('feature works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#element')).toBeVisible();
});
```

### Test Best Practices

- Write tests for all new features
- Test both success and error cases
- Mock external API calls when appropriate
- Keep tests independent and isolated
- Use descriptive test names

## Commit Guidelines

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `security`: Security improvements
- `perf`: Performance improvements

**Examples:**

```bash
# Feature with scope
git commit -S -m "feat(api): Add playlist sorting endpoint

- Implement sort parameter (name-asc, name-desc, tracks-asc, tracks-desc)
- Add Zod schema validation for sort input
- Update API documentation

Closes #123"

# Bug fix
git commit -S -m "fix: Add req.cookies safety guard in OAuth callback

- Fix TypeError when req.cookies is undefined
- Add fallback: const cookieData = (req.cookies || {}).oauth_tmp
- Prevents crash during OAuth state validation"

# Security update
git commit -S -m "security: Add CodeQL security scanning

- Add .github/workflows/codeql.yml
- Scan JavaScript/TypeScript and Python code
- Run on push, PR, and weekly schedule"
```

### Commit Message Best Practices

1. **Use imperative mood**: "Add feature" not "Added feature"
2. **Limit subject line to 50 characters**
3. **Wrap body at 72 characters**
4. **Separate subject from body with blank line**
5. **Use body to explain what and why, not how**
6. **Reference issues and PRs in footer**
7. **Always sign commits with GPG** (use `-S` flag)

## Pull Request Process

### Before Creating a PR

1. **Ensure branch is up-to-date**
```bash
git checkout main
git pull origin main
git checkout your-feature-branch
git rebase main
```

2. **Run all tests**
```bash
npm run dev:screen              # Start server
npx playwright test             # Run E2E tests
npm run dev:screen:stop         # Stop server
```

3. **Verify commits are signed**
```bash
git log --show-signature -5     # Check last 5 commits
```

4. **Check for sensitive data**
```bash
git diff main...your-feature-branch | grep -i "password\|secret\|key\|token"
```

### Creating the PR

1. **Push your branch**
```bash
git push origin your-feature-branch
```

2. **Create PR on GitHub**
   - Use the PR template (automatically loaded)
   - Fill in all sections completely
   - Add relevant labels (bug, enhancement, security, etc.)
   - Request reviews from maintainers

3. **PR Title Format**
   - Follow conventional commits format
   - Example: `feat(auth): Implement OAuth token refresh`

### PR Review Process

1. **Automated checks must pass:**
   - Playwright tests (all browsers)
   - CodeQL security scan
   - No merge conflicts

2. **Manual review:**
   - At least one maintainer approval required
   - Address all review comments
   - Re-request review after changes

3. **Merge:**
   - Use "Squash and merge" for feature branches
   - Use "Rebase and merge" for clean linear history
   - Delete branch after merge

## Security

### Reporting Vulnerabilities

- **Critical issues**: Use GitHub's private vulnerability reporting
- **Non-critical issues**: Open issue with `security` label
- See [SECURITY.md](../SECURITY.md) for full policy

### Security Best Practices

1. **Never commit credentials**
   - Use `.env` files (git-ignored)
   - Use environment variables in CI/CD
   - Rotate exposed credentials immediately

2. **Input validation**
   - Use Zod schemas for all API inputs
   - Sanitize user-provided data
   - Validate file uploads

3. **Dependencies**
   - Run `npm audit` and `pip check` regularly
   - Keep dependencies updated
   - Review security advisories

4. **Code review**
   - Check for SQL injection vectors
   - Validate authentication/authorization
   - Review error messages (no sensitive data leaks)

## Development Patterns

### Backend (server.js)

- **Token management**: Use `getSpotifyToken()` for client creds, `getUserAccessToken()` for user auth
- **API calls**: Always use `spotifyRequest(endpoint, req, method, data)` wrapper
- **Validation**: Define Zod schemas at file top, validate all inputs
- **Error handling**: Centralized error middleware with dev/prod modes

### Frontend (public/script.js)

- **View management**: Use `switchView(viewName)` to change SPA sections
- **Event delegation**: Attach listeners to document for dynamic elements
- **Loading states**: Show/hide `#loading` and `#error` during async operations
- **Auth checks**: Call `checkAuthStatus()` on init and after auth changes

### Python Export Tool

- **ID extraction**: Use `extract_playlist_id()` for URLs, URIs, or raw IDs
- **Pagination**: Use `while results: ... results = sp.next(results)`
- **Instrumentation**: Add Logfire logging for key operations

## Replicating This Setup

### For New Contributors

Follow the [Getting Started](#getting-started) section above.

### For Similar Projects

To replicate this project structure:

1. **Project skeleton**
```bash
mkdir my-spotify-project
cd my-spotify-project
npm init -y
python -m venv .venv
```

2. **Copy configuration files**
   - `.github/workflows/` (CI/CD)
   - `.gitignore`
   - `playwright.config.js`
   - `nodemon.json`

3. **Set up security**
   - Configure GPG signing
   - Add CodeQL workflow
   - Create SECURITY.md
   - Set up Logfire or similar observability

4. **Development workflow**
   - Implement screen-based dev server
   - Add validation scripts (bin/validate-workflow.js)
   - Create health check endpoint
   - Set up rate limiting

5. **Testing**
   - Add Playwright with multi-browser support
   - Create test directory structure
   - Add CI integration

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues and PRs for similar topics
- Review [SECURITY.md](../SECURITY.md) for security concerns

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
