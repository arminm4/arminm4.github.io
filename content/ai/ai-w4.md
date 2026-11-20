---
id: ai-w4
title: Recommender Systems & Time Series
week: Week 4
summary: Framing recommendations, popularity and content-based baselines, collaborative filtering and matrix factorization, top-N evaluation and cold start; then trend, seasonality, autocorrelation, time-aware validation, lag features, ARIMA and ML forecasting.
builds_on: ai-w3, bi-w1
leads_to: ai-p1, ag-w2
---

Two problem types that show up in almost every business: **"what should we show this user?"** (recommenders) and **"what will happen next week?"** (forecasting). Both need special care with evaluation. Random train/test splits that work elsewhere give badly misleading results here.

# Lesson: Framing recommendation problems (25 min)

The data is a **user–item interaction matrix** $R$, where rows are users, columns are items, and the entries are interactions. It's extremely **sparse**: most users touch only a few of the thousands of items.

- **Explicit feedback**: ratings (1–5 stars). Clear, but rare.
- **Implicit feedback**: clicks, views, purchases, watch time. Plentiful, but noisy, and a missing value doesn't mean "dislike".

Typical goals: **top-N recommendation** ("10 products for you"), **similar items** ("customers also bought"), and **next item** in a session.

### Baselines you must beat

1. **Popularity**: recommend the most popular items (overall, or recent). It's surprisingly hard to beat, and it's a must-have fallback.
2. **Content-based**: recommend items **similar in attributes** to what the user liked (category, brand, text embeddings). It works for new items, but tends to "more of the same".

```python
import numpy as np
items = ["AeroBook 13", "AeroBook 15 Pro", "StudyBook Lite", "BassPods", "StudioCans X", "GameBox One"]
# item feature vectors: [laptop, audio, gaming, premium]
F = np.array([[1, 0, 0, 0.6], [1, 0, 0, 1.0], [1, 0, 0, 0.1],
              [0, 1, 0, 0.3], [0, 1, 0, 0.8], [0, 0, 1, 0.7]], dtype=float)
Fn = F / np.linalg.norm(F, axis=1, keepdims=True)
liked = [1]                                   # the user liked "AeroBook 15 Pro"
profile = Fn[liked].mean(axis=0)
scores = Fn @ profile                          # cosine similarity to the user's profile
for i in np.argsort(-scores):
    if i not in liked:
        print(f"{items[i]:16} {scores[i]:.3f}")
```

> [!recap]
> - Sparse user–item matrix with explicit or implicit feedback.
> - Always build popularity and content-based baselines.

# Lesson: Collaborative filtering (35 min)

**Collaborative filtering (CF)** uses the *behaviour* of many users, not item attributes: "users who interacted with what you interacted with also liked…".

### Item–item CF

Compute the similarity between items from their **interaction vectors** (the columns of $R$), usually with cosine similarity. To recommend for a user, add up the similarities from the items they've already interacted with.

```python
import numpy as np
users = ["Sara", "Liam", "Noor", "Emre", "Ava"]
items = ["Laptop", "Mouse", "Bag", "Headset", "Game"]
R = np.array([[1, 1, 1, 0, 0],
              [1, 1, 0, 0, 0],
              [0, 0, 0, 1, 1],
              [1, 0, 1, 0, 0],
              [0, 1, 0, 1, 1]], dtype=float)
norms = np.linalg.norm(R, axis=0)
S = (R.T @ R) / np.outer(norms, norms)          # item-item cosine similarity
np.fill_diagonal(S, 0)
def recommend(u, n=2):
    scores = R[u] @ S                           # sum of similarities to the items the user has
    scores[R[u] > 0] = -np.inf                  # don't recommend what they already have
    return [items[i] for i in np.argsort(-scores)[:n]]
for u, name in enumerate(users):
    print(name, "→", recommend(u))
```

Item–item CF is stable (item similarities change slowly), explainable ("because you bought X") and was famously used at scale by Amazon.

### Matrix factorization

Approximate $R \approx U V^\top$: every user gets a vector $\mathbf{u}$ and every item a vector $\mathbf{v}$ in a small latent space (say 32 dimensions), and the predicted affinity is $\mathbf{u}\cdot\mathbf{v}$. The model is trained to fit the observed interactions, with regularization, using SGD or ALS. The learned **latent factors** often capture interpretable traits like "budget vs premium" or "gamer". It's the same idea as embeddings.

