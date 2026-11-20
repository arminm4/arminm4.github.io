---
id: bi-w2
title: Performance Tuning: Indexes & Execution Plans
week: Week 2
summary: How databases execute queries, reading execution plans, B-tree indexes and indexing strategies, and rewriting queries to be fast.
builds_on: bi-w1, f-algebra
leads_to: bi-w3, fs-w3, fs-w6
---

A query that takes 40 seconds on 50 million rows ruins a dashboard. This week explains **why** queries are slow and **how** to make them fast. The core idea is the same in SQLite, MySQL, PostgreSQL and SQL Server, and you can see it in action by running `EXPLAIN QUERY PLAN` right here.

# Lesson: How a database executes a query (25 min)

When you send SQL, the database:

1. **Parses** it into a tree and checks the tables and columns.
2. **Optimizes**: the **query planner** considers many possible strategies (which index to use, the join order, the join algorithm) and estimates the cost of each using **statistics** about the data (row counts, value distributions).
3. **Executes** the cheapest plan it found.

The plan is your window into the planner's decisions:

```sql
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE customer_id = 7;
```

```sql
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE channel = 'app';
```

The first query says `SEARCH orders USING INDEX idx_orders_customer`, so it jumps straight to the matching rows. The second says `SCAN orders`, which means it reads every row, because there's no index on `channel`.

### Access paths

| Plan step | Meaning | Cost |
|---|---|---|
| **Full table scan** (`SCAN`, SQL Server "Table Scan", Postgres "Seq Scan") | Read every row | $O(n)$ |
| **Index seek** (`SEARCH … USING INDEX`, "Index Seek", "Index Scan" in Postgres) | Walk the B-tree to matching keys | $O(\log n)$ + matches |
| **Index-only / covering scan** | All needed columns are in the index, so the table is never touched | Cheapest |
| **Key/bookmark lookup** | Index found the row id, then fetch the row from the table | One random read per row |

> [!intuition] When a full scan is actually right
> If the query returns 40% of the table, reading everything sequentially beats thousands of random index lookups. The planner knows this. That's why "add an index" doesn't always help, and why up-to-date **statistics** matter.

### Join algorithms

- **Nested loop**: for each outer row, look up the matching inner rows. Excellent when the inner side has an index and the outer side is small.
- **Hash join**: build a hash table of the smaller input, then probe it with the larger one. Great for big, unindexed joins (the same hash-table idea as Python dicts).
- **Merge join**: both inputs sorted on the join key, walked together like a zipper.

> [!recap]
> - Parse → optimize (statistics + cost estimates) → execute.
> - Read plans: scan vs seek, lookups, and the join type.
> - Sequential scans can win for large result sets.

# Lesson: B-tree indexes from the ground up (30 min)

An **index** is a separate, sorted data structure that maps column values to row locations, like the index at the back of a book.

### Why sorted means fast

Binary search on sorted data needs $\log_2 n$ comparisons, which is about 27 for 100 million rows. Databases use **B-trees**: wide, shallow trees (hundreds of keys per node), so even billions of rows need only 3–4 page reads.

```python
import bisect, random, time
random.seed(0)
n = 200_000
ids = sorted(random.sample(range(10_000_000), n))   # the "index": sorted keys
targets = random.sample(ids, 300)

t = time.perf_counter()
found_scan = sum(1 for t_ in targets if t_ in ids)        # scan: O(n) each
scan_ms = (time.perf_counter() - t) * 1000
t = time.perf_counter()
found_seek = sum(1 for t_ in targets if ids[bisect.bisect_left(ids, t_)] == t_)   # seek: O(log n)
seek_ms = (time.perf_counter() - t) * 1000
print(f"scan {scan_ms:.0f} ms vs binary search {seek_ms:.2f} ms ({found_scan}={found_seek} found)")
```

### Composite (multi-column) indexes and the left-prefix rule

