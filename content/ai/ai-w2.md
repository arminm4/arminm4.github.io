---
id: ai-w2
title: Regression & Classification
week: Week 2
summary: Supervised learning and generalization, linear/polynomial regression, Ridge and Lasso, logistic regression, and the classification metrics that matter (precision, recall, F1, ROC-AUC, imbalance).
builds_on: ai-w1, f-linalg, f-calculus
leads_to: ai-w3, ai-w7
---

This is the heart of classical machine learning. You'll frame problems as **supervised learning**, train models with **scikit-learn**, and, more importantly, learn to **evaluate them honestly**. scikit-learn runs in your browser (the first import downloads it once), so run and modify everything.

# Lesson: Supervised learning and generalization (30 min)

In supervised learning you have examples $(x_i, y_i)$: **features** $x$ and a **label** $y$. You want a function $f$ such that $f(x) \approx y$ for **new, unseen** $x$.

- **Regression**: $y$ is a number (price, demand, minutes).
- **Classification**: $y$ is a category (spam/not spam, churn/stay, digit 0–9).

### The one rule: never evaluate on training data

A model can memorize its training set. What matters is **generalization**. Split the data:

- **Training set**: fit the parameters.
- **Validation set** (or cross-validation): choose hyperparameters and compare models.
- **Test set**: touch it **once**, at the end, for an unbiased final estimate.

```python
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

rng = np.random.default_rng(0)
X = rng.uniform(20, 200, size=(300, 1))                  # house size m²
y = 1500 * X[:, 0] + 40_000 + rng.normal(0, 25_000, 300) # price + noise
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

model = LinearRegression().fit(X_tr, y_tr)       # the sklearn API: fit / predict
print("slope ≈", round(model.coef_[0]), " intercept ≈", round(model.intercept_))
print("test MAE:", round(mean_absolute_error(y_te, model.predict(X_te))))
```

### Underfitting, overfitting and the bias–variance trade-off

- **Underfitting (high bias)**: the model is too simple to capture the pattern, so error is high on *both* training and test data.
- **Overfitting (high variance)**: the model fits the noise, so training error is low and test error is high.
- The goal is the sweet spot. More data, regularization and simpler models fight overfitting. Better features and more flexible models fight underfitting.

### Data leakage: the silent killer

**Leakage** happens when information from the test set, or from the future, sneaks into training: for example, scaling with statistics computed on *all* the data, or using a feature that is recorded *after* the outcome ("refund_issued" used to predict "will_complain"). The fix is to put preprocessing inside a **Pipeline** fitted only on the training data.

> [!recap]
> - Regression predicts numbers, classification predicts categories.
> - Train / validation / test. Evaluate only on unseen data.
> - Bias vs variance. Prevent leakage with pipelines.

# Lesson: Linear and polynomial regression (30 min)

Linear regression models $\hat{y} = \mathbf{w}\cdot\mathbf{x} + b$ and chooses $\mathbf{w}, b$ to minimize the **mean squared error**. You implemented this with gradient descent in *Calculus for ML*. scikit-learn solves it exactly with linear algebra (least squares).

### Regression metrics

| Metric | Formula | Notes |
|---|---|---|
| MAE | $\frac{1}{n}\sum\lvert y - \hat y\rvert$ | In the target's units; robust to outliers |
| RMSE | $\sqrt{\frac{1}{n}\sum (y - \hat y)^2}$ | Penalizes large errors |
| R² | $1 - \frac{\sum (y-\hat y)^2}{\sum (y - \bar y)^2}$ | The share of variance explained; 1 is perfect, 0 is "predict the mean" |

### Polynomial features: flexibility and its danger

```python
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error

rng = np.random.default_rng(1)
x = np.sort(rng.uniform(0, 1, 30)); y = np.sin(2 * np.pi * x) + rng.normal(0, 0.2, 30)
x_te = np.linspace(0, 1, 200); y_te = np.sin(2 * np.pi * x_te)

for degree in [1, 3, 15]:
    m = make_pipeline(PolynomialFeatures(degree), LinearRegression()).fit(x[:, None], y)
    tr = mean_squared_error(y, m.predict(x[:, None]))
    te = mean_squared_error(y_te, m.predict(x_te[:, None]))
    print(f"degree {degree:2}: train MSE {tr:.3f}   test MSE {te:.3f}")
```

Degree 1 underfits, degree 3 is about right, and degree 15 overfits: almost zero training error, larger test error.

### Interpreting coefficients

With standardized features, the coefficient magnitudes are comparable: "+1 standard deviation of size → +X price". Be careful, though: correlated features (multicollinearity) make individual coefficients unstable, and **coefficients describe associations, not causes**.

