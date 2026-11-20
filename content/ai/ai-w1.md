---
id: ai-w1
title: Inferential Statistics
week: Week 1
summary: Sampling and sampling distributions, point estimation, confidence intervals, hypothesis testing, p-values, Type I/II errors and practical interpretation, all in Python.
builds_on: f-probability, f-stats, f-pydata
leads_to: ai-w2, ag-w5, fs-w11
---

Descriptive statistics summarize the data you *have*. **Inferential statistics** reason about what you *don't* have: the whole population, or the future. Is the new checkout really better, or was it luck? How precise is our estimate of average order value? This week gives you the tools, and just as important, the correct interpretations. Every example runs in the browser with NumPy and SciPy (the first run downloads them).

# Lesson: Populations, samples and sampling distributions (30 min)

- **Population**: everyone or everything you care about (all customers, all future orders).
- **Parameter**: a fixed but unknown number describing the population: the true mean $\mu$, the true conversion rate $p$.
- **Sample**: the data you actually observe.
- **Statistic**: a number computed from the sample: $\bar{x}$, $\hat{p}$. Different samples give different statistics.

The key idea: a statistic is a **random variable**. If you repeated the sampling many times, $\bar{x}$ would vary. Its distribution is the **sampling distribution**.

```python
import numpy as np
rng = np.random.default_rng(0)
# A skewed "population" of order values (log-normal, like real spending)
population = rng.lognormal(mean=4, sigma=0.8, size=1_000_000)
mu = population.mean()
print(f"true mean μ = {mu:.2f}")

for n in [10, 100, 1000]:
    means = np.array([rng.choice(population, n).mean() for _ in range(2000)])
    print(f"n={n:5}: mean of x̄ = {means.mean():7.2f}   spread (SE) = {means.std():6.2f}   "
          f"theory σ/√n = {population.std() / np.sqrt(n):6.2f}")
```

Two facts from the output:
1. $\bar{x}$ is **unbiased**: on average it equals $\mu$.
2. Its spread, the **standard error** $SE = \sigma/\sqrt{n}$, shrinks with $\sqrt{n}$. Ten times more data gives about 3.2 times more precision.

And by the **Central Limit Theorem** (Foundations: Probability), the sampling distribution of $\bar{x}$ is approximately **normal** even though the population is skewed. That's what makes confidence intervals and tests work.

### Sampling bias beats sample size

A huge biased sample is worse than a small random one. Classic biases: **selection bias** (surveying only app users), **survivorship bias** (studying only successful startups), **non-response bias** and **convenience samples**. Randomization is the cure.

> [!recap]
> - A parameter is fixed and unknown. A statistic varies from sample to sample.
> - SE = σ/√n. The CLT makes $\bar{x}$ approximately normal.
> - Bias isn't fixed by more data.

# Lesson: Point estimates and confidence intervals (30 min)

A **point estimate** is a single best guess: $\hat{\mu} = \bar{x}$, $\hat{p} = \frac{\text{successes}}{n}$. Good estimators are **unbiased** (right on average) and have **low variance**.

A **confidence interval (CI)** gives a range of plausible values:

$$\bar{x} \pm t^* \cdot \frac{s}{\sqrt{n}}$$

where $s$ is the sample standard deviation and $t^*$ comes from the **t distribution** with $n-1$ degrees of freedom (≈ 1.96 for 95% when $n$ is large).

```python
import numpy as np
from scipy import stats
rng = np.random.default_rng(1)
sample = rng.lognormal(4, 0.8, size=200)      # 200 observed order values
n, xbar, s = len(sample), sample.mean(), sample.std(ddof=1)
se = s / np.sqrt(n)
tcrit = stats.t.ppf(0.975, df=n - 1)
print(f"mean {xbar:.2f}, 95% CI [{xbar - tcrit * se:.2f}, {xbar + tcrit * se:.2f}]")
print(stats.t.interval(0.95, df=n - 1, loc=xbar, scale=se))   # same, via SciPy
```

### What "95% confidence" really means

> [!important] The correct interpretation
> If we repeated the whole procedure (sample → compute interval) many times, **95% of the intervals would contain the true μ**. For one computed interval, μ is either inside or not. The 95% describes the *method*, not this particular interval.

Let's verify by simulation:

```python
import numpy as np
from scipy import stats
rng = np.random.default_rng(2)
mu_true, covered = 50.0, 0
for _ in range(2000):
    x = rng.normal(mu_true, 12, size=30)
    lo, hi = stats.t.interval(0.95, df=29, loc=x.mean(), scale=x.std(ddof=1) / np.sqrt(30))
    covered += lo <= mu_true <= hi
print(f"coverage: {covered / 2000:.1%}")
```

