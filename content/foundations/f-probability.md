---
id: f-probability
title: Probability
week: Foundation 4
summary: Events, conditional probability, Bayes' rule, random variables, expectation and variance, key distributions and the Central Limit Theorem.
builds_on: f-algebra
leads_to: f-stats, ai-w1, ai-w2, ag-w1
---

Probability is the math of uncertainty. Statistics (AI week 1) uses it to draw conclusions from samples. Classifiers output probabilities (AI week 2). An LLM is literally a probability distribution over the next token, and **temperature** reshapes that distribution (Agentic week 1). Each idea here is paired with a quick **simulation**, because a few lines of code often build intuition faster than a formula does.

# Lesson: Events, rules and conditional probability (25 min)

A probability $P(A)$ is a number between 0 and 1 measuring how likely event $A$ is. With equally likely outcomes:

$$P(A) = \frac{\text{favourable outcomes}}{\text{all outcomes}}$$

The probability of rolling an even number on a fair die is $3/6 = 0.5$.

### Core rules

- **Complement:** $P(\text{not } A) = 1 - P(A)$
- **Union (or):** $P(A \cup B) = P(A) + P(B) - P(A \cap B)$. Subtract the overlap so it isn't counted twice.
- **Independence:** $A$ and $B$ are independent if $P(A \cap B) = P(A)P(B)$. For example, separate coin flips.

```python
import random
random.seed(1)
N = 100_000
# P(at least one six in 4 rolls) = 1 - (5/6)^4
hits = sum(any(random.randint(1, 6) == 6 for _ in range(4)) for _ in range(N))
print("simulated:", hits / N, " exact:", 1 - (5 / 6) ** 4)
```

> [!tip] "At least one" → use the complement
> "At least one success in $n$ independent tries" $= 1 - (1 - p)^n$. It's much easier than adding up every case.

### Conditional probability

$P(A \mid B)$ is the probability of $A$ **given** that $B$ happened. You restrict the world to the cases where $B$ is true:

$$P(A \mid B) = \frac{P(A \cap B)}{P(B)}$$

Suppose 30% of customers are students, and 12% of all customers are students who bought a laptop. Then $P(\text{laptop} \mid \text{student}) = 0.12 / 0.30 = 0.4$.

> [!recap]
> - Complement, union with the overlap subtracted, and independence as a product.
> - Conditioning means zooming into the world where $B$ is true.

# Lesson: Bayes' rule: updating beliefs with evidence (25 min)

Bayes' rule flips a conditional probability:

$$P(H \mid E) = \frac{P(E \mid H)\,P(H)}{P(E)}$$

- $P(H)$: the **prior**, your belief before seeing the evidence
- $P(E \mid H)$: the **likelihood**, how expected the evidence is if $H$ is true
- $P(H \mid E)$: the **posterior**, your updated belief

### The classic medical-test surprise

A disease affects 1% of people. A test catches 99% of real cases and gives false alarms 5% of the time. You test positive. How likely is it that you're sick?

$$P(\text{sick} \mid +) = \frac{0.99 \times 0.01}{0.99 \times 0.01 + 0.05 \times 0.99} \approx 0.167$$

Only about **17%**! The disease is rare, so false alarms from the 99% of healthy people outnumber the true positives.

```python
prior, sens, false_pos = 0.01, 0.99, 0.05
p_pos = sens * prior + false_pos * (1 - prior)
print("P(sick | +) =", round(sens * prior / p_pos, 3))

# The same thing, counted in an imaginary town of 10,000 people:
sick = 10_000 * prior
true_pos = sick * sens
false_alarm = (10_000 - sick) * false_pos
print(f"{true_pos:.0f} true positives vs {false_alarm:.0f} false alarms")
```

> [!connect] Base rates everywhere
> This is the **class imbalance** problem in ML (AI week 2). A fraud detector that's "99% accurate" may still flag mostly innocent transactions when fraud is rare. That's why we look at precision and recall instead of accuracy alone. **Naive Bayes** classifiers apply this rule directly (AI week 2).

> [!recap]
> - Posterior ∝ likelihood × prior.
> - When the base rate is rare, even accurate tests produce mostly false positives.

# Lesson: Random variables, expectation and variance (25 min)

A **random variable** $X$ assigns a number to each outcome, for example the value of a die roll, or the number of customers who arrive in an hour.

