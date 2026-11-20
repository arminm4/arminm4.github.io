---
id: py-w8
title: Real-World Vibe Coding
week: Week 8
summary: An end-to-end AI-assisted project walkthrough, evaluating and testing AI-generated code, and effective pair programming with AI. Ends with the Python capstone.
builds_on: py-w7, py-p1
leads_to: bi-w1, ai-w1, ag-w1
---

The final Python week turns last week's ideas into a professional workflow. You'll watch a small project get built with an AI pair programmer, learn how to test code you didn't write, and finish with a capstone project.

# Lesson: Walkthrough: building a project with an AI pair programmer (30 min)

**Goal:** a command-line "link checker" that reads URLs from a Markdown file, checks each one concurrently, and reports the broken ones. Here's how an experienced developer drives the AI.

### Step 1: Write the spec first (you, not the AI)

```text
linkcheck README.md [--timeout 5] [--concurrency 10]
- Extract http(s) URLs from Markdown links [text](url) and bare URLs.
- HEAD each unique URL (fall back to GET if HEAD returns 405).
- Report: OK count, and a table of broken links (status or error) with line numbers.
- Exit code 1 if any link is broken (so CI can use it).
- Standard library + httpx only. Python 3.12. Include tests.
```

### Step 2: Ask for a plan, not code

*"Before writing code, propose the module structure, functions with signatures, and test cases. Point out ambiguities in my spec."* A good assistant asks things like: should duplicate URLs be checked once? What about redirects? Rate limiting? **Answer those questions** before any code is written.

### Step 3: Generate in slices, verifying each

1. `extract_links(text) -> list[tuple[int, str]]`: ask for the function **and** its tests. Run them. Add your own edge cases: URLs inside code blocks, trailing punctuation, parentheses inside URLs.
2. `check(url, client) -> Result`: ask for a version that takes the HTTP client as a **parameter** (dependency injection), so tests can pass in a fake client with no network.
3. Concurrency with `asyncio` and a semaphore, then the CLI with `argparse`, then the exit codes.

After each slice, commit: `git commit -m "Add link extraction with tests"`.

### Step 4: Review like a skeptic

Questions to ask of every generated diff:
- What happens on empty input? On a 10 MB file? With a non-ASCII URL?
- Are there timeouts on every network call? Are exceptions swallowed silently?
- Is anything hard-coded that should be configurable?
- Did it invent an API that doesn't exist? (Check the library docs. Hallucinated methods are common.)

> [!tip] Keep the AI on a short leash in unfamiliar territory
> When you're learning a library, ask it to *cite the documentation section* for each API it uses, then open those docs. You learn faster, and you catch hallucinations.

> [!recap]
> - Spec → plan → small slices with tests → review → commit.
> - Dependency injection (passing in clients) makes AI-written code testable.

# Lesson: Evaluating and testing AI-generated code (30 min)

The most reliable defence against subtly wrong code is **tests you understand**. Three layers:

### 1. Example-based unit tests (pytest)

```python norun
# test_slug.py: run with:  pytest -q
from slug import slugify

def test_basic():
    assert slugify("Hello World") == "hello-world"

def test_punctuation_and_spaces():
    assert slugify("  AeroBook 15 Pro! ") == "aerobook-15-pro"

def test_empty():
    assert slugify("") == ""
```

### 2. Property-based thinking

Instead of single examples, assert **properties** that must hold for *any* input, then throw lots of inputs at the code. (The `hypothesis` library automates this.)

```python
import random, re, string

def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")

random.seed(0)
alphabet = string.ascii_letters + string.digits + " !?-_.,"
for _ in range(2000):
    s = "".join(random.choice(alphabet) for _ in range(random.randint(0, 30)))
    out = slugify(s)
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*|", out), (s, out)   # only valid slug chars
    assert slugify(out) == out, (s, out)                               # idempotent
print("2000 random inputs: all properties hold")
```

Good properties: **idempotence** (doing it twice equals doing it once), **round-trips** (`decode(encode(x)) == x`), **invariants** (a sorted output has the same elements as the input), and comparison against a slow-but-obviously-correct reference implementation.

### 3. Differential testing against a reference

