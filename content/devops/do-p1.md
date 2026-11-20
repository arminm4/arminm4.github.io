---
id: do-p1
title: Project: Ship a Web App to a Linux Server with CI/CD
week: Week 6
kind: project
summary: Take a small multi-service app from Git to a hardened Linux server: containers, Nginx with HTTPS, a CI/CD pipeline with staging and rollback, backups and runbooks.
builds_on: do-w5, do-w4, do-w3, do-w2
leads_to: do-w7
---

# Project: From commit to production on a single server

**App**: use your Python capstone, the Full-Stack StudyMate API, or any small web app with a database (e.g. a FastAPI or Flask TODO app + PostgreSQL + Redis). The focus is the **operations**, not the features.

### Requirements

**Server** (a cheap cloud VM or a local VM)
- A non-root deploy user, SSH keys only, root login disabled, ufw allowing only 22/80/443, fail2ban, unattended security upgrades.
- Docker + Docker Compose installed with a script (`bootstrap.sh`, idempotent; it will become Ansible in week 8).

**App packaging**
- A multi-stage Dockerfile: non-root, healthcheck, exec-form CMD, `.dockerignore`, image < 200 MB if possible.
- Compose: app + Postgres (named volume) + Redis. The DB isn't published to the host.

**Edge**
- Nginx (or Caddy) as a reverse proxy with **Let's Encrypt HTTPS**, an HTTP→HTTPS redirect and security headers.
- A domain or a free subdomain (DuckDNS, or nip.io for testing).

**CI/CD (GitHub Actions)**
- PRs run lint + tests + image build, with branch protection on `main`.
- On main: build → push to GHCR with SHA tags → deploy to **staging** (a second Compose project or a second VM) → smoke test → **manual approval** (environment) → deploy to **production** → health check → **automatic rollback** to the previous tag on failure.
- Secrets in GitHub environments; actions pinned to SHAs.

**Operations**
- Nightly `pg_dump` via a systemd timer or cron, rotated with GFS retention, copied off-server. **A documented restore test.**
- Log access with `docker compose logs`, plus a simple uptime check (e.g. Uptime Kuma or a free uptime service).
- `RUNBOOK.md`: how to deploy, roll back, restore the DB, rotate a secret and respond to "site is down".

## Milestones

- [ ] Harden the server (user, SSH, firewall, fail2ban, updates) with an idempotent bootstrap script
- [ ] Dockerfile + Compose for app/DB/Redis; local run passes the healthcheck
- [ ] Nginx/Caddy reverse proxy with HTTPS and a redirect; security headers
- [ ] CI on PRs: lint, test, build; branch protection
- [ ] CD: GHCR push, staging deploy, smoke test, approval, production deploy
- [ ] Automatic rollback on a failed health check (prove it with a deliberately broken release)
- [ ] Backups with retention and an off-server copy; perform and document a restore test
- [ ] RUNBOOK.md + architecture diagram + a demo video of the pipeline

## Rubric

| Criterion | Weight |
|---|---|
| Server security and the idempotent bootstrap | 20% |
| Container quality (size, non-root, health, signals) | 15% |
| CI/CD design (gates, promotion, secrets, rollback demonstrated) | 30% |
| Backups and a proven restore | 15% |
| Runbook, documentation and clarity | 20% |

## Stretch goals

- Blue-green deploys on the single server (two Compose stacks behind Nginx upstream switching).
- Image scanning (Trivy) as a CI gate, plus SBOM generation.
- Zero-downtime migrations with expand/contract, demonstrated in a release.

# Sources

- [DigitalOcean community tutorials: Docker Compose + Nginx + Let's Encrypt](https://www.digitalocean.com/community/tutorials)
- [GitHub Docs: Using environments for deployment](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [Google SRE Workbook: On-call and runbooks (playbooks)](https://sre.google/workbook/on-call/)
