---
id: f-linalg
title: Linear Algebra for ML
week: Foundation 2
summary: Vectors, dot products, norms, cosine similarity, matrices, matrix multiplication and the geometric intuition behind embeddings and PCA.
builds_on: f-algebra
leads_to: f-pydata, ai-w2, ai-w3, ai-w7, ai-w9, ag-w2, fs-w6
---

Linear algebra is the language of data. A row in a table is a **vector**, a whole dataset is a **matrix**, a neural-network layer is a **matrix multiplication**, and the "meaning" of a sentence in an LLM system is an **embedding vector**. This module gives you the intuition plus enough mechanics to read ML code and formulas. Every operation is first written as plain Python loops, so you see what NumPy does for you.

# Lesson: Vectors: lists of numbers with geometry (20 min)

A **vector** is an ordered list of numbers: $\mathbf{v} = [3, 4]$. You can read it two ways:

1. **As data.** A customer described by `[age, orders, avg_basket] = [31, 12, 54.5]` is a point in 3-dimensional "feature space".
2. **As geometry.** An arrow from the origin to the point $(3, 4)$, with a direction and a length.

Both views are the same object. This is why "similar customers" can mean "points that are close together".

### Operations

Adding vectors works element by element. Multiplying by a **scalar** (a single number) stretches the vector:

$$[1, 2] + [3, 1] = [4, 3] \qquad 2 \cdot [1, 2] = [2, 4]$$

```python
def add(u, v):
    return [a + b for a, b in zip(u, v)]

def scale(c, v):
    return [c * a for a in v]

print(add([1, 2], [3, 1]))
print(scale(2, [1, 2]))
```

Geometrically, adding means placing the arrows tip-to-tail, and scaling stretches or flips an arrow.

### Length (norm)

The **Euclidean norm** (L2) is Pythagoras in $n$ dimensions:

$$\|\mathbf{v}\|_2 = \sqrt{v_1^2 + v_2^2 + \cdots + v_n^2}$$

The **L1 norm** $\|\mathbf{v}\|_1 = \sum |v_i|$ is the "Manhattan" distance: walking along city blocks. **Distance** between two vectors is the norm of their difference: $\|\mathbf{u} - \mathbf{v}\|$.

```python
import math
def norm(v):
    return math.sqrt(sum(a * a for a in v))

print(norm([3, 4]))                      # 5.0
u, v = [1, 2, 3], [4, 6, 3]
print(norm([a - b for a, b in zip(u, v)]))  # distance between u and v
```

A **unit vector** has length 1. Dividing a vector by its norm ("normalizing") keeps the direction and drops the magnitude.

> [!connect] Feature scaling
> If one feature is "salary" (in millions) and another is "age" (0–100), distances are dominated by salary. That's why ML pipelines **standardize** features before using distance-based models like KNN or K-Means (AI weeks 2–3).

> [!recap]
> - A vector is a list of numbers and also an arrow, or a point in feature space.
> - Add and scale element by element.
> - The L2 norm is length. Distance is the norm of the difference.

# Lesson: The dot product and cosine similarity (25 min)

The **dot product** multiplies matching entries and adds the results:

$$\mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^n u_i v_i$$

```python
def dot(u, v):
    return sum(a * b for a, b in zip(u, v))

print(dot([1, 2, 3], [4, 5, 6]))   # 4 + 10 + 18 = 32
```

### Why it matters: two interpretations

**1. Weighted sum.** A linear model's prediction is a dot product between learned **weights** and input **features**:

$$\hat{y} = \mathbf{w} \cdot \mathbf{x} + b$$

For a house price: price = 3000·area + 15000·rooms − 800·age + 20000. Each weight says how much its feature matters.

**2. Alignment.** Geometrically, $\mathbf{u}\cdot\mathbf{v} = \|\mathbf{u}\|\|\mathbf{v}\|\cos\theta$, where $\theta$ is the angle between the vectors.

- It's positive when they point in similar directions, zero when they're perpendicular (unrelated), and negative when they point in opposite directions.

### Cosine similarity

Dividing by the lengths leaves only the angle:

$$\cos\theta = \frac{\mathbf{u}\cdot\mathbf{v}}{\|\mathbf{u}\|\,\|\mathbf{v}\|} \in [-1, 1]$$

