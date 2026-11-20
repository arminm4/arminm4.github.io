---
id: ai-w8
title: Training Deep Networks & Sequence Models
week: Week 8
summary: Generalization in deep nets, normalization, dropout, early stopping, optimizers and learning-rate schedules, training diagnostics; then RNNs, LSTMs, GRUs and an introduction to attention.
builds_on: ai-w7
leads_to: ai-w9
---

Getting a network to train *well* is an engineering skill. The first half of this week is a practical toolkit: what to change when training goes wrong. The second half introduces **sequence models**, which process ordered data (text, time series, events), and ends with **attention**, the idea behind transformers and LLMs.

# Lesson: Generalization, normalization and regularization (30 min)

Deep networks have millions of parameters and can memorize random labels, yet they often generalize well. The tools below keep them on the right side of that line.

### Normalization layers

- **Batch normalization** normalizes each feature over the mini-batch to mean 0 and variance 1, then applies a learned scale and shift. It stabilizes and speeds up training of CNNs. It behaves differently in train and eval mode (it uses running statistics at inference), which is another reason `model.eval()` matters.
- **Layer normalization** normalizes across the features of *each example*, independently of the batch. It's the standard in RNNs and **transformers**.

### Regularization toolbox

| Technique | How it helps |
|---|---|
| **Weight decay** (L2; AdamW) | Keeps the weights small, giving smoother functions |
| **Dropout** (p ≈ 0.1–0.5) | Randomly zeros activations during training, preventing co-adaptation; acts like an ensemble |
| **Early stopping** | Stop when the validation loss stops improving, and restore the best weights |
| **Data augmentation** | More (realistic) data variety: flips, crops, noise (week 10) |
| **Smaller model / fewer epochs** | Less capacity to memorize |
| **Label smoothing** | Discourages over-confident predictions |

```python
import numpy as np
# Early stopping logic, the way you'd write it in any training loop
val_losses = [0.90, 0.71, 0.60, 0.55, 0.53, 0.54, 0.535, 0.56, 0.58, 0.61]
best, best_epoch, patience, wait = float("inf"), -1, 3, 0
for epoch, vl in enumerate(val_losses):
    if vl < best - 1e-4:
        best, best_epoch, wait = vl, epoch, 0          # (save a checkpoint here)
    else:
        wait += 1
        if wait >= patience:
            print(f"stop at epoch {epoch}; restore best from epoch {best_epoch} (val {best})")
            break
```

> [!recap]
> - BatchNorm for CNNs, LayerNorm for sequences and transformers.
> - Weight decay, dropout, early stopping and augmentation fight overfitting.

# Lesson: Optimizers, learning-rate schedules and diagnostics (30 min)

### Learning-rate schedules

The learning rate is the single most important hyperparameter. Common schedules:

- **Step decay**: divide by 10 every N epochs.
- **Cosine annealing**: decrease smoothly to near zero.
- **Warmup**: start tiny and increase over the first steps. This is essential for transformers, because early Adam statistics are noisy.
- **One-cycle**: up, then down. It's fast and effective.

```python
import math
def warmup_cosine(step, total=1000, warmup=100, peak=3e-4):
    if step < warmup:
        return peak * step / warmup
    progress = (step - warmup) / (total - warmup)
    return peak * 0.5 * (1 + math.cos(math.pi * progress))
for s in [0, 50, 100, 300, 600, 999]:
    print(s, f"{warmup_cosine(s):.2e}")
```

### Reading training curves

| Symptom | Likely cause | Try |
|---|---|---|
| Training loss doesn't decrease | LR too low or too high, a bug, bad initialization | **Overfit one small batch first** (it should reach ~0 loss); LR range test |
| Loss becomes NaN | LR too high, exploding gradients, log(0) | Lower the LR, **gradient clipping**, check the data |
| Train ↓, val ↑ (gap widens) | Overfitting | Regularize, augment, add data, early stop |
| Both high and flat | Underfitting | Bigger model, train longer, better features, lower regularization |
| Val noisy / jumpy | Small val set or batch, high LR | Larger val set, LR decay |

> [!tip] The single most useful debugging trick
> Before a full run, train on **one batch of ~32 examples** until the loss is nearly zero. If the model can't memorize 32 examples, there's a bug in the data, the loss or the model wiring. This advice comes from Andrej Karpathy's "A Recipe for Training Neural Networks".

**Gradient clipping** (`torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)`) caps the gradient norm. It's standard for RNNs and transformers.

> [!recap]
> - Schedules: warmup + cosine and one-cycle. Warmup is critical for transformers.
> - Diagnose from the curves. Overfit one batch first. Clip gradients for stability.

# Lesson: Recurrent networks: RNN, LSTM, GRU (35 min)

Sequences have **order** and **variable length**: sentences, sensor readings, clickstreams. An MLP with fixed inputs can't handle them naturally.

### The vanilla RNN

