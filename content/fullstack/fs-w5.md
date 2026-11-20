---
id: fs-w5
title: LLM Application Engineering
week: Week 5
summary: Production prompt engineering and system prompts, structured output with JSON Schema, streaming with tool calls, error handling and retries, model fallback, and token/cost management inside the LLM gateway.
builds_on: fs-p1, ag-w1
leads_to: fs-w6, fs-w9
---

Week 1 introduced the LLM API. This week turns your LLM gateway into **production-grade infrastructure**: versioned prompts, validated structured outputs, streaming that also handles tool calls, resilient retries and fallbacks, and cost controls. (Agentic week 1 covers the agent-loop side. This module focuses on the backend engineering.)

# Lesson: Prompts as versioned code (30 min)

Prompts are code. They change behaviour as much as a function does, so treat them that way:

- **Store prompts in files or a registry** (`prompts/support_system.v3.md`), not inline strings scattered through the code.
- **Version them** and log the `prompt_version` with every message, so you can correlate quality changes with prompt changes.
- **Template them** with clear variables (`{user_name}`, `{today}`, `{retrieved_docs}`), and escape or delimit untrusted values.
- **Test them** against an eval set before deploying (week 11), the same way you test code.

### Anatomy of a strong system prompt

```text
<role>You are StudyMate, a tutor for a self-paced bootcamp app.</role>
<audience>Adult learners; explain step by step; prefer short paragraphs and examples.</audience>
<rules>
- Answer only questions about the course topics; politely decline others.
- If you're unsure or the sources don't cover it, say so. Never invent references.
- Use the learner's language (English or Persian).
- Format: markdown; code in fenced blocks with a language tag.
</rules>
<tools>Use search_lessons before answering factual course questions.</tools>
<examples>…2 short ideal exchanges…</examples>
```

XML-style tags make the structure explicit and separate the instructions from the injected data (`<retrieved_docs>…</retrieved_docs>`). Put the **most important rules early**, keep the prompt **specific** (vague words like "be good" do nothing), and **show** the behaviour you want with examples.

> [!tip] Prompt caching changes prompt design
> Put **stable content first** (system prompt, tool definitions, long reference documents) and **variable content last** (the user message). Then the stable prefix can be cached by the provider: cheaper and faster (week 1).

> [!recap]
> - Prompts live in versioned files, are templated and evaluated, and their version is logged per message.
> - Structure them with tags: role, audience, rules, tools, examples. Stable prefix first.

# Lesson: Structured output and JSON Schema (35 min)

Whenever code consumes the model's output, require **structured output** that matches a **JSON Schema**:

```json
{
  "type": "object",
  "properties": {
    "intent": {"type": "string", "enum": ["question", "bug_report", "feedback"]},
    "topics": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
    "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
    "needs_human": {"type": "boolean"}
  },
  "required": ["intent", "difficulty", "needs_human"],
  "additionalProperties": false
}
```

Ways to get it:
1. **Native structured outputs / constrained decoding**: the provider guarantees schema-valid JSON.
2. **Tool calling with an input schema**: the "tool arguments" *are* your structured output.
3. **Prompted JSON + validation + repair**: the fallback. Validate with Pydantic or `jsonschema`, and retry with the errors included.

Even with guaranteed-valid JSON, **semantic validation** is your job: is the order_id real? Is the date in the future? Does the extracted amount match the invoice total?

```python
import json

def validate(data, schema, path="$"):
    """A tiny JSON-Schema subset validator: type, enum, required, properties, items, min/max, additionalProperties."""
    errors = []
    t = schema.get("type")
    types = {"object": dict, "array": list, "string": str, "integer": int, "boolean": bool, "number": (int, float)}
    if t and not isinstance(data, types[t]) or (t == "integer" and isinstance(data, bool)):
        return [f"{path}: expected {t}"]
    if "enum" in schema and data not in schema["enum"]:
        errors.append(f"{path}: {data!r} not in {schema['enum']}")
    if t == "integer" or t == "number":
        if "minimum" in schema and data < schema["minimum"]: errors.append(f"{path}: < {schema['minimum']}")
        if "maximum" in schema and data > schema["maximum"]: errors.append(f"{path}: > {schema['maximum']}")
    if t == "object":
        for req in schema.get("required", []):
            if req not in data: errors.append(f"{path}.{req}: required")
        props = schema.get("properties", {})
        for k, v in data.items():
            if k in props: errors += validate(v, props[k], f"{path}.{k}")
            elif schema.get("additionalProperties") is False: errors.append(f"{path}.{k}: not allowed")
    if t == "array":
        if "maxItems" in schema and len(data) > schema["maxItems"]: errors.append(f"{path}: too many items")
        for i, item in enumerate(data): errors += validate(item, schema.get("items", {}), f"{path}[{i}]")
    return errors

schema = {"type": "object", "required": ["intent", "difficulty", "needs_human"], "additionalProperties": False,
          "properties": {"intent": {"type": "string", "enum": ["question", "bug_report", "feedback"]},
                         "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
                         "needs_human": {"type": "boolean"}}}
print(validate(json.loads('{"intent":"question","difficulty":3,"needs_human":false}'), schema))
print(validate(json.loads('{"intent":"rant","difficulty":9,"extra":1}'), schema))
```