```python
import math
def cosine(u, v):
    dot = sum(a * b for a, b in zip(u, v))
    nu = math.sqrt(sum(a * a for a in u))
    nv = math.sqrt(sum(b * b for b in v))
    return dot / (nu * nv)

# toy "embeddings": [royalty, femininity, food-ness]
king  = [0.9, 0.1, 0.0]
queen = [0.9, 0.9, 0.0]
pizza = [0.0, 0.1, 0.95]
print("king~queen", round(cosine(king, queen), 3))
print("king~pizza", round(cosine(king, pizza), 3))
```

> [!important] This is how semantic search works
> An embedding model turns text into a vector (often 384–3072 numbers). Texts with similar meaning get vectors pointing in similar directions. Searching a knowledge base means finding the vectors with the highest cosine similarity to the query's vector. You'll build exactly this in Agentic AI week 2 and Full-Stack week 6 (pgvector).

> [!intuition] Why cosine, not distance?
> Cosine ignores length. A long document and a short one about the same topic point the same way but have different magnitudes. If vectors are normalized to length 1, cosine similarity and dot product are identical, which is why vector databases often just use the dot product.

> [!recap]
> - $\mathbf{u}\cdot\mathbf{v} = \sum u_i v_i$ is a weighted sum, and it also measures alignment.
> - Cosine similarity = dot product ÷ lengths, in $[-1, 1]$.
> - Embeddings + cosine similarity = semantic search.

# Lesson: Matrices and matrix multiplication (30 min)

A **matrix** is a rectangular grid of numbers with $m$ rows and $n$ columns ($m \times n$). A dataset with 1,000 customers and 3 features is a $1000 \times 3$ matrix $X$: each **row** is one example and each **column** is one feature.

$$A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \\ 5 & 6 \end{bmatrix} \quad (3 \times 2)$$

The **transpose** $A^\top$ swaps rows and columns, so $A^\top$ is $2 \times 3$.

### Matrix × vector

$A\mathbf{x}$ takes the dot product of **each row** of $A$ with $\mathbf{x}$:

$$\begin{bmatrix} 1 & 2 \\ 3 & 4 \\ 5 & 6 \end{bmatrix}\begin{bmatrix} 10 \\ 1 \end{bmatrix} = \begin{bmatrix} 12 \\ 34 \\ 56 \end{bmatrix}$$

So **predicting for a whole dataset at once** is one matrix-vector product: $\hat{\mathbf{y}} = X\mathbf{w}$.

### Matrix × matrix

$C = AB$ is defined when the number of columns of $A$ equals the number of rows of $B$: $(m \times n)(n \times p) \to (m \times p)$. Entry $C_{ij}$ = row $i$ of $A$ · column $j$ of $B$.

```python
def matmul(A, B):
    n, p = len(B), len(B[0])
    assert len(A[0]) == n, "inner dimensions must match"
    return [[sum(A[i][k] * B[k][j] for k in range(n)) for j in range(p)] for i in range(len(A))]

A = [[1, 2], [3, 4], [5, 6]]      # 3x2
B = [[10, 0, 1], [1, 1, 0]]        # 2x3
for row in matmul(A, B):
    print(row)                     # 3x3
```

> [!mistake] $AB \ne BA$
> Matrix multiplication is **not commutative**. Often $BA$ isn't even defined. Always check shapes: "inner dimensions must match, outer dimensions give the result". Shape errors are the #1 bug in NumPy and PyTorch code, so get used to writing shapes as comments.

### Matrices as transformations

Multiplying by a matrix **transforms space**: it can rotate, scale, shear or project vectors. For example, $\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}$ rotates every vector by 90°. A neural-network layer $\mathbf{h} = \sigma(W\mathbf{x} + \mathbf{b})$ is a learned transformation followed by a non-linearity (AI week 7).

### Identity and inverse

The identity matrix $I$ (1s on the diagonal) leaves vectors unchanged: $I\mathbf{x} = \mathbf{x}$. If $A^{-1}$ exists, then $A^{-1}A = I$, which "undoes" the transformation. Solving $A\mathbf{x} = \mathbf{b}$ is how linear regression's exact solution (the *normal equation*) $\mathbf{w} = (X^\top X)^{-1}X^\top \mathbf{y}$ is derived. In practice, libraries solve such systems without forming the inverse explicitly, because that's faster and more stable.

