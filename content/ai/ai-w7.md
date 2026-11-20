---
id: ai-w7
title: Deep Learning Foundations with PyTorch
week: Week 7
summary: Perceptrons and multilayer networks, activations and losses, forward and backpropagation, optimizers, an MLP from scratch, then PyTorch tensors, autograd, nn.Module, DataLoader and training loops.
builds_on: ai-w2, f-calculus, f-linalg, py-w5
leads_to: ai-w8, ai-w9, ai-w10
---

Deep learning powers modern vision, speech and language models, including the LLMs you'll build with in Agentic AI and Full-Stack. This week you'll build a neural network **from scratch in NumPy** (it runs right here), so nothing about PyTorch feels like magic. Then you'll learn the PyTorch way. Run the PyTorch code in Google Colab (free GPU) or a local install.

# Lesson: From the perceptron to multilayer networks (30 min)

A single **neuron** computes a weighted sum plus a bias, then applies an **activation function**:

$$a = \phi(\mathbf{w}\cdot\mathbf{x} + b)$$

With a step function as $\phi$, that's Rosenblatt's 1958 **perceptron**. With a sigmoid, it's logistic regression. A single neuron can only draw **linear** boundaries. It famously can't learn XOR.

### Layers: composition of simple functions

Stack neurons into **layers**, and layers into a network. A **multilayer perceptron (MLP)** with one hidden layer:

$$\mathbf{h} = \phi(W_1\mathbf{x} + \mathbf{b}_1) \qquad \hat{\mathbf{y}} = W_2\mathbf{h} + \mathbf{b}_2$$

> [!important] Why non-linear activations are essential
> Without $\phi$, two linear layers collapse into one: $W_2(W_1 x) = (W_2W_1)x$. The non-linearity lets networks bend decision boundaries. With enough hidden units, an MLP can approximate any continuous function (the **universal approximation theorem**). In practice, **depth** learns hierarchical features more efficiently than width alone.

### Activation functions

| Activation | Formula | Notes |
|---|---|---|
| Sigmoid | $\frac{1}{1+e^{-z}}$ | Outputs in (0,1); saturates, so gradients vanish |
| Tanh | $\tanh z$ | Zero-centred; still saturates |
| **ReLU** | $\max(0, z)$ | The default for hidden layers: cheap, no saturation for z > 0 |
| GELU / SiLU | Smooth ReLU-like curves | Used in transformers |
| Softmax | $\frac{e^{z_k}}{\sum_j e^{z_j}}$ | Output layer for multiclass probabilities |

### Losses: matching the task

| Task | Output layer | Loss |
|---|---|---|
| Regression | Linear | MSE (or MAE / Huber) |
| Binary classification | 1 logit (+ sigmoid) | Binary cross-entropy |
| Multiclass | K logits (+ softmax) | Cross-entropy $-\log p_{\text{true class}}$ |

> [!recap]
> - Neuron = weighted sum + bias + activation. Networks are stacks of layers (composition).
> - Non-linearity is what gives networks their power. ReLU is the hidden-layer default.
> - Match the output layer and loss to the task.

# Lesson: Backpropagation and optimizers (35 min)

Training = minimize the loss with gradient descent (*Calculus for ML*). We need $\frac{\partial L}{\partial W}$ for **every** weight. **Backpropagation** computes all of them efficiently by applying the **chain rule** backwards through the network, reusing intermediate results from the forward pass.

For one hidden layer with ReLU and an MSE loss:

1. **Forward**: $z_1 = XW_1 + b_1$, $h = \text{ReLU}(z_1)$, $\hat y = hW_2 + b_2$, $L = \text{mean}((\hat y - y)^2)$
2. **Backward**:
   - $\frac{\partial L}{\partial \hat y} = \frac{2}{n}(\hat y - y)$
   - $\frac{\partial L}{\partial W_2} = h^\top \frac{\partial L}{\partial \hat y}$, and $\frac{\partial L}{\partial b_2} = \sum \frac{\partial L}{\partial \hat y}$
   - $\frac{\partial L}{\partial h} = \frac{\partial L}{\partial \hat y} W_2^\top$, then through ReLU: $\frac{\partial L}{\partial z_1} = \frac{\partial L}{\partial h} \odot [z_1 > 0]$
   - $\frac{\partial L}{\partial W_1} = X^\top \frac{\partial L}{\partial z_1}$, and $\frac{\partial L}{\partial b_1} = \sum \frac{\partial L}{\partial z_1}$

