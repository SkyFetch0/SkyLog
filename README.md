# SkyLog

> **Self-hosted AI-powered log analyzer.** Upload any log file, ask questions in plain language, get structured security & performance analysis powered by Claude.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green.svg)](https://fastify.dev/)

---

## Demo

> _Demo GIF — replace this placeholder after first deployment_
>
> `[demo.gif]`

---

## Features

- **Multi-agent analysis** — Orchestrator spawns specialist sub-agents (up to 5 concurrent) per log type
- **7 built-in specialists** — Apache/Nginx security & traffic, MySQL slow queries & errors, generic error logs
- **Real-time streaming** — SSE stream shows thinking, tool calls, and sub-agent activity live
- **Security detection** — Brute force, SQL injection, path traversal, scanner fingerprinting, Log4Shell
- **File upload** — Drag & drop, multi-file, 500 MB limit per file
- **Self-hosted** — All data stays on your infrastructure; only Claude API calls leave your network
- **Custom agents** — Add a new specialist in ~30 minutes (see guide below)
- **Dark mode UI** — Modern chat interface, collapsible sidebar, agent activity tree panel

---

## Quick Start

```bash
git clone https://github.com/your-org/skylog.git && cd SkyLog
cp .env.example .env          # add ANTHROPIC_API_KEY, POSTGRES_PASSWORD, JWT_SECRET
docker compose up --build -d  # builds + starts all 5 services
```

Open [http://localhost:3000](http://localhost:3000) → Register → New session → Upload log → Ask anything.

Run DB migrations on first start:

```bash
docker compose exec api pnpm db:migrate
```

---

## Architecture

```mermaid
graph TB
    subgraph Browser
        UI[Next.js 15<br/>:3000]
    end

    subgraph API["API  (Fastify :4000)"]
        R[Routes]
        OR[Orchestrator<br/>AgentRunner]
        SR1[apache_security]
        SR2[mysql_performance]
        SR3[generic_error]
        OR --> SR1 & SR2 & SR3
    end

    subgraph Data
        PG[(PostgreSQL 16)]
        RD[(Redis 7)]
    end

    subgraph Sandbox["Sandbox Container (debian:bookworm-slim)"]
        TOOLS[bash · ripgrep · awk]
        WS[/workspace/sessions/…]
    end

    UI --"SSE / REST"--> R
    R --> OR
    OR & SR1 & SR2 & SR3 --"tool calls"--> TOOLS
    TOOLS --"reads"--> WS
    R --> PG & RD
```

### Request Flow

```
POST /api/sessions/:id/messages
  │
  ├─ Persist user message (DB)
  ├─ Create agentRun record  (status: pending)
  │
  └─ SSE stream open ──────────────────────────────────────┐
       │                                                    │
       ├─ Orchestrator: log_stats → log_sample → log_grep  │
       ├─ spawn_agent("apache_security", files)             │→ event: sub_agent_spawned
       │   └─ Apache specialist: grep patterns → write JSON │→ event: tool_use / tool_result
       ├─ Orchestrator: reads specialist JSON outputs       │
       └─ Final markdown summary                            │→ event: completed
                                                            │
  Persist assistant message (DB) ─────────────────────────-┘
```

---

## Screenshots

| Login | Chat + Agent Panel |
|---|---|
| _screenshot placeholder_ | _screenshot placeholder_ |

---

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | API key from [console.anthropic.com](https://console.anthropic.com) |
| `POSTGRES_PASSWORD` | **Yes** | — | Any strong password |
| `JWT_SECRET` | **Yes** | — | Random string ≥ 32 chars |
| `CUSTOM_API_BASE_URL` | No | — | Override Claude API URL (Azure, proxy) |
| `CUSTOM_API_KEY` | No | — | Override API key for custom endpoint |
| `CUSTOM_API_MODEL` | No | — | Override model name |
| `DATABASE_URL` | No | auto | Set automatically from `POSTGRES_*` vars |
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection string |
| `API_PORT` | No | `4000` | API listen port |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Web frontend URL |
| `SANDBOX_CONTAINER` | No | `skylog-sandbox-1` | Docker sandbox container name |

---

## Supported Log Formats

| Log Format | Auto-detected? | Specialist |
|---|---|---|
| Apache access log (combined/common) | Yes | `apache_security`, `apache_traffic` |
| Nginx access log | Yes | `nginx_security`, `nginx_traffic` |
| MySQL slow query log | Yes | `mysql_performance` |
| MySQL error log | Yes | `mysql_errors` |
| JSON logs (Pino, Winston, Bunyan) | Yes | `generic_error` |
| Syslog | Yes | `generic_error` |
| Java / Spring stacktraces | Yes | `generic_error` |
| Python tracebacks | Yes | `generic_error` |
| Any text log | Fallback | `generic_error` |

---

## Adding Custom Agents

All specialists live in `apps/api/src/agents/prompts/specialists/`.

### Step 1 — Create prompt file

```typescript
// apps/api/src/agents/prompts/specialists/haproxy-traffic.ts

export const HAPROXY_TRAFFIC_PROMPT = `
You are a HAProxy log analyst.

## Log format
  Jan 1 10:00:00 lb haproxy[1234]: 1.2.3.4:PORT [01/Jan/2024:10:00:00.000] \
  frontend backend/server 0/0/1/5/6 200 1234 - - ---- 10/5/3/1/0 0/0 "GET /path HTTP/1.1"

## What to analyze
1. Backend error rates per server
2. Response time percentiles (p50, p95, p99)
3. Health check failures

## Tool usage sequence
1. log_stats → log_sample → bash_execute for aggregates
2. write_file → output/haproxy-report.json

## Output format
Return ONLY a JSON object: { totalRequests, backendErrors, p99Ms, recommendations }
`

export const HAPROXY_TRAFFIC_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['totalRequests', 'recommendations'],
  properties: {
    totalRequests: { type: 'number' },
    backendErrors: { type: 'number' },
    p99Ms: { type: 'number' },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
}
```

### Step 2 — Register

```typescript
// apps/api/src/agents/registry.ts
import { HAPROXY_TRAFFIC_PROMPT, HAPROXY_TRAFFIC_OUTPUT_SCHEMA }
  from './prompts/specialists/haproxy-traffic.js'

// Add to SPECIALIST_REGISTRY:
haproxy_traffic: { prompt: HAPROXY_TRAFFIC_PROMPT, outputSchema: HAPROXY_TRAFFIC_OUTPUT_SCHEMA },

// Add to SpecialistRole type:
export type SpecialistRole = ... | 'haproxy_traffic'
```

### Step 3 — Tell the Orchestrator

Add `haproxy_traffic` to the available roles list in `apps/api/src/agents/prompts/orchestrator.ts`. The orchestrator will then consider it when it detects HAProxy log patterns.

---

## Development

```bash
# Start backing services only
docker compose up -d postgres redis sandbox

# Install deps
pnpm install

# Run migrations
pnpm --filter @skylog/api db:migrate

# Start dev servers (hot reload)
pnpm --filter @skylog/api dev    # :4000
pnpm --filter @skylog/web dev    # :3000
```

### Tests

```bash
pnpm --filter @skylog/api test              # all tests
pnpm --filter @skylog/api test:integration  # integration only (needs Postgres)
pnpm --filter @skylog/api type-check        # TypeScript check
pnpm --filter @skylog/web type-check
```

### Production Deploy

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Production overrides add: resource limits, no host port exposure for DB/Redis, sandbox read-only fs + no-new-privileges, log rotation.

---

## Troubleshooting

### "Sandbox container is not running"
```bash
docker compose up -d sandbox
docker ps | grep sandbox   # verify it's running
```

### "Cannot connect to PostgreSQL"
```bash
docker compose logs postgres   # check for errors
docker compose exec postgres psql -U skylog -c '\dt'   # verify tables
```

### "ANTHROPIC_API_KEY is invalid"
Check your `.env` file. The key must start with `sk-ant-`. Get one from [console.anthropic.com](https://console.anthropic.com).

### Agent times out / no response
- Check `docker compose logs api` for errors
- Increase `SANDBOX_TIMEOUT_MS` (default: 30000) in `.env`
- Very large log files (>100 MB) may need `log_sample` before full analysis

### Port already in use
```bash
# Change ports in .env:
API_PORT=4001
# or kill the process:
lsof -i :4000 | awk 'NR>1 {print $2}' | xargs kill
```

### Database migration fails
```bash
docker compose exec api pnpm db:generate  # re-generate migration files
docker compose exec api pnpm db:migrate   # apply
```

---

## Project Structure

```
SkyLog/
├── apps/
│   ├── api/                   Fastify 5 + TypeScript backend (:4000)
│   │   └── src/
│   │       ├── agents/        Multi-agent AI system
│   │       │   ├── tools/     8 tools: bash, grep, read-file, log-stats…
│   │       │   ├── prompts/   Orchestrator + 7 specialist prompts
│   │       │   ├── runner.ts  Streaming agentic loop (max 25 iterations)
│   │       │   ├── registry.ts Specialist registry
│   │       │   └── concurrency.ts Semaphore (max 5 sub-agents)
│   │       ├── db/            Drizzle ORM — 6 tables
│   │       ├── routes/        auth / sessions / files / chat / agents
│   │       ├── lib/errors.ts  Typed error classes
│   │       └── sandbox.ts     Docker exec wrapper
│   └── web/                   Next.js 15 App Router (:3000)
│       ├── app/               Pages + layouts (auth + app groups)
│       ├── components/        chat/ layout/ ui/ (shadcn)
│       ├── hooks/             TanStack Query + SSE hooks
│       └── lib/               axios client, SSE parser, zustand auth
├── packages/shared/           Shared TypeScript types
├── sandbox/                   Docker image (debian + ripgrep + awk + tools)
├── data/workspace/            Volume mount — agent workspaces
├── tests/
│   ├── fixtures/              Sample log files for testing
│   └── integration/           Full API flow tests (vitest)
├── .github/workflows/ci.yml   Lint + typecheck + test + docker build
├── docker-compose.yml         Development
└── docker-compose.prod.yml    Production overrides
```

---

## Tech Stack

| | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS 3, shadcn/ui, zustand, TanStack Query |
| **Backend** | Fastify 5, TypeScript 5.7, Drizzle ORM, Zod |
| **AI** | Anthropic Claude (claude-sonnet), multi-agent tool use, SSE streaming |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Sandbox** | Docker (debian:bookworm-slim), ripgrep, awk, bash |
| **Auth** | JWT via @fastify/jwt, bcrypt (12 rounds) |
| **Testing** | vitest, Fastify inject |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) © 2024 SkyLog Contributors