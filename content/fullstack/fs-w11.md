---
id: fs-w11
title: AI Evaluation, Observability & Safety
week: Week 11
summary: Evaluation datasets, LLM-as-judge, retrieval evaluation, detecting hallucinations, prompt and model versioning, tracing, cost/latency monitoring, user feedback loops, and guardrails including PII handling.
builds_on: fs-w10, ag-w5, ai-w1
leads_to: fs-w12, fs-p3
---

You can't improve what you don't measure, and with LLMs, "it seemed fine when I tried it" is how regressions ship. This week builds the **quality system** around your product: offline evaluations before you deploy, observability and feedback after you deploy, and guardrails throughout. (Agentic week 5 covers the theory. This module is the full-stack implementation.)

# Lesson: Evaluation datasets and harnesses (35 min)

### Build the dataset from reality

Sources for eval cases:
1. **Real user traffic**: sampled and anonymized questions, especially ones with 👎 feedback.
2. **Failure reports and bugs**: each fixed bug becomes a regression case.
3. **Synthetic cases** written to cover gaps: edge cases, adversarial prompts, other languages, long inputs.
4. **Unanswerable cases**: the model should abstain.

Each case gets an `input`, plus the context it needs (user, documents), and **expectations**: a reference answer, the facts that must appear, the required citations, the expected tool calls, or rubric criteria. Version the dataset in Git (JSONL).

### Types of checks (cheapest first)

| Check | Example |
|---|---|
| **Deterministic** | Valid JSON? Contains a citation? Refused when it should? Called `search_docs`? Under 200 words? |
| **Reference-based** | Exact match or F1 for extraction; numeric tolerance |
| **Retrieval metrics** | recall@k, MRR against the labelled chunks (week 7) |
| **LLM-as-judge** | Faithfulness to the sources, helpfulness, tone, following the rubric |
| **Human review** | Gold labels, judge calibration, high-stakes samples |

### The harness

```text
for case in dataset:                     # in parallel, with rate limits
    output, trace = app.run(case.input, config=candidate)   # same code path as production!
    results.append({case.id, scores: [check(case, output, trace) for check in checks],
                    cost, latency})
report: pass rates per check + per category, diff vs baseline, list of regressions
```

Rules: evaluate the **real pipeline** (prompt + retrieval + tools), not the model alone. Pin the configuration (model, prompt version, retrieval settings). Run each case **2–3 times** for stochastic outputs. **Compare against the baseline on the same cases** (paired comparison).

> [!recap]
> - A dataset from real traffic + bugs + synthetic gaps + unanswerables, versioned.
> - Cheap deterministic checks first, then references, retrieval metrics, judges and humans.
> - Run the real pipeline, repeat stochastic cases, and compare paired results against the baseline.

# Lesson: LLM-as-judge and hallucination detection (30 min)

### A judge prompt that works

```text
You are grading whether an ANSWER is fully supported by SOURCES.
Rules:
- "supported": every factual claim in ANSWER appears in SOURCES (paraphrase OK).
- "unsupported": at least one claim is missing from or contradicts SOURCES.
- Ignore style. Do not use outside knowledge.
Return JSON: {"verdict": "supported"|"unsupported", "unsupported_claims": [..]}

SOURCES: <sources>…</sources>
ANSWER: <answer>…</answer>
```