### Expectation (mean)

The **expected value** is the probability-weighted average, which is the long-run average:

$$E[X] = \sum_x x \, P(X = x)$$

For a fair die, $E[X] = (1+2+3+4+5+6)/6 = 3.5$, even though you can never actually roll 3.5. Expectation is **linear**: $E[aX + bY] = aE[X] + bE[Y]$, always.

### Variance and standard deviation

**Variance** measures spread: the expected squared distance from the mean. The **standard deviation** $\sigma$ is its square root, back in the original units.

$$\text{Var}(X) = E\big[(X - E[X])^2\big] \qquad \sigma = \sqrt{\text{Var}(X)}$$

```python
import random, statistics
random.seed(0)
rolls = [random.randint(1, 6) for _ in range(100_000)]
print("mean ≈", round(statistics.fmean(rolls), 3), "(exact 3.5)")
print("variance ≈", round(statistics.pvariance(rolls), 3), "(exact 35/12 =", round(35 / 12, 3), ")")
```

For independent variables, variances **add**: $\text{Var}(X + Y) = \text{Var}(X) + \text{Var}(Y)$. So the average of $n$ independent measurements has variance $\sigma^2/n$, and its standard deviation shrinks like $\sigma/\sqrt{n}$. This **square-root law** is why bigger samples give more precise estimates (AI week 1).

> [!recap]
> - $E[X]$ is the long-run average, and it's linear.
> - Variance is the average squared deviation, and $\sigma$ is its square root.
> - Averaging $n$ samples shrinks the spread by $\sqrt{n}$.

# Lesson: Distributions and the Central Limit Theorem (30 min)

A **distribution** describes how probability is spread over the possible values. Five appear again and again:

| Distribution | Models | Parameters | Mean |
|---|---|---|---|
| Bernoulli | One yes/no trial (click or no click) | $p$ | $p$ |
| Binomial | Number of successes in $n$ trials | $n, p$ | $np$ |
| Poisson | Count of events per interval (orders per hour) | $\lambda$ | $\lambda$ |
| Uniform | All values in $[a, b]$ equally likely | $a, b$ | $(a+b)/2$ |
| Normal (Gaussian) | Sums of many small effects (heights, errors) | $\mu, \sigma$ | $\mu$ |

Discrete distributions have a **PMF** (probability of each value). Continuous ones have a **PDF**, where probability is the *area* under the curve.

### The normal distribution

The bell curve:

$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$$

The **68–95–99.7 rule**: about 68% of values fall within $1\sigma$ of the mean, 95% within $2\sigma$ and 99.7% within $3\sigma$. A **z-score** $z = \frac{x - \mu}{\sigma}$ measures how many standard deviations a value is from the mean.

### The Central Limit Theorem (CLT)

> [!important] The most useful theorem in statistics
> The **average of many independent samples** is approximately normally distributed, *whatever the shape of the original distribution*, with mean $\mu$ and standard deviation $\sigma/\sqrt{n}$.

Watch it happen with a very non-normal distribution (die rolls are uniform):

```python
import random
random.seed(42)
def sample_mean(n):
    return sum(random.randint(1, 6) for _ in range(n)) / n

means = [sample_mean(30) for _ in range(20_000)]
# text histogram
lo, hi, bins = 2.5, 4.5, 20
counts = [0] * bins
for m in means:
    if lo <= m < hi:
        counts[int((m - lo) / (hi - lo) * bins)] += 1
for i, c in enumerate(counts):
    print(f"{lo + i * (hi - lo) / bins:4.2f} " + "█" * (c // 60))
```

A bell curve appears, centred on 3.5. The CLT is the reason confidence intervals and hypothesis tests work (AI week 1), and the reason A/B tests can compare means.

> [!connect] LLM sampling
> An LLM outputs a **categorical distribution** over its vocabulary. **Temperature** $T$ divides the scores (logits) before the softmax: $p_i \propto e^{z_i/T}$. Low $T$ makes it sharp, close to always picking the top token. High $T$ makes it flatter and more random (Agentic week 1, Full-Stack week 1).

> [!recap]
> - Know the five workhorse distributions and their means.
> - Normal: 68–95–99.7, and z-scores.
> - CLT: sample means are approximately normal with spread $\sigma/\sqrt{n}$.

# Quiz

