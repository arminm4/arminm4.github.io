---
id: f-pydata
title: Python for Data: NumPy & pandas
week: Foundation 9
summary: Vectorized computing with NumPy arrays, tabular data with pandas (select, filter, group, join, clean), and plotting basics.
builds_on: py-w3, f-linalg, f-stats
leads_to: ai-w1, ai-w2, bi-w4
---

The AI bootcamp writes almost everything with **NumPy** and **pandas**. These libraries turn the loops you wrote in pure Python into fast operations on whole arrays and tables. The code in this module runs in your browser too. The first `import numpy` or `import pandas` downloads the library once (it can take ~20 seconds), and after that it's cached.

# Lesson: NumPy arrays and vectorization (30 min)

A NumPy **ndarray** is a grid of numbers that all share one type, stored contiguously in memory. Operations apply to **every element at once** (vectorization) and run in optimized C instead of the Python interpreter.

```python
import numpy as np

a = np.array([1, 2, 3, 4])
print(a * 10, a + a, a ** 2)          # element-wise, no loops
print(a.dtype, a.shape, a.ndim)

X = np.array([[1, 2, 3],
              [4, 5, 6]])              # 2 rows × 3 columns
print(X.shape, X.T.shape)             # transpose
print(X.sum(), X.sum(axis=0), X.sum(axis=1))   # total, per column, per row
print(X.mean(axis=0))
```

> [!intuition] `axis` = the dimension that disappears
> `axis=0` collapses the rows, leaving one value per column. `axis=1` collapses the columns, leaving one value per row.

### Creating arrays

```python
import numpy as np
print(np.zeros((2, 3)))
print(np.arange(0, 10, 2), np.linspace(0, 1, 5))
rng = np.random.default_rng(42)       # modern, reproducible RNG
print(rng.normal(loc=0, scale=1, size=5).round(3))
```

### Indexing, slicing and boolean masks

```python
import numpy as np
X = np.arange(12).reshape(3, 4)
print(X)
print(X[1, 2], X[:, 0], X[0, 1:3])   # element, first column, a slice of a row
mask = X % 2 == 0
print(mask)
print(X[mask])                        # keep only even values
X[X > 8] = 0                          # conditional assignment
print(X)
```

### Broadcasting

When shapes differ, NumPy "stretches" the smaller array if the dimensions are compatible. That's how you standardize every column in one line:

```python
import numpy as np
X = np.array([[170, 65.0], [180, 80.0], [160, 50.0]])   # height, weight
Z = (X - X.mean(axis=0)) / X.std(axis=0)                 # (3,2) - (2,) broadcasts per column
print(Z.round(3))
```

### Linear algebra

```python
import numpy as np
X = np.array([[1, 2], [3, 4], [5, 6]])
w = np.array([10, 1])
print(X @ w)                  # matrix-vector product, the same as the predictions in Linear Algebra
print(np.linalg.norm([3, 4]))
```

### How much faster?

```python
import numpy as np, time
n = 1_000_000
data = list(range(n))
t = time.perf_counter(); s1 = sum(x * x for x in data); t1 = time.perf_counter() - t
arr = np.arange(n, dtype=np.int64)
t = time.perf_counter(); s2 = int((arr * arr).sum()); t2 = time.perf_counter() - t
print(s1 == s2, f"python {t1*1000:.0f} ms vs numpy {t2*1000:.1f} ms")
```

> [!recap]
> - ndarrays have a single dtype, a shape and axes. Operations are element-wise and vectorized.
> - Boolean masks filter. Broadcasting aligns shapes. `@` is matrix multiplication.
> - Write NumPy code without Python loops whenever you can.

# Lesson: pandas DataFrames: select, filter, sort (30 min)

A **DataFrame** is a table: labelled columns (each one a **Series**) plus a row **index**. Think of it as "a spreadsheet you program", or "SQL tables in Python".

```python
import pandas as pd

df = pd.DataFrame({
    "order_id": [1, 2, 3, 4, 5, 6],
    "country":  ["Iran", "Germany", "Iran", "UAE", "Germany", "Iran"],
    "channel":  ["app", "web", "web", "app", "store", "app"],
    "amount":   [120.0, 80.5, None, 300.0, 45.0, 99.9],
})
print(df.head())
print(df.shape, list(df.columns))
print(df.dtypes)
```

In real projects you load data with `pd.read_csv("file.csv")`, `pd.read_excel(...)` or `pd.read_sql(query, connection)`.

### Selecting and filtering

