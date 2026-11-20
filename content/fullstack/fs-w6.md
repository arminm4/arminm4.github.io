---
id: fs-w6
title: Embeddings & Vector Search with pgvector
week: Week 6
summary: Embeddings and similarity metrics, semantic search, vector database concepts, PostgreSQL + pgvector schemas and queries, HNSW and IVFFlat indexes, and metadata filtering.
builds_on: fs-w5, f-linalg, ai-w9, bi-w2
leads_to: fs-w7
---

Semantic search is the retrieval engine behind RAG. You learned the math in *Linear Algebra* and AI week 9, and the RAG design in Agentic week 2. This week is the **implementation**: storing embeddings in PostgreSQL with **pgvector**, querying them efficiently, and indexing them for speed, all inside the same database as your app data.

# Lesson: Embeddings and similarity, in practice (25 min)

An **embedding model** maps text (or images) to a fixed-length vector, for example 384, 768, 1536 or 3072 dimensions. Texts with similar meaning get vectors pointing in similar directions.

### Similarity metrics

| Metric | Formula | pgvector operator |
|---|---|---|
| Cosine distance | $1 - \frac{a\cdot b}{\lVert a\rVert \lVert b\rVert}$ | `<=>` |
| Euclidean (L2) distance | $\lVert a - b\rVert$ | `<->` |
| Negative inner product | $-(a\cdot b)$ | `<#>` |

If the vectors are **normalized** to length 1 (most embedding APIs return normalized vectors), all three give the **same ranking**, and the inner product is the cheapest to compute.

### Practical rules

- **Use one model per index.** Vectors from different models aren't comparable. Changing models means **re-embedding everything**, so store the `model` name with each vector.
- Some models expect **different prefixes for queries and documents** ("query: …", "passage: …"), or have separate query and document modes. Read the model card.
- **Batch** embedding calls (e.g. 100 texts per request) and cache the results by content hash.
- Pick a model by **evaluating it on your own data** (recall@k on a golden set, Agentic week 2), plus its cost, dimension (storage and speed) and multilingual support.

```python
import numpy as np
rng = np.random.default_rng(0)
docs = rng.normal(size=(10_000, 384)).astype(np.float32)
docs /= np.linalg.norm(docs, axis=1, keepdims=True)           # normalize once at write time
q = docs[42] + rng.normal(0, 0.05, 384).astype(np.float32); q /= np.linalg.norm(q)
scores = docs @ q                                             # inner product == cosine for unit vectors
top = np.argpartition(-scores, 5)[:5]
top = top[np.argsort(-scores[top])]
print("top-5 ids:", top, "scores:", scores[top].round(3))
```

Brute force over 10,000 vectors takes milliseconds. At millions of vectors and many queries per second, you need an **index**.

> [!recap]
> - Cosine (`<=>`), L2 (`<->`), inner product (`<#>`). Normalized vectors make them equivalent.
> - One model per index, and store the model name. Batch and cache embeddings.

# Lesson: PostgreSQL + pgvector (35 min)

**pgvector** adds a `vector(n)` type and similarity operators to PostgreSQL. Your vectors live next to your relational data, with transactions, joins, backups and permissions, all in one system.

```sql norun
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id          bigserial PRIMARY KEY,
  owner_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  source_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id          bigserial PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  owner_id    bigint NOT NULL,                       -- denormalized for fast filtering
  chunk_index int NOT NULL,
  content     text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',           -- section, page, language, tags...
  embedding   vector(1536) NOT NULL,
  model       text NOT NULL,
  content_hash text NOT NULL,
  UNIQUE (document_id, chunk_index)
);
```

### Querying: nearest neighbours with filters

```sql norun
SELECT c.id, c.content, d.title, 1 - (c.embedding <=> :query_vec) AS similarity
FROM chunks c
JOIN documents d ON d.id = c.document_id
WHERE c.owner_id = :user_id                          -- permissions first!
  AND c.metadata->>'language' = 'en'
ORDER BY c.embedding <=> :query_vec                  -- cosine distance, ascending
LIMIT 8;
```

From Python with SQLAlchemy and the `pgvector` package:

