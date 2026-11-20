---
id: ag-w1
title: LLM Applications & LangChain
week: Week 1
summary: LLM capabilities and limits, choosing models by cost and latency, calling LLM APIs, system prompts, structured outputs, tool calling and tool contracts, LangChain models/messages/tools, and the agent loop with stopping conditions and traces.
builds_on: py-w7, f-web, f-probability
leads_to: ag-w2, ag-w3, fs-w5
---

This bootcamp is about building AI systems that **act**: they call tools, retrieve knowledge, keep state and run safely in production. Week 1 lays the foundation: how to talk to LLMs programmatically and reliably, and how the agent loop actually works. You'll write it once by hand, then with LangChain.

> [!tip] Running the code
> Examples that call real LLM APIs are marked to run locally or in Colab: you need an API key (Anthropic, OpenAI, or a local model via Ollama). The **pure-Python agent loop** in this module runs right here with a fake model, so you can see every moving part.

# Lesson: What LLMs are good and bad at (25 min)

From Python week 7: an LLM predicts the next token, conditioned on its context. In practice that means:

| Strong at | Weak at / risky |
|---|---|
| Language: summarizing, rewriting, translating, extracting | Exact arithmetic and counting (use a tool) |
| Following instructions and formats | Facts after the training cutoff, private data (use retrieval) |
| Writing and explaining code | Guaranteeing correctness (verify with tests or tools) |
| Planning and decomposing tasks | Very long, multi-step autonomy without checks |
| Classifying fuzzy categories | Determinism: outputs vary with sampling |

**Design principle:** use the LLM for what it's good at, and surround it with **tools** (calculators, search, databases, code execution) and **checks** (schemas, validators, evals).

### Choosing a model: capability vs cost vs latency

- **Capability**: larger frontier models reason better. Smaller, faster models are often enough for classification, extraction and routing.
- **Cost**: billed per million **input** and **output** tokens, with output usually priced higher. Cost per request ≈ input tokens × input price + output tokens × output price.
- **Latency**: time-to-first-token (TTFT) plus generation speed (tokens per second). Stream for perceived speed.
- **Context window**: how many tokens fit, which matters for long documents and long agent runs.
- Other factors: tool-calling quality, multilingual ability (Persian!), data-privacy terms, and open-weight models you can self-host.

```python
def cost_usd(input_tokens, output_tokens, in_price_per_m, out_price_per_m):
    return input_tokens / 1e6 * in_price_per_m + output_tokens / 1e6 * out_price_per_m

# Illustrative prices only: always check the provider's current pricing page.
for name, pin, pout in [("small model", 0.25, 1.25), ("mid model", 3.0, 15.0), ("large model", 15.0, 75.0)]:
    per_req = cost_usd(3000, 500, pin, pout)
    print(f"{name:12} ${per_req:.4f}/request   ${per_req * 100_000:,.0f} per 100k requests")
```

> [!important] Route by difficulty
> Many production systems use a **cheap model by default** and escalate to a stronger one only when needed (low confidence, or a complex request). This "model cascade" often cuts costs by 5–10×.

> [!recap]
> - LLMs handle language and reasoning. Tools handle exactness, freshness and actions.
> - Choose models by capability, cost (input and output tokens), latency and context window.

# Lesson: Calling LLM APIs: messages, system prompts, parameters (30 min)

All major APIs share a shape: you send a **list of messages** and receive a message back.

```python norun
# pip install anthropic   (set ANTHROPIC_API_KEY in your environment)
import anthropic
client = anthropic.Anthropic()          # reads the API key from the environment

resp = client.messages.create(
    model="claude-sonnet-5-5",          # use the current model id from the provider's docs
    max_tokens=500,
    system="You are a concise assistant for a bootcamp. Answer in at most 3 sentences.",
    messages=[
        {"role": "user", "content": "What is a context window?"},
    ],
    temperature=0.2,
)
print(resp.content[0].text)
print(resp.usage.input_tokens, resp.usage.output_tokens)   # log usage for cost tracking
```