```python
import pandas as pd
df = pd.DataFrame({"country": ["Iran", "Germany", "Iran", "UAE"], "amount": [120.0, 80.5, 60.0, 300.0]})
print(df["amount"])                          # one column (Series)
print(df[["country", "amount"]])             # several columns (DataFrame)
print(df[df["amount"] > 100])                # boolean filter, like SQL WHERE
print(df[(df["country"] == "Iran") & (df["amount"] > 100)])   # use & | with parentheses
print(df.loc[0, "country"], df.iloc[-1]["amount"])            # by label / by position
print(df.sort_values("amount", ascending=False))
```

> [!mistake] `and` / `or` don't work on columns
> Use `&`, `|` and `~` with parentheses around each condition: `(a > 1) & (b < 2)`. Python's `and` tries to reduce a whole Series to one bool and raises an error.

### Creating columns

```python
import pandas as pd
df = pd.DataFrame({"price": [10.0, 25.0, 8.0], "qty": [3, 1, 10]})
df["revenue"] = df["price"] * df["qty"]                   # vectorized
df["size"] = df["qty"].apply(lambda q: "bulk" if q >= 10 else "normal")
print(df)
```

> [!connect] pandas ↔ SQL
> `df[df.x > 5]` is `WHERE x > 5`. `df.sort_values` is `ORDER BY`. `df.groupby` is `GROUP BY`. `pd.merge` is `JOIN`. If you know BI week 1, you already know the concepts, and the reverse is true too.

> [!recap]
> - A DataFrame is labelled columns plus an index.
> - Use `df[col]`, `df[[cols]]`, boolean filters with `&`/`|`, and `loc` vs `iloc`.
> - Create columns with vectorized expressions.

# Lesson: Grouping, joining and cleaning (30 min)

### Group by and aggregate

```python
import pandas as pd
df = pd.DataFrame({
    "country": ["Iran", "Germany", "Iran", "UAE", "Germany", "Iran"],
    "channel": ["app", "web", "web", "app", "store", "app"],
    "amount":  [120.0, 80.5, 60.0, 300.0, 45.0, 99.9],
})
print(df.groupby("country")["amount"].agg(["count", "sum", "mean"]).round(1))
print(df.pivot_table(index="country", columns="channel", values="amount", aggfunc="sum", fill_value=0))
```

### Joining tables

```python
import pandas as pd
orders = pd.DataFrame({"order_id": [1, 2, 3], "customer_id": [10, 11, 99]})
customers = pd.DataFrame({"customer_id": [10, 11, 12], "name": ["Sara", "Liam", "Noor"]})
print(pd.merge(orders, customers, on="customer_id", how="inner"))
print(pd.merge(orders, customers, on="customer_id", how="left"))   # keeps order 3, name = NaN
```

### Missing data

```python
import pandas as pd, numpy as np
df = pd.DataFrame({"age": [25, np.nan, 40, 31], "city": ["Tehran", None, "Shiraz", "Tehran"]})
print(df.isna().sum())                       # count missing per column
print(df.dropna())                           # drop rows with any missing value
print(df.fillna({"age": df["age"].median(), "city": "unknown"}))
```

> [!warning] Missing data is information
> Before you fill or drop, ask *why* a value is missing. A missing "cancellation date" means "not cancelled", while a missing income might correlate with the thing you're predicting. In ML, compute fill values (like the median) on the **training set only**, or you leak information from the test set (AI week 2).

### Dates

```python
import pandas as pd
s = pd.to_datetime(pd.Series(["2025-01-15", "2025-02-03", "2025-02-20"]))
print(s.dt.month.tolist(), s.dt.day_name().tolist())
df = pd.DataFrame({"date": s, "sales": [100, 150, 130]}).set_index("date")
print(df.resample("MS").sum())          # monthly totals (Month Start)
```

### Plotting (run this in Colab or locally)

```python norun
import matplotlib.pyplot as plt
df.groupby("country")["amount"].sum().sort_values().plot.barh(title="Revenue by country")
plt.tight_layout(); plt.show()
```

> [!recap]
> - `groupby(...).agg(...)`, `pivot_table`, and `merge(how=...)` like SQL joins.
> - Inspect missingness, then decide whether to drop, fill or flag it.
> - `pd.to_datetime`, `.dt` accessors, `resample` for time series.

# Quiz

## What does `X.sum(axis=0)` return for a 3×4 array?
- [ ] One number
- [x] An array of 4 values (one per column)
- [ ] An array of 3 values (one per row)
- [ ] A 3×4 array
> Axis 0 (the rows) is collapsed, so you get one sum per column.