### An MLP from scratch (runs in the browser)

```python
import numpy as np
rng = np.random.default_rng(0)
# Data: y = sin(x) — a non-linear function no linear model can fit
X = rng.uniform(-3, 3, size=(256, 1)); y = np.sin(X)

H = 32
W1 = rng.normal(0, np.sqrt(2 / 1), (1, H)); b1 = np.zeros(H)      # He initialization for ReLU
W2 = rng.normal(0, np.sqrt(1 / H), (H, 1)); b2 = np.zeros(1)
lr = 0.05
for epoch in range(2001):
    z1 = X @ W1 + b1; h = np.maximum(0, z1); y_hat = h @ W2 + b2          # forward
    loss = np.mean((y_hat - y) ** 2)
    d_yhat = 2 * (y_hat - y) / len(X)                                      # backward
    dW2 = h.T @ d_yhat; db2 = d_yhat.sum(0)
    dh = d_yhat @ W2.T; dz1 = dh * (z1 > 0)
    dW1 = X.T @ dz1; db1 = dz1.sum(0)
    W1 -= lr * dW1; b1 -= lr * db1; W2 -= lr * dW2; b2 -= lr * db2          # update
    if epoch % 400 == 0:
        print(f"epoch {epoch:4}: MSE {loss:.4f}")
test = np.array([[-2.0], [0.0], [1.5]])
print("pred", (np.maximum(0, test @ W1 + b1) @ W2 + b2).ravel().round(3), "true", np.sin(test).ravel().round(3))
```

That's the whole of deep learning in miniature: forward, loss, backward, update. Frameworks automate the backward pass and run it on GPUs.

### Optimizers

- **SGD**: $w \leftarrow w - \eta g$ on mini-batches.
- **Momentum**: accumulate a velocity $v \leftarrow \beta v + g$, then update with $v$. It smooths out oscillations and speeds up progress along consistent directions.
- **Adam**: per-parameter adaptive learning rates using running averages of the gradient (1st moment) and the squared gradient (2nd moment). It's the default choice for most deep learning, and **AdamW** (decoupled weight decay) is preferred.

> [!recap]
> - Backprop = the chain rule, applied backwards, reusing forward values.
> - The training loop: forward → loss → backward → update.
> - SGD + momentum, or Adam/AdamW. Learning rate is the key hyperparameter.

# Lesson: PyTorch: tensors, autograd and nn.Module (35 min)

PyTorch gives you **tensors** (NumPy-like arrays that can live on a GPU) and **autograd** (automatic differentiation).

```python norun
import torch

x = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
print(x.shape, x.dtype, x.device)             # torch.Size([2, 2]) torch.float32 cpu
device = "cuda" if torch.cuda.is_available() else "cpu"
x = x.to(device)

w = torch.tensor(3.0, requires_grad=True)     # track operations on w
loss = (w * 2 - 10) ** 2                      # builds a computation graph
loss.backward()                               # backprop: fills w.grad
print(w.grad)                                 # d/dw (2w - 10)^2 = 4(2w - 10) = -16
```

### nn.Module: networks as classes

```python norun
import torch
from torch import nn

class MLP(nn.Module):                          # inheritance (Python week 5!)
    def __init__(self, n_in, n_hidden, n_out, p_drop=0.2):
        super().__init__()
        self.net = nn.Sequential(              # composition of layers
            nn.Linear(n_in, n_hidden), nn.ReLU(), nn.Dropout(p_drop),
            nn.Linear(n_hidden, n_hidden), nn.ReLU(),
            nn.Linear(n_hidden, n_out),
        )
    def forward(self, x):
        return self.net(x)                     # logits (no softmax: the loss applies it)

model = MLP(30, 64, 2)
print(sum(p.numel() for p in model.parameters()), "parameters")
```

### Dataset and DataLoader

```python norun
from torch.utils.data import TensorDataset, DataLoader
train_ds = TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)     # shuffled mini-batches
val_dl   = DataLoader(val_ds, batch_size=256)
```

Custom datasets subclass `Dataset` and implement `__len__` and `__getitem__`: the dunder methods from Python week 5 again.

### The canonical training loop

