---
id: py-w1
title: Python Fundamentals
week: Week 1
summary: How Python runs your code, values and types, input/print, conditions and for loops.
builds_on: f-algebra, f-terminal
leads_to: py-w2
---

This week you'll learn the five ideas every program is built from: **values** (data), **names** (variables), **input/output**, **decisions** (`if`) and **repetition** (`for`). Everything later, including machine-learning code, is a combination of these.

> [!tip] Run everything
> Every Python block has a **▶ Run** button, and **Edit** lets you change the code first. Before you press Run, predict what will happen. Each wrong prediction shows you exactly what you haven't understood yet.

# Lesson: What a program is and how Python runs it (15 min)

A **program** is a precise list of instructions that a computer executes in order. A computer does exactly what you write, not what you meant. The art of programming is to describe a solution so precisely that a machine can follow it.

Python is an **interpreted** language. The Python **interpreter** reads your source code (text in a `.py` file), translates it into an internal form called *bytecode*, and executes it **statement by statement, from top to bottom**.

```python
print("Hello, world!")
print("Python runs line by line.")
print(2 + 3)
```

### Three ways to run Python

1. **Interactive mode (the REPL).** Type `python` in a terminal and you get a `>>>` prompt. REPL stands for Read, Evaluate, Print, Loop. It's great for quick experiments.
2. **Scripts.** Save code in `hello.py` and run `python hello.py`. This is how real programs run.
3. **Notebooks and in-browser runners**, like the Run buttons in this app or Jupyter/Colab.

### Comments

Anything after `#` on a line is a **comment**. Python ignores it. Comments explain *why* the code does something; the code itself shows *what* it does.

```python
# Convert minutes to hours (the course uses whole hours)
minutes = 135
print(minutes // 60)  # integer division: 2
```

### Errors are messages, not failures

When Python can't continue, it raises an **exception** and prints a **traceback**. Read a traceback **from the bottom up**: the last line names the error type and gives the message, and the lines above show where it happened.

```python
print("before")
print(10 / 0)
print("after")   # never runs
```

Common errors in your first weeks:

| Error | Typical cause |
|---|---|
| `SyntaxError` | The code isn't valid Python, for example a missing `:` or an unclosed quote |
| `NameError` | You used a name that was never assigned, often a typo |
| `TypeError` | An operation got the wrong kind of value, for example `"3" + 4` |
| `ValueError` | The type is right but the value is wrong, for example `int("abc")` |
| `IndentationError` | Inconsistent spaces at the start of lines |
| `ZeroDivisionError` | Dividing by zero |

> [!important] Indentation is syntax
> Python uses **indentation** (4 spaces by convention) to group statements into blocks. Other languages use `{ }` for this. Indentation is part of the grammar, not just style.

> [!recap]
> - The interpreter runs your file top to bottom, one statement at a time.
> - `#` starts a comment.
> - Read tracebacks bottom-up: error type, then the message, then the line.

# Lesson: Values, types and variables (25 min)

Every piece of data in Python is an **object**, and every object has a **type**. The type decides what operations make sense: you can divide numbers, but not sentences.

| Type | Meaning | Examples |
|---|---|---|
| `int` | Whole numbers, with arbitrary size | `0`, `-7`, `10**100` |
| `float` | Real numbers (64-bit floating point) | `3.14`, `-0.5`, `1e-9` |
| `str` | Text, a sequence of characters | `"hi"`, `'Tehran'`, `"""multi-line"""` |
| `bool` | Truth values | `True`, `False` |
| `NoneType` | "No value" | `None` |

```python
print(type(42), type(3.0), type("42"), type(True), type(None))
```

### Variables are names, not boxes

`x = 5` means: create the object `5` and **bind the name** `x` to it. Assignment never copies anything; it attaches a label. A name can be rebound to any object, even one of another type.

```python
price = 120          # name 'price' -> int object 120
price = price * 1.1  # evaluate right side first, then rebind the name
print(price)
price = "sold out"   # now bound to a str
print(price)
```

> [!intuition] Read `=` as "becomes"
> `count = count + 1` is not an equation, which would be impossible. It means "compute `count + 1`, then let `count` refer to the result."

Naming rules: letters, digits and `_`, and a name can't start with a digit. Names are case-sensitive. By convention Python uses `snake_case`: `total_price`, not `TotalPrice`.

### Arithmetic

```python
a, b = 17, 5
print(a + b, a - b, a * b)
print(a / b)    # true division -> always a float: 3.4
print(a // b)   # floor division -> 3
print(a % b)    # remainder (modulo) -> 2
print(a ** 2)   # power -> 289
print(-17 // 5, -17 % 5)  # floor rounds DOWN: -4 and 3
```

