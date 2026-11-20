---
id: py-p1
title: Project: Personal Finance Tracker (CLI)
week: Week 6
kind: project
summary: Combine everything from weeks 1–5 into a real command-line application: OOP design, file persistence, validation, regex and tests.
builds_on: py-w5, py-x
leads_to: py-w7
---

The bootcamp's week 6 is a project week. You'll build a complete program that you could show in a portfolio. Work on your own computer (VS Code + a terminal) and push to GitHub as you go. Small commits with clear messages are part of the grade.

# Project: Personal Finance Tracker

Build `fintrack`, a command-line app that records income and expenses, categorizes them, and produces monthly reports. Your data must persist between runs in a JSON file.

### Example session

```text
$ python -m fintrack add expense 120000 food "lunch with team" --date 2025-11-18
Added #14  2025-11-18  expense  120,000  food  lunch with team
$ python -m fintrack list --month 2025-11 --category food
#  date        type     amount   category  note
12 2025-11-03  expense  85,000   food      groceries
14 2025-11-18  expense  120,000  food      lunch with team
$ python -m fintrack report --month 2025-11
Income   4,500,000
Expenses 2,310,000  (food 38%, rent 52%, transport 10%)
Balance  2,190,000
Top 3 expenses: ...
$ python -m fintrack import bank.csv
Imported 37 transactions (2 skipped: invalid date)
```

### Requirements

**Design (OOP)**
- A `Transaction` dataclass with `id`, `date` (`datetime.date`), `kind` ("income"/"expense"), `amount` (an int, in the smallest currency unit, to avoid float problems), `category` and `note`.
- A `Ledger` class that owns the transactions and provides `add`, `remove(id)`, `filter(month=None, category=None, kind=None)`, `totals_by_category(month)` and `balance(month)`.
- A `Storage` class (composition!) responsible for `load()`/`save()` to JSON. The Ledger shouldn't know about files.
- Custom exceptions: `ValidationError` and `NotFound`.

**Behaviour**
- Validate input: positive amounts, a known kind, and dates in `YYYY-MM-DD` format (use a **regex** plus `datetime.date.fromisoformat`).
- `import <file.csv>`: read a CSV with `csv.DictReader`, skip and report invalid rows, and never crash.
- `report --month`: totals, the percentage per category, the top 3 expenses, and a text bar chart (`████`).
- Save atomically: write to a temporary file, then rename it. This prevents a corrupt JSON file if the program crashes mid-write.

**Code quality**
- A package layout: `fintrack/__init__.py`, `models.py`, `storage.py`, `cli.py`, `__main__.py`.
- Parse arguments with `argparse` (standard library).
- At least 10 tests with `pytest` for Ledger and the validation logic. Use a temporary directory for storage tests (the `tmp_path` fixture).
- A `README.md` with setup steps and example commands. Add a `.gitignore` and `requirements.txt` (pytest only).

## Milestones

- [ ] Create the repo, a virtual environment, the package skeleton, `.gitignore` and the README outline
- [ ] `Transaction` dataclass + `Ledger.add/remove/filter` with unit tests
- [ ] `Storage` with JSON load/save (atomic write) and tests using `tmp_path`
- [ ] CLI with `argparse`: `add`, `list`, `remove`
- [ ] Input validation with regex and custom exceptions; friendly error messages
- [ ] `report` command: totals, category percentages, top 3, text bar chart
- [ ] CSV `import` that skips invalid rows and reports a summary
- [ ] At least 10 passing tests; README with usage examples; final cleanup and push

## Rubric

| Criterion | Weight | What "excellent" looks like |
|---|---|---|
| Correctness | 30% | All commands work; money is never stored as float; edge cases handled (empty month, unknown id) |
| Design | 25% | Clear separation of concerns: models vs storage vs CLI; small functions; composition used appropriately |
| Robustness | 15% | Validation, custom exceptions, atomic saves, CSV import never crashes |
| Tests | 15% | Meaningful tests covering normal and edge cases; tests are independent of each other |
| Readability & Git | 15% | Naming, docstrings and README; small commits with clear messages |

## Stretch goals

- Budgets per category with warnings when you exceed 80% or 100%.
- Recurring transactions (monthly rent).
- Export a month to CSV, or to a Markdown report.
- Use `rich` for colored tables (a third-party package: practise `pip` and `requirements.txt`).
- Swap JSON storage for SQLite (`sqlite3` in the standard library). Because of your `Storage` abstraction, the Ledger shouldn't need to change. This is a great preview of BI week 1.

## Self-review checklist

Before you call it done, answer honestly:

1. Can someone clone your repo and run it in under 5 minutes using only your README?
2. What happens if `data.json` is missing? If it's corrupted?
3. If you replaced the CLI with a web API (Full-Stack week 3), which files would change? Ideally only `cli.py`.
4. Which function was hardest to test, and why? That's usually a sign it's doing too much.

# Sources

- [Python docs: argparse tutorial](https://docs.python.org/3/howto/argparse.html)
- [pytest: Get started](https://docs.pytest.org/en/stable/getting-started.html) and [the tmp_path fixture](https://docs.pytest.org/en/stable/how-to/tmp_path.html)
- [Python Packaging: packaging projects](https://packaging.python.org/en/latest/tutorials/packaging-projects/)
- [Python docs: datetime.date.fromisoformat](https://docs.python.org/3/library/datetime.html#datetime.date.fromisoformat)
