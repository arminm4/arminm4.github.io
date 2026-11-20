---
id: ai-w9
title: NLP: From Bag-of-Words to Transformers
week: Week 9
summary: Text normalization and tokenization, bag-of-words and TF-IDF, classical text classification and its evaluation, Word2Vec and pretrained embeddings, sentence similarity, and the transformer architecture.
builds_on: ai-w8, ai-w2, f-linalg
leads_to: ai-w10, ag-w2, fs-w6
---

This week connects classical NLP to the LLM era. You'll build a strong TF-IDF text classifier (still a great baseline today), then learn how **embeddings** represent meaning as vectors, and finish with the **transformer** architecture. Embeddings and transformers are the foundation of RAG and agents in the next bootcamps.

# Lesson: Text preprocessing and tokenization (25 min)

Computers need numbers, so text processing starts by turning strings into **tokens**.

### Normalization

Lowercasing, Unicode normalization (é vs e + ´; Persian ي vs ی), removing or keeping punctuation, expanding contractions, handling numbers and URLs. Every choice is task-dependent: lowercasing loses "US" vs "us".

### Tokenization strategies

| Strategy | Example for "unhappiness!" | Notes |
|---|---|---|
| Whitespace / rules | `["unhappiness!"]` | Simple, but punctuation sticks to words |
| Word (regex) | `["unhappiness", "!"]` | Large vocabulary; unknown words become "OOV" |
| Character | `["u","n","h",…]` | No OOV, but very long sequences |
| **Subword (BPE, WordPiece)** | `["un", "happi", "ness", "!"]` | Used by all modern LLMs: a compact vocabulary with no OOV |

**Byte-Pair Encoding (BPE)** starts from characters and repeatedly merges the most frequent adjacent pair, so common words become single tokens and rare words split into meaningful pieces.

```python
import re
from collections import Counter

def tokenize(text):
    text = text.lower()
    return re.findall(r"[a-z0-9']+", text)

corpus = ["The model learns quickly!", "Models learn from data.", "Learning is fun."]
toks = [tokenize(t) for t in corpus]
print(toks)

# One BPE merge step on a toy vocabulary
words = Counter({"l o w": 5, "l o w e r": 2, "n e w e s t": 6, "w i d e s t": 3})
pairs = Counter()
for w, f in words.items():
    s = w.split()
    for a, b in zip(s, s[1:]):
        pairs[(a, b)] += f
print("most frequent pair to merge:", pairs.most_common(1))
```

**Stemming** (crude suffix chopping: "learning" → "learn") and **lemmatization** (dictionary-based: "better" → "good") reduce word variants for classical models. Stop-word removal ("the", "is") can help bag-of-words models, but can hurt meaning ("not good").

> [!recap]
> - Normalize thoughtfully, because every choice loses some information.
> - Subword tokenization (BPE) is the modern standard: no OOV, compact vocabulary.

# Lesson: Bag-of-words, TF-IDF and classical text classification (35 min)

A **bag-of-words (BoW)** representation counts word occurrences and ignores order. Each document becomes a sparse vector the size of the vocabulary.

**TF-IDF** reweights the counts so that words frequent in *this* document but rare across the *corpus* get high weight:

$$\text{tfidf}(t, d) = \text{tf}(t, d) \cdot \log\frac{N}{\text{df}(t)}$$

"the" appears everywhere, so its IDF is ≈ 0. "refund" appears in few documents, so its IDF is high.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_score

texts = [
    "app crashes when I upload a photo", "the app freezes on login", "error 500 when saving",
    "crash after the latest update", "button does nothing and app hangs", "bug: export creates empty file",
    "I was charged twice", "refund for my last payment please", "invoice amount is wrong",
    "cancel my subscription and refund", "billing page shows double charge", "payment failed but money taken",
    "do you have a dark mode", "how do I change my avatar", "love the new design",
    "can I use it offline", "is there an android version", "great app, thanks",
]
labels = ["bug"] * 6 + ["billing"] * 6 + ["other"] * 6

