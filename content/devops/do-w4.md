---
id: do-w4
title: Containers & Docker
week: Week 4
summary: Containers vs virtual machines (namespaces and cgroups), images and layers, Dockerfiles and the build cache, multi-stage builds, Docker Compose, container networking, volumes, configuration and secrets, registries, and troubleshooting.
builds_on: do-w3, do-w1
leads_to: do-w5, do-w9, fs-w12
---

Containers changed how software ships: **build once, run anywhere**, with the app and its dependencies packaged together and isolated from everything else on the host. Docker made containers mainstream, and Kubernetes (weeks 9–10) orchestrates them at scale. This week you'll understand containers from the kernel up.

# Lesson: What a container really is (30 min)

A container is **not a small VM**. It's an ordinary Linux **process**, isolated with kernel features:

- **Namespaces** give each container its own *view* of the system: process IDs (pid), network interfaces (net), mount points (mnt), hostname (uts), users (user) and IPC.
- **cgroups** (control groups) *limit and account* for resources: CPU, memory, I/O and the number of processes.
- A **layered filesystem** (overlayfs) provides the container's root filesystem from image layers plus a thin writable layer.

| | Virtual machine | Container |
|---|---|---|
| Isolation | Full guest OS on a hypervisor | Processes sharing the host kernel |
| Startup | Seconds to minutes | Milliseconds to seconds |
| Size | GBs | MBs |
| Density | Tens per host | Hundreds per host |
| Security boundary | Strong | Weaker (a shared kernel), so harden it |

### Images vs containers

- An **image** is a read-only template: an ordered stack of layers plus metadata (the default command, environment, exposed ports). It's identified by a **digest** (`sha256:…`) and referenced by **tags** (`python:3.12-slim`).
- A **container** is a running (or stopped) instance of an image, with its own writable layer. **Containers are disposable**: anything written inside is lost when the container is removed, unless it's stored in a volume.

```bash norun
docker run --rm -it ubuntu:24.04 bash            # interactive, removed on exit
docker run -d --name web -p 8080:80 nginx:1.27   # detached; host port 8080 -> container port 80
docker ps; docker logs -f web; docker exec -it web sh
docker stop web && docker rm web
docker images; docker image inspect nginx:1.27 | head -40
```

> [!recap]
> - Container = a process + namespaces (view) + cgroups (limits) + a layered filesystem.
> - An image is an immutable layered template, and a container is a disposable instance.
> - Data that must survive lives in volumes.

# Lesson: Dockerfiles, layers and the build cache (35 min)

Each instruction in a Dockerfile creates a **layer**. Layers are **cached**: if an instruction and its inputs haven't changed, Docker reuses the cached layer. **Once one layer changes, every layer after it is rebuilt.**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./      # 1) only the dependency manifests
RUN npm ci                                  # 2) cached until the manifests change

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .                                    # 3) source changes invalidate from here
RUN npm run build

FROM nginx:1.27-alpine AS runtime           # 4) final image: static files + nginx only
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

### Best practices

| Practice | Why |
|---|---|
| Order instructions from least to most frequently changed | Maximizes cache hits |
| Multi-stage builds | Compilers and dev dependencies stay out of the final image |
| Small, pinned base images (`-slim`, `-alpine`, distroless) | Smaller attack surface; reproducible builds |
| Combine related `RUN` steps; clean package caches in the same layer | Fewer, smaller layers |
| `.dockerignore` | Excludes `.git`, `node_modules` and secrets from the build context |
| A non-root `USER` | Limits the damage if compromised |
| `HEALTHCHECK` | Lets orchestrators know whether the app is healthy |
| No secrets in `ENV`, `ARG` or `COPY` | Image layers are readable by anyone who can pull the image. Use BuildKit `--secret` for build-time secrets |
| Exec-form `CMD ["app"]` | Your process becomes PID 1 and **receives SIGTERM** (the shell form wraps it in `sh -c`, which may not forward signals) |

```bash norun
docker build -t studymate-api:1.4.0 .
docker history studymate-api:1.4.0        # inspect layers and their sizes
docker run --rm studymate-api:1.4.0 id    # confirm it runs as non-root
```