The OpenAI SDK is analogous (`client.chat.completions.create(model=..., messages=[{"role":"system",...}, ...])`). **LangChain** wraps many providers behind one interface (lesson 4).

### Key concepts

- **Roles**: the `system` prompt sets persistent behaviour, `user` holds the human's turns, and `assistant` holds the model's previous turns.
- **Statelessness**: the API remembers nothing. To have a conversation, **you re-send the history** each time. That's why long chats get expensive, and why context management matters (week 4).
- **Parameters**: `max_tokens` (an output cap), `temperature` (randomness: low for extraction and code, higher for brainstorming), `stop` sequences.
- **Streaming**: receive tokens as they're generated, for better UX (Full-Stack week 2).

### System prompts that work

- State the **role, audience and goal**. List the **rules** and constraints. Specify the **output format**.
- Give **examples** of ideal behaviour (few-shot).
- Say what to do when unsure: "If the answer isn't in the provided context, say you don't know."
- Separate **instructions** from **untrusted data** with clear delimiters, such as `<document>…</document>`. Data is never instructions (week 5: prompt injection).

### Configuration as code

Keep the model name, temperature and prompt versions in configuration, not scattered through the code. Log the **prompt version + model + parameters** with every request, so you can reproduce and evaluate behaviour later.

> [!recap]
> - A list of messages in, a message out. You manage the history.
> - System prompts: role, rules, format, examples, uncertainty behaviour, and data delimiters.
> - Log usage and configuration for cost and reproducibility.

# Lesson: Structured outputs and tool calling (35 min)

Programs can't reliably parse free text. **Structured output** makes the model return data that matches a **schema**.

### Schemas with Pydantic

```python norun
from pydantic import BaseModel, Field
from typing import Literal

class Ticket(BaseModel):
    category: Literal["bug", "billing", "other"]
    urgency: int = Field(ge=1, le=5, description="1 = low, 5 = critical")
    summary: str = Field(max_length=120)
    customer_email: str | None = None
```

Most providers offer native structured output (JSON-schema constrained decoding) or tool/function calling. With LangChain: `llm.with_structured_output(Ticket)`. **Always validate** the result, and on failure, retry with the validation error included in the prompt (bounded retries).

```python
import json
# A validation-and-repair loop with a fake model, so the logic is runnable here
fake_outputs = ['{"category": "bug", "urgency": 9, "summary": "crash"}',          # invalid urgency
                '{"category": "bug", "urgency": 4, "summary": "App crashes on upload"}']

def validate(d):
    errors = []
    if d.get("category") not in {"bug", "billing", "other"}: errors.append("category must be bug|billing|other")
    if not isinstance(d.get("urgency"), int) or not 1 <= d["urgency"] <= 5: errors.append("urgency must be an int 1-5")
    if not d.get("summary") or len(d["summary"]) > 120: errors.append("summary required, <=120 chars")
    return errors

for attempt, raw in enumerate(fake_outputs, 1):
    data = json.loads(raw)
    errs = validate(data)
    print(f"attempt {attempt}: {data} -> {'OK' if not errs else errs}")
    if not errs:
        break
    # in real code: send `errs` back to the model and ask it to fix its JSON
```

### Tool calling (function calling)

You describe **tools** to the model with a name, a description and a JSON schema for the arguments. The model may reply with a **tool call** instead of text. **Your code executes it** and sends the result back in a "tool result" message. Then the model continues.

```python norun
tools = [{
    "name": "get_order_status",
    "description": "Look up the current status of ONE order by its numeric id. Use when the user asks where their order is.",
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "integer", "description": "The order number, e.g. 1042"}},
        "required": ["order_id"],
    },
}]
```

### Designing good tool contracts

The model only knows a tool through its **name, description and schema**. Treat these like a public API for a new colleague:

