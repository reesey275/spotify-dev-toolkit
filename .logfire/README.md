MCP Server Local Setup

This directory contains local MCP server helper files. Do NOT commit secrets into the repository.

Recommended local files (gitignored):
- `.logfire/logfire_credentials.json`  # contains your project read/write tokens
- `.logfire/mcp_servers.toml`        # copy from `mcp_servers.toml.template` and insert tokens

How to run the Logfire MCP server locally:

1. Ensure `uv`/`uvx` is installed (pipx recommended):

```bash
python -m pip install --user pipx
python -m pipx ensurepath
pipx install uvx
# or: pipx upgrade uvx
```

2. Authenticate and get tokens (one-time):

```bash
logfire auth
uv run logfire projects use <your-project>
```

3. Start the MCP server (reads `LOGFIRE_READ_TOKEN`):

```bash
# If using uvx
LOGFIRE_READ_TOKEN=your_read_token uvx logfire-mcp@latest

# Or if using docker (example format)
# docker run -i --rm -e LOGFIRE_READ_TOKEN=your_read_token ghcr.io/reesey275/logfire-mcp:latest
```

Security notes:
- Never commit `logfire_credentials.json` to source control.
- Keep tokens in environment variables or CI secrets when possible.
