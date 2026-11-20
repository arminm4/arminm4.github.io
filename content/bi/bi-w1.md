---
id: bi-w1
title: SQL for Analytics
week: Week 1
summary: The relational model, querying and filtering, every kind of join, aggregation, CTEs and window functions, and how MySQL and SQL Server differ.
builds_on: f-stats
leads_to: bi-w2, bi-w3, fs-w3, f-pydata
---

SQL is the most valuable data skill there is. It has been around for 50 years and every data tool still speaks it. In this module every query runs in your browser against a sample **shop** database (SQLite). Press **▶ Run** on any query, or **Edit** it and experiment. You can also open the **Playground → SQL** tab and click **Schema** to see all the tables.

**The shop database:** `customers` (30), `products` (24) in `categories` (8), `orders` (400, 2024–2025) with `order_items` (800 lines), `employees` (10), plus a convenience view `sales` that joins everything into one row per order line with `revenue` and `margin`.

# Lesson: The relational model and SELECT (25 min)

A relational database stores data in **tables** (relations). Rows are records, and columns are typed attributes.

- A **primary key** (PK) uniquely identifies each row: `customers.customer_id`.
- A **foreign key** (FK) references a PK in another table: `orders.customer_id → customers.customer_id`. Foreign keys are what make tables *relate*.
- **Normalization** stores each fact once. A customer's city lives in `customers`, not repeated on every order, which avoids inconsistencies.

### Your first queries

```sql
SELECT name, city, country
FROM customers
WHERE country = 'Iran'
ORDER BY name
LIMIT 5;
```

```sql
SELECT product_id, name, unit_price, unit_price - cost AS unit_margin,
       ROUND(100.0 * (unit_price - cost) / unit_price, 1) AS margin_pct
FROM products
WHERE unit_price BETWEEN 50 AND 500
  AND name LIKE '%o%'
ORDER BY margin_pct DESC;
```

### Logical order of execution

SQL is **declarative**: you describe *what* you want, and the engine decides *how* to get it. Knowing the **logical** order explains many errors:

1. `FROM` / `JOIN`: build the rows
2. `WHERE`: filter rows
3. `GROUP BY`: form groups
4. `HAVING`: filter groups
5. `SELECT`: compute columns and aliases
6. `ORDER BY`: sort
7. `LIMIT`: cut

This is why you **can't use a SELECT alias in WHERE** (step 2 runs before step 5), but you can use one in ORDER BY.

### NULL: the "unknown" value

`NULL` means missing or unknown. Any comparison with NULL is *unknown*, not true, so `segment = NULL` never matches. Use `IS NULL`:

```sql
SELECT name, segment FROM customers WHERE segment IS NULL;
```

```sql
SELECT COUNT(*) AS all_rows, COUNT(segment) AS non_null_segments,
       COALESCE(NULL, 'fallback') AS coalesce_demo
FROM customers;
```

> [!warning] NULLs in arithmetic and NOT IN
> `5 + NULL` is `NULL`. And `x NOT IN (1, 2, NULL)` is never true. A NULL inside a NOT IN list silently empties your result. Prefer `NOT EXISTS` for anti-joins (next lesson).

> [!recap]
> - Tables, rows and columns. PKs identify rows and FKs link tables.
> - The logical order is FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.
> - Test NULL with `IS NULL`. Use `COALESCE` for defaults.

# Lesson: Joins (30 min)

A **join** combines rows from two tables on a condition, usually FK = PK.

```sql
-- INNER JOIN: only orders that have a matching customer
SELECT o.order_id, o.order_date, c.name, c.country
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
ORDER BY o.order_date
LIMIT 5;
```

| Join | Keeps |
|---|---|
| `INNER JOIN` | Only matching pairs |
| `LEFT JOIN` | All rows from the left table; NULLs where the right has no match |
| `RIGHT JOIN` | Mirror of LEFT (rarely used: just swap the tables) |
| `FULL OUTER JOIN` | All rows from both sides |
| `CROSS JOIN` | Every combination (a Cartesian product) |

### LEFT JOIN to find "missing" things