### Proportions and the bootstrap

For a proportion: $\hat{p} \pm 1.96\sqrt{\hat{p}(1-\hat{p})/n}$ (fine when $n\hat p$ and $n(1-\hat p)$ are both ≥ 10).

When there's no convenient formula (medians, ratios, percentiles), use the **bootstrap**: resample your data **with replacement** many times, recompute the statistic each time, and take the 2.5th and 97.5th percentiles.

```python
import numpy as np
rng = np.random.default_rng(3)
latency = rng.lognormal(5, 0.6, size=300)
boot = [np.median(rng.choice(latency, len(latency), replace=True)) for _ in range(3000)]
print("median", round(np.median(latency), 1), "95% bootstrap CI", np.percentile(boot, [2.5, 97.5]).round(1))
```

> [!recap]
> - CI = estimate ± critical value × SE. Wider for more confidence, narrower with more data.
> - "95%" refers to the long-run coverage of the method.
> - The bootstrap gives CIs for almost any statistic.

# Lesson: Hypothesis testing and p-values (35 min)

A hypothesis test asks: **is the observed effect larger than what random chance alone would plausibly produce?**

1. **Null hypothesis $H_0$**: "no effect" (new checkout conversion = old).
2. **Alternative $H_1$**: there is an effect (≠, or > for one-sided tests).
3. Choose a **significance level** $\alpha$ (often 0.05) **before** looking at the data.
4. Compute a **test statistic** from the data, and its **p-value**.
5. If $p < \alpha$, reject $H_0$. Otherwise, fail to reject it (which is *not* the same as proving $H_0$).

### The p-value, defined precisely

> [!definition] p-value
> The probability, **assuming $H_0$ is true**, of getting a result at least as extreme as the one observed.

It is **not** the probability that $H_0$ is true, and **not** the probability that the result is due to chance.

### A/B test with a permutation test (the idea, made concrete)

If the change had no effect, the labels "A" and "B" would be arbitrary. So shuffle the labels many times and see how often a difference as large as the observed one appears:

```python
import numpy as np
rng = np.random.default_rng(4)
# 1 = converted. A: old checkout, B: new checkout
A = rng.binomial(1, 0.10, size=2000)
B = rng.binomial(1, 0.12, size=2000)
observed = B.mean() - A.mean()
pooled = np.concatenate([A, B])
diffs = []
for _ in range(5000):
    rng.shuffle(pooled)
    diffs.append(pooled[2000:].mean() - pooled[:2000].mean())
p = np.mean(np.abs(diffs) >= abs(observed))
print(f"A={A.mean():.3f} B={B.mean():.3f} diff={observed:.3f}  permutation p≈{p:.4f}")
```

### Classical tests in SciPy

```python
import numpy as np
from scipy import stats
rng = np.random.default_rng(5)
old = rng.normal(52, 10, 120)      # e.g. minutes on site
new = rng.normal(55, 10, 120)
print(stats.ttest_ind(new, old, equal_var=False))            # Welch's two-sample t-test
print(stats.ttest_rel(new[:30], new[:30] + rng.normal(1, 2, 30)))   # paired (before/after on the same units)
table = np.array([[200, 1800], [240, 1760]])                 # conversions vs non-conversions
chi2, p, dof, _ = stats.chi2_contingency(table)
print(f"chi-square p = {p:.4f}")
print(stats.mannwhitneyu(new, old))                          # non-parametric alternative
```

| Situation | Test |
|---|---|
| Compare 2 group means | Welch's t-test (`ttest_ind`, `equal_var=False`) |
| Before/after on the same units | Paired t-test (`ttest_rel`) |
| Compare proportions / categorical association | Chi-square test or z-test for proportions |
| Skewed data, small samples | Mann–Whitney U, or bootstrap/permutation |
| 3+ group means | ANOVA (`f_oneway`), then post-hoc comparisons |

> [!recap]
> - H0 vs H1, α chosen in advance, test statistic, p-value, decision.
> - The p-value is P(data at least this extreme | H0), not P(H0 | data).
> - Permutation tests show the logic directly. Pick the classical test that fits the data.

# Lesson: Errors, power and practical significance (25 min)

| | $H_0$ true | $H_0$ false |
|---|---|---|
| Reject $H_0$ | **Type I error** (false positive), probability α | Correct (power = 1 − β) |
| Fail to reject | Correct | **Type II error** (false negative), probability β |

**Power** is the probability of detecting a real effect of a given size. It increases with **sample size**, **effect size** and α, and decreases with noise. Plan your sample size *before* the experiment:

