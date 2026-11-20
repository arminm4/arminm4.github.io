---
id: f-algebra
title: Algebra & Functions
week: Foundation 1
summary: Functions, absolute value, powers and roots, exponentials and logarithms, summation notation: the math vocabulary of programming and ML.
leads_to: py-w1, f-calculus, f-stats
---

The Python and AI bootcamps both expect "basic math: functions, absolute value, radicals, limits". This module covers exactly that, framed the way programmers and ML engineers use it. Each idea comes with Python code that computes it, so you build the habit of turning math into code.

# Lesson: Functions: machines that map inputs to outputs (20 min)

A **function** $f$ assigns to each input $x$ exactly **one** output $f(x)$. Think of a function as a machine: something goes in, and a predictable result comes out.

$$f(x) = 2x + 3 \quad\Rightarrow\quad f(4) = 11$$

The set of allowed inputs is the **domain**, and the set of possible outputs is the **range**. For $g(x) = \sqrt{x}$ the domain is $x \ge 0$ (in real numbers). For $h(x) = \frac{1}{x}$ the domain excludes $0$.

```python
def f(x):
    return 2 * x + 3

def h(x):
    return 1 / x

print(f(4), f(-1.5))
print(h(4))
# h(0) would raise ZeroDivisionError: 0 is outside the domain
```

> [!connect] Math functions → Python functions → ML models
> A Python `def` is a function in this mathematical sense (if it has no side effects). A machine-learning model is also a function, $\hat{y} = f(x)$, whose formula is *learned from data* instead of written by hand. You'll write these in Python week 3 and train them in AI week 2.

### Linear functions

$f(x) = mx + b$ draws a straight line. $m$ is the **slope** (how much $f$ changes when $x$ increases by 1), and $b$ is the **intercept** (the value at $x = 0$). If a taxi costs 30,000 to start plus 12,000 per km, the cost is $c(d) = 12000d + 30000$.

Slope between two points: $m = \frac{y_2 - y_1}{x_2 - x_1}$. That is "rise over run".

### Composition

Functions can feed into each other: $(f \circ g)(x) = f(g(x))$. Order matters:

```python
def f(x): return 2 * x + 3
def g(x): return x ** 2

print(f(g(3)))  # f(9)  = 21
print(g(f(3)))  # g(9)  = 81
```

> [!intuition] Deep learning is composition
> A neural network is a long composition of simple functions: $f_3(f_2(f_1(x)))$. The chain rule (Calculus) tells us how to train such compositions.

### Inverse functions

An inverse "undoes" a function: if $f(x) = 2x + 3$, then $f^{-1}(y) = \frac{y - 3}{2}$. Only functions that never map two inputs to the same output have inverses. $x^2$ doesn't, because $(-2)^2 = 2^2$. That's why $\sqrt{x}$ is defined only as the *non-negative* root.

> [!recap]
> - A function maps each input to exactly one output. It has a domain and a range.
> - Linear functions have the form $mx + b$, where the slope is rise over run.
> - Composition $f(g(x))$ is the basis of neural networks. Inverses undo functions.

# Lesson: Absolute value, powers and roots (20 min)

### Absolute value

$|x|$ is the **distance from 0**, so it's never negative: $|-7| = 7$ and $|3| = 3$. The distance between two numbers is $|a - b|$.

$$|x| = \begin{cases} x & x \ge 0 \\ -x & x < 0 \end{cases}$$

```python
print(abs(-7), abs(3.5))
a, b = 12, 19
print("distance:", abs(a - b))
# Mean absolute error between predictions and truth:
y_true = [3, 5, 2]
y_pred = [2.5, 5, 4]
mae = sum(abs(t - p) for t, p in zip(y_true, y_pred)) / len(y_true)
print("MAE:", mae)
```

Inequalities with absolute values: $|x - 5| < 2$ means "$x$ is within 2 of 5", that is, $3 < x < 7$. This is exactly how you test whether two floats are "close enough": `abs(a - b) < 1e-9`.

