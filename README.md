# SkyLog

**Self-hosted AI-powered log analyzer.** Upload any log file, ask a question in natural language, and get a structured security/performance analysis powered by Claude.

---

## Screenshots

> _Chat UI, agent panel, and analysis results — screenshots coming after first deployment._

---

## Architecture

```mermaid
graph TB
    subgraph Browser
        UI[Next.js 15 App<br/>:3000]
    end

    subgraph API ["API Server (Fastify :4000)"]
        R[Routes<br/>auth / sessions / files / chat]
        OR[Orchestrator<br/>AgentRunner]
        SR[Sub-Agents<br/>apache_security, mysql_perf…]
    end

    subgraph Data
        PG[(PostgreSQL 16)]
        RD[(Redis 7)]
    end

    subgraph Sandbox ["Sandbox Container"]
        SB[debian:bookworm-slim<br/>ripgrep · awk · bash]
        WS[/workspace/sessions/…]
    end

    UI -- SSE / REST --> R
    R --> OR
    OR --> SR
    OR -- tool calls --> SB
    SR -- tool calls --> SB
    SB -- reads --> WS
    R --> PG
    R --> RD
```

### Data Flow

```
User uploads log file
    → POST /api/sessions/:id/files
    → File copied into sandbox: /workspace/sessions/{sid}/uploads/
    → DB record created (files table)

User sends message
    → POST /api/sessions/:id/messages  (SSE response)
    → Orchestrator AgentRunner starts
    → Orchestrator calls: log_stats → log_sample → log_grep
    → Orchestrator spawns specialist sub-agents (max 5 concurrent)
    → Each specialist runs in isolated sandbox workdir
    → Sub-agents return structured JSON
    → Orchestrator aggregates + summarizes
    → Final markdown response streamed to UI
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/skylog.git
cd SkyLog

# 2. Configure
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY and JWT_SECRET at minimum

# 3. Start everything
docker compose up -d

# 4. Wait for services to be healthy, then run migrations
docker compose exec api pnpm db:migrate

# 5. Open the app
open http://localhost:3000
```

### Local development (without Docker)

```bash
# Terminal 1 — start Postgres + Redis + Sandbox only
docker compose up -d postgres redis sandbox

# Terminal 2 — API
pnpm --filter @skylog/api dev

# Terminal 3 — Web
pnpm --filter @skylog/web dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |
| `CUSTOM_API_BASE_URL` | No | Override Claude API base URL (Azure, proxy, etc.) |
| `DATABASE_URL` | Yes | `postgresql://skylog:pass@localhost:5432/skylog` |
| `REDIS_URL` | Yes | `redis://localhost:6379` |
| `JWT_SECRET` | Yes | Random string, min 32 chars |
| `API_PORT` | No | Default: `4000` |
| `CORS_ORIGIN` | No | Default: `http://localhost:3000` |
| `SANDBOX_CONTAINER` | No | Default: `skylog-sandbox-1` |

---

## Log Formats Supported

| Format | Specialist Agent |
|---|---|
| Apache access log (combined) | `apache_security`, `apache_traffic` |
| Nginx access log | `nginx_security`, `nginx_traffic` |
| MySQL slow query log | `mysql_performance` |
| MySQL error log | `mysql_errors` |
| Any text log (JSON, syslog, logfmt, Java, Python) | `generic_error` |

---

## Adding Custom Agents

All specialist agents live in `apps/api/src/agents/prompts/specialists/`.

### Step 1 — Create the prompt file

```typescript
// apps/api/src/agents/prompts/specialists/haproxy-traffic.ts

export const HAPROXY_TRAFFIC_PROMPT = `
You are a HAProxy log analyst.

## Log format
  Jan  1 10:00:00 lb haproxy[1234]: 1.2.3.4:PORT [01/Jan/2024:10:00:00.000] frontend backend/server 0/0/1/5/6 200 1234 - - ---- 10/5/3/1/0 0/0 "GET /path HTTP/1.1"

## What to analyze
[... your instructions ...]

## Output format
Return ONLY a JSON object:
  totalRequests, backendErrors, p99ResponseMs, recommendations
`

export const HAPROXY_TRAFFIC_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['totalRequests', 'recommendations'],
  properties: {
    totalRequests: { type: 'number' },
    backendErrors: { type: 'number' },
    p99ResponseMs: { type: 'number' },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
}
```

### Step 2 — Register in registry.ts

```typescript
// apps/api/src/agents/registry.ts

import {
  HAPROXY_TRAFFIC_PROMPT,
  HAPROXY_TRAFFIC_OUTPUT_SCHEMA,
} from './prompts/specialists/haproxy-traffic.js'

// Add to SPECIALIST_REGISTRY:
haproxy_traffic: {
  prompt: HAPROXY_TRAFFIC_PROMPT,
  outputSchema: HAPROXY_TRAFFIC_OUTPUT_SCHEMA,
},
```

### Step 3 — Update SpecialistRole type

```typescript
export type SpecialistRole =
  | 'apache_security'
  | 'apache_traffic'
  // ...existing roles...
  | 'haproxy_traffic'   // add this
```

### Step 4 — Tell the Orchestrator

Add your new role to the specialist list in `orchestrator.ts` under `## Available Specialist Roles`.

The orchestrator will now automatically consider spawning your agent when it detects HAProxy log format.

---

## Running Tests

```bash
# Unit + integration tests (requires running Postgres)
pnpm --filter @skylog/api test

# Integration tests only
pnpm --filter @skylog/api test:integration

# Watch mode
pnpm --filter @skylog/api test:watch
```

### Test fixtures

```
apps/api/tests/fixtures/
├── apache-access-sample.log   — 47 lines with brute force + SQLi + Nikto patterns
├── mysql-slow-sample.log      — 7 slow queries, 1 lock wait >2s
└── nginx-error-sample.log     — connection refused spikes, SSL errors
```

---

## Project Structure

```
SkyLog/
├── apps/
│   ├── api/                   Fastify + TypeScript backend
│   │   └── src/
│   │       ├── agents/        AI agent system
│   │       │   ├── tools/     8 tools (bash, grep, read-file, etc.)
│   │       │   ├── prompts/   Orchestrator + 7 specialist prompts
│   │       │   ├── runner.ts  Streaming agent loop
│   │       │   ├── registry.ts Specialist lookup
│   │       │   └── concurrency.ts Semaphore (max 5 sub-agents)
│   │       ├── db/            Drizzle ORM + schema (6 tables)
│   │       ├── routes/        auth / sessions / files / chat / agents
│   │       └── sandbox.ts     Docker exec wrapper
│   └── web/                   Next.js 15 App Router frontend
│       ├── app/               Pages + layouts
│       ├── components/        chat/ + layout/ + ui/
│       ├── hooks/             TanStack Query hooks
│       └── lib/               api client, SSE, auth store
├── packages/shared/           Shared TypeScript types
├── sandbox/                   Docker image (debian + ripgrep + tools)
├── data/workspace/            Volume mount for sandbox
└── docker-compose.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui, zustand, TanStack Query |
| Backend | Fastify 5, TypeScript, Drizzle ORM |
| AI | Anthropic Claude (claude-sonnet), multi-agent with tool use |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Sandbox | Docker (debian:bookworm-slim), ripgrep, awk, bash |
| Auth | JWT (RS256 via @fastify/jwt), bcrypt |

---

## Demo

> _Demo GIF will be added after first working deployment._

---

## License

MIT