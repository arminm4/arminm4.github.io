---
id: ag-w2
title: RAG & Retrieval Engineering
week: Week 2
summary: RAG architecture and ingestion, chunking and metadata, embeddings and vector databases, dense, sparse and hybrid retrieval, reranking, grounded answers with citations and abstention, context budgets, failure modes and evaluation.
builds_on: ag-w1, ai-w9, f-linalg, ai-w4
leads_to: ag-w3, fs-w7
---

LLMs don't know your company's documents, and their knowledge stops at a cutoff. **Retrieval-Augmented Generation (RAG)** fixes both: retrieve the relevant passages at question time and put them in the prompt, so the model answers **grounded** in your data, with citations. RAG is the most widely deployed LLM pattern in industry, and doing it *well* is an engineering discipline.

# Lesson: RAG architecture and ingestion (25 min)

```text
INGESTION (offline)                                QUERY TIME (online)
───────────────────                                ───────────────────
documents ─► parse/clean ─► chunk ─► embed ─►     question ─► (rewrite) ─► embed
            (PDF, HTML,     + metadata    store    ─► retrieve top-k (dense + sparse)
             Docs, tickets)               in index  ─► rerank ─► select within token budget
                                                    ─► prompt: instructions + context + question
                                                    ─► LLM answer with citations (or "I don't know")
```

### Ingestion matters more than people think

- **Parsing**: PDFs with tables, headers and footers, scanned pages (OCR), HTML boilerplate. Garbage in, garbage retrieved.
- **Cleaning**: remove navigation and boilerplate, normalize whitespace and Unicode, and **deduplicate** near-identical pages.
- **Metadata**: source URL or filename, title, section headings, date, author, product, language, **access permissions**. You'll filter and cite with these.
- **Incremental updates**: re-ingest only the documents that changed (content hash), and delete the vectors of removed documents. It's the same idempotent-load idea as the BI ETL in week 3.

> [!warning] Permissions are part of retrieval
> If a user can't open a document, RAG must not retrieve it for them. Store access-control metadata and **filter at query time**. Leaking a salary spreadsheet through a chatbot is a real-world incident pattern.

> [!recap]
> - Offline: parse → clean → chunk → embed → index with metadata.
> - Online: retrieve → rerank → assemble context → grounded generation.
> - Enforce permissions in retrieval.

# Lesson: Chunking, embeddings and vector search (35 min)

### Chunking strategies

Documents are split into **chunks**, the units that get retrieved.

| Strategy | Notes |
|---|---|
| Fixed size (e.g. 500 tokens) + **overlap** (10–20%) | Simple, but can split mid-thought |
| Recursive / structure-aware | Split on headings → paragraphs → sentences; respects meaning |
| Semantic | Split where the embedding similarity between sentences drops |
| Parent–child | Retrieve small precise chunks, but pass their larger parent section to the LLM |

Size trade-off: **small chunks** are precise matches but lack context. **Large chunks** have more context, but they dilute the embedding and cost more tokens. Typical sizes are 200–800 tokens. **Evaluate, don't guess.** Prepend useful context to each chunk, such as the document title and section path ("Refund policy › Annual plans › …"). This "contextual chunk header" noticeably improves retrieval.

### Embeddings and vector databases

Each chunk is embedded into a vector (AI week 9). A **vector database** stores the vectors and finds the nearest neighbours of a query vector. Exact search is $O(n)$, so large indexes use **approximate nearest neighbour (ANN)** structures:
- **HNSW** (a navigable small-world graph): fast and accurate, and the most common.
- **IVF** (cluster the vectors, search only the nearest clusters), often combined with **product quantization** to compress the vectors.

Options: pgvector (PostgreSQL, Full-Stack week 6), Qdrant, Weaviate, Milvus, Chroma, Pinecone, Elasticsearch/OpenSearch, and FAISS (a library).

**Metadata filtering** (`product = "billing" AND date > 2025-01-01 AND user can access`) narrows the search, either before or during the vector search.

### A minimal dense retriever (runs here)