> [!recap]
> - Each instruction is a layer. A cache miss rebuilds every layer after it.
> - Multi-stage, slim and pinned, `.dockerignore`, non-root, healthcheck, no secrets in layers.
> - Use the exec form so signals reach your app.

# Lesson: Compose, networking, volumes and config (35 min)

### Container networking

- The default **bridge** network: containers get private IPs, and you **publish** ports to the host with `-p host:container`.
- **User-defined networks** (Compose creates one per project) give **DNS by container/service name**: `db:5432`.
- `--network host` shares the host's network stack (rarely needed).
- Only publish ports that the outside world needs. The database usually needs no published port at all.

### Volumes: persistent data

| Type | Syntax | Use |
|---|---|---|
| Named volume | `-v pgdata:/var/lib/postgresql/data` | Database data; managed by Docker |
| Bind mount | `-v ./src:/app/src` | Development (live code reload), host config files |
| tmpfs | `--tmpfs /tmp` | In-memory scratch space |

### Configuration and secrets

- Configuration goes in **environment variables** (`-e`, `--env-file`, Compose `environment:`).
- Secrets: Compose and Swarm `secrets:` mount files at `/run/secrets/<name>`. In Kubernetes, use Secret objects (week 9). In CI, use the CI secret store. Never bake secrets into images.

### Compose: multi-container apps

```yaml
services:
  api:
    image: ghcr.io/me/studymate-api:1.4.0
    env_file: .env
    environment:
      DATABASE_URL: postgresql://app:${PGPASS}@db:5432/app
    depends_on:
      db: { condition: service_healthy }
    ports: ["8000:8000"]
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }     # cgroups limits
  db:
    image: postgres:16
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: "${PGPASS}" }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }
volumes:
  pgdata:
```

```bash norun
docker compose up -d --build
docker compose ps; docker compose logs -f api
docker compose exec db psql -U app
docker compose down          # add -v to also delete the volumes (careful: deletes data!)
```

### Registries

Images are pushed to registries: Docker Hub, **GitHub Container Registry (ghcr.io)**, or cloud registries (ECR, GCR/Artifact Registry, ACR). Tag images with an **immutable version or commit SHA** (`:1.4.0`, `:sha-3f9a2c1`), not just `:latest`, so deploys are reproducible and rollbacks are trivial. Scan images for vulnerabilities (Trivy, Docker Scout).

### Troubleshooting

```bash norun
docker logs --tail 100 api                 # app output (stdout/stderr)
docker inspect api | less                  # config, mounts, network, health, exit code
docker exec -it api sh                     # look inside (if a shell exists)
docker stats                               # live CPU/memory
docker events                              # what the daemon is doing
docker system df; docker system prune      # disk usage / clean up (prune carefully)
```

| Symptom | Check |
|---|---|
| Exits immediately | `docker logs`; is the CMD wrong? Missing env var? |
| Exit code 137 | SIGKILL, often an **OOM kill** (memory limit). `docker inspect` → `OOMKilled` |
| "Connection refused" from another container | Using `localhost` instead of the service name? App bound to 127.0.0.1 instead of 0.0.0.0? |
| Works locally, not in prod | Image tag mismatch, missing env/secret, architecture (arm64 vs amd64) |

> [!recap]
> - User-defined networks give DNS by name. Publish only what's necessary.
> - Named volumes for data, bind mounts for development. Env for config, secret mounts for secrets.
> - Compose for multi-container apps. Immutable tags in registries. Scan the images.
> - Troubleshoot with logs, inspect, exec, stats. Exit 137 = killed (often OOM).

# Quiz

## What isolates what a containerized process can *see* (PIDs, network, mounts)?
- [x] Linux namespaces
- [ ] cgroups
- [ ] The hypervisor
- [ ] The Docker registry
> cgroups limit resources. Namespaces isolate views.

## You change one line of application source code. With a well-ordered Dockerfile, which steps rebuild?
- [ ] All layers, including the dependency install
- [x] Only the layers from `COPY . .` onward; the dependency layers come from cache
- [ ] Nothing; Docker detects code changes automatically
- [ ] Only the FROM layer
> Copy the manifests and install the dependencies before copying the source code.