An RNN reads one element at a time, updating a **hidden state** that summarizes everything it has seen so far:

$$\mathbf{h}_t = \tanh(W_x \mathbf{x}_t + W_h \mathbf{h}_{t-1} + \mathbf{b})$$

The **same weights** are reused at every time step. Training "unrolls" the network through time and backpropagates (**BPTT**).

```python
import numpy as np
rng = np.random.default_rng(0)
d_in, d_h = 3, 4
Wx, Wh, b = rng.normal(0, 0.5, (d_h, d_in)), rng.normal(0, 0.5, (d_h, d_h)), np.zeros(d_h)
sequence = rng.normal(size=(5, d_in))          # 5 time steps
h = np.zeros(d_h)
for t, x in enumerate(sequence):
    h = np.tanh(Wx @ x + Wh @ h + b)           # the state carries memory forward
    print(f"t={t}: h = {h.round(3)}")
```

**The problem**: gradients flowing back through many steps get multiplied by $W_h$ and tanh derivatives again and again, so they **vanish** or **explode**. Vanilla RNNs struggle to remember beyond ~10–20 steps.

### LSTM: gated memory

The **Long Short-Term Memory** network (Hochreiter & Schmidhuber, 1997) adds a **cell state** $c_t$, a conveyor belt of information, plus **gates** (sigmoids between 0 and 1) that control the flow:

- **Forget gate** $f_t$: what to erase from the cell.
- **Input gate** $i_t$: what new information to write.
- **Output gate** $o_t$: what to expose as the hidden state.

$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t \qquad h_t = o_t \odot \tanh(c_t)$$

Because the cell update is mostly **additive**, gradients can flow across long spans, the way residual connections work in deep networks.

### GRU

The **Gated Recurrent Unit** merges the gates into an *update* gate and a *reset* gate, with no separate cell. It has fewer parameters and often performs similarly to an LSTM.

### Sequence tasks and training

| Pattern | Example |
|---|---|
| Many-to-one | Sentiment of a review; next-day demand from 30 days |
| Many-to-many (aligned) | Part-of-speech tagging |
| Sequence-to-sequence | Translation (encoder → decoder) |

```python norun
import torch
from torch import nn
class SeqClassifier(nn.Module):
    def __init__(self, vocab, emb=64, hid=128, n_cls=2):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, hid, batch_first=True, bidirectional=True)
        self.head = nn.Linear(2 * hid, n_cls)
    def forward(self, tokens):                 # tokens: (batch, seq_len) integer ids
        out, (h, c) = self.lstm(self.emb(tokens))
        last = torch.cat([h[-2], h[-1]], dim=1) # final forward + backward hidden states
        return self.head(last)
```

Practicalities: **pad** sequences to the same length within a batch (and mask the padding), **clip gradients**, and for time series, use the time-aware splits from week 4.

> [!recap]
> - An RNN updates a hidden state with shared weights. Vanilla RNNs suffer vanishing/exploding gradients.
> - LSTM/GRU gates plus an additive cell path allow long-range memory.
> - Pad and mask, clip gradients, and split time correctly.

# Lesson: Introduction to attention (25 min)

RNNs squeeze an entire sequence into one fixed-size hidden state, which is a bottleneck for long inputs. **Attention** (Bahdanau et al., 2014) lets the model **look back at all positions** and decide which ones matter for the current step.

### Attention as a soft lookup

