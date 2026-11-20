/* Course catalog: course metadata + the module files that hold lessons, quizzes,
 * exercises and projects. Shared by the app (window) and the service worker (self).
 * Bump APP_VERSION when you change files so installed apps pick up updates promptly. */
self.APP_VERSION = '1.0.0';

self.CATALOG = {
  // Display order of the bootcamp grid (same arrangement as the reference screenshot).
  grid: ['bi', 'agentic', 'python', 'ai', 'devops', 'fullstack'],

  // Recommended order through everything.
  path: ['foundations', 'python', 'bi', 'ai', 'agentic', 'fullstack', 'devops'],

  courses: {
    foundations: {
      title: 'Foundations',
      short: 'Foundations',
      art: 'assets/art/turtle.svg',
      color: '#3fb6a8',
      kind: 'foundation',
      tagline: 'The math, programming and web prerequisites every bootcamp assumes.',
      description:
        'Each bootcamp expects some background, such as functions and logarithms, vectors and gradients, probability, the terminal, HTTP or JavaScript. This track teaches exactly those prerequisites, and every bootcamp links back to the modules it depends on. Study a foundation module just before the bootcamp week that needs it.',
      outcomes: [
        'Read and manipulate the formulas used in statistics and machine learning',
        'Think in vectors, matrices and gradients — the language of ML and embeddings',
        'Reason about uncertainty with probability and descriptive statistics',
        'Work comfortably in a terminal and with Git',
        'Understand how the web works: HTTP, APIs, JSON',
        'Read and write modern JavaScript and use NumPy/pandas for data'
      ],
      modules: [
        'foundations/f-algebra.md',
        'foundations/f-linalg.md',
        'foundations/f-calculus.md',
        'foundations/f-probability.md',
        'foundations/f-stats.md',
        'foundations/f-terminal.md',
        'foundations/f-web.md',
        'foundations/f-js.md',
        'foundations/f-pydata.md'
      ]
    },

    python: {
      title: 'Programming with Python',
      short: 'Python',
      art: 'assets/art/snake.svg',
      color: '#e4e04a',
      weeks: 8, hours: 183,
      tagline: 'Python from zero: core language, data structures, functions, OOP — then coding with AI.',
      description:
        'A from-scratch Python track. You start with values, conditions and loops, then data structures, functions, files and regular expressions, advanced functions (generators, decorators, recursion) and object-oriented design. The last two weeks introduce generative AI, agentic AI and disciplined AI-assisted ("vibe") coding. Every Python code block in this course runs in the browser.',
      prereqs: ['f-algebra', 'f-terminal'],
      outcomes: [
        'Write clean, idiomatic Python programs that read input, compute and print results',
        'Choose the right data structure (list, tuple, set, dict) and reason about mutability',
        'Design reusable functions, generators and decorators',
        'Model problems with classes, inheritance and encapsulation',
        'Work with files, packages, virtual environments and regex',
        'Use LLMs as a coding partner while still testing and owning the code'
      ],
      modules: [
        'python/py-w1.md', 'python/py-w2.md', 'python/py-w3.md', 'python/py-x.md',
        'python/py-w4.md', 'python/py-w5.md', 'python/py-p1.md', 'python/py-w7.md', 'python/py-w8.md'
      ]
    },

    bi: {
      title: 'Business Intelligence',
      short: 'BI',
      art: 'assets/art/eagle.svg',
      color: '#5d7d4b',
      weeks: 6, hours: 136,
      tagline: 'SQL for analytics, performance tuning, data warehousing, ETL and Power BI storytelling.',
      description:
        'BI turns raw operational data into decisions. You will query with analytical SQL, make those queries fast, design a star-schema data warehouse fed by ETL, and build Power BI models, DAX measures and dashboards that tell a clear story. All SQL in this course runs in the browser on a sample shop database.',
      prereqs: ['f-stats', 'f-algebra'],
      outcomes: [
        'Answer business questions with joins, aggregations, CTEs and window functions',
        'Read execution plans and design indexes that make queries fast',
        'Model a warehouse with facts, dimensions, star and snowflake schemas',
        'Build ETL pipelines and understand SSIS/SSAS and Metabase',
        'Create Power BI data models, DAX measures, KPIs and incremental refresh',
        'Design dashboards that communicate a story to stakeholders'
      ],
      modules: ['bi/bi-w1.md', 'bi/bi-w2.md', 'bi/bi-w3.md', 'bi/bi-w4.md', 'bi/bi-w5.md', 'bi/bi-p.md']
    },

    ai: {
      title: 'Artificial Intelligence',
      short: 'AI',
      art: 'assets/art/bird.svg',
      color: '#9a4be0',
      weeks: 11, hours: 243,
      tagline: 'Statistics, classical ML, recommenders, time series, deep learning, NLP and computer vision.',
      description:
        'A systematic route from statistical inference to modern deep learning. Classical ML (regression, classification, trees, clustering, recommenders, time series) builds the intuition for generalization and evaluation. Deep learning in PyTorch then covers MLPs, optimization, RNN/LSTM, embeddings, attention and CNNs.',
      prereqs: ['f-algebra', 'f-linalg', 'f-calculus', 'f-probability', 'f-stats', 'f-pydata'],
      requires: ['python'],
      outcomes: [
        'Estimate, build confidence intervals and test hypotheses — and interpret p-values correctly',
        'Train, tune and evaluate regression and classification models with scikit-learn',
        'Use trees, ensembles, clustering and PCA, and know when each fits',
        'Build recommenders and forecast time series with leakage-free validation',
        'Implement and train neural networks in PyTorch, diagnosing over/underfitting',
        'Process text and images with embeddings, attention, RNNs, CNNs and transfer learning'
      ],
      modules: [
        'ai/ai-w1.md', 'ai/ai-w2.md', 'ai/ai-w3.md', 'ai/ai-w4.md', 'ai/ai-p1.md',
        'ai/ai-w7.md', 'ai/ai-w8.md', 'ai/ai-w9.md', 'ai/ai-w10.md', 'ai/ai-p2.md'
      ]
    },

    agentic: {
      title: 'Agentic AI',
      short: 'Agentic AI',
      art: 'assets/art/octopus.svg',
      color: '#a6afba',
      weeks: 6, hours: 131,
      tagline: 'LLM apps, RAG, LangGraph agents, harness engineering, MCP and production reliability.',
      description:
        'How to build AI systems that act. Starting from LLM APIs, structured outputs and tool calling, you will build retrieval-augmented generation, stateful agents with LangGraph, then the harness engineering behind serious agents (context management, MCP, skills, sandboxes and subagents). The course ends with production reliability: durable execution, security against prompt injection, and evaluation.',
      prereqs: ['f-web', 'f-linalg', 'f-probability'],
      requires: ['python'],
      outcomes: [
        'Pick models by capability, cost and latency and call LLM APIs robustly',
        'Design tool contracts and structured outputs that models use reliably',
        'Build RAG pipelines with hybrid search, reranking, citations and evaluation',
        'Engineer stateful, interruptible agents with LangGraph',
        'Manage context, memory, MCP tools, skills, sandboxes and subagents',
        'Ship agents safely: retries, idempotency, approvals, injection defense, evals'
      ],
      modules: ['agentic/ag-w1.md', 'agentic/ag-w2.md', 'agentic/ag-w3.md', 'agentic/ag-w4.md', 'agentic/ag-w5.md', 'agentic/ag-p.md']
    },

    devops: {
      title: 'DevOps',
      short: 'DevOps',
      art: 'assets/art/dolphin.svg',
      color: '#8eaac6',
      weeks: 13, hours: 288,
      tagline: 'Linux, networking, scripting, Docker, CI/CD, Terraform, Ansible, Kubernetes and observability.',
      description:
        'How software gets from a laptop to reliable production. You will build up layer by layer: Linux and networking fundamentals, then automation with Bash, containers with Docker, pipelines with CI/CD, infrastructure as code with Terraform and Ansible, orchestration with Kubernetes and Helm, and reliability with metrics, alerts and SLOs.',
      prereqs: ['f-terminal', 'f-web'],
      outcomes: [
        'Administer Linux servers: users, permissions, processes, services and logs',
        'Configure networking, DNS, TLS, SSH and an Nginx reverse proxy',
        'Automate operations with Bash, systemd and cron',
        'Containerize applications and run multi-service stacks with Compose',
        'Build CI/CD pipelines with tests, image publishing, deployment checks and rollback',
        'Provision with Terraform, configure with Ansible, and operate Kubernetes with Helm',
        'Monitor with Prometheus/Grafana and run SLO-driven incident response'
      ],
      modules: [
        'devops/do-w1.md', 'devops/do-w2.md', 'devops/do-w3.md', 'devops/do-w4.md', 'devops/do-w5.md', 'devops/do-p1.md',
        'devops/do-w7.md', 'devops/do-w8.md', 'devops/do-w9.md', 'devops/do-w10.md', 'devops/do-w11.md', 'devops/do-p2.md'
      ]
    },

    fullstack: {
      title: 'Full-Stack AI Engineering',
      short: 'Full-Stack AI',
      art: 'assets/art/wolf.svg',
      color: '#a37b98',
      weeks: 14, hours: 322,
      tagline: 'Build AI products end to end: chat UI, FastAPI + Postgres, RAG, agents, async jobs, evals and deployment.',
      description:
        'An end-to-end product track. You architect an AI application, build a streaming chat UI and a FastAPI + PostgreSQL backend, then add LLM engineering, pgvector search, production RAG, agents with tools, Redis-backed background jobs, evaluation and observability. You finish by deploying it with Docker. Three project checkpoints grow into one capstone product.',
      prereqs: ['f-web', 'f-js', 'f-terminal', 'f-linalg'],
      requires: ['python'],
      outcomes: [
        'Architect AI products with clear boundaries between UI, API, LLM and data',
        'Build a streaming chat interface with robust state, errors and markdown',
        'Design REST APIs with FastAPI, Pydantic, SQLAlchemy, Alembic and JWT auth',
        'Engineer prompts, structured output, tool calling, retries and cost control',
        'Implement semantic search with pgvector and production-grade RAG',
        'Run long AI tasks with Redis queues and workers; evaluate and monitor quality',
        'Containerize and deploy securely with Docker and CI/CD'
      ],
      modules: [
        'fullstack/fs-w1.md', 'fullstack/fs-w2.md', 'fullstack/fs-w3.md', 'fullstack/fs-p1.md',
        'fullstack/fs-w5.md', 'fullstack/fs-w6.md', 'fullstack/fs-w7.md', 'fullstack/fs-p2.md',
        'fullstack/fs-w9.md', 'fullstack/fs-w10.md', 'fullstack/fs-w11.md', 'fullstack/fs-w12.md', 'fullstack/fs-p3.md'
      ]
    }
  }
};