for name, clf in [("NaiveBayes", MultinomialNB()), ("LogReg", LogisticRegression(max_iter=1000))]:
    pipe = make_pipeline(TfidfVectorizer(ngram_range=(1, 2)), clf)
    print(name, "CV accuracy:", cross_val_score(pipe, texts, labels, cv=3).mean().round(3))

pipe = make_pipeline(TfidfVectorizer(ngram_range=(1, 2)), LogisticRegression(max_iter=1000)).fit(texts, labels)
print(pipe.predict(["the app crashed again", "why was I charged", "does it support dark theme"]))
```

**n-grams** (pairs and triples of words) capture short phrases ("not good", "dark mode"). TF-IDF + logistic regression or a linear SVM is a fast, strong, interpretable baseline. Always try it before reaching for an LLM.

### Evaluating text classifiers

- Use **macro-F1** when classes are imbalanced. It averages F1 across classes equally.
- Read a **confusion matrix** to see which classes get mixed up.
- **Error analysis**: read 30–50 misclassified examples. You'll find label noise, ambiguous cases, sarcasm, negation and domain shift. This is often more valuable than tuning.
- **Look at the top-weighted features per class.** Spurious features (like a template signature) reveal leakage.

> [!connect] BM25: TF-IDF's sibling in search
> **BM25**, a refined TF-IDF scoring function, still powers keyword search engines. In RAG, combining BM25 with embedding search (**hybrid search**) often beats either alone (Agentic week 2, Full-Stack week 7).

> [!recap]
> - BoW counts words. TF-IDF up-weights distinctive words. n-grams capture phrases.
> - TF-IDF + linear model is a strong baseline. Evaluate with macro-F1 and error analysis.

# Lesson: Word embeddings and sentence similarity (35 min)

BoW vectors are huge and sparse, and they know nothing about meaning: "car" and "automobile" are as different as "car" and "banana". **Embeddings** are dense, low-dimensional vectors (50–4,096 numbers) in which **similar meanings are close**.

### The distributional hypothesis

*"You shall know a word by the company it keeps"* (Firth, 1957). Words that appear in similar contexts have similar meanings.

**Word2Vec** (Mikolov et al., 2013) learns vectors by predicting context words from a word (skip-gram), or a word from its context (CBOW). The famous result is that **vector arithmetic captures relations**:

$$\vec{\text{king}} - \vec{\text{man}} + \vec{\text{woman}} \approx \vec{\text{queen}}$$

GloVe and fastText are similar. fastText uses subword pieces, so it handles rare words and typos.

### Limits of static word vectors

Each word gets **one** vector regardless of context, so "bank" (river) and "bank" (money) are the same vector. **Contextual embeddings** from transformers fix this: each token's vector depends on the whole sentence.

### Sentence embeddings and similarity

Modern **sentence-embedding models** (e.g. Sentence-BERT, or embedding APIs from OpenAI, Cohere and others) map a whole sentence or passage to a single vector. Similar meaning gives high **cosine similarity**, even with no shared words.

```python norun
# Run in Colab:  pip install sentence-transformers
from sentence_transformers import SentenceTransformer, util
model = SentenceTransformer("all-MiniLM-L6-v2")           # small, fast, 384-dim
docs = ["How do I reset my password?", "Refund policy for annual plans", "Steps to recover account access"]
q = "I forgot my login credentials"
sims = util.cos_sim(model.encode(q), model.encode(docs))
print(sims)   # the password & account-access docs score highest despite little word overlap
```

Here's the mechanism in miniature, with toy vectors so it runs in the browser:

```python
import numpy as np
vocab = {"password": [0.9, 0.1, 0.0], "login": [0.8, 0.2, 0.1], "credentials": [0.85, 0.1, 0.05],
         "refund": [0.0, 0.9, 0.2], "payment": [0.1, 0.85, 0.1], "account": [0.6, 0.3, 0.2],
         "forgot": [0.5, 0.0, 0.4], "recover": [0.55, 0.05, 0.4]}
