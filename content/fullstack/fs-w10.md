---
id: fs-w10
title: Async AI Systems: Redis, Caching, Queues & Workers
week: Week 10
summary: Redis fundamentals, caching strategies for AI apps, rate limiting, background processing with queues and workers, long-running AI tasks with job status, retries, and streaming progress.
builds_on: fs-w9, f-web
leads_to: fs-w11, fs-w12, do-w4
---

AI workloads are slow, bursty and expensive. This week adds the infrastructure that keeps an AI app responsive and affordable under load: **Redis** for caching and rate limiting, and **queues + workers** for long-running tasks such as document ingestion, report generation and agent runs.

# Lesson: Redis in one lesson (25 min)

**Redis** is an in-memory data-structure server: microsecond operations, optional persistence, and a single-threaded command loop that makes each command **atomic**.

| Type | Commands | AI-app use |
|---|---|---|
| String | `SET k v EX 60`, `GET`, `INCR` | Cache entries, counters |
| Hash | `HSET job:1 status running`, `HGETALL` | Job status records |
| List | `LPUSH`, `BRPOP` | Simple queues |
| Sorted set | `ZADD`, `ZRANGEBYSCORE`, `ZREMRANGEBYSCORE` | Sliding-window rate limits, leaderboards |
| Stream | `XADD`, `XREADGROUP`, `XACK` | Durable queues with consumer groups |
| Pub/Sub | `PUBLISH`, `SUBSCRIBE` | Fan-out of progress events to SSE connections |

```python norun
import redis.asyncio as redis
r = redis.from_url("redis://localhost:6379", decode_responses=True)
await r.set("greeting", "hello", ex=60)          # expires after 60s (TTL)
await r.incr("stats:requests")
await r.hset("job:42", mapping={"status": "running", "progress": "0.3"})
print(await r.hgetall("job:42"))
```

```bash norun
docker run -d --name redis -p 6379:6379 redis:7
```

> [!recap]
> - In-memory, atomic commands, TTLs.
> - Strings/hashes for cache and status, sorted sets for rate limits, lists/streams for queues, pub/sub for events.

# Lesson: Caching and rate limiting (35 min)

### Caching strategies

- **Cache-aside**: check the cache → on a miss, compute → store with a TTL. This is the most common pattern.
- What to cache in AI apps:
  - **Embeddings** keyed by `hash(model + text)`. The same text always gives the same vector, so this is a perfect cache.
  - **Deterministic LLM calls** (temperature 0, e.g. classification) keyed by `hash(model + prompt_version + input)`.
  - **Retrieval results** for popular queries (short TTL).
  - **Semantic cache**: reuse an answer if a new question's embedding is very close to a cached question. Use it carefully, because "close" isn't "same", and it can leak data between users.
- **Invalidate** on change (a document re-uploaded → drop its keys), or rely on TTLs. Never share cache entries across users unless the content is truly public.

### Rate limiting

Protect your budget and your providers' limits, and keep things fair across users.

**Token bucket**: each user has a bucket with capacity C that refills at R tokens per second. A request costs one token (or its LLM-token cost). It allows bursts up to C and a sustained rate of R.

```python
import time

class TokenBucket:
    def __init__(self, capacity, rate, clock=time.monotonic):
        self.capacity, self.rate, self.clock = capacity, rate, clock
        self.tokens, self.last = capacity, clock()
    def allow(self, cost=1):
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

t = [0.0]
b = TokenBucket(capacity=3, rate=1.0, clock=lambda: t[0])        # burst 3, then 1 request/second
print([b.allow() for _ in range(5)])        # [True, True, True, False, False]
t[0] = 2.0
print([b.allow() for _ in range(3)])        # 2 tokens refilled -> [True, True, False]
```

**Sliding window with Redis** (a sorted set of request timestamps):

```python norun
async def allow(r, user_id, limit=20, window=60):
    key, now = f"rl:{user_id}", time.time()
    async with r.pipeline(transaction=True) as p:
        p.zremrangebyscore(key, 0, now - window)     # drop old entries
        p.zadd(key, {f"{now}:{uuid4()}": now})
        p.zcard(key)
        p.expire(key, window)
        _, _, count, _ = await p.execute()
    return count <= limit
```