> [!recap]
> - Least squares minimizes MSE. Report MAE/RMSE/R² on test data.
> - Polynomial features add flexibility, and with it the risk of overfitting.
> - Coefficients describe associations, not causation.

# Lesson: Regularization: Ridge and Lasso (25 min)

Regularization adds a penalty for large weights, which trades a little bias for a big reduction in variance:

$$\text{Ridge: } \min \sum (y - \hat y)^2 + \alpha \sum w_j^2 \qquad \text{Lasso: } \min \sum (y - \hat y)^2 + \alpha \sum |w_j|$$

- **Ridge (L2)** shrinks all the weights smoothly. It's good when many features each contribute a little.
- **Lasso (L1)** can push weights to **exactly zero**, which does automatic feature selection.
- $\alpha$ controls the strength: 0 is plain linear regression, and a large $\alpha$ makes the model very simple.
- **Scale your features first.** The penalty treats all weights equally, so the units matter.

```python
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge, Lasso, LinearRegression
from sklearn.model_selection import cross_val_score

rng = np.random.default_rng(2)
n, p = 80, 30
X = rng.normal(size=(n, p))
true_w = np.zeros(p); true_w[:3] = [3, -2, 1.5]          # only 3 features matter
y = X @ true_w + rng.normal(0, 1, n)

for name, reg in [("OLS", LinearRegression()), ("Ridge", Ridge(alpha=5)), ("Lasso", Lasso(alpha=0.1))]:
    pipe = make_pipeline(StandardScaler(), reg)
    score = cross_val_score(pipe, X, y, cv=5, scoring="neg_root_mean_squared_error").mean()
    pipe.fit(X, y)
    nonzero = np.sum(np.abs(pipe[-1].coef_) > 1e-6)
    print(f"{name:5}: CV RMSE {-score:.3f}  non-zero weights: {nonzero}")
```

### Cross-validation

**k-fold CV** splits the training data into k folds, trains on k−1 of them and validates on the remaining one, rotating through all k. Averaging the k scores gives a more stable estimate than a single split. Use `GridSearchCV` to pick $\alpha$ this way.

> [!recap]
> - Ridge shrinks weights, Lasso zeros some of them. Always scale first.
> - Choose α with k-fold cross-validation, never with the test set.

# Lesson: Logistic regression and multiclass classification (30 min)

For binary classification, logistic regression passes a linear score through the **sigmoid** to get a probability:

$$P(y=1\mid x) = \sigma(\mathbf{w}\cdot\mathbf{x} + b) = \frac{1}{1 + e^{-(\mathbf{w}\cdot\mathbf{x} + b)}}$$

It's trained by minimizing **log loss** (cross-entropy), which heavily penalizes confident wrong predictions:

$$L = -\frac{1}{n}\sum \left[y \log \hat p + (1-y)\log(1-\hat p)\right]$$

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss

X, y = load_breast_cancer(return_X_y=True)            # 569 tumours, 30 features; 1 = benign
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)
clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X_tr, y_tr)
proba = clf.predict_proba(X_te)[:, 1]
print("accuracy:", round(accuracy_score(y_te, clf.predict(X_te)), 3), " log loss:", round(log_loss(y_te, proba), 3))
print("first 5 probabilities:", proba[:5].round(3))
```

`stratify=y` keeps the class proportions the same in the train and test sets. Always use it for classification.

### The decision threshold is a business choice

`predict` uses a threshold of 0.5 by default. In medical screening you'd lower it to catch more positives, accepting more false alarms. The right threshold depends on the **costs** of each kind of error.

### Multiclass

- **Softmax (multinomial)** logistic regression outputs a probability distribution over $K$ classes: $p_k = \frac{e^{z_k}}{\sum_j e^{z_j}}$. This is the same softmax you'll meet in neural networks and LLMs.
- **One-vs-rest**: train one binary classifier per class.

### A quick tour of other classifiers

| Model | Idea | Notes |
|---|---|---|
| **KNN** | Predict the majority label of the k nearest neighbours | Needs scaling; slow on big data; no training |
| **SVM** | Find the maximum-margin boundary; kernels for non-linear boundaries | Strong on medium-size data; needs scaling |
| **Naive Bayes** | Bayes' rule with "independent features" | Very fast; a strong baseline for text (AI week 9) |

> [!recap]
> - Logistic regression = linear score + sigmoid, trained with log loss.
> - Choose the threshold from the costs. Stratify your splits.
> - Softmax for multiclass. KNN, SVM and Naive Bayes as alternatives.

# Lesson: Evaluating classifiers: beyond accuracy (35 min)

### The confusion matrix

| | Predicted positive | Predicted negative |
|---|---|---|
| **Actually positive** | TP | FN (missed) |
| **Actually negative** | FP (false alarm) | TN |

- **Precision** = TP / (TP + FP): "when I say positive, how often am I right?"
- **Recall (sensitivity)** = TP / (TP + FN): "of all real positives, how many did I find?"
- **F1** = $2\cdot\frac{P\cdot R}{P + R}$: the harmonic mean, which is high only if both are high.
- **Accuracy** = (TP + TN) / total. It's **misleading under class imbalance**.

> [!example] The 99%-accurate useless model
> If 1% of transactions are fraud, a model that always says "not fraud" is 99% accurate, with zero recall. That's why fraud, churn and medical models report precision, recall and PR-AUC.

### ROC and AUC

The **ROC curve** plots the true-positive rate (recall) against the false-positive rate at every threshold. **ROC-AUC** is the probability that a random positive gets a higher score than a random negative: 0.5 is random and 1.0 is perfect. Under heavy imbalance, the **precision–recall curve (PR-AUC)** is more informative.

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score, average_precision_score

X, y = make_classification(n_samples=5000, n_features=10, weights=[0.95, 0.05], random_state=1)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=1)
for name, clf in [("plain", LogisticRegression(max_iter=1000)),
                  ("balanced", LogisticRegression(max_iter=1000, class_weight="balanced"))]:
    clf.fit(X_tr, y_tr)
    pred, proba = clf.predict(X_te), clf.predict_proba(X_te)[:, 1]
    print(f"--- {name}: ROC-AUC {roc_auc_score(y_te, proba):.3f}  PR-AUC {average_precision_score(y_te, proba):.3f}")
    print(confusion_matrix(y_te, pred))
    print(classification_report(y_te, pred, digits=3))
```

### Handling class imbalance

1. Use the right metrics: precision/recall/F1 and PR-AUC.
2. **Class weights** (`class_weight="balanced"`) make errors on the rare class cost more.
3. **Resampling**: oversample the minority class (e.g. SMOTE) or undersample the majority, **on the training data only**.
4. **Tune the threshold** on validation data to fit the costs.
5. Collect more minority examples if you can.

> [!connect] The same metrics for LLM systems
> Retrieval evaluation (did we fetch the relevant documents?) uses precision@k and recall@k. Guardrail classifiers trade false positives (blocking good requests) against false negatives (letting bad ones through). See Agentic week 2 and Full-Stack week 11.

> [!recap]
> - Precision vs recall. F1 combines them. Accuracy misleads under imbalance.
> - ROC-AUC measures ranking quality. PR-AUC is better for rare positives.
> - Imbalance: class weights, resampling and threshold tuning.

# Quiz

## Why must you never choose hyperparameters using the test set?
- [ ] It's slower
- [x] The test score would become optimistically biased; it would no longer measure performance on unseen data
- [ ] sklearn forbids it
- [ ] The test set is too small
> Use validation or cross-validation for choices, and the test set once at the end.

## A model has train RMSE 0.1 and test RMSE 5.0. Most likely:
- [ ] Underfitting
- [x] Overfitting
- [ ] Perfect fit
- [ ] Data leakage made the test error high
> Very low training error plus high test error means high variance.

## Fitting a StandardScaler on the full dataset before splitting causes:
- [ ] Better accuracy legitimately
- [x] Data leakage from the test set into training
- [ ] An error in sklearn
- [ ] No effect
> Fit the preprocessing on training data only. Pipelines enforce this.

## Which regularization can set coefficients exactly to zero?
- [ ] Ridge (L2)
- [x] Lasso (L1)
- [ ] Both equally
- [ ] Neither
> The L1 penalty's geometry produces sparse solutions.

## A fraud model flags 100 transactions; 80 are real fraud, and there were 200 frauds in total. Precision and recall?
- [ ] Precision 0.4, recall 0.8
- [x] Precision 0.8, recall 0.4
- [ ] Precision 0.8, recall 0.8
- [ ] Precision 0.5, recall 0.5
> Precision = 80/100. Recall = 80/200.

## With 1% positives, which metric is most misleading on its own?
- [x] Accuracy
- [ ] Recall
- [ ] PR-AUC
- [ ] F1
> Always predicting "negative" already scores 99% accuracy.

## What does ROC-AUC = 0.5 indicate?
- [ ] Perfect ranking
- [x] Ranking no better than random
- [ ] 50% accuracy
- [ ] 50% precision
> AUC is the probability that a random positive outranks a random negative.