```python norun
from pgvector.sqlalchemy import Vector
from sqlalchemy import select

class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str]
    owner_id: Mapped[int]
    embedding = mapped_column(Vector(1536))

async def search(db, user_id: int, query_vec: list[float], k: int = 8):
    dist = Chunk.embedding.cosine_distance(query_vec)
    rows = await db.execute(select(Chunk, dist.label("distance"))
                            .where(Chunk.owner_id == user_id).order_by(dist).limit(k))
    return rows.all()
```

> [!connect] Hybrid search in the same database
> PostgreSQL has built-in full-text search (`tsvector`, `ts_rank`, a GIN index). Run a keyword query and a vector query, then fuse them with RRF (Agentic week 2). That's hybrid search without a second system (week 7).

> [!recap]
> - Use a `vector(n)` column next to relational data. Filter by owner and metadata in the same query.
> - `ORDER BY embedding <=> :q LIMIT k`, with the similarity = 1 − distance.
> - Store the content hash and model for re-embedding and deduplication.

# Lesson: Vector indexes: HNSW and IVFFlat (30 min)

Without an index, `ORDER BY embedding <=> q` scans every row: exact, but $O(n)$. pgvector offers **approximate nearest neighbour (ANN)** indexes that trade a little recall for big speed-ups.

### HNSW (Hierarchical Navigable Small World)

A multi-layer graph: sparse "highway" layers for coarse navigation, and dense lower layers for local refinement. The search greedily walks toward the query.

```sql norun
CREATE INDEX chunks_embedding_hnsw ON chunks
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
SET hnsw.ef_search = 40;           -- query-time accuracy/speed knob (higher = better recall, slower)
```

- Excellent speed/recall, and you can build it on an empty table and insert incrementally.
- It uses more memory and builds more slowly.

### IVFFlat (inverted file)

K-Means clusters the vectors into `lists` (AI week 3). A query searches only the `probes` nearest clusters.

```sql norun
CREATE INDEX chunks_embedding_ivf ON chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);   -- rule of thumb: rows/1000 (≤1M rows)
SET ivfflat.probes = 10;
```

- Faster to build and smaller, but **build it after loading representative data** (the clusters come from the existing rows), and its recall depends on `probes`.

### Choose with measurements

| Parameter | Effect |
|---|---|
| `m`, `ef_construction` (HNSW) | Graph quality and build time and memory |
| `hnsw.ef_search` | Query recall ↔ latency |
| `lists` (IVF) | Cluster granularity |
| `ivfflat.probes` | Recall ↔ latency |

Measure **recall@k against exact search** on your data at your target latency. Make sure the operator class matches your query operator (`vector_cosine_ops` for `<=>`), or the index won't be used. Check with `EXPLAIN` (BI week 2!).

### Filtering + ANN: the tricky part

