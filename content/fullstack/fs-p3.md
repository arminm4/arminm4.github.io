---
id: fs-p3
title: Capstone: Production AI Product
week: Weeks 13–14
kind: project
summary: Turn StudyMate into a deployed, observable, evaluated AI product with agents, background jobs, guardrails and CI/CD.
builds_on: fs-w12, fs-w11, fs-w10, fs-w9, fs-p2
---

The capstone completes the product you started in week 4. At the end you'll have a portfolio piece that demonstrates the full stack of AI engineering: UI, API, data, retrieval, agents, async infrastructure, evaluation, observability and deployment.

# Project: StudyMate v3: production-ready

### Feature requirements

1. **Agent features** (week 9): at least one agentic capability with tools, for example "Plan my week of study" (reads progress and documents, proposes a schedule, creates calendar-style entries after **approval**), or "Quiz me and track weak topics" (a structured workflow).
2. **Tool registry** with risk levels, scopes, read-only mode, hash-bound approvals and an audit log.
3. **Background jobs** (week 10): ingestion and long agent runs on Redis-backed workers, with job status, progress streamed via SSE, retries, timeouts and cancellation.
4. **Caching and rate limiting**: an embedding cache, per-user rate limits and daily token budgets by plan.
5. **Evaluation** (week 11): at least 60 eval cases (retrieval, answers, agent tasks, adversarial). Deterministic checks + a calibrated judge. The CI fails on regression.
6. **Observability**: traces for LLM, retrieval and tool spans. A dashboard with p95 latency, error rate, cost per user, cache hit rate and the 👍/👎 ratio. Two alerts.
7. **Guardrails**: input size and moderation, injection-aware handling of documents, PII redaction in logs, sanitized rendering, link allowlist.
8. **Deployment** (week 12): Dockerized API, worker and web; Compose (or Kubernetes); HTTPS; secrets in a secret store; migrations in the pipeline; automated DB backups with a tested restore.

### Deliverables

- A public demo URL (or a recorded 5-minute demo video).
- A README with an architecture diagram, setup, environment variables, eval results, dashboards (screenshots) and known limitations.
- A **design doc** (2–4 pages): requirements, architecture, data model, the key trade-offs (model choice, retrieval configuration, sync vs async), the risk analysis and the cost model (cost per active user per month).
- A 10-minute presentation as if to an engineering team: a live demo, the metrics and lessons learned.

## Milestones

- [ ] Design doc v1: the agent feature spec, the tool list with risk levels, and the cost model
- [ ] Tool registry + guarded executor + approval UI + audit log
- [ ] Redis: queue + workers for ingestion and agent runs; job status SSE; cancellation
- [ ] Embedding cache, per-user rate limits and daily budgets
- [ ] Eval suite (60+ cases) + calibrated judge + CI gate
- [ ] Tracing + dashboard + 2 alerts; PII redaction in logs
- [ ] Docker images, Compose/K8s, HTTPS, secrets, migrations in CD, backups with a restore test
- [ ] Load test (e.g. k6 or Locust): find the bottleneck and document it
- [ ] Final README, design doc, demo video and presentation

## Rubric

| Criterion | Weight |
|---|---|
| Product completeness and UX | 15% |
| Agent and tool design (safety, approvals, control) | 15% |
| Async infrastructure (jobs, caching, rate limits) | 15% |
| Evaluation and observability rigour | 20% |
| Deployment, security and operations | 20% |
| Documentation, design doc and presentation | 15% |

## Stretch goals

- Multi-provider fallback with a circuit breaker and a measured failover.
- Prompt caching and model routing, with before/after cost numbers.
- Expose StudyMate as an **MCP server**, so you can use it from Claude Desktop.
- A mobile-friendly PWA, like the one you're using right now.

# Sources

- [Google SRE Book: Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Grafana k6: load testing documentation](https://grafana.com/docs/k6/latest/)
- *AI Engineering* by Chip Huyen: chapters on evaluation, architecture and user feedback
- *Designing Data-Intensive Applications* by Martin Kleppmann: reliability and scalability chapters
