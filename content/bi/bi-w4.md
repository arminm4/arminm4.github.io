---
id: bi-w4
title: Power BI Modeling: Power Query, Relationships & DAX
week: Week 4
summary: Shaping data with Power Query, designing star-schema models and relationships, DAX measures with filter context and CALCULATE, time intelligence, KPIs and incremental refresh.
builds_on: bi-w3, f-pydata
leads_to: bi-w5
---

Power BI is three tools in one: **Power Query** (getting and shaping data), the **model** (tables, relationships and DAX measures, running on the same VertiPaq engine as SSAS Tabular), and **reports** (visuals, covered next week). This week covers the first two, and they're where most Power BI skill lives.

> [!tip] Setup
> Install **Power BI Desktop** (free, Windows) from the Microsoft Store or Microsoft's site. Load the shop data: in the app's Playground (SQL), run `SELECT * FROM sales`, copy the result into Excel or a CSV, and import it. Even better, recreate the star schema from week 3 as separate CSVs: `fact_sales`, `dim_date`, `dim_product`, `dim_customer`.

# Lesson: Power Query: shaping data before it's loaded (30 min)

Power Query is Power BI's ETL tool. Each transformation you click becomes an **applied step** written in the **M language**, which re-runs on every refresh. It's reproducible, unlike manual Excel edits.

Common steps:
- **Promote headers**, **set data types** (always do this explicitly).
- **Remove columns and rows**, filter, remove duplicates, replace values, trim and clean text.
- **Split columns** (by delimiter), **merge columns**, **add conditional or custom columns**.
- **Unpivot**: turn wide "Jan, Feb, Mar…" columns into tidy `Month, Value` rows. This is essential for time analysis.
- **Merge queries** (a join) and **append queries** (a union).
- **Group by** (aggregate).

```powerquery norun
let
    Source   = Csv.Document(File.Contents("C:\data\sales.csv"), [Delimiter=",", Encoding=65001]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    Typed    = Table.TransformColumnTypes(Headers, {{"order_date", type date}, {"revenue", type number}, {"quantity", Int64.Type}}),
    Delivered = Table.SelectRows(Typed, each [status] = "delivered"),
    AddYear  = Table.AddColumn(Delivered, "Year", each Date.Year([order_date]), Int64.Type)
in
    AddYear
```

### Query folding

When the source is a database, Power Query tries to **fold** steps back into a single SQL query that runs on the server (right-click a step → *View Native Query*). Folding is crucial for performance and for incremental refresh. Some steps (like adding an index column or certain custom functions) **break folding**. Put foldable steps first.

> [!connect] The same principles as ETL
> Power Query is SSIS-style ETL for analysts: explicit types, clean and conform the data, and filter early (week 3). Unpivoting creates "tidy data", the same shape pandas and SQL prefer.

> [!recap]
> - Every click becomes an M step that re-runs on refresh.
> - Set types explicitly, unpivot wide tables, merge/append = join/union.
> - Keep query folding intact for database sources.

# Lesson: The data model: relationships done right (30 min)

Load **fact** and **dimension** tables separately and connect them in Model view. Don't flatten everything into one giant table.

### Relationship properties

- **Cardinality**: usually **one-to-many (1:*)**, from the dimension (one) to the fact (many). Each product appears once in `dim_product` and many times in `fact_sales`.
- **Cross-filter direction**: **single** (the dimension filters the fact) is the default and the recommended choice. Bidirectional filtering creates ambiguity and performance costs, so use it rarely and deliberately.
- **Active vs inactive**: only one active path between two tables. If the fact has both `order_date` and `ship_date`, make one relationship to `dim_date` active and activate the other in specific measures with `USERELATIONSHIP` (a "role-playing dimension").

### Filters flow "downhill"

Selecting "Laptops" in a slicer on `dim_product[category]` filters `dim_product`. That filter flows across the 1:* relationship to `fact_sales`, so every measure sees only laptop rows. **Understanding this flow is understanding Power BI.**

### Modeling best practices

| Do | Why |
|---|---|
| Star schema: facts in the centre, dimensions around them | Simple filter propagation, fast VertiPaq compression |
| A dedicated **date table**, marked as date table | Required for reliable time intelligence |
| Hide foreign-key columns and technical columns | Users pick from dimensions, not from keys |
| Use **measures**, not implicit column aggregations | Reusable, consistent and formatted |
| Remove unused columns, and reduce cardinality (split datetime into date + time) | Model size and speed |
| Avoid many-to-many and bidirectional relationships unless they're truly needed | Ambiguity and surprising totals |

