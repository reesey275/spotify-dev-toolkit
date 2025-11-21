#!/usr/bin/env bash
# Enables the repository-local git hooks by setting core.hooksPath.
set -euo pipefail

echo "Setting repository git hooks path to .githooks and making hooks executable"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit || true

echo "Git hooks enabled. Future commits will run the local secret-scan pre-commit hook."