> [!recap]
> - Machine-consumed output → JSON Schema (native structured output, or tool args).
> - Validate both the schema and the semantics. Repair with bounded retries.

# Lesson: Streaming with tool calls, errors, retries and fallback (35 min)

### Streaming events, not just text

A streaming response is a sequence of **events**: text deltas, tool-call starts, tool-argument deltas (partial JSON!), stop reasons and usage. Your gateway should normalize the provider-specific events into your own types:

```python norun
@dataclass
class TextDelta: text: str
@dataclass
class ToolCall: id: str; name: str; args: dict          # emitted when the args JSON is complete
@dataclass
class Done: stop_reason: str; usage: Usage
```

When a tool call arrives mid-stream: finish collecting its arguments, execute the tool, append the result, and **continue streaming** a new model turn. Tell the UI what's happening (`{"type": "status", "text": "Searching lessons…"}`).

### Error taxonomy and handling

| Error | Retry? | Action |
|---|---|---|
| Timeout / connection reset | Yes | Backoff + jitter, cap the attempts |
| 429 rate limit | Yes | Honour the `retry-after` header; queue or shed load |
| 5xx / overloaded | Yes | Backoff; consider **fallback** |
| 400 / 422 invalid request | No | It's your bug: log and fix it (too many tokens, bad schema) |
| Context length exceeded | No | Trim or summarize, then retry once |
| Content-policy refusal | No | Show a helpful message, or route to a human |
| Mid-stream disconnect | Maybe | You already streamed partial text: mark it interrupted, offer "continue" |

### Model fallback chains

```text
primary: big-model @ provider A   ──fail──►  secondary: big-model @ provider B
                                  ──fail──►  degraded: small-model (shorter answer) + banner
```

Add a **circuit breaker**: after N consecutive failures, skip the failing provider for a cool-down period instead of making every request wait for its timeouts. Keep prompts portable (avoid provider-specific features in critical paths), and **evaluate the fallback model too**.

> [!recap]
> - Normalize stream events. Handle tool calls mid-stream and show the status in the UI.
> - Retry only transient errors (respect retry-after). Fix 4xx. Trim on context overflow.
> - Fallback chains + circuit breakers, with evaluated fallbacks.

# Lesson: Token and cost management (25 min)

Costs scale with usage, and a single bug (an agent loop, a huge pasted document) can burn a monthly budget overnight.

**Measure everything**: tokens in/out per request, per user, per feature, per model, plus **cached tokens**. Store them on the message rows (week 3) and aggregate them in dashboards.

**Control**:
- **Per-request caps**: `max_tokens`; maximum input size (reject or summarize huge pastes); maximum tool steps.
- **Per-user budgets**: daily token or cost limits by plan (free vs pro), enforced *before* calling the model.
- **Global guardrails**: provider spend alerts, anomaly alerts ("cost/hour 5× normal") and a kill switch.

**Reduce**: prompt caching, shorter retrieved context, cheaper models for sub-tasks (titles, classification, summaries), output-length guidance, deduplication caches, and batch APIs for offline jobs.

> [!example] A budget check in the request path
> 1. Estimate the cost of the request: input tokens (count them) + max_tokens × output price.
> 2. If `spent_today + estimate > user_daily_limit` → return 429 with a friendly message ("Daily limit reached; resets at midnight").
> 3. After the call, record the **actual** usage.

> [!recap]
> - Record usage per message, user, feature and model.
> - Caps per request, budgets per user, and global alerts with a kill switch.
> - Reduce with caching, routing, shorter contexts and batching.

# Quiz

## Why log a prompt_version with every assistant message?
- [ ] It's required by the API
- [x] To correlate quality changes, bugs and eval results with specific prompt changes
- [ ] To reduce costs
- [ ] For GDPR compliance
> Prompts are code, so version them and trace their effects.