> [!recap]
> - Data matrix $X$: rows are examples, columns are features.
> - $A\mathbf{x}$ = a dot product per row. $(m\times n)(n\times p) = (m \times p)$.
> - Matrix multiplication isn't commutative. Matrices transform space.

# Lesson: Eigenvectors, variance and PCA intuition (20 min)

Most vectors change direction when a matrix multiplies them. **Eigenvectors** are special: they only get stretched.

$$A\mathbf{v} = \lambda \mathbf{v}$$

$\lambda$ (lambda) is the **eigenvalue**, the stretch factor. Eigenvectors reveal the "natural axes" of a transformation.

### Why ML cares: principal components

Take a dataset's **covariance matrix**, which describes how features vary together. Its eigenvectors point in the directions of **greatest variance** in the data, and the eigenvalues tell you how much variance lies along each direction.

**PCA (Principal Component Analysis)** keeps the top few eigenvectors and projects the data onto them. You reduce 100 features to, say, 10 while keeping most of the information (AI week 3).

```python
# Power iteration: repeatedly multiply by A and normalize -> converges to the top eigenvector
import math
A = [[2.0, 1.0],
     [1.0, 2.0]]   # a symmetric (covariance-like) matrix
v = [1.0, 0.0]
for _ in range(50):
    w = [sum(A[i][k] * v[k] for k in range(2)) for i in range(2)]
    n = math.sqrt(sum(x * x for x in w))
    v = [x / n for x in w]
Av = [sum(A[i][k] * v[k] for k in range(2)) for i in range(2)]
lam = sum(a * b for a, b in zip(Av, v))
print("top eigenvector ≈", [round(x, 4) for x in v], " eigenvalue ≈", round(lam, 4))
```

The answer, $[0.7071, 0.7071]$ with $\lambda = 3$, says this data stretches most along the diagonal direction.

> [!intuition] Summary in one picture
> Picture a cloud of points shaped like a tilted ellipse. The first principal component is the long axis of the ellipse, and the second is the short axis, perpendicular to it. PCA rotates your view to line up with those axes.

> [!connect] Where it reappears
> PCA (AI week 3), the stability of training (gradient flow in deep networks), and Google's original PageRank (an eigenvector of the link graph) all build on eigenvectors.

> [!recap]
> - Eigenvectors only get scaled by a matrix: $A\mathbf{v} = \lambda\mathbf{v}$.
> - The eigenvectors of the covariance matrix are the directions of maximum variance, and PCA projects onto them.

# Quiz

## What is $[1, 2, 3] \cdot [2, 0, -1]$?
- [ ] [2, 0, -3]
- [x] -1
- [ ] 5
- [ ] 0
> $1\cdot2 + 2\cdot0 + 3\cdot(-1) = -1$. A dot product is a single number, not a vector.

## Two embedding vectors have cosine similarity ≈ 0. What does that suggest?
- [ ] They are identical
- [ ] They are opposites
- [x] They are roughly unrelated (perpendicular directions)
- [ ] One of them has length zero
> A cosine of 1 means the same direction, 0 means perpendicular (unrelated), and −1 means opposite.

## $A$ is $4 \times 3$ and $B$ is $3 \times 2$. What is the shape of $AB$?
- [ ] 3 × 3
- [x] 4 × 2
- [ ] 2 × 4
- [ ] Not defined
> The inner dimensions (3 and 3) match, and the outer ones (4 and 2) give the result.

## Which statement about matrix multiplication is true?
- [ ] $AB = BA$ always
- [x] $AB$ can be defined while $BA$ is not
- [ ] It multiplies matching entries
- [ ] It requires square matrices
> Matrix multiplication isn't commutative, and the shapes may only work in one order. Multiplying matching entries is a different operation, the *element-wise* (Hadamard) product.

## For a dataset matrix $X$ (rows = examples) and weight vector $\mathbf{w}$, what does $X\mathbf{w}$ compute?
- [x] The linear model's prediction for every example at once
- [ ] The average of each feature
- [ ] The distance between examples
- [ ] The transpose of $X$
> Each row of $X$ is dotted with $\mathbf{w}$, which gives one prediction per example.

## Why should you standardize features before K-Means or KNN?
- [ ] It makes the code run faster
- [x] Features with large numeric ranges would otherwise dominate the distance
- [ ] Distance is undefined for unscaled data
- [ ] It converts features into probabilities
> Euclidean distance adds squared differences, so a feature measured in millions swamps one measured in units.

