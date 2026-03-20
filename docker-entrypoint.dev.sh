#!/bin/sh
set -e
cd /app
if [ ! -d node_modules/next ]; then
  echo "Installing npm dependencies..."
  npm install
fi
exec npm run dev -- --hostname 0.0.0.0 --port 3000
