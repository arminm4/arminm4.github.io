---
id: fs-w9
title: AI Agents & Tool Use in the Product
week: Week 9
summary: Bringing agents into a full-stack app: the agent loop as a service, a tool registry with permissions, function calling, stateful workflows and persisted runs, memory, human-in-the-loop approvals in the UI, MCP integration and controllable agent design.
builds_on: fs-p2, ag-w3, ag-w4
leads_to: fs-w10, fs-w11
---

Agentic AI weeks 1–4 covered agents in depth. This week focuses on **productizing** them: how an agent becomes a backend service that streams its progress to the UI, stores its runs in the database, asks users for approval through real buttons, and stays under control.

# Lesson: The agent as a backend service (30 min)

```text
POST /v1/conversations/{id}/agent-runs   →  creates run (status=running), streams events:
   {"type":"status","text":"Searching your documents…"}
   {"type":"tool_call","name":"search_docs","args":{...}}
   {"type":"tool_result","name":"search_docs","summary":"5 passages found"}
   {"type":"token","text":"Based on your notes…"}
   {"type":"approval_required","action_id":"a91","tool":"create_calendar_event","args":{...}}
   {"type":"done","run_id":123}
```

### Design decisions

- **Event-based streaming** (SSE): the UI shows *what the agent is doing*, not only the final text. This builds trust and makes waiting tolerable.
- **Persist the runs**: `agent_runs(id, conversation_id, status, started_at, finished_at, steps, tokens, cost, error)` and `agent_steps(run_id, idx, type, name, args, result_summary, latency_ms)`. These rows are your trace for debugging, evals and billing.
- **Budgets per run**: max steps, max tokens/cost, wall-clock timeout. When a budget is hit, stop gracefully and explain why.
- **Cancellation**: the user's Stop button cancels the run (check a cancel flag between steps; abort the in-flight LLM call).

### Function calling plumbing

1. Send the messages plus the **tool schemas** to the model.
2. If the response contains `tool_use` blocks: **validate the arguments** against the schema, **authorize** (lesson 2), execute, and append the results (concise, truncated).
3. Loop until the model returns a final answer or a budget triggers.
4. Independent tool calls in the same turn can run **in parallel** (`asyncio.gather`).

> [!recap]
> - Agents run as services that stream typed events, and their runs and steps are persisted.
> - Enforce budgets and support cancellation.
> - Validate → authorize → execute → truncate → loop. Run independent calls in parallel.

# Lesson: Tool registry, permissions and approvals (35 min)

A **tool registry** is the single place that defines what agents can do:

```python norun
@dataclass
class ToolSpec:
    name: str
    description: str
    schema: dict                         # JSON Schema for the arguments
    handler: Callable[..., Awaitable[str]]
    risk: Literal["read", "write", "dangerous"] = "read"
    requires_approval: bool = False
    scopes: set[str] = field(default_factory=set)      # e.g. {"calendar:write"}

REGISTRY = {
    "search_docs": ToolSpec("search_docs", "Search the user's documents...", {...}, search_docs, "read"),
    "create_event": ToolSpec("create_event", "Create a calendar event...", {...}, create_event,
                             "write", requires_approval=True, scopes={"calendar:write"}),
}
```

Execution goes through **one guarded function**:
1. Is the tool enabled for this agent/mode? (A read-only "research" mode exposes only `read` tools.)
2. Does the **user** have the required scopes? Tools run with the *user's* permissions.
3. Validate the args against the schema, and apply business rules (amount limits, allowed domains).
4. If approval is required → persist a **pending action** (hash of tool + args, expiry), emit `approval_required`, and **pause** the run.
5. Execute with a timeout, log it, and return a concise result.

### Human-in-the-loop in the UI

```text
┌───────────────────────────────────────────────┐
│ The assistant wants to create a calendar event │
│ Title:  "Study: Linear Algebra Ch. 3"         │
│ When:   Tue 18:00–19:30 (Asia/Tehran)          │
│ [ Approve ]  [ Edit ]  [ Reject ]              │
└───────────────────────────────────────────────┘
```

`POST /v1/actions/{action_id}/approve` (with an optional edited `args`) checks the user, the expiry and the action hash, then **resumes** the run, as with LangGraph's `interrupt` and `Command(resume=…)` (Agentic week 3). Every decision is audited.