## For prompt caching to be effective, where should variable content go?
- [ ] At the very beginning
- [x] At the end, after the stable system prompt and tools
- [ ] In the middle of the system prompt
- [ ] It doesn't matter
> The cacheable part is the stable prefix.

## The provider guarantees schema-valid JSON. What else must you validate?
- [ ] Nothing
- [x] Semantics: that IDs exist, dates make sense, numbers are consistent with business rules
- [ ] The JSON syntax again
- [ ] The token count
> Valid shape ≠ correct content.

## A request fails with "context length exceeded". Best response?
- [ ] Retry the same request with backoff
- [x] Trim or summarize the history or context, then retry once
- [ ] Switch to temperature 0
- [ ] Return a 500 to the user
> It's not transient, so the input must change.

## What does a circuit breaker do in an LLM gateway?
- [ ] Encrypts the prompts
- [x] After repeated failures, temporarily skips a failing provider instead of waiting on it for every request
- [ ] Limits the output tokens
- [ ] Stops streaming
> It fails fast and routes to the fallbacks during an outage.

## Which error should NOT be retried automatically?
- [ ] 429 Too Many Requests
- [ ] 503 Service Unavailable
- [x] 400 Bad Request caused by an invalid tool schema
- [ ] Connection timeout
> Client errors repeat deterministically. Fix the request instead.

## Where should per-user budget enforcement happen?
- [ ] After the model call
- [x] Before the model call, using an estimate, and then updated with the actual usage
- [ ] Only in monthly reports
- [ ] In the frontend
> Prevent the spend rather than just reporting it.

# Exercise: Fallback chain with a circuit breaker

Write a class `Gateway(providers, threshold=3, cooldown=60, clock=time.monotonic)`, where `providers` is an ordered list of `(name, fn)` and `fn(prompt)` returns text or raises. `call(prompt)` tries the providers in order, **skipping** any provider whose circuit is open, and returns `(name, text)` from the first success. A provider's circuit opens after `threshold` **consecutive** failures and stays open for `cooldown` seconds (measured with `clock`). A success resets its failure count. If everything fails or is skipped, raise `RuntimeError`.

## Starter

```python
import time

class Gateway:
    def __init__(self, providers, threshold=3, cooldown=60, clock=time.monotonic):
        pass

    def call(self, prompt):
        pass
```

## Tests

```python
ns = load()
Gateway = ns["Gateway"]
now = [0.0]
calls = {"a": 0, "b": 0}
def a(p):
    calls["a"] += 1
    raise TimeoutError("A down")
def b(p):
    calls["b"] += 1
    return "from B"
g = Gateway([("a", a), ("b", b)], threshold=2, cooldown=30, clock=lambda: now[0])
assert g.call("hi") == ("b", "from B")
assert g.call("hi") == ("b", "from B")
assert calls["a"] == 2
g.call("hi")
assert calls["a"] == 2, "circuit for A should be open: skipped"
now[0] = 31
g.call("hi")
assert calls["a"] == 3, "after cooldown, A is tried again"
g2 = Gateway([("a", a)], threshold=1, cooldown=10, clock=lambda: now[0])
try:
    g2.call("x"); raise AssertionError("should raise")
except RuntimeError:
    pass
```

## Solution

```python
import time

class Gateway:
    def __init__(self, providers, threshold=3, cooldown=60, clock=time.monotonic):
        self.providers = providers
        self.threshold, self.cooldown, self.clock = threshold, cooldown, clock
        self.failures = {name: 0 for name, _ in providers}
        self.open_until = {name: 0.0 for name, _ in providers}

    def call(self, prompt):
        for name, fn in self.providers:
            if self.clock() < self.open_until[name]:
                continue                                   # circuit open: skip
            try:
                text = fn(prompt)
            except Exception:
                self.failures[name] += 1
                if self.failures[name] >= self.threshold:
                    self.open_until[name] = self.clock() + self.cooldown
                    self.failures[name] = 0
                continue
            self.failures[name] = 0
            return name, text
        raise RuntimeError("all providers failed or unavailable")
```

Production gateways add a "half-open" state (let one trial request through after the cooldown) and per-provider metrics. Libraries like `pybreaker` and gateways like LiteLLM implement these patterns.

# Sources

- [Anthropic docs: Prompt engineering (XML tags, system prompts, examples)](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [OpenAI docs: Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [JSON Schema: Getting started](https://json-schema.org/learn/getting-started-step-by-step)
- [Anthropic docs: Streaming messages (event types, tool use while streaming)](https://docs.anthropic.com/en/docs/build-with-claude/streaming)
- [Martin Fowler: CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [LiteLLM: multi-provider gateway, fallbacks and budgets](https://docs.litellm.ai/)
