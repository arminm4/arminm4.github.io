---
id: do-w5
title: Continuous Integration & Delivery
week: Week 5
summary: CI/CD concepts, pipeline triggers, jobs and runners, automated tests and linting, building and publishing images, versioning and tags, staging and production pipelines, pipeline secrets, deployment checks and rollback.
builds_on: do-w4, do-w3
leads_to: do-p1, do-w7, do-w10
---

**Continuous Integration (CI)** means merging small changes frequently, with every change automatically built and tested. **Continuous Delivery (CD)** means every change that passes the pipeline is *releasable*. **Continuous Deployment** goes one step further and releases it automatically. Together they're the backbone of the DORA metrics from week 1. You've already used CI/CD: this very app is built and published by the GitHub Actions workflows in its repository.

# Lesson: CI fundamentals (30 min)

### The pipeline

```text
push / PR ──► trigger ──► [lint] ─┐
                          [unit tests] ─┼─► [build image] ─► [integration tests] ─► [publish artifact]
                          [security scan]┘
```

- **Trigger**: an event that starts the pipeline (push, pull request, tag, schedule, manual dispatch).
- **Job**: a set of steps that runs on one **runner** (a VM or container). Jobs run **in parallel** unless they declare dependencies (`needs:`).
- **Step**: one command or reusable action.
- **Artifact**: an output passed between jobs or published (a test report, a binary, a container image).
- **Cache**: dependency caches (pip, npm, Docker layers) that speed up runs.

### What CI should check (fast feedback first)

1. **Formatting and linting** (seconds): ruff/black, eslint/prettier, shellcheck, hadolint, yamllint.
2. **Unit tests** (seconds to minutes) with **coverage**.
3. **Static analysis and security**: type checks (mypy, tsc), dependency vulnerability scans, secret scanning.
4. **Build** the artifact or image.
5. **Integration tests** with real dependencies (service containers: Postgres, Redis).

> [!important] Keep main green
> A failing main branch blocks everyone. Require passing checks and a review before merging (branch protection). Fix or revert broken builds immediately. Flaky tests erode trust, so quarantine and fix them.

### GitHub Actions example

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix: { python: ["3.11", "3.12"] }          # run the job for each version
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready" --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "${{ matrix.python }}", cache: pip }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check . && mypy app
      - run: pytest -q --cov=app --cov-report=xml
        env: { DATABASE_URL: "postgresql://postgres:test@localhost:5432/postgres" }
```

GitLab CI (`.gitlab-ci.yml` with `stages:` and jobs), Jenkins and others express the same concepts.

> [!connect] Look at a real pipeline
> This app's repository has `.github/workflows/pages.yml` (it validates the lessons, builds the site and deploys it) and `android.yml` (it builds and signs the APK, then publishes a release). Read them now: you'll recognize triggers, jobs, steps, secrets, artifacts and releases.

> [!recap]
> - Triggers → jobs (parallel unless `needs`) → steps, on runners. Artifacts and caches.
> - Fast checks first: lint → unit → static/security → build → integration.
> - Keep main green with branch protection, and fix flaky tests.

# Lesson: Building, versioning and publishing artifacts (25 min)

```yaml
  build-image:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Versioning strategy

- **Every build** gets an immutable identifier: the commit SHA (`sha-3f9a2c1`).
- **Releases** get semantic versions from Git tags (`v1.4.0` → image `1.4.0`).
- **Build once, promote many times**: the *same* image digest goes to staging and then to production. Never rebuild for production, because a rebuild may differ.
- Optionally, **sign** images (cosign) and generate an **SBOM** (software bill of materials) for supply-chain security.

> [!recap]
> - Build on main; push to a registry; tag with the SHA and semver; cache layers.
> - Promote the same artifact through the environments. Sign and SBOM for supply-chain security.

# Lesson: Continuous delivery: environments, secrets, checks and rollback (35 min)

### A promotion pipeline

```text
main ─► build+test ─► deploy STAGING ─► smoke tests ─► [manual approval] ─► deploy PRODUCTION ─► health checks
                                                                                   │ fail
                                                                                   ▼
                                                                              automatic ROLLBACK
```

GitHub **environments** (`environment: production`) add **required reviewers**, wait timers and environment-scoped secrets, so production secrets are only available to approved production jobs.

### Pipeline secrets

- Store them in the CI secret store (repository, environment or organization secrets). They're masked in logs.
- Use **least privilege**: a deploy key that can only deploy to one service.
- Prefer **short-lived credentials via OIDC** federation (GitHub → AWS/GCP/Azure) over long-lived cloud keys stored as secrets.
- Never `echo` secrets, and be careful with third-party actions: **pin them to a commit SHA** (supply-chain risk).
- Pull requests from forks don't get secrets. Keep it that way.

### Deployment strategies

| Strategy | How | Trade-off |
|---|---|---|
| Recreate | Stop the old version, start the new one | Simple; downtime |
| **Rolling** | Replace instances gradually | No downtime; mixed versions briefly |
| **Blue-green** | Run the new version alongside the old one, then switch traffic | Instant switch and rollback; double the resources |
| **Canary** | Send a small percentage of traffic to the new version, watch the metrics, then increase | Limits the blast radius; needs good metrics |
| Feature flags | Deploy dark, enable per user or segment | Decouples deploy from release |

### Deployment checks and rollback

