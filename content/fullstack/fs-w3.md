---
id: fs-w3
title: FastAPI, PostgreSQL & the Application Backend
week: Week 3
summary: REST APIs with FastAPI and Pydantic, PostgreSQL with SQLAlchemy and Alembic migrations, users and authentication with password hashing and JWT, modeling conversations and messages, and async APIs.
builds_on: fs-w1, bi-w1, py-w5, f-web
leads_to: fs-p1, fs-w5, fs-w6
---

This week you build the backend that every later feature plugs into: a typed REST API, a relational database with migrations, secure authentication, and the conversation and message model for the chat app. FastAPI and SQLAlchemy code runs on your machine. The security building blocks (password hashing, JWT signing) are implemented from scratch here with the standard library, so you understand them.

> [!tip] Local setup
> ```bash norun
> python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
> pip install "fastapi[standard]" "sqlalchemy[asyncio]" asyncpg alembic "pydantic-settings" "pwdlib[argon2]" pyjwt
> docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16
> fastapi dev app/main.py            # auto-reload server; docs at http://localhost:8000/docs
> ```

# Lesson: FastAPI and Pydantic (35 min)

**FastAPI** builds APIs from type-annotated Python functions. It validates the requests, serializes the responses and generates **OpenAPI docs** automatically (`/docs`).

```python norun
from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field

app = FastAPI(title="Chat API", version="1.0")

class ConversationCreate(BaseModel):            # request schema (input)
    title: str = Field(default="New chat", max_length=200)
    model: str = "claude-haiku-5-5"

class ConversationOut(BaseModel):               # response schema (output): never leak internal fields
    id: int
    title: str
    model: str

DB: dict[int, ConversationOut] = {}

@app.post("/v1/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(body: ConversationCreate):
    conv = ConversationOut(id=len(DB) + 1, **body.model_dump())
    DB[conv.id] = conv
    return conv

@app.get("/v1/conversations/{conv_id}", response_model=ConversationOut)
async def get_conversation(conv_id: int):
    if conv_id not in DB:
        raise HTTPException(status_code=404, detail="conversation not found")
    return DB[conv_id]

@app.get("/v1/conversations", response_model=list[ConversationOut])
async def list_conversations(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return list(DB.values())[offset:offset + limit]
```

Invalid input (wrong types, a 300-character title) automatically returns **422** with field-level errors. You get correct status codes, typed contracts and docs for free.

### Structure for a real project

```text
app/
├── main.py              # create app, include routers, middleware (CORS, logging)
├── config.py            # Settings via pydantic-settings (env vars, .env)
├── db.py                # engine, async session factory
├── models.py            # SQLAlchemy ORM models (tables)
├── schemas.py           # Pydantic models (API contracts)
├── deps.py              # dependencies: get_db, get_current_user
├── routers/             # auth.py, conversations.py, messages.py
└── services/            # business logic: llm_gateway.py, chat_service.py
```

**Dependency injection** with `Depends()` provides database sessions, the current user and settings to the endpoints, and lets tests override them (the same idea as Python week 8).

```python norun
from fastapi import Depends
async def get_db():
    async with SessionLocal() as session:
        yield session                           # closes automatically after the request

@app.get("/v1/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}
```

> [!recap]
> - Path/query/body parameters with type hints; Pydantic for request and response models.
> - Automatic validation (422) and OpenAPI docs.
> - Separate routers, schemas, models and services. Wire them with Depends.

# Lesson: PostgreSQL, SQLAlchemy and Alembic (35 min)

**PostgreSQL** is the default choice for application data: robust, standards-compliant, JSONB for semi-structured data, full-text search, and **pgvector** for embeddings (week 6). Everything from BI weeks 1–2 (joins, indexes, plans) applies.

### SQLAlchemy 2.0 ORM

```python norun
from datetime import datetime
from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="New chat")
    model: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", order_by="Message.id")

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))          # user | assistant | tool
    content: Mapped[str] = mapped_column(Text)
    tokens_in: Mapped[int | None]; tokens_out: Mapped[int | None]; latency_ms: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    conversation: Mapped[Conversation] = relationship(back_populates="messages")
```

### Async sessions and queries