> [!recap]
> - A central registry: schema, risk level, approval flag, scopes.
> - One guarded executor: mode → user scopes → validation → approval → timeout → log.
> - Approvals are persisted, expiring, hash-bound, resumable and audited.

# Lesson: Memory, stateful workflows and MCP in the product (30 min)

### Memory in a product

- **Thread memory**: the conversation history (plus summaries).
- **User memory**: preferences and facts the user *agreed* to store ("I study in the evenings"), editable and deletable in a settings page. Be transparent about it.
- **Workflow state**: multi-step tasks (e.g. "build me a 4-week study plan") persist their state in the DB or a LangGraph checkpointer, so they survive restarts and can continue tomorrow.

### Stateful workflows vs free agents

For predictable product features, prefer **explicit workflows** (Agentic week 3): "Generate a quiz" = retrieve → generate questions (structured) → validate → store. Reserve open-ended agents for genuinely open tasks, such as a research assistant.

### MCP in a product

Your backend can be an **MCP client**: connect to MCP servers (internal ones, or vetted third-party ones like GitHub or a calendar) and expose their tools to your agent **through your registry**, wrapped with your permission checks and approvals. You can also expose your app's own capabilities as an **MCP server**, so users can use StudyMate from Claude Desktop or IDEs.

> [!warning] Third-party tools inherit your trust boundary
> Treat MCP tool descriptions and outputs as untrusted. Wrap remote tools with the same risk levels, scopes and approvals as your own (Agentic week 5).

# Lesson: Controllable agent design (20 min)

Users and operators need control. Checklist:

| Control | Implementation |
|---|---|
| **Predictability** | Workflows where possible; low temperature for tool selection; clear tool descriptions |
| **Transparency** | Stream status and tool events; show sources; explain why approval is needed |
| **Interruptibility** | Stop button; cancel flags; pause on approval |
| **Bounded autonomy** | Step, cost and time budgets; read-only modes; allowlists |
| **Reversibility** | Prefer drafts over sends ("draft email" vs "send email"); soft deletes; undo windows |
| **Accountability** | Persisted runs, steps and approvals; audit log; per-user attribution |
| **Kill switch** | A feature flag to disable write tools or an agent instantly |

> [!recap]
> - Memory: thread, user (consented and editable) and workflow state.
> - Workflows for product features, agents for open tasks.
> - MCP through your registry. Controls: transparency, interruptibility, budgets, reversibility, audit, kill switch.

# Quiz

## Why stream typed events (status, tool_call, tool_result, token) instead of only final text?
- [ ] It's cheaper
- [x] Users see what the agent is doing, which builds trust, and the UI can render approvals and progress
- [ ] Models require it
- [ ] To hide errors
> Transparency and better UX during multi-step runs.

## Where should authorization for a tool call be enforced?
- [ ] In the system prompt
- [x] In the backend's guarded executor, using the user's permissions/scopes
- [ ] By the LLM deciding if it's allowed
- [ ] In the frontend only
> Prompts can be bypassed. Code-level checks can't.

## A user edits an approval's arguments (changes the meeting time). What must the backend do?
- [ ] Execute the original arguments
- [x] Validate the edited arguments, create a new action hash, record the edit, then execute
- [ ] Ignore the edit
- [ ] Ask the model again without telling the user
> The executed action must match exactly what the human approved.

## Which product feature suits an explicit workflow better than an open agent?
- [x] "Generate a 10-question quiz from this lesson"
- [ ] "Research this topic across the web and write a report"
- [ ] "Figure out why my code fails and fix it"
- [ ] "Plan a trip with flexible constraints"
> The steps are known: retrieve → generate (structured) → validate → store.

## What makes an agent action more reversible?
- [ ] Higher temperature
- [x] Creating drafts or soft-deleting instead of sending or permanently deleting
- [ ] Removing logs
- [ ] Using more tools
> Prefer actions that can be undone.

## How should third-party MCP tools be integrated?
- [ ] Directly, with full trust
- [x] Through your registry, with risk levels, scopes, approvals, and their outputs treated as untrusted
- [ ] Only in the frontend
- [ ] Never
> Wrap them with the same guardrails as your own tools.