```python
import numpy as np
rng = np.random.default_rng(0)
R = np.array([[5, 4, 0, 1], [4, 0, 0, 1], [1, 1, 0, 5], [0, 1, 5, 4], [1, 0, 4, 0]], dtype=float)
mask = R > 0
k, lr, reg = 2, 0.02, 0.05
U, V = rng.normal(0, 0.1, (5, k)), rng.normal(0, 0.1, (4, k))
for epoch in range(3000):
    for u, i in zip(*np.nonzero(mask)):
        err = R[u, i] - U[u] @ V[i]
        U[u] += lr * (err * V[i] - reg * U[u])
        V[i] += lr * (err * U[u] - reg * V[i])
print("predicted ratings (0s were unknown):")
print((U @ V.T).round(1))
```

Modern systems add **two-tower neural models** and sequence models (transformers over the click history). The core idea is still "embed users and items in one space".

### Evaluation and cold start

- Split **by time**: train on the past, test on later interactions. A random split leaks the future.
- Top-N metrics: **precision@k**, **recall@k**, **hit rate@k**, **NDCG@k** (rewards relevant items ranked higher) and **MAP**.
- Look beyond accuracy: **coverage** (how much of the catalogue gets recommended), **diversity**, **novelty**, and online **A/B tests** (AI week 1).
- **Cold start**: new users have no history (use popularity, onboarding questions or context). New items have no interactions (use content features). **Hybrid** systems combine CF and content.

> [!connect] Retrieval for RAG uses the same ideas
> "Embed and rank by similarity", top-k retrieval, recall@k and NDCG are exactly how RAG systems are evaluated (Agentic week 2, Full-Stack week 7).

> [!recap]
> - Item–item CF: cosine similarity of interaction columns.
> - Matrix factorization learns user and item embeddings.
> - Split by time. Use precision/recall/NDCG@k plus coverage and diversity. Plan for cold start.

# Lesson: Time series fundamentals and time-aware validation (30 min)

A time series is a sequence of observations ordered in time. Its usual components:

- **Trend**: the long-term increase or decrease.
- **Seasonality**: repeating patterns with a fixed period (weekly, yearly).
- **Cycles**: irregular longer swings (the economy).
- **Noise**: everything else.

**Autocorrelation** is the correlation of a series with its own past values (its lags). Strong autocorrelation at lag 7 in daily sales means weekly seasonality. ACF and PACF plots reveal the structure.

```python
import numpy as np
rng = np.random.default_rng(0)
t = np.arange(730)
sales = 200 + 0.15 * t + 40 * np.sin(2 * np.pi * t / 7) + 60 * np.sin(2 * np.pi * t / 365) + rng.normal(0, 15, len(t))

def autocorr(x, lag):
    return np.corrcoef(x[:-lag], x[lag:])[0, 1]
for lag in [1, 3, 7, 14, 30]:
    print(f"lag {lag:2}: autocorrelation {autocorr(sales, lag):.3f}")
```

**Stationarity**: a series is stationary when its statistical properties (mean, variance) don't change over time. Many classical models assume it. **Differencing** ($y_t - y_{t-1}$) removes trend, and seasonal differencing ($y_t - y_{t-7}$) removes weekly seasonality.

### Never shuffle time

> [!warning] Random splits leak the future
> If the training set contains next month's data, the model "predicts" the past from the future, and its scores look great right up until deployment. Always split **chronologically**.

**Time-series cross-validation** uses an expanding (or sliding) window: train on [1..100] and test on [101..130], then train on [1..130] and test on [131..160], and so on. In scikit-learn that's `TimeSeriesSplit`.

> [!recap]
> - Trend, seasonality, noise. Autocorrelation reveals the patterns.
> - Differencing helps toward stationarity.
> - Split by time. Use expanding-window CV.

# Lesson: Forecasting: ARIMA and ML with lag features (35 min)

### Baselines first

- **Naive**: tomorrow = today.
- **Seasonal naive**: next Monday = last Monday.
- **Moving average**.

A sophisticated model that doesn't beat seasonal naive isn't worth deploying.

### ARIMA, in brief

**ARIMA(p, d, q)** combines:
- **AR(p)**: a regression on its own p previous values.
- **I(d)**: differencing d times to remove trend.
- **MA(q)**: a regression on the past q forecast errors.

**SARIMA** adds seasonal terms. **Exponential smoothing** (Holt-Winters, ETS) is another classical family. These models are interpretable, give prediction intervals, and are great for single series with limited data.