```python norun
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
engine = create_async_engine(settings.database_url, pool_size=10)   # postgresql+asyncpg://...
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def list_user_conversations(db, user_id: int):
    rows = await db.scalars(select(Conversation).where(Conversation.user_id == user_id)
                            .order_by(Conversation.created_at.desc()).limit(50))
    return rows.all()
```

> [!mistake] The N+1 query problem
> Looping over 50 conversations and touching `conv.messages` can fire **51 queries**. Load related rows deliberately (`selectinload(Conversation.messages)`), or query exactly what the endpoint needs. Watch the SQL log during development: the BI week 2 lesson applies to ORMs too.

### Migrations with Alembic

The schema changes over time, and **migrations** version those changes like code:

```bash norun
alembic init -t async migrations
alembic revision --autogenerate -m "create users, conversations, messages"
alembic upgrade head        # apply; 'alembic downgrade -1' to roll back
```

Review the autogenerated migrations, because they can miss renames. Run migrations in your deploy pipeline (DevOps week 5). Never edit the production schema by hand.

> [!recap]
> - SQLAlchemy 2.0 typed models; relationships; async sessions.
> - Avoid N+1 queries. Index foreign keys and filter columns.
> - Alembic migrations, reviewed and applied in CI/CD.

# Lesson: Users, passwords and JWT authentication (35 min)

### Passwords: hash, never encrypt or store plaintext

Use a **slow, salted, memory-hard** hash: **Argon2id** (recommended), scrypt or bcrypt. The salt makes identical passwords hash differently. Slowness makes brute-forcing leaked hashes expensive.

Here's the idea behind **key stretching**, written out as PBKDF2-HMAC-SHA256 so you can see every step (it runs in the browser):

```python
import hashlib, hmac, os, base64

def pbkdf2_sha256(password: bytes, salt: bytes, iterations: int) -> bytes:
    """PBKDF2 with one 32-byte block: HMAC applied `iterations` times, results XOR-ed together."""
    u = hmac.new(password, salt + b"\x00\x00\x00\x01", hashlib.sha256).digest()
    out = bytearray(u)
    for _ in range(iterations - 1):            # every extra iteration multiplies an attacker's cost
        u = hmac.new(password, u, hashlib.sha256).digest()
        out = bytearray(a ^ b for a, b in zip(out, u))
    return bytes(out)

ITER = 20_000          # demo value; OWASP recommends ≥600,000 for PBKDF2-SHA256 (or use Argon2id)

def hash_password(password: str) -> str:
    salt = os.urandom(16)                      # unique random salt per password
    h = pbkdf2_sha256(password.encode(), salt, ITER)
    return f"pbkdf2_sha256${ITER}$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(h).decode()

def verify_password(password: str, stored: str) -> bool:
    _, iters, salt_b64, hash_b64 = stored.split("$")
    h = pbkdf2_sha256(password.encode(), base64.b64decode(salt_b64), int(iters))
    return hmac.compare_digest(h, base64.b64decode(hash_b64))   # constant-time comparison

stored = hash_password("correct horse battery staple")
print(stored[:50] + "...")
print(verify_password("correct horse battery staple", stored), verify_password("wrong", stored))
print("same password, different salt -> different hash:", hash_password("x") != hash_password("x"))
```

Storing the algorithm and iteration count alongside the hash (`pbkdf2_sha256$20000$…`) lets you raise the cost later and re-hash at the user's next login. In production, use a maintained library: `pwdlib` with **Argon2id**, or `hashlib.scrypt` / bcrypt in standard CPython. Don't ship hand-rolled code like this.

### JWT: JSON Web Tokens

After a successful login, the server issues a **signed token**: `base64url(header).base64url(payload).base64url(signature)`. The client sends `Authorization: Bearer <token>` on every request. The server verifies the **signature** and the **expiry** with no database lookup.

```python
import base64, hashlib, hmac, json, time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def sign_jwt(payload: dict, secret: str) -> str:
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{b64url(sig)}"

token = sign_jwt({"sub": "42", "exp": int(time.time()) + 900}, secret="dev-secret-change-me")
print(token)
print("payload is only encoded, NOT encrypted:",
      base64.urlsafe_b64decode(token.split(".")[1] + "==").decode())
```

