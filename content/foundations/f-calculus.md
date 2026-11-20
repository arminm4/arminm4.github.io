---
id: f-calculus
title: Calculus for ML
week: Foundation 3
summary: Limits, derivatives, the chain rule, partial derivatives, gradients and gradient descent: how models learn.
builds_on: f-algebra, f-linalg
leads_to: ai-w2, ai-w7, ai-w8
---

Machine learning is optimization: choose the parameters that make the error as small as possible. Calculus tells us **which way is downhill**. You don't need to compute hard integrals by hand. You need a solid intuition for *rates of change* and the *chain rule*, and that's what this module builds.

# Lesson: Limits and the idea of a derivative (25 min)

### Limits

A **limit** describes what a function approaches as its input approaches some value, even if the function isn't defined exactly there:

$$\lim_{x \to 0} \frac{\sin x}{x} = 1$$

```python
import math
for x in [0.5, 0.1, 0.01, 0.001, 1e-6]:
    print(x, math.sin(x) / x)
```

We never plug in $x = 0$ (that would be $0/0$); we watch the trend. Limits also describe the behaviour at infinity: $\lim_{x\to\infty} \frac{1}{x} = 0$. The sigmoid $\sigma(x) = \frac{1}{1+e^{-x}}$ approaches 1 as $x \to \infty$ and 0 as $x \to -\infty$.

### The derivative: instantaneous rate of change

Average rate of change between $x$ and $x + h$ is the slope of the line through the two points:

$$\frac{f(x+h) - f(x)}{h}$$

The **derivative** is the limit as $h \to 0$. It's the slope of the tangent line at a single point:

$$f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}$$

```python
def f(x):
    return x ** 2

def numeric_derivative(f, x, h=1e-6):
    return (f(x + h) - f(x - h)) / (2 * h)   # central difference: more accurate

for x in [-2, 0, 1, 3]:
    print(x, round(numeric_derivative(f, x), 4), "exact:", 2 * x)
```

> [!intuition] What the sign tells you
> - $f'(x) > 0$: the function is going **up** as you move right.
> - $f'(x) < 0$: it's going **down**.
> - $f'(x) = 0$: a flat spot, which could be a minimum, a maximum or a plateau.
>
> To *minimize* a function, step in the direction **opposite** to the derivative. That one sentence is gradient descent.

> [!recap]
> - A limit is the value a function approaches.
> - The derivative is the slope of the tangent: the limit of rise/run as the run shrinks to 0.
> - You can estimate a derivative numerically with a tiny $h$, which is how you check gradient code.

# Lesson: Derivative rules and the chain rule (30 min)

You rarely use the limit definition directly. A few rules cover almost everything:

| Function | Derivative |
|---|---|
| $c$ (constant) | $0$ |
| $x^n$ | $n x^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $c \cdot f(x)$ | $c \cdot f'(x)$ |
| $f(x) + g(x)$ | $f'(x) + g'(x)$ |
| $f(x)\,g(x)$ | $f'(x)g(x) + f(x)g'(x)$ (product rule) |

Example: $\frac{d}{dx}(3x^4 - 2x + 7) = 12x^3 - 2$.

### The chain rule

When functions are **composed**, as in $y = f(g(x))$, derivatives **multiply** along the chain:

$$\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$$

Or in Leibniz notation with $u = g(x)$: $\frac{dy}{dx} = \frac{dy}{du}\cdot\frac{du}{dx}$.

**Example:** $y = (3x + 1)^2$. Outer: $u^2 \to 2u$. Inner: $3x+1 \to 3$. So $y' = 2(3x+1)\cdot 3 = 6(3x+1)$.

```python
def y(x): return (3 * x + 1) ** 2
def dy(x): return 6 * (3 * x + 1)

h = 1e-6
for x in [0, 1, 2]:
    print(x, dy(x), round((y(x + h) - y(x - h)) / (2 * h), 4))
```