- **Clear names and descriptions**: say *when* to use the tool, *when not to*, and what it returns.
- **Typed, constrained arguments**: enums, ranges, required fields and examples.
- **Small, focused tools** beat one giant "do_anything" tool. But don't create 50 overlapping ones either, because tool selection gets harder.
- **Helpful errors**: return messages the model can act on ("order 1042 not found; ask the user to confirm the number") rather than stack traces.
- **Concise outputs**: return what's needed, not a 5,000-row dump. Tool output consumes context (week 4).
- **Side effects**: separate read-only tools from tools that **change** things (refunds, emails), and require approval for risky ones (weeks 3 and 5).

> [!recap]
> - Structured output: schema + validation + bounded repair retries.
> - Tool calling: the model requests, your code executes, and the result goes back into the context.
> - Tool contracts are prompts: clear names, descriptions, typed args, actionable errors, concise outputs.

# Lesson: The agent loop and LangChain (35 min)

An **agent** is an LLM in a loop: decide → act (call a tool) → observe → repeat, until it answers or a **stopping condition** triggers.

### The loop by hand (runs here, with a scripted fake model)

```python
import json

# --- tools: plain Python functions -------------------------------------------
ORDERS = {1042: "shipped", 1043: "processing"}
def get_order_status(order_id: int) -> str:
    return ORDERS.get(order_id, f"order {order_id} not found")
def calculator(expression: str) -> str:
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return "error: only arithmetic is allowed"
    return str(eval(expression))            # safe here thanks to the whitelist above
TOOLS = {"get_order_status": get_order_status, "calculator": calculator}

# --- a fake LLM that returns scripted decisions (stands in for a real API) ----
script = iter([
    {"tool": "get_order_status", "args": {"order_id": 1042}},
    {"tool": "calculator", "args": {"expression": "3 * 19.99"}},
    {"answer": "Order 1042 has shipped. Three items at 19.99 cost 59.97."},
])
def fake_llm(messages):
    return next(script)

# --- the agent loop ----------------------------------------------------------
def run_agent(user_msg, max_steps=5):
    messages = [{"role": "user", "content": user_msg}]
    for step in range(1, max_steps + 1):                 # stopping condition 1: step budget
        decision = fake_llm(messages)
        if "answer" in decision:                         # stopping condition 2: final answer
            print(f"[step {step}] FINAL: {decision['answer']}")
            return decision["answer"]
        name, args = decision["tool"], decision["args"]
        try:
            result = TOOLS[name](**args) if name in TOOLS else f"unknown tool {name}"
        except Exception as e:                           # tool errors become observations
            result = f"error: {e}"
        print(f"[step {step}] {name}({json.dumps(args)}) -> {result}")
        messages.append({"role": "assistant", "content": json.dumps(decision)})
        messages.append({"role": "tool", "content": result})
    return "Stopped: step budget exhausted."

run_agent("Where is order 1042, and what do 3 items at 19.99 cost?")
```

Every agent framework is this loop with more features. The essential safeguards:
- **Stopping conditions**: a final answer, a max number of steps or tool calls, a time or cost budget, and repeated identical calls (a loop detector).
- **Error handling**: tool exceptions become observations the model can recover from. Retry transient failures with backoff.
- **Execution traces**: log every step (prompt, decision, tool, args, result, tokens, latency). You can't debug an agent without them (week 5).

### The same thing with LangChain

```python norun
# pip install langchain langchain-anthropic   (or langchain-openai)
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, ToolMessage

@tool
def get_order_status(order_id: int) -> str:
    """Look up the current status of one order by its numeric id."""
    return {1042: "shipped"}.get(order_id, "not found")

llm = ChatAnthropic(model="claude-sonnet-5-5", temperature=0).bind_tools([get_order_status])
messages = [HumanMessage("Where is order 1042?")]
for _ in range(5):
    ai = llm.invoke(messages)
    messages.append(ai)
    if not ai.tool_calls:
        print(ai.content); break
    for call in ai.tool_calls:
        result = get_order_status.invoke(call["args"])
        messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
```