An index on `(customer_id, order_date)` is sorted by `customer_id` first, then by `order_date` within each customer, like a phone book sorted by (last name, first name).

It can serve:
- `WHERE customer_id = ?` ✓
- `WHERE customer_id = ? AND order_date >= ?` ✓ (a range on the second column)
- `WHERE customer_id = ? ORDER BY order_date` ✓ (already sorted, so no sort step)

It **can't** efficiently serve `WHERE order_date >= ?` alone, because that skips the leftmost column. You can't use a phone book to find everyone named "Sara" quickly.

```sql
CREATE INDEX IF NOT EXISTS idx_orders_cust_date ON orders(customer_id, order_date);
EXPLAIN QUERY PLAN
SELECT order_id, order_date FROM orders
WHERE customer_id = 3 AND order_date >= '2025-01-01'
ORDER BY order_date;
```

> [!tip] Column order in composite indexes
> Put **equality** columns first, then **range or sort** columns. Among equality columns, think about which combinations your queries actually use.

### Covering indexes

If the index contains every column the query needs, the table is never read. SQL Server has `INCLUDE (...)` columns for exactly this, and Postgres supports `INCLUDE` too.

```sql
CREATE INDEX IF NOT EXISTS idx_items_product_qty ON order_items(product_id, quantity);
EXPLAIN QUERY PLAN
SELECT product_id, SUM(quantity) FROM order_items GROUP BY product_id;
```

### Indexes cost something too

Every `INSERT`, `UPDATE` and `DELETE` must also update every index, and indexes use disk and memory. OLTP systems (lots of writes) keep indexes lean. Analytical systems (mostly reads) can afford more, or use **columnstore** indexes (next lesson).

> [!recap]
> - A B-tree index is a sorted structure: $O(\log n)$ seeks, plus range scans and pre-sorted output.
> - Composite indexes follow the left-prefix rule: equality columns first, then range/sort.
> - Covering indexes avoid table lookups. Every index slows down writes.

# Lesson: Writing index-friendly (sargable) queries (25 min)

A predicate is **sargable** (Search ARGument ABLE) if the engine can use an index for it. The most common way to break sargability is to **wrap the indexed column in a function or expression**:

| Not sargable ❌ | Sargable ✓ |
|---|---|
| `WHERE YEAR(order_date) = 2025` | `WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'` |
| `WHERE price * 1.09 > 100` | `WHERE price > 100 / 1.09` |
| `WHERE LOWER(email) = 'x@y.com'` | Store emails normalized, or index the expression |
| `WHERE name LIKE '%son'` | `WHERE name LIKE 'Sa%'` (a prefix is fine) |
| `WHERE CAST(customer_id AS TEXT) = '7'` | `WHERE customer_id = 7` (types must match) |

```sql
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
EXPLAIN QUERY PLAN SELECT COUNT(*) FROM orders WHERE strftime('%Y', order_date) = '2025';
```

```sql
EXPLAIN QUERY PLAN SELECT COUNT(*) FROM orders WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';
```

The first plan scans, and the second searches the index.

### Other big wins

- **Select only the columns you need.** `SELECT *` defeats covering indexes and moves more data around.
- **Filter early and aggregate before joining** when that shrinks the data a lot.
- **Avoid row-by-row loops** (cursors, or an N+1 pattern of queries from application code). One set-based query beats 10,000 small ones. You'll meet the N+1 problem again with ORMs in Full-Stack week 3.
- **`EXISTS` instead of `COUNT(*) > 0`**: EXISTS can stop at the first match.
- **Use `UNION ALL` rather than `UNION`** when duplicates are impossible or acceptable. `UNION` has to sort or hash to remove duplicates.
- **Pagination**: `OFFSET 100000` still reads 100,000 rows. **Keyset pagination** (`WHERE id > last_seen_id ORDER BY id LIMIT 50`) stays fast.

### The tuning loop

