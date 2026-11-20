---
id: py-x
title: Files, Modules & Regular Expressions
week: Supplement
summary: Reading and writing files with context managers, paths and directories, CSV/JSON, modules and packages, virtual environments, and regex.
builds_on: py-w3, f-terminal
leads_to: py-w4, do-w3
---

This supplementary module covers the "real-world plumbing" every Python developer needs: persisting data in files, organizing code into modules and packages, isolating dependencies with virtual environments, and searching text with regular expressions. (The examples write files into a virtual in-browser file system, so they're safe to run.)

# Lesson: Files and context managers (25 min)

```python
with open("notes.txt", "w", encoding="utf-8") as f:   # "w" = write (overwrite)
    f.write("first line\n")
    f.write("second line\n")

with open("notes.txt", "a", encoding="utf-8") as f:   # "a" = append
    print("third line", file=f)

with open("notes.txt", encoding="utf-8") as f:        # "r" (read) is the default
    for line in f:                                    # streams line by line
        print(repr(line.rstrip("\n")))
```

### The `with` statement

`with` is a **context manager**: it guarantees cleanup (closing the file) even if an error happens inside the block. Without it you'd have to write `try: ... finally: f.close()` yourself. Many resources work this way: files, database connections, locks and network sessions.

```python
class Timer:
    """A tiny custom context manager."""
    def __enter__(self):
        import time
        self.t0 = time.perf_counter()
        return self
    def __exit__(self, exc_type, exc, tb):
        import time
        print(f"took {(time.perf_counter() - self.t0) * 1000:.1f} ms")
        return False      # don't swallow exceptions

with Timer():
    total = sum(i * i for i in range(200_000))
```

> [!tip] Always pass `encoding="utf-8"`
> The default encoding depends on the operating system (Windows often isn't UTF-8). Being explicit avoids the classic `UnicodeDecodeError` with Persian or emoji text.

### File modes

| Mode | Meaning |
|---|---|
| `"r"` | read (error if missing) |
| `"w"` | write: creates the file or **truncates** it |
| `"a"` | append |
| `"x"` | create, error if it exists |
| `"rb"`, `"wb"` | binary (images, PDFs) |

> [!recap]
> - `with open(path, mode, encoding="utf-8") as f:` always closes the file.
> - Iterate a file object to stream it line by line (memory-friendly).
> - Context managers implement `__enter__`/`__exit__`.

# Lesson: Paths, directories, CSV and JSON (25 min)

### pathlib: paths as objects

```python
from pathlib import Path

base = Path("project")
(base / "data" / "raw").mkdir(parents=True, exist_ok=True)   # / joins paths portably
p = base / "data" / "raw" / "sales.csv"
p.write_text("date,amount\n2025-01-01,120\n2025-01-02,80\n", encoding="utf-8")
print(p.exists(), p.name, p.stem, p.suffix, p.parent)
for f in base.rglob("*.csv"):        # recursive search
    print("found:", f, f.stat().st_size, "bytes")
```

### CSV

```python
import csv
from pathlib import Path
Path("people.csv").write_text("name,age\nSara,31\nLiam,27\n", encoding="utf-8")

with open("people.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))            # each row is a dict
print(rows)
ages = [int(r["age"]) for r in rows]          # CSV values are strings!
print(sum(ages) / len(ages))

with open("out.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["name", "age"])
    w.writeheader()
    w.writerows(rows)
print(Path("out.csv").read_text())
```

### JSON

```python
import json
from pathlib import Path
settings = {"theme": "dark", "font_scale": 1.1, "recent": ["py-w1", "py-w2"]}
Path("settings.json").write_text(json.dumps(settings, indent=2), encoding="utf-8")
loaded = json.loads(Path("settings.json").read_text(encoding="utf-8"))
print(loaded["recent"])
```

> [!connect] Where this goes
> This app's progress backup is a JSON file. In AI and BI you'll mostly read CSVs with pandas (`pd.read_csv`), but the standard-library `csv` module is useful when you can't install packages, for example in small automation scripts (DevOps week 3).

> [!recap]
> - `pathlib.Path`: `/` to join, `mkdir(parents=True)`, `glob`/`rglob`, `read_text`/`write_text`.
> - `csv.DictReader`/`DictWriter`. CSV values are always strings.
> - `json.dumps`/`loads` (strings) and `json.dump`/`load` (files).

# Lesson: Modules, packages and virtual environments (20 min)

### Modules and imports

Any `.py` file is a **module**. Import it to reuse its code:

```python norun
# file: geometry.py
PI = 3.14159
def circle_area(r):
    return PI * r * r

if __name__ == "__main__":      # runs only when executed directly, not on import
    print(circle_area(2))
```

```python norun
# file: main.py
import geometry
from geometry import circle_area
import geometry as geo
print(geometry.circle_area(1), circle_area(2), geo.PI)
```

A **package** is a directory of modules (traditionally containing an `__init__.py`):

```text
shop/
├── __init__.py
├── models.py
└── pricing/
    ├── __init__.py
    └── discounts.py        ->  from shop.pricing.discounts import apply_coupon
```

### Third-party packages and virtual environments

`pip` installs packages from **PyPI**. A **virtual environment** gives each project its own isolated set of packages, so project A can use pandas 1.5 while project B uses 2.2.

```bash norun
python -m venv .venv                 # create (once per project)
source .venv/bin/activate            # macOS/Linux
.venv\Scripts\Activate.ps1           # Windows PowerShell
pip install requests pandas
pip freeze > requirements.txt        # record exact versions
pip install -r requirements.txt      # reproduce on another machine / in Docker
deactivate
```

> [!tip] Modern tooling
> **uv** (a very fast pip/venv replacement) and **Poetry** manage environments and lock files for you. Whatever the tool, the principle is the same: **isolate dependencies per project and pin versions**. Docker images (DevOps week 4) take that isolation one step further.

> [!recap]
> - A module is a `.py` file and a package is a directory of modules. `if __name__ == "__main__":` guards script code.
> - Use one virtual environment per project and `requirements.txt` to reproduce it.

# Lesson: Regular expressions (30 min)

A **regular expression** (regex) is a pattern language for text. Use it for validating formats, extracting fields and searching logs.

```python
import re
text = "Order #1042 shipped to sara@example.com on 2025-11-20; order #1043 pending."
print(re.findall(r"#(\d+)", text))                       # all order numbers
print(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text).group())
m = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
print(m.group(0), m.group(1), m.groups())
print(re.sub(r"\d", "*", "Card 4111 1111 1111 1234"))     # mask digits
print(re.split(r"[;,]\s*", "a, b;c,  d"))
```

### Core syntax

| Pattern | Matches |
|---|---|
| `.` | any character except newline |
| `\d` `\w` `\s` | digit, word character `[A-Za-z0-9_]`, whitespace |
| `\D` `\W` `\S` | the negations |
| `[abc]` `[^abc]` `[a-z]` | character classes |
| `*` `+` `?` | 0+, 1+, 0 or 1 |
| `{3}` `{2,5}` | exact count, range |
| `^` `$` | start, end of string (or line with `re.M`) |
| `( )` | capture group; `(?P<name>...)` is a named group |
| `a\|b` | alternation |
| `\b` | word boundary |

Always write patterns as **raw strings** `r"..."` so that backslashes reach the regex engine unchanged.

### Named groups: parsing log lines

```python
import re
LOG = re.compile(r'(?P<ip>\d+\.\d+\.\d+\.\d+) - - \[(?P<time>[^\]]+)\] "(?P<method>\w+) (?P<path>\S+) [^"]+" (?P<status>\d{3}) (?P<size>\d+)')
line = '203.0.113.9 - - [20/Nov/2025:10:15:32 +0000] "GET /api/orders/42 HTTP/1.1" 404 512'
m = LOG.match(line)
print(m.groupdict())
```

### Greedy vs lazy

```python
import re
html = "<b>one</b> and <b>two</b>"
print(re.findall(r"<b>(.*)</b>", html))    # greedy: grabs as much as possible
print(re.findall(r"<b>(.*?)</b>", html))   # lazy: as little as possible
```

> [!warning] Don't parse HTML or JSON with regex
> Use a real parser (`json`, `html.parser`, BeautifulSoup) for nested formats. Regex is great for flat, line-oriented text: logs, IDs, dates, simple validation.

> [!connect] Where this goes
> Log parsing and alerting (DevOps weeks 3 and 11), text normalization for NLP (AI week 9), and extracting structured fields from LLM output when you can't use structured outputs (Agentic week 1).

> [!recap]
> - `re.search`, `match`, `findall`, `sub`, `split` and `compile`.
> - Character classes, quantifiers, groups and anchors. Use raw strings.
> - `.*?` is lazy. Use real parsers for nested formats.

# Quiz

## What is the main benefit of `with open(...) as f:`?
- [ ] It reads files faster
- [x] It guarantees the file is closed, even if an exception occurs
- [ ] It creates the file if it's missing
- [ ] It locks the file for other programs
> Context managers run their cleanup code in `__exit__` no matter how the block ends.

## Opening an existing file with mode `"w"` will:
- [ ] Append to it
- [x] Erase its contents (truncate) and write from the start
- [ ] Raise an error
- [ ] Open it read-only
> Use `"a"` to append and `"x"` to fail if the file exists.

## Values read with `csv.DictReader` are:
- [ ] Automatically converted to numbers
- [x] Always strings
- [ ] Python objects of the right type
- [ ] Bytes
> Convert them yourself (`int(row["age"])`), or use pandas, which infers types.

## Why use a virtual environment?
- [ ] To make Python run faster
- [x] To isolate each project's packages and versions
- [ ] To run Python in the browser
- [ ] It's required to use pip
> Different projects can need incompatible versions, and venvs keep them apart.

## What does `if __name__ == "__main__":` do?
- [ ] Defines the main function
- [x] Runs the block only when the file is executed directly, not when imported
- [ ] Makes the module private
- [ ] Imports the main module
> When a module is imported, its `__name__` is the module name, not `"__main__"`.

## `re.findall(r"\d+", "a12b3c456")` returns:
- [ ] ['1', '2', '3', '4', '5', '6']
- [x] ['12', '3', '456']
- [ ] [12, 3, 456]
- [ ] '123456'
> `\d+` matches maximal runs of digits, returned as strings.

## What does `.*?` mean in a regex?
- [ ] An optional dot
- [x] Any characters, as few as possible (lazy)
- [ ] Any characters, as many as possible (greedy)
- [ ] A literal `.*?`
> Adding `?` to a quantifier makes it lazy.

# Exercise: Log analyzer

Write `analyze(lines)` that takes a list of web-server log lines in the format below and returns a dict with:
- `"requests"`: the number of valid lines (skip lines that don't match the format)
- `"errors"`: the number of lines whose status is 500 or above
- `"top_path"`: the most requested path (on a tie, any of the tied paths)
- `"by_status"`: a dict mapping each status **int** to its count

Format: `IP - - [time] "METHOD PATH HTTP/x" STATUS SIZE`

## Starter

```python
import re
from collections import Counter

def analyze(lines):
    pass

logs = [
    '1.2.3.4 - - [20/Nov/2025:10:00:00 +0000] "GET /home HTTP/1.1" 200 512',
    '1.2.3.5 - - [20/Nov/2025:10:00:01 +0000] "GET /api/orders HTTP/1.1" 500 0',
    'garbage line',
    '1.2.3.6 - - [20/Nov/2025:10:00:02 +0000] "POST /api/orders HTTP/1.1" 201 77',
]
print(analyze(logs))
```

## Tests

```python
ns = load()
logs = [
    '1.2.3.4 - - [20/Nov/2025:10:00:00 +0000] "GET /home HTTP/1.1" 200 512',
    '1.2.3.5 - - [20/Nov/2025:10:00:01 +0000] "GET /api/orders HTTP/1.1" 500 0',
    'garbage line',
    '1.2.3.6 - - [20/Nov/2025:10:00:02 +0000] "POST /api/orders HTTP/1.1" 201 77',
    '1.2.3.7 - - [20/Nov/2025:10:00:03 +0000] "GET /api/orders HTTP/1.1" 503 0',
]
r = ns["analyze"](logs)
assert r["requests"] == 4, r
assert r["errors"] == 2, r
assert r["top_path"] == "/api/orders", r
assert r["by_status"] == {200: 1, 500: 1, 201: 1, 503: 1}, r
assert ns["analyze"]([])["requests"] == 0
```

## Hint

Compile one regex with groups for the path and the status: `r'"(\w+) (\S+) [^"]*" (\d{3}) '`. Use `re.search`, skip the line if there's no match, and count with `Counter`. For an empty input, `top_path` can be `None`.

## Solution

```python
import re
from collections import Counter

PATTERN = re.compile(r'^\S+ - - \[[^\]]+\] "(\w+) (\S+) [^"]*" (\d{3}) \d+')

def analyze(lines):
    paths, statuses = Counter(), Counter()
    for line in lines:
        m = PATTERN.search(line)
        if not m:
            continue
        _, path, status = m.groups()
        paths[path] += 1
        statuses[int(status)] += 1
    return {
        "requests": sum(statuses.values()),
        "errors": sum(n for s, n in statuses.items() if s >= 500),
        "top_path": paths.most_common(1)[0][0] if paths else None,
        "by_status": dict(statuses),
    }
```

# Sources

- [Python Tutorial: Reading and Writing Files](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files)
- [Python docs: pathlib](https://docs.python.org/3/library/pathlib.html), [csv](https://docs.python.org/3/library/csv.html), [json](https://docs.python.org/3/library/json.html)
- [Python Tutorial: Modules and Packages](https://docs.python.org/3/tutorial/modules.html)
- [Python Packaging User Guide: virtual environments](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)
- [Python docs: Regular Expression HOWTO](https://docs.python.org/3/howto/regex.html)
- [regex101: an interactive regex tester (choose the Python flavor)](https://regex101.com/)