## A fair coin is flipped 3 times. What is P(at least one head)?
- [ ] 1/2
- [ ] 3/8
- [x] 7/8
- [ ] 1
> Complement: $1 - P(\text{no heads}) = 1 - (1/2)^3 = 7/8$.

## If $P(A \cap B) = 0.1$ and $P(B) = 0.4$, what is $P(A \mid B)$?
- [ ] 0.04
- [x] 0.25
- [ ] 0.5
- [ ] 0.4
> $P(A\mid B) = P(A\cap B)/P(B) = 0.1/0.4$.

## A rare-disease test is 99% sensitive with a 5% false-positive rate, and the prevalence is 1%. After a positive result, the probability of having the disease is roughly:
- [ ] 99%
- [ ] 95%
- [ ] 50%
- [x] 17%
> Bayes' rule: the false positives from the large healthy group outnumber the true positives. Base rates matter.

## What is $E[2X + 3]$ if $E[X] = 5$?
- [ ] 10
- [x] 13
- [ ] 16
- [ ] Cannot be determined
> Expectation is linear: $2 \cdot 5 + 3 = 13$.

## Averaging $n$ independent measurements shrinks the standard deviation of the average by a factor of:
- [ ] $n$
- [x] $\sqrt{n}$
- [ ] $n^2$
- [ ] It doesn't change
> $\text{Var}(\bar{X}) = \sigma^2/n$, so the standard deviation is $\sigma/\sqrt{n}$. To halve the error you need 4× the data.

## Which distribution best models "number of orders arriving per hour"?
- [ ] Normal
- [ ] Bernoulli
- [x] Poisson
- [ ] Uniform
> Poisson models counts of independent events in a fixed interval.

## The Central Limit Theorem says that:
- [ ] All data is normally distributed
- [x] Means of large enough samples are approximately normal, whatever the original distribution
- [ ] Larger samples have larger variance
- [ ] The median equals the mean
> The CLT is about the distribution of *sample means*, not of the raw data.

## Lowering an LLM's sampling temperature makes its output:
- [x] More deterministic (probability concentrates on the top tokens)
- [ ] More creative and random
- [ ] Longer
- [ ] Faster to generate
> Dividing logits by a small $T$ exaggerates differences before the softmax, so the distribution becomes sharper.

# Exercise: Monte Carlo birthday paradox

Write `shared_birthday_prob(n, trials)` that **simulates** the probability that, in a group of `n` people, at least two share a birthday (365 equally likely days). Use `random`. Then write `exact(n)`, which computes it exactly with the complement: $1 - \prod_{k=0}^{n-1}\frac{365 - k}{365}$.

## Starter

```python
import random

def shared_birthday_prob(n, trials=10_000):
    pass

def exact(n):
    pass

print(exact(23), shared_birthday_prob(23))
```

## Tests

```python
ns = load()
assert abs(ns["exact"](23) - 0.5073) < 1e-3
assert abs(ns["exact"](1)) < 1e-12
import random
random.seed(7)
sim = ns["shared_birthday_prob"](23, 20000)
assert abs(sim - 0.507) < 0.03, sim
assert ns["shared_birthday_prob"](366, 50) == 1.0
```

## Hint

For one trial: draw `n` random days and check `len(set(days)) < n`. Count the successes and divide by `trials`.

## Solution

```python
import random

def shared_birthday_prob(n, trials=10_000):
    hits = 0
    for _ in range(trials):
        days = [random.randint(1, 365) for _ in range(n)]
        if len(set(days)) < n:
            hits += 1
    return hits / trials

def exact(n):
    p_unique = 1.0
    for k in range(n):
        p_unique *= (365 - k) / 365
    return 1 - p_unique

print(exact(23), shared_birthday_prob(23))
```

With only 23 people the chance passes 50%, because there are $\binom{23}{2} = 253$ pairs that could match.

# Sources

- [Seeing Theory: a visual introduction to probability (Brown University)](https://seeing-theory.brown.edu/)
- [Khan Academy: Statistics and Probability](https://www.khanacademy.org/math/statistics-probability)
- *Think Stats* and *Think Bayes* by Allen Downey (free at greenteapress.com)
- [3Blue1Brown: Bayes' theorem and the Central Limit Theorem videos](https://www.3blue1brown.com/topics/probability)
- [MIT OCW 18.05: Introduction to Probability and Statistics](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/)