### Powers (exponents)

$a^n$ means $a$ multiplied by itself $n$ times. The rules all follow from that definition:

| Rule | Example |
|---|---|
| $a^m \cdot a^n = a^{m+n}$ | $2^3 \cdot 2^2 = 2^5 = 32$ |
| $(a^m)^n = a^{mn}$ | $(2^3)^2 = 2^6 = 64$ |
| $a^0 = 1$ | $5^0 = 1$ |
| $a^{-n} = \frac{1}{a^n}$ | $2^{-3} = \frac{1}{8}$ |
| $a^{1/n} = \sqrt[n]{a}$ | $8^{1/3} = 2$ |

```python
print(2 ** 10, 2 ** -3, 8 ** (1/3), 16 ** 0.5)
```

### Roots (radicals)

$\sqrt{x}$ is the non-negative number whose square is $x$. Useful rules: $\sqrt{ab} = \sqrt{a}\sqrt{b}$ and $\sqrt{a^2} = |a|$ (not $a$!).

The **Euclidean distance** between points $(x_1, y_1)$ and $(x_2, y_2)$ comes from Pythagoras:

$$d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

```python
import math
p, q = (1, 2), (4, 6)
print(math.sqrt((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2))  # 5.0
print(math.dist(p, q))
```

> [!connect] Where you'll see this
> Euclidean distance drives K-Nearest Neighbours and K-Means (AI week 3). Squared errors give MSE, the loss function of linear regression (AI week 2). The square root of the variance is the standard deviation (*Descriptive Statistics*).

### Scientific notation and orders of magnitude

$6.02 \times 10^{23}$ is written `6.02e23` in code, and `1e-9` means $10^{-9}$. Engineers reason in orders of magnitude: a GPU does about $10^{14}$ operations per second, and a network round trip takes about $10^{-1}$ s.

> [!recap]
> - $|x|$ is a distance, and $|a - b|$ is the distance between $a$ and $b$.
> - Negative and fractional exponents mean reciprocals and roots.
> - $\sqrt{a^2} = |a|$. Euclidean distance comes from Pythagoras.

# Lesson: Exponentials and logarithms (25 min)

### Exponential growth

$f(x) = a \cdot b^x$ grows by a constant **factor** $b$ per step. A savings balance growing 20% a year is $P \cdot 1.2^t$. Exponentials eventually beat every polynomial: $2^x$ overtakes $x^{10}$ for large $x$.

The special base $e \approx 2.71828$ arises naturally in continuous growth: $\left(1 + \frac{1}{n}\right)^n \to e$ as $n \to \infty$.

```python
import math
for n in [1, 10, 100, 10_000, 1_000_000]:
    print(n, (1 + 1/n) ** n)
print("e =", math.e)
```

### Logarithms answer "what power?"

$\log_b(x) = y$ means $b^y = x$. So $\log_2(8) = 3$ and $\log_{10}(1000) = 3$. The **natural log** $\ln x = \log_e x$.

| Rule | Meaning |
|---|---|
| $\log(ab) = \log a + \log b$ | logs turn products into sums |
| $\log(a/b) = \log a - \log b$ | and quotients into differences |
| $\log(a^n) = n \log a$ | and powers into products |
| $\log_b x = \frac{\ln x}{\ln b}$ | change of base |

```python
import math
print(math.log2(1024), math.log10(1e6), math.log(math.e ** 3))
print(math.log(6), math.log(2) + math.log(3))   # product rule
```

### Why programmers love logarithms

- **Binary search** halves the search space each step, so it needs $\log_2 n$ steps. A million sorted items take about 20 steps. This is why database indexes (B-trees) are fast (BI week 2).
- **Bits**: you need $\lceil \log_2 n \rceil$ bits to represent $n$ different values.
- **Log scales** make multiplicative data readable: incomes, populations, latencies.

