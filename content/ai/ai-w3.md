---
id: ai-w3
title: Decision Trees, Ensembles & Clustering
week: Week 3
summary: Decision trees and split criteria, pruning, bagging and random forests, gradient boosting, model selection, then unsupervised learning with K-Means, hierarchical clustering, DBSCAN and PCA.
builds_on: ai-w2, f-linalg
leads_to: ai-w4
---

Trees and tree ensembles are the workhorses of tabular ML: they win most competitions on spreadsheet-like data. The second half of the week switches to **unsupervised learning**, which finds structure without labels: customer segments, anomalies and compressed representations.

# Lesson: Decision trees (30 min)

A decision tree asks a sequence of yes/no questions about the features ("is `tenure < 6`?", then "is `monthly_charges > 70`?") until it reaches a leaf that makes a prediction. It's the automated version of the if/elif rules you wrote in Python week 1.

### How splits are chosen

At each node, the tree tries every feature and threshold, and picks the split that makes the child nodes **purest**:

- **Gini impurity**: $G = 1 - \sum_k p_k^2$ (0 = pure).
- **Entropy**: $H = -\sum_k p_k \log_2 p_k$. Its reduction is the **information gain**.
- For regression trees: the reduction in variance (MSE).

```python
def gini(labels):
    n = len(labels)
    return 1 - sum((labels.count(c) / n) ** 2 for c in set(labels))

parent = ["churn"] * 5 + ["stay"] * 5
left, right = ["churn"] * 4 + ["stay"], ["churn"] + ["stay"] * 4      # a candidate split
weighted = (len(left) * gini(left) + len(right) * gini(right)) / len(parent)
print("parent gini", gini(parent), "→ after split", round(weighted, 3))
```

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text

data = load_breast_cancer()
X_tr, X_te, y_tr, y_te = train_test_split(data.data, data.target, stratify=data.target, random_state=0)
for depth in [1, 3, None]:
    t = DecisionTreeClassifier(max_depth=depth, random_state=0).fit(X_tr, y_tr)
    print(f"max_depth={depth}: train {t.score(X_tr, y_tr):.3f}  test {t.score(X_te, y_te):.3f}  leaves {t.get_n_leaves()}")
small = DecisionTreeClassifier(max_depth=2, random_state=0).fit(X_tr, y_tr)
print(export_text(small, feature_names=list(data.feature_names)))
```

### Overfitting and pruning

An unrestricted tree grows until every leaf is pure: 100% training accuracy, memorized noise. Control it with **pre-pruning** (`max_depth`, `min_samples_leaf`, `min_samples_split`) or **post-pruning** (cost-complexity pruning, `ccp_alpha`).

**Strengths:** interpretable, no feature scaling needed, handles non-linearity and interactions, works with mixed feature types. **Weaknesses:** high variance (small data changes can produce a different tree) and piecewise-constant predictions.

> [!recap]
> - Greedy splits that maximize purity (Gini/entropy/variance).
> - Unpruned trees overfit, so limit depth and leaf size or prune.
> - Interpretable but high-variance, which is what ensembles fix.

# Lesson: Ensembles: bagging, random forests and boosting (35 min)

### Bagging and random forests: averaging away variance

**Bagging** (bootstrap aggregating) trains many trees on **bootstrap samples** of the data and averages their predictions. Averaging many high-variance, roughly independent models reduces the variance. (Remember: the average of $n$ independent estimates has variance $\sigma^2/n$.)

A **random forest** adds a twist: at each split, it considers only a **random subset of features**. That **decorrelates** the trees, which makes the averaging much more effective.

- Robust defaults and little tuning. Gives **out-of-bag (OOB)** error estimates for free.
- Provides **feature importances**. Prefer **permutation importance** on validation data, because impurity-based importance is biased toward high-cardinality features.

### Boosting: fixing mistakes sequentially

**Boosting** trains shallow trees **one after another**. Each new tree focuses on what the current ensemble gets wrong. In **gradient boosting**, each tree fits the **negative gradient of the loss**, which for MSE is just the residuals. It's gradient descent in "function space".

$$F_{m}(x) = F_{m-1}(x) + \eta \cdot h_m(x)$$

The key hyperparameters are the **learning rate** $\eta$, the **number of trees** and the **tree depth**. Use **early stopping** on validation data to pick the number of trees. Popular libraries: **XGBoost**, **LightGBM**, **CatBoost**, and scikit-learn's `HistGradientBoosting*`.

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
models = {
    "logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
    "tree": DecisionTreeClassifier(random_state=0),
    "random forest": RandomForestClassifier(n_estimators=200, random_state=0),
    "grad. boosting": HistGradientBoostingClassifier(random_state=0),
}
for name, m in models.items():
    s = cross_val_score(m, X, y, cv=5, scoring="roc_auc")
    print(f"{name:15} ROC-AUC {s.mean():.3f} ± {s.std():.3f}")
```