> [!warning] JWT pitfalls
> - The payload is **readable by anyone**, so never put secrets in it.
> - **Short expiry** for access tokens (5–15 minutes) plus **refresh tokens** (stored server-side, so they can be rotated and revoked).
> - Pin the algorithm on verification (reject `alg: none`), and keep the signing secret in the environment.
> - Browser storage: an **HttpOnly, Secure, SameSite** cookie resists XSS token theft better than localStorage.

### Wiring auth into FastAPI

```python norun
import jwt                                           # PyJWT
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
oauth2 = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2), db=Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])   # checks exp too
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "user not found")
    return user
```

**Authorization**: every query that touches user data must be scoped to the user, for example `WHERE conversation.user_id = :current_user`. Return **404, not 403**, for other users' resources, so you don't leak that they exist. Missing ownership checks (IDOR) are among the most common real-world API vulnerabilities.

> [!recap]
> - Argon2/scrypt/bcrypt with salt, and constant-time comparison.
> - JWT = signed (not encrypted) claims. Short-lived access + refresh tokens. HttpOnly cookies.
> - Scope every query to the current user (prevent IDOR).

# Lesson: Conversations, messages and async APIs (25 min)

### The chat endpoint, end to end

```python norun
@router.post("/v1/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: MessageIn, user=Depends(get_current_user), db=Depends(get_db)):
    conv = await db.scalar(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id))
    if not conv:
        raise HTTPException(404, "conversation not found")
    db.add(Message(conversation_id=conv.id, role="user", content=body.content))
    await db.commit()
    history = await load_recent_messages(db, conv.id, limit=30)
    prompt = build_prompt(SYSTEM_PROMPT, history, body.content, max_tokens=8000)   # week 1 exercise!

    async def stream():
        parts, usage = [], None
        async for event in llm_gateway.stream(prompt, model=conv.model):
            if event.type == "token":
                parts.append(event.text)
                yield sse({"type": "token", "text": event.text})
            elif event.type == "done":
                usage = event.usage
        db.add(Message(conversation_id=conv.id, role="assistant", content="".join(parts),
                       tokens_in=usage.input_tokens, tokens_out=usage.output_tokens))
        await db.commit()
        yield sse({"type": "done"})
    return StreamingResponse(stream(), media_type="text/event-stream")
```

### Why async?

A chat backend spends most of its time **waiting**: for the database, for the LLM (seconds!), for the embedding API. With `async`/`await`, one worker process can serve **many concurrent requests** while each one waits, the same event-loop idea as JavaScript (*JavaScript Essentials*).

Rules:
- Use async libraries end to end (`asyncpg`, `httpx.AsyncClient`, async SDKs).
- **Never block the event loop**: CPU-heavy work or blocking libraries go in `run_in_threadpool` or in background workers (week 10).
- Run independent calls concurrently with `asyncio.gather` (e.g. retrieval and loading the user profile).

```python
import asyncio, time

async def fake_io(name, seconds):
    await asyncio.sleep(seconds)          # stands in for a DB / HTTP call
    return name

async def main():
    t0 = time.perf_counter()
    results = await asyncio.gather(fake_io("db", 0.3), fake_io("embeddings", 0.3), fake_io("profile", 0.3))
    print(results, f"took {time.perf_counter() - t0:.2f}s (not 0.9s)")

await main()
```

> [!recap]
> - Endpoint: authorize → persist the user message → build the prompt → stream → persist the assistant message with usage.
> - Async lets you serve many waiting requests. Never block the loop. gather independent I/O.

# Quiz

## What does FastAPI return when a request body fails Pydantic validation?
- [ ] 500 Internal Server Error
- [x] 422 Unprocessable Entity with field-level errors
- [ ] 200 with null fields
- [ ] 404
> Validation is automatic, from your type annotations.

## Why use separate Pydantic models for input and output?
- [ ] FastAPI requires exactly two models
- [x] To control exactly what clients can send and what they receive (e.g. never return password_hash)
- [ ] For faster JSON
- [ ] To avoid using a database
> Explicit API contracts prevent accidental data leaks.

## What is the N+1 query problem?
- [ ] Too many indexes
- [x] Loading a list (1 query) and then lazily loading a relation per item (N more queries)
- [ ] A migration error
- [ ] Using async with sync drivers
> Use eager loading (selectinload) or tailored queries.

