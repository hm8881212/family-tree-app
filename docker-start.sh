#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/server && node scripts/migrate.js

echo "Starting server..."
node dist/index.js &

echo "Serving client..."
serve -s /app/client/dist -l 3000
