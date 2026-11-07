# Daftar — production image (Next.js standalone output).
#
#   docker build -t daftar .
#   docker compose up -d
#
# The SQLite file lives in the named volume mounted at /data, so restarting or
# rebuilding never touches the data. Migrations run on every container start
# (they are idempotent), which is what makes a fresh volume work: first boot →
# empty schema → the app sends you to /setup.

FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app
RUN corepack enable

# Install first for better layer caching. The schema is needed up front because
# `postinstall` runs `prisma generate`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma7.config.ts ./
COPY prisma/schema.prisma prisma/schema.prisma
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate \
 && pnpm exec next build \
 && cp -r public .next/standalone/public \
 && cp -r .next/static .next/standalone/.next/static

FROM node:22-alpine AS runner
RUN apk add --no-cache libstdc++ openssl
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/daftar.db

# Full install (not just the traced subset) so the Prisma CLI is available for
# `migrate deploy` on start; `.env` is excluded by .dockerignore.
COPY --from=build --chown=node:node /app ./

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node .next/standalone/server.js"]
