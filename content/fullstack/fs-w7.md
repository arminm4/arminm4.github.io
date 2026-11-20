---
id: fs-w7
title: Building Production RAG Systems
week: Week 7
summary: An idempotent ingestion and embedding pipeline, chunking in practice, retrieval and context construction, citations with verification, hybrid search in PostgreSQL, reranking, and measuring retrieval quality.
builds_on: fs-w6, ag-w2
leads_to: fs-p2
---

Agentic AI week 2 taught RAG concepts. This week you **implement** a production RAG pipeline inside the Full-Stack app: users upload documents, the system ingests them reliably, and the chat answers with **verifiable citations**, using hybrid search in PostgreSQL. The emphasis is on the engineering: idempotency, incremental updates, SQL and verification.

# Lesson: The ingestion pipeline (35 min)

```text
upload → store original (object storage) → enqueue job → extract text → normalize → chunk
      → hash each chunk → diff against existing chunks → embed only new ones (batched) → upsert
      → delete stale chunks → mark document "ready" (or "failed" with error)
```

### Extraction

- **PDF**: `pypdf` or `pdfplumber` for text PDFs, and OCR (Tesseract, or a vision model) for scanned ones. Tables and multi-column layouts are the hard cases; layout-aware parsers like `unstructured` and Docling help.
- **HTML**: strip the navigation and boilerplate (`trafilatura`, `readability`).
- **Office files**: `python-docx`, `openpyxl`.
- Keep **page numbers and section headings** as metadata, because citations need them.

### Idempotent, incremental processing

Run ingestion as a **background job** (week 10), because a 300-page PDF takes minutes. Make re-runs safe:
- Compute a **content hash** per chunk. When a document is re-uploaded, **re-embed only the chunks whose hash changed**, and delete the chunks that disappeared.
- Use a document status machine: `pending → processing → ready | failed`, plus `error_message` and `attempts`.
- Use unique constraints (`document_id, chunk_index`) and upserts, so a crashed job can simply be retried.

```python
import hashlib

def chunk_hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.split()).encode()).hexdigest()[:16]   # whitespace-normalized

old = {chunk_hash(t): t for t in ["Refunds within 30 days.", "Shipping takes 3-5 days."]}
new_texts = ["Refunds within 30 days.", "Shipping takes 2-4 days.", "Gift cards never expire."]
new = {chunk_hash(t): t for t in new_texts}
to_embed = [new[h] for h in new if h not in old]
to_delete = [old[h] for h in old if h not in new]
print("embed:", to_embed)
print("delete:", to_delete)
print("unchanged (reused):", [new[h] for h in new if h in old])
```

### Embedding pipeline

- Batch the texts (e.g. 64–128 per call), within the provider's token limits.
- Retry with backoff, and respect rate limits (concurrency control).
- Store `model` and `dimension` with each vector. Keep a **re-embed job** ready for model upgrades.
- Embed the **contextualized** chunk text (title + section path + content, Agentic week 2), but show the plain content in citations.

> [!recap]
> - Extract with layout awareness and keep the page/section metadata.
> - Run it as a job: hash, diff, embed only what changed, upsert, delete stale chunks, track status.
> - Batch embeddings, retry, and record the model.

# Lesson: Retrieval and hybrid search in PostgreSQL (35 min)

### Keyword search with PostgreSQL full-text search

```sql norun
ALTER TABLE chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX chunks_tsv_gin ON chunks USING gin (tsv);
```

### Hybrid search with RRF, in one SQL statement

```sql norun
WITH dense AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> :qvec) AS r
  FROM chunks WHERE owner_id = :uid
  ORDER BY embedding <=> :qvec LIMIT 40
),
sparse AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS r
  FROM chunks, websearch_to_tsquery('english', :qtext) q
  WHERE owner_id = :uid AND tsv @@ q
  ORDER BY ts_rank_cd(tsv, q) DESC LIMIT 40
),
fused AS (
  SELECT id, SUM(1.0 / (60 + r)) AS score
  FROM (SELECT * FROM dense UNION ALL SELECT * FROM sparse) u
  GROUP BY id
)
SELECT c.id, c.content, c.metadata, f.score
FROM fused f JOIN chunks c USING (id)
ORDER BY f.score DESC
LIMIT 20;
```