def embed(sentence):                           # average of word vectors (a classic baseline)
    vecs = [vocab[w] for w in sentence.lower().split() if w in vocab]
    v = np.mean(vecs, axis=0); return v / np.linalg.norm(v)
docs = ["recover account password", "refund payment"]
q = embed("forgot login credentials")
for d in docs:
    print(f"{d:28} cosine = {q @ embed(d):.3f}")
```

> [!important] This is the engine of semantic search and RAG
> Embed your documents once, store the vectors, embed each query, and retrieve the nearest neighbours by cosine similarity. That's exactly what you'll build with vector databases in Agentic AI week 2 and with pgvector in Full-Stack week 6.

> [!recap]
> - Embeddings are dense vectors in which similar meaning means close together.
> - Word2Vec/GloVe are static; transformers give contextual embeddings.
> - Sentence embeddings + cosine similarity = semantic search.

# Lesson: The transformer architecture (30 min)

The transformer (Vaswani et al., 2017) is built from a few repeated pieces:

1. **Token embeddings + positional information.** Attention itself is order-agnostic, so position is injected with sinusoidal encodings, learned position vectors, or rotary embeddings (RoPE) in modern LLMs.
2. **Multi-head self-attention.** Several attention "heads" run in parallel, each with its own learned $W_Q, W_K, W_V$ projections, so different heads can track different relationships (syntax, coreference, and so on).
3. **A position-wise feed-forward MLP** applied to each token.
4. **Residual connections + LayerNorm** around each sub-layer, which let very deep stacks train.
5. Repeat N times (12 to 100+ layers).

```text
tokens → embeddings + positions
   ┌───────────────────────────────┐
   │  LayerNorm → Multi-head Attn  │──┐ residual
   │  LayerNorm → Feed-forward MLP │──┘ residual        × N layers
   └───────────────────────────────┘
→ final LayerNorm → linear → softmax over the vocabulary (next token)
```

### Three families

| Family | Attention | Training objective | Examples | Good for |
|---|---|---|---|---|
| **Encoder-only** | Bidirectional | Masked-token prediction | BERT, RoBERTa | Classification, embeddings, search |
| **Decoder-only** | **Causal** (no peeking ahead) | Next-token prediction | GPT, Claude, Llama | Generation, chat, agents |
| **Encoder–decoder** | Encoder bidirectional, decoder causal + cross-attention | Sequence to sequence | T5, original Transformer | Translation, summarization |

### Transfer learning in NLP

**Pre-train** on huge unlabeled text, then **fine-tune** on your task with little labeled data, or simply **prompt** a large model zero- or few-shot (Python week 7). Fine-tuning a small BERT-style model is still often the cheapest, fastest and most accurate choice for narrow classification tasks at scale.

> [!connect] Everything ahead builds on this
> Context windows, tokens, temperature, embeddings and attention costs (quadratic in sequence length) show up in every LLM design decision in Agentic AI and Full-Stack AI.

> [!recap]
> - Transformer = embeddings + positions + (multi-head self-attention + MLP, with residuals and LayerNorm) × N.
> - Encoder-only for understanding and embeddings; decoder-only for generation.
> - Pre-train, then fine-tune or prompt.

# Quiz

## Why do modern LLMs use subword tokenization (e.g. BPE)?
- [ ] It's the fastest to compute
- [x] It keeps a compact vocabulary while still representing any word, with no out-of-vocabulary tokens
- [ ] It removes punctuation
- [ ] It makes every word one token
> Rare words split into known pieces. Common words stay whole.

## A word appears in every document of the corpus. What is its IDF?
- [ ] Very high
- [x] About zero
- [ ] Negative
- [ ] Equal to its term frequency
> log(N/N) = 0, so it carries no discriminating information.

## Which baseline should you try first for classifying 50,000 support tickets?
- [ ] Training a transformer from scratch
- [x] TF-IDF + logistic regression (or a linear SVM)
- [ ] K-Means
- [ ] An RNN without embeddings
> Fast, strong and interpretable. Beat it before adding complexity.

## The main limitation of static word embeddings like Word2Vec is:
- [ ] They are too large
- [x] Each word has one vector regardless of context (e.g. "bank")
- [ ] They can't be compared with cosine similarity
- [ ] They require labeled data
> Contextual embeddings from transformers address this.

## Two sentences share no words but have cosine similarity 0.86 under a sentence-embedding model. This suggests:
- [ ] A bug
- [x] They're semantically similar
- [ ] They're identical strings
- [ ] One is a translation error
> Embeddings capture meaning beyond exact word overlap.

## What does "causal" attention mean in decoder-only models?
- [ ] Attention to causes in the data
- [x] Each token can attend only to itself and earlier tokens, never future ones
- [ ] Attention is computed randomly
- [ ] Only the first token is attended to
> This makes next-token prediction training valid.

## Which model family is typically used to produce text embeddings for search?
- [x] Encoder-only (BERT-style) models
- [ ] Decoder-only chat models only
- [ ] RNNs only
- [ ] Decision trees
> Bidirectional encoders produce strong representations, though decoder-based embedders exist too.

# Exercise: TF-IDF from scratch

Implement `tfidf(docs)` for a list of already-tokenized documents (lists of words). Return `(vocab, matrix)`, where `vocab` is a sorted list of words and `matrix[i][j]` is the TF-IDF of `vocab[j]` in doc `i`. Use **tf = count / doc_length** and **idf = ln(N / df)**.

## Starter

```python
import math