## In a cancer-screening model, missing a cancer is very costly. You should:
- [ ] Raise the decision threshold
- [x] Lower the decision threshold to increase recall, accepting more false positives
- [ ] Optimize accuracy only
- [ ] Remove the minority class
> Thresholds encode the cost trade-off between FN and FP.

# Exercise: Classification metrics from scratch

Implement `metrics(y_true, y_pred)` for binary labels (0/1) without sklearn. Return a dict with `tp`, `fp`, `fn`, `tn`, `precision`, `recall`, `f1` and `accuracy`. When a denominator is 0, use 0.0 for that metric.

## Starter

```python
def metrics(y_true, y_pred):
    pass

print(metrics([1, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0]))
```

## Tests

```python
ns = load()
m = ns["metrics"]([1, 0, 1, 1, 0, 0], [1, 0, 0, 1, 1, 0])
assert (m["tp"], m["fp"], m["fn"], m["tn"]) == (2, 1, 1, 2), m
assert abs(m["precision"] - 2/3) < 1e-9 and abs(m["recall"] - 2/3) < 1e-9
assert abs(m["f1"] - 2/3) < 1e-9 and abs(m["accuracy"] - 4/6) < 1e-9
z = ns["metrics"]([0, 0, 0], [0, 0, 0])
assert z["precision"] == 0.0 and z["recall"] == 0.0 and z["f1"] == 0.0 and z["accuracy"] == 1.0
```

## Solution

```python
def metrics(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    div = lambda a, b: a / b if b else 0.0
    precision, recall = div(tp, tp + fp), div(tp, tp + fn)
    f1 = div(2 * precision * recall, precision + recall)
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": precision,
            "recall": recall, "f1": f1, "accuracy": div(tp + tn, len(y_true))}
```

# Exercise: A leak-free model with tuned threshold

Using `load_breast_cancer`, write `train_and_tune(seed=0)` that:
1. Splits 60/20/20 into train/validation/test (stratified, `random_state=seed`).
2. Fits a `Pipeline(StandardScaler, LogisticRegression(max_iter=2000))` on **train**.
3. Picks the threshold (from `np.linspace(0.05, 0.95, 91)`) that **maximizes F1 on validation**, treating class **0 (malignant)** as the positive class.
4. Returns `(threshold, test_f1)`, where test_f1 uses that threshold on the test set (positive = class 0).

## Starter

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score

def train_and_tune(seed=0):
    pass

print(train_and_tune())
```

## Tests

```python
ns = load()
t, f1 = ns["train_and_tune"](0)
assert 0.05 <= t <= 0.95
assert f1 > 0.9, f1
t2, f12 = ns["train_and_tune"](0)
assert (t, f1) == (t2, f12), "must be deterministic"
```

## Hint

`P(malignant) = predict_proba(X)[:, 0]`. Predict "malignant" when that probability is ≥ the threshold. Use `f1_score(y == 0, pred)` to compute F1 with malignant as the positive class. Split twice: first 80/20 into (temp, test), then 75/25 of temp into (train, val).

## Solution

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score

def train_and_tune(seed=0):
    X, y = load_breast_cancer(return_X_y=True)
    X_tmp, X_te, y_tmp, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=seed)
    X_tr, X_va, y_tr, y_va = train_test_split(X_tmp, y_tmp, test_size=0.25, stratify=y_tmp, random_state=seed)
    model = Pipeline([("scale", StandardScaler()), ("clf", LogisticRegression(max_iter=2000))]).fit(X_tr, y_tr)
    p_va = model.predict_proba(X_va)[:, 0]
    best_t, best_f1 = 0.5, -1
    for t in np.linspace(0.05, 0.95, 91):
        f = f1_score(y_va == 0, p_va >= t)
        if f > best_f1:
            best_t, best_f1 = float(t), f
    p_te = model.predict_proba(X_te)[:, 0]
    return best_t, float(f1_score(y_te == 0, p_te >= best_t))

print(train_and_tune())
```

The test set is used exactly once, after every choice (the model and the threshold) has been made on train and validation data.

# Sources

- [scikit-learn User Guide: Linear models, Model selection, Metrics](https://scikit-learn.org/stable/user_guide.html)
- [Google ML Crash Course: Classification: precision, recall, ROC/AUC](https://developers.google.com/machine-learning/crash-course/classification)
- *An Introduction to Statistical Learning (ISLP, Python edition)* by James, Witten, Hastie, Tibshirani & Taylor (free at statlearning.com), chapters 2–6
- *Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow* by Aurélien Géron, chapters 2–4
- [scikit-learn: Common pitfalls and recommended practices (data leakage)](https://scikit-learn.org/stable/common_pitfalls.html)
