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
RUN pnpm --filter @parlor/app deploy --prod --legacy /standalone

# ── runner: minimal production image ─────────────────────────────────────────
# Plain node image (no corepack/pnpm needed at runtime).
FROM node:22-alpine AS runner
WORKDIR /app

# Self-contained app with resolved node_modules
COPY --from=builder --chown=node:node /standalone .

# SvelteKit build output (not copied by pnpm deploy since it's in .gitignore)
COPY --from=builder --chown=node:node /app/apps/parlor/build ./build

# Runtime TypeScript source (needed by tsx at startup; the game packages also
# export TS source, which tsx compiles on import)
COPY --from=builder --chown=node:node /app/apps/parlor/src ./src

EXPOSE 3010
ENV NODE_ENV=production
ENV PORT=3010

# Nothing writes to /app at runtime. tsx keeps its transform cache under the OS
# tmpdir (/tmp/tsx-<uid>), so the root filesystem can be mounted read-only as long
# as /tmp is writable (k8s mounts an emptyDir there).
ENV TMPDIR=/tmp

# Run as the unprivileged `node` user (uid/gid 1000) shipped with the image.
USER node

CMD ["node", "--import", "tsx", "server/index.ts"]