> [!important] Backpropagation = the chain rule, organized
> A neural network is a long chain: input → layer 1 → layer 2 → … → loss. To learn, you need $\frac{\partial \text{loss}}{\partial w}$ for every weight. Backpropagation (AI week 7) applies the chain rule from the loss backwards, reusing intermediate results. PyTorch's `autograd` does this automatically.

### Two derivatives you'll meet constantly

Sigmoid: $\sigma(z) = \frac{1}{1 + e^{-z}}$, with $\sigma'(z) = \sigma(z)(1 - \sigma(z))$.

ReLU: $\text{ReLU}(z) = \max(0, z)$, whose derivative is $1$ if $z > 0$ and $0$ otherwise.

```python
import math
def sigmoid(z): return 1 / (1 + math.exp(-z))
for z in [-6, -2, 0, 2, 6]:
    s = sigmoid(z)
    print(f"z={z:>3}  σ={s:.4f}  σ'={s * (1 - s):.4f}")
```

Notice that $\sigma'$ is tiny for large $|z|$, at most 0.25. Multiply many of those along a deep chain and the gradient vanishes. That's the **vanishing gradient problem**, and the reason modern networks prefer ReLU (AI week 8).

> [!recap]
> - Power, exponential and log rules plus linearity cover most cases.
> - Chain rule: the derivatives of composed functions multiply.
> - Sigmoid gradients are at most 0.25, which leads to vanishing gradients in deep chains.

# Lesson: Partial derivatives and the gradient (25 min)

Real models have many parameters. For a function of several variables $f(w_1, w_2)$, the **partial derivative** $\frac{\partial f}{\partial w_1}$ is the derivative with respect to $w_1$, treating every other variable as a constant.

$$f(w_1, w_2) = w_1^2 + 3w_1 w_2 \quad\Rightarrow\quad \frac{\partial f}{\partial w_1} = 2w_1 + 3w_2, \quad \frac{\partial f}{\partial w_2} = 3w_1$$

The **gradient** collects all the partial derivatives into a vector:

$$\nabla f = \left[\frac{\partial f}{\partial w_1}, \frac{\partial f}{\partial w_2}, \ldots\right]$$

> [!intuition] The gradient points uphill
> Picture standing on a hilly landscape where the height is the loss. The gradient points in the direction of **steepest ascent**, and its length says how steep that is. The negative gradient points steepest **downhill**.

### Gradient of a loss: linear regression

For a model $\hat{y} = wx + b$ and mean squared error $L = \frac{1}{n}\sum (wx_i + b - y_i)^2$, the chain rule gives:

$$\frac{\partial L}{\partial w} = \frac{2}{n}\sum (wx_i + b - y_i)\,x_i \qquad \frac{\partial L}{\partial b} = \frac{2}{n}\sum (wx_i + b - y_i)$$

Read them aloud: "average error, times the input". If predictions are too high (positive error), decrease $w$.

> [!recap]
> - A partial derivative changes one variable and holds the rest fixed.
> - The gradient is the vector of partials and points uphill.
> - Loss gradients come from the chain rule: error × input.

# Lesson: Gradient descent: how models learn (25 min)

**Gradient descent** repeatedly takes a small step downhill:

$$\mathbf{w} \leftarrow \mathbf{w} - \eta \, \nabla L(\mathbf{w})$$

$\eta$ (eta) is the **learning rate**, the step size. Here's linear regression learned from scratch:

```python
# Data generated from y = 3x + 2 (plus a little noise)
xs = [0, 1, 2, 3, 4, 5]
ys = [2.1, 4.9, 8.2, 10.8, 14.1, 17.0]

w, b, lr = 0.0, 0.0, 0.02
n = len(xs)
for step in range(2001):
    errs = [w * x + b - y for x, y in zip(xs, ys)]
    loss = sum(e * e for e in errs) / n
    dw = 2 / n * sum(e * x for e, x in zip(errs, xs))
    db = 2 / n * sum(errs)
    w -= lr * dw
    b -= lr * db
    if step % 400 == 0:
        print(f"step {step:4}: loss={loss:8.4f}  w={w:.3f}  b={b:.3f}")
```