```python
import random

def fast_median(xs):                      # pretend an AI wrote this
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

import statistics
random.seed(1)
for _ in range(1000):
    xs = [random.randint(-50, 50) for _ in range(random.randint(1, 15))]
    assert fast_median(xs) == statistics.median(xs), xs
print("matches statistics.median on 1000 random lists")
```

### A checklist for generated code

| Check | Why |
|---|---|
| Runs the tests you wrote yourself | The AI's tests may share its blind spots |
| Handles empty, huge and malformed input | The usual failure points |
| No secrets in code, no `eval` on input, parameterized SQL | Security |
| Dependencies are real and pinned | Hallucinated or typo-squatted packages are a supply-chain risk |
| You can explain every line | Otherwise you can't maintain it |

> [!connect] The same idea at a larger scale
> Evaluating *LLM outputs* (not just LLM-written code) with datasets and automated checks is a core topic in Agentic week 5 and Full-Stack week 11.

> [!recap]
> - Write your own tests: examples, then properties, then differential checks against a reference.
> - Review for edge cases, security and hallucinated APIs.

# Lesson: Pair programming with AI: habits that scale (20 min)

Roles from classic pair programming map well onto working with AI:

- **You are the navigator.** You own the goal, the design and quality decisions.
- **The AI is the driver.** It types fast, suggests options and knows many APIs.

Habits of effective AI-assisted developers:

1. **Keep context tight and relevant.** Give it the files that matter, not the whole repo dump. Start a fresh conversation when the topic changes.
2. **Ask "why" and "what could go wrong?"** The AI is an excellent tutor when you ask it to explain trade-offs.
3. **Make it critique itself:** "Review this function for bugs and edge cases before I run it."
4. **Use it for drudgery, think for yourself on design.** Boilerplate, regexes, test scaffolds and docstrings are perfect for AI. Architecture and naming deserve your judgment.
5. **Never paste secrets** (API keys, customer data) into prompts unless your organization's policy explicitly allows that tool.
6. **Learn deliberately.** For things you need to *know* (this bootcamp!), first try it yourself, then compare with the AI's version. Outsourcing the struggle outsources the learning.

> [!important] The learning paradox
> AI help makes you faster today, and can make you weaker tomorrow if it replaces practice. In this app, do the exercises yourself first. Use AI afterwards to review your solution or explain the official one.

> [!recap]
> - You navigate, the AI drives. Keep context focused and ask for critiques.
> - Protect secrets. Struggle first when the goal is learning.

# Quiz

## In the walkthrough, why ask the AI for a plan and its questions before any code?
- [ ] It saves tokens
- [x] To surface ambiguities in the spec and agree on a design before code exists
- [ ] AI can't write code without a plan
- [ ] Plans are required by Python
> Fixing a misunderstanding in the plan is far cheaper than in 300 lines of code.

## Why pass the HTTP client into `check(url, client)` instead of creating it inside?
- [ ] It's faster
- [x] So tests can pass in a fake client and run without the network (dependency injection)
- [ ] httpx requires it
- [ ] To use less memory
> Injected dependencies make code testable and flexible.

## Which of these is a good *property* to test for a `slugify` function?
- [ ] slugify("Hello") == "hello"
- [x] slugify(slugify(s)) == slugify(s) for any s
- [ ] slugify runs in under 1 ms
- [ ] slugify returns a string
> Idempotence must hold for every input. The first option is just a single example.

## What is differential testing?
- [x] Comparing an implementation's outputs to a trusted reference implementation on many inputs
- [ ] Testing only the differences in a git diff
- [ ] Testing with different Python versions
- [ ] Measuring performance differences
> If both agree on thousands of random inputs, you gain confidence.

## An AI suggests `import fastjsonx` for speed. What should you do first?
- [ ] Install it immediately
- [x] Verify the package exists, is reputable and is maintained; hallucinated or typo-squatted names are a real risk
- [ ] Rename it to json
- [ ] Ignore all imports
> Package hallucination can lead to installing malicious look-alike packages.

## Which use of AI best supports *learning* a new concept?
- [ ] Copy the AI's solution without reading it
- [x] Attempt it yourself first, then ask the AI to review or explain alternatives
- [ ] Ask the AI to do all the exercises
- [ ] Avoid AI entirely, forever
> Productive struggle builds skill, and AI review then deepens it.