Which products have **never** been ordered?

```sql
SELECT p.name
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.product_id
WHERE oi.product_id IS NULL;
```

The same question as an anti-join with `NOT EXISTS`, which is often clearer and is NULL-safe:

```sql
SELECT c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

### Multi-table joins

```sql
SELECT o.order_id, c.name AS customer, p.name AS product, cat.name AS category,
       oi.quantity, oi.unit_price
FROM order_items oi
JOIN orders o     ON o.order_id = oi.order_id
JOIN customers c  ON c.customer_id = o.customer_id
JOIN products p   ON p.product_id = oi.product_id
JOIN categories cat ON cat.category_id = p.category_id
WHERE o.order_id = 7;
```

### Self-join: a table joined to itself

```sql
SELECT e.name AS employee, e.title, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id
ORDER BY manager, employee;
```

> [!mistake] Join fan-out
> Joining `orders` to `order_items` produces **one row per item**. If you then `SUM(orders.some_column)`, values are counted once per item, which silently inflates the totals. Aggregate at the right grain, or aggregate in a subquery first. This "grain" idea is central to data warehousing (week 3).

> [!recap]
> - INNER keeps matches. LEFT keeps everything on the left.
> - Use LEFT JOIN … IS NULL or NOT EXISTS to find what's missing.
> - Self-joins handle hierarchies. Watch for fan-out.

# Lesson: Aggregation, GROUP BY and HAVING (30 min)

Aggregate functions collapse many rows into one: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.

```sql
SELECT category,
       COUNT(*)                 AS lines,
       SUM(quantity)            AS units,
       ROUND(SUM(revenue), 2)   AS revenue,
       ROUND(SUM(margin) * 100.0 / SUM(revenue), 1) AS margin_pct
FROM sales
WHERE status = 'delivered'
GROUP BY category
ORDER BY revenue DESC;
```

Every column in `SELECT` must either be in `GROUP BY` or wrapped in an aggregate.

### HAVING filters groups

```sql
SELECT c.name, COUNT(*) AS orders
FROM orders o JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.name
HAVING COUNT(*) >= 20
ORDER BY orders DESC;
```

`WHERE` filters **rows before** grouping. `HAVING` filters **groups after** aggregation.

### COUNT(DISTINCT) and conditional aggregation

```sql
SELECT country,
       COUNT(DISTINCT customer_id)                              AS customers,
       COUNT(DISTINCT order_id)                                 AS orders,
       ROUND(SUM(CASE WHEN channel = 'app'   THEN revenue ELSE 0 END), 0) AS app_rev,
       ROUND(SUM(CASE WHEN channel = 'web'   THEN revenue ELSE 0 END), 0) AS web_rev,
       ROUND(SUM(CASE WHEN channel = 'store' THEN revenue ELSE 0 END), 0) AS store_rev
FROM sales
GROUP BY country
ORDER BY orders DESC;
```

`CASE WHEN` inside an aggregate **pivots** rows into columns. It's the SQL equivalent of a pivot table.

### Grouping by time

```sql
SELECT strftime('%Y-%m', order_date) AS month,
       COUNT(DISTINCT order_id) AS orders,
       ROUND(SUM(revenue), 0) AS revenue
FROM sales
WHERE status IN ('delivered', 'returned')
GROUP BY month
ORDER BY month
LIMIT 12;
```

> [!recap]
> - SELECT columns are either grouped or aggregated.
> - WHERE filters rows, HAVING filters groups.
> - `SUM(CASE WHEN …)` pivots. `COUNT(DISTINCT …)` counts unique values.

# Lesson: CTEs, subqueries and window functions (35 min)

### Common Table Expressions (CTEs)

`WITH name AS (...)` names an intermediate result, so a complex query reads top to bottom like a story:

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(revenue) AS revenue
    FROM sales
    WHERE status = 'delivered'
    GROUP BY customer_id
),
ranked AS (
    SELECT customer_id, revenue,
           NTILE(4) OVER (ORDER BY revenue DESC) AS quartile
    FROM customer_revenue
)
SELECT c.name, ROUND(r.revenue) AS revenue, r.quartile
FROM ranked r JOIN customers c USING (customer_id)
WHERE r.quartile = 1
ORDER BY r.revenue DESC;
```

