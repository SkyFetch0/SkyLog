# SkyLog API — tsx ile doğrudan çalışır (dev/production tek stage)
FROM node:22-alpine
# Docker CLI is required so the API can run `docker exec` / `docker cp`
# against the sandbox container via the mounted /var/run/docker.sock.
RUN apk add --no-cache docker-cli
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install all deps (including tsx/typescript devDeps needed at runtime)
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

EXPOSE 4000
# tsx directly executes TypeScript — no separate compile step needed
CMD ["./node_modules/.bin/tsx", "apps/api/src/index.ts"]