These always satisfy `a == (a // b) * b + a % b`. Modulo has many uses. `n % 2 == 0` tests whether `n` is even. `n % 10` gives the last digit. `minutes % 60` gives the leftover minutes.

Precedence works as in math: `**` first, then `* / // %`, then `+ -`. Use parentheses to make your intent obvious.

### Floats are approximations

```python
print(0.1 + 0.2)
print(0.1 + 0.2 == 0.3)
print(round(0.1 + 0.2, 10) == 0.3)
```

Floats are stored in binary, and most decimal fractions (like 0.1) have no exact binary representation, just as 1/3 has no exact decimal one. **Never compare floats with `==`.** Compare with a tolerance instead (`abs(a - b) < 1e-9`, or `math.isclose`). For money, use whole cents in an `int`, or the `decimal` module.

### Converting between types

```python
print(int("42") + 1)     # str -> int
print(float("2.5") * 2)  # str -> float
print(str(7) + " days")  # int -> str, then concatenation
print(int(3.99))         # truncates toward zero: 3
print(bool(0), bool(""), bool("0"), bool([]))  # "falsy" values
```

> [!mistake] `"3" + 4`
> Python never silently converts `str` to a number. `"3" + 4` raises `TypeError`. Convert explicitly: `int("3") + 4`.

> [!recap]
> - Every value has a type. Use `type()` to check.
> - Variables are names bound to objects, and `=` rebinds a name.
> - `/` always gives a float. `//` and `%` are floor division and remainder.
> - Floats are approximate, so don't test them for exact equality.

# Lesson: Input and output, f-strings (20 min)

### `print`

`print` writes its arguments separated by `sep` (default: a space) and ends with `end` (default: a newline).

```python
print("a", "b", "c")
print("a", "b", "c", sep="-")
print("no newline", end=" | ")
print("same line")
```

### f-strings: the modern way to format

Put `f` before the quotes and expressions inside `{ }`. Everything after a `:` is a **format specification**.

```python
name, score, ratio = "Sara", 93, 0.8567
print(f"{name} scored {score}")
print(f"{ratio:.2f}")        # 2 decimal places -> 0.86
print(f"{ratio:.1%}")        # percentage -> 85.7%
print(f"{1234567:,}")        # thousands separator
print(f"[{name:>8}]")        # right-align in width 8
print(f"[{name:<8}]")        # left-align
print(f"{score=}")           # debugging shortcut -> score=93
```

### `input` always returns a string

`input(prompt)` shows the prompt, waits for a line of text and returns it **as a `str`**. To do arithmetic, convert it.

```python stdin="Ali\n1999"
name = input("Your name: ")
year = int(input("Birth year: "))
print(f"Hi {name}, you'll be {2026 - year} this year.")
```

> [!tip] Program input in this app
> Lines in the **Program input** box are fed to `input()` one per call. Code blocks in lessons come with sample input already filled in.

Reading several numbers from one line is a very common pattern in coding exercises:

```python stdin="3 9 4"
a, b, c = map(int, input().split())
print(a + b + c)
```

`input().split()` splits the line on whitespace into a list of strings, and `map(int, ...)` converts each one. You'll understand lists and `map` fully in weeks 2–3. For now, treat this line as an idiom.

> [!recap]
> - `print(*values, sep=" ", end="\n")`
> - f-strings: `f"{value:.2f}"`, `f"{x:,}"`, `f"{x=}"`
> - `input()` returns `str`. Convert it with `int()` or `float()`.

# Lesson: Making decisions with if/elif/else (25 min)

Programs become interesting when they can choose what to do. A **condition** is any expression that evaluates to `True` or `False`.

### Comparisons and logic

| Operator | Meaning |
|---|---|
| `==`, `!=` | equal, not equal |
| `<`, `<=`, `>`, `>=` | ordering |
| `and`, `or`, `not` | logic |
| `in` | membership: `"a" in "cat"` |

Python allows **chained comparisons**, which read like math: `0 <= x < 10`.

```python stdin="72"
score = int(input())
if score >= 90:
    grade = "A"
elif score >= 75:
    grade = "B"
elif score >= 60:
    grade = "C"
else:
    grade = "F"
print(grade)
```

Python checks the conditions **top to bottom** and runs **only the first** block whose condition is true. So the order matters. If you put `score >= 60` first, every passing score would get a C.

### Truthiness

In a condition, *any* value works. "Empty" or zero-like values are **falsy**: `0`, `0.0`, `""`, `[]`, `{}`, `set()` and `None`. Everything else is **truthy**.

```python
name = ""
if not name:
    print("Name is required")
```

### Short-circuit evaluation

`and` stops at the first falsy operand and `or` stops at the first truthy one. This lets you write safe guards:

```python
d = 0
if d != 0 and 10 / d > 2:   # the division never runs when d == 0
    print("big")
print("safe")
```

### Conditional expression