### Model selection, honestly

1. Start with a **simple baseline** (logistic/linear regression, or even "predict the majority class").
2. Compare candidates with the **same cross-validation folds** and a metric that matches the business goal.
3. Tune hyperparameters with `GridSearchCV` / `RandomizedSearchCV` **inside** CV.
4. Consider complexity, latency and interpretability, not just the score.
5. Confirm once on the held-out test set.

> [!recap]
> - Bagging/random forests average decorrelated trees, which reduces variance.
> - Boosting adds trees sequentially to fix residuals, with a learning rate and early stopping.
> - Baseline first, the same CV for every model, tuning inside CV, test once.

# Lesson: Clustering: K-Means, hierarchical and DBSCAN (35 min)

**Unsupervised learning** has no labels. Clustering groups similar points together, for example to discover customer segments.

### K-Means

1. Choose $k$, and initialize $k$ centroids (k-means++ chooses them well).
2. **Assign** each point to its nearest centroid.
3. **Update** each centroid to the mean of its points.
4. Repeat until nothing changes. This minimizes the **inertia** (within-cluster sum of squared distances).

```python
import numpy as np
from sklearn.datasets import make_blobs
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=600, centers=4, cluster_std=1.1, random_state=7)
for k in range(2, 8):
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
    print(f"k={k}: inertia {km.inertia_:8.1f}   silhouette {silhouette_score(X, km.labels_):.3f}")
```

**Choosing k**: the **elbow** in inertia (where adding clusters stops helping much) and the **silhouette score** (−1 to 1: how much closer each point is to its own cluster than to the next one). Business usefulness matters too: can marketing act on 4 segments?

K-Means assumes roughly **spherical, similarly sized** clusters, is sensitive to scale (standardize first!) and to outliers, and needs $k$ in advance.

### Hierarchical (agglomerative) clustering

Start with every point as its own cluster, then repeatedly **merge the two closest clusters**. "Closest" depends on the **linkage**: Ward minimizes variance (the usual default), while complete, average and single linkage behave differently. The result is a **dendrogram** that you can cut at any level. You don't have to fix $k$ up front, but it scales poorly to large datasets.

### DBSCAN: density-based clustering

Clusters are dense regions separated by sparse ones. A point with at least `min_samples` neighbours within distance `eps` is a **core point**. Clusters grow from core points, and points that are in no dense region are labelled **noise (−1)**.

```python
from sklearn.datasets import make_moons
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import adjusted_rand_score
X, y = make_moons(n_samples=400, noise=0.06, random_state=0)
km = KMeans(2, n_init=10, random_state=0).fit(X)
db = DBSCAN(eps=0.2, min_samples=5).fit(X)
print("K-Means agreement with true shapes:", round(adjusted_rand_score(y, km.labels_), 3))
print("DBSCAN agreement:", round(adjusted_rand_score(y, db.labels_), 3), " noise points:", (db.labels_ == -1).sum())
```

DBSCAN finds **arbitrary shapes** and **outliers**, and doesn't need $k$. It does struggle when clusters have very different densities.

### Evaluating and interpreting clusters

- Internal metrics: silhouette, Davies–Bouldin.
- **Profile** each cluster: the mean of each feature per cluster ("Segment 2: young, high frequency, low basket size").
- Check **stability**: do the clusters survive resampling or a different random seed?
- Ultimately: are the clusters **useful** for a decision?

> [!recap]
> - K-Means: assign/update, choose k with elbow + silhouette, scale first, spherical assumption.
> - Hierarchical: merges, linkage choice, dendrogram.
> - DBSCAN: density-based, any shape, labels noise.

