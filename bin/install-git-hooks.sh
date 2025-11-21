#!/usr/bin/env bash
set -euo pipefail

# Install git hooks from .githooks into .git/hooks
HOOK_DIR='.githooks'
GIT_HOOKS_DIR='.git/hooks'

if [ ! -d "$HOOK_DIR" ]; then
  echo "No $HOOK_DIR directory found."
  exit 1
fi

mkdir -p "$GIT_HOOKS_DIR"
for hook in "$HOOK_DIR"/*; do
  name=$(basename "$hook")
  cp "$hook" "$GIT_HOOKS_DIR/$name"
  chmod +x "$GIT_HOOKS_DIR/$name"
  echo "Installed hook: $name"
done

echo "Installed legacy git hooks into .git/hooks."

# If pre-commit is available, install the pre-commit hooks and pre-push integration
if command -v pre-commit >/dev/null 2>&1; then
  echo "pre-commit detected — installing pre-commit hooks"
  # Install pre-commit in the repo (pre-push hook will be managed by pre-commit)
  pre-commit install --hook-type pre-push || echo "pre-commit install failed"
  # Optionally install the hook's additional resources
  pre-commit install-hooks || echo "pre-commit install-hooks failed"
  echo "pre-commit hooks installed."
else
  echo "pre-commit not found. To enable pre-commit-managed hooks, install pre-commit (pip install pre-commit) and re-run this script."
fi

echo "Git hook installation complete."