LangChain gives you a uniform **chat model** interface across providers, **message** types, the **@tool** decorator (it builds the schema from the type hints and docstring, which is why your docstrings matter!), output parsers and integrations. For anything beyond a simple loop, you'll use **LangGraph** (week 3) for explicit control flow and state.

> [!recap]
> - Agent = LLM + tools + loop + stopping conditions.
> - Turn tool errors into observations. Trace every step.
> - LangChain: chat models, messages, @tool and bind_tools. LangGraph for complex control.

# Quiz

## Which task should you give to a tool rather than rely on the LLM alone?
- [ ] Summarizing a paragraph
- [x] Computing the exact total of 37 invoice amounts
- [ ] Rewriting text in a friendlier tone
- [ ] Classifying a ticket's topic
> Exact arithmetic and counting are LLM weak spots. Call a calculator or code.

## Why does a long chat get more expensive per message over time?
- [ ] The provider raises prices
- [x] The API is stateless, so the growing history is re-sent as input tokens on every call
- [ ] Output tokens get more expensive
- [ ] Temperature increases
> Context management (summaries, trimming) controls this.

## In tool calling, who executes the tool?
- [ ] The LLM provider's servers
- [x] Your application code, which then sends the result back to the model
- [ ] The user
- [ ] The tool runs inside the model weights
> The model only emits a structured request.

## Which tool description is best?
- [ ] "orders"
- [ ] "Does order stuff"
- [x] "Look up the status of ONE order by numeric id. Use when the user asks where an order is. Returns shipped/processing/not found."
- [ ] A 3-page manual
> Clear purpose, when to use it, and what it returns. Concise but specific.

## What is a stopping condition in an agent loop?
- [x] A rule that ends the loop: final answer, step/cost budget, or detected repetition
- [ ] The temperature setting
- [ ] A tool that stops the server
- [ ] The system prompt
> Without one, agents can loop forever and burn money.

## Your structured output fails validation. What's the best practice?
- [ ] Crash the program
- [ ] Accept it anyway
- [x] Retry a bounded number of times, feeding the validation errors back to the model
- [ ] Switch to free text
> A validate → repair loop with a retry limit.

## What does LangChain's `@tool` decorator use to build the tool schema?
- [ ] Random names
- [x] The function name, type hints and docstring
- [ ] The return value only
- [ ] A separate YAML file
> Your docstring becomes the description the model reads.

## A tool raises an exception mid-run. The robust agent behaviour is:
- [ ] Crash the whole agent
- [x] Return the error as an observation so the model can adjust (and retry transient errors with backoff)
- [ ] Hide the error and return an empty string
- [ ] Restart from scratch
> Errors are information. Make them actionable.

# Exercise: A robust tool dispatcher

Write `dispatch(call, tools)` where `call` is a dict like `{"tool": "name", "args": {...}}` and `tools` maps names to Python functions. Always return a **string observation** (never raise):
- An unknown tool → `"error: unknown tool <name>. Available: a, b"` (names sorted, joined with `", "`).
- Arguments that don't match the function (TypeError from calling it) → a string starting with `"error: bad arguments for <name>"`.
- Any other exception inside the tool → `"error: <ExceptionClassName>: <message>"`.
- Success → `str(result)`.

## Starter

```python
def dispatch(call, tools):
    pass

tools = {"add": lambda a, b: a + b, "div": lambda a, b: a / b}
print(dispatch({"tool": "add", "args": {"a": 2, "b": 3}}, tools))
```

## Tests

```python
ns = load()
d = ns["dispatch"]
tools = {"add": lambda a, b: a + b, "div": lambda a, b: a / b}
assert d({"tool": "add", "args": {"a": 2, "b": 3}}, tools) == "5"
assert d({"tool": "mul", "args": {}}, tools) == "error: unknown tool mul. Available: add, div"
assert d({"tool": "add", "args": {"x": 1}}, tools).startswith("error: bad arguments for add")
assert d({"tool": "div", "args": {"a": 1, "b": 0}}, tools) == "error: ZeroDivisionError: division by zero"
assert d({"tool": "add", "args": {"a": "x", "b": "y"}}, tools) == "xy"
```