```python
import numpy as np
from scipy import stats
def n_per_group(p1, p2, alpha=0.05, power=0.8):
    """Approximate sample size per group to detect p1 -> p2 (two-sided z-test)."""
    za, zb = stats.norm.ppf(1 - alpha / 2), stats.norm.ppf(power)
    pbar = (p1 + p2) / 2
    num = (za * np.sqrt(2 * pbar * (1 - pbar)) + zb * np.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    return int(np.ceil(num / (p2 - p1) ** 2))

for lift in [0.02, 0.01, 0.005]:
    print(f"10% -> {10 + lift * 100:.1f}%: need ~{n_per_group(0.10, 0.10 + lift):,} users per group")
```

Detecting small effects needs a lot of data. Halving the effect roughly quadruples the sample size.

### Statistical vs practical significance

With millions of users, a 0.01% difference can be "significant" (p < 0.001) yet worthless. Always report the **effect size with its confidence interval** ("+1.8 percentage points, 95% CI [0.9, 2.7]") and ask whether it matters for the business.

### Common traps

- **Peeking**: checking the p-value daily and stopping when it dips below 0.05 inflates false positives. Fix the sample size in advance, or use sequential methods.
- **Multiple comparisons**: test 20 metrics and about one will be "significant" by chance. Use corrections (Bonferroni, Holm, false discovery rate) and pre-registered primary metrics.
- **p-hacking**: trying analyses until something is significant.
- **Confusing "not significant" with "no effect"**: the test may simply be underpowered.

> [!connect] Evaluating models and LLMs
> Is model B really better than model A on your eval set, or is it noise? The same tools apply: confidence intervals on accuracy, paired tests on the same examples and bootstrap resampling (Agentic week 5, Full-Stack week 11).

> [!recap]
> - Type I = false positive (α). Type II = false negative (β). Power = 1 − β.
> - Plan the sample size. Report effect sizes with CIs.
> - Avoid peeking, multiple comparisons and p-hacking.

# Quiz

## The standard error of the mean is σ/√n. To halve it, you need:
- [ ] Twice the data
- [x] Four times the data
- [ ] Half the data
- [ ] The same data at 99% confidence
> SE ∝ 1/√n, so halving it needs 4× the n.

## Which statement about a 95% CI of [12.1, 15.3] is correct?
- [ ] There's a 95% probability μ is in [12.1, 15.3]
- [x] The procedure that produced it captures μ in 95% of repeated samples
- [ ] 95% of the data lies in [12.1, 15.3]
- [ ] μ = 13.7 with 95% certainty
> The confidence describes the method's long-run coverage.

## A test gives p = 0.03. What does this mean?
- [ ] There's a 3% chance H0 is true
- [x] If H0 were true, results at least this extreme would occur about 3% of the time
- [ ] The effect is large
- [ ] There's a 97% chance the effect is real
> It's a probability computed under H0, not the probability of H0.

## A Type I error is:
- [x] Rejecting H0 when it's actually true (a false positive)
- [ ] Failing to reject a false H0
- [ ] A coding bug
- [ ] Using the wrong test
> Its probability is α.

## You compare the same users' metrics before and after a change. Which test fits?
- [ ] Welch's two-sample t-test
- [x] Paired t-test
- [ ] Chi-square test
- [ ] ANOVA
> Paired data: the two measurements per unit aren't independent.

## You test 20 metrics at α = 0.05 with no real effects. How many "significant" results do you expect by chance?
- [ ] 0
- [x] About 1
- [ ] 5
- [ ] 20
> 20 × 0.05 = 1. That's the multiple-comparisons problem.

## An A/B test with 10 million users shows +0.02% conversion, p < 0.001. Best interpretation?
- [ ] Ship it, the effect is huge
- [x] Statistically significant, but check whether a 0.02% lift is practically meaningful
- [ ] The test is broken
- [ ] p-values don't apply to large samples
> With huge n, tiny effects become significant. Judge the effect size and its business value.

## When is a bootstrap confidence interval especially useful?
- [ ] Only for normal data
- [x] For statistics without easy formulas, like the median or a ratio
- [ ] To increase the sample size
- [ ] To remove outliers
> Resampling approximates the sampling distribution of almost any statistic.

# Exercise: Bootstrap confidence interval

Write `bootstrap_ci(data, stat, n_boot=2000, alpha=0.05, seed=0)` that returns a `(low, high)` tuple: the percentile bootstrap CI for any statistic function `stat` (like `np.mean` or `np.median`). Use `np.random.default_rng(seed)`.

## Starter

