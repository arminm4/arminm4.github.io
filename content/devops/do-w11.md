---
id: do-w11
title: Observability & Reliability Engineering
week: Week 11
summary: Monitoring vs observability, metrics, logs and traces, Prometheus and PromQL, Grafana dashboards, the golden signals, alerting, SLIs, SLOs and error budgets, load testing, incident response, runbooks and blameless postmortems.
builds_on: do-w10, f-stats
leads_to: do-p2
---

Shipping is half the job. The other half is **knowing whether it works** for users, and **recovering fast** when it doesn't. This week brings together Google's Site Reliability Engineering (SRE) practices: measure what users experience, set explicit reliability targets, alert on what matters, and learn from every incident.

# Lesson: The three pillars: metrics, logs and traces (30 min)

- **Monitoring** answers known questions ("is CPU above 90%?"). **Observability** is the ability to answer **new** questions about your system's behaviour from its outputs, without shipping new code.

| Pillar | What | Strength | Tools |
|---|---|---|---|
| **Metrics** | Numeric time series (counters, gauges, histograms) with labels | Cheap, aggregatable, great for alerting and dashboards | Prometheus, Grafana, CloudWatch |
| **Logs** | Timestamped event records (structured JSON preferred) | Detail and context for a specific event | Loki, Elasticsearch/OpenSearch, CloudWatch Logs |
| **Traces** | The path of one request across services (spans with timings) | Where the time went, in distributed systems | OpenTelemetry + Jaeger/Tempo |

**OpenTelemetry (OTel)** is the vendor-neutral standard for producing all three. Correlate them with a shared **trace ID** in the logs: from a slow-request alert (metric) → the trace (which span was slow) → the logs of that span.

### Metric types

- **Counter**: only goes up (requests_total, errors_total). Query its **rate**.
- **Gauge**: goes up and down (memory_bytes, queue_depth, temperature).
- **Histogram**: counts of observations in buckets (request_duration_seconds), which gives you **percentiles**.

> [!warning] Label cardinality
> Every unique label combination is a separate time series. Labels like `user_id` or the full URL with IDs can create millions of series and take down your monitoring. Use bounded labels: method, route template, status class.

> [!recap]
> - Metrics for trends and alerts, logs for details, traces for request paths. OTel is the standard.
> - Counter, gauge, histogram. Keep the label cardinality bounded.

# Lesson: Prometheus, PromQL and Grafana (35 min)

**Prometheus** **scrapes** HTTP `/metrics` endpoints on a schedule (pull model), stores the time series and evaluates alert rules. In Kubernetes, the **kube-prometheus-stack** Helm chart installs Prometheus, Alertmanager, Grafana, node-exporter and kube-state-metrics.

```text
# What an app exposes at /metrics (text format)
http_requests_total{method="GET",route="/api/chat",status="200"} 10432
http_requests_total{method="POST",route="/api/chat",status="500"} 17
http_request_duration_seconds_bucket{route="/api/chat",le="0.5"} 9800
http_request_duration_seconds_bucket{route="/api/chat",le="1"}   10300
http_request_duration_seconds_bucket{route="/api/chat",le="+Inf"} 10449
```

### PromQL essentials

```text
# requests per second over the last 5 minutes, per route
sum by (route) (rate(http_requests_total[5m]))

# error ratio (5xx / all)
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# p95 latency from histogram buckets
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))

# memory working set per pod (Kubernetes)
sum by (pod) (container_memory_working_set_bytes{namespace="studymate"})

# saturation: queue depth trend
max_over_time(job_queue_depth[15m])
```

Key functions: `rate()` (per-second increase of a counter), `sum by ()`, `histogram_quantile()`, `increase()`, `avg_over_time()`, label matchers (`=`, `!=`, `=~` regex).

### The four golden signals (Google SRE)

1. **Latency**: how long requests take. Track successful and failed requests separately, and use percentiles (p50/p95/p99), not averages (*Descriptive Statistics*).
2. **Traffic**: demand (requests/s, messages/s, tokens/s for LLM apps).
3. **Errors**: the rate of failed requests (explicit 5xx, wrong content, or too slow).
4. **Saturation**: how full the system is (CPU, memory, connection pools, queue depth, GPU memory).

Related methods: **RED** (Rate, Errors, Duration) for services and **USE** (Utilization, Saturation, Errors) for resources.

### Grafana dashboards

Build one dashboard per service, top to bottom: **SLO status** → **golden signals** → **dependencies** (DB, Redis, LLM provider latency) → **resources**. Use template variables (environment, service), annotate deploys on the graphs, and keep dashboards in Git as JSON (dashboards-as-code).

> [!recap]
> - Prometheus scrapes /metrics. PromQL: rate, sum by, histogram_quantile.
> - The golden signals: latency (percentiles), traffic, errors, saturation. RED and USE.
> - Grafana: SLOs first, deploy annotations, dashboards in Git.

