# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable

# ── builder: install deps + build everything ──────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@parlor/app...

# Produce a self-contained deployment directory (prod deps only)
RUN pnpm --filter @parlor/app deploy --prod /standalone

# ── runner: minimal production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Self-contained app with resolved node_modules
COPY --from=builder /standalone .

# SvelteKit build output (not copied by pnpm deploy since it's in .gitignore)
COPY --from=builder /app/apps/parlor/build ./build

# Runtime TypeScript source (needed by tsx at startup)
COPY --from=builder /app/apps/parlor/src ./src

EXPOSE 3010
ENV NODE_ENV=production
ENV PORT=3010

CMD ["node", "--import", "tsx", "server/index.ts"]
