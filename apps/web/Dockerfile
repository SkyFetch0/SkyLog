# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy .npmrc so shamefully-hoist applies here too
COPY .npmrc ./

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_API_URL=http://localhost:4001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Run next directly via root node_modules (shamefully-hoisted)
RUN node_modules/.bin/next build apps/web 2>/dev/null || \
    (cd apps/web && ../../node_modules/.bin/next build)

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]