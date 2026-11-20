---
id: py-w4
title: Advanced Functions & Intro to OOP
week: Week 4
summary: Iterators and generators, closures and decorators, recursion, and the core ideas of object-oriented programming.
builds_on: py-w3
leads_to: py-w5, fs-w3, ag-w3
---

This week you'll learn to treat functions as **values**: functions can be passed around, returned and wrapped. You'll also learn to produce data **lazily** with generators, and to solve problems by **recursion**. Then you'll take a first look at object-oriented programming, which week 5 develops fully. These ideas are everywhere in professional code: FastAPI uses decorators for routes, PyTorch uses classes for models, and LLM SDKs stream responses through generators.

# Lesson: Iterators and generators (30 min)

### The iteration protocol

`for x in thing` works on any **iterable**. Under the hood, Python calls `iter(thing)` to get an **iterator**, then calls `next()` on it repeatedly until it raises `StopIteration`.

```python
it = iter([10, 20, 30])
print(next(it), next(it), next(it))
# next(it) -> StopIteration
```

### Generators: functions that pause

A function containing `yield` is a **generator function**. Calling it doesn't run the body. Instead it returns a generator that produces values **one at a time, on demand**, pausing at each `yield`.

```python
def countdown(n):
    print("start")
    while n > 0:
        yield n          # pause here, hand out n
        n -= 1
    print("done")

g = countdown(3)
print(next(g))           # runs until the first yield
for value in g:          # continues from where it paused
    print(value)
```

### Why lazy matters

```python
def read_big_numbers(limit):
    for i in range(limit):     # imagine lines of a 10 GB file
        yield i * i

total = sum(x for x in read_big_numbers(1_000_000) if x % 3 == 0)
print(total)
```

The whole pipeline handles one item at a time, so memory stays constant however much data flows through. `(x for x in ...)` with parentheses is a **generator expression**: a lazy list comprehension.

```python
import sys
print(sys.getsizeof([x * x for x in range(100_000)]), "bytes (list)")
print(sys.getsizeof((x * x for x in range(100_000))), "bytes (generator)")
```

### Infinite sequences and pipelines

```python
import itertools

def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

print(list(itertools.islice(fibonacci(), 12)))
evens = (f for f in fibonacci() if f % 2 == 0)
print(list(itertools.islice(evens, 5)))
```

> [!connect] Streaming LLM output
> When an LLM streams tokens, client SDKs give you an iterator: `for chunk in stream: print(chunk.text, end="")`. The FastAPI backend in Full-Stack week 2 *yields* chunks to the browser in the same way. It's this exact concept.

> [!recap]
> - Iterables give you iterators, and `next()` keeps producing items until `StopIteration`.
> - `yield` makes a generator: a lazy, pausable function.
> - Generator expressions `( ... )` stream data in constant memory.

# Lesson: Closures and decorators (30 min)

### Functions are objects

```python
def shout(text): return text.upper() + "!"
def whisper(text): return text.lower() + "..."

def speak(fn, text):           # a function that takes a function
    return fn(text)

print(speak(shout, "hello"), speak(whisper, "HELLO"))
```

### Closures: functions that remember

An inner function can use variables from the enclosing function, even after the outer function has returned:

```python
def make_multiplier(factor):
    def multiply(x):
        return x * factor      # 'factor' is remembered (closed over)
    return multiply

double, triple = make_multiplier(2), make_multiplier(3)
print(double(5), triple(5))
```

### Decorators: wrapping behaviour around functions

A **decorator** takes a function and returns an enhanced version of it. `@decorator` above a `def` is shorthand for `func = decorator(func)`.

```python
import time, functools

def timed(fn):
    @functools.wraps(fn)                 # keep the original name and docstring
    def wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} took {(time.perf_counter() - t0) * 1000:.2f} ms")
        return result
    return wrapper

@timed
def slow_sum(n):
    return sum(range(n))

print(slow_sum(1_000_000))
```

### Decorators with arguments, and caching

```python
import functools

def retry(times):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return fn(*args, **kwargs)
                except ValueError as e:
                    print(f"attempt {attempt} failed: {e}")
            raise RuntimeError("all retries failed")
        return wrapper
    return decorator

calls = {"n": 0}
@retry(times=3)
def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ValueError("temporary glitch")
    return "success"

print(flaky())

@functools.lru_cache(maxsize=None)     # memoization: remember previous results
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
print(fib(80))
```

> [!connect] You'll see decorators everywhere
> `@app.get("/orders")` in FastAPI (Full-Stack week 3), `@tool` in LangChain (Agentic week 1), `@pytest.fixture`, `@property` and `@dataclass` (next week). Retry with backoff is a core reliability pattern (Full-Stack week 10).