Good practices: **binary or 3-level verdicts** (not 1–10), ask for the **evidence** (the unsupported claims), use structured output, use a **strong model** as the judge, and **calibrate it against human labels** (Cohen's κ, Agentic week 5). For pairwise comparisons ("A or B better?"), randomize the order to cancel position bias.

### Hallucination: types and defenses

- **Intrinsic**: contradicts the provided sources. Detect it with faithfulness judges or NLI models.
- **Extrinsic**: adds unverifiable facts not in the sources. Detect it with "every claim must be cited" plus verification (week 7).
- **Fabricated references**: fake URLs, papers or IDs. Validate them against known sets.

Defenses: retrieval grounding, explicit abstention instructions, citation verification, lower temperature for factual tasks, and **showing sources** in the UI so users can check.

# Lesson: Observability, versioning and user feedback (30 min)

### Tracing and metrics in production

- **Traces** per request: the spans for retrieval, each LLM call (model, prompt version, tokens, latency, cost) and the tools. Use OpenTelemetry, or Langfuse, LangSmith or Phoenix.
- **Dashboards**: requests/min, error rate, **p50/p95 latency** (TTFT and total), **cost per request, per user and per feature**, token usage by model, cache hit rate, the abstention rate, the 👍/👎 ratio, and the guardrail trigger rate.
- **Alerts**: error-rate spikes, latency SLO breaches, cost per hour above a threshold, and sudden changes in abstention or refusal rates (often a sign of a broken retrieval index or prompt).

### Versioning and safe rollout

- Every response records `model`, `prompt_version`, `retrieval_config` and `app_version`.
- Changes ship like code: **eval in CI** → **canary** (5% of traffic) → compare the online metrics → full rollout, or **roll back** quickly.
- Pin model versions (snapshot IDs) where providers offer them. A silent upgrade of an alias can change behaviour.

### Closing the loop with user feedback

```text
👎 + optional reason ("wrong", "not helpful", "unsafe")  ──►  feedback table (message_id, trace_id)
      │                                                         │
      └──► weekly triage: read + categorize failures ──► new eval cases + fixes ──► CI regression suite
```

Implicit signals help too: copying the answer (good), regenerating (bad), long follow-ups saying "no, I meant…".

> [!recap]
> - Trace every request. Dashboards for latency, cost, errors, quality signals. Alert on anomalies.
> - Version everything, roll out through eval → canary → full, keep rollback quick, pin model snapshots.
> - Feedback → triage → eval cases → fixes.

# Lesson: Guardrails and safety (30 min)

Guardrails are **checks outside the model** that enforce policy.

**Input guardrails**
- Validation: size limits, file types, rate limits (week 10).
- Content moderation (provider moderation APIs, or classifiers) for disallowed content.
- **Prompt-injection heuristics and classifiers** for retrieved or uploaded content (they reduce risk, but don't eliminate it).
- **PII detection and redaction** before logging, or before sending to third parties when your policy requires it.

**Output guardrails**
- Schema validation, citation verification, and allowlists for links and actions.
- Moderation of generated content. Checks for leaked secrets and system prompts.
- **Sanitize HTML** before rendering (week 2).

**Design and policy**
- Least-privilege tools and approvals (week 9).
- A clear refusal UX: explain what can't be done and what the user can do instead.
- Privacy: data retention policies, user data export and deletion, no training on user data without consent, and regional compliance (GDPR-like principles).
- Red-teaming: try to break your own app before attackers do. Turn each successful attack into a regression test.

```python
import re
PATTERNS = {
    "EMAIL": r"[\w.+-]+@[\w-]+\.[\w.-]+",
    "PHONE": r"(?:\+?\d[\d\s-]{8,}\d)",
    "CARD":  r"\b(?:\d[ -]?){13,16}\b",
}
def redact(text):
    for label, pat in PATTERNS.items():
        text = re.sub(pat, f"[{label}]", text)
    return text
print(redact("Contact sara@example.com or +98 912 345 6789; card 4111 1111 1111 1111."))
```

Regex catches the obvious patterns. Production systems combine it with NER-based detectors (e.g. Microsoft Presidio) and validation (the Luhn check for card numbers).

> [!recap]
> - Input guardrails: validation, moderation, injection detection, PII redaction.
> - Output guardrails: schemas, citation checks, link/action allowlists, moderation, HTML sanitization.
> - Policy: least privilege, a clear refusal UX, privacy controls, red-teaming → regression tests.

# Quiz

## Why should evals run the real application pipeline instead of calling the model directly?
- [ ] It's cheaper
- [x] Quality depends on prompts, retrieval, tools and post-processing together; testing the model alone misses regressions
- [ ] Models can't be called directly
- [ ] To avoid using a dataset
> Evaluate what users actually experience.

## Which check should you prefer when it's possible?
- [x] A deterministic check (valid JSON, citation present, correct tool called)
- [ ] An LLM-as-judge for everything
- [ ] Manual review of every output
- [ ] No checks; rely on user complaints
> Cheap, fast and reliable. Use judges where determinism isn't possible.

## A judge prompt asks for scores from 1 to 10 and gives inconsistent results. Improvement?
- [ ] Ask for 1–100 instead
- [x] Use binary or 3-level verdicts with a specific rubric and a request for evidence, then calibrate against human labels
- [ ] Raise the temperature
- [ ] Use a smaller model
> Coarse, well-defined labels are more reliable.

## Abstention rate jumps from 5% to 40% overnight with no code deploy. Likely cause?
- [ ] Users got smarter
- [x] Retrieval broke (e.g. an empty or corrupted index, or an embedding model/provider change); investigate the traces
- [ ] The UI changed color
- [ ] Normal variance
> Quality metrics are early-warning signals, so alert on sudden shifts.

## What's the safest rollout for a new prompt version?
- [ ] Edit it directly in production
- [x] Pass the eval suite in CI → canary on a small share of traffic → compare metrics → full rollout, with quick rollback
- [ ] Deploy to everyone on Friday evening
- [ ] Ask the model if it's better
> Treat prompts like code deployments.

## Which is an output guardrail?
- [ ] Rate limiting uploads
- [x] Verifying that cited source IDs exist and that links are on an allowlist
- [ ] A password policy
- [ ] Database indexing
> Check what the model produced before showing it or acting on it.

## Why redact PII before logging prompts and responses?
- [ ] Logs are slow
- [x] Logs are widely accessible and long-lived; storing personal data there increases privacy and compliance risk
- [ ] PII makes models slower
- [ ] Redaction improves accuracy
> Minimize personal data everywhere it isn't needed.

# Exercise: Paired eval comparison

You ran the same 20 eval cases on the baseline (A) and a candidate prompt (B), each graded 1 (pass) or 0 (fail). Write `compare(a, b, n_boot=5000, seed=0)` that returns a dict with: `pass_a`, `pass_b` (rates), `wins` (cases where B passed and A failed), `losses` (A passed, B failed), `ties`, and `ci` (a 95% **paired bootstrap** CI for `pass_b - pass_a`: resample **case indices** with replacement, using `random.Random(seed)`).

## Starter

```python
import random

def compare(a, b, n_boot=5000, seed=0):
    pass
```

## Tests

```python
ns = load()
a = [1,1,0,1,0,1,1,0,1,1, 0,1,1,0,1,1,0,1,1,0]
b = [1,1,1,1,0,1,1,1,1,1, 0,1,1,1,1,1,0,1,1,1]
r = ns["compare"](a, b)
assert (r["pass_a"], r["pass_b"]) == (0.65, 0.85), r
assert (r["wins"], r["losses"], r["ties"]) == (4, 0, 16), r
lo, hi = r["ci"]
assert lo > 0 and hi <= 0.45 and lo < 0.2 < hi, r["ci"]
assert ns["compare"](a, b) == r, "deterministic with the same seed"
```

## Solution

```python
import random

def compare(a, b, n_boot=5000, seed=0):
    n = len(a)
    wins = sum(1 for x, y in zip(a, b) if y == 1 and x == 0)
    losses = sum(1 for x, y in zip(a, b) if x == 1 and y == 0)
    rng = random.Random(seed)
    diffs = []
    for _ in range(n_boot):
        idx = [rng.randrange(n) for _ in range(n)]
        diffs.append(sum(b[i] - a[i] for i in idx) / n)
    diffs.sort()
    lo, hi = diffs[int(0.025 * n_boot)], diffs[int(0.975 * n_boot) - 1]
    return {"pass_a": sum(a) / n, "pass_b": sum(b) / n, "wins": wins, "losses": losses,
            "ties": n - wins - losses, "ci": (lo, hi)}
```

The paired view matters: B fixed 4 cases and broke none, which is much stronger evidence than two independent pass rates would suggest. With only 20 cases, the CI is still wide, so grow your eval set.

# Sources

- [Hamel Husain: Your AI Product Needs Evals; LLM-as-a-judge guide](https://hamel.dev/blog/posts/evals/)
- [Eugene Yan: Evaluating LLM-based applications / Patterns for building LLM systems](https://eugeneyan.com/writing/llm-patterns/)
- [Langfuse docs: tracing, evals, prompt management](https://langfuse.com/docs)
- [OpenTelemetry: GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Microsoft Presidio: PII detection and anonymization](https://microsoft.github.io/presidio/)
- [NIST AI Risk Management Framework: Generative AI Profile](https://www.nist.gov/itl/ai-risk-management-framework)