# Lesson: SLIs, SLOs, error budgets and alerting (35 min)

- **SLI** (indicator): a measured ratio of good events: `good requests / valid requests`. For example, "requests that are successful *and* faster than 1 s".
- **SLO** (objective): the target for an SLI over a window, e.g. **99.9% over 30 days**.
- **SLA** (agreement): a contractual promise with consequences, which is usually looser than the internal SLO.

### Error budgets

An SLO of 99.9% means you're **allowed** 0.1% failures: that's the **error budget**. Over 30 days of time-based availability, that's about **43 minutes**.

| SLO | Allowed downtime per 30 days |
|---|---|
| 99% | 7.2 hours |
| 99.9% | 43.2 minutes |
| 99.95% | 21.6 minutes |
| 99.99% | 4.3 minutes |

The budget aligns teams. **While budget remains, ship features and take risks. When it's exhausted, prioritize reliability work** (freeze risky launches). 100% is the wrong target: it's impossibly expensive, and users can't tell 99.99% from 100%, because their own networks fail more often than that.

### Alerting that doesn't burn people out

- **Alert on symptoms users feel** (SLO burn, high error rate, latency), not on every cause (CPU at 80% isn't an emergency by itself).
- **Burn-rate alerts**: the burn rate = (the observed error rate) / (the error rate the SLO allows). A burn rate of 1 uses exactly the budget over the window. Page on fast burns (e.g. burn rate > 14.4 over 1 h, which consumes 2% of a 30-day budget in an hour), and open a ticket for slow burns (e.g. > 1 over 3 days). Multi-window, multi-burn-rate alerts reduce noise.
- Every page must be **actionable**, **urgent** and linked to a **runbook**. Route non-urgent issues to tickets.
- Alertmanager handles grouping, deduplication, silences and routing (Slack, PagerDuty).

> [!recap]
> - SLI = the good/valid ratio. SLO = a target over a window. SLA = a contract.
> - Error budget = 1 − SLO. Spend it on velocity, or freeze when it's gone.
> - Alert on SLO burn rates (fast → page, slow → ticket). Every page is actionable and has a runbook.

# Lesson: Load testing, incidents, runbooks and postmortems (30 min)

### Load testing

Find the limits **before** users do:

```javascript norun
// k6 script: ramp to 200 virtual users, assert SLO-like thresholds
import http from "k6/http";
import { check, sleep } from "k6";
export const options = {
  stages: [{ duration: "2m", target: 50 }, { duration: "5m", target: 200 }, { duration: "2m", target: 0 }],
  thresholds: { http_req_duration: ["p(95)<800"], http_req_failed: ["rate<0.01"] },
};
export default function () {
  const r = http.get("https://staging.example.com/api/health");
  check(r, { "status 200": (res) => res.status === 200 });
  sleep(1);
}
```

Test types: **load** (the expected peak), **stress** (beyond the peak, to find the breaking point), **soak** (hours, to find leaks), **spike** (sudden bursts). Watch the golden signals during the test, find the bottleneck (DB connections? CPU? LLM rate limits?), fix it, and repeat. Test against staging, or with care against production.

### Incident response

1. **Detect**: an alert or a user report. Declare an incident early, because it's cheap to downgrade.
2. **Roles**: an **incident commander** (coordinates and decides), a communications lead (status page, stakeholders), and operations responders.
3. **Mitigate first, diagnose later**: roll back the last deploy, fail over, scale up, disable the feature flag. Restore service, *then* find the root cause.
4. **Communicate** regularly: what's impacted, what's being done, and when the next update is.
5. **Resolve and follow up**.

### Runbooks

A runbook is the step-by-step response to a specific alert: what it means, the dashboards to check, the commands to diagnose, the mitigation steps, and when to escalate. Keep them next to the alerts and update them after every incident. Automate the steps that repeat.

### Blameless postmortems

After significant incidents, write up: a summary, the impact (users, duration, error budget consumed), a timeline, the root cause(s) and contributing factors, what went well, where we got lucky, and **action items with owners and dates**. **Blameless** means focusing on systems and processes, not individuals. People act reasonably given the information they had, and blame only teaches them to hide problems.

> [!recap]
> - Load, stress, soak and spike tests with thresholds. Find and fix the bottleneck.
> - Incident roles. Mitigate before you diagnose. Communicate regularly.
> - Runbooks per alert. Blameless postmortems with owned action items.

# Quiz

## Which metric type should `http_requests_total` be?
- [x] Counter
- [ ] Gauge
- [ ] Histogram
- [ ] Summary of logs
> Counters only increase. Query them with rate().

## Why is `user_id` a bad Prometheus label?
- [ ] It's private
- [x] Unbounded cardinality creates a time series per user, overwhelming the storage and queries
- [ ] Prometheus doesn't support strings
- [ ] It slows down logging
> Keep labels bounded (route templates, status classes).

## Which query gives the p95 latency from histogram buckets?
- [ ] avg(http_request_duration_seconds)
- [x] histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
- [ ] max(http_requests_total)
- [ ] rate(p95[5m])
> Aggregate the bucket rates by `le`, then compute the quantile.

## Which are Google's four golden signals?
- [ ] CPU, memory, disk, network
- [x] Latency, traffic, errors, saturation
- [ ] Uptime, downtime, MTTR, MTBF
- [ ] Logs, metrics, traces, events
> They describe user-facing health and capacity.

## A 99.9% availability SLO over 30 days allows roughly how much downtime?
- [ ] 4 minutes
- [x] 43 minutes
- [ ] 7 hours
- [ ] 1 day
> 0.1% × 43,200 minutes = 43.2 minutes.

## The error budget is exhausted halfway through the month. A typical SRE policy is:
- [ ] Ignore it
- [x] Prioritize reliability work and slow or freeze risky releases until the budget recovers
- [ ] Lower the SLO immediately
- [ ] Fire the on-call engineer
> The budget balances speed and stability.

## Which alert is best to page someone at 3 a.m.?
- [ ] CPU at 75% for 5 minutes
- [x] A fast SLO burn: users are experiencing errors that will exhaust the budget soon
- [ ] Disk at 60%
- [ ] A new deploy finished
> Page on urgent, user-impacting symptoms, with a runbook.

## During an outage right after a deploy, the first priority is:
- [ ] Find the exact root cause in the code
- [x] Mitigate: roll back (or disable the feature) to restore service, then investigate
- [ ] Write the postmortem
- [ ] Blame the author
> Restore service first. Learn afterwards, blamelessly.

# Exercise: Error budgets and burn rates

Write:
- `error_budget_minutes(slo, days=30)`: the allowed bad minutes for a time-based SLO (e.g. 0.999 → 43.2 for 30 days).
- `burn_rate(good, total, slo)`: (observed error rate) / (1 − slo). Return 0.0 when total is 0.
- `alert_level(rate_1h, rate_6h)`: `"page"` if `rate_1h > 14.4` **and** `rate_6h > 6`; `"ticket"` if `rate_6h > 1`; otherwise `"ok"` (a simplified multi-window policy).
- `budget_remaining(slo, good, total)`: the fraction of the error budget left over the window: `1 - (bad/total)/(1 - slo)`, never below 0 (return 1.0 when total is 0).

## Starter

```python
def error_budget_minutes(slo, days=30):
    pass

def burn_rate(good, total, slo):
    pass

def alert_level(rate_1h, rate_6h):
    pass

def budget_remaining(slo, good, total):
    pass
```

## Tests

```python
ns = load()
assert abs(ns["error_budget_minutes"](0.999) - 43.2) < 1e-9
assert abs(ns["error_budget_minutes"](0.99, days=7) - 100.8) < 1e-9
assert abs(ns["burn_rate"](9_900, 10_000, 0.999) - 10.0) < 1e-9
assert ns["burn_rate"](0, 0, 0.999) == 0.0
assert ns["alert_level"](20, 8) == "page"
assert ns["alert_level"](20, 2) == "ticket"
assert ns["alert_level"](0.5, 0.8) == "ok"
assert abs(ns["budget_remaining"](0.999, 999_500, 1_000_000) - 0.5) < 1e-9
assert ns["budget_remaining"](0.999, 990_000, 1_000_000) == 0.0
assert ns["budget_remaining"](0.999, 0, 0) == 1.0
```

## Solution

```python
def error_budget_minutes(slo, days=30):
    return (1 - slo) * days * 24 * 60

def burn_rate(good, total, slo):
    if total == 0:
        return 0.0
    return ((total - good) / total) / (1 - slo)

def alert_level(rate_1h, rate_6h):
    if rate_1h > 14.4 and rate_6h > 6:
        return "page"
    if rate_6h > 1:
        return "ticket"
    return "ok"

def budget_remaining(slo, good, total):
    if total == 0:
        return 1.0
    used = ((total - good) / total) / (1 - slo)
    return max(0.0, 1 - used)
```

A burn rate of 10 means: at this pace, a 30-day budget lasts only 3 days. Requiring two windows (short *and* long) avoids paging on brief blips while still catching real fires quickly.

# Sources

- [Google SRE Book (free online): Monitoring Distributed Systems; Service Level Objectives; Postmortem Culture](https://sre.google/sre-book/table-of-contents/)
- [Google SRE Workbook: Alerting on SLOs (multi-window, multi-burn-rate)](https://sre.google/workbook/alerting-on-slos/)
- [Prometheus documentation: querying basics, histograms and summaries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana documentation: dashboards best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [OpenTelemetry documentation](https://opentelemetry.io/docs/)
- [Grafana k6 documentation](https://grafana.com/docs/k6/latest/)
- [Brendan Gregg: The USE Method](https://www.brendangregg.com/usemethod.html)
