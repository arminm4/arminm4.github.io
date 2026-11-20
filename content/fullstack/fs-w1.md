---
id: fs-w1
title: AI Product Architecture & LLM Fundamentals
week: Week 1
summary: How AI applications are structured, LLM APIs, prompts, tokens and context windows, temperature, chat architecture, choosing model providers, and estimating cost and latency.
builds_on: f-web, f-js, py-w7
leads_to: fs-w2, fs-w3, fs-w5
---

Full-Stack AI Engineering is about building **products** around LLMs: a responsive UI, a solid backend and database, and the LLM integrated **as one component among many**. This week gives you the architecture and the fundamentals everything else hangs on. (If you've done Agentic AI week 1, parts of this will be a quick review, from a product-engineering angle.)

# Lesson: Anatomy of an AI application (30 min)

```text
 Browser (React/Next.js)          Backend (FastAPI)                 Data & AI services
 ───────────────────────          ─────────────────                 ──────────────────
 Chat UI, upload, history  ──►    Auth (JWT), validation    ──►     PostgreSQL (+ pgvector)
 streaming render (SSE)    ◄──    conversation service      ◄──     Redis (cache, queue, rate limit)
                                  LLM gateway (retries,     ──►     LLM provider APIs
                                    fallback, cost logging)         Embedding API
                                  RAG / agent orchestration         Object storage (files)
                                  background workers  ◄── queue     Observability (traces, metrics)
```

### Design principles

1. **The LLM is behind your backend, never called directly from the browser.** API keys stay secret, and you control rate limits, logging, validation and costs.
2. **An LLM gateway layer**: one module that wraps all model calls (timeouts, retries, fallbacks, token/cost accounting, prompt versioning). The rest of the code calls `llm.chat(...)`, not the vendor SDK directly. Switching providers then means changing one module.
3. **Deterministic code around probabilistic models.** Validate the inputs and outputs (schemas), enforce business rules in code, not in prompts.
4. **Store everything you'll need later**: conversations, messages, model, prompt version, token counts, latency and user feedback. This data powers debugging, evals and billing.
5. **Async by default.** Model calls are slow I/O, so use async frameworks and background jobs for long tasks (week 10).

### Product thinking: where does AI actually help?

Good AI features have **fuzzy inputs, valuable outputs and tolerance for imperfection**, with a human able to verify: drafting, summarizing, search, extraction, triage. Before building, ask:
- What does failure look like, and how will users notice it and recover?
- Can we measure quality (week 11)?
- What's the cost per user action, and does the business model support it?

> [!recap]
> - Browser → your backend → LLM. Never expose API keys.
> - Put an LLM gateway module in front of all model calls.
> - Validate around the model. Log what you'll need for evals and costs.

# Lesson: Tokens, context windows and the API (30 min)

### Tokens

Models read and write **tokens** (~¾ of an English word; often more tokens per word for other languages and code). Everything is measured in them: **limits, cost and latency**.

```python
import re
def rough_tokens(text):
    """Very rough estimate: ~4 characters per token for English. Use the provider's tokenizer or count API for exact numbers."""
    return max(1, round(len(text) / 4))
samples = {"English": "The quick brown fox jumps over the lazy dog.",
           "Code": "def f(x):\n    return {k: v for k, v in x.items() if v}",
           "Persian": "روباه قهوه‌ای سریع از روی سگ تنبل می‌پرد."}
for k, v in samples.items():
    print(f"{k:8} chars={len(v):3}  ~tokens≈{rough_tokens(v)}  (real tokenizers often need more for non-English)")
```

### The context window

The maximum number of tokens per request, **input + output**. In a chat app, the input includes the system prompt, the tool definitions, the retrieved documents, the **whole conversation history** and the new message. When you approach the limit, you must **trim, summarize or retrieve selectively** (Agentic week 4).

### Temperature and other sampling parameters

- **Temperature** rescales the next-token distribution (*Probability*): low (0–0.3) for extraction, classification and code; medium (0.5–0.8) for chat; high for brainstorming.
- **max_tokens** caps the output length, and therefore the cost and latency.
- **Stop sequences** end generation at a marker.

### A request, end to end

```python norun
import httpx, os, time
t0 = time.perf_counter()
r = httpx.post(
    "https://api.anthropic.com/v1/messages",
    headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
             "content-type": "application/json"},
    json={"model": "claude-haiku-5-5", "max_tokens": 300, "temperature": 0.3,
          "system": "You are a helpful assistant for an online shop.",
          "messages": [{"role": "user", "content": "Suggest 3 names for a coffee mug product line."}]},
    timeout=30,
)
r.raise_for_status()
data = r.json()
print(data["content"][0]["text"])
print(data["usage"], f"{(time.perf_counter() - t0) * 1000:.0f} ms")
```

This is a plain HTTPS POST with JSON (*Web & HTTP*). The official SDKs wrap exactly this.

> [!recap]
> - Tokens measure limits, cost and latency.
> - Context = system + tools + history + retrieved docs + new message + output.
> - Temperature for creativity vs determinism; max_tokens for cost control.

# Lesson: Chat architecture and model providers (30 min)

### Conversations are re-sent every turn

The API is stateless, so your backend:
1. Loads the conversation's messages from the database.
2. Builds the prompt: system + (trimmed or summarized) history + the new user message (+ retrieved context).
3. Calls the model (streaming).
4. Saves the assistant message, the token counts and the metadata.

```text
conversations(id, user_id, title, created_at, model, summary)
messages(id, conversation_id, role, content, tokens_in, tokens_out, latency_ms, model,
         prompt_version, created_at, feedback)
```

**Titles** are generated cheaply after the first exchange (a small model). **Summaries** of long conversations are refreshed periodically, so old turns can be dropped from the prompt.

### Choosing providers and models

| Dimension | Questions |
|---|---|
| Quality | Does it handle *your* tasks? (Measure with your eval set, not leaderboards alone) |
| Cost | Input and output prices; prompt-caching discounts; batch-API discounts |
| Latency | Time to first token, tokens per second, regional endpoints |
| Features | Tool calling, structured output, vision, long context, streaming |
| Privacy & compliance | Data retention, training opt-out, region, enterprise terms |
| Operational | Rate limits, uptime history, SDK quality |
| Open-weight option | Self-host (vLLM, Ollama) for control and privacy, at the cost of running GPUs |

> [!tip] Design for multiple providers
> Keep the provider choice in configuration behind your gateway. Then you can **fall back** to a second provider during an outage, A/B test models, and negotiate better prices.

> [!recap]
> - The backend reassembles the context every turn from the DB, plus summaries.
> - Store per-message metadata: model, prompt version, tokens, latency, feedback.
> - Pick models with your own evals. Stay provider-agnostic via the gateway.

# Lesson: Estimating cost and latency (25 min)

```python
def monthly_cost(users, msgs_per_user_day, in_tok, out_tok, in_price_m, out_price_m, days=30):
    per_msg = in_tok / 1e6 * in_price_m + out_tok / 1e6 * out_price_m
    return per_msg, users * msgs_per_user_day * days * per_msg

# Illustrative prices (USD per million tokens); check current provider pricing.
scenarios = [
    ("small model, short chats", 2_000, 300, 0.25, 1.25),
    ("mid model, RAG (6k context)", 6_000, 500, 3.0, 15.0),
    ("mid model + prompt cache (80% cached @10%)", 6_000 * 0.2 + 6_000 * 0.8 * 0.1, 500, 3.0, 15.0),
]
for name, tin, tout, pin, pout in scenarios:
    per, month = monthly_cost(5_000, 8, tin, tout, pin, pout)
    print(f"{name:44} ${per:.4f}/msg   ${month:,.0f}/month for 5k users")
```

### Levers

- **Shorter prompts**: trim history, retrieve fewer and better chunks, keep the system prompt concise.
- **Prompt caching** of the stable prefix (system prompt, tools, large documents): a big discount and faster responses.
- **Model routing**: a cheap model for simple turns.
- **Cap the output** with max_tokens, and ask for concise answers.
- **Cache** identical or near-identical requests (semantic cache) where that's appropriate.
- **Batch APIs** for offline jobs: cheaper, but slower.

### Latency budget

Users perceive **time to first token**. Streaming makes 10 s of generation feel responsive. Budget each step: retrieval < 300 ms, LLM TTFT < 1–2 s, any tool calls in parallel. Measure p95, not just averages.

> [!recap]
> - Cost/msg = in × price_in + out × price_out. Multiply by volume.
> - Levers: shorter context, caching, routing, output caps, batching.
> - Optimize time-to-first-token and stream.

# Quiz

## Why should the browser never call the LLM API directly?
- [ ] Browsers can't make HTTPS requests
- [x] It would expose your API key and bypass your rate limits, validation and logging
- [ ] LLM APIs don't support JSON
- [ ] It's slower
> Always proxy through your backend.

## What is included in the context window for a chat turn?
- [ ] Only the latest user message
- [x] System prompt, tool definitions, retrieved context, conversation history, the new message, and the output tokens
- [ ] Only the output
- [ ] The whole internet
> Everything sent plus everything generated counts against the limit.

## For extracting invoice fields as JSON, the best temperature is:
- [x] Low (0–0.2)
- [ ] High (1.0+)
- [ ] Temperature doesn't matter
- [ ] Negative
> Deterministic tasks benefit from low randomness.

## What is the main benefit of an "LLM gateway" module?
- [ ] It trains models
- [x] A single place for retries, fallbacks, logging, cost tracking and provider switching
- [ ] It removes the need for a database
- [ ] It makes the UI faster
> It centralizes the cross-cutting concerns around model calls.

## Which metric matters most for perceived chat responsiveness?
- [ ] Total tokens per month
- [x] Time to first token (with streaming)
- [ ] Model parameter count
- [ ] Database size
> Streaming plus a fast first token makes long answers feel quick.

## Your RAG chat costs too much. Which change usually saves the most?
- [ ] Raising the temperature
- [x] Reducing input tokens (fewer, better chunks; trimmed history) and caching the stable prefix
- [ ] Adding more tools
- [ ] Using longer system prompts
> Input context dominates cost in RAG apps.

## How should you choose between two models for your product?
- [ ] Pick the top of a public leaderboard
- [x] Evaluate both on your own task-specific eval set, considering cost and latency too
- [ ] Choose the newest
- [ ] Choose the largest
> Your data and constraints decide.

# Exercise: Token-budget trimmer

Write `build_prompt(system, history, new_msg, max_tokens, count=lambda s: len(s.split()))`. Return a list of message dicts: `[{"role":"system","content":system}]` + as many of the **most recent** history messages as fit + `{"role":"user","content":new_msg}`, keeping the total (counted with `count` over the contents) ≤ `max_tokens`. Keep the history messages in their original order. If the system prompt and the new message alone exceed the budget, raise `ValueError`.

## Starter

```python
def build_prompt(system, history, new_msg, max_tokens, count=lambda s: len(s.split())):
    pass
```

## Tests

```python
ns = load()
bp = ns["build_prompt"]
hist = [{"role": "user", "content": "a " * 10}, {"role": "assistant", "content": "b " * 10},
        {"role": "user", "content": "c " * 10}, {"role": "assistant", "content": "d " * 10}]
out = bp("sys prompt", hist, "new question here", 34)
assert out[0]["role"] == "system" and out[-1]["content"] == "new question here"
assert [m["content"][0] for m in out[1:-1]] == ["c", "d"], out
assert len(bp("s", hist, "q", 1000)) == 6
try:
    bp("one two three", [], "four five", 4); raise AssertionError("expected ValueError")
except ValueError:
    pass
```

## Solution

```python
def build_prompt(system, history, new_msg, max_tokens, count=lambda s: len(s.split())):
    used = count(system) + count(new_msg)
    if used > max_tokens:
        raise ValueError("system prompt and new message exceed the budget")
    kept = []
    for msg in reversed(history):
        c = count(msg["content"])
        if used + c > max_tokens:
            break
        kept.append(msg)
        used += c
    return [{"role": "system", "content": system}] + kept[::-1] + [{"role": "user", "content": new_msg}]
```

Stopping at the first message that doesn't fit (instead of skipping it and taking older ones) keeps the conversation contiguous. Gaps in the middle of a dialogue confuse models.

# Sources

- [Anthropic docs: Messages API, models overview and pricing](https://docs.anthropic.com/en/docs/about-claude/models/overview)
- [Anthropic docs: Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [OpenAI docs: Text generation and model selection](https://platform.openai.com/docs/guides/text)
- [a16z: Emerging architectures for LLM applications](https://a16z.com/emerging-architectures-for-llm-applications/)
- *AI Engineering* by Chip Huyen (O'Reilly, 2025): chapters on foundation models and architecture