## Why is `CMD ["python", "app.py"]` preferred over `CMD python app.py`?
- [ ] It's shorter
- [x] The exec form makes the app PID 1 so it receives SIGTERM for graceful shutdown
- [ ] The shell form isn't supported
- [ ] It runs faster
> The shell form runs under `sh -c`, which may not forward signals.

## Where should a PostgreSQL container store its data?
- [ ] In the container's writable layer
- [x] In a named volume mounted at the data directory
- [ ] In the image
- [ ] In /tmp
> Container layers are disposable. Volumes persist.

## In Compose, the api container can't reach `localhost:5432` for the database. Fix?
- [ ] Publish the port on the host
- [x] Use the service name: `db:5432`
- [ ] Use host networking
- [ ] Restart Docker
> Inside a container, localhost is the container itself.

## A container keeps dying with exit code 137. Likely cause?
- [ ] A syntax error
- [x] It was killed (SIGKILL), often by the OOM killer because of a memory limit
- [ ] A successful exit
- [ ] DNS failure
> 137 = 128 + 9 (SIGKILL). Check OOMKilled and the memory usage.

## Why tag images with versions or SHAs rather than only `:latest`?
- [ ] `:latest` is deprecated
- [x] Immutable tags make deployments reproducible and rollbacks precise
- [ ] Registries reject `:latest`
- [ ] It makes images smaller
> `:latest` can point to different images over time.

## Where should secrets NOT be placed?
- [ ] A secret manager, mounted at runtime
- [ ] CI secret stores
- [x] Dockerfile ENV/ARG instructions or COPYed files baked into the image
- [ ] Kubernetes Secrets
> Anyone who can pull the image can read its layers.

# Exercise: Simulate the Docker build cache

Write `rebuilt_steps(steps, changed_files)`. `steps` is a list of dicts `{"cmd": "COPY", "inputs": ["package.json"]}` or `{"cmd": "RUN", "inputs": []}`. A step's cache is invalidated if it is a `COPY` whose `inputs` include any changed file (`"."` means "all files", so any change invalidates it), **or** if any earlier step was invalidated. `FROM` steps never change here. Return the list of indices that get rebuilt.

## Starter

```python
def rebuilt_steps(steps, changed_files):
    pass
```

## Tests

```python
ns = load()
good = [
    {"cmd": "FROM", "inputs": []},
    {"cmd": "COPY", "inputs": ["requirements.txt"]},
    {"cmd": "RUN", "inputs": []},                 # pip install
    {"cmd": "COPY", "inputs": ["."]},
    {"cmd": "RUN", "inputs": []},                 # build
]
assert ns["rebuilt_steps"](good, {"app/main.py"}) == [3, 4]
assert ns["rebuilt_steps"](good, {"requirements.txt"}) == [1, 2, 3, 4]
assert ns["rebuilt_steps"](good, set()) == []
bad = [{"cmd": "FROM", "inputs": []}, {"cmd": "COPY", "inputs": ["."]}, {"cmd": "RUN", "inputs": []}]
assert ns["rebuilt_steps"](bad, {"app/main.py"}) == [1, 2], "code change re-runs the install"
```

## Solution

```python
def rebuilt_steps(steps, changed_files):
    rebuilt, invalid = [], False
    for i, step in enumerate(steps):
        if not invalid and step["cmd"] == "COPY":
            ins = step["inputs"]
            if ("." in ins and changed_files) or any(f in changed_files for f in ins):
                invalid = True
        if invalid:
            rebuilt.append(i)
    return rebuilt
```

The `bad` Dockerfile re-installs every dependency on each code change, which costs minutes per build in CI. Ordering matters.

# Sources

- [Docker docs: Get started, Dockerfile reference and build best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker docs: Networking overview, Volumes, Compose file reference](https://docs.docker.com/engine/network/)
- [Julia Evans: "How containers work" zine](https://wizardzines.com/zines/containers/)
- [Liz Rice: "Containers From Scratch" (GOTO talk)](https://www.youtube.com/watch?v=8fi7uSYlOdc)
- [Aqua Security Trivy: container image scanning](https://trivy.dev/)
- [OCI Image Specification](https://github.com/opencontainers/image-spec)