This uses CTEs, window functions and UNION ALL from BI week 1, now powering AI retrieval.

### Reranking and selection

Send the top 20 to a **reranker** (a cross-encoder model, or a reranking API), keep the best 4–6, deduplicate overlapping chunks, and **merge adjacent chunks** of the same document to preserve context.

### Query construction

- Rewrite follow-ups into **standalone queries** using the chat history (a cheap model call).
- Extract **filters** from the question ("in the 2024 handbook" → a `year` filter).
- When nothing passes a relevance threshold, **abstain** rather than answer from weak context.

> [!recap]
> - PostgreSQL FTS (tsvector + GIN) + pgvector, fused with RRF in SQL.
> - Rerank the top 20 → keep 4–6, deduplicate, merge neighbours.
> - Standalone query rewriting, extracted filters, an abstention threshold.

# Lesson: Context construction and verifiable citations (35 min)

### Building the context block

```text
<sources>
<source id="1" title="Refund policy" section="Annual plans" page="2">
Annual plans can be refunded within 30 days of purchase...
</source>
<source id="2" title="Refund policy" section="Monthly plans" page="2">
Monthly plans are not refundable...
</source>
</sources>

Answer using ONLY the sources. After each sentence that uses a source, cite it like [1] or [1][2].
If the sources don't answer the question, reply exactly: "I couldn't find this in your documents."
```

Use **short numeric IDs** in the prompt (cheaper and easier for the model), and map them back to real chunk IDs, titles and pages in your backend. Put the sources **before** the question, and keep the instructions explicit about citing.

### Verify citations after generation

Models sometimes cite a source that doesn't contain the claim, invent a source number, or leave a claim uncited. Post-process the answer:
1. **Parse** the citation markers.
2. **Reject** unknown IDs (hallucinated citations).
3. **Flag** sentences without citations when the policy requires them.
4. Optionally run a **faithfulness check**: a small model or an NLI classifier verifies that each cited sentence is supported by its source (week 11).

The UI then renders the citations as clickable chips that open the source passage. Showing the passage builds user trust and lets users verify the answer themselves.

> [!recap]
> - Numbered sources with metadata, then the question, then explicit citation rules.
> - Map the IDs back to chunks. Verify the citations: unknown IDs, uncited sentences, faithfulness.
> - Citations in the UI are clickable passages.

# Lesson: Measuring retrieval quality (20 min)

Build a **retrieval test set** from real usage: 50–200 questions, each with the IDs of the chunks or documents that answer it. Include paraphrases, typos, keyword-heavy queries (product codes) and unanswerable questions.

Measure for each configuration (chunk size, embedding model, dense vs hybrid, with or without a reranker, k):
- **Recall@k / hit rate@k** and **MRR** (Agentic week 2 exercise).
- **Latency p95** of the retrieval step.
- Answer-level metrics come in week 11.

```text
config                         recall@5   MRR    p95 latency
dense, 800-token chunks          0.71     0.52     45 ms
dense, 400 + headers             0.78     0.58     47 ms
hybrid (RRF)                     0.86     0.66     70 ms
hybrid + reranker                0.91     0.79    310 ms   ← best quality, check the latency budget
```

Decide with data, and re-run the suite in CI whenever the pipeline changes.

> [!recap]
> - Build a golden retrieval set with known relevant chunks.
> - Compare configurations on recall@k, MRR and latency, then choose deliberately.

# Quiz

## A user re-uploads a 200-page manual with one changed paragraph. An efficient pipeline:
- [ ] Re-embeds all 200 pages
- [x] Hashes the chunks, re-embeds only the changed ones, and deletes the chunks that no longer exist
- [ ] Ignores the upload
- [ ] Creates a duplicate document
> Hash-and-diff makes re-ingestion cheap and idempotent.