## Which is the correct way to store passwords?
- [ ] AES-encrypt them with a server key
- [ ] SHA-256 them once
- [x] A slow, salted hash such as Argon2id/scrypt/bcrypt, verified with a constant-time comparison
- [ ] Store them in plain text in a private table
> Fast hashes are brute-forced quickly, and encryption is reversible.

## Which statement about JWTs is true?
- [ ] The payload is encrypted
- [x] The payload is base64url-encoded and readable; the signature prevents tampering
- [ ] JWTs never expire
- [ ] JWTs must be stored in localStorage
> Signed ≠ encrypted. Keep secrets out of the claims.

## User A requests `/v1/conversations/77`, which belongs to user B. The API should:
- [ ] Return it
- [ ] Return 403 Forbidden with details
- [x] Return 404 (scoped query finds nothing), revealing nothing
- [ ] Return 500
> Scope queries by owner, which prevents IDOR and enumeration.

## Why is async beneficial for an LLM chat backend?
- [ ] It makes the LLM generate faster
- [x] Requests spend most of their time waiting on I/O; async lets one process handle many concurrently
- [ ] It removes the need for a database
- [ ] Async code uses less memory per token
> The concurrency comes from overlapping the waits, not from faster computation.

# Exercise: Verify a JWT (HS256) from scratch

Using only the standard library, write `verify_jwt(token, secret, now=None)` that returns the payload dict if the token is valid, and raises `ValueError` otherwise:
- It must have 3 parts.
- The header `alg` must be `"HS256"` (reject anything else, including `"none"`).
- The signature must match (use `hmac.compare_digest`).
- If the payload has `exp`, it must be `> now` (default `time.time()`).

The starter includes `sign_jwt` from the lesson for testing.

## Starter

```python
import base64, hashlib, hmac, json, time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def sign_jwt(payload, secret, alg="HS256"):
    header = b64url(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    body = b64url(json.dumps(payload).encode())
    sig = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{b64url(sig)}"

def verify_jwt(token, secret, now=None):
    pass
```

## Tests

```python
ns = load()
sign, verify = ns["sign_jwt"], ns["verify_jwt"]
t = sign({"sub": "42", "exp": 2000}, "s3cret")
assert verify(t, "s3cret", now=1000) == {"sub": "42", "exp": 2000}
for bad_token, secret, now in [(t, "wrong", 1000), (t, "s3cret", 3000), ("a.b", "s3cret", 0),
                                (sign({"sub": "1"}, "s3cret", alg="none"), "s3cret", 0)]:
    try:
        verify(bad_token, secret, now=now); raise AssertionError(f"should reject {bad_token[:20]}")
    except ValueError:
        pass
h, p, s = t.split(".")
forged = h + "." + ns["b64url"](b'{"sub":"1","exp":2000}') + "." + s
try:
    verify(forged, "s3cret", now=1000); raise AssertionError("tampered payload accepted!")
except ValueError:
    pass
```

## Solution

```python
import base64, hashlib, hmac, json, time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def sign_jwt(payload, secret, alg="HS256"):
    header = b64url(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    body = b64url(json.dumps(payload).encode())
    sig = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{b64url(sig)}"

def verify_jwt(token, secret, now=None):
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")
    header_b64, body_b64, sig_b64 = parts
    try:
        header = json.loads(b64url_decode(header_b64))
        payload = json.loads(b64url_decode(body_b64))
        sig = b64url_decode(sig_b64)
    except Exception as e:
        raise ValueError("malformed token") from e
    if header.get("alg") != "HS256":
        raise ValueError("unsupported algorithm")
    expected = hmac.new(secret.encode(), f"{header_b64}.{body_b64}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("bad signature")
    now = time.time() if now is None else now
    if "exp" in payload and payload["exp"] <= now:
        raise ValueError("token expired")
    return payload
```

Notice the order: check the algorithm, then the signature, and only then **trust** anything in the payload.

# Sources

- [FastAPI documentation: tutorial, dependencies, security (OAuth2 + JWT), SQL databases](https://fastapi.tiangolo.com/tutorial/)
- [SQLAlchemy 2.0: ORM quickstart and asyncio extension](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
- [Alembic tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519) and [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP API Security Top 10 (Broken Object Level Authorization)](https://owasp.org/API-Security/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/)