# Lesson: PCA: dimensionality reduction (25 min)

**Principal Component Analysis** finds new axes (principal components) ordered by how much **variance** they capture. These are the eigenvectors of the covariance matrix from *Linear Algebra for ML*. Projecting onto the top components compresses the data while keeping most of its information.

```python
import numpy as np
from sklearn.datasets import load_digits
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

X, y = load_digits(return_X_y=True)          # 1797 images of 8×8 = 64 pixels
Xs = StandardScaler().fit_transform(X)
pca = PCA().fit(Xs)
cum = np.cumsum(pca.explained_variance_ratio_)
for k in [2, 10, 20, 30, 40]:
    print(f"{k:2} components explain {cum[k - 1]:.1%} of the variance")
print("components for 90%:", int(np.searchsorted(cum, 0.90) + 1))
```

Uses:
- **Visualization**: plot the data in 2–3 components.
- **Speed and noise reduction** before other models.
- **Fighting multicollinearity** in regression.

Caveats: components are linear combinations of the original features (harder to interpret), PCA needs scaled features, and it captures only *linear* structure. t-SNE and UMAP are non-linear options, but they're for visualization only.

> [!connect] Embeddings are learned compression
> PCA compresses 64 pixels into a few numbers. Neural networks learn much richer compressions, called **embeddings** (AI week 9), which power semantic search (Agentic week 2).

> [!recap]
> - PCA projects onto the directions of maximum variance (eigenvectors).
> - Use explained-variance ratios to choose the number of components. Scale first.
> - It's linear only. Use t-SNE or UMAP for non-linear visualization.

# Quiz

## A node has 8 "yes" and 2 "no" samples. What is its Gini impurity?
- [ ] 0.2
- [x] 0.32
- [ ] 0.5
- [ ] 0.8
> 1 − (0.8² + 0.2²) = 1 − 0.68 = 0.32.

## Why does a random forest consider only a random subset of features at each split?
- [ ] To train faster only
- [x] To decorrelate the trees, so averaging reduces variance more
- [ ] To avoid scaling
- [ ] To make the trees deeper
> Correlated trees make the same mistakes. Decorrelation makes the ensemble stronger.

## Bagging primarily reduces ______; boosting primarily reduces ______.
- [x] variance; bias
- [ ] bias; variance
- [ ] both reduce only variance
- [ ] neither
> Averaging fights variance. Sequentially fitting residuals fights bias (and needs regularization to avoid overfitting).

## In gradient boosting with MSE loss, what does each new tree fit?
- [ ] The original labels
- [x] The residuals (the negative gradient of the loss)
- [ ] Random noise
- [ ] The previous tree's structure
> Each tree corrects what the current ensemble gets wrong.

## Which clustering method can find crescent-shaped clusters and label outliers?
- [ ] K-Means
- [x] DBSCAN
- [ ] PCA
- [ ] Linear regression
> Density-based clustering handles arbitrary shapes and noise.

## What should you do before K-Means on features like income (millions) and age (years)?
- [ ] Nothing
- [x] Standardize the features
- [ ] Remove age
- [ ] Use more clusters
> Distances would be dominated by income otherwise.

## PCA's first principal component is:
- [ ] The feature with the largest values
- [x] The direction of maximum variance in the data
- [ ] The cluster centroid
- [ ] The target variable
> It's the top eigenvector of the covariance matrix.

## A silhouette score near 0 suggests:
- [ ] Perfect clusters
- [x] Overlapping clusters, with points near the boundaries
- [ ] Too few samples
- [ ] The data is scaled
> Near 1 is well separated. Negative values suggest wrong assignments.

# Exercise: K-Means from scratch with NumPy

Implement `kmeans(X, k, iters=100, seed=0)` that returns `(centroids, labels)`. Initialize the centroids as `k` distinct random rows of X (`rng.choice(len(X), k, replace=False)`). Then alternate the assign and update steps until the labels stop changing or `iters` is reached. If a cluster becomes empty, keep its previous centroid.

## Starter

```python
import numpy as np

def kmeans(X, k, iters=100, seed=0):
    rng = np.random.default_rng(seed)
    pass
```

## Tests

