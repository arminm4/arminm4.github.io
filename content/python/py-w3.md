---
id: py-w3
title: Dictionaries & Functions
week: Week 3
summary: Dictionaries and hashing, nested data with copy and deepcopy, writing functions, scope, built-in functions and every kind of argument.
builds_on: py-w2
leads_to: py-x, py-w4, f-pydata, f-js
---

Dictionaries are the most important data structure in Python. JSON, database rows, configuration, API responses and even objects' attributes are all dicts underneath. Functions are the most important tool for **organizing** code. This week you master both.

# Lesson: Dictionaries: key → value lookup (30 min)

A **dict** maps unique, hashable **keys** to **values**. Lookup by key is $O(1)$ on average, thanks to the same hash table that makes sets fast.

```python
prices = {"apple": 1.2, "bread": 2.5}
prices["milk"] = 1.1                 # add or update
print(prices["bread"])               # KeyError if missing!
print(prices.get("cheese"))          # None if missing
print(prices.get("cheese", 0.0))     # default value
print("apple" in prices, len(prices))
del prices["apple"]
print(prices)
```

### Iterating

```python
stock = {"pen": 10, "book": 0, "bag": 4}
for item in stock:                    # iterates over keys
    print(item)
for item, qty in stock.items():       # key-value pairs
    print(f"{item}: {qty}")
print(list(stock.keys()), list(stock.values()))
in_stock = {k: v for k, v in stock.items() if v > 0}   # dict comprehension
print(in_stock)
```

Since Python 3.7, dicts **preserve insertion order**.

### Counting and grouping: the two classic patterns

```python
words = "the cat and the hat and the bat".split()

counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
print(counts)

by_first_letter = {}
for w in words:
    by_first_letter.setdefault(w[0], []).append(w)
print(by_first_letter)

from collections import Counter, defaultdict
print(Counter(words).most_common(2))
groups = defaultdict(list)
for w in words:
    groups[len(w)].append(w)
print(dict(groups))
```

### Nested data: how JSON looks in Python

```python
user = {
    "id": 7,
    "name": "Sara",
    "skills": ["python", "sql"],
    "address": {"city": "Tehran", "zip": "12345"},
}
print(user["address"]["city"], user["skills"][-1])
user["skills"].append("docker")
print(user)
```

> [!connect] Dicts everywhere
> API responses (`response.json()`), pandas rows, LLM tool-call arguments and Kubernetes manifests (YAML) are all nested dicts and lists. If you can navigate them confidently, a large share of real-world code becomes easy.

> [!recap]
> - `d[key]` raises `KeyError`, while `d.get(key, default)` doesn't.
> - Iterate with `.items()`, and build dicts with comprehensions.
> - Counting: `get(k, 0) + 1` or `Counter`. Grouping: `setdefault` or `defaultdict(list)`.

# Lesson: Copying nested data: copy vs deepcopy (15 min)

Last week you saw aliasing with lists. Nested structures add another layer:

```python
import copy
original = {"name": "Sara", "skills": ["python"]}

alias = original                    # same object
shallow = original.copy()           # new outer dict, SAME inner list
deep = copy.deepcopy(original)      # new everything, recursively

original["skills"].append("sql")
print(alias["skills"])    # ['python', 'sql']
print(shallow["skills"])  # ['python', 'sql']  <- surprise for most people
print(deep["skills"])     # ['python']
```

| Operation | Outer container | Inner objects |
|---|---|---|
| `b = a` | shared | shared |
| `b = a.copy()` / `copy.copy(a)` | new | **shared** |
| `b = copy.deepcopy(a)` | new | new (recursively) |

> [!tip] When does it matter?
> Use deepcopy when you want to modify a nested structure, like a config or a game board, without affecting the original. Many bugs of the form "why did my default settings change?" come from shallow copies.

> [!recap]
> - A shallow copy duplicates only the top level.
> - `copy.deepcopy` duplicates everything inside.

# Lesson: Writing functions (25 min)

A **function** packages a piece of logic under a name. Good functions do **one thing**, have a clear name, take inputs as parameters and return a result.

```python
def bmi(weight_kg, height_m):
    """Return the body-mass index (kg/m²)."""
    return weight_kg / height_m ** 2

result = bmi(70, 1.75)
print(round(result, 1))
help(bmi)
```

- `def name(parameters):` followed by an indented body.
- `return` sends a value back and ends the function. With no `return`, the function returns `None`.
- The first string in the body is the **docstring**, which tools and `help()` display.

### Why functions?

1. **Reuse**: write it once, call it everywhere.
2. **Abstraction**: callers need to know *what* it does, not *how*.
3. **Testing**: a small function with inputs and outputs is easy to check. The exercises in this app test your functions exactly this way.

### Scope: where names live