```python norun
model = MLP(30, 64, 2).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(30):
    model.train()                              # enables dropout, etc.
    for xb, yb in train_dl:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()                        # 1. reset gradients (they accumulate!)
        loss = loss_fn(model(xb), yb)          # 2. forward + loss
        loss.backward()                        # 3. backprop
        opt.step()                             # 4. update

    model.eval()                               # disables dropout
    correct = total = 0
    with torch.no_grad():                      # no graph building during evaluation
        for xb, yb in val_dl:
            pred = model(xb.to(device)).argmax(1)
            correct += (pred == yb.to(device)).sum().item(); total += len(yb)
    print(f"epoch {epoch}: val acc {correct / total:.3f}")
```

> [!mistake] The four classic PyTorch bugs
> 1. Forgetting `opt.zero_grad()`, so gradients accumulate across steps.
> 2. Forgetting `model.eval()` / `torch.no_grad()` during validation.
> 3. Applying softmax before `CrossEntropyLoss`, which already includes log-softmax. Pass raw logits.
> 4. Tensors on different devices (CPU vs GPU), or with the wrong dtype (labels must be `long` for cross-entropy).

### Regularization in deep learning

Weight decay (L2), **dropout** (randomly zeroing activations during training), **early stopping** on the validation loss, **data augmentation** (week 10) and more data. Details next week.

> [!recap]
> - Tensors + autograd: `requires_grad`, `.backward()`, `.grad`.
> - Models subclass `nn.Module`. Data comes from `Dataset` + `DataLoader`.
> - Loop: zero_grad → forward → loss → backward → step. Use eval mode and no_grad for validation.

# Quiz

## Why can't a network without non-linear activations learn XOR?
- [ ] It has too few parameters
- [x] Stacked linear layers collapse into a single linear map, which can only draw linear boundaries
- [ ] XOR needs sigmoid outputs
- [ ] Gradient descent doesn't work on XOR
> Non-linearities are what give depth its power.

## Which activation is the common default for hidden layers?
- [ ] Sigmoid
- [x] ReLU
- [ ] Softmax
- [ ] Step function
> It's cheap and doesn't saturate for positive inputs.

## What does backpropagation compute?
- [ ] The forward predictions
- [x] The gradient of the loss with respect to every parameter, via the chain rule
- [ ] The optimal learning rate
- [ ] The training data
> It reuses forward-pass values to compute all the gradients efficiently.

## In PyTorch, why call `optimizer.zero_grad()` each step?
- [ ] To reset the weights
- [x] Gradients accumulate by default; without resetting, old gradients add to new ones
- [ ] To save memory only
- [ ] To switch to evaluation mode
> `.backward()` adds into `.grad`.

## For 10-class classification with `nn.CrossEntropyLoss`, the model should output:
- [ ] Softmax probabilities
- [x] Raw logits (10 numbers per example)
- [ ] A single number
- [ ] One-hot vectors
> CrossEntropyLoss applies log-softmax internally.

## What does `model.eval()` change?
- [ ] It stops gradient computation
- [x] It switches layers like dropout and batch norm to inference behaviour
- [ ] It saves the model
- [ ] It moves the model to the CPU
> Combine it with `torch.no_grad()` to also skip gradient tracking.

## What makes Adam different from plain SGD?
- [ ] It doesn't use gradients
- [x] It adapts the learning rate per parameter using running averages of the gradients and their squares
- [ ] It always converges to the global minimum
- [ ] It needs no learning rate
> AdamW (with decoupled weight decay) is a common default.

# Exercise: Softmax and cross-entropy from scratch

