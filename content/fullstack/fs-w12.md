---
id: fs-w12
title: Docker, Deployment & Production AI
week: Week 12
summary: Containerizing the AI app, Docker Compose for API + worker + Postgres + Redis + frontend, secrets and environment config, CI/CD, deploying to a server, logging, monitoring, scaling, security and production cost management.
builds_on: fs-w11, fs-w10, f-terminal
leads_to: fs-p3, do-w4, do-w5
---

The last teaching week takes StudyMate from "works on my machine" to **running in production**. This is a compressed, application-focused version of DevOps weeks 4–5 and 11. If you take the DevOps bootcamp, you'll go much deeper into each topic.

# Lesson: Containerizing the app (35 min)

A **container image** packages your app with its exact runtime and dependencies, so it runs the same on a laptop, in CI and on a server.

```dockerfile
# ---------- build stage: install dependencies into a virtualenv ----------
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt          # cached unless requirements change

# ---------- runtime stage: small image, non-root user ----------
FROM python:3.12-slim
ENV PATH="/venv/bin:$PATH" PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10001 app
COPY --from=build /venv /venv
WORKDIR /app
COPY --chown=app:app app/ ./app/
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Key practices:
- **Multi-stage builds**: build tools stay out of the final image, which makes it smaller and more secure.
- **Layer caching**: copy `requirements.txt` and install *before* copying the source code, so code edits don't reinstall the dependencies.
- **A non-root user**, minimal base images, pinned versions, and a `.dockerignore` (exclude `.git`, `.venv`, `node_modules`, `.env`).
- **One process per container**: the API and the worker are separate containers built from the same image, with different commands.
- **No secrets in images**. They're injected at runtime (lesson 2).

### The frontend

Build static assets in a Node stage and serve them with Nginx or Caddy (or a platform like Vercel). Configure the API URL at build or run time.

> [!recap]
> - Multi-stage, cache-friendly layer order, non-root, slim and pinned, `.dockerignore`.
> - The same image for the API and the worker, with different commands. No secrets inside.

# Lesson: Compose, configuration and secrets (30 min)

```yaml
# docker-compose.yml
services:
  api:
    build: .
    env_file: .env                       # local dev only; never commit .env
    environment:
      DATABASE_URL: postgresql+asyncpg://app:${POSTGRES_PASSWORD}@db:5432/app
      REDIS_URL: redis://redis:6379/0
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }
    ports: ["8000:8000"]
  worker:
    build: .
    command: ["arq", "app.worker.WorkerSettings"]
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://app:${POSTGRES_PASSWORD}@db:5432/app
      REDIS_URL: redis://redis:6379/0
    depends_on: [db, redis]
    deploy: { replicas: 2 }
  db:
    image: pgvector/pgvector:pg16
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}", POSTGRES_DB: app }
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }
  redis:
    image: redis:7
    volumes: ["redisdata:/data"]
  web:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [api]