Names assigned inside a function are **local**: they exist only during that call. Python looks names up in the order **L**ocal → **E**nclosing → **G**lobal → **B**uilt-in (LEGB).

```python
rate = 0.09            # global

def with_tax(price):
    total = price * (1 + rate)   # reads global 'rate'
    return total

print(with_tax(100))
# print(total)  -> NameError: 'total' is local to the function
```

> [!warning] Avoid modifying globals
> Pass data in as parameters and return results. Functions that secretly change global state are hard to test and reason about. If you truly need it, Python requires `global name`, and that's a hint it's usually a bad idea.

### Returning several values

```python
def min_max_mean(values):
    return min(values), max(values), sum(values) / len(values)   # a tuple

lo, hi, avg = min_max_mean([4, 8, 15, 16, 23, 42])
print(lo, hi, round(avg, 2))
```

> [!recap]
> - Functions take parameters and return values. A missing `return` means `None`.
> - Local scope and the LEGB rule. Don't mutate globals.
> - Return tuples to give back several values.

# Lesson: Arguments in depth and built-in functions (30 min)

### Positional, keyword and default arguments

```python
def greet(name, greeting="Hello", punctuation="!"):
    return f"{greeting}, {name}{punctuation}"

print(greet("Sara"))
print(greet("Sara", "Hi"))
print(greet("Sara", punctuation="?"))           # keyword argument: skip middle ones
print(greet(greeting="Salam", name="Ali"))      # any order with keywords
```

### `*args` and `**kwargs`

```python
def greet(name, greeting="Hello", punctuation="!"):
    return f"{greeting}, {name}{punctuation}"

def total(*numbers):              # any number of positional args -> tuple
    return sum(numbers)

def make_tag(tag, text, **attrs):  # any keyword args -> dict
    a = "".join(f' {k}="{v}"' for k, v in attrs.items())
    return f"<{tag}{a}>{text}</{tag}>"

print(total(1, 2, 3, 4))
print(make_tag("a", "docs", href="https://python.org", target="_blank"))

nums = [5, 6, 7]
opts = {"greeting": "Hey", "punctuation": "."}
print(total(*nums), greet("Noor", **opts))      # unpacking into a call
```

Keyword-only parameters come after `*`: `def connect(host, *, timeout=10)` forces callers to write `timeout=...` explicitly, which makes the call readable.

> [!mistake] The mutable default trap
> ```python norun
> def add_item(item, basket=[]):   # the SAME list is reused across calls!
>     basket.append(item)
>     return basket
> ```
> Default values are evaluated **once**, when the function is defined. Use `basket=None`, then write `if basket is None: basket = []` inside the function.

```python
def add_item_bad(item, basket=[]):
    basket.append(item); return basket
print(add_item_bad("a"), add_item_bad("b"))   # ['a', 'b'] ['a', 'b'] !

def add_item(item, basket=None):
    if basket is None:
        basket = []
    basket.append(item); return basket
print(add_item("a"), add_item("b"))
```

### Built-in functions worth knowing cold

```python
data = [3, -1, 4, -1, 5, 9]
print(len(data), sum(data), min(data), max(data), abs(-7), round(3.14159, 2))
print(sorted(data, reverse=True), sorted(["bb", "a", "ccc"], key=len))
print(any(x < 0 for x in data), all(x < 10 for x in data))
print(list(map(abs, data)), list(filter(lambda x: x > 0, data)))
print(list(zip("abc", [1, 2, 3])), list(enumerate("xy")))
print(divmod(17, 5), pow(2, 10), isinstance(3.0, float))
students = [("Sara", 91), ("Liam", 78), ("Noor", 85)]
print(max(students, key=lambda s: s[1]))
```

`lambda args: expression` is a tiny anonymous function. It's handy as a `key=` for sorting, `max`, `min` and grouping.

> [!recap]
> - Positional, keyword and default arguments; `*args` and `**kwargs`; `*`/`**` unpacking in calls.
> - Never use a mutable default argument.
> - Know `sorted(key=)`, `any`, `all`, `map`, `filter`, `zip`, `enumerate` and `lambda`.

# Quiz

## What does `{"a": 1}.get("b", 0)` return?
- [ ] KeyError
- [ ] None
- [x] 0
- [ ] "b"
> `get` returns the default when the key is missing.

## After `b = a.copy()` where `a = {"tags": ["x"]}`, you run `a["tags"].append("y")`. What is `b["tags"]`?
- [ ] ["x"]
- [x] ["x", "y"]
- [ ] Error
- [ ] []
> A shallow copy shares the inner list. Use `copy.deepcopy` for independent nested data.

## What does a function without a `return` statement return?
- [ ] 0
- [ ] An empty string
- [x] None
- [ ] The last computed value
> Python functions implicitly return `None`.