```python
import numpy as np, re
from collections import Counter

docs = {
  "refunds.md#annual": "Annual plans can be refunded within 30 days of purchase. After 30 days no refund is possible.",
  "refunds.md#monthly": "Monthly plans are not refundable, but you can cancel anytime to stop the next charge.",
  "account.md#password": "To reset your password, open Settings, choose Security, then Reset password.",
  "account.md#2fa": "Two-factor authentication can be enabled in Settings under Security.",
  "shipping.md#time": "Standard shipping takes 3-5 business days; express shipping takes 1-2 days.",
}
tok = lambda s: re.findall(r"[a-z0-9]+", s.lower())
vocab = sorted({w for t in docs.values() for w in tok(t)})
df = Counter(w for t in docs.values() for w in set(tok(t)))
def embed(text):        # TF-IDF stands in for a neural embedding model here
    c = Counter(tok(text)); v = np.array([c[w] * np.log(1 + len(docs) / df[w]) for w in vocab])
    n = np.linalg.norm(v); return v / n if n else v
ids = list(docs); M = np.stack([embed(docs[i]) for i in ids])
def search(q, k=2):
    s = M @ embed(q)
    return [(ids[i], round(float(s[i]), 3)) for i in np.argsort(-s)[:k]]
print(search("can I get my money back for a yearly subscription?"))
print(search("how do I change my password"))
```

The first query fails partly: "money back" and "yearly" share no words with "refund" and "annual". **Lexical** representations miss synonyms, and real **neural embeddings** fix that. On the other hand, neural embeddings can miss exact identifiers ("error E1042", SKUs). Hence **hybrid search** (next lesson).

> [!recap]
> - Chunk by structure, with overlap and contextual headers. Tune the size by evaluation.
> - Vector DBs use ANN (HNSW/IVF) plus metadata filters.
> - Dense handles meaning, sparse handles exact terms: you want both.

# Lesson: Hybrid search, reranking and context selection (30 min)

### Sparse retrieval: BM25

BM25 scores documents by query-term matches, with TF saturation and document-length normalization. It's TF-IDF's production-grade sibling. It's excellent for names, codes, rare terms and exact phrases.

### Hybrid search with Reciprocal Rank Fusion (RRF)

Run dense and sparse retrieval separately, then merge the **rankings** (not the raw scores, which live on different scales):

$$\text{RRF}(d) = \sum_{r \in \text{rankers}} \frac{1}{k + \text{rank}_r(d)} \qquad (k \approx 60)$$

```python
def rrf(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            scores[doc] = scores.get(doc, 0) + 1 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

dense  = ["refunds#annual", "refunds#monthly", "billing#invoice"]
sparse = ["errors#E1042", "refunds#annual", "billing#invoice"]
print(rrf([dense, sparse]))
```

Documents that rank well in both lists rise to the top.

### Reranking

First-stage retrieval is fast but rough. A **cross-encoder reranker** reads the (query, chunk) pair *together* and scores the relevance precisely. It's too slow to run on millions of chunks, but perfect for the top 20–50. The standard pipeline: **retrieve 50 (hybrid) → rerank → keep the top 5**. LLMs can also act as rerankers.

### Query transformation

- **Rewriting**: turn a conversational follow-up ("what about monthly?") into a standalone query, using the chat history.
- **Multi-query / decomposition**: split complex questions into sub-queries.
- **HyDE**: generate a hypothetical answer and embed *that*, which often retrieves better than the question itself.

### Context selection and token budgets

The context window is a budget. Order the chunks by relevance, **deduplicate**, respect the token limit, and include the source labels for citation. Models attend less reliably to the **middle** of very long contexts ("lost in the middle"). Fewer, better chunks usually beat many mediocre ones.

> [!recap]
> - BM25 for exact terms. Merge dense and sparse with RRF.
> - Rerank the top-k with a cross-encoder. Rewrite conversational queries.
> - Fit the context to the budget: relevant, deduplicated and labelled for citation.

# Lesson: Grounded answers, failure modes and evaluation (35 min)

### Grounding, citations and abstention

```text
SYSTEM: Answer ONLY from the sources below. Cite sources like [refunds.md#annual].
If the sources don't contain the answer, say "I couldn't find this in the documentation"
and suggest contacting support. Never use outside knowledge for policy questions.

<sources>
[refunds.md#annual] Annual plans can be refunded within 30 days of purchase...
[refunds.md#monthly] Monthly plans are not refundable...
</sources>

QUESTION: Can I get a refund on my yearly plan after 6 weeks?
```