```python
import math
for n in [1_000, 1_000_000, 1_000_000_000]:
    print(f"{n:>13,} items -> {math.ceil(math.log2(n))} binary-search steps")
```

### Why ML loves logarithms

Multiplying many probabilities (each < 1) underflows to 0 in floating point. Taking logs turns the product into a sum, which is numerically stable:

$$\log \prod_i p_i = \sum_i \log p_i$$

That's why models maximize **log-likelihood** and minimize **cross-entropy loss** $-\log p$ (AI week 2). The **sigmoid** $\sigma(z) = \frac{1}{1 + e^{-z}}$ and **softmax** functions also use $e^x$.

```python
import math
probs = [0.01] * 400
prod = 1.0
for p in probs:
    prod *= p
print("product:", prod)                        # underflows to 0.0
print("log-sum:", sum(math.log(p) for p in probs))
```

> [!recap]
> - Exponentials multiply by a constant factor per step. $e$ is the natural base.
> - $\log_b x$ asks "what power of $b$ gives $x$?" Logs turn products into sums.
> - Logs explain binary-search speed and make probability computations stable.

# Lesson: Sequences and summation notation (15 min)

$\sum$ (capital sigma) is shorthand for "add these up". It's a `for` loop in math notation:

$$\sum_{i=1}^{n} x_i = x_1 + x_2 + \cdots + x_n$$

```python
x = [4, 8, 15, 16, 23, 42]
total = 0
for xi in x:          # Σ x_i
    total += xi
print(total, sum(x))
```

The **mean** is $\bar{x} = \frac{1}{n}\sum_{i=1}^n x_i$. **Mean squared error** is $\frac{1}{n}\sum_{i=1}^n (y_i - \hat{y}_i)^2$. Once you can read Σ as a loop, most ML formulas become readable.

Product notation $\prod$ works the same way with multiplication. Two useful closed forms:

$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2} \qquad \sum_{k=0}^{n-1} r^k = \frac{1 - r^n}{1 - r}$$

The second is the **geometric series**: it explains why compound interest and "discounted future rewards" (in reinforcement learning) have closed forms.

```python
n = 100
print(sum(range(1, n + 1)), n * (n + 1) // 2)
r = 0.9
print(sum(r ** k for k in range(50)), (1 - r ** 50) / (1 - r))
```

> [!tip] Reading formulas
> When you see a dense formula, translate it piece by piece into a loop. Then run it on 3 small numbers by hand. This trick makes even research papers approachable.

> [!recap]
> - $\sum_{i=1}^n$ is a for-loop that adds, and $\prod$ multiplies.
> - Mean, MSE and many loss functions are just sums divided by $n$.

# Quiz

## If $f(x) = x^2$ and $g(x) = x + 1$, what is $f(g(2))$?
- [ ] 5
- [x] 9
- [ ] 6
- [ ] 4
> $g(2) = 3$, then $f(3) = 9$. The inner function is applied first.

## What is $|3 - 10|$?
- [ ] -7
- [x] 7
- [ ] 13
- [ ] 3
> Absolute value is a distance, so it's never negative.

## Which equals $2^{-3}$?
- [ ] -8
- [ ] -6
- [x] 1/8
- [ ] 8
> A negative exponent means a reciprocal: $2^{-3} = 1/2^3 = 1/8$.

## $\log_2(1024) = ?$
- [ ] 512
- [x] 10
- [ ] 2
- [ ] 1024/2
> $2^{10} = 1024$. A logarithm asks "what power?"

## Why do ML libraries add up log-probabilities instead of multiplying probabilities?
- [ ] Addition is more accurate than multiplication for integers
- [x] Products of many small numbers underflow to zero in floating point; sums of logs stay in range
- [ ] Logarithms make probabilities larger than 1
- [ ] Because $\log(a+b) = \log a + \log b$
> $\log \prod p_i = \sum \log p_i$ is numerically stable. The last option is a classic mistake: it's the *product* rule, $\log(ab) = \log a + \log b$.