## What is wrong with `def f(x, items=[]):`?
- [ ] Default values must be numbers
- [x] The same list is shared across all calls that use the default
- [ ] Lists can't be parameters
- [ ] Nothing
> Defaults are evaluated once at definition time. Use `None` as the default and create the list inside.

## Inside `def f(*args, **kwargs)`, what are `args` and `kwargs`?
- [x] A tuple of positional arguments and a dict of keyword arguments
- [ ] Two lists
- [ ] A dict and a tuple
- [ ] Strings
> `*` collects positional arguments into a tuple, and `**` collects keyword arguments into a dict.

## Which expression sorts a list of (name, score) tuples by score, highest first?
- [ ] `sorted(students)`
- [x] `sorted(students, key=lambda s: s[1], reverse=True)`
- [ ] `students.sort(1)`
- [ ] `sorted(students, reverse=1)`
> `key` extracts the sort value, and `reverse=True` gives descending order.

## Which is the most idiomatic way to count occurrences of items in a list?
- [ ] Nested for-loops
- [x] `collections.Counter(items)`
- [ ] `items.count()` on each item in a loop
- [ ] `set(items)`
> `Counter` is a dict subclass built for counting, and it has `.most_common(n)`.

## Why are dict lookups fast?
- [ ] Dicts are sorted
- [x] Keys are hashed to compute where the value is stored, which is O(1) on average
- [ ] Python caches all dicts
- [ ] Dicts are stored on disk
> The same hash-table idea makes sets fast.

# Exercise: Gradebook statistics

Write `report(grades)` where `grades` is a dict mapping each student name to a list of scores. Return a new dict mapping each name to a dict with `avg` (rounded to 1 decimal), `best` and `passed` (True if `avg >= 60`). Students with no scores get `avg` 0, `best` None and `passed` False. **Don't modify the input.**

## Starter

```python
def report(grades):
    pass

print(report({"Sara": [90, 85, 77], "Liam": [55, 61], "Noor": []}))
```

## Tests

```python
ns = load()
g = {"Sara": [90, 85, 77], "Liam": [55, 61], "Noor": []}
r = ns["report"](g)
assert r["Sara"] == {"avg": 84.0, "best": 90, "passed": True}, r["Sara"]
assert r["Liam"] == {"avg": 58.0, "best": 61, "passed": False}, r["Liam"]
assert r["Noor"] == {"avg": 0, "best": None, "passed": False}, r["Noor"]
assert g == {"Sara": [90, 85, 77], "Liam": [55, 61], "Noor": []}, "input was modified"
```

## Solution

```python
def report(grades):
    out = {}
    for name, scores in grades.items():
        if not scores:
            out[name] = {"avg": 0, "best": None, "passed": False}
            continue
        avg = round(sum(scores) / len(scores), 1)
        out[name] = {"avg": avg, "best": max(scores), "passed": avg >= 60}
    return out

print(report({"Sara": [90, 85, 77], "Liam": [55, 61], "Noor": []}))
```

# Exercise: Invert an index

You have a dict mapping documents to their tags: `{"doc1": ["python", "ai"], "doc2": ["ai"], ...}`. Write `invert(index)` that returns a dict mapping **each tag to a sorted list of documents**. This "inverted index" is how search engines and keyword search (BM25, Agentic week 2) find documents by word.

## Starter

```python
def invert(index):
    pass

print(invert({"doc1": ["python", "ai"], "doc2": ["ai"], "doc3": ["sql", "python"]}))
```

## Tests

```python
ns = load()
r = ns["invert"]({"doc1": ["python", "ai"], "doc2": ["ai"], "doc3": ["sql", "python"]})
assert r == {"python": ["doc1", "doc3"], "ai": ["doc1", "doc2"], "sql": ["doc3"]}, r
assert ns["invert"]({}) == {}
assert ns["invert"]({"d": ["x", "x"]}) == {"x": ["d"]}, "no duplicates"
```

## Solution

```python
from collections import defaultdict

def invert(index):
    inv = defaultdict(set)
    for doc, tags in index.items():
        for tag in tags:
            inv[tag].add(doc)
    return {tag: sorted(docs) for tag, docs in inv.items()}
```

Using a `set` while building the index removes duplicates automatically.

# Sources

- [Python Tutorial: Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
- [Python Tutorial: Defining Functions and More on Defining Functions](https://docs.python.org/3/tutorial/controlflow.html#defining-functions)
- [Python docs: Built-in Functions](https://docs.python.org/3/library/functions.html)
- [Python docs: copy (shallow and deep copy operations)](https://docs.python.org/3/library/copy.html)
- [Python docs: collections (Counter, defaultdict)](https://docs.python.org/3/library/collections.html)
