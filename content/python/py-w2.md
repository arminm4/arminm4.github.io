---
id: py-w2
title: Data Structures & Flow Control
week: Week 2
summary: while loops, string methods, and Python's core collections (list, tuple, set), including mutability, slicing and choosing the right structure.
builds_on: py-w1
leads_to: py-w3
---

Last week you worked with single values. Real programs work with **collections**: a list of orders, a set of tags, the words in a sentence. This week covers `while` loops, the string toolbox, and three of Python's four core collections. The fourth, `dict`, comes next week.

# Lesson: while loops (20 min)

A `while` loop repeats **as long as** a condition is true. Use it when you don't know in advance how many iterations you'll need.

```python
n = 27
steps = 0
while n != 1:                 # Collatz: nobody has proven this always ends!
    n = n // 2 if n % 2 == 0 else 3 * n + 1
    steps += 1
print("steps:", steps)
```

### Input-validation loop

```python stdin="abc\n-5\n42"
while True:
    text = input("Enter a positive number: ")
    if text.isdigit() and int(text) > 0:
        n = int(text)
        break
    print("Invalid, try again.")
print("Got", n)
```

`while True` + `break` is the standard idiom for "repeat until valid".

> [!mistake] Infinite loops
> If nothing inside the loop changes the condition, it runs forever. Always ask: "what makes this condition eventually false?" (In this app, a stuck program times out after 15 seconds.)

### `for` or `while`?

- **Know the items or the count?** Use `for`: `for item in items`, `for i in range(n)`.
- **Waiting for a condition?** Use `while`: convergence, user input, a game loop, retrying.

> [!recap]
> - `while cond:` repeats until the condition is false. `break` and `continue` work as in `for`.
> - `while True:` + `break` handles "repeat until valid".

# Lesson: Strings in depth (25 min)

A string is an **immutable sequence** of characters. Indexing and slicing work on all sequences (strings, lists, tuples):

```python
s = "Python Bootcamp"
print(s[0], s[-1])        # first, last
print(s[0:6], s[7:])      # slice [start:stop): stop is excluded, like range
print(s[::-1])            # reversed (step -1)
print(len(s), "boot" in s.lower())
```

### Essential string methods

Methods return **new** strings, because strings are immutable.

```python
raw = "  Hello, World!  "
print(repr(raw.strip()))                  # remove surrounding whitespace
print(raw.strip().lower(), raw.upper())
print("a,b,,c".split(","))                # -> list
print(" ".join(["learn", "python", "daily"]))   # list -> string
print("2025-11-20".replace("-", "/"))
print("report.pdf".endswith(".pdf"), "Mr. X".startswith("Mr"))
print("banana".count("a"), "banana".find("na"), "banana".find("x"))
print("42".isdigit(), "abc".isalpha(), "Title Case".istitle())
print("python".capitalize(), "hello world".title())
print(f"{'left':<10}|{'right':>10}|{'mid':^9}|")
```

> [!tip] `split` + `join` is a superpower
> Most text processing is: split into pieces, transform each piece, join back together. `"-".join(w.capitalize() for w in "the quick fox".split())`

### Immutability

```python
s = "cat"
# s[0] = "b"   -> TypeError: 'str' object does not support item assignment
s = "b" + s[1:]   # build a new string instead
print(s)
```

### Characters and encodings

Each character has a Unicode **code point**: `ord("A") == 65` and `chr(1587) == "س"`. Python 3 strings are Unicode, so Persian, emoji and every other script work naturally.

```python
for ch in "Hi سلام 👋":
    print(ch, ord(ch))
```

> [!recap]
> - `s[start:stop:step]` slices any sequence.
> - The core methods are `strip`, `split`, `join`, `replace`, `find`, `startswith` and the `is*` family.
> - Strings are immutable: methods return new strings.

# Lesson: Lists: ordered, mutable sequences (30 min)

```python
scores = [72, 95, 88]
scores.append(60)          # add to the end
scores.insert(0, 100)      # insert at index 0
scores.extend([77, 81])    # add many
print(scores, len(scores))
scores.remove(60)          # remove the first matching value
last = scores.pop()        # remove and return the last item
print(scores, last)
print(sorted(scores), scores)          # sorted() returns a NEW list
scores.sort(reverse=True)              # .sort() sorts IN PLACE and returns None
print(scores, max(scores), min(scores), sum(scores) / len(scores))
```

### Mutability and aliasing: the #1 source of beginner bugs

A list is **mutable**: it can change in place. Assignment binds another *name* to the **same** object:

