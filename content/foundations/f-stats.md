---
id: f-stats
title: Descriptive Statistics & Data Thinking
week: Foundation 5
summary: Mean vs median, spread and percentiles, distributions and outliers, correlation vs causation, and choosing honest charts.
builds_on: f-algebra, f-probability
leads_to: bi-w1, bi-w5, ai-w1
---

Before you model data, you have to **describe** it. BI dashboards are descriptive statistics with good design, and every AI project starts with exploratory data analysis (EDA). This module teaches the summaries professionals use, and the traps that make numbers lie.

# Lesson: Center: mean, median and mode (20 min)

- **Mean** $\bar{x} = \frac{1}{n}\sum x_i$: the balance point of the data. It's sensitive to extreme values.
- **Median**: the middle value of the sorted data (or the average of the two middle values). It's robust to outliers.
- **Mode**: the most frequent value. Useful for categories ("most common payment method").

```python
import statistics as st
salaries = [32, 35, 36, 38, 40, 41, 44, 45, 300]   # one CEO in thousands
print("mean  ", round(st.fmean(salaries), 1))
print("median", st.median(salaries))
print("mode  ", st.mode(["card", "cash", "card", "wallet", "card"]))
```

One extreme value pulled the mean to about 68 while the median stayed at 40. For **skewed** data (incomes, house prices, order values, response times), report the median.

> [!intuition] Skew tells you which is bigger
> In a **right-skewed** distribution (a long tail of large values), mean > median. In a left-skewed one, mean < median. If the mean and median differ a lot, look for a tail.

### Weighted mean

When groups differ in size, weight them: the average order value across two stores is $\frac{\sum \text{revenue}}{\sum \text{orders}}$, **not** the average of the two stores' averages. Averaging averages is one of the most common BI bugs (you'll see the DAX version in BI week 4).

```python
stores = [("North", 1000, 50_000), ("South", 10, 2_000)]  # (name, orders, revenue)
avg_of_avgs = sum(rev / n for _, n, rev in stores) / len(stores)
true_avg = sum(rev for *_, rev in stores) / sum(n for _, n, _ in stores)
print(round(avg_of_avgs, 1), "vs correct", round(true_avg, 1))
```

> [!recap]
> - The mean is sensitive to outliers. The median is robust. The mode is for categories.
> - Skewed data: mean ≠ median.
> - Never average averages across groups of different sizes.

# Lesson: Spread: range, variance, standard deviation, percentiles (25 min)

Two datasets can share a mean and be completely different. Spread measures variability.

- **Range** = max − min. Simple, but driven entirely by the two most extreme points.
- **Variance** $s^2 = \frac{1}{n-1}\sum (x_i - \bar{x})^2$ and **standard deviation** $s = \sqrt{s^2}$. The $n-1$ ("Bessel's correction") makes the *sample* variance an unbiased estimate of the population variance.
- **Percentiles**: the $p$-th percentile is the value below which $p\%$ of the data falls. The median is P50, and the quartiles are Q1 = P25 and Q3 = P75.
- **IQR** (interquartile range) = Q3 − Q1: the spread of the middle 50%, which is robust.

```python
import statistics as st
latency_ms = [120, 130, 125, 140, 135, 128, 900, 131, 127, 133, 129, 2500]
q = st.quantiles(latency_ms, n=100)    # 99 cut points
print("mean", round(st.fmean(latency_ms)), " median", st.median(latency_ms))
print("p90", round(q[89]), " p99", round(q[98]))
print("stdev", round(st.stdev(latency_ms)))
```

> [!connect] Percentiles in DevOps
> SRE teams track **p95/p99 latency**, not the mean. The mean hides the slow requests that annoy real users (DevOps week 11, Full-Stack week 11). The "1 in 100 requests" experience matters.

### Outliers: the 1.5×IQR rule

A common convention is to flag values below $Q1 - 1.5\,\text{IQR}$ or above $Q3 + 1.5\,\text{IQR}$. These are the dots outside the whiskers of a **box plot**. An outlier is a question, not automatically an error: is it a data-entry bug, fraud, or your most important customer?

