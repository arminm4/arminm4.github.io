---
id: ag-p
title: Project: Production-Grade Support Agent
week: Week 6
kind: project
summary: Build, evaluate and harden a LangGraph agent with RAG, tools, memory, human approval, an MCP integration and an evaluation suite.
builds_on: ag-w5, ag-w4, ag-w3, ag-w2
leads_to: fs-w1
---

The Agentic AI capstone combines every week: an agent that answers from documents, takes actions through tools, asks for approval when it should, survives failures and comes with evidence that it works.

# Project: "ShopPilot": an agentic customer-support assistant

**Domain.** The shop from the BI course (orders, products, customers) plus a help center of 20–40 Markdown policy pages that you write or adapt (refunds, shipping, warranty, account security). Include a few deliberately tricky or contradictory pages, such as an old policy version.

### Functional requirements

1. **RAG over the help center**: structure-aware chunking with headers, hybrid retrieval (BM25 + embeddings with RRF), reranking (optional) and answers **with citations**. Abstain when the answer isn't found.
2. **Tools**: `get_order(order_id)`, `list_orders(customer_id)`, `create_ticket(...)` and `issue_refund(order_id, amount, idempotency_key)`. Use a SQLite DB for state.
3. **LangGraph**: an intent router; an agent ⇄ tools loop with budgets; agentic-RAG rewrite (max 2); refunds over a threshold go through `interrupt()` human approval, bound to the exact arguments.
4. **Memory**: a checkpointer (SQLite/Postgres) per thread, plus a small long-term store of user preferences (language, contact channel).
5. **MCP**: expose the order tools as an **MCP server** (FastMCP) and connect to it from the agent, or from an MCP host such as Claude Desktop.
6. **Security**: treat tool and document content as untrusted; least-privilege tools; no secrets in prompts; per-user data isolation.
7. **Reliability**: timeouts, retries with backoff on the LLM and tools, idempotent refunds, graceful handling of tool errors.

### Evaluation deliverables

- **Golden set** of at least 40 cases: policy questions (some unanswerable), order lookups, refunds under and over the threshold, multi-turn follow-ups, and **at least 5 adversarial cases** (prompt injection inside a help page, a user claiming fake authority, a request for another user's order).
- **Metrics**: retrieval recall@5 and MRR; answer faithfulness (LLM-as-judge, calibrated on 30 human labels and reported with κ); task success on the action cases (checked from the DB state); policy-violation rate on the adversarial cases (target 0); p50/p95 latency and cost per conversation.
- **Error analysis**: the categorized failures before and after your fixes.
- **Regression run in CI**: a GitHub Actions workflow that runs the eval suite (or a fast subset) on every PR.

## Milestones

- [ ] Write the help-center docs and seed the SQLite DB; define the golden set (≥ 40 cases, ≥ 5 adversarial)
- [ ] Ingestion + hybrid retrieval with citations; measure recall@5 and MRR
- [ ] LangGraph agent: router, tools loop, agentic-RAG rewrite, budgets
- [ ] Human approval with interrupt/resume bound to the exact action; idempotent refunds
- [ ] Checkpointer memory + long-term preferences store
- [ ] MCP server for the order tools, and connect to it
- [ ] Security pass: injection tests, least privilege, user isolation
- [ ] Eval harness + calibrated judge + error analysis; CI workflow; README with architecture diagram and results

## Rubric

| Criterion | Weight |
|---|---|
| Architecture and LangGraph design (clear state, bounded loops, HITL) | 20% |
| Retrieval quality and grounding (measured) | 20% |
| Reliability and security (idempotency, retries, injection resistance, isolation) | 20% |
| Evaluation rigour (golden set, calibrated judge, regression CI, error analysis) | 25% |
| Documentation and demo | 15% |

## Stretch goals

- A Streamlit or Next.js chat UI with streaming (or wait for Full-Stack week 2).
- Model routing: a cheap model for intent classification, a strong one for complex answers. Report the cost savings.
- Prompt caching for the system prompt and tool definitions. Measure the latency difference.
- Deploy with Docker Compose: API + worker + Postgres (DevOps week 4).

# Sources

- [LangGraph: customer-support and agentic RAG tutorials](https://langchain-ai.github.io/langgraph/tutorials/)
- [Model Context Protocol: build a server quickstart](https://modelcontextprotocol.io/quickstart/server)
- [OWASP: LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [Anthropic engineering: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