For a simple choice between two values, there's a one-line form:

```python
age = 20
status = "adult" if age >= 18 else "minor"
print(status)
```

> [!mistake] `if x == 1 or 2:`
> This means `(x == 1) or 2`, and `2` is always truthy, so the condition is always true. Write `if x == 1 or x == 2:` or, better, `if x in (1, 2):`.

> [!connect] Where this goes
> Decision logic like this becomes **classification rules** in BI (CASE WHEN in SQL, BI week 1). Decision **trees** learn these if/else splits automatically from data (AI week 3).

> [!recap]
> - `if / elif / else`: only the first true branch runs.
> - Chained comparisons (`a < b < c`) and `in` keep conditions readable.
> - Empty and zero values are falsy. `and`/`or` short-circuit.

# Lesson: Repetition with for loops and range (25 min)

A `for` loop runs a block once **for each item** in a sequence:

```python
for city in ["Tehran", "Shiraz", "Tabriz"]:
    print("Hello", city)
```

### `range`

`range(stop)`, `range(start, stop)` and `range(start, stop, step)` produce integers from `start` up to, **but not including**, `stop`.

```python
print(list(range(5)))          # 0..4
print(list(range(2, 10, 3)))   # 2, 5, 8
print(list(range(10, 0, -2)))  # counting down
```

> [!intuition] Why exclude `stop`?
> `range(n)` gives exactly `n` numbers, and `range(a, b)` gives `b - a` numbers. Adjacent ranges also fit together without overlap: `range(0, 5)` and `range(5, 10)`.

### The accumulator pattern

Most loops build up a result. Start with an initial value, then update it each time through the loop.

```python
total = 0
for n in range(1, 101):
    total += n           # same as total = total + n
print(total)             # 5050, as Gauss famously computed in his head
```

Other accumulators:

```python
# count, max, and build a string
values = [4, 17, 9, 23, 8]
count_big = 0
biggest = values[0]
text = ""
for v in values:
    if v > 10:
        count_big += 1
    if v > biggest:
        biggest = v
    text += str(v) + ";"
print(count_big, biggest, text)
```

### `break`, `continue` and `for … else`

- `break` leaves the loop immediately.
- `continue` skips the rest of this iteration and moves to the next one.
- The `else` block after a `for` runs only if the loop finished **without** a `break`. This is handy for search loops.

```python
n = 91
for d in range(2, n):
    if n % d == 0:
        print(n, "is divisible by", d)
        break
else:
    print(n, "is prime")
```

### Nested loops

A loop inside a loop runs the inner loop completely for each iteration of the outer one:

```python
for row in range(1, 4):
    line = ""
    for col in range(1, 4):
        line += f"{row * col:4}"
    print(line)
```

> [!connect] Loops and complexity
> Two nested loops over `n` items do `n × n` steps. That's fine for 1,000 items (a million steps) but slow for 1,000,000 items (10¹² steps). You'll see why databases need indexes (BI week 2) and why NumPy vectorizes loops (*Python for Data*).

> [!recap]
> - `for item in sequence:` and `range(start, stop, step)` (stop is excluded).
> - Accumulators: initialize before the loop and update inside it.
> - `break` exits, `continue` skips, and `for … else` detects "not found".

# Quiz

## What does `print(7 // 2, 7 % 2, 7 / 2)` print?
- [ ] `3.5 1 3.5`
- [x] `3 1 3.5`
- [ ] `3 1 3`
- [ ] `4 1 3.5`
> `//` is floor division (3), `%` is the remainder (1), and `/` is true division, which always returns a float (3.5).

## What is the type of `x` after `x = input("Age: ")` when the user types `25`?
- [ ] `int`
- [ ] `float`
- [x] `str`
- [ ] It depends on what the user types
> `input()` **always** returns a string. You must convert it with `int(x)` to do arithmetic.

## What is printed?

```python norun
x = 15
if x > 10:
    print("A")
elif x > 5:
    print("B")
else:
    print("C")
```
- [x] `A`
- [ ] `A` and `B`
- [ ] `B`
- [ ] `C`
> Only the **first** true branch runs. `x > 10` is true, so `elif` and `else` are skipped even though `x > 5` is also true.

## Which values are falsy in Python? (select all)
- [x] `0`
- [x] `""`
- [ ] `"0"`
- [x] `None`
- [ ] `[0]`
> Zero, empty containers/strings and `None` are falsy. `"0"` is a non-empty string and `[0]` is a non-empty list, so both are truthy.

## How many numbers does `range(3, 15, 3)` produce?
- [ ] 5
- [x] 4
- [ ] 3
- [ ] 12
> It produces 3, 6, 9, 12. The stop value 15 is excluded.