> [!recap]
> - Functions are values that you can pass, return and store.
> - Closures remember their enclosing variables.
> - Decorators wrap functions to add behaviour. Always use `functools.wraps`.

# Lesson: Recursion (25 min)

A **recursive** function calls itself on a smaller version of the problem. Every recursion needs:

1. A **base case** that's answered directly, which stops the recursion.
2. A **recursive case** that shrinks the problem toward the base case.

```python
def factorial(n):
    if n <= 1:                 # base case
        return 1
    return n * factorial(n - 1)   # recursive case

print(factorial(5))
```

How it runs: `factorial(3)` → `3 * factorial(2)` → `3 * (2 * factorial(1))` → `3 * 2 * 1`. Each pending call waits on the **call stack**.

### Recursion shines on recursive data

Trees and nested structures (file systems, JSON, org charts, HTML) are naturally recursive:

```python
def total_size(node):
    """node is either a file size (int) or a dict of children."""
    if isinstance(node, int):
        return node
    return sum(total_size(child) for child in node.values())

fs = {"docs": {"cv.pdf": 120, "notes": {"a.md": 4, "b.md": 6}}, "song.mp3": 5000}
print(total_size(fs))

def flatten(items):
    for x in items:
        if isinstance(x, list):
            yield from flatten(x)      # delegate to a recursive generator
        else:
            yield x
print(list(flatten([1, [2, [3, [4]], 5], [[6]]])))
```

### Divide and conquer: binary search

```python
def binary_search(sorted_list, target, lo=0, hi=None):
    if hi is None:
        hi = len(sorted_list) - 1
    if lo > hi:
        return -1                         # base case: not found
    mid = (lo + hi) // 2
    if sorted_list[mid] == target:
        return mid
    if sorted_list[mid] < target:
        return binary_search(sorted_list, target, mid + 1, hi)
    return binary_search(sorted_list, target, lo, mid - 1)

data = list(range(0, 1000, 3))
print(binary_search(data, 699), binary_search(data, 700))
```

> [!warning] Limits
> Python caps recursion depth at about 1000 frames (`RecursionError`), and naive recursion can redo work exponentially (try `fib` without `lru_cache`). For deep or linear problems, a loop is often better. Use recursion when the **structure** is recursive.

> [!recap]
> - Base case + a recursive case that makes the problem smaller.
> - Natural for trees and nested data; `yield from` makes recursive generators.
> - Watch the depth limits and repeated work (memoize).

# Lesson: Thinking in objects (20 min)

So far, data (dicts, lists) and behaviour (functions) have lived separately. **Object-oriented programming (OOP)** bundles them together: an **object** holds **state** (attributes) and **behaviour** (methods). A **class** is the blueprint, and objects are **instances** of it.

```python
class BankAccount:
    def __init__(self, owner, balance=0):     # constructor: sets up a new instance
        self.owner = owner                     # attributes live on 'self'
        self.balance = balance

    def deposit(self, amount):                 # method: behaviour that uses state
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.balance += amount
        return self.balance

    def __repr__(self):                        # how it prints
        return f"BankAccount({self.owner!r}, balance={self.balance})"

a = BankAccount("Sara")
b = BankAccount("Liam", 100)
a.deposit(50)
print(a, b)
print(type(a), isinstance(a, BankAccount))
```

`self` is the instance the method was called on. `a.deposit(50)` is really `BankAccount.deposit(a, 50)`.

### The four pillars (you'll go deeper next week)

| Pillar | Idea | Example |
|---|---|---|
| **Encapsulation** | Keep state and the rules that protect it together | `deposit` refuses negative amounts |
| **Abstraction** | Expose *what*, hide *how* | You call `.deposit()`, not edit `balance` directly |
| **Inheritance** | Build specialized classes from general ones | `SavingsAccount(BankAccount)` |
| **Polymorphism** | Different classes, same interface | Any `Shape` has `.area()` |

> [!intuition] You've been using objects all along
> `"hi".upper()`, `[1, 2].append(3)` and `{}.get(...)` are all method calls on objects. Classes let you create your own types, like `Order`, `Agent` or `NeuralNet`, that are as natural to use as the built-in ones.

> [!recap]
> - A class is a blueprint, an object is an instance, and `__init__` sets up its state.
> - Methods receive `self`. `__repr__` controls how an object prints.
> - The four pillars: encapsulation, abstraction, inheritance, polymorphism.

# Quiz