> [!recap]
> - 1:* from dimension to fact, single direction.
> - Mark a date table. Role-playing dates use inactive relationships + USERELATIONSHIP.
> - Filters flow from dimensions to facts.

# Lesson: DAX fundamentals: measures, context and CALCULATE (40 min)

**DAX** (Data Analysis Expressions) is the formula language of Power BI, SSAS Tabular and Power Pivot.

### Calculated columns vs measures

| | Calculated column | Measure |
|---|---|---|
| Evaluated | At refresh, once per row | At query time, for each visual cell |
| Stored | Yes (uses memory) | No |
| Context | **Row context** | **Filter context** |
| Use for | Attributes to slice by (age band) | Aggregations (revenue, margin %) |

Rule of thumb: **if you aggregate it, make it a measure.**

```dax norun
Revenue      = SUM ( fact_sales[revenue] )
Margin       = SUM ( fact_sales[margin] )
Margin %     = DIVIDE ( [Margin], [Revenue] )          -- DIVIDE handles divide-by-zero
Orders       = DISTINCTCOUNT ( fact_sales[order_id] )
Avg Order Value = DIVIDE ( [Revenue], [Orders] )
```

Notice that `Margin %` is computed from additive parts, as you learned in week 3.

### Filter context: the key concept

Every cell of a visual evaluates the measure under a **filter context**: the combination of filters coming from the row and column headers, slicers, the page and report filters, and relationships. In a matrix with categories as rows and years as columns, the cell "Laptops / 2025" computes `[Revenue]` with `category = Laptops` **and** `year = 2025` applied. The *same* measure gives different numbers in different cells. That's the point.

### CALCULATE: modifying the filter context

`CALCULATE(expression, filter1, filter2, …)` evaluates an expression under a **modified** filter context. It's the most important function in DAX.

```dax norun
Revenue App      = CALCULATE ( [Revenue], fact_sales[channel] = "app" )
Revenue All Cats = CALCULATE ( [Revenue], REMOVEFILTERS ( dim_product[category] ) )
% of Category Total = DIVIDE ( [Revenue], [Revenue All Cats] )
Delivered Revenue = CALCULATE ( [Revenue], KEEPFILTERS ( fact_sales[status] = "delivered" ) )
Revenue by Ship Date = CALCULATE ( [Revenue], USERELATIONSHIP ( fact_sales[ship_date_key], dim_date[date_key] ) )
```

### Iterators: SUMX and friends

`SUMX(table, expression)` evaluates an expression **row by row** (row context), then sums the results. Use it when you need per-row arithmetic before aggregating:

```dax norun
Gross Revenue = SUMX ( fact_sales, fact_sales[quantity] * RELATED ( dim_product[list_price] ) )
```

### Variables keep DAX readable (and fast)

```dax norun
Revenue Growth % =
VAR Curr = [Revenue]
VAR Prev = CALCULATE ( [Revenue], DATEADD ( dim_date[full_date], -1, YEAR ) )
RETURN
    DIVIDE ( Curr - Prev, Prev )
```

> [!mistake] "My total is wrong!"
> A measure's total row is evaluated in its *own* filter context (no row filter). It's **not** the sum of the visible rows. For ratios that's correct. If you really need the sum of the per-row values, use an iterator: `SUMX ( VALUES ( dim_product[category] ), [Some Measure] )`.

> [!recap]
> - Measures are evaluated in filter context, calculated columns in row context.
> - CALCULATE changes the filter context: add, remove (REMOVEFILTERS/ALL) or keep filters.
> - Use iterators (SUMX) for row-level math. Use VAR … RETURN for clarity.

# Lesson: Time intelligence, KPIs and incremental refresh (30 min)

With a proper, marked **date table** related to the fact table, DAX has built-in time functions:

```dax norun
Revenue YTD        = TOTALYTD ( [Revenue], dim_date[full_date] )
Revenue PY         = CALCULATE ( [Revenue], SAMEPERIODLASTYEAR ( dim_date[full_date] ) )
Revenue YoY %      = DIVIDE ( [Revenue] - [Revenue PY], [Revenue PY] )
Revenue Rolling 3M = CALCULATE ( [Revenue], DATESINPERIOD ( dim_date[full_date], MAX ( dim_date[full_date] ), -3, MONTH ) )
Revenue MTD        = TOTALMTD ( [Revenue], dim_date[full_date] )
```