The model discovers $w \approx 3$ and $b \approx 2$ just by following the gradient.

### The learning rate matters

- **Too small**: progress is painfully slow.
- **Too large**: the steps overshoot the minimum, and the loss bounces around or explodes.
- In practice, use **adaptive optimizers** (Adam) and **schedules** that shrink $\eta$ over time (AI week 8).

Try changing `lr` to `0.2` above, press Edit, and run it. You'll watch the loss explode.

### Stochastic and mini-batch gradient descent

Computing the gradient over millions of examples for every step is expensive. **Stochastic gradient descent (SGD)** estimates the gradient from a small random **mini-batch** (for example 32 examples) per step. That's noisier but far faster, and the noise even helps escape poor regions. One full pass over the data is called an **epoch**.

### Local minima and convexity

A **convex** loss (bowl-shaped), like MSE for linear regression, has one global minimum, and gradient descent finds it. Neural-network losses are **non-convex**, with many valleys, but in high dimensions most local minima turn out to be "good enough" in practice.

> [!connect] The thread through the AI bootcamp
> Linear and logistic regression (week 2), neural networks and backpropagation (week 7), optimizers and learning-rate schedules (week 8), and fine-tuning pretrained CNNs and transformers (weeks 9–10) are all this loop: forward pass, loss, gradient, update.

> [!recap]
> - Update rule: $\mathbf{w} \leftarrow \mathbf{w} - \eta\nabla L$.
> - The learning rate trades speed against stability.
> - Mini-batch SGD estimates the gradient cheaply, and an epoch is one pass over the data.

# Quiz

## What is the derivative of $f(x) = 5x^3 - 4x + 9$?
- [ ] $15x^2 - 4x$
- [x] $15x^2 - 4$
- [ ] $5x^2 - 4$
- [ ] $15x^3 - 4$
> Power rule: $5 \cdot 3x^2 = 15x^2$. The derivative of $-4x$ is $-4$, and of a constant is 0.

## Using the chain rule, what is $\frac{d}{dx}e^{2x}$?
- [ ] $e^{2x}$
- [x] $2e^{2x}$
- [ ] $2xe^{2x-1}$
- [ ] $e^2$
> Outer: $e^u \to e^u$. Inner: $2x \to 2$. Multiply them.

## In gradient descent, why do we subtract the gradient?
- [ ] To make the weights smaller
- [x] The gradient points uphill (increasing loss), so its negative points downhill
- [ ] To normalize the weights
- [ ] Subtracting is faster than adding
> We want to *decrease* the loss, so we move against the direction of steepest ascent.

## The loss is jumping wildly and getting larger each step. What is the most likely cause?
- [ ] The learning rate is too small
- [x] The learning rate is too large
- [ ] Too much training data
- [ ] The model has too few parameters
> Steps that are too large overshoot the minimum and can diverge.

## What is a partial derivative $\frac{\partial f}{\partial w_1}$?
- [x] The rate of change of $f$ when only $w_1$ changes, with other variables held constant
- [ ] Half of the derivative
- [ ] The derivative of the first term only
- [ ] The second derivative
> Partial derivatives isolate one variable at a time. Collected together, they form the gradient.

## Why do deep networks of sigmoids suffer from vanishing gradients?
- [ ] Sigmoid has no derivative
- [x] The sigmoid derivative is at most 0.25, and the chain rule multiplies many such small numbers
- [ ] Sigmoid outputs are always negative
- [ ] Deep networks use too high a learning rate
> The chain rule multiplies local derivatives. Many factors ≤ 0.25 shrink toward 0, which is one reason ReLU took over.

## What does "mini-batch SGD" mean?
- [ ] Training only on a small subset of the data, forever
- [x] Estimating the gradient on a small random batch at each step instead of the full dataset
- [ ] Using a smaller model
- [ ] Taking very small steps
> Each step uses a fresh batch, and over an epoch all the data is seen. It's cheaper per step, and the noise is helpful.