def tfidf(docs):
    pass

v, m = tfidf([["a", "b", "a"], ["b", "c"]])
print(v, m)
```

## Tests

```python
import math
ns = load()
v, m = ns["tfidf"]([["a", "b", "a"], ["b", "c"]])
assert v == ["a", "b", "c"]
assert abs(m[0][0] - (2/3) * math.log(2)) < 1e-12
assert m[0][1] == 0 and m[1][1] == 0, "b appears in every doc: idf = 0"
assert abs(m[1][2] - 0.5 * math.log(2)) < 1e-12
assert m[0][2] == 0
```

## Solution

```python
import math
from collections import Counter

def tfidf(docs):
    vocab = sorted({w for d in docs for w in d})
    N = len(docs)
    df = Counter(w for d in docs for w in set(d))
    idf = {w: math.log(N / df[w]) for w in vocab}
    matrix = []
    for d in docs:
        c = Counter(d)
        matrix.append([c[w] / len(d) * idf[w] for w in vocab])
    return vocab, matrix

v, m = tfidf([["a", "b", "a"], ["b", "c"]])
print(v, m)
```

scikit-learn's `TfidfVectorizer` uses a *smoothed* IDF, $\ln\frac{1+N}{1+df} + 1$, and L2-normalizes each row, so its numbers differ slightly from the textbook formula.

# Exercise: A ticket router with error analysis

Using the 18 example tickets from the lesson, plus **at least 12 more you write yourself** (aim for some ambiguous ones), train a TF-IDF + LogisticRegression router. In your notes, record: the macro-F1 from 3-fold CV, the confusion matrix, and the top 5 features per class (`clf.coef_` with `vectorizer.get_feature_names_out()`). Then pick 3 errors and explain *why* the model failed: negation, an unseen word, or ambiguity?

## Hint

Top features for class k: `np.argsort(clf.coef_[k])[-5:]`. To get CV predictions for a confusion matrix, use `cross_val_predict`.

# Sources

- *Speech and Language Processing, 3rd ed. draft* by Jurafsky & Martin (free online), chapters 2, 4, 6, 9–10
- [scikit-learn: Working with text data (tutorial)](https://scikit-learn.org/stable/tutorial/text_analytics/working_with_text_data.html)
- Mikolov et al. (2013), "Efficient Estimation of Word Representations in Vector Space", arXiv:1301.3781
- [Jay Alammar: The Illustrated Word2Vec and The Illustrated BERT](https://jalammar.github.io/)
- [Hugging Face: NLP Course (transformers, tokenizers)](https://huggingface.co/learn/nlp-course)
- [Sentence-Transformers documentation (SBERT)](https://www.sbert.net/)