### Window functions: aggregates that keep the rows

A **window function** computes over a set of rows related to the current row, **without collapsing them**: `func() OVER (PARTITION BY … ORDER BY … ROWS …)`.

```sql
-- rank products by revenue within each category
WITH prod AS (
  SELECT category, product, ROUND(SUM(revenue)) AS revenue
  FROM sales GROUP BY category, product
)
SELECT category, product, revenue,
       RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rank_in_cat,
       ROUND(100.0 * revenue / SUM(revenue) OVER (PARTITION BY category), 1) AS pct_of_cat
FROM prod
ORDER BY category, rank_in_cat;
```

```sql
-- running total, month-over-month change, and a 3-month moving average
WITH monthly AS (
  SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(revenue)) AS revenue
  FROM sales WHERE status = 'delivered' GROUP BY month
)
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_total,
       revenue - LAG(revenue) OVER (ORDER BY month) AS mom_change,
       ROUND(AVG(revenue) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)) AS ma_3
FROM monthly
ORDER BY month;
```

| Function | Use |
|---|---|
| `ROW_NUMBER()` | Unique sequence. "Latest order per customer" = `ROW_NUMBER() … = 1` |
| `RANK()` / `DENSE_RANK()` | Ranking with ties (RANK leaves gaps) |
| `LAG()` / `LEAD()` | The previous or next row's value: period-over-period changes |
| `SUM/AVG … OVER (ORDER BY …)` | Running totals and moving averages |
| `NTILE(n)` | Split into n buckets (quartiles, deciles) |
| `FIRST_VALUE` / `LAST_VALUE` | The first or last value in the window |

```sql
-- each customer's most recent order (the "top-1 per group" pattern)
WITH x AS (
  SELECT customer_id, order_id, order_date,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
SELECT c.name, x.order_id, x.order_date
FROM x JOIN customers c USING (customer_id)
WHERE rn = 1
ORDER BY x.order_date DESC
LIMIT 8;
```

> [!connect] Where this goes
> Running totals and period-over-period changes are the core of BI dashboards. You'll write the same logic in DAX (week 4) with `TOTALYTD` and `DATEADD`. Lag features in time-series forecasting (AI week 4) are `LAG()` in another form.

> [!recap]
> - CTEs make long queries readable.
> - Windows: `OVER (PARTITION BY … ORDER BY … ROWS …)` keeps the rows.
> - ROW_NUMBER for top-N per group, LAG for changes, SUM OVER for running totals.

# Lesson: MySQL vs SQL Server (and SQLite) (15 min)

Standard SQL is shared, but each **dialect** differs in details. You'll meet MySQL/MariaDB in web stacks, SQL Server in Microsoft/enterprise BI stacks (SSIS/SSAS/Power BI, week 3) and PostgreSQL in modern backends (Full-Stack week 3).

| Task | MySQL | SQL Server (T-SQL) | SQLite / PostgreSQL |
|---|---|---|---|
| First N rows | `LIMIT 10` | `SELECT TOP 10 …` or `OFFSET … FETCH NEXT 10 ROWS ONLY` | `LIMIT 10` |
| Null default | `IFNULL(x, 0)` / `COALESCE` | `ISNULL(x, 0)` / `COALESCE` | `COALESCE` |
| String concat | `CONCAT(a, b)` | `a + b` or `CONCAT` | `a \|\| b` |
| Current time | `NOW()` | `GETDATE()` / `SYSDATETIME()` | `CURRENT_TIMESTAMP` |
| Date parts | `YEAR(d)`, `DATE_FORMAT` | `YEAR(d)`, `DATEPART`, `FORMAT` | `strftime` / `EXTRACT`, `to_char` |
| Add to date | `DATE_ADD(d, INTERVAL 1 MONTH)` | `DATEADD(month, 1, d)` | `date(d, '+1 month')` / `d + INTERVAL '1 month'` |
| Auto ID | `AUTO_INCREMENT` | `IDENTITY(1,1)` | `INTEGER PRIMARY KEY` / `GENERATED … AS IDENTITY` |
| Identifiers | `` `name` `` | `[name]` | `"name"` |