# Exercise: Find the bug the AI missed

The function below was "AI-generated" to split a list into `n` nearly equal chunks, and its own tests passed. Write property-based checks to find inputs where it fails, then fix it. Requirements: return exactly `n` chunks (some may be empty when `len(items) < n`), the chunks concatenated must equal the original list, and chunk sizes differ by at most 1.

## Starter

```python
def chunk(items, n):
    size = len(items) // n
    return [items[i * size:(i + 1) * size] for i in range(n)]

print(chunk(list(range(10)), 3))   # looks fine?
```

## Tests

```python
ns = load()
chunk = ns["chunk"]
import random
random.seed(5)
for _ in range(500):
    L = list(range(random.randint(0, 40)))
    n = random.randint(1, 9)
    parts = chunk(L, n)
    assert len(parts) == n, (len(L), n, parts)
    assert [x for p in parts for x in p] == L, (len(L), n)
    sizes = [len(p) for p in parts]
    assert max(sizes) - min(sizes) <= 1, (len(L), n, sizes)
```

## Hint

Try `chunk(list(range(10)), 3)`. Where is element 9? The integer division throws the remainder away. Give the first `len(items) % n` chunks one extra element.

## Solution

```python
def chunk(items, n):
    q, r = divmod(len(items), n)
    out, start = [], 0
    for i in range(n):
        size = q + (1 if i < r else 0)
        out.append(items[start:start + size])
        start += size
    return out

print(chunk(list(range(10)), 3))   # [[0,1,2,3],[4,5,6],[7,8,9]]
```

The original bug silently dropped the remainder. Example tests like `chunk([1,2,3,4], 2)` pass, because 4 divides evenly. Properties catch what examples miss.

# Project: Python capstone: Study-Buddy CLI with an optional LLM

Build a command-line **flashcard and quiz tool** for any subject (for example these bootcamps), using everything you've learned.

**Core (no AI required):**
- Decks stored as JSON; cards with question, answer and tags.
- Spaced-repetition scheduling (Leitner boxes or SM-2 style): cards you get wrong come back sooner.
- Commands: `add`, `import` (CSV), `study` (an interactive session), `stats` (accuracy per tag, streak).
- OOP design (`Card`, `Deck`, `Scheduler`, `Storage`), custom exceptions and pytest tests (including property tests for the scheduler).

**AI extension (optional but recommended):**
- `generate --from notes.md`: send a Markdown file to an LLM API and ask for **JSON** flashcards matching a schema. Validate the result: reject malformed cards and never trust the model blindly.
- Read the API key from an environment variable. Handle timeouts, rate limits (429) and invalid JSON gracefully.
- Write a short `EVALUATION.md`: generate cards from 3 different notes and rate 20 of them by hand. What percentage were correct and useful? What failure patterns did you see?

## Milestones

- [ ] Spec and README draft: commands, data format, scheduling rule
- [ ] Models and storage with tests
- [ ] Scheduler (spaced repetition) with property-based tests
- [ ] Interactive `study` command and `stats`
- [ ] CSV import with validation
- [ ] (AI) `generate` command with schema validation, env-var key, timeouts and retries
- [ ] (AI) EVALUATION.md with a manual quality review of 20 generated cards
- [ ] Final polish: README with a demo, at least 15 tests passing, pushed to GitHub

## Rubric

| Criterion | Weight |
|---|---|
| Works end to end, data persists, scheduling is correct | 30% |
| Design: separation of models, scheduling, storage, CLI, AI client | 20% |
| Tests (including properties) and robustness | 20% |
| AI integration done safely (validation, errors, secrets) or a strong core-only version | 15% |
| README, commits and the evaluation write-up | 15% |

# Sources

- [pytest documentation](https://docs.pytest.org/)
- [Hypothesis: property-based testing for Python](https://hypothesis.readthedocs.io/)
- [GitHub Copilot docs: best practices for using Copilot](https://docs.github.com/en/copilot/using-github-copilot/best-practices-for-using-github-copilot)
- [Anthropic: Claude Code best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [OWASP: Top 10 for LLM Applications (supply chain, insecure output handling)](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Leitner system (spaced repetition) overview](https://en.wikipedia.org/wiki/Leitner_system)