## What does calling a generator function (one that contains `yield`) return?
- [ ] The first yielded value
- [ ] A list of all values
- [x] A generator object; the body runs only when you iterate
- [ ] None
> Generators are lazy. Execution starts and pauses with each `next()`.

## Why prefer `sum(x*x for x in data)` over `sum([x*x for x in data])` for huge data?
- [ ] It gives a different result
- [x] The generator expression doesn't build the whole list in memory
- [ ] Lists can't be summed
- [ ] It's required by Python
> Generators stream items one at a time, in constant memory.

## What does this print?
```python norun
def make(n):
    def f(x): return x + n
    return f
print(make(10)(5))
```
- [ ] 10
- [x] 15
- [ ] 5
- [ ] Error
> `f` is a closure that remembers `n = 10`.

## `@timed` above `def work():` is equivalent to:
- [ ] `timed = work(timed)`
- [x] `work = timed(work)`
- [ ] `work.timed()`
- [ ] `timed()` is called each time Python starts
> Decorator syntax is just rebinding the name to the wrapped function.

## Why use `functools.wraps` inside a decorator?
- [ ] It makes the function faster
- [x] It preserves the original function's name, docstring and metadata
- [ ] It's required for decorators to work
- [ ] It enables caching
> Without it, every decorated function would appear to be named "wrapper".

## What are the two required parts of a recursive function?
- [x] A base case and a recursive step toward it
- [ ] A loop and a return
- [ ] A global variable and a counter
- [ ] Two parameters
> Without a reachable base case, recursion never stops (RecursionError).

## In `a.deposit(50)`, what is `self` inside `deposit`?
- [ ] The class BankAccount
- [x] The instance `a`
- [ ] The number 50
- [ ] Nothing
> Python passes the instance automatically as the first argument.

# Exercise: Batching generator

Write a generator `batched(iterable, size)` that yields lists of up to `size` items. For example, `batched(range(7), 3)` yields `[0, 1, 2]`, `[3, 4, 5]`, `[6]`. It must work on **any iterable**, including another generator, without converting it to a list first. You'll use this pattern to send embeddings to an API in batches (Agentic week 2).

## Starter

```python
def batched(iterable, size):
    pass

for b in batched(range(7), 3):
    print(b)
```

## Tests

```python
ns = load()
b = ns["batched"]
assert list(b(range(7), 3)) == [[0, 1, 2], [3, 4, 5], [6]]
assert list(b([], 2)) == []
assert list(b((x * x for x in range(4)), 2)) == [[0, 1], [4, 9]]
import types
assert isinstance(b(range(3), 2), types.GeneratorType), "use yield"
```

## Hint

Keep a `batch = []`. Append each item, and when `len(batch) == size`, `yield batch` and start a new list. After the loop, yield what's left (if anything).

## Solution

```python
def batched(iterable, size):
    batch = []
    for item in iterable:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch

for b in batched(range(7), 3):
    print(b)
```

Python 3.12 added `itertools.batched`, which yields tuples.

# Exercise: Memoizing decorator from scratch

Write a decorator `memoize` (without using `functools.lru_cache`) that caches results by positional arguments. Also give the wrapper a `.calls` attribute that counts how many times the **original** function actually ran.

## Starter

```python
import functools

def memoize(fn):
    pass

@memoize
def slow_square(x):
    return x * x

print(slow_square(4), slow_square(4), slow_square.calls)
```

## Tests

```python
ns = load()
memoize = ns["memoize"]

@memoize
def sq(x):
    return x * x
assert sq(3) == 9 and sq(3) == 9 and sq(4) == 16
assert sq.calls == 2, sq.calls
assert sq.__name__ == "sq", "use functools.wraps"

@memoize
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
assert fib(60) == 1548008755920
assert fib.calls == 61
```

## Solution

```python
import functools

def memoize(fn):
    cache = {}

    @functools.wraps(fn)
    def wrapper(*args):
        if args not in cache:
            wrapper.calls += 1
            cache[args] = fn(*args)
        return cache[args]

    wrapper.calls = 0
    return wrapper
```

`args` is a tuple, which is hashable, so it works as a dict key. A list would not.

# Sources

- [Python HOWTO: Functional Programming (iterators, generators)](https://docs.python.org/3/howto/functional.html)
- [Python Tutorial: Classes](https://docs.python.org/3/tutorial/classes.html)
- [Python docs: functools (wraps, lru_cache)](https://docs.python.org/3/library/functools.html)
- [Real Python: Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/)
- *Fluent Python, 2nd ed.*, chapters 9 (decorators & closures) and 17 (iterators & generators)