Return **429 Too Many Requests** with a `Retry-After` header. Limit by user **and** globally (the provider's tokens per minute), and apply different limits per plan.

> [!recap]
> - Cache-aside with TTLs. Cache embeddings and deterministic calls. Be careful with semantic caches. Isolate users.
> - Token bucket (bursts + steady rate) or a sliding window in Redis. 429 + Retry-After.

# Lesson: Queues, workers and long-running AI tasks (35 min)

Anything that can take longer than a few seconds (ingesting a 300-page PDF, a 2-minute agent run, a batch evaluation) should leave the request/response cycle:

```text
client ──POST /v1/reports──► API: validate, create job row (queued), enqueue job_id ──► 202 {job_id}
                                                              │
                              Redis queue ──► Worker(s): load job → run steps → update progress
                                                              │            (retries with backoff)
client ◄── SSE /v1/jobs/{id}/events  or  poll GET /v1/jobs/{id} ◄── status/progress/result
```

### Tools

- **Celery**, **RQ**, **Dramatiq**, **arq** (asyncio-native) and **Taskiq** in Python. BullMQ in Node.
- Durable workflow engines (Temporal, Hatchet) for multi-step, long-lived processes with exactly-once semantics per step.

```python norun
# arq example (asyncio + Redis)
async def ingest_document(ctx, document_id: int):
    await set_status(document_id, "processing")
    try:
        text = await extract(document_id)
        chunks = chunk(text)
        for i, batch in enumerate(batched(chunks, 64)):
            await embed_and_upsert(document_id, batch)
            await publish_progress(document_id, (i + 1) / ceil(len(chunks) / 64))
        await set_status(document_id, "ready")
    except TransientError:
        raise                                    # arq retries with backoff (max_tries)
    except Exception as e:
        await set_status(document_id, "failed", error=str(e))   # permanent failure: record it

class WorkerSettings:
    functions = [ingest_document]
    max_jobs = 10                                # concurrency per worker
    job_timeout = 900
```

### Reliability rules for jobs

1. **Idempotent jobs**: they may run twice (at-least-once delivery). Use upserts, hash checks and idempotency keys.
2. **Retries with backoff** for transient errors, a **maximum number of attempts**, then a **dead-letter queue** (or a `failed` status) for inspection.
3. **Timeouts** per job. **Heartbeats** for long jobs, so stuck ones are detected and re-queued.
4. **Concurrency limits** that match the provider rate limits and DB connection pools.
5. **Progress and status** in a hash or DB row: `queued → running (progress) → succeeded | failed | cancelled`.
6. **Cancellation**: a flag checked between steps.
7. **Graceful shutdown**: finish or checkpoint the current step on SIGTERM (Kubernetes rolling deploys, DevOps week 10).

### Streaming progress to the UI

The worker `PUBLISH`es progress events to the channel `job:{id}`. The API's SSE endpoint `SUBSCRIBE`s and forwards them to the browser. On reconnect, the endpoint first sends the current status from the hash, then the live events.

> [!recap]
> - 202 + job_id. Workers consume from a Redis-backed queue. Clients poll or use SSE.
> - Jobs must be idempotent, retried with backoff, time-limited, concurrency-limited and cancellable.
> - Progress via a status hash + pub/sub → SSE.

# Quiz

## Which value is safest to cache indefinitely (keyed by model + text hash)?
- [x] An embedding vector
- [ ] A chat answer at temperature 0.9
- [ ] A user's account balance
- [ ] The current time
> For a fixed model, the same input always produces the same embedding.

## What is a risk of semantic caching for chat answers?
- [ ] It's too fast
- [x] Similar-but-different questions get wrong answers, and caches shared across users can leak data
- [ ] It increases token costs
- [ ] Redis can't store strings
> Use high similarity thresholds, scope the cache per user, and apply it to safe, public content.

## A token bucket with capacity 10 and rate 2/s allows:
- [ ] Exactly 2 requests per second, never more
- [x] Bursts of up to 10 requests, then a sustained 2 per second
- [ ] 10 requests per second
- [ ] Unlimited requests
> Capacity = burst size, refill rate = the sustained throughput.

## Which HTTP response should a rate-limited request get?
- [ ] 500
- [ ] 403
- [x] 429 with a Retry-After header
- [ ] 200 with an empty body
> 429 tells clients to back off, and Retry-After says for how long.

## Why must background jobs be idempotent?
- [ ] To make them faster
- [x] Queues typically deliver at least once; retries and crashes can run a job more than once
- [ ] Redis requires it
- [ ] To use less memory
> Design for duplicate execution.

## A job fails 5 times with the same validation error. Best handling?
- [ ] Retry forever
- [x] Stop retrying (it's not transient), mark it failed or move it to a dead-letter queue with the error, and alert if needed
- [ ] Delete it silently
- [ ] Restart Redis
> Retries are only for transient failures.

## How can a worker's progress reach the browser in real time?
- [ ] The worker calls the browser directly
- [x] The worker publishes events (Redis pub/sub); the API's SSE endpoint subscribes and forwards them
- [ ] The browser connects to Redis
- [ ] Email notifications
> Decouple the workers from the HTTP connections.

# Exercise: Sliding-window rate limiter

Implement `SlidingWindowLimiter(limit, window, clock=time.time)` with `allow(key)` → bool. It allows at most `limit` requests per `key` within any `window` seconds. Store the timestamps per key, and drop the ones that are older than or equal to `now - window`. Rejected requests must **not** be recorded.

## Starter

```python
import time
from collections import deque

class SlidingWindowLimiter:
    def __init__(self, limit, window, clock=time.time):
        pass

    def allow(self, key):
        pass
```

## Tests

```python
ns = load()
t = [100.0]
lim = ns["SlidingWindowLimiter"](limit=3, window=10, clock=lambda: t[0])
assert [lim.allow("u1") for _ in range(4)] == [True, True, True, False]
assert lim.allow("u2") is True, "limits are per key"
t[0] = 105.0
assert lim.allow("u1") is False
t[0] = 110.0
assert lim.allow("u1") is True, "the first three requests (at t=100) are now outside the window"
assert lim.allow("u1") is True and lim.allow("u1") is True and lim.allow("u1") is False
```

## Solution

```python
import time
from collections import deque

class SlidingWindowLimiter:
    def __init__(self, limit, window, clock=time.time):
        self.limit, self.window, self.clock = limit, window, clock
        self.events = {}

    def allow(self, key):
        now = self.clock()
        q = self.events.setdefault(key, deque())
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
```

The Redis version uses a sorted set for the same idea, so all your API replicas share the limit.

# Exercise: Job state machine

Write `transition(job, event)` for jobs with `status` ∈ {queued, running, succeeded, failed, cancelled} and an `attempts` counter. Events:
- `"start"`: queued → running (attempts += 1)
- `"progress"` (with `job["progress"]` set by the caller): allowed only while running, and the status is unchanged
- `"success"`: running → succeeded
- `"transient_error"`: running → queued if attempts < `job["max_attempts"]`, else → failed
- `"fatal_error"`: running → failed
- `"cancel"`: queued or running → cancelled

Return a **new** dict. Raise `ValueError` for illegal transitions (including any event on a terminal status).

## Starter

```python
def transition(job, event):
    pass
```

## Tests

```python
ns = load()
tr = ns["transition"]
j = {"status": "queued", "attempts": 0, "max_attempts": 2}
j = tr(j, "start"); assert j["status"] == "running" and j["attempts"] == 1
j = tr(j, "transient_error"); assert j["status"] == "queued"
j = tr(tr(j, "start"), "transient_error"); assert j["status"] == "failed" and j["attempts"] == 2
for bad in ["start", "success", "cancel"]:
    try:
        tr(j, bad); raise AssertionError("terminal state must reject " + bad)
    except ValueError:
        pass
k = tr({"status": "queued", "attempts": 0, "max_attempts": 3}, "cancel"); assert k["status"] == "cancelled"
orig = {"status": "queued", "attempts": 0, "max_attempts": 3}
tr(orig, "start"); assert orig["status"] == "queued", "must not mutate input"
```

## Solution

```python
TERMINAL = {"succeeded", "failed", "cancelled"}

def transition(job, event):
    s = job["status"]
    if s in TERMINAL:
        raise ValueError(f"job is {s}")
    new = dict(job)
    if event == "start" and s == "queued":
        new["status"], new["attempts"] = "running", job["attempts"] + 1
    elif event == "progress" and s == "running":
        pass
    elif event == "success" and s == "running":
        new["status"] = "succeeded"
    elif event == "transient_error" and s == "running":
        new["status"] = "queued" if job["attempts"] < job["max_attempts"] else "failed"
    elif event == "fatal_error" and s == "running":
        new["status"] = "failed"
    elif event == "cancel" and s in ("queued", "running"):
        new["status"] = "cancelled"
    else:
        raise ValueError(f"illegal transition {s} --{event}-->")
    return new
```

Explicit state machines prevent impossible states, such as a "succeeded" job being retried. The same idea applies to agent runs and document ingestion.

# Sources

- [Redis documentation: data types, pipelines and transactions](https://redis.io/docs/latest/develop/data-types/)
- [Redis: rate limiting patterns](https://redis.io/glossary/rate-limiting/)
- [arq documentation (asyncio job queue)](https://arq-docs.helpmanual.io/) and [Celery documentation](https://docs.celeryq.dev/)
- [Stripe engineering: Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)
- [AWS Builders' Library: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