```python norun
# Run in Colab / locally (statsmodels isn't bundled in the in-app runtime)
from statsmodels.tsa.arima.model import ARIMA
model = ARIMA(train_series, order=(2, 1, 1), seasonal_order=(1, 0, 1, 7)).fit()
forecast = model.get_forecast(steps=28)
print(forecast.predicted_mean, forecast.conf_int())
```

### ML forecasting with lag and rolling features

Turn the series into a supervised table: each row is a time point, and the features describe the past.

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

rng = np.random.default_rng(0)
dates = pd.date_range("2024-01-01", periods=730, freq="D")
t = np.arange(730)
y = 200 + 0.15 * t + 40 * np.sin(2 * np.pi * t / 7) + 60 * np.sin(2 * np.pi * t / 365) + rng.normal(0, 15, 730)
df = pd.DataFrame({"y": y}, index=dates)

for lag in [1, 7, 14, 28]:
    df[f"lag_{lag}"] = df["y"].shift(lag)
df["roll_mean_7"] = df["y"].shift(1).rolling(7).mean()     # shift(1): only use the PAST
df["dow"] = df.index.dayofweek
df["doy"] = df.index.dayofyear
df = df.dropna()

train, test = df[df.index < "2025-10-01"], df[df.index >= "2025-10-01"]
X_cols = [c for c in df.columns if c != "y"]
model = HistGradientBoostingRegressor(random_state=0).fit(train[X_cols], train["y"])
pred = model.predict(test[X_cols])
naive = test["lag_7"]                                     # seasonal naive baseline
print("model MAE:", round(mean_absolute_error(test["y"], pred), 2))
print("seasonal-naive MAE:", round(mean_absolute_error(test["y"], naive), 2))
```

> [!mistake] Leaky rolling features
> `rolling(7).mean()` *without* `.shift(1)` includes today's value, which is the very thing you're predicting. Features must only use information available **at prediction time**.

This example predicts one step ahead using true recent values. For multi-step horizons (28 days ahead), you'd need either **recursive** forecasting (feeding predictions back in) or **direct** models per horizon, and only lags ≥ the horizon are available.

### Error metrics

| Metric | Notes |
|---|---|
| MAE | Interpretable in units |
| RMSE | Penalizes large misses |
| MAPE | % error; breaks near zero and is asymmetric |
| sMAPE | A symmetric variant |
| MASE | Error relative to the naive forecast; < 1 means better than naive |

Always report **prediction intervals**. A forecast without uncertainty invites over-confident decisions.

> [!recap]
> - Beat naive and seasonal naive first.
> - ARIMA/SARIMA/ETS for single interpretable series. Gradient boosting with lag and rolling features scales to many series.
> - Use only past information in features. Pick the metric deliberately and give intervals.

# Quiz

## Why is implicit feedback (clicks, purchases) tricky?
- [ ] It's always more accurate than ratings
- [x] A missing interaction doesn't mean dislike; the user may never have seen the item
- [ ] It can't be stored in a matrix
- [ ] It requires deep learning
> Unobserved ≠ negative. Models must treat missing values carefully.

## Item–item collaborative filtering computes similarity between items based on:
- [ ] Their text descriptions
- [x] Which users interacted with them (their interaction columns)
- [ ] Their prices
- [ ] Random embeddings
> "Customers who bought X also bought Y" comes from co-interaction patterns.

## What's the best way to handle a brand-new item with no interactions?
- [ ] Wait until it has 1,000 ratings
- [x] Use content features (category, description embedding) in a hybrid approach
- [ ] Recommend it to everyone
- [ ] Remove it from the catalogue
> Content-based methods solve item cold start.

## Why must time-series validation not use random shuffling?
- [ ] It's slower
- [x] Training would include future data, so the evaluation leaks information and is over-optimistic
- [ ] Shuffling changes the values
- [ ] sklearn forbids it
> Always train on the past and test on the future.

## Strong autocorrelation at lag 7 in daily sales suggests:
- [ ] A yearly trend
- [x] Weekly seasonality
- [ ] No pattern
- [ ] Data leakage
> Values correlate with the same weekday last week.

## Which feature is leaky for predicting today's sales?
- [ ] Sales 7 days ago
- [x] A 7-day rolling mean that includes today
- [ ] Day of week
- [ ] Rolling mean of the previous 7 days (shifted by 1)
> Features may only use information available at prediction time.

## A model's MASE is 1.3. What does that mean?
- [ ] 30% error
- [x] It's worse than the naive baseline
- [ ] It's 1.3× better than naive
- [ ] It's perfectly calibrated
> MASE < 1 beats naive. 1.3 means 30% more error than naive.

## Which metric rewards placing relevant items near the top of a recommendation list?
- [ ] RMSE
- [ ] Accuracy
- [x] NDCG@k
- [ ] R²
> NDCG discounts relevant items that appear lower in the list.

# Exercise: Precision@k and recall@k

Write `precision_recall_at_k(recommended, relevant, k)` that returns `(precision, recall)` for one user. `recommended` is an ordered list, `relevant` is a set. Precision@k = relevant items in the top k ÷ k. Recall@k = relevant items in the top k ÷ |relevant| (0.0 if `relevant` is empty). Then write `mean_at_k(all_recs, all_rel, k)`, which averages both over users (two parallel lists).

## Starter

```python
def precision_recall_at_k(recommended, relevant, k):
    pass