**Abstention** ("I don't know") is a feature: a confident wrong answer about a refund policy costs more than an honest "not found". Verify the citations programmatically: does every cited ID exist in the retrieved set?

### Failure modes (diagnose by stage)

| Symptom | Likely stage | Fix |
|---|---|---|
| The right document isn't in the top-k | Retrieval | Hybrid search, better chunking, query rewriting, metadata filters |
| Retrieved but the answer is wrong | Generation | Rerank, fewer and better chunks, stronger instructions, a better model |
| Answer is correct but uncited / hallucinated detail | Grounding | Citation requirements, a post-check that claims are supported |
| Stale answers | Ingestion | Incremental re-indexing, dates in metadata, prefer recent sources |
| Answer leaks another team's doc | Permissions | Query-time ACL filters |

### Evaluation: measure retrieval and answers separately

**Retrieval metrics** (you need a set of questions with the known relevant chunks):
- **Recall@k**: is a relevant chunk in the top k? This is the most important one: the LLM can't use what wasn't retrieved.
- **MRR** (mean reciprocal rank): $\frac{1}{|Q|}\sum \frac{1}{\text{rank of first relevant}}$.
- **NDCG@k**: graded relevance with position discounting (AI week 4).

**Answer metrics**:
- **Faithfulness / groundedness**: is every claim supported by the retrieved context?
- **Answer relevance and correctness** against a reference answer.
- Judged by humans and/or an **LLM-as-judge** with a clear rubric (week 5). Frameworks such as RAGAS automate some of these.

Build a **golden set** of 50–200 real questions early, including unanswerable ones, and re-run it on every change: chunk size, embedding model, k, prompt.

> [!recap]
> - Ground + cite + abstain. Verify the citations.
> - Diagnose failures by stage: ingestion, retrieval, generation, grounding.
> - Evaluate retrieval (recall@k, MRR) separately from answers (faithfulness, correctness) on a golden set.

# Quiz

## Why add overlap between consecutive chunks?
- [ ] To use more storage
- [x] So information spanning a chunk boundary still appears intact in at least one chunk
- [ ] It's required by vector databases
- [ ] To speed up embedding
> Overlap reduces the chance of splitting a key sentence.

## Which query benefits most from sparse (BM25) retrieval?
- [ ] "How do I feel better after a bad day?"
- [x] "What does error code E1042 mean?"
- [ ] "Explain our culture"
- [ ] "Summarize the strategy"
> Exact identifiers and rare terms are lexical strengths.

## Why merge rankings with RRF instead of adding raw scores?
- [ ] RRF is more accurate always
- [x] Dense and BM25 scores live on different scales; ranks are comparable
- [ ] Raw scores are secret
- [ ] RRF needs no retrieval
> Rank-based fusion avoids score normalization issues.

## What does a cross-encoder reranker do?
- [ ] Embeds documents offline
- [x] Scores each (query, chunk) pair jointly for precise relevance, applied to the top candidates
- [ ] Splits documents into chunks
- [ ] Generates the final answer
> It's slower but more accurate than bi-encoder retrieval, so use it on a shortlist.

## The answer is wrong, and the relevant chunk was NOT in the retrieved set. Where do you focus?
- [ ] The generation prompt
- [x] Retrieval: chunking, hybrid search, query rewriting, k
- [ ] The temperature
- [ ] The UI
> The LLM can't use what wasn't retrieved. Recall@k is the first metric to check.

## The best behaviour when the sources don't contain the answer is:
- [ ] Answer from general knowledge confidently
- [x] Say it wasn't found in the sources (abstain) and suggest a next step
- [ ] Return the closest chunk verbatim
- [ ] Ask the model to guess
> Abstention prevents confident hallucinations on policy questions.

## Which metric asks "is at least one relevant chunk in the top 5?"
- [ ] Faithfulness
- [x] Recall@5 (hit rate)
- [ ] BLEU
- [ ] Perplexity
> Retrieval recall is the ceiling on answer quality.

## A user from team A gets an answer citing a confidential team-B document. The fix is:
- [ ] Better embeddings
- [x] Store access-control metadata and filter retrieval by the user's permissions
- [ ] A bigger LLM
- [ ] Shorter chunks
> Security belongs in the retrieval layer.

# Exercise: Chunker with overlap and headers

