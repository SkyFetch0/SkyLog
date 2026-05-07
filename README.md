# SkyLog

Self-hosted AI log analyzer. Ingest, search, and query your logs with natural language — powered by Claude or any OpenAI-compatible API.

## Architecture

```
SkyLog/
├── apps/
│   ├── web/        Next.js 15 (App Router, TypeScript)
│   └── api/        Fastify 5 + TypeScript
├── packages/
│   └── shared/     Common types shared between apps
├── sandbox/        Docker image for AI agent execution
└── data/
    └── workspace/  Sandbox volume mount (git-ignored)
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/skylog.git
cd skylog

# 2. Set up environment variables
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD and ANTHROPIC_API_KEY

# 3. Start all services
docker compose up
```

The web UI will be available at **http://localhost:3000**  
The API will be available at **http://localhost:3001**

## Development (local, without Docker)

```bash
# Prerequisites: Node.js 22+, pnpm 9+, Docker (for postgres & redis)

# Install dependencies
pnpm install

# Start only infrastructure services
docker compose up postgres redis -d

# Start API and Web in watch mode
pnpm dev
```

## Environment Variables

See [`.env.example`](.env.example) for all available variables.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `CUSTOM_API_BASE_URL` | Optional OpenAI-compatible base URL |
| `CUSTOM_API_KEY` | API key for the custom endpoint |
| `CUSTOM_API_MODEL` | Model name for the custom endpoint |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `POSTGRES_PASSWORD` | Postgres password (required) |

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Fastify 5, TypeScript, TypeBox (type-safe schemas)
- **Database**: PostgreSQL 16
- **Cache / Queue**: Redis 7
- **Package manager**: pnpm workspaces
- **Container runtime**: Docker Compose