```python
import numpy as np

def bootstrap_ci(data, stat, n_boot=2000, alpha=0.05, seed=0):
    pass

x = np.random.default_rng(1).normal(100, 15, 400)
print(bootstrap_ci(x, np.mean))
```

## Tests

```python
import numpy as np
ns = load()
f = ns["bootstrap_ci"]
x = np.random.default_rng(1).normal(100, 15, 400)
lo, hi = f(x, np.mean)
assert lo < x.mean() < hi
assert 2.0 < hi - lo < 4.0, (lo, hi)              # theory: about 2 × 1.96 × 15/20 ≈ 2.9
assert f(x, np.mean) == f(x, np.mean), "must be reproducible with the same seed"
lo2, hi2 = f(x, np.mean, alpha=0.01)
assert hi2 - lo2 > hi - lo, "99% CI should be wider"
lo3, hi3 = f(x, np.median)
assert lo3 < np.median(x) < hi3
```

## Hint

Draw indices with `rng.integers(0, n, size=(n_boot, n))` (fast), or loop with `rng.choice(data, n, replace=True)`. Apply `stat` to each resample, then `np.percentile(stats, [100*alpha/2, 100*(1-alpha/2)])`.

## Solution

```python
import numpy as np

def bootstrap_ci(data, stat, n_boot=2000, alpha=0.05, seed=0):
    rng = np.random.default_rng(seed)
    data = np.asarray(data)
    n = len(data)
    idx = rng.integers(0, n, size=(n_boot, n))
    stats_ = np.array([stat(data[row]) for row in idx])
    lo, hi = np.percentile(stats_, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(lo), float(hi)

x = np.random.default_rng(1).normal(100, 15, 400)
print(bootstrap_ci(x, np.mean))
```

# Exercise: Analyze an A/B test

Write `ab_test(conv_a, n_a, conv_b, n_b)` that returns a dict with: `p_a`, `p_b`, `diff` (p_b − p_a), `ci` (a 95% CI for the difference using the unpooled SE $\sqrt{\frac{p_a(1-p_a)}{n_a}+\frac{p_b(1-p_b)}{n_b}}$), and `p_value` (a two-sided z-test using the **pooled** proportion for the SE). Round nothing.

## Starter

```python
import math
from scipy import stats

def ab_test(conv_a, n_a, conv_b, n_b):
    pass

print(ab_test(200, 2000, 250, 2000))
```

## Tests

```python
ns = load()
r = ns["ab_test"](200, 2000, 250, 2000)
assert abs(r["p_a"] - 0.10) < 1e-12 and abs(r["p_b"] - 0.125) < 1e-12
assert abs(r["diff"] - 0.025) < 1e-12
lo, hi = r["ci"]
assert abs(lo - 0.00557) < 5e-4 and abs(hi - 0.04443) < 5e-4, r["ci"]
assert abs(r["p_value"] - 0.0118) < 2e-3, r["p_value"]
r2 = ns["ab_test"](100, 1000, 101, 1000)
assert r2["p_value"] > 0.5
```

## Solution

```python
import math
from scipy import stats

def ab_test(conv_a, n_a, conv_b, n_b):
    p_a, p_b = conv_a / n_a, conv_b / n_b
    diff = p_b - p_a
    se = math.sqrt(p_a * (1 - p_a) / n_a + p_b * (1 - p_b) / n_b)
    z95 = stats.norm.ppf(0.975)
    pooled = (conv_a + conv_b) / (n_a + n_b)
    se0 = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    z = diff / se0
    p_value = 2 * (1 - stats.norm.cdf(abs(z)))
    return {"p_a": p_a, "p_b": p_b, "diff": diff, "ci": (diff - z95 * se, diff + z95 * se), "p_value": p_value}

print(ab_test(200, 2000, 250, 2000))
```

The pooled SE is used for the test because it assumes H0 (equal rates). The CI uses the unpooled SE because it describes the actual difference.

# Sources

- [OpenIntro Statistics (free), chapters 5–7: foundations for inference](https://www.openintro.org/book/os/)
- [SciPy: scipy.stats reference (t-tests, chi-square, distributions)](https://docs.scipy.org/doc/scipy/reference/stats.html)
- Wasserstein & Lazar (2016), "The ASA Statement on p-Values: Context, Process, and Purpose", *The American Statistician*
- *Trustworthy Online Controlled Experiments* by Kohavi, Tang & Xu (A/B testing at scale)
- [Seeing Theory: Frequentist inference (interactive)](https://seeing-theory.brown.edu/frequentist-inference/)
- *Statistics* by Freedman, Pisani & Purves (classic intuition-first textbook)