Write `chunk(text, title, max_words=50, overlap=10)` that splits the text into word windows of at most `max_words` words, with `overlap` words repeated between consecutive chunks. Return a list of dicts: `{"id": f"{title}#{i}", "text": f"{title}: " + chunk_text}` (i starting at 0). The final chunk may be shorter. Empty text returns `[]`. Raise `ValueError` if `overlap >= max_words`.

## Starter

```python
def chunk(text, title, max_words=50, overlap=10):
    pass
```

## Tests

```python
ns = load()
c = ns["chunk"]
text = " ".join(f"w{i}" for i in range(120))
out = c(text, "Doc", 50, 10)
assert [o["id"] for o in out] == ["Doc#0", "Doc#1", "Doc#2"], [o["id"] for o in out]
assert out[0]["text"].startswith("Doc: w0 ") and out[0]["text"].endswith(" w49")
assert out[1]["text"].startswith("Doc: w40 "), "10-word overlap"
assert out[2]["text"].endswith(" w119")
assert c("", "X") == []
try:
    c("a b c", "X", 5, 5); raise AssertionError("expected ValueError")
except ValueError:
    pass
```

## Hint

Step = `max_words - overlap`. Loop `start` from 0 in steps of `step`. Stop once a window reaches the end of the text.

## Solution

```python
def chunk(text, title, max_words=50, overlap=10):
    if overlap >= max_words:
        raise ValueError("overlap must be smaller than max_words")
    words = text.split()
    out, start, i = [], 0, 0
    step = max_words - overlap
    while start < len(words):
        window = words[start:start + max_words]
        out.append({"id": f"{title}#{i}", "text": f"{title}: " + " ".join(window)})
        if start + max_words >= len(words):
            break
        start += step
        i += 1
    return out
```

# Exercise: Retrieval evaluation: recall@k and MRR

Write `evaluate(results, relevant, k=5)`. `results` maps each query id to its ranked list of chunk ids, and `relevant` maps each query id to a set of relevant chunk ids. Return `{"recall@k": ..., "mrr": ...}` averaged over the queries in `relevant`. Recall@k here means *hit rate*: 1 if any relevant id is in the top k, else 0. MRR uses the rank of the **first** relevant id in the **full** list (0 if none). A missing query in `results` counts as 0 for both.

## Starter

```python
def evaluate(results, relevant, k=5):
    pass
```

## Tests

```python
ns = load()
results = {"q1": ["a", "b", "c"], "q2": ["x", "y", "z", "w", "v", "r"], "q3": ["m"]}
relevant = {"q1": {"b"}, "q2": {"r"}, "q3": {"m", "n"}, "q4": {"zz"}}
r = ns["evaluate"](results, relevant, k=5)
assert abs(r["recall@k"] - 0.5) < 1e-12, r      # q1 hit, q2 miss (rank 6 > 5), q3 hit, q4 missing
assert abs(r["mrr"] - (0.5 + 1/6 + 1 + 0) / 4) < 1e-12, r
```

## Solution

```python
def evaluate(results, relevant, k=5):
    hits, rr = 0.0, 0.0
    for q, rel in relevant.items():
        ranked = results.get(q, [])
        if any(d in rel for d in ranked[:k]):
            hits += 1
        for rank, d in enumerate(ranked, start=1):
            if d in rel:
                rr += 1 / rank
                break
    n = len(relevant)
    return {"recall@k": hits / n, "mrr": rr / n}
```

Track these two numbers for every change you make to chunking, embeddings or k. That's how RAG systems improve systematically instead of by vibes.

# Sources

- Lewis et al. (2020), "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", arXiv:2005.11401
- [Anthropic engineering: Introducing Contextual Retrieval (contextual chunk headers + BM25 + reranking)](https://www.anthropic.com/news/contextual-retrieval)
- Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts", arXiv:2307.03172
- Cormack, Clarke & Büttcher (2009), "Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods", SIGIR
- [LangChain docs: Retrieval concepts (text splitters, vector stores, retrievers)](https://python.langchain.com/docs/concepts/retrieval/)
- [RAGAS documentation: RAG evaluation metrics](https://docs.ragas.io/)
- Malkov & Yashunin (2018), "Efficient and robust approximate nearest neighbor search using HNSW graphs", arXiv:1603.09320
