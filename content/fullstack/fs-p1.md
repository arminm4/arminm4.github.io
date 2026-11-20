---
id: fs-p1
title: Project Checkpoint 1: Streaming Chat App
week: Week 4
kind: project
summary: Ship v1 of the capstone product: an authenticated, persistent, streaming chat app (UI + FastAPI + PostgreSQL).
builds_on: fs-w3, fs-w2, fs-w1
leads_to: fs-w5
---

The Full-Stack bootcamp builds **one product in three checkpoints**. Checkpoint 1 is a working, secure chat app. Checkpoint 2 adds knowledge (RAG over uploaded documents), and the capstone adds agents, background jobs, evals and deployment.

# Project: "StudyMate" v1: an AI chat app

Pick a theme that gives the product a purpose, for example a study assistant for these bootcamps, a support assistant for the shop, or a writing coach. You'll keep it for all three checkpoints.

### Requirements

**Backend (FastAPI + PostgreSQL)**
- Users: register, log in, `/me`. Argon2/bcrypt password hashing. JWT access tokens (15 min) and a refresh token (stored in the DB; rotated on use).
- Conversations: create, list (paginated), rename, delete. Messages: list, send (streaming).
- An **LLM gateway** module: timeouts, 2 retries with backoff on 429/5xx, model from configuration, token and latency logging per message.
- Alembic migrations; settings via environment variables; CORS configured for the frontend origin only.
- Every query scoped to the current user (no IDOR). Test it explicitly.

**Frontend (React/Next.js, Vue or plain JS)**
- Login/register screens. A conversation sidebar. The chat view with streaming via fetch + SSE parsing.
- Stop (abort), retry on error, safe markdown + code highlighting + copy.
- Empty-state suggested prompts. Accessible message list (`aria-live`).

**Quality**
- At least 12 backend tests with `pytest` + `httpx.AsyncClient`: auth flow, ownership checks, validation errors, and the chat endpoint with a **fake LLM** injected through dependency overrides.
- README: architecture diagram, setup, environment variables, and screenshots or a GIF.
- `docker compose up` brings up Postgres (and optionally the API). Week 12 completes the containerization.

## Milestones

- [ ] Repo + project structure; Postgres via Docker; settings; health endpoint
- [ ] Models + Alembic migrations for users, conversations, messages
- [ ] Auth: register/login/refresh/me with hashing and JWT; tests
- [ ] Conversation and message CRUD with ownership scoping; tests (including IDOR)
- [ ] LLM gateway + streaming endpoint (SSE) that persists messages and usage
- [ ] Frontend: auth screens, sidebar, streaming chat with stop/retry/markdown
- [ ] Tests with a fake LLM via dependency overrides; at least 12 passing
- [ ] README with architecture and demo; tag the release v1.0

## Rubric

| Criterion | Weight |
|---|---|
| Works end to end: auth, persistence, streaming | 30% |
| Security: hashing, JWT handling, ownership scoping, CORS, no secrets in code | 20% |
| Backend design: routers/schemas/services, gateway, migrations | 20% |
| Frontend UX: streaming, stop/retry, markdown safety, accessibility | 15% |
| Tests and documentation | 15% |

## Stretch goals

- Conversation titles generated automatically by a cheap model after the first exchange.
- 👍/👎 feedback stored per message (you'll use it in week 11).
- Rate limiting per user (preview of week 10).
- Dark mode and mobile layout.

# Sources

- [FastAPI: Testing, and dependency overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [FastAPI full-stack template (reference architecture)](https://github.com/fastapi/full-stack-fastapi-template)
- [OWASP ASVS: authentication and session requirements](https://owasp.org/www-project-application-security-verification-standard/)