```python
import numpy as np
ns = load()
rng = np.random.default_rng(3)
X = np.vstack([rng.normal(c, 0.3, size=(50, 2)) for c in [(0, 0), (5, 5), (0, 5)]])
runs = [ns["kmeans"](X, 3, seed=s) for s in range(6)]
inertia = lambda C, labels: float(((X - C[labels]) ** 2).sum())
C, labels = min(runs, key=lambda r: inertia(*r))      # best of several starts, like sklearn's n_init
assert C.shape == (3, 2) and labels.shape == (150,)
found = sorted(tuple(np.round(c).astype(int)) for c in C)
assert found == [(0, 0), (0, 5), (5, 5)], found
for g in range(3):
    assert len(set(labels[g * 50:(g + 1) * 50])) == 1, "each blob should be one cluster"
```

## Hint

Distances from all points to all centroids at once: `d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)` has shape (n, k), and `labels = d.argmin(axis=1)`. Update: `C[j] = X[labels == j].mean(axis=0)`.

## Solution

```python
import numpy as np

def kmeans(X, k, iters=100, seed=0):
    rng = np.random.default_rng(seed)
    X = np.asarray(X, dtype=float)
    C = X[rng.choice(len(X), k, replace=False)].copy()
    labels = None
    for _ in range(iters):
        d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
        new = d.argmin(axis=1)
        if labels is not None and np.array_equal(new, labels):
            break
        labels = new
        for j in range(k):
            if np.any(labels == j):
                C[j] = X[labels == j].mean(axis=0)
    return C, labels
```

Broadcasting `(n,1,d) − (1,k,d)` computes all n×k distances without Python loops.

K-Means can converge to a **local minimum**: if two initial centroids land in the same blob, one real cluster gets split while two others merge. That's why the test runs several random starts and keeps the lowest inertia, which is exactly what scikit-learn's `n_init` parameter does (and why k-means++ initialization exists).

# Exercise: Beat the baseline

Write `compare(seed=0)` that loads `load_breast_cancer`, and returns a dict mapping the names `"dummy"`, `"logreg"`, `"forest"` and `"boosting"` to their **mean 5-fold CV ROC-AUC** (use `StratifiedKFold(5, shuffle=True, random_state=seed)` for all of them). The models: `DummyClassifier(strategy="prior")`, a scaled `LogisticRegression(max_iter=2000)`, `RandomForestClassifier(n_estimators=100, random_state=seed)` and `HistGradientBoostingClassifier(random_state=seed)`.

## Starter

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier

def compare(seed=0):
    pass

print(compare())
```

## Tests

```python
ns = load()
r = ns["compare"](0)
assert set(r) == {"dummy", "logreg", "forest", "boosting"}
assert abs(r["dummy"] - 0.5) < 1e-9, "the prior dummy has no ranking ability: AUC 0.5"
assert all(r[m] > 0.97 for m in ["logreg", "forest", "boosting"]), r
```

## Solution

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier

def compare(seed=0):
    X, y = load_breast_cancer(return_X_y=True)
    cv = StratifiedKFold(5, shuffle=True, random_state=seed)
    models = {
        "dummy": DummyClassifier(strategy="prior"),
        "logreg": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
        "forest": RandomForestClassifier(n_estimators=100, random_state=seed),
        "boosting": HistGradientBoostingClassifier(random_state=seed),
    }
    return {name: float(cross_val_score(m, X, y, cv=cv, scoring="roc_auc").mean()) for name, m in models.items()}

print(compare())
```

Notice that the humble logistic regression is as good as the fancy ensembles here. Always check the simple model.

# Sources

- [scikit-learn User Guide: Decision Trees, Ensembles, Clustering, PCA](https://scikit-learn.org/stable/user_guide.html)
- *An Introduction to Statistical Learning (ISLP)*, chapters 8 (trees) and 12 (unsupervised learning), free at statlearning.com
- Breiman (2001), "Random Forests", *Machine Learning* 45
- Friedman (2001), "Greedy Function Approximation: A Gradient Boosting Machine", *Annals of Statistics*
- [StatQuest (Josh Starmer): Decision Trees, Random Forests, Gradient Boost, PCA videos](https://statquest.org/video-index/)
- Ester et al. (1996), "A Density-Based Algorithm for Discovering Clusters" (DBSCAN), KDD