> [!tip] Write portable SQL first
> `COALESCE`, `CASE`, CTEs, window functions and `JOIN … ON` work almost everywhere. Reach for dialect-specific features only when you need them, and keep them in one place.

# Quiz

## Why does `SELECT price * 2 AS doubled FROM t WHERE doubled > 10` fail in most databases?
- [ ] `AS` isn't allowed with arithmetic
- [x] WHERE is evaluated before SELECT, so the alias doesn't exist yet
- [ ] You must use HAVING
- [ ] Aliases are case-sensitive
> Logical order: FROM → WHERE → … → SELECT. Repeat the expression, or use a CTE or subquery.

## Which query finds customers with no orders?
- [ ] `SELECT * FROM customers c JOIN orders o ON … WHERE o.order_id IS NULL`
- [x] `SELECT * FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)`
- [ ] `SELECT * FROM customers WHERE orders = 0`
- [ ] `SELECT * FROM customers c WHERE c.customer_id != orders.customer_id`
> An INNER JOIN never produces NULL order rows. A LEFT JOIN … IS NULL or NOT EXISTS is the anti-join pattern.

## What's the difference between WHERE and HAVING?
- [x] WHERE filters rows before grouping; HAVING filters groups after aggregation
- [ ] They're identical
- [ ] HAVING is faster
- [ ] WHERE works only with numbers
> To filter on `COUNT(*)` you need HAVING.

## You join orders to order_items and SUM a column from orders. What's the risk?
- [ ] NULL values
- [x] Fan-out: each order repeats once per item, inflating the sum
- [ ] Syntax error
- [ ] It's slower but correct
> Mind the grain of each table. Aggregate before joining if needed.

## What does `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)` give you?
- [ ] The total number of orders
- [x] A per-customer numbering where 1 = the most recent order
- [ ] A global ranking of all orders
- [ ] The number of customers
> Filtering `rn = 1` gives "the latest row per group".

## Which function computes month-over-month change most directly?
- [ ] ROW_NUMBER
- [ ] NTILE
- [x] LAG
- [ ] COUNT(DISTINCT)
> `value - LAG(value) OVER (ORDER BY month)` gives the change from the previous row.

## `x NOT IN (SELECT manager_id FROM employees)` returns no rows, even though you expected some. Why?
- [ ] NOT IN doesn't work with subqueries
- [x] The subquery contains a NULL (the CEO has no manager), so the comparison is never true
- [ ] employees is empty
- [ ] You need DISTINCT
> NULL in a NOT IN list makes every comparison unknown. Use NOT EXISTS.

## SQL Server's equivalent of MySQL's `LIMIT 10` is:
- [ ] `ROWNUM 10`
- [x] `TOP 10` (or OFFSET/FETCH)
- [ ] `FIRST 10`
- [ ] `LIMIT 10` works everywhere
> T-SQL uses `SELECT TOP 10 …` or `ORDER BY … OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`.

# Exercise: Revenue by category (delivered only)

Using the `sales` view, return `category` and `revenue` (the sum of revenue rounded to 2 decimals) for **delivered** orders only, sorted by revenue, highest first.

## Starter

```sql
SELECT ...
FROM sales
```

## Tests

```sql
SELECT category, ROUND(SUM(revenue), 2) AS revenue
FROM sales
WHERE status = 'delivered'
GROUP BY category
ORDER BY revenue DESC;
```

## Solution

```sql
SELECT category, ROUND(SUM(revenue), 2) AS revenue
FROM sales
WHERE status = 'delivered'
GROUP BY category
ORDER BY revenue DESC;
```

# Exercise: Category gaps

Some customers haven't bought from every category, which is a cross-selling opportunity. List every customer who **has ordered** but has bought from **fewer than all** categories. Return `name` and `categories_bought` (the number of distinct categories they've bought from), sorted by `categories_bought` ascending, then by `name`.

Don't hard-code the number 8: compute the total number of categories with a subquery.

