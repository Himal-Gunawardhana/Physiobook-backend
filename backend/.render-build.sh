#!/usr/bin/env bash
set -e

echo "=== Physiobook API — Render Build ==="
echo "Node: $(node --version) | npm: $(npm --version)"

npm install --omit=dev

echo "--- Running database migrations ---"
node migrations/run.js

echo "=== Build complete ==="