## Why is `0.1 + 0.2 == 0.3` False?
- [ ] Python has a bug in float addition
- [x] 0.1 and 0.2 cannot be represented exactly in binary, so the sum is slightly off
- [ ] `==` compares types, not values
- [ ] Floats are rounded to 1 decimal place
> Binary floating point can't represent most decimal fractions exactly. Compare with a tolerance (`math.isclose`) or use integers or `decimal` for money.

## What does the `else` block of a `for` loop do?
- [ ] Runs when the loop body raises an error
- [ ] Runs on every iteration where the `if` is false
- [x] Runs once, if the loop completes without hitting `break`
- [ ] Runs only if the sequence is empty
> `for … else` is a search idiom: the `else` means "we never broke out", that is, nothing was found.

## What does `f"{0.4567:.1%}"` produce?
- [ ] `0.5%`
- [x] `45.7%`
- [ ] `0.46`
- [ ] `46%`
> The `%` format multiplies by 100 and adds a percent sign. `.1` means one decimal place.

# Exercise: Seconds to clock time

Read a whole number of seconds (for example `3725`) and print it as `H:MM:SS`. For example, `3725` should print `1:02:05`.

Use `//` and `%`. Minutes and seconds must always have **two digits**.

## Starter

```python
total = int(input())
# compute hours, minutes, seconds

```

## Tests

```python
assert run_program(["3725"]).strip() == "1:02:05", "3725 -> 1:02:05"
assert run_program(["59"]).strip() == "0:00:59", "59 -> 0:00:59"
assert run_program(["86399"]).strip() == "23:59:59"
assert run_program(["36000"]).strip() == "10:00:00"
```

## Hint

`hours = total // 3600`. What remains after removing the full hours is `total % 3600`. Apply the same idea again with 60. To pad to two digits, use the format spec `{m:02}`.

## Solution

```python
total = int(input())
hours = total // 3600
minutes = (total % 3600) // 60
seconds = total % 60
print(f"{hours}:{minutes:02}:{seconds:02}")
```

`02` in the format spec means "width 2, pad with zeros".

# Exercise: FizzBuzz, the classic

Read `n` and print the numbers from 1 to `n`, one per line, with these replacements:
- for multiples of 3, print `Fizz` instead of the number
- for multiples of 5, print `Buzz`
- for multiples of both 3 and 5, print `FizzBuzz`

## Starter

```python
n = int(input())

```

## Tests

```python
out = run_program(["15"]).split()
assert out[:5] == ["1", "2", "Fizz", "4", "Buzz"], out[:5]
assert out[14] == "FizzBuzz", "15 must be FizzBuzz"
assert len(out) == 15
assert run_program(["30"]).split()[29] == "FizzBuzz"
```

## Hint

The order of your checks matters. Which condition must you test **first**?

## Solution

```python
n = int(input())
for i in range(1, n + 1):
    if i % 15 == 0:          # divisible by both 3 and 5
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
```

Testing `% 15` first matters: `if/elif` stops at the first true branch, so if you checked `% 3` first, 15 would print `Fizz`.

# Exercise: Digit sum and reverse

Read a non-negative integer `n` and print two lines: the **sum of its digits**, then the **digits reversed** as a number (leading zeros disappear: `120` → `21`). Use arithmetic (`%` and `//`) in a loop, not string tricks.

## Starter

```python
n = int(input())

```

## Tests

```python
assert run_program(["1234"]).split() == ["10", "4321"]
assert run_program(["120"]).split() == ["3", "21"]
assert run_program(["7"]).split() == ["7", "7"]
assert run_program(["0"]).split() == ["0", "0"]
```

## Hint

`n % 10` is the last digit, and `n // 10` removes it. Loop while `n > 0`, which is a `while` loop (week 2). With only `for`, you can loop `for _ in range(len(str(n)))`. To build the reversed number: `rev = rev * 10 + digit`.

## Solution

```python
n = int(input())
digit_sum = 0
rev = 0
for _ in range(len(str(n))):
    d = n % 10
    digit_sum += d
    rev = rev * 10 + d
    n //= 10
print(digit_sum)
print(rev)
```

`rev * 10 + d` shifts the digits left and appends the new one. The same "shift and add" idea is how computers parse numbers from text.

# Sources

- [The Python Tutorial (official): sections 3–4](https://docs.python.org/3/tutorial/introduction.html)
- [Python docs: Built-in Types (numeric types, truth value testing)](https://docs.python.org/3/library/stdtypes.html)
- [Python docs: Format Specification Mini-Language](https://docs.python.org/3/library/string.html#format-specification-mini-language)
- [Python docs: Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html)
- *Automate the Boring Stuff with Python* by Al Sweigart, chapters 1–2 (free online at automatetheboringstuff.com)
- *Think Python, 3rd edition* by Allen Downey, chapters 1–5 (free online at allendowney.github.io/ThinkPython)