## Hint

A `TypeError` can come from bad arguments *or* from inside the tool. To tell them apart, check the arguments first with `inspect.signature(fn).bind(**args)`, which raises a TypeError only when the arguments don't fit.

## Solution

```python
import inspect

def dispatch(call, tools):
    name, args = call.get("tool"), call.get("args", {})
    fn = tools.get(name)
    if fn is None:
        return f"error: unknown tool {name}. Available: {', '.join(sorted(tools))}"
    try:
        inspect.signature(fn).bind(**args)
    except TypeError as e:
        return f"error: bad arguments for {name}: {e}"
    try:
        return str(fn(**args))
    except Exception as e:
        return f"error: {type(e).__name__}: {e}"
```

# Exercise: Agent loop with budgets

Write `run(decisions, tools, max_steps=4)`, where `decisions` is a list of scripted model outputs (`{"tool":..., "args":...}` or `{"answer": ...}`). Execute them in order with your `dispatch` logic (paste it in). Return a dict with `answer` (or `None`), `steps` (the number of decisions consumed) and `stopped` (`"answer"`, `"max_steps"` or `"repeat"`). Stop with `"repeat"` if the **same tool call** (same tool and same args) is about to run a **third** time.

## Starter

```python
import json, inspect

def dispatch(call, tools):
    pass   # reuse your solution from the previous exercise

def run(decisions, tools, max_steps=4):
    pass
```

## Tests

```python
ns = load()
run = ns["run"]
tools = {"echo": lambda x: x}
r = run([{"tool": "echo", "args": {"x": 1}}, {"answer": "done"}], tools)
assert r == {"answer": "done", "steps": 2, "stopped": "answer"}, r
r = run([{"tool": "echo", "args": {"x": i}} for i in range(10)], tools, max_steps=4)
assert r == {"answer": None, "steps": 4, "stopped": "max_steps"}, r
r = run([{"tool": "echo", "args": {"x": 1}}] * 5, tools, max_steps=10)
assert r == {"answer": None, "steps": 3, "stopped": "repeat"}, r
```

## Solution

```python
import json, inspect

def dispatch(call, tools):
    name, args = call.get("tool"), call.get("args", {})
    fn = tools.get(name)
    if fn is None:
        return f"error: unknown tool {name}. Available: {', '.join(sorted(tools))}"
    try:
        inspect.signature(fn).bind(**args)
    except TypeError as e:
        return f"error: bad arguments for {name}: {e}"
    try:
        return str(fn(**args))
    except Exception as e:
        return f"error: {type(e).__name__}: {e}"

def run(decisions, tools, max_steps=4):
    seen = {}
    steps = 0
    for decision in decisions:
        if steps >= max_steps:
            return {"answer": None, "steps": steps, "stopped": "max_steps"}
        steps += 1
        if "answer" in decision:
            return {"answer": decision["answer"], "steps": steps, "stopped": "answer"}
        key = json.dumps([decision["tool"], decision.get("args", {})], sort_keys=True)
        seen[key] = seen.get(key, 0) + 1
        if seen[key] >= 3:
            return {"answer": None, "steps": steps, "stopped": "repeat"}
        dispatch(decision, tools)
    return {"answer": None, "steps": steps, "stopped": "max_steps"}
```

The step counted for the third repeat is consumed (the model *proposed* it) but never executed. This protects you from agents stuck calling the same failing tool forever.

# Sources

- [Anthropic docs: Messages API, tool use and structured outputs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [OpenAI docs: Function calling and Structured Outputs](https://platform.openai.com/docs/guides/function-calling)
- [LangChain docs: chat models, tools and tool calling](https://python.langchain.com/docs/concepts/tool_calling/)
- [Anthropic engineering: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic engineering: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Pydantic documentation](https://docs.pydantic.dev/)