Implement `softmax(z)` for a 2-D NumPy array of logits (rows = examples) in a **numerically stable** way (subtract each row's max), and `cross_entropy(logits, y)`, which returns the mean of $-\log p_{\text{true}}$, where `y` holds integer class indices.

## Starter

```python
import numpy as np

def softmax(z):
    pass

def cross_entropy(logits, y):
    pass
```

## Tests

```python
import numpy as np
ns = load()
z = np.array([[1.0, 2.0, 3.0], [1000.0, 1000.0, 1000.0]])
p = ns["softmax"](z)
assert np.allclose(p.sum(axis=1), 1)
assert np.allclose(p[1], [1/3, 1/3, 1/3]), "must be stable for large logits"
assert np.allclose(p[0], np.exp([1, 2, 3]) / np.exp([1, 2, 3]).sum())
ce = ns["cross_entropy"](np.array([[2.0, 0.0], [0.0, 2.0]]), np.array([0, 1]))
assert abs(ce - (-np.log(np.exp(2) / (np.exp(2) + 1)))) < 1e-9
assert abs(ns["cross_entropy"](np.zeros((4, 4)), np.array([0, 1, 2, 3])) - np.log(4)) < 1e-9
```

## Solution

```python
import numpy as np

def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)

def cross_entropy(logits, y):
    p = softmax(logits)
    return float(-np.mean(np.log(p[np.arange(len(y)), y])))
```

Subtracting the max doesn't change the result (it cancels in the ratio), but it prevents `exp(1000)` from overflowing. Real libraries compute log-softmax directly for even better stability.

# Exercise: Train an MLP classifier from scratch

Extend the from-scratch idea to **classification**. Write `train_mlp(X, y, hidden=16, lr=0.5, epochs=500, seed=0)` for binary labels (0/1). Use one ReLU hidden layer, a single sigmoid output and binary cross-entropy, trained with full-batch gradient descent. Return a function `predict(X) -> array of 0/1`. It must reach at least 95% training accuracy on the two-moons data in the test.

## Starter

```python
import numpy as np

def train_mlp(X, y, hidden=16, lr=0.5, epochs=500, seed=0):
    rng = np.random.default_rng(seed)
    # initialize W1, b1, W2, b2
    # loop: forward (ReLU, sigmoid), backward, update
    def predict(Xn):
        pass
    return predict
```

## Tests

```python
import numpy as np
from sklearn.datasets import make_moons
ns = load()
X, y = make_moons(400, noise=0.1, random_state=0)
predict = ns["train_mlp"](X, y, hidden=16, lr=0.5, epochs=2000)
acc = (predict(X) == y).mean()
assert acc >= 0.95, acc
```

## Hint

With a sigmoid output and BCE, the gradient at the output simplifies beautifully: `dz2 = (p - y) / n`, where `p = sigmoid(z2)`. Then `dW2 = h.T @ dz2`, `dh = dz2 @ W2.T`, `dz1 = dh * (z1 > 0)`. Keep `y` as a column vector `y.reshape(-1, 1)`.

## Solution

```python
import numpy as np

def train_mlp(X, y, hidden=16, lr=0.5, epochs=500, seed=0):
    rng = np.random.default_rng(seed)
    n, d = X.shape
    Y = y.reshape(-1, 1).astype(float)
    W1 = rng.normal(0, np.sqrt(2 / d), (d, hidden)); b1 = np.zeros(hidden)
    W2 = rng.normal(0, np.sqrt(1 / hidden), (hidden, 1)); b2 = np.zeros(1)
    sig = lambda z: 1 / (1 + np.exp(-z))
    for _ in range(epochs):
        z1 = X @ W1 + b1; h = np.maximum(0, z1)
        p = sig(h @ W2 + b2)
        dz2 = (p - Y) / n
        dW2 = h.T @ dz2; db2 = dz2.sum(0)
        dz1 = (dz2 @ W2.T) * (z1 > 0)
        dW1 = X.T @ dz1; db1 = dz1.sum(0)
        W1 -= lr * dW1; b1 -= lr * db1; W2 -= lr * dW2; b2 -= lr * db2

    def predict(Xn):
        return (sig(np.maximum(0, Xn @ W1 + b1) @ W2 + b2).ravel() >= 0.5).astype(int)
    return predict
```

The `(p - y)` gradient is why sigmoid + BCE (and softmax + cross-entropy) are paired: the messy terms cancel out.

# Sources

- [PyTorch: Learn the Basics tutorial (tensors, datasets, autograd, training loop)](https://pytorch.org/tutorials/beginner/basics/intro.html)
- [3Blue1Brown: Neural networks series (chapters 1–4: backpropagation)](https://www.3blue1brown.com/topics/neural-networks)
- [Stanford CS231n notes: Neural Networks Part 1–3 and Backpropagation](https://cs231n.github.io/)
- *Deep Learning* by Goodfellow, Bengio & Courville, chapters 6–8 (free at deeplearningbook.org)
- [Dive into Deep Learning (d2l.ai): free interactive book with PyTorch code](https://d2l.ai/)
- Kingma & Ba (2015), "Adam: A Method for Stochastic Optimization"; Loshchilov & Hutter (2019), "Decoupled Weight Decay Regularization" (AdamW)