```python
a = [1, 2, 3]
b = a          # b is another name for the SAME list
b.append(4)
print(a)       # [1, 2, 3, 4]: a changed too!
c = a.copy()   # or list(a) or a[:]: a new list
c.append(5)
print(a, c, a is b, a is c)
```

> [!intuition] Names and objects
> Picture labels on boxes. `b = a` puts a second label on the same box. `a.copy()` makes a new box. The operator `is` checks "same box", and `==` checks "same contents".

### List comprehensions

A concise way to build a list from another iterable:

```python
nums = range(1, 11)
squares = [n * n for n in nums]
evens = [n for n in nums if n % 2 == 0]
labels = ["even" if n % 2 == 0 else "odd" for n in nums]
pairs = [(x, y) for x in range(3) for y in range(2)]
print(squares, evens, labels[:3], pairs, sep="\n")
```

### Iterating with an index and in parallel

```python
names = ["Sara", "Liam", "Noor"]
ages = [31, 27, 35]
for i, name in enumerate(names, start=1):
    print(i, name)
for name, age in zip(names, ages):
    print(f"{name} is {age}")
```

### 2-D lists (lists of lists)

```python
grid = [[0] * 3 for _ in range(2)]    # correct way to build a 2x3 grid
grid[0][1] = 9
print(grid)
bad = [[0] * 3] * 2                   # 2 references to the SAME inner list!
bad[0][1] = 9
print(bad)
```

> [!recap]
> - Lists are ordered and mutable: `append`, `insert`, `pop`, `remove`, `sort`.
> - Assignment aliases; use `.copy()` for a new list. `is` vs `==`.
> - Comprehensions, `enumerate` and `zip` make loops cleaner.

# Lesson: Tuples and sets, and choosing a structure (25 min)

### Tuples: immutable sequences

```python
point = (3, 4)
x, y = point                  # unpacking
print(x, y, point[0])
rgb = 255, 128, 0             # parentheses optional
a, b = 1, 2
a, b = b, a                   # swap via tuple packing/unpacking
print(a, b)
first, *rest = [10, 20, 30, 40]
print(first, rest)
```

Use tuples for fixed-size records ("a point", "an RGB color", "(name, age)") and for values that must not change. Because they're immutable (and hashable), tuples can be **dict keys** and **set members**. Lists can't.

### Sets: unique, unordered, fast membership

```python
tags = {"python", "sql", "python", "ai"}
print(tags)                          # duplicates removed; order is arbitrary
tags.add("devops")
print("sql" in tags)                 # very fast, even for millions of items
a = {"python", "sql", "excel"}
b = {"python", "pytorch", "sql"}
print(a & b, a | b, a - b, a ^ b)    # intersection, union, difference, symmetric difference
print(len(set([3, 1, 3, 2, 1])))     # count distinct values
```

> [!important] Why is `in` fast for sets but slow for lists?
> `x in my_list` checks the elements one by one: $O(n)$. A set uses a **hash table**, which computes where `x` would be and looks there directly: $O(1)$ on average. For 1,000,000 lookups in 1,000,000 items, that's the difference between seconds and hours. The same idea powers dicts (next week) and database hash indexes (BI week 2).

```python
import time
n = 50_000
as_list = list(range(n)); as_set = set(as_list)
t = time.perf_counter(); hits = sum(1 for i in range(0, n, 7) if i in as_list); tl = time.perf_counter() - t
t = time.perf_counter(); hits = sum(1 for i in range(0, n, 7) if i in as_set); ts = time.perf_counter() - t
print(f"list: {tl*1000:.1f} ms   set: {ts*1000:.2f} ms")
```

### Which collection when?

| Need | Use |
|---|---|
| Ordered items, may change, duplicates allowed | `list` |
| Fixed record or immutable sequence | `tuple` |
| Unique items, fast membership, set algebra | `set` |
| Look up values by a key | `dict` (next week) |

> [!recap]
> - Tuples are immutable and unpackable, and they can be dict keys.
> - Sets hold unique items, give $O(1)$ membership, and support `& | - ^`.
> - Choose the structure by the operations you need.

# Quiz

## What does `"Python"[1:4]` return?
- [ ] "Pyt"
- [x] "yth"
- [ ] "ytho"
- [ ] "Pyth"
> Indices 1, 2 and 3. The stop index (4) is excluded.

## After `a = [1, 2]; b = a; b.append(3)`, what is `a`?
- [ ] [1, 2]
- [x] [1, 2, 3]
- [ ] [3]
- [ ] Error
> `b` is another name for the same list object. Use `a.copy()` to get an independent list.