- **Pre-deploy**: migrations are backward compatible (expand → migrate → contract), the config is valid, and the image exists.
- **Post-deploy**: health endpoints, smoke tests (log in, a critical API call), and the error rate and latency compared against the baseline for N minutes.
- **Rollback**: redeploy the previous image digest (it's fast because the artifact already exists). Database changes must be **backward compatible**, so the old version still works with the new schema.

> [!warning] Database migrations are the hard part
> You can't "un-drop" a column. Use the **expand/contract** pattern: (1) add the new column and write to both, (2) backfill, (3) switch reads, (4) remove the old column in a later release. Every step stays compatible with the previous app version.

> [!recap]
> - Staging → smoke → approval → production → health checks → auto-rollback.
> - Environment-scoped secrets, OIDC, pinned actions, no secrets for forks.
> - Rolling, blue-green, canary and feature flags. Expand/contract migrations so rollback stays possible.

# Quiz

## In GitHub Actions, two jobs without `needs` between them run:
- [ ] Sequentially in file order
- [x] In parallel
- [ ] Only if the first fails
- [ ] Never
> Use `needs:` to create dependencies (a DAG).

## Which check should run first in a CI pipeline?
- [x] Fast lint and formatting checks
- [ ] A full end-to-end test suite
- [ ] The production deploy
- [ ] A load test
> Fail fast with cheap checks.

## Why "build once, promote the same artifact" to production?
- [ ] It's cheaper on storage
- [x] Rebuilding could produce a different artifact; promoting the tested digest guarantees that production runs exactly what was tested
- [ ] Registries require it
- [ ] To skip testing
> Reproducibility and confidence.

## What's the safest way for a pipeline to get cloud credentials?
- [ ] Long-lived access keys pasted in the YAML
- [ ] Repository secrets shared with fork PRs
- [x] Short-lived credentials via OIDC federation with least-privilege roles
- [ ] The developer's personal keys
> No long-lived secrets to leak.

## Canary deployment means:
- [ ] Deploying only on Fridays
- [x] Sending a small share of traffic to the new version, watching the metrics, then gradually increasing
- [ ] Running two full environments and switching instantly
- [ ] Stopping the old version first
> It limits the blast radius of bad releases.

## A deploy fails its health checks. The fastest safe recovery is usually:
- [ ] Hot-fix the code on the server
- [x] Roll back by redeploying the previous image digest
- [ ] Rebuild everything from scratch
- [ ] Restart the database
> Previous artifacts are ready to go.

## Why use expand/contract for schema changes?
- [x] So every step stays compatible with the previous app version, enabling zero-downtime deploys and rollbacks
- [ ] It makes migrations faster
- [ ] Databases require it
- [ ] To avoid indexes
> Destructive changes come last, after nothing depends on the old shape.

## Why pin third-party GitHub Actions to a commit SHA?
- [ ] It's faster
- [x] Tags can be moved; a compromised action version could steal your secrets (supply-chain risk)
- [ ] GitHub requires it
- [ ] To use less storage
> Pinning gives you an immutable, reviewed dependency.

# Exercise: Pipeline DAG ordering

Pipelines are DAGs: jobs with dependencies. Write `stages(jobs)`, where `jobs` maps a job name to the list of jobs it `needs`. Return a list of **stages** (lists of job names, sorted alphabetically within each stage), where each stage contains the jobs whose dependencies are all in earlier stages (the jobs in a stage can run in parallel). Raise `ValueError` on a cycle or on an unknown dependency.

## Starter

```python
def stages(jobs):
    pass
```

## Tests

```python
ns = load()
jobs = {"lint": [], "test": [], "scan": [], "build": ["lint", "test"], "integration": ["build"],
        "deploy_staging": ["integration", "scan"], "deploy_prod": ["deploy_staging"]}
assert ns["stages"](jobs) == [["lint", "scan", "test"], ["build"], ["integration"], ["deploy_staging"], ["deploy_prod"]]
for bad in [{"a": ["b"], "b": ["a"]}, {"a": ["missing"]}]:
    try:
        ns["stages"](bad); raise AssertionError("expected ValueError")
    except ValueError:
        pass
assert ns["stages"]({}) == []
```

## Hint

Kahn's algorithm: repeatedly collect every job whose dependencies are all already "done". If no job can be scheduled but some remain, there's a cycle.

## Solution

```python
def stages(jobs):
    for job, deps in jobs.items():
        for d in deps:
            if d not in jobs:
                raise ValueError(f"{job} needs unknown job {d}")
    done, result = set(), []
    remaining = set(jobs)
    while remaining:
        ready = sorted(j for j in remaining if all(d in done for d in jobs[j]))
        if not ready:
            raise ValueError(f"cycle among: {sorted(remaining)}")
        result.append(ready)
        done |= set(ready)
        remaining -= set(ready)
    return result
```

This is exactly how CI systems schedule `needs:` graphs, and how build tools (Make, Bazel), Terraform (week 7) and Airflow order their work.

# Sources

- [GitHub Actions documentation: workflow syntax, environments, OIDC, security hardening](https://docs.github.com/en/actions)
- [Martin Fowler: Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)
- *Continuous Delivery* by Jez Humble & David Farley
- [GitLab CI/CD documentation](https://docs.gitlab.com/ee/ci/)
- [Sigstore cosign: signing container images](https://docs.sigstore.dev/)
- [Martin Fowler: BlueGreenDeployment and CanaryRelease](https://martinfowler.com/bliki/BlueGreenDeployment.html)