1. Find the slow query: slow-query logs, Query Store (SQL Server), `pg_stat_statements` (Postgres).
2. Get the **actual** plan: `EXPLAIN ANALYZE` (Postgres/MySQL 8), "Include Actual Execution Plan" (SSMS).
3. Look for big scans, bad row estimates (estimated 10 rows, actual 1,000,000), expensive sorts and key lookups.
4. Fix the cause: rewrite the predicate, add or adjust an index, update the statistics.
5. Measure again. Never tune by guesswork.

> [!recap]
> - Keep indexed columns "naked" in predicates (sargable).
> - Select fewer columns, use set-based queries, EXISTS, UNION ALL and keyset pagination.
> - Find → actual plan → fix the cause → measure.

# Lesson: OLTP vs OLAP, columnstores and MySQL vs SQL Server tuning (20 min)

| | OLTP (operational) | OLAP (analytical) |
|---|---|---|
| Workload | Many small reads/writes ("place order") | Few huge reads ("revenue by month by region") |
| Schema | Normalized | Denormalized star schema (week 3) |
| Storage | **Row store** | **Column store** |
| Indexes | Targeted B-trees | Columnstore + few B-trees |
| Examples | MySQL, PostgreSQL, SQL Server tables | SQL Server columnstore, SSAS, ClickHouse, BigQuery, Power BI VertiPaq |

**Columnar storage** keeps each column's values together. An analytical query touching 3 of 50 columns reads only those 3. Similar values compress extremely well, and engines process them in vectorized batches (like NumPy). That's why Power BI's in-memory engine can aggregate millions of rows instantly (week 4).

### Dialect-specific tools

- **SQL Server**: graphical execution plans in SSMS, *Query Store* for plan history and regressions, the *Database Engine Tuning Advisor*, missing-index DMVs (`sys.dm_db_missing_index_details`), clustered vs non-clustered indexes, `INCLUDE` columns and columnstore indexes.
- **MySQL (InnoDB)**: tables *are* clustered on the primary key, and secondary indexes store the PK. Use `EXPLAIN FORMAT=TREE` / `EXPLAIN ANALYZE`, the slow-query log and the `performance_schema`.

> [!connect] Same idea, different layer
> Vector databases (Full-Stack week 6) need special indexes (HNSW, IVF) because "nearest by cosine similarity" can't use a B-tree. It's the same trade-off: an index structure that matches the query shape.

# Quiz

## The plan says `SCAN orders` for `WHERE channel = 'app'`. What does that mean?
- [ ] An index seek on channel
- [x] The engine reads every row of the table
- [ ] The query will fail
- [ ] The result is cached
> No usable index exists, so it's a full table scan.

## With an index on `(customer_id, order_date)`, which predicate can't seek efficiently?
- [ ] `customer_id = 5`
- [ ] `customer_id = 5 AND order_date > '2025-01-01'`
- [x] `order_date > '2025-01-01'` alone
- [ ] `customer_id = 5 ORDER BY order_date`
> Left-prefix rule: you can't skip the leading column.

## Which predicate is sargable on an indexed `order_date`?
- [ ] `WHERE YEAR(order_date) = 2025`
- [x] `WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'`
- [ ] `WHERE CAST(order_date AS TEXT) LIKE '2025%'`
- [ ] `WHERE strftime('%Y', order_date) = '2025'`
> Leave the column unwrapped and express the condition as a range.

## Why might the planner choose a full scan even though an index exists?
- [ ] Indexes only work on primary keys
- [x] The query returns a large fraction of the rows, so sequential reading is cheaper than many random lookups
- [ ] The index is corrupted
- [ ] Planners always prefer scans
> Cost-based optimization: random I/O per row adds up.

## What is a covering index?
- [x] An index that contains all columns a query needs, so the table isn't read
- [ ] An index on every column
- [ ] The primary key
- [ ] An index that covers all tables
> It eliminates key lookups. `INCLUDE` columns help build them.