### Standardization (z-scores)

$z = \frac{x - \bar{x}}{s}$ re-expresses each value as "standard deviations from the mean". This makes different units comparable, and it's exactly the `StandardScaler` you'll use before many ML models (AI week 2).

> [!recap]
> - Standard deviation measures the typical distance from the mean, and the IQR does the same robustly.
> - Report p50/p95/p99 for skewed metrics like latency.
> - Flag outliers with the 1.5×IQR rule, then investigate them before deleting anything.

# Lesson: Relationships: correlation is not causation (25 min)

**Covariance** measures whether two variables move together. **Pearson correlation** $r$ rescales it to $[-1, 1]$:

$$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2}\sqrt{\sum (y_i - \bar{y})^2}}$$

```python
import statistics as st
ad_spend = [1, 2, 3, 4, 5, 6, 7, 8]
sales    = [12, 15, 21, 24, 26, 33, 35, 41]
print("r =", round(st.correlation(ad_spend, sales), 3))

x = [-3, -2, -1, 0, 1, 2, 3]
y = [v * v for v in x]          # perfect, but non-linear, relationship
print("r for y = x² :", round(st.correlation(x, y), 3))
```

> [!warning] Pearson's r only measures *linear* relationships
> In the second example, $y$ is completely determined by $x$, yet $r = 0$. Always **plot** before you trust a correlation coefficient. Anscombe's quartet is four datasets with identical means, variances and correlations but completely different shapes.

### Correlation ≠ causation

Ice-cream sales correlate with drowning deaths. The cause of both is summer, a **confounder**. Other ways a correlation can mislead:

- **Reverse causation**: do happy employees perform better, or does performing well make people happy?
- **Selection bias**: you only see customers who didn't churn.
- **Simpson's paradox**: a trend appears in each group but reverses when the groups are combined, because the group sizes differ.

To establish causation, use **randomized experiments** (A/B tests, AI week 1) or careful causal-inference methods.

> [!example] Simpson's paradox in numbers
> Treatment A succeeds in 81/87 small cases (93%) and 192/263 large cases (73%). B succeeds in 234/270 small (87%) and 55/80 large (69%). A is better in *both* groups, but overall A = 273/350 = 78% and B = 289/350 = 83%, so B looks better. Why? A was given mostly the hard (large) cases.

> [!recap]
> - $r \in [-1, 1]$ measures **linear** association, so always plot as well.
> - Confounders, reverse causation and selection bias can all create correlations.
> - Simpson's paradox: aggregated data can reverse the trend within each group.

# Lesson: Choosing honest charts (20 min)

The right chart depends on the question:

| Question | Chart |
|---|---|
| How does a value change over time? | Line chart |
| How do categories compare? | Bar chart (sorted, starting at 0) |
| What is the distribution of one variable? | Histogram, box plot |
| How do two numeric variables relate? | Scatter plot |
| What is the share of a whole (few parts)? | Stacked bar; pie only for 2–3 slices |
| How do two categories cross? | Heatmap / matrix |

### Rules that keep charts honest

1. **Bar charts start at zero**, because bar length encodes the value. Line charts may zoom in, but label the axis.
2. **Sort categories** by value unless they have a natural order (months, sizes).
3. **One message per chart.** Put that message in the title: "Revenue grew 18% after the app launch", not "Revenue by month".
4. **Show the denominators.** A 50% conversion rate from 2 visitors means nothing.
5. **Color with purpose**: highlight the one thing that matters and grey out the rest. Never use color as the only way to tell series apart.

> [!connect] Where this goes
> BI week 5 (Power BI visual design and storytelling) builds directly on these rules. AI week 1 uses histograms and Q–Q plots to check assumptions.

> [!recap]
> - Pick the chart that matches the question. Bars start at zero.
> - Put the message in the title, highlight one thing, and show sample sizes.

# Quiz

## House prices are right-skewed. Which summary best represents a "typical" price?
- [ ] Mean
- [x] Median
- [ ] Range
- [ ] Mode of the raw prices
> A few mansions pull the mean up. The median is robust to that tail.