## What do the top eigenvectors of a covariance matrix represent?
- [ ] The rows with the largest values
- [x] The directions along which the data varies most
- [ ] The cluster centres
- [ ] The missing values
> That's the core idea of PCA: project onto the high-variance directions.

# Exercise: Nearest neighbour by cosine similarity

You're given a small "document embedding" table in the starter code. Write a function `most_similar(query, docs)` that returns the **name** of the document whose vector has the highest cosine similarity to `query`. `docs` is a dict mapping names to vectors.

## Starter

```python
import math

def cosine(u, v):
    # return the cosine similarity of u and v
    pass

def most_similar(query, docs):
    # return the key of docs with the highest cosine similarity
    pass

docs = {
    "python-intro": [0.9, 0.1, 0.0, 0.2],
    "sql-joins":    [0.1, 0.9, 0.1, 0.0],
    "k8s-pods":     [0.0, 0.1, 0.9, 0.3],
}
print(most_similar([0.8, 0.2, 0.1, 0.1], docs))
```

## Tests

```python
ns = load()
assert abs(ns["cosine"]([1, 0], [0, 1])) < 1e-9
assert abs(ns["cosine"]([1, 2], [2, 4]) - 1) < 1e-9
docs = {"a": [1, 0, 0], "b": [0, 1, 0], "c": [0.7, 0.7, 0]}
assert ns["most_similar"]([0.1, 1, 0], docs) == "b"
assert ns["most_similar"]([5, 4.9, 0], docs) == "c", "cosine ignores length"
```

## Hint

Use `max(docs, key=lambda name: cosine(query, docs[name]))`. Or loop over `docs.items()` and keep track of the best score so far.

## Solution

```python
import math

def cosine(u, v):
    dot = sum(a * b for a, b in zip(u, v))
    return dot / (math.sqrt(sum(a * a for a in u)) * math.sqrt(sum(b * b for b in v)))

def most_similar(query, docs):
    return max(docs, key=lambda name: cosine(query, docs[name]))

docs = {
    "python-intro": [0.9, 0.1, 0.0, 0.2],
    "sql-joins":    [0.1, 0.9, 0.1, 0.0],
    "k8s-pods":     [0.0, 0.1, 0.9, 0.3],
}
print(most_similar([0.8, 0.2, 0.1, 0.1], docs))
```

This is the core of a vector database, minus the indexing tricks (HNSW, IVF) that make it fast for millions of vectors.

# Exercise: Matrix multiply and linear predictions

Implement `matmul(A, B)` for lists of lists, raising `ValueError` if the shapes are incompatible. Then implement `predict(X, w, b)`, which returns the list of predictions $X\mathbf{w} + b$.

## Starter

```python
def matmul(A, B):
    pass

def predict(X, w, b):
    pass
```

## Tests

```python
ns = load()
assert ns["matmul"]([[1, 2], [3, 4]], [[5], [6]]) == [[17], [39]]
assert ns["matmul"]([[1, 0], [0, 1]], [[2, 3], [4, 5]]) == [[2, 3], [4, 5]]
try:
    ns["matmul"]([[1, 2, 3]], [[1, 2]])
    raise AssertionError("should raise ValueError for incompatible shapes")
except ValueError:
    pass
assert ns["predict"]([[1, 2], [3, 4]], [10, 1], 0.5) == [12.5, 34.5]
```

## Solution

```python
def matmul(A, B):
    if len(A[0]) != len(B):
        raise ValueError(f"shapes {len(A)}x{len(A[0])} and {len(B)}x{len(B[0])} don't align")
    return [[sum(A[i][k] * B[k][j] for k in range(len(B))) for j in range(len(B[0]))]
            for i in range(len(A))]

def predict(X, w, b):
    return [sum(x * wi for x, wi in zip(row, w)) + b for row in X]
```

# Sources

- [3Blue1Brown: Essence of Linear Algebra (video series)](https://www.3blue1brown.com/topics/linear-algebra)
- [Khan Academy: Linear algebra](https://www.khanacademy.org/math/linear-algebra)
- *Mathematics for Machine Learning* by Deisenroth, Faisal & Ong, chapters 2–4 (free at mml-book.com)
- [MIT OCW 18.06: Linear Algebra (Gilbert Strang)](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/)
- [Google ML Crash Course: Embeddings](https://developers.google.com/machine-learning/crash-course/embeddings)
