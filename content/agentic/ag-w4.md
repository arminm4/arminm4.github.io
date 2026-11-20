---
id: ag-w4
title: Advanced Agents & Harness Engineering
week: Week 4
summary: Agent harness architecture, planning with progress artifacts and verification, context engineering and compaction, memory lifecycle, MCP servers and clients, skills with progressive disclosure, sandboxed execution, subagents and long-running tasks.
builds_on: ag-w3, f-terminal
leads_to: ag-w5, fs-w9
---

The model is only part of an agent. The **harness**, meaning the code around the model, decides what it sees, which tools it may use, how its work is checked, and how long tasks survive. Coding agents like Claude Code, Cursor and Codex are mostly harness engineering. This week covers the techniques that make agents work on real, long, messy tasks.

# Lesson: The agent harness (25 min)

```text
┌──────────────────────────── HARNESS ─────────────────────────────┐
│ system prompt + rules   tool registry (+ permissions)   budgets  │
│ context manager: what goes into each model call (and what not)   │
│ planner / todo list   progress files   verification (tests, lint)│
│ memory store   sandbox   subagent spawner   tracing & audit log  │
└───────────────┬───────────────────────────────▲──────────────────┘
                │ prompt (curated context)      │ tool calls / text
                ▼                               │
              [ LLM ] ──────────────────────────┘
```

Harness responsibilities:
- **Execution control**: the loop, step/time/cost budgets, cancellation, retries, and when to ask the human.
- **Tool access**: which tools are available in which mode (read-only vs write), with argument validation and permission prompts.
- **Context assembly**: choosing what the model sees each turn. This is the biggest lever on quality (next lesson).
- **Verification**: never trust "done" claims. Run the tests, linters and type checkers, re-read the files, and check the result against the goal.
- **Observability**: full traces and audit logs of every action.

### Planning, progress artifacts and verification

Long tasks go better when the agent **externalizes its plan**:
- A **todo list / plan** tool that the model updates as it works. It keeps the agent on track and shows the user progress.
- **Progress files** (`PROGRESS.md`, `NOTES.md`, a features checklist in JSON) written into the workspace. They survive context resets and let a fresh session continue the work.
- **Verification steps** baked into the plan: "after editing, run `pytest -q`. Mark a task done only when the tests pass."
- **Git commits as checkpoints**: small commits make progress inspectable and reversible.

> [!important] "Done" must be verified, not declared
> Models sometimes claim success prematurely. A good harness requires evidence (passing tests, a screenshot of the working UI, a matching output) before it marks a task complete.

> [!recap]
> - Harness = control + tools + context + verification + observability.
> - Plans and progress files make long work trackable and resumable.
> - Verify completion with tests and checks.

# Lesson: Context engineering and compaction (35 min)

**Context engineering** means curating the smallest set of high-signal tokens that lets the model do the next step well. More context isn't better: irrelevant tokens dilute attention, add cost and latency, and can mislead.

### Sources competing for the window

System prompt · tool definitions · conversation history · retrieved documents · tool outputs · memory · the current task. Each needs a **budget**.

### Tool-output management

Tool results are the biggest source of bloat: a 20,000-line log or a 5 MB JSON response.
- Return **summaries + handles**: "Found 1,342 matches; top 20 shown; full results saved to /tmp/search_7.json".
- **Paginate** and **truncate** with explicit markers: `...[truncated 18,400 lines; use read_file with offset to see more]`.
- Let the agent fetch details **just in time** with targeted tools (`grep`, `read_file(path, offset, limit)`) instead of preloading everything.

```python
def truncate_output(text, max_chars=600, head=400, tail=150):
    if len(text) <= max_chars:
        return text
    omitted = len(text) - head - tail
    return f"{text[:head]}\n...[{omitted} characters truncated; ask for a specific range to see more]...\n{text[-tail:]}"

log = "\n".join(f"line {i}: INFO request ok" for i in range(500)) + "\nline 500: ERROR database timeout"
print(truncate_output(log))
```

Keeping the **tail** matters here: the error is at the end of the log.

### Compaction