## Store A: 1000 orders averaging 50. Store B: 10 orders averaging 200. What is the combined average order value?
- [ ] 125
- [x] About 51.5
- [ ] 250
- [ ] 100
> (1000×50 + 10×200) / 1010 = 52,000/1,010 ≈ 51.5. Averaging the two averages (125) ignores the group sizes.

## Why do SRE teams monitor p99 latency rather than mean latency?
- [ ] The mean is impossible to compute in real time
- [x] Latency is skewed, and the mean hides the slow tail that real users experience
- [ ] p99 is always lower than the mean
- [ ] Percentiles are required by HTTP
> Tail latency affects many users, especially when one page makes dozens of requests.

## Two variables have Pearson correlation r = 0. What can you conclude?
- [ ] They are independent
- [x] There is no *linear* relationship; there could still be a strong non-linear one
- [ ] One causes the other
- [ ] The data has outliers
> y = x² over a symmetric range has r = 0 but a perfect relationship. Plot it!

## Ice cream sales and sunburn rates are strongly correlated. The most likely explanation is:
- [ ] Ice cream causes sunburn
- [ ] Sunburn causes ice-cream cravings
- [x] A confounder (hot, sunny weather) drives both
- [ ] Coincidence; correlations are random
> Summer weather is a common cause, also called a confounding variable.

## Which chart is best for showing how a single numeric variable is distributed?
- [ ] Pie chart
- [x] Histogram or box plot
- [ ] Line chart
- [ ] Stacked bar
> Histograms show the shape, and box plots show the median, IQR and outliers.

## According to the 1.5×IQR rule with Q1 = 20 and Q3 = 40, values above what are flagged as outliers?
- [ ] 40
- [ ] 60
- [x] 70
- [ ] 80
> IQR = 20, so the upper fence is 40 + 1.5×20 = 70.

# Exercise: Describe a dataset

Write `describe(values)` that returns a dict with the keys `n`, `mean`, `median`, `stdev` (sample), `q1`, `q3`, `iqr` and `outliers` (a sorted list of values outside the 1.5×IQR fences). Use the `statistics` module. For quartiles, use `statistics.quantiles(values, n=4)`, which returns `[q1, median, q3]`.

## Starter

```python
import statistics as st

def describe(values):
    return {}

print(describe([12, 15, 14, 10, 13, 15, 16, 14, 13, 80]))
```

## Tests

```python
ns = load()
d = ns["describe"]([12, 15, 14, 10, 13, 15, 16, 14, 13, 80])
assert d["n"] == 10 and abs(d["mean"] - 20.2) < 1e-9
assert d["median"] == 14
assert d["outliers"] == [80], d["outliers"]
assert abs(d["iqr"] - (d["q3"] - d["q1"])) < 1e-9
assert ns["describe"]([1, 2, 3, 4, 5, 6, 7, 8])["outliers"] == []
```

## Solution

```python
import statistics as st

def describe(values):
    q1, med, q3 = st.quantiles(values, n=4)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return {
        "n": len(values),
        "mean": st.fmean(values),
        "median": st.median(values),
        "stdev": st.stdev(values),
        "q1": q1, "q3": q3, "iqr": iqr,
        "outliers": sorted(v for v in values if v < lo or v > hi),
    }

print(describe([12, 15, 14, 10, 13, 15, 16, 14, 13, 80]))
```

pandas' `df.describe()` gives you the same summary for every column at once (*Python for Data*).

# Sources

- [OpenIntro Statistics (free textbook), chapters 1–2](https://www.openintro.org/book/os/)
- [Khan Academy: Summarizing quantitative data](https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data)
- *Storytelling with Data* by Cole Nussbaumer Knaflic (book)
- *How to Lie with Statistics* by Darrell Huff (book)
- [Python docs: statistics module](https://docs.python.org/3/library/statistics.html)
- [Wikipedia: Simpson's paradox (the kidney-stone example)](https://en.wikipedia.org/wiki/Simpson%27s_paradox)
