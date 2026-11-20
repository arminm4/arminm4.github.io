## How the six bootcamps fit together

The six bootcamps are layers of one skill set. Python is the shared language underneath everything. **BI** teaches you to ask questions of data. **AI** teaches models that learn from data. **Agentic AI** and **Full-Stack AI** teach you to build products around large language models. **DevOps** teaches you to ship and run all of it reliably.

| Layer | Bootcamp | What it adds | Reused later in |
|---|---|---|---|
| Language | Python | Programming fundamentals, data structures, OOP | Every other bootcamp |
| Data | Business Intelligence | SQL, data modeling, dashboards | Full-Stack (PostgreSQL), AI (feature engineering) |
| Models | Artificial Intelligence | Statistics, ML, deep learning, embeddings, attention | Agentic AI and Full-Stack (embeddings, evaluation) |
| Agents | Agentic AI | LLM apps, RAG, LangGraph, MCP, safety | Full-Stack (agents & tools) |
| Product | Full-Stack AI Engineering | UI, API, database, async jobs, deployment | Your own projects |
| Operations | DevOps | Linux, Docker, CI/CD, Kubernetes, monitoring | Deploying anything above |

## Recommended order

1. **Foundations: Algebra & Functions, Terminal & Git** (about a week). You need just enough to start Python.
2. **Python** (8 weeks). Don't skip the exercises: every later bootcamp assumes you can write Python fluently.
3. **Business Intelligence** (6 weeks). SQL and data modeling pay off in every later course. Study *Descriptive Statistics* first.
4. **Foundations: Linear Algebra, Calculus, Probability, Python for Data**, then **AI** (11 weeks).
5. **Foundations: Web & HTTP**, then **Agentic AI** (6 weeks).
6. **Foundations: JavaScript**, then **Full-Stack AI Engineering** (14 weeks). It brings everything together into a product.
7. **DevOps** (13 weeks). You can study it any time after Python and *Web & HTTP*. Studying it last lets you deploy your Full-Stack capstone properly.

> [!tip] Two tracks in parallel
> If you have the time, run DevOps alongside Agentic AI or Full-Stack, one module a week. The skills complement each other: Full-Stack week 12 (Docker & deployment) is a compressed version of DevOps weeks 4–5.

## Threads that run through everything

These ideas reappear in several courses. Spotting them is what makes the material "click" as one system.

- **Vectors and similarity.** You meet dot products in *Linear Algebra*, then cosine similarity in *AI week 9* (word embeddings), then semantic search in *Agentic week 2* and *Full-Stack week 6* (pgvector). It is the same math every time.
- **Optimization by gradients.** You meet derivatives in *Calculus*, then gradient descent in *AI week 2* (linear regression), then backpropagation in *AI week 7*. Training an LLM is the same algorithm at enormous scale.
- **Generalization and evaluation.** You split into train and test sets in *AI week 2*, then build evaluation datasets and LLM-as-judge in *Agentic week 5* and *Full-Stack week 11*. You always measure on data the system didn't see.
- **Relational data.** You learn joins and indexes in *BI weeks 1–2*, then SQLAlchemy and PostgreSQL in *Full-Stack week 3*, then database backups in *DevOps week 3*.
- **Declarative state.** You declare the desired state instead of writing steps: SQL describes *what* data you want, Terraform describes *what* infrastructure should exist, and Kubernetes YAML describes *what* should be running.
- **Feedback loops.** An agent loop (observe, decide, act) in *Agentic week 1*, a control loop in Kubernetes, a CI pipeline, and an SLO error budget all have the same shape: measure, compare to a goal, act.
- **Reliability.** Retries, timeouts and idempotency appear in *Full-Stack week 10* (background jobs), *Agentic week 5* (durable agents), *DevOps week 5* (deployments) and *DevOps week 11* (SRE).

## How to study with this app

Research on learning (see *Make It Stick* by Brown, Roediger & McDaniel, or Dunlosky et al., 2013) consistently finds that **retrieval practice** and **spacing** beat re-reading. The app is built around both:

1. **Read a lesson actively.** Run every code block, and press **Edit** to change it and predict the output before you run it.
2. **Write a two-to-three sentence summary in My notes.** If you can't explain it simply, re-read the part you couldn't explain.
3. **Take the module quiz from memory.** Read every explanation, including for the questions you got right.
4. **Do the exercises before looking at the solution.** Struggling for 15 minutes is where the learning happens.
5. **Visit Review daily.** Questions return after 1, 2, 4, 8… days, and immediately if you missed them.
6. **Build the projects.** They are where separate topics become one skill. Push them to GitHub; they become your portfolio.

> [!important] Pace
> The original bootcamps expect 20–25 hours a week. Self-paced, one module a week at 8–10 hours is sustainable. Consistency beats intensity, and your streak on the home screen is there to help.

## Tools you'll want installed (for later modules)

The in-app playground runs Python (standard library), SQL and JavaScript. For data science and the projects, install:

- **Python 3.12+** and **VS Code** with the Python extension
- **Git** and a GitHub account
- **Docker Desktop** (DevOps, Full-Stack)
- Free notebooks with GPUs: **Google Colab** or **Kaggle Notebooks** (AI weeks 7–10)
- **Power BI Desktop**, free on Windows (BI weeks 4–5)