## Starter

```sql
SELECT c.name, COUNT(DISTINCT ...) AS categories_bought
FROM customers c
JOIN ...
GROUP BY ...
HAVING ...
ORDER BY categories_bought, c.name;
```

## Tests

```sql
SELECT c.name, COUNT(DISTINCT s.category) AS categories_bought
FROM customers c JOIN sales s ON s.customer_id = c.customer_id
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT s.category) < (SELECT COUNT(*) FROM categories)
ORDER BY categories_bought, c.name;
```

## Hint

Join customers to the `sales` view (or to orders → order_items → products), group by customer, and use `HAVING COUNT(DISTINCT category) < (SELECT COUNT(*) FROM categories)`. The INNER JOIN already excludes customers who never ordered.

## Solution

```sql
SELECT c.name, COUNT(DISTINCT p.category_id) AS categories_bought
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT p.category_id) < (SELECT COUNT(*) FROM categories)
ORDER BY categories_bought, c.name;
```

The scalar subquery `(SELECT COUNT(*) FROM categories)` keeps the query correct when a new category is added. That's why it's better than hard-coding 8.

# Exercise: Top product per category

For each category, return the single product with the highest total **units sold** (the sum of quantity across all orders): `category`, `product`, `units`. If two products tie, pick the one with the smaller `product_id`. Sort by category.

## Starter

```sql
WITH units AS (
  SELECT ...
)
SELECT ...
```

## Tests

```sql
WITH u AS (
  SELECT cat.name AS category, p.product_id, p.name AS product, SUM(oi.quantity) AS units
  FROM order_items oi JOIN products p ON p.product_id = oi.product_id
  JOIN categories cat ON cat.category_id = p.category_id
  GROUP BY cat.name, p.product_id, p.name
), r AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product_id) AS rn FROM u
)
SELECT category, product, units FROM r WHERE rn = 1 ORDER BY category;
```

## Hint

Aggregate the units per product in a CTE, then apply `ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product_id)` and keep `rn = 1`.

## Solution

```sql
WITH units AS (
  SELECT category, product_id, product, SUM(quantity) AS units
  FROM sales
  GROUP BY category, product_id, product
),
ranked AS (
  SELECT category, product, units,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product_id) AS rn
  FROM units
)
SELECT category, product, units
FROM ranked
WHERE rn = 1
ORDER BY category;
```

# Exercise: Month-over-month growth

For **2025** only, using delivered orders, return `month` (`YYYY-MM`), `revenue` (rounded to the nearest whole number) and `growth_pct`: the percentage change from the previous month, rounded to 1 decimal (NULL for January). Sort by month.

## Starter

```sql
WITH monthly AS (
  SELECT ...
)
SELECT ...
```

## Tests

```sql
WITH monthly AS (
  SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(revenue)) AS revenue
  FROM sales WHERE status = 'delivered' AND order_date >= '2025-01-01' AND order_date < '2026-01-01'
  GROUP BY month
)
SELECT month, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly ORDER BY month;
```

## Solution

```sql
WITH monthly AS (
  SELECT strftime('%Y-%m', order_date) AS month,
         ROUND(SUM(revenue)) AS revenue
  FROM sales
  WHERE status = 'delivered' AND strftime('%Y', order_date) = '2025'
  GROUP BY month
)
SELECT month, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly
ORDER BY month;
```

# Sources

- [SQLite: SELECT and window functions documentation](https://www.sqlite.org/windowfunctions.html)
- [PostgreSQL tutorial: Queries, Joins, Aggregates, Window Functions](https://www.postgresql.org/docs/current/tutorial-sql.html)
- [Microsoft Learn: T-SQL SELECT and window functions (OVER clause)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-over-clause-transact-sql)
- [MySQL 8.0 Reference Manual: Window Functions](https://dev.mysql.com/doc/refman/8.0/en/window-functions.html)
- [Mode: SQL Tutorial for data analysis](https://mode.com/sql-tutorial/)
- [Use The Index, Luke!: SQL indexing and tuning for developers](https://use-the-index-luke.com/)