When the history approaches the limit:
- **Summarize** older turns into a compact "state of the work" note: decisions, open questions, files touched, next steps. Keep the recent turns verbatim.
- **Clear stale tool results**: an old file listing can be dropped once it has been acted upon.
- **Offload to files** (progress notes) and **reload on demand**.

Compaction is lossy. Write the summaries to preserve **what future steps need**: goals, constraints, decisions *and their reasons*, and pending items.

### Memory lifecycle

Long-term memory (week 3) needs **write policies** (what's worth remembering), **retrieval** (the relevant memories only, e.g. by embedding similarity plus recency), **updating** (resolving conflicts: the user moved cities), and **forgetting** (expiry, user deletion requests, privacy).

> [!recap]
> - Curate a minimal, high-signal context with a budget per source.
> - Summarize, paginate and truncate tool output with markers. Fetch just in time.
> - Compaction summaries keep goals, decisions and next steps. Memory needs write, retrieve, update and forget.

# Lesson: MCP: the Model Context Protocol (30 min)

Every agent needs integrations (GitHub, databases, Slack, files). Writing a custom tool wrapper for every app × every agent doesn't scale. The **Model Context Protocol (MCP)** is an open standard, introduced by Anthropic in November 2024 and now widely adopted, for connecting AI applications to tools and data. It's sometimes described as "USB-C for AI integrations".

### Architecture

- **Host**: the AI application (Claude Desktop, an IDE, your agent).
- **Client**: a connection inside the host to one server.
- **Server**: a program exposing capabilities. It runs **locally** over **stdio**, or **remotely** over **Streamable HTTP**.
- Messages use **JSON-RPC 2.0**. On connect, client and server **negotiate capabilities**.

### What servers expose

| Primitive | Controlled by | Example |
|---|---|---|
| **Tools** | The model (it decides to call them) | `create_issue`, `run_query` |
| **Resources** | The application/user (attached as context) | File contents, a DB schema, docs |
| **Prompts** | The user (templates they pick) | "/summarize-pr" |

Clients can also offer features to servers, such as **sampling** (a server asks the host's model to generate text) and **elicitation** (a server asks the user for input).

### A minimal MCP server in Python

```python norun
# pip install "mcp[cli]"
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("shop")

@mcp.tool()
def order_status(order_id: int) -> str:
    """Return the shipping status of one order by its numeric id."""
    return {1042: "shipped", 1043: "processing"}.get(order_id, "not found")

@mcp.resource("shop://policies/refunds")
def refund_policy() -> str:
    """The current refund policy text."""
    return "Annual plans: refundable within 30 days. Monthly plans: not refundable."

if __name__ == "__main__":
    mcp.run()            # stdio transport by default; a host launches this process
```

A host configured with this server automatically discovers `order_status` (its name, description and JSON schema) and the resource, and offers them to its model. You write the integration **once**, and every MCP-compatible host can use it.

> [!warning] MCP security
> Servers run code and may access sensitive systems. Install only trusted servers, prefer least-privilege credentials, review the tool descriptions (a malicious server can embed instructions in them: "tool poisoning"), and require user approval for consequential tools. Remote servers should use OAuth-based authorization.

> [!recap]
> - MCP standardizes host ↔ client ↔ server integrations over JSON-RPC (stdio or HTTP).
> - Servers expose tools (model-controlled), resources (app-controlled) and prompts (user-controlled).
> - Treat servers as code with access: trust, least privilege, approvals.

# Lesson: Skills, sandboxes, subagents and long-running tasks (35 min)

### Skills and progressive disclosure

Putting every instruction for every task into the system prompt wastes context. **Agent skills** (introduced by Anthropic in 2025) package expertise as folders:

```text
skills/pdf-forms/
├── SKILL.md         # front matter: name + description (always visible to the agent)
│                    # body: step-by-step instructions (loaded only when relevant)
├── reference.md     # deeper docs (read only if needed)
└── fill_form.py     # scripts the agent can run instead of re-deriving code
```

**Progressive disclosure**: the agent sees only the short *descriptions* of all its skills. When a task matches, it reads that `SKILL.md`, and only if necessary the extra files. Capability scales without bloating every prompt. The same principle applies to tools (load tool groups on demand) and documentation.

### Sandboxed code execution

Agents that write and run code need **isolation**:
- Containers or micro-VMs (Docker, gVisor, Firecracker) or WebAssembly sandboxes, with **no host access**.
- **Resource limits**: CPU and memory caps, a wall-clock timeout, a maximum output size and a maximum number of processes.
- **Network policy**: off by default, or an allowlist of domains.
- **Filesystem**: an ephemeral workspace, with read-only mounts for inputs.
- **Secrets**: never mount production credentials. Use scoped, short-lived tokens.

(This app's in-browser Python runner is a sandbox too: WebAssembly inside a Web Worker with a timeout.)

### Subagents, isolated context and structured handoffs

A main agent can delegate subtasks to **subagents**, each with a **fresh, isolated context** and a focused toolset: "search the codebase for all uses of X", "review this diff for security issues".
- **Benefits**: parallelism, keeping the main context clean (the subagent reads 50 files and returns a 10-line summary), and specialization.
- **Costs**: more total tokens, coordination overhead, and lost nuance if the handoffs are vague.
- **Structured handoffs**: give the subagent an explicit brief (goal, constraints, the output format, and when to stop), and require **structured results** (JSON or a fixed template) that the orchestrator can verify.

### Long-running tasks and session handover

For work spanning hours or days, or many context windows:
- Persist the **state outside the model**: progress files, todo lists, git history, a task database.
- At the start of each session, the agent **re-orients**: it reads the progress notes, checks the git log, runs the tests to see the current state, and then picks the next item.
- **Incremental, verifiable steps**: one feature at a time, committed with passing tests.
- **Handover notes** at the end of each session: what was done, what's in progress, known issues, and the next steps.

> [!recap]
> - Skills: always-visible descriptions, instructions loaded on demand.
> - Sandboxes: isolation, resource limits, no network by default, no production secrets.
> - Subagents: isolated context, structured briefs and results.
> - Long tasks: external state, re-orientation, incremental verified steps, handover notes.

# Quiz

## What is "context engineering"?
- [ ] Making the context window larger
- [x] Curating the smallest, highest-signal set of tokens the model needs for its next step
- [ ] Encrypting prompts
- [ ] Fine-tuning a model
> More tokens isn't better. Relevance and budget matter.

## A tool returns a 30,000-line log. The best harness behaviour is:
- [ ] Put all of it in the context
- [x] Return a summary and the relevant parts (head/tail/matches) with a truncation marker, and allow targeted follow-up reads
- [ ] Drop it silently
- [ ] Ask the user to read it
> Manage tool output size explicitly and enable just-in-time detail.

## In MCP, which primitive is primarily invoked by the model itself?
- [x] Tools
- [ ] Resources
- [ ] Prompts
- [ ] Roots
> Resources are attached by the application or user. Prompts are chosen by the user.

## What transport does a local MCP server typically use?
- [ ] SMTP
- [x] stdio (the host launches the server process)
- [ ] FTP
- [ ] WebRTC
> Remote servers use Streamable HTTP. Messages are JSON-RPC 2.0.

## What is "progressive disclosure" in agent skills?
- [ ] Revealing the answer slowly to the user
- [x] Showing only short skill descriptions up front, and loading the full instructions and files only when relevant
- [ ] Gradually increasing temperature
- [ ] Streaming tokens
> It scales capabilities without filling every prompt.

## Which sandbox setting is the safest default for agent-executed code?
- [ ] Full network access and production credentials
- [x] No network (or an allowlist), resource limits, an ephemeral filesystem, no production secrets
- [ ] Run directly on the developer laptop
- [ ] Unlimited CPU time
> Assume generated code can be wrong or manipulated.

## Why give subagents structured briefs and require structured results?
- [ ] To make them slower
- [x] Isolated contexts lose nuance; explicit goals, constraints and output formats keep handoffs reliable and verifiable
- [ ] Because JSON is cheaper
- [ ] Subagents can't read text
> Clear contracts between agents, like good APIs between services.

## At the start of a new session on a long task, a good agent should first:
- [ ] Start coding immediately
- [x] Read the progress notes and git log, run the tests, then pick the next task
- [ ] Delete old files
- [ ] Ask the user to repeat everything
> Re-orientation from external state makes long work reliable.

# Exercise: Context packer with budgets

Write `pack(items, budget)`. Each item is a dict `{"id", "text", "priority"}` (a higher priority is more important), and the cost is `len(text.split())` "tokens". Return the list of ids to include, chosen **greedily by priority** (ties: the earlier item in the list first), skipping items that don't fit in the remaining budget. Return the ids in their **original order** (to preserve the document flow).

## Starter

```python
def pack(items, budget):
    pass
```

## Tests

```python
ns = load()
items = [
    {"id": "sys", "text": "a " * 10, "priority": 10},
    {"id": "old_chat", "text": "b " * 50, "priority": 1},
    {"id": "doc1", "text": "c " * 30, "priority": 5},
    {"id": "doc2", "text": "d " * 30, "priority": 5},
    {"id": "question", "text": "e " * 5, "priority": 9},
]
assert ns["pack"](items, 50) == ["sys", "doc1", "question"], ns["pack"](items, 50)
assert ns["pack"](items, 1000) == ["sys", "old_chat", "doc1", "doc2", "question"]
assert ns["pack"](items, 4) == []
```

## Solution

```python
def pack(items, budget):
    order = sorted(range(len(items)), key=lambda i: (-items[i]["priority"], i))
    chosen, used = set(), 0
    for i in order:
        cost = len(items[i]["text"].split())
        if used + cost <= budget:
            chosen.add(i)
            used += cost
    return [items[i]["id"] for i in range(len(items)) if i in chosen]
```

With a budget of 50: sys (10) + question (5) + doc1 (30) = 45. doc2 (30) doesn't fit, and old_chat (50) doesn't either.

# Exercise: Conversation compaction

Write `compact(messages, max_tokens, keep_last=4, summarize=None)`. `messages` is a list of `{"role", "content"}` dicts, and tokens are the word counts of the content. If the total is ≤ `max_tokens`, return the messages unchanged (the same list object is fine). Otherwise, replace **all but the last `keep_last` messages** with **one** system message whose content is `"Summary of earlier conversation: " + summarize(old_messages)`. The default `summarize` joins the first 8 words of each old message with `" | "`. Return the new list.

## Starter

```python
def compact(messages, max_tokens, keep_last=4, summarize=None):
    pass
```

## Tests

```python
ns = load()
msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"message number {i} " + "word " * 20} for i in range(10)]
out = ns["compact"](msgs, max_tokens=100, keep_last=4)
assert len(out) == 5 and out[0]["role"] == "system"
assert out[0]["content"].startswith("Summary of earlier conversation: message number 0")
assert out[1:] == msgs[-4:]
assert ns["compact"](msgs[:2], max_tokens=1000) == msgs[:2]
custom = ns["compact"](msgs, 100, 2, summarize=lambda old: f"{len(old)} old msgs")
assert custom[0]["content"] == "Summary of earlier conversation: 8 old msgs" and len(custom) == 3
```

## Solution

```python
def compact(messages, max_tokens, keep_last=4, summarize=None):
    total = sum(len(m["content"].split()) for m in messages)
    if total <= max_tokens:
        return messages
    if summarize is None:
        summarize = lambda old: " | ".join(" ".join(m["content"].split()[:8]) for m in old)
    old, recent = messages[:-keep_last], messages[-keep_last:]
    return [{"role": "system", "content": "Summary of earlier conversation: " + summarize(old)}] + recent
```

In production, `summarize` is an LLM call with instructions to keep goals, decisions, constraints and open items.

# Sources

- [Anthropic engineering: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic engineering: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Model Context Protocol: specification and documentation](https://modelcontextprotocol.io/)
- [MCP Python SDK (FastMCP)](https://github.com/modelcontextprotocol/python-sdk)
- [Anthropic: Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Anthropic engineering: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
