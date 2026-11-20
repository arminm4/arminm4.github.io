---
id: bi-w5
title: Visualization, Storytelling & Dashboards
week: Week 5
summary: Choosing visuals, perception-based design, data storytelling, dashboard layouts for marketing and HR, interactivity, Power BI Report Server and sharing.
builds_on: bi-w4, f-stats
leads_to: bi-p
---

A correct model is only half the job. If decision-makers can't understand a dashboard in 5 seconds, it fails. This week is about **communicating** with data: choosing the right visual, designing for human perception, telling a story, and delivering dashboards securely.

# Lesson: How people read charts (25 min)

Humans compare some visual encodings much more accurately than others. Cleveland & McGill's research (1984) ranks them roughly as:

1. **Position on a common scale** (bar ends, dots, lines): the most accurate
2. Length
3. Angle and slope
4. Area
5. Color intensity and hue: the least accurate for exact values

**Implications:**
- Bars and lines beat pies and donuts for comparison. Comparing pie slices means comparing angles and areas, which people do poorly.
- Use color to **highlight** and **group**, not to encode precise values.
- Sorted bars make ranking instant.

### Preattentive attributes

Some properties pop out before conscious attention: **color**, size, position and enclosure. Grey out everything, then color the one bar that matters. The reader's eye goes straight to the message.

### Visual choice in Power BI

| Question | Power BI visual |
|---|---|
| Compare categories | Clustered bar (horizontal for long labels) |
| Trend over time | Line chart (add the previous year as a second line) |
| Part-to-whole over time | Stacked column or 100% stacked (few categories) |
| Single KPI | Card / KPI visual with target and trend |
| Detail lookup | Table / Matrix with conditional formatting |
| Relationship between two measures | Scatter (add a play axis for time) |
| Contribution, start to end | Waterfall (e.g. revenue bridge) |
| Geographic | Filled map / shape map (only if location matters) |
| Funnel stages | Funnel (marketing conversion) |
| Drivers | Decomposition tree, Key influencers |

> [!recap]
> - Position and length are read most accurately. Avoid pies for precise comparisons.
> - Use color to highlight, not decorate. Sort bars.

# Lesson: Data storytelling (25 min)

A dashboard **monitors**. A data story **explains and persuades**. Both benefit from narrative structure.

### The Big Idea

Before you build anything, write one sentence that contains your point of view and what's at stake:

> "App orders grew 40% this year while web stagnated, so shifting 20% of ad spend to app campaigns should raise revenue next quarter."

### Structure: context → conflict → resolution

1. **Context**: what's the situation? (revenue by channel over 2 years)
2. **Conflict/insight**: what changed or surprised us? (web flat, app booming, returns rising in Gaming)
3. **Resolution**: what should we do? (reallocate budget; investigate Gaming returns)

### Make the message explicit

- **Action titles**: "Gaming returns doubled since Q2", not "Returns by category".
- **Annotate** the important points on the chart (a launch date, an outage).
- **Declutter**: remove gridlines, borders, 3D, redundant legends (label the lines directly) and unnecessary decimals.
- **Compare against something**: target, previous period, benchmark. A number alone has no meaning.

> [!example] Before → after
> *Before:* a rainbow pie chart of 8 categories titled "Sales". *After:* a sorted horizontal bar chart in grey, with the two categories that missed their targets in orange, titled "Phones and Home missed Q3 targets by 12% and 18%", plus a small annotation explaining the stock-out in Home.

> [!recap]
> - Start from one Big Idea sentence.
> - Context → insight → action. Action titles and annotations.
> - Declutter, and always give a comparison.

# Lesson: Designing dashboards: marketing and HR examples (30 min)

### Layout principles