## What is a downside of adding many indexes?
- [ ] Queries get slower
- [x] Writes (INSERT/UPDATE/DELETE) get slower and storage grows
- [ ] Data becomes inconsistent
- [ ] Joins stop working
> Every write has to maintain every index.

## Why are columnstores ideal for BI aggregations?
- [ ] They support more data types
- [x] They read only the needed columns, compress well and process data in vectorized batches
- [ ] They're row-oriented
- [ ] They don't need storage
> Analytical queries touch few columns but many rows.

## Why is `OFFSET 100000 LIMIT 50` slow, and what's the alternative?
- [x] The engine still walks 100,050 rows; keyset pagination (`WHERE id > ? ORDER BY id LIMIT 50`) seeks directly
- [ ] LIMIT is slow; use TOP
- [ ] OFFSET isn't standard SQL
- [ ] It's fast in all databases
> Keyset (cursor) pagination uses the index to jump to the right place.

# Exercise: Make it sargable

This query is correct but can't use the index on `order_date`. Rewrite it to return **the same result** (the number of orders and the sum of revenue for March 2025, delivered only) using a sargable date range. Run `EXPLAIN QUERY PLAN` on both versions to compare.

## Starter

```sql
SELECT COUNT(DISTINCT order_id) AS orders, ROUND(SUM(revenue), 2) AS revenue
FROM sales
WHERE strftime('%Y-%m', order_date) = '2025-03'
  AND status = 'delivered';
```

## Tests

```sql
SELECT COUNT(DISTINCT order_id) AS orders, ROUND(SUM(revenue), 2) AS revenue
FROM sales
WHERE strftime('%Y-%m', order_date) = '2025-03' AND status = 'delivered';
```

## Solution

```sql
SELECT COUNT(DISTINCT order_id) AS orders, ROUND(SUM(revenue), 2) AS revenue
FROM sales
WHERE order_date >= '2025-03-01' AND order_date < '2025-04-01'
  AND status = 'delivered';
```

A half-open range (`>=` start, `<` next start) is correct for any date type, including timestamps with times of day. `BETWEEN '2025-03-01' AND '2025-03-31'` would miss times later on March 31 if the column held timestamps.

# Exercise: Design indexes for a workload

The shop's application runs these queries thousands of times per hour:

1. `SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 10`
2. `SELECT status, COUNT(*) FROM orders WHERE order_date >= ? GROUP BY status`
3. `SELECT product_id, SUM(quantity) FROM order_items WHERE order_id IN (…) GROUP BY product_id`

In your notes, propose the minimal set of indexes (columns and order), and explain for each query whether it becomes a seek, a range scan or a covering scan. Then create them in the Playground (SQL) and check with `EXPLAIN QUERY PLAN`.

## Solution

- **Query 1** → `CREATE INDEX ix_orders_cust_date ON orders(customer_id, order_date DESC)`. Equality on `customer_id`, then rows already sorted by date, so it can stop after 10 rows with no sort step.
- **Query 2** → `CREATE INDEX ix_orders_date_status ON orders(order_date, status)`. A range scan on the date, and it's covering for `status`, so the table isn't touched.
- **Query 3** → `order_items` already has PRIMARY KEY `(order_id, line_no)`, so lookups by `order_id` seek. To make it covering, use `(order_id, product_id, quantity)`. This is worth it only if the query is very hot, because it adds write cost.

Notice what you didn't do: index every column. Each index must earn its write cost.

# Sources

- [Use The Index, Luke! by Markus Winand (free online book)](https://use-the-index-luke.com/)
- [SQLite: Query Planning and EXPLAIN QUERY PLAN](https://www.sqlite.org/queryplanner.html)
- [PostgreSQL docs: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Microsoft Learn: SQL Server index architecture and design guide](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide)
- [MySQL 8.0 manual: Optimization and EXPLAIN](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Microsoft Learn: Columnstore indexes overview](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/columnstore-indexes-overview)