def mean_at_k(all_recs, all_rel, k):
    pass
```

## Tests

```python
ns = load()
f = ns["precision_recall_at_k"]
assert f(["a", "b", "c", "d"], {"b", "d", "x"}, 2) == (0.5, 1/3)
assert f(["a", "b", "c", "d"], {"b", "d", "x"}, 4) == (0.5, 2/3)
assert f(["a"], set(), 1) == (0.0, 0.0)
p, r = ns["mean_at_k"]([["a", "b"], ["c", "d"]], [{"a"}, {"x"}], 2)
assert (p, r) == (0.25, 0.5), (p, r)
```

## Solution

```python
def precision_recall_at_k(recommended, relevant, k):
    hits = sum(1 for item in recommended[:k] if item in relevant)
    precision = hits / k
    recall = hits / len(relevant) if relevant else 0.0
    return precision, recall

def mean_at_k(all_recs, all_rel, k):
    pairs = [precision_recall_at_k(r, rel, k) for r, rel in zip(all_recs, all_rel)]
    n = len(pairs)
    return sum(p for p, _ in pairs) / n, sum(r for _, r in pairs) / n
```

# Exercise: Lag features without leakage

Write `make_features(series, lags=(1, 7), window=7)` that takes a pandas Series with a DatetimeIndex and returns a DataFrame with the column `y`, the columns `lag_{n}` for each lag, a column `roll_mean_{window}` (the mean of the **previous** `window` values, excluding the current one) and `dow` (day of week). Drop rows with missing values.

## Starter

```python
import pandas as pd

def make_features(series, lags=(1, 7), window=7):
    pass
```

## Tests

```python
import pandas as pd, numpy as np
ns = load()
s = pd.Series(np.arange(1, 21, dtype=float), index=pd.date_range("2025-01-01", periods=20, freq="D"))
df = ns["make_features"](s)
assert list(df.columns) == ["y", "lag_1", "lag_7", "roll_mean_7", "dow"], list(df.columns)
assert len(df) == 13, len(df)
row = df.loc["2025-01-10"]
assert row["y"] == 10 and row["lag_1"] == 9 and row["lag_7"] == 3
assert row["roll_mean_7"] == 6.0, "mean of days 3..9 = 6 (must exclude day 10)"
assert row["dow"] == 4
```

## Solution

```python
import pandas as pd

def make_features(series, lags=(1, 7), window=7):
    df = pd.DataFrame({"y": series})
    for n in lags:
        df[f"lag_{n}"] = series.shift(n)
    df[f"roll_mean_{window}"] = series.shift(1).rolling(window).mean()
    df["dow"] = series.index.dayofweek
    return df.dropna()
```

# Sources

- [Google ML: Recommendation systems course](https://developers.google.com/machine-learning/recommendation)
- Koren, Bell & Volinsky (2009), "Matrix Factorization Techniques for Recommender Systems", *IEEE Computer*
- Linden, Smith & York (2003), "Amazon.com Recommendations: Item-to-Item Collaborative Filtering", *IEEE Internet Computing*
- *Forecasting: Principles and Practice, 3rd ed.* by Hyndman & Athanasopoulos (free at otexts.com/fpp3)
- [scikit-learn: TimeSeriesSplit](https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split)
- [statsmodels: ARIMA and time-series analysis docs](https://www.statsmodels.org/stable/tsa.html)
