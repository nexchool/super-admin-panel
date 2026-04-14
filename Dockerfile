# syntax=docker/dockerfile:1
# Default final stage: production (standalone Next, non-root).
#
#   docker build -t school-erp-panel ./panel
#   docker build --target development -t school-erp-panel:dev ./panel

# deps: install node_modules for the Linux platform this build runs on.
# --include=optional ensures platform-specific native binaries (lightningcss) are always installed.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=optional

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GATEWAY_ORIGIN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_API_URL_DEV=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_PANEL_URL=${NEXT_PUBLIC_PANEL_URL} \
    NEXT_PUBLIC_GATEWAY_ORIGIN=${NEXT_PUBLIC_GATEWAY_ORIGIN} \

RUN npm run build

FROM node:22-bookworm-slim AS development
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

COPY package.json package-lock.json* ./

# Install Linux-specific binaries (lightningcss etc.), write the lockfile stamp, and
# create the Turbopack compatibility symlink so postcss works in next dev.
# Docker copies these into the named volume on first creation, letting the entrypoint
# skip reinstall if package-lock.json hasn't changed on the host.
RUN npm ci --include=optional && \
    node -p "require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex')" \
      > node_modules/.docker-lock-stamp && \
    ARCH="$(uname -m)"; \
    case "$ARCH" in \
      x86_64)        ARCH_SUFFIX="x64" ;; \
      aarch64|arm64) ARCH_SUFFIX="arm64" ;; \
      *)             ARCH_SUFFIX="" ;; \
    esac; \
    if [ -n "$ARCH_SUFFIX" ]; then \
      LCSS_PKG="lightningcss-linux-${ARCH_SUFFIX}-gnu"; \
      LCSS_BIN="lightningcss.linux-${ARCH_SUFFIX}-gnu.node"; \
      if [ -f "node_modules/${LCSS_PKG}/${LCSS_BIN}" ]; then \
        ln -sf "../${LCSS_PKG}/${LCSS_BIN}" "node_modules/lightningcss/${LCSS_BIN}"; \
      fi; \
      OXIDE_BIN="tailwindcss-oxide.linux-${ARCH_SUFFIX}-gnu.node"; \
      if [ -f "node_modules/@tailwindcss/oxide-linux-${ARCH_SUFFIX}-gnu/${OXIDE_BIN}" ]; then \
        ln -sf "../oxide-linux-${ARCH_SUFFIX}-gnu/${OXIDE_BIN}" "node_modules/@tailwindcss/oxide/${OXIDE_BIN}"; \
      fi; \
    fi

COPY docker-entrypoint.dev.sh /docker-entrypoint.dev.sh
RUN chmod +x /docker-entrypoint.dev.sh
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GATEWAY_ORIGIN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_API_URL_DEV=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_PANEL_URL=${NEXT_PUBLIC_PANEL_URL} \
    NEXT_PUBLIC_GATEWAY_ORIGIN=${NEXT_PUBLIC_GATEWAY_ORIGIN} \

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.dev.sh"]

FROM node:22-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