## About how many steps does binary search need for 1,000,000 sorted items?
- [ ] 1,000
- [ ] 500,000
- [x] 20
- [ ] 1
> Each step halves the range, and $\log_2(10^6) \approx 20$.

## What does $\sum_{i=1}^{4} 2i$ equal?
- [ ] 8
- [x] 20
- [ ] 10
- [ ] 16
> $2 + 4 + 6 + 8 = 20$.

## $\sqrt{(-5)^2}$ equals:
- [ ] -5
- [x] 5
- [ ] ±5
- [ ] 25
> $\sqrt{a^2} = |a|$. The square-root symbol always means the non-negative root.

# Exercise: Compound growth calculator

Read three lines: a starting amount `P`, an annual growth rate in percent `r`, and a number of years `t`. Print the final amount $P(1 + r/100)^t$ rounded to 2 decimals. Then, on a second line, print how many **whole** years it takes for the amount to at least **double**. Use a loop for the second part.

## Starter

```python
P = float(input())
r = float(input())
t = int(input())

```

## Tests

```python
out = run_program(["1000", "10", "3"]).split()
assert out[0] == "1331.0" or out[0] == "1331.00", out
assert out[1] == "8", "at 10% it takes 8 years to double"
out = run_program(["500", "7", "1"]).split()
assert out[1] == "11"
```

## Hint

For the doubling: start with `years = 0`, `amount = P`. Then repeat `amount *= 1 + r/100` and `years += 1` until `amount >= 2 * P`. A `while` loop fits naturally, or a `for` loop with `break`. Bonus: compare your answer with the **rule of 72**: years ≈ 72 / r.

## Solution

```python
P = float(input())
r = float(input())
t = int(input())
print(round(P * (1 + r / 100) ** t, 2))

amount, years = P, 0
while amount < 2 * P:
    amount *= 1 + r / 100
    years += 1
print(years)
```

Exact answer: $t = \frac{\ln 2}{\ln(1 + r)}$. For 10% that's 7.27, so 8 whole years.

# Exercise: Distances and errors

Write a program that reads two lines, each holding numbers separated by spaces, of equal length: true values and predicted values. Print three numbers rounded to 3 decimals, one per line: the **MAE** $\frac{1}{n}\sum|y_i - \hat y_i|$, the **MSE** $\frac{1}{n}\sum (y_i - \hat y_i)^2$ and the **RMSE** $\sqrt{\text{MSE}}$.

## Starter

```python
y = list(map(float, input().split()))
p = list(map(float, input().split()))

```

## Tests

```python
out = run_program(["3 5 2", "2.5 5 4"]).split()
assert out == ["0.833", "1.417", "1.19"], out
out = run_program(["1 1", "1 1"]).split()
assert [float(v) for v in out] == [0, 0, 0]
```

## Solution

```python
import math
y = list(map(float, input().split()))
p = list(map(float, input().split()))
n = len(y)
mae = sum(abs(a - b) for a, b in zip(y, p)) / n
mse = sum((a - b) ** 2 for a, b in zip(y, p)) / n
print(round(mae, 3))
print(round(mse, 3))
print(round(math.sqrt(mse), 3))
```

MSE punishes big errors much more than MAE does, because squaring a 2 gives 4 while squaring a 0.5 gives 0.25. That's why a model trained with MSE tries hard to avoid outliers in its errors.

# Sources

- [Khan Academy: Algebra 1 and Algebra 2 (functions, exponents, logarithms)](https://www.khanacademy.org/math/algebra2)
- [OpenStax: College Algebra 2e (free textbook), chapters 3–4 and 6](https://openstax.org/details/books/college-algebra-2e)
- [3Blue1Brown: "What makes the natural log natural?" and the Essence of Calculus series](https://www.3blue1brown.com/)
- [Python docs: math module](https://docs.python.org/3/library/math.html)
- *Mathematics for Machine Learning* by Deisenroth, Faisal & Ong (free PDF at mml-book.com): background chapters