- **Z-pattern**: readers scan top-left first, so put the most important KPIs there.
- **Overview first, then zoom and filter, then details on demand** (Shneiderman's mantra). Top row: KPI cards. Middle: trends and breakdowns. Bottom or drill-through: detail tables.
- **5–7 visuals per page**, a consistent grid, consistent colors (one color per meaning across all pages), and slicers in one place.
- Design for the **audience and decision**: executives need status and exceptions, while analysts need exploration.

### Example 1: Marketing dashboard

| Area | Content |
|---|---|
| KPI row | Spend, Revenue, ROAS (revenue ÷ ad spend), CAC (cost per acquired customer), Conversion rate, each vs. target and the previous period |
| Funnel | Impressions → Clicks → Sessions → Add to cart → Orders, with stage conversion % |
| Trend | Revenue and spend by week, with campaign launches annotated |
| Breakdown | ROAS by channel/campaign as sorted bars, highlighting those below 1.0 |
| Cohorts | Retention by signup month (a matrix with conditional formatting) |
| Filters | Date range, channel, country, device |

### Example 2: HR dashboard

| Area | Content |
|---|---|
| KPI row | Headcount (semi-additive: last value in the period!), Hires, Leavers, Turnover %, Avg tenure, Open roles |
| Trend | Headcount and turnover % by month |
| Breakdown | Turnover by department and manager; time-to-hire by role |
| Diversity & equity | Distribution by level and gender; pay ratios (with care for privacy) |
| Security | **Row-level security**: managers see only their own department |

> [!warning] HR data is sensitive
> Apply **row-level security (RLS)**, hide individual salaries, and suppress small groups (for example, don't show averages for groups smaller than 5 people) to protect privacy.

### Interactivity in Power BI

- **Cross-filtering**: clicking a bar filters the other visuals (Edit interactions controls this).
- **Drill-down** through hierarchies (Year → Quarter → Month).
- **Drill-through** pages: right-click a customer → a "Customer detail" page.
- **Tooltips pages**, **bookmarks** (saved views), **buttons** for guided stories.
- **Field parameters**: let users switch the measure or dimension shown.

> [!recap]
> - KPIs top-left, then trends, then details. 5–7 visuals per page, with consistent color.
> - Marketing: funnel, ROAS/CAC, cohorts. HR: semi-additive headcount, turnover, RLS and privacy.
> - Cross-filter, drill-down/through, tooltips, bookmarks.

# Lesson: Sharing: Power BI Service and Report Server (20 min)

### Power BI Service (cloud)

- **Publish** from Desktop to a **workspace**. Share through **apps** (curated bundles for audiences).
- **Scheduled refresh**, plus an **on-premises data gateway** for data that sits inside your network.
- **Row-level security (RLS)**: define roles with DAX filters (`[Department] = USERPRINCIPALNAME()`-based mappings), then assign users to them.
- Dashboards (pinned tiles) vs reports (interactive pages). Subscriptions and alerts on KPIs.

### Power BI Report Server (on-premises)

For organizations that can't use the cloud (regulation or data residency), **Power BI Report Server** hosts Power BI reports, SSRS paginated reports and Excel workbooks **inside the company network**. Its key differences:
- It needs a special **Power BI Desktop for Report Server** version, which is updated a few times a year.
- Fewer cloud features (no dashboards with pinned tiles, limited AI features, and no apps in the same way).
- Licensing comes through Power BI Premium or SQL Server Enterprise with Software Assurance.

### Performance checklist before publishing

- Use **Performance Analyzer** in Desktop to find slow visuals.
- Reduce visuals per page. Avoid huge tables of raw rows.
- Optimize the model: star schema, remove unused columns, lower cardinality, and keep measures simple (variables!).
- Use DAX Studio / VertiPaq Analyzer for deep dives into model size.

> [!recap]
> - Service: workspaces, apps, refresh, gateway, RLS.
> - Report Server: on-premises hosting with a specific Desktop version and fewer features.
> - Profile with Performance Analyzer before you publish.

# Quiz

## According to perception research, which encoding allows the most accurate comparison?
- [x] Position along a common scale
- [ ] Angle (pie slices)
- [ ] Area (bubbles)
- [ ] Color hue
> That's why bars and dot plots beat pies for comparisons.

## Which is the better chart title?
- [ ] "Returns by category"
- [x] "Gaming returns doubled since Q2"
- [ ] "Chart 3"
- [ ] "Returns (%) – all categories – 2024–2025"
> An action title states the insight, so the reader knows what to look for.

## In a dashboard layout, where should the most important KPIs go?
- [x] Top-left
- [ ] Bottom-right
- [ ] In a tooltip
- [ ] On a hidden page
> Readers scan in a Z-pattern, starting top-left.

## Headcount should be aggregated over a quarter how?
- [ ] Sum of daily headcount
- [x] The value at the end of the period (semi-additive)
- [ ] The average of the percentages
- [ ] Count of rows
> Summing a stock over time is meaningless. Use the closing (or average) balance.

## How do you make managers see only their department's data in Power BI?
- [ ] Create one report per manager
- [x] Row-level security roles with DAX filters
- [ ] Hide the department column
- [ ] Use bookmarks
> RLS filters the data based on the signed-in user.

## What does ROAS measure in a marketing dashboard?
- [ ] Return on assets
- [x] Revenue generated per unit of ad spend
- [ ] Rate of active sessions
- [ ] Customer churn
> ROAS = revenue ÷ ad spend. Below 1 means losing money on ads (before other costs).

## When would you choose Power BI Report Server over the Power BI Service?
- [ ] When you want more AI features
- [x] When reports must stay on-premises for regulatory or data-residency reasons
- [ ] When you need mobile apps
- [ ] When you have no SQL Server
> Report Server keeps everything inside the organization's network, with fewer cloud features.

# Exercise: Redesign a bad dashboard (no code)

You inherit a sales page with: a 3D pie of revenue by 12 products, a table of 5,000 raw orders, a gauge with no target, rainbow colors, and the title "Dashboard 1". Write a redesign plan in your notes covering: the Big Idea, the KPI row (with comparisons), 3 visuals with their types and action titles, the color strategy, interactions (drill-through, slicers) and one accessibility consideration.

## Solution

**Big Idea:** "Q3 revenue is 6% above plan, driven by Laptops; Phones are 15% behind and need attention."
**KPI row:** Revenue (vs plan and vs PY), Orders, AOV, Margin %, each a card with a variance arrow and a sparkline.
**Visuals:**
1. "Laptops drove 60% of Q3 growth": a sorted horizontal bar chart of revenue variance vs plan by category, with positive bars in the accent color and negative ones in orange.
2. "Phones fell behind after the August stock-out": a line of actual vs plan by week, with the stock-out annotated.
3. "Top 10 customers account for 41% of revenue": a Pareto bar + cumulative line.
**Details:** a drill-through page "Order details" instead of the 5,000-row table on the main page.
**Color:** grey baseline, one accent color for good and one for bad, consistent on every page.
**Interactions:** date and region slicers in one panel; drill-down from year to month; tooltips with margin.
**Accessibility:** don't rely on red and green alone. Add ▲▼ icons and labels, ensure contrast, and set alt text on visuals.

# Sources

- *Storytelling with Data* by Cole Nussbaumer Knaflic
- *The Big Book of Dashboards* by Wexler, Shaffer & Cotgreave
- Cleveland & McGill (1984), "Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods", JASA
- [Microsoft Learn: Tips for designing a great Power BI dashboard](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips)
- [Microsoft Learn: Row-level security (RLS) with Power BI](https://learn.microsoft.com/en-us/fabric/security/service-admin-row-level-security)
- [Microsoft Learn: What is Power BI Report Server?](https://learn.microsoft.com/en-us/power-bi/report-server/get-started)