With very selective filters (like one user's 200 chunks out of 10 million), an ANN index may return the top-40 neighbours overall, none of which belong to that user, so you get **too few results**. Options:
- A partial index or **partitioning** per tenant, or a separate index for big tenants.
- Increase `ef_search` or `probes`, or use **iterative index scans** (pgvector 0.8+).
- For small per-user sets, filtering first and doing an **exact** search is fast and perfectly accurate.

> [!recap]
> - HNSW: great recall and latency, more memory, incremental. IVFFlat: smaller and faster to build, needs data first.
> - Tune ef_search/probes by measuring recall@k vs latency. Match operator classes.
> - Selective filters + ANN can under-return: partition, raise the knobs, or use exact search for small sets.

# Quiz

## Your embedding vectors are normalized to length 1. Which statement is true?
- [x] Cosine similarity, inner product and Euclidean distance give the same ranking
- [ ] Only Euclidean distance works
- [ ] Cosine similarity becomes meaningless
- [ ] You must re-normalize at query time only
> For unit vectors, ‖a−b‖² = 2 − 2a·b.

## You switch to a new embedding model. What must you do?
- [ ] Nothing; vectors are interchangeable
- [x] Re-embed all documents with the new model (vectors from different models aren't comparable)
- [ ] Only re-embed new documents
- [ ] Change the distance operator
> Store the model name per vector so you can migrate deliberately.

## Which pgvector operator is cosine distance?
- [ ] `<->`
- [x] `<=>`
- [ ] `<#>`
- [ ] `@@`
> `<->` is L2 distance, and `<#>` is the negative inner product.

## Why put `owner_id` filtering in the same SQL query as the vector search?
- [ ] It's faster to filter in Python afterwards
- [x] To enforce permissions and get k results that the user is actually allowed to see
- [ ] pgvector requires it
- [ ] To avoid indexes
> Permissions belong in the retrieval query itself.

## A query with `ORDER BY embedding <=> :q` ignores your HNSW index. A likely cause?
- [ ] The table is too small
- [x] The index was built with a different operator class (e.g. vector_l2_ops) than the query's operator
- [ ] HNSW only supports integers
- [ ] The query has a LIMIT clause
> The index ops class must match the distance operator, and a LIMIT is needed for index use.

## What does increasing `hnsw.ef_search` do?
- [x] Improves recall at the cost of query latency
- [ ] Reduces memory
- [ ] Rebuilds the index
- [ ] Changes the distance metric
> It's the query-time accuracy/speed trade-off.

## When should you build an IVFFlat index?
- [ ] Before inserting any data
- [x] After loading a representative sample of data (its clusters are learned from existing rows)
- [ ] Never in PostgreSQL
- [ ] Only for exact search
> An empty-table IVFFlat index has meaningless clusters.

# Exercise: Filtered top-k search

Write `search(query, vectors, meta, k=3, where=None)` with NumPy. `vectors` is an (n, d) array (not necessarily normalized), `meta` is a list of n dicts, and `where` is an optional dict of **exact-match** metadata filters (all must match). Return a list of `(index, cosine_similarity)` for the top-k matching rows, sorted by similarity in descending order (round nothing). If fewer than k rows match, return them all.

## Starter

```python
import numpy as np

def search(query, vectors, meta, k=3, where=None):
    pass
```

## Tests

```python
import numpy as np
ns = load()
V = np.array([[1, 0], [0.9, 0.1], [0, 1], [-1, 0], [0.7, 0.7]], dtype=float)
meta = [{"user": 1, "lang": "en"}, {"user": 2, "lang": "en"}, {"user": 1, "lang": "fa"},
        {"user": 1, "lang": "en"}, {"user": 1, "lang": "en"}]
r = ns["search"](np.array([1.0, 0.0]), V, meta, k=2)
assert [i for i, _ in r] == [0, 1], r
r = ns["search"](np.array([1.0, 0.0]), V, meta, k=3, where={"user": 1, "lang": "en"})
assert [i for i, _ in r] == [0, 4, 3], r
assert abs(r[1][1] - 0.7 / np.hypot(0.7, 0.7)) < 1e-9
assert ns["search"](np.array([1.0, 0.0]), V, meta, k=5, where={"user": 9}) == []
```

## Solution

```python
import numpy as np

def search(query, vectors, meta, k=3, where=None):
    idx = [i for i, m in enumerate(meta) if not where or all(m.get(key) == val for key, val in where.items())]
    if not idx:
        return []
    V = vectors[idx]
    sims = (V @ query) / (np.linalg.norm(V, axis=1) * np.linalg.norm(query))
    order = np.argsort(-sims)[:k]
    return [(idx[j], float(sims[j])) for j in order]
```

This is "filter first, then exact search", which is the right strategy when filters are selective. At scale, the database's ANN index does the second step.

# Sources

- [pgvector README (types, operators, HNSW and IVFFlat, filtering)](https://github.com/pgvector/pgvector)
- [pgvector-python (SQLAlchemy, psycopg, asyncpg integrations)](https://github.com/pgvector/pgvector-python)
- Malkov & Yashunin (2018), "Efficient and robust approximate nearest neighbor search using HNSW graphs", arXiv:1603.09320
- [MTEB: Massive Text Embedding Benchmark leaderboard (Hugging Face)](https://huggingface.co/spaces/mteb/leaderboard)
- [PostgreSQL docs: Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
