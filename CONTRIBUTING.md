# Contributing to SkyLog

Thank you for your interest in contributing! This document explains how to get started.

## Development Setup

```bash
git clone https://github.com/your-org/skylog.git
cd SkyLog
cp .env.example .env   # fill in ANTHROPIC_API_KEY, POSTGRES_PASSWORD, JWT_SECRET

# Start backing services
docker compose up -d postgres redis sandbox

# Install dependencies
pnpm install

# Run migrations
pnpm --filter @skylog/api db:migrate

# Start dev servers
pnpm --filter @skylog/api dev   # :4000
pnpm --filter @skylog/web dev   # :3000
```

## Project Layout

```
apps/api/src/
  agents/         AI agent system (runner, tools, prompts)
  db/             Drizzle schema + migrations
  routes/         Fastify route handlers
  server.ts       Plugin registration
  index.ts        Entry point

apps/web/
  app/            Next.js App Router pages
  components/     React components
  hooks/          TanStack Query hooks
  lib/            API client, SSE, auth store
```

## Code Style

- TypeScript strict mode — no `any`, no `// @ts-ignore`
- ESM modules throughout (`"type": "module"`)
- Zod for runtime validation at route boundaries
- Drizzle for all DB queries — no raw SQL in routes
- Fastify inject for route tests — no supertest

## Adding a Specialist Agent

See [README.md — Adding Custom Agents](README.md#adding-custom-agents) for a step-by-step guide.

## Pull Request Checklist

- [ ] `pnpm --filter @skylog/api type-check` passes
- [ ] `pnpm --filter @skylog/web type-check` passes
- [ ] `pnpm --filter @skylog/api test` passes (needs running Postgres)
- [ ] New specialist prompts include few-shot examples
- [ ] No secrets committed (check with `git diff --staged`)

## Commit Message Format

```
type(scope): short description

- what changed
- why it changed
- what it affects
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
```
feat(agents): add haproxy_traffic specialist
fix(sandbox): handle docker exec timeout gracefully
docs(readme): add troubleshooting section for M1 Mac
```

## Reporting Issues

Please include:
1. SkyLog version / git SHA
2. OS and Docker version
3. Relevant logs (`docker compose logs api`)
4. Steps to reproduce

## License

By contributing, you agree your contributions are licensed under the MIT License.