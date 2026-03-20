# syntax=docker/dockerfile:1
# Default final stage: production (standalone Next, non-root).
#
#   docker build -t school-erp-panel ./panel
#   docker build --target development -t school-erp-panel:dev ./panel

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

ARG NEXT_PUBLIC_API_URL=http://localhost:5001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_API_URL_DEV=${NEXT_PUBLIC_API_URL}

RUN npm run build

FROM node:22-bookworm-slim AS development
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0

COPY package.json package-lock.json* ./
RUN npm install

COPY docker-entrypoint.dev.sh /docker-entrypoint.dev.sh
RUN chmod +x /docker-entrypoint.dev.sh
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:5001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_API_URL_DEV=${NEXT_PUBLIC_API_URL}

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