volumes: { pgdata: {}, redisdata: {} }
```

Services find each other by **service name** (`db`, `redis`) on Compose's internal network. Named **volumes** persist the data across container restarts.

### Configuration: the 12-factor way

- **All configuration comes from environment variables**, validated at startup (fail fast with a clear message if `ANTHROPIC_API_KEY` is missing).
- **Secrets** (API keys, DB passwords, JWT secret): in development, a git-ignored `.env`; in production, the platform's secret store (GitHub Actions secrets, Docker/Kubernetes secrets, a cloud secret manager, Vault). **Rotate** them, and never log them.
- **Migrations** run as a separate step before the new version starts: `alembic upgrade head`.

> [!recap]
> - Compose: api + worker + db + redis + web, health-checked dependencies, named volumes.
> - Config from validated env vars. Secrets from a secret store, never in code, images or logs.
> - Migrations as an explicit deploy step.

# Lesson: CI/CD and deployment (30 min)

```yaml
# .github/workflows/ci.yml (sketch)
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      db: { image: pgvector/pgvector:pg16, env: { POSTGRES_PASSWORD: test }, ports: ["5432:5432"] }
      redis: { image: redis:7, ports: ["6379:6379"] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check . && pytest -q                       # unit + API tests with a fake LLM
      - run: python -m evals.run --subset smoke --fail-under 0.9   # fast eval subset (week 11)
        env: { ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}" }
  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with: { push: true, tags: "ghcr.io/${{ github.repository }}:${{ github.sha }}" }
```

**CD**: deploy the tested image (tagged with the commit SHA) to staging, run smoke tests, then promote it to production. Simple targets: a single VPS running Docker Compose behind **Caddy or Nginx** (automatic HTTPS), or a PaaS (Render, Fly.io, Railway). Bigger systems use **Kubernetes** (DevOps weeks 9–10).

### Production essentials

- **Structured logs** (JSON) with a request/trace ID, shipped to a log system. Never log secrets, and redact PII (week 11).
- **Metrics and alerts**: latency, errors, queue depth, worker lag, LLM cost per hour (week 11). Use Prometheus/Grafana or a hosted service (DevOps week 11).
- **Scaling**: API containers scale horizontally because they're stateless. Workers scale by queue depth. Watch the DB connection pool (use PgBouncer) and the provider rate limits.
- **Backups**: automated Postgres backups with **tested restores** (DevOps week 3).
- **Security**: HTTPS only, security headers, CORS limited to your origin, dependency and image scanning (Dependabot, Trivy), least-privilege DB users, rate limits, and the guardrails from weeks 9–11.
- **Cost management**: per-user budgets, spend alerts and a kill switch (week 5), right-sized servers, prompt caching and model routing.

> [!recap]
> - CI: lint, test (fake LLM), a smoke eval subset, build and push an image tagged with the SHA.
> - CD: staging → smoke → production. VPS + Compose + Caddy, a PaaS, or Kubernetes.
> - Logs, metrics, scaling, backups, security scanning and cost controls.

# Quiz

## Why copy requirements.txt and install dependencies before copying the source code?
- [ ] Docker requires that order
- [x] Layer caching: code changes don't invalidate the dependency layer, so rebuilds are fast
- [ ] To make the image smaller
- [ ] To run tests
> Order the Dockerfile instructions from least to most frequently changing.

## Where should the production OpenAI/Anthropic API key live?
- [ ] In the Dockerfile as ENV
- [ ] Committed in .env
- [x] In the platform's secret store, injected as an environment variable at runtime
- [ ] In the frontend code
> Secrets never go into images, repositories or client code.

## In Docker Compose, how does the API reach Postgres?
- [ ] localhost:5432
- [x] By the service name, e.g. `db:5432`, on the Compose network
- [ ] The host's public IP
- [ ] It can't
> Compose provides DNS for the service names.

## Why run the API and the worker as separate containers from the same image?
- [x] They scale independently and one process per container keeps them isolated and observable
- [ ] Images can only run one command ever
- [ ] It's cheaper to build two images
- [ ] Workers don't need code
> Different commands, independent scaling.

## What should CI do before building the production image?
- [ ] Nothing; build first
- [x] Lint, run tests (with a fake LLM) and a fast eval subset, and fail the pipeline on regressions
- [ ] Deploy directly to production
- [ ] Delete old images
> Quality gates come before artifacts.

## Your API is stateless and CPU usage is high under load. The simplest scaling step is:
- [x] Run more API container replicas behind the load balancer
- [ ] Increase max_tokens
- [ ] Add more Redis databases
- [ ] Disable logging
> Stateless services scale horizontally.

# Exercise: Validated settings loader

Write `load_settings(env)` that takes a dict (like `os.environ`) and returns a `Settings` object with:
- `database_url` (required, string)
- `anthropic_api_key` (required, string)
- `max_tokens` (int, default 1024, must be 1–8192)
- `debug` (bool, default False; accept "1", "true", "yes" case-insensitively as True)
- `allowed_origins` (a list of strings from a comma-separated var, default `[]`, items stripped)

Raise `ValueError` with **all** the problems listed if anything is missing or invalid. `repr(settings)` must **mask** the API key (show only its last 4 characters, e.g. `'****abcd'`).

## Starter

```python
from dataclasses import dataclass, field

@dataclass
class Settings:
    database_url: str
    anthropic_api_key: str
    max_tokens: int = 1024
    debug: bool = False
    allowed_origins: list = field(default_factory=list)

def load_settings(env):
    pass
```

## Tests

```python
ns = load()
ok = ns["load_settings"]({"DATABASE_URL": "postgresql://x", "ANTHROPIC_API_KEY": "sk-secret-abcd",
                           "MAX_TOKENS": "2048", "DEBUG": "Yes", "ALLOWED_ORIGINS": "https://a.com, https://b.com"})
assert ok.max_tokens == 2048 and ok.debug is True and ok.allowed_origins == ["https://a.com", "https://b.com"]
assert "sk-secret" not in repr(ok) and "abcd" in repr(ok), repr(ok)
d = ns["load_settings"]({"DATABASE_URL": "x", "ANTHROPIC_API_KEY": "k123456"})
assert d.max_tokens == 1024 and d.debug is False and d.allowed_origins == []
try:
    ns["load_settings"]({"MAX_TOKENS": "99999"}); raise AssertionError("expected ValueError")
except ValueError as e:
    msg = str(e)
    assert "DATABASE_URL" in msg and "ANTHROPIC_API_KEY" in msg and "MAX_TOKENS" in msg, msg
```

## Solution

```python
from dataclasses import dataclass, field

@dataclass
class Settings:
    database_url: str
    anthropic_api_key: str = field(repr=False)
    max_tokens: int = 1024
    debug: bool = False
    allowed_origins: list = field(default_factory=list)

    def __repr__(self):
        key = "****" + self.anthropic_api_key[-4:]
        return (f"Settings(database_url={self.database_url!r}, anthropic_api_key={key!r}, "
                f"max_tokens={self.max_tokens}, debug={self.debug}, allowed_origins={self.allowed_origins})")

def load_settings(env):
    errors = []
    db, key = env.get("DATABASE_URL"), env.get("ANTHROPIC_API_KEY")
    if not db: errors.append("DATABASE_URL is required")
    if not key: errors.append("ANTHROPIC_API_KEY is required")
    max_tokens = 1024
    if "MAX_TOKENS" in env:
        try:
            max_tokens = int(env["MAX_TOKENS"])
            if not 1 <= max_tokens <= 8192:
                errors.append("MAX_TOKENS must be between 1 and 8192")
        except ValueError:
            errors.append("MAX_TOKENS must be an integer")
    debug = env.get("DEBUG", "").strip().lower() in {"1", "true", "yes"}
    origins = [o.strip() for o in env.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    if errors:
        raise ValueError("; ".join(errors))
    return Settings(db, key, max_tokens, debug, origins)
```

In real projects, `pydantic-settings` does this declaratively: typed fields, `.env` support and `SecretStr`, which masks automatically.

# Sources

- [Docker docs: Best practices for writing Dockerfiles](https://docs.docker.com/build/building/best-practices/) and [multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Compose specification](https://docs.docker.com/compose/compose-file/)
- [FastAPI: Deployment with Docker](https://fastapi.tiangolo.com/deployment/docker/)
- [The Twelve-Factor App](https://12factor.net/)
- [GitHub Actions: Publishing Docker images](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images)
- [Caddy: Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