For each **query** $q$ (what I'm looking for), compare it with every **key** $k_i$ (what each position offers), turn the scores into weights with softmax, and take the weighted average of the **values** $v_i$:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$$

```python
import numpy as np
def softmax(z):
    z = z - z.max(axis=-1, keepdims=True); e = np.exp(z); return e / e.sum(axis=-1, keepdims=True)

words = ["the", "cat", "sat", "on", "mat"]
rng = np.random.default_rng(1)
d = 4
K = rng.normal(size=(5, d)); V = rng.normal(size=(5, d))
q = K[1] * 2.0                     # a query that "resembles" the key of 'cat'
weights = softmax(q @ K.T / np.sqrt(d))
for w, a in zip(words, weights):
    print(f"{w:>4}: {'█' * int(a * 40)} {a:.2f}")
print("output vector:", (weights @ V).round(3))
```

This is the same dot-product similarity you learned in *Linear Algebra*, used here as a differentiable "search" over positions. Dividing by $\sqrt{d_k}$ keeps the scores from growing with dimension and saturating the softmax.

> [!important] The road to transformers
> "Attention Is All You Need" (Vaswani et al., 2017) dropped recurrence entirely. In **self-attention**, every token attends to every other token **in parallel**, so training is fast on GPUs and long-range dependencies are captured directly. Stack self-attention with MLPs, residual connections and LayerNorm, and you have a **transformer**: the architecture behind GPT, Claude and BERT. Week 9 continues this story.

> [!recap]
> - Attention = softmax(similarity(query, keys)) × values: a soft, learnable lookup.
> - It removes the fixed-state bottleneck. Self-attention plus parallelism gives transformers.

# Quiz

## Training loss decreases but validation loss starts rising after epoch 8. Best response?
- [ ] Train longer
- [x] Early stopping / more regularization: the model is overfitting
- [ ] Increase the learning rate
- [ ] Remove the validation set
> A widening train/val gap means overfitting.

## Your loss becomes NaN after a few hundred steps. Which fix is most likely?
- [ ] More epochs
- [x] Lower the learning rate and/or add gradient clipping
- [ ] Remove the normalization layers
- [ ] Increase the batch size to 1
> Exploding updates are the usual culprit.

## Why "overfit a single small batch" before full training?
- [x] If the model can't drive the loss near zero on 32 examples, there's a bug in the data, loss or model
- [ ] It improves generalization
- [ ] It's how batch norm is initialized
- [ ] It replaces validation
> It's a fast sanity check for the whole pipeline.

## Which normalization is standard in transformers?
- [ ] Batch normalization
- [x] Layer normalization
- [ ] Min-max scaling
- [ ] No normalization
> LayerNorm doesn't depend on batch statistics and works for variable-length sequences.

## Why do vanilla RNNs struggle with long-range dependencies?
- [ ] They have too many parameters
- [x] Gradients vanish or explode when backpropagated through many time steps
- [ ] They can't process numbers
- [ ] They don't share weights
> Repeated multiplication shrinks or amplifies gradients exponentially.

## What is the role of the LSTM forget gate?
- [ ] To skip time steps
- [x] To decide how much of the previous cell state to keep
- [ ] To output the prediction
- [ ] To normalize inputs
> A sigmoid between 0 and 1 scales the old memory element-wise.

## In scaled dot-product attention, what are the softmax weights computed from?
- [ ] Values only
- [x] Similarities (dot products) between the query and the keys, scaled by √d
- [ ] Random noise
- [ ] Positions only
> softmax(QKᵀ/√d), then a weighted sum of V.

## What is a key advantage of transformers over RNNs?
- [ ] They use less memory for long sequences
- [x] They process all positions in parallel and connect distant positions directly
- [ ] They don't need training data
- [ ] They only work on images
> Parallelism plus direct long-range connections, at the cost of attention that is quadratic in length.

# Exercise: Scaled dot-product attention

Implement `attention(Q, K, V, mask=None)` with NumPy for 2-D inputs `Q (n_q, d)`, `K (n_k, d)` and `V (n_k, d_v)`. Return `(output, weights)`, where the weights have shape `(n_q, n_k)`. If `mask` (a boolean `(n_q, n_k)` array) is given, positions where the mask is `False` must get weight 0 (set their scores to `-1e9` before the softmax). This is how **causal masking** stops GPT-style models from looking at future tokens.

## Starter

```python
import numpy as np

def attention(Q, K, V, mask=None):
    pass
```

## Tests

```python
import numpy as np
ns = load()
rng = np.random.default_rng(0)
Q, K, V = rng.normal(size=(3, 4)), rng.normal(size=(5, 4)), rng.normal(size=(5, 2))
out, w = ns["attention"](Q, K, V)
assert out.shape == (3, 2) and w.shape == (3, 5)
assert np.allclose(w.sum(axis=1), 1)
s = Q @ K.T / 2.0
e = np.exp(s - s.max(1, keepdims=True)); ref = e / e.sum(1, keepdims=True)
assert np.allclose(w, ref) and np.allclose(out, ref @ V)
causal = np.tril(np.ones((5, 5), dtype=bool))
X = rng.normal(size=(5, 4))
o2, w2 = ns["attention"](X, X, X, mask=causal)
assert np.allclose(np.triu(w2, k=1), 0), "no attention to future positions"
assert np.allclose(w2[0], [1, 0, 0, 0, 0])
```

## Solution

```python
import numpy as np

def attention(Q, K, V, mask=None):
    d = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d)
    if mask is not None:
        scores = np.where(mask, scores, -1e9)
    scores = scores - scores.max(axis=-1, keepdims=True)
    w = np.exp(scores)
    w = w / w.sum(axis=-1, keepdims=True)
    return w @ V, w
```

With the causal mask, the first token can only attend to itself. That's why its weights are `[1, 0, 0, 0, 0]`.

# Sources

- Karpathy (2019), ["A Recipe for Training Neural Networks"](https://karpathy.github.io/2019/04/25/recipe/)
- [Christopher Olah: Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)
- [Jay Alammar: The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)
- Vaswani et al. (2017), "Attention Is All You Need", arXiv:1706.03762; Bahdanau et al. (2014), arXiv:1409.0473
- [PyTorch docs: torch.optim.lr_scheduler, nn.LSTM, nn.LayerNorm](https://pytorch.org/docs/stable/optim.html)
- [Dive into Deep Learning: chapters on optimization, RNNs and attention](https://d2l.ai/)
