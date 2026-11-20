---
id: bi-p
title: Project: End-to-End BI Solution
week: Week 6
kind: project
summary: From raw operational data to a governed star schema, ETL, a Power BI model with DAX and a storytelling dashboard.
builds_on: bi-w5, bi-w4, bi-w3
leads_to: ai-w1
---

The BI capstone puts all six weeks together: SQL analysis → performance → warehouse and ETL → model and DAX → dashboard and story. Work alone or with a teammate, as in the bootcamp.

# Project: Retail BI: from database to decision

**Scenario.** The shop (the sample database you've used all course) wants a management dashboard for 2024–2025 and a recommendation for next quarter's priorities.

**Data.** Export the shop tables from the app's Playground (SQL: `SELECT * FROM <table>`) into CSVs. Or load them into a free local database: **SQL Server Developer/Express**, **PostgreSQL** or **MySQL**. Optional: generate a marketing-spend table yourself, with weekly spend per channel, to compute ROAS.

### Deliverables

1. **Analysis SQL** (`analysis.sql`): at least 8 business questions answered with joins, CTEs and window functions. For example: monthly revenue and growth, the top products per category, customer cohorts by first order month, repeat-purchase rate, return rate by category, and the share of revenue from the top 20% of customers (Pareto).
2. **Performance note**: pick your 3 slowest queries, show their plans before and after, and explain the indexes or rewrites you used.
3. **Warehouse**: a star schema (`fact_sales` at the order-line grain, plus `dim_date`, `dim_product`, `dim_customer` and `dim_channel`), built by an idempotent load script (SQL, SSIS or Python). Document the grain and every measure's additivity.
4. **Power BI model**: star relationships (1:*, single direction), a marked date table, and at least 12 measures in a display folder: revenue, orders, AOV, margin %, YTD, PY, YoY %, rolling 3M, % of category, return rate, top-N customer share, and KPI status vs target.
5. **Dashboard**: 3 pages (Executive overview, Product & category, Customers), plus a drill-through page for customer detail. Use action titles, a consistent color scheme and at least one annotation.
6. **Story**: a 5-slide (or 1-page) recommendation using context → insight → action, backed by the dashboard.

## Milestones

- [ ] Load the shop data into a local database (or CSVs) and verify the row counts
- [ ] Write the analysis SQL with at least 8 questions; add a comment above each query with its answer
- [ ] Tune 3 queries; document the plans before and after
- [ ] Build the star schema with an idempotent load script; document the grain and measures
- [ ] Power BI: import the star, set relationships, mark the date table, hide the keys
- [ ] Write at least 12 DAX measures and validate them against your SQL results
- [ ] Build the 3 dashboard pages + drill-through with action titles
- [ ] Write the recommendation story; review it with a friend (do they get the point in 5 seconds?)

## Rubric

| Criterion | Weight | Excellent |
|---|---|---|
| SQL correctness and depth | 20% | Window functions, CTEs, correct grain, no fan-out errors |
| Warehouse design | 20% | Clear grain, conformed dimensions, additivity handled, idempotent load |
| Model and DAX | 20% | Clean star, measures over columns, correct time intelligence, totals behave |
| Visualization | 20% | Right charts, action titles, decluttered, consistent, accessible |
| Insight and story | 20% | A specific, data-backed recommendation with a clear Big Idea |

## Stretch goals

- **SCD type 2** on `dim_customer`: simulate customers moving city, and show that historical revenue stays with the old city.
- **Incremental refresh** with RangeStart/RangeEnd on a database source.
- **Metabase** version of the executive page (via Docker), and a comparison of the experience.
- **RLS**: a role per country manager.
- **Forecast**: next quarter's revenue with Power BI's built-in forecast, or with a model from AI week 4.

# Sources

- *The Data Warehouse Toolkit* (Kimball & Ross): the retail sales case study in chapter 3
- [Microsoft Learn: PL-300 Power BI Data Analyst study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/pl-300)
- [SQL Server Developer edition (free for development)](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
