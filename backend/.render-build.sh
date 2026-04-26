#!/bin/bash
# Render Build Script - handles deployment with graceful migration fallback

set -e

echo "==> Installing dependencies..."
npm install

echo "==> Attempting migrations..."
if npm run migrate; then
  echo "✅  Migrations completed successfully"
else
  echo "⚠️  Migrations failed - starting server without database schema"
  echo "   The server will still start but API endpoints may fail until migrations are manually run"
fi

echo "==> Build complete!"