These are the DAX versions of the SQL window functions from week 1 (running totals, LAG).

### KPIs

A **KPI** compares an actual value to a **target** and shows its status:

```dax norun
Revenue Target   = 250000                                   -- or from a targets table
Revenue vs Target % = DIVIDE ( [Revenue], [Revenue Target] )
KPI Status =
SWITCH (
    TRUE (),
    [Revenue vs Target %] >= 1,    "On track",
    [Revenue vs Target %] >= 0.9,  "At risk",
    "Off track"
)
```

Good KPIs are **few, defined once in the model (governed), tied to decisions, and shown with context**: trend, target, previous period.

### Incremental refresh

Large fact tables shouldn't be fully reloaded on every refresh. **Incremental refresh**:
1. Create the parameters `RangeStart` and `RangeEnd` (type DateTime) in Power Query.
2. Filter the fact table: `[order_date] >= RangeStart and [order_date] < RangeEnd`. The source must **fold** this filter into SQL.
3. Define a policy: for example, *store* 5 years and *refresh* only the last 10 days.
4. Publish to the Power BI Service. It partitions the table by period and refreshes only the recent partitions.

> [!connect] Same idea as warehouse loads
> Incremental refresh is the incremental, watermark-based loading from week 3, managed by Power BI.

> [!recap]
> - Time intelligence needs a marked date table: TOTALYTD, SAMEPERIODLASTYEAR, DATEADD, DATESINPERIOD.
> - A KPI is actual vs target + status + context.
> - Incremental refresh uses RangeStart/RangeEnd with query folding and a partitioning policy.

# Quiz

## You want "Revenue" to respond to every slicer and visual. Should it be a calculated column or a measure?
- [ ] Calculated column
- [x] Measure
- [ ] Either, they're identical
- [ ] A Power Query step
> Measures are evaluated in each visual's filter context. Calculated columns are fixed at refresh.

## What is the recommended relationship between dim_product and fact_sales?
- [ ] Many-to-many, bidirectional
- [x] One-to-many from dim_product to fact_sales, single direction
- [ ] One-to-one
- [ ] No relationship; use a merged table
> The standard star-schema relationship: the dimension filters the fact.

## What does `CALCULATE([Revenue], REMOVEFILTERS(dim_product[category]))` return in a matrix row for "Laptops"?
- [ ] Laptop revenue
- [x] Revenue across all categories (other filters, like year, still apply)
- [ ] Zero
- [ ] An error
> REMOVEFILTERS removes only the category filter, which is useful for "% of total".

## Why use `DIVIDE(a, b)` instead of `a / b`?
- [ ] It's faster
- [x] It returns BLANK (or an alternate result) instead of an error when b is zero
- [ ] `/` doesn't exist in DAX
- [ ] DIVIDE rounds the result
> Safe division avoids errors in visuals.

## A matrix total for "Margin %" isn't the sum of the rows. Is that a bug?
- [ ] Yes, always
- [x] No: the total is the measure evaluated over the total filter context, which is correct for ratios
- [ ] Yes, use a calculated column instead
- [ ] Only if bidirectional filters are on
> Summing percentages would be wrong anyway.

## What does query folding mean in Power Query?
- [x] Transformation steps are translated into a native query (e.g. SQL) that runs at the source
- [ ] Steps are compressed to save space
- [ ] Queries are merged into one table
- [ ] The query is cached locally
> Folding pushes the work to the database. It's essential for performance and incremental refresh.

## Which function gives last year's revenue for the same period?
- [ ] TOTALYTD
- [x] SAMEPERIODLASTYEAR (inside CALCULATE)
- [ ] DATESINPERIOD with +1
- [ ] RELATED
> `CALCULATE([Revenue], SAMEPERIODLASTYEAR(dim_date[full_date]))`

## Your fact table has order_date and ship_date, both related to dim_date. How do you analyze by ship date?
- [ ] Duplicate the fact table
- [x] Keep the ship-date relationship inactive and activate it in a measure with USERELATIONSHIP
- [ ] Make both relationships active
- [ ] Use a bidirectional filter
> Role-playing dimension: one active relationship, others activated as needed.

# Exercise: Write the core measures

In Power BI Desktop (or on paper), using the week 3 star schema, write DAX measures for: `Revenue`, `Orders`, `AOV` (average order value), `Margin %`, `Revenue PY`, `YoY %`, `Revenue Rolling 3M`, `% of Category`, and a `KPI Status` text measure with targets of 100% (On track) and 90% (At risk) against a fixed monthly target of 20,000. Then build a matrix (category × year) to check them.