## Why is NumPy much faster than a Python loop for `x * x` over a million numbers?
- [ ] It uses multiple computers
- [x] The operation runs in compiled C over contiguous memory, avoiding per-element interpreter overhead
- [ ] It skips some elements
- [ ] It caches the answer
> Vectorized operations push the loop into optimized native code.

## Which pandas filter is correct?
- [ ] `df[df.a > 1 and df.b < 2]`
- [x] `df[(df.a > 1) & (df.b < 2)]`
- [ ] `df[df.a > 1 & df.b < 2]`
- [ ] `df.where(a > 1, b < 2)`
> Use `&` with parentheses. Without them, operator precedence breaks the expression.

## `pd.merge(orders, customers, on="customer_id", how="left")` keeps:
- [ ] Only orders with a matching customer
- [x] All orders; customer columns are NaN where there's no match
- [ ] All customers
- [ ] Only customers without orders
> A left join keeps every row of the left table, like SQL's LEFT JOIN.

## You fill missing ages with the median of the whole dataset before splitting into train and test. What's the problem?
- [ ] Medians can't be computed with missing values
- [x] Data leakage: test-set information influenced the training data
- [ ] Ages must be integers
- [ ] Nothing
> Fit every preprocessing step (imputation, scaling) on the training data only.

## What does broadcasting allow in `X - X.mean(axis=0)` when X is (100, 3)?
- [x] Subtracting each column's mean from every row in that column
- [ ] Subtracting the global mean
- [ ] An error, because the shapes differ
- [ ] Sorting X
> The (3,) means array is stretched across all 100 rows.

## Which is the pandas equivalent of `SELECT country, SUM(amount) FROM df GROUP BY country`?
- [ ] `df.sum("country")`
- [x] `df.groupby("country")["amount"].sum()`
- [ ] `df.pivot("amount")`
- [ ] `df.merge("country")`
> `groupby` + aggregate is SQL's GROUP BY.

# Exercise: Sales summary with pandas

Write `summarize(df)` that takes a DataFrame with columns `country`, `amount` (it may contain missing values) and `channel`, and returns a DataFrame indexed by `country` with the columns `orders` (the number of rows, *including* those with a missing amount), `revenue` (the sum of amount, ignoring missing values) and `avg` (mean amount, rounded to 2 decimals), sorted by `revenue`, descending.

## Starter

```python
import pandas as pd

def summarize(df):
    pass

df = pd.DataFrame({
    "country": ["Iran", "Germany", "Iran", "UAE", "Germany", "Iran"],
    "channel": ["app", "web", "web", "app", "store", "app"],
    "amount":  [120.0, 80.5, None, 300.0, 45.0, 99.9],
})
print(summarize(df))
```

## Tests

```python
import pandas as pd
ns = load()
df = pd.DataFrame({
    "country": ["Iran", "Germany", "Iran", "UAE", "Germany", "Iran"],
    "channel": ["app", "web", "web", "app", "store", "app"],
    "amount":  [120.0, 80.5, None, 300.0, 45.0, 99.9],
})
r = ns["summarize"](df)
assert list(r.index) == ["UAE", "Iran", "Germany"], list(r.index)
assert list(r.columns) == ["orders", "revenue", "avg"], list(r.columns)
assert r.loc["Iran", "orders"] == 3
assert abs(r.loc["Iran", "revenue"] - 219.9) < 1e-9
assert r.loc["Iran", "avg"] == 109.95
```

## Hint

`df.groupby("country").agg(orders=("amount", "size"), revenue=("amount", "sum"), avg=("amount", "mean"))`. Note that `size` counts rows including NaN, while `count` skips NaN.

## Solution

```python
import pandas as pd

def summarize(df):
    out = df.groupby("country").agg(
        orders=("amount", "size"),
        revenue=("amount", "sum"),
        avg=("amount", "mean"),
    )
    out["avg"] = out["avg"].round(2)
    return out.sort_values("revenue", ascending=False)
```

# Sources

- [NumPy: absolute beginners' guide (official)](https://numpy.org/doc/stable/user/absolute_beginners.html)
- [pandas: 10 minutes to pandas (official)](https://pandas.pydata.org/docs/user_guide/10min.html)
- [pandas: Comparison with SQL](https://pandas.pydata.org/docs/getting_started/comparison/comparison_with_sql.html)
- *Python for Data Analysis, 3rd ed.* by Wes McKinney (free online at wesmckinney.com/book)
- [Kaggle Learn: Pandas (free micro-course)](https://www.kaggle.com/learn/pandas)