# Exercise: Numerical gradient checker

Write `numeric_grad(f, w, h=1e-5)` that takes a function `f` of a **list** of parameters and returns the list of partial derivatives, estimated with central differences:

$$\frac{\partial f}{\partial w_i} \approx \frac{f(\ldots, w_i + h, \ldots) - f(\ldots, w_i - h, \ldots)}{2h}$$

Gradient checking like this is how ML engineers verify hand-written backpropagation.

## Starter

```python
def numeric_grad(f, w, h=1e-5):
    grads = []
    # for each index i, nudge w[i] up and down (on copies of w!)
    return grads

f = lambda w: w[0] ** 2 + 3 * w[0] * w[1]
print(numeric_grad(f, [1.0, 2.0]))  # exact: [2*1 + 3*2, 3*1] = [8, 3]
```

## Tests

```python
ns = load()
g = ns["numeric_grad"](lambda w: w[0] ** 2 + 3 * w[0] * w[1], [1.0, 2.0])
assert len(g) == 2 and abs(g[0] - 8) < 1e-4 and abs(g[1] - 3) < 1e-4, g
w = [0.5, -1.0, 2.0]
g = ns["numeric_grad"](lambda v: sum(x ** 3 for x in v), w)
assert all(abs(a - 3 * x * x) < 1e-3 for a, x in zip(g, w)), g
assert w == [0.5, -1.0, 2.0], "do not modify the input list"
```

## Hint

Inside the loop, use `up = list(w); up[i] += h` and `down = list(w); down[i] -= h`. Copying matters, because otherwise you mutate the caller's list.

## Solution

```python
def numeric_grad(f, w, h=1e-5):
    grads = []
    for i in range(len(w)):
        up = list(w); up[i] += h
        down = list(w); down[i] -= h
        grads.append((f(up) - f(down)) / (2 * h))
    return grads

f = lambda w: w[0] ** 2 + 3 * w[0] * w[1]
print(numeric_grad(f, [1.0, 2.0]))
```

# Exercise: Find a minimum with gradient descent

Minimize $f(x) = (x - 3)^2 + 1$ starting from `x = 10` with learning rate `0.1`. Write `descend(x0, lr, steps)` that returns the final `x`. The derivative is $f'(x) = 2(x - 3)$.

## Starter

```python
def descend(x0, lr, steps):
    x = x0
    return x

print(descend(10, 0.1, 100))
```

## Tests

```python
ns = load()
assert abs(ns["descend"](10, 0.1, 100) - 3) < 1e-6
assert abs(ns["descend"](-5, 0.1, 200) - 3) < 1e-6
assert ns["descend"](10, 0.1, 0) == 10
x = ns["descend"](10, 1.1, 50)
assert abs(x - 3) > 100, "with lr=1.1 the iteration should diverge"
```

## Solution

```python
def descend(x0, lr, steps):
    x = x0
    for _ in range(steps):
        x -= lr * 2 * (x - 3)
    return x

print(descend(10, 0.1, 100))
print(descend(10, 1.1, 50))   # diverges: each step multiplies the error by (1 - 2.2) = -1.2
```

Each step maps the error $e = x - 3$ to $e(1 - 2\eta)$. That error shrinks only if $|1 - 2\eta| < 1$, meaning $0 < \eta < 1$. This is a tiny, exact model of why learning rates have a stability limit.

# Sources

- [3Blue1Brown: Essence of Calculus](https://www.3blue1brown.com/topics/calculus)
- [3Blue1Brown: Neural Networks, chapters on gradient descent and backpropagation](https://www.3blue1brown.com/topics/neural-networks)
- [Khan Academy: Differential Calculus and Multivariable Calculus](https://www.khanacademy.org/math/differential-calculus)
- *Mathematics for Machine Learning* by Deisenroth, Faisal & Ong, chapters 5 and 7 (mml-book.com)
- [Stanford CS231n notes: Optimization and Backpropagation](https://cs231n.github.io/optimization-1/)