## What does `x = [3, 1, 2].sort()` set `x` to?
- [ ] [1, 2, 3]
- [ ] [3, 1, 2]
- [x] None
- [ ] Error
> `.sort()` sorts in place and returns `None`. `sorted(...)` returns a new list.

## Which collection would you use to remove duplicate emails and check membership quickly?
- [ ] list
- [ ] tuple
- [x] set
- [ ] str
> Sets store unique items with O(1) average membership tests.

## What is `{1, 2, 3} & {2, 3, 4}`?
- [x] {2, 3}
- [ ] {1, 2, 3, 4}
- [ ] {1, 4}
- [ ] {1}
> `&` is intersection: the elements in both sets.

## Why can a tuple be a dict key but a list cannot?
- [ ] Tuples are faster
- [x] Tuples are immutable (hashable); a list's hash could change if it were mutated
- [ ] Lists are too long
- [ ] Tuples are always sorted
> Dict keys and set members must be hashable, which requires immutability.

## What does `" ".join(["a", "b", "c"])` produce?
- [ ] ["a b c"]
- [x] "a b c"
- [ ] "abc"
- [ ] "a, b, c"
> `join` is called on the separator and glues the strings together.

## Which loop fits "keep asking until the user types a valid number"?
- [ ] for i in range(10)
- [x] while True with break
- [ ] list comprehension
- [ ] for … else
> The number of attempts is unknown, so `while` with an exit condition fits.

# Exercise: Word frequency (list and set edition)

Read one line of text. Print:
1. The number of words.
2. The number of **distinct** words, ignoring case and stripping the punctuation `.,!?`.
3. The longest word. If several are equally long, print the one that appears first.

## Starter

```python
text = input()

```

## Tests

```python
out = run_program(["The cat and the hat. The END!"]).split("\n")
assert out[0] == "7", out
assert out[1] == "5", "the, cat, and, hat, end"
assert out[2] == "The", "words of length 3 tie: the first one wins"
out = run_program(["Programming is fun, programming is powerful!"]).split("\n")
assert out[:3] == ["6", "4", "Programming"], out
```

## Hint

Clean each word with `w.strip(".,!?")`. Distinct words: `len({w.lower() for w in words})`. Longest: `max(words, key=len)` returns the first maximum. Should "longest" use the cleaned words? Yes. Print it with its original capitalization.

## Solution

```python
text = input()
words = [w.strip(".,!?") for w in text.split()]
words = [w for w in words if w]
print(len(words))
print(len({w.lower() for w in words}))
print(max(words, key=len))
```

# Exercise: Run-length encoding

Compression warm-up. Read a string such as `aaabccdddd` and print its run-length encoding `a3b1c2d4`. Then read a second line containing an encoding and print the decoded string. Counts can have several digits (`x12`).

## Starter

```python
s = input()
encoded = input()

```

## Tests

```python
assert run_program(["aaabccdddd", "a3b1c2d4"]).split() == ["a3b1c2d4", "aaabccdddd"]
assert run_program(["z", "x12"]).split() == ["z1", "x" * 12]
assert run_program(["abab", "a1b1a1b1"]).split() == ["a1b1a1b1", "abab"]
```

## Hint

Encoding: walk the string with a `while` loop and an index `i`. Count how far the same character continues. Decoding: go character by character; when you see a letter, collect the digits that follow (`ch.isdigit()`).

## Solution

```python
s = input()
encoded = input()

out = []
i = 0
while i < len(s):
    j = i
    while j < len(s) and s[j] == s[i]:
        j += 1
    out.append(f"{s[i]}{j - i}")
    i = j
print("".join(out))

decoded = []
i = 0
while i < len(encoded):
    ch = encoded[i]
    i += 1
    digits = ""
    while i < len(encoded) and encoded[i].isdigit():
        digits += encoded[i]
        i += 1
    decoded.append(ch * int(digits))
print("".join(decoded))
```

Building a list of pieces and joining once at the end is faster than repeatedly concatenating strings.

# Sources

- [Python Tutorial: Data Structures (lists, tuples, sets)](https://docs.python.org/3/tutorial/datastructures.html)
- [Python docs: String methods](https://docs.python.org/3/library/stdtypes.html#string-methods)
- [Ned Batchelder: Facts and myths about Python names and values (PyCon talk)](https://nedbatchelder.com/text/names.html)
- [Python Wiki: TimeComplexity (cost of list/set/dict operations)](https://wiki.python.org/moin/TimeComplexity)
- *Fluent Python, 2nd ed.* by Luciano Ramalho, chapter 2 (sequences)
