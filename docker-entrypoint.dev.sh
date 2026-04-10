#!/bin/sh
set -e
cd /app

export NODE_ENV=development

# node_modules is a Docker named volume (see school-erp-infra docker-compose). It must be
# populated by npm *inside the Linux container*. macOS-built binaries won't work on Linux.

# Resolve architecture suffix used by native platform packages.
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)        ARCH_SUFFIX="x64" ;;
  aarch64|arm64) ARCH_SUFFIX="arm64" ;;
  *)             ARCH_SUFFIX="" ;;
esac

LCSS_PKG="lightningcss-linux-${ARCH_SUFFIX}-gnu"
OXIDE_PKG="@tailwindcss/oxide-linux-${ARCH_SUFFIX}-gnu"

LOCK_HASH="$(node -p "require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex')" 2>/dev/null || echo "")"
STAMP_FILE="/app/node_modules/.docker-lock-stamp"

need_install=0
if [ ! -d node_modules/next ]; then
  echo "node_modules missing — will install..."
  need_install=1
elif [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE" 2>/dev/null)" != "$LOCK_HASH" ]; then
  echo "package-lock.json changed — will reinstall..."
  need_install=1
elif [ -n "$ARCH_SUFFIX" ] && [ ! -d "node_modules/$LCSS_PKG" ]; then
  echo "$LCSS_PKG missing — forcing reinstall..."
  need_install=1
elif [ -n "$ARCH_SUFFIX" ] && [ ! -d "node_modules/@tailwindcss/oxide-linux-${ARCH_SUFFIX}-gnu" ]; then
  echo "$OXIDE_PKG missing — forcing reinstall..."
  need_install=1
fi

if [ "$need_install" -eq 1 ]; then
  echo "Installing npm dependencies inside Linux container..."
  npm ci --include=optional
  echo "$LOCK_HASH" > "$STAMP_FILE"
fi

# Turbopack compatibility symlinks:
# Turbopack statically bundles postcss.js and resolves .node fallback require paths at
# bundle evaluation time — before the try-block package require can succeed. Each native
# package (lightningcss, @tailwindcss/oxide) has its binary in a separate platform package
# but the fallback require looks for it inside the main package directory. We symlink it in.
if [ -n "$ARCH_SUFFIX" ]; then
  # lightningcss: fallback is '../lightningcss.linux-arm64-gnu.node' (relative to node/index.js)
  # → resolves to node_modules/lightningcss/lightningcss.linux-arm64-gnu.node
  LCSS_BIN="lightningcss.linux-${ARCH_SUFFIX}-gnu.node"
  LCSS_LINK="node_modules/lightningcss/${LCSS_BIN}"
  if [ -f "node_modules/${LCSS_PKG}/${LCSS_BIN}" ] && [ ! -e "$LCSS_LINK" ]; then
    ln -sf "../${LCSS_PKG}/${LCSS_BIN}" "$LCSS_LINK"
    echo "Symlink: $LCSS_LINK"
  fi

  # @tailwindcss/oxide: fallback is './tailwindcss-oxide.linux-arm64-gnu.node'
  # → resolves to node_modules/@tailwindcss/oxide/tailwindcss-oxide.linux-arm64-gnu.node
  OXIDE_BIN="tailwindcss-oxide.linux-${ARCH_SUFFIX}-gnu.node"
  OXIDE_LINK="node_modules/@tailwindcss/oxide/${OXIDE_BIN}"
  if [ -f "node_modules/@tailwindcss/oxide-linux-${ARCH_SUFFIX}-gnu/${OXIDE_BIN}" ] && [ ! -e "$OXIDE_LINK" ]; then
    ln -sf "../oxide-linux-${ARCH_SUFFIX}-gnu/${OXIDE_BIN}" "$OXIDE_LINK"
    echo "Symlink: $OXIDE_LINK"
  fi
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