## Solution

```dax norun
Revenue      = SUM ( fact_sales[revenue] )
Orders       = DISTINCTCOUNT ( fact_sales[order_id] )
AOV          = DIVIDE ( [Revenue], [Orders] )
Margin %     = DIVIDE ( SUM ( fact_sales[margin] ), [Revenue] )
Revenue PY   = CALCULATE ( [Revenue], SAMEPERIODLASTYEAR ( dim_date[full_date] ) )
YoY %        = DIVIDE ( [Revenue] - [Revenue PY], [Revenue PY] )
Revenue Rolling 3M =
    CALCULATE ( [Revenue],
        DATESINPERIOD ( dim_date[full_date], MAX ( dim_date[full_date] ), -3, MONTH ) )
% of Category =
    DIVIDE ( [Revenue], CALCULATE ( [Revenue], REMOVEFILTERS ( dim_product[product] ) ) )
Monthly Target = 20000 * DISTINCTCOUNT ( dim_date[month_key] )
KPI Status =
VAR r = DIVIDE ( [Revenue], [Monthly Target] )
RETURN SWITCH ( TRUE (), r >= 1, "On track", r >= 0.9, "At risk", "Off track" )
```

`Monthly Target` scales with the number of months in context, so the yearly total compares against 12 × 20,000. That's a nice example of a measure adapting to its filter context. (Add `month_key = year*100 + month` to `dim_date`.)

# Exercise: DAX logic in SQL: year-over-year

To check your understanding of `SAMEPERIODLASTYEAR`, compute it in SQL. For each month of **2025** (delivered orders, from the `sales` view), return `month` (`01`–`12`), `rev_2025` and `rev_2024` (both rounded to whole numbers) and `yoy_pct` (rounded to 1 decimal). Sort by month.

## Starter

```sql
WITH m AS (
  SELECT strftime('%Y', order_date) AS yr, strftime('%m', order_date) AS mon, SUM(revenue) AS rev
  FROM sales WHERE status = 'delivered'
  GROUP BY yr, mon
)
SELECT ...
```

## Tests

```sql
WITH m AS (
  SELECT strftime('%Y', order_date) AS yr, strftime('%m', order_date) AS mon, SUM(revenue) AS rev
  FROM sales WHERE status = 'delivered' GROUP BY yr, mon
)
SELECT a.mon AS month, ROUND(a.rev) AS rev_2025, ROUND(b.rev) AS rev_2024,
       ROUND(100.0 * (a.rev - b.rev) / b.rev, 1) AS yoy_pct
FROM m a LEFT JOIN m b ON b.mon = a.mon AND b.yr = '2024'
WHERE a.yr = '2025' ORDER BY month;
```

## Hint

Self-join the monthly CTE: the 2025 rows (`a`) joined to the 2024 rows (`b`) on the same month. Use a LEFT JOIN in case a month has no prior-year data.

## Solution

```sql
WITH m AS (
  SELECT strftime('%Y', order_date) AS yr, strftime('%m', order_date) AS mon, SUM(revenue) AS rev
  FROM sales WHERE status = 'delivered'
  GROUP BY yr, mon
)
SELECT cur.mon AS month,
       ROUND(cur.rev) AS rev_2025,
       ROUND(prev.rev) AS rev_2024,
       ROUND(100.0 * (cur.rev - prev.rev) / prev.rev, 1) AS yoy_pct
FROM m cur
LEFT JOIN m prev ON prev.mon = cur.mon AND prev.yr = '2024'
WHERE cur.yr = '2025'
ORDER BY month;
```

# Sources

- [Microsoft Learn: Power BI documentation and the Power BI data analyst learning path (PL-300)](https://learn.microsoft.com/en-us/training/powerplatform/power-bi)
- [Microsoft Learn: Star schema and the importance for Power BI](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)
- [Microsoft Learn: DAX function reference](https://learn.microsoft.com/en-us/dax/dax-function-reference)
- [SQLBI: articles on CALCULATE, filter context and time intelligence (Russo & Ferrari)](https://www.sqlbi.com/)
- *The Definitive Guide to DAX, 2nd ed.* by Marco Russo & Alberto Ferrari
- [Microsoft Learn: Incremental refresh for semantic models](https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-overview)
- [Microsoft Learn: Query folding in Power Query](https://learn.microsoft.com/en-us/power-query/query-folding-basics)