# Exercise: Guarded tool executor

Write `execute(tool_name, args, registry, user_scopes, mode="full", approved_hashes=())`. The registry maps names to dicts `{"fn", "risk", "requires_approval", "scopes", "required_args"}`. Return a dict:
- `{"status": "error", "reason": "unknown_tool"}` if the tool isn't in the registry
- `{"status": "error", "reason": "mode"}` if `mode == "readonly"` and risk ≠ `"read"`
- `{"status": "error", "reason": "forbidden"}` if the user lacks any required scope
- `{"status": "error", "reason": "bad_args"}` if any required arg is missing
- `{"status": "approval_required", "hash": h}` if approval is needed and `h` isn't in `approved_hashes`. Use `h = action_hash(tool_name, args)` from the starter.
- otherwise `{"status": "ok", "result": fn(**args)}`

## Starter

```python
import hashlib, json

def action_hash(name, args):
    return hashlib.sha256(json.dumps([name, args], sort_keys=True).encode()).hexdigest()[:12]

def execute(tool_name, args, registry, user_scopes, mode="full", approved_hashes=()):
    pass
```

## Tests

```python
ns = load()
ex, ah = ns["execute"], ns["action_hash"]
reg = {
    "search": {"fn": lambda q: f"results for {q}", "risk": "read", "requires_approval": False, "scopes": set(), "required_args": ["q"]},
    "refund": {"fn": lambda order_id, amount: f"refunded {amount}", "risk": "write", "requires_approval": True,
               "scopes": {"payments:write"}, "required_args": ["order_id", "amount"]},
}
assert ex("search", {"q": "rag"}, reg, set()) == {"status": "ok", "result": "results for rag"}
assert ex("nope", {}, reg, set())["reason"] == "unknown_tool"
assert ex("refund", {"order_id": 1, "amount": 5}, reg, {"payments:write"}, mode="readonly")["reason"] == "mode"
assert ex("refund", {"order_id": 1, "amount": 5}, reg, set())["reason"] == "forbidden"
assert ex("refund", {"order_id": 1}, reg, {"payments:write"})["reason"] == "bad_args"
r = ex("refund", {"order_id": 1, "amount": 5}, reg, {"payments:write"})
assert r == {"status": "approval_required", "hash": ah("refund", {"order_id": 1, "amount": 5})}
ok = ex("refund", {"order_id": 1, "amount": 5}, reg, {"payments:write"}, approved_hashes={r["hash"]})
assert ok == {"status": "ok", "result": "refunded 5"}
tampered = ex("refund", {"order_id": 1, "amount": 500}, reg, {"payments:write"}, approved_hashes={r["hash"]})
assert tampered["status"] == "approval_required", "changed args must not reuse the approval"
```

## Solution

```python
import hashlib, json

def action_hash(name, args):
    return hashlib.sha256(json.dumps([name, args], sort_keys=True).encode()).hexdigest()[:12]

def execute(tool_name, args, registry, user_scopes, mode="full", approved_hashes=()):
    spec = registry.get(tool_name)
    if spec is None:
        return {"status": "error", "reason": "unknown_tool"}
    if mode == "readonly" and spec["risk"] != "read":
        return {"status": "error", "reason": "mode"}
    if not spec["scopes"] <= set(user_scopes):
        return {"status": "error", "reason": "forbidden"}
    if any(a not in args for a in spec["required_args"]):
        return {"status": "error", "reason": "bad_args"}
    if spec["requires_approval"]:
        h = action_hash(tool_name, args)
        if h not in approved_hashes:
            return {"status": "approval_required", "hash": h}
    return {"status": "ok", "result": spec["fn"](**args)}
```

The tampering test is the important one: binding approvals to a hash of the exact arguments means a prompt-injected model can't raise the amount after approval.

# Sources

- [Anthropic docs: Tool use (parallel tool use, tool_choice)](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [LangGraph: Human-in-the-loop and persistence](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
- [Model Context Protocol: client development](https://modelcontextprotocol.io/quickstart/client)
- [Microsoft: Guidelines for Human-AI Interaction (18 design guidelines)](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/)
- [OWASP Top 10 for LLM Applications: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