## Why run ingestion as a background job?
- [ ] It's more secure
- [x] Extraction and embedding can take minutes; HTTP requests shouldn't block, and failures need retries and status tracking
- [ ] Databases require it
- [ ] Jobs are cheaper per token
> Return immediately with a status, then process asynchronously.

## In the hybrid SQL, why use UNION ALL plus GROUP BY with SUM(1/(60+r))?
- [ ] To sort alphabetically
- [x] To fuse the dense and sparse rankings with Reciprocal Rank Fusion, so documents found by both rank highest
- [ ] To remove duplicates only
- [ ] It's required by pgvector
> RRF merges the ranks from both retrievers.

## Why use short numeric source IDs in the prompt?
- [ ] They're more secure
- [x] They're cheaper in tokens, easy for the model to cite, and mapped back to real chunk metadata in code
- [ ] Models can't read UUIDs
- [ ] They improve embeddings
> Keep the prompt compact. The backend owns the mapping.

## The model cites [7], but only sources 1–5 were provided. What should the system do?
- [ ] Display it anyway
- [x] Treat it as a hallucinated citation: remove or flag it, and possibly regenerate
- [ ] Add a source 7
- [ ] Ignore citations entirely
> Verify the citations programmatically.

## Which metric best tells you whether the right chunk reaches the LLM at all?
- [ ] BLEU
- [x] Recall@k
- [ ] Perplexity
- [ ] Token count
> The LLM can't use what retrieval missed.

## Adding a reranker raised recall@5 from 0.86 to 0.91 but p95 latency from 70 to 310 ms. What decides?
- [ ] Always add it
- [ ] Never add it
- [x] Your latency budget and the value of the quality gain: measure the end-to-end UX and costs
- [ ] The number of documents
> Engineering is trade-offs, decided with data.

# Exercise: Citation verifier

Write `verify_citations(answer, source_ids)`. `answer` is text with markers like `[1]` or `[2][3]`. Split it into sentences with a regex on `(?<=[.!?])\s+`. Return a dict:
- `"used"`: the sorted list of distinct valid IDs cited (ints)
- `"unknown"`: the sorted list of cited IDs not in `source_ids`
- `"uncited"`: the list of sentences (stripped) that contain no citation marker, excluding the exact abstention sentence `"I couldn't find this in your documents."`

## Starter

```python
import re

def verify_citations(answer, source_ids):
    pass
```

## Tests

```python
ns = load()
v = ns["verify_citations"]
ans = "Annual plans are refundable within 30 days [1]. Monthly plans are not [2][1]. You can also get store credit. Shipping is free [7]."
r = v(ans, {1, 2, 3})
assert r["used"] == [1, 2], r
assert r["unknown"] == [7], r
assert r["uncited"] == ["You can also get store credit."], r
r2 = v("I couldn't find this in your documents.", {1})
assert r2 == {"used": [], "unknown": [], "uncited": []}, r2
```

## Solution

```python
import re

ABSTAIN = "I couldn't find this in your documents."

def verify_citations(answer, source_ids):
    cited = [int(n) for n in re.findall(r"\[(\d+)\]", answer)]
    used = sorted({c for c in cited if c in source_ids})
    unknown = sorted({c for c in cited if c not in source_ids})
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer.strip()) if s.strip()]
    uncited = [s for s in sentences if not re.search(r"\[\d+\]", s) and s != ABSTAIN]
    return {"used": used, "unknown": unknown, "uncited": uncited}
```

Sentence splitting with a regex is imperfect ("e.g." or "3.5" can break it). Production systems often ask the model to output structured claims with their source IDs (JSON) instead.

# Sources

- [pgvector: hybrid search examples](https://github.com/pgvector/pgvector#hybrid-search)
- [PostgreSQL docs: Text search controls (websearch_to_tsquery, ts_rank_cd)](https://www.postgresql.org/docs/current/textsearch-controls.html)
- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [Unstructured.io documentation (document parsing for RAG)](https://docs.unstructured.io/)
- Gao et al. (2023), "Retrieval-Augmented Generation for Large Language Models: A Survey", arXiv:2312.10997
- [Cohere: Rerank overview](https://docs.cohere.com/docs/rerank-overview)
