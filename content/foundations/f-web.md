---
id: f-web
title: How the Web Works: HTTP, APIs & JSON
week: Foundation 7
summary: Clients and servers, URLs, DNS, the HTTP request/response cycle, status codes, REST APIs, JSON, and authentication basics.
builds_on: f-terminal
leads_to: f-js, do-w2, fs-w1, fs-w3, ag-w1
---

DevOps, Full-Stack and Agentic AI all assume you know "HTTP, API, server and client". Calling an LLM is an HTTP request. A FastAPI backend is an HTTP server. Nginx proxies HTTP. This module builds the complete mental model of what happens when you type a URL and press Enter.

# Lesson: Clients, servers and URLs (20 min)

The web follows a **client–server** model:

- A **client** (a browser, a mobile app, a Python script, `curl`) sends a **request**.
- A **server** (a program listening on a network port) processes it and returns a **response**.

One computer can be both: your backend is a server to the browser but a client of the database and of the LLM API.

### Anatomy of a URL

```text
https://api.example.com:443/v1/orders/42?expand=items&limit=10#details
└─┬─┘   └──────┬──────┘ └┬┘└─────┬─────┘└─────────┬──────────┘└──┬──┘
scheme       host      port    path            query          fragment
```

- **scheme**: the protocol, `http` or `https` (HTTP encrypted with TLS)
- **host**: the domain name, resolved to an IP address by DNS
- **port**: defaults to 80 for http and 443 for https
- **path**: which resource
- **query**: `key=value` parameters, used for filtering and options
- **fragment**: handled by the browser only, and never sent to the server. This app uses `#/lesson/...` fragments for navigation!

### What happens when you press Enter

1. **DNS lookup**: the name `example.com` is resolved to an IP address, like `93.184.215.14`.
2. **TCP connection** to that IP on port 443. This is a reliable, ordered byte stream.
3. **TLS handshake**: the server proves its identity with a certificate, and the two sides agree on encryption keys.
4. The client sends an **HTTP request**.
5. The server responds. The browser parses the HTML, discovers more resources (CSS, JS, images) and requests those too.

> [!connect] DevOps week 2
> Each step can fail, and DevOps teaches you to debug them all: DNS with `dig`, ports with `ss` and firewalls, TLS certificates with Let's Encrypt, and proxies with Nginx.

> [!recap]
> - A client sends requests, and a server sends responses.
> - URL = scheme, host, port, path, query, fragment.
> - Enter → DNS → TCP → TLS → HTTP.

# Lesson: HTTP requests and responses (25 min)

HTTP is a **text-based, stateless request/response protocol**. A request:

```http
POST /v1/orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...

{"product_id": 7, "quantity": 2}
```

A response:

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /v1/orders/981

{"id": 981, "status": "pending", "total": 258.0}
```

### Methods (verbs)

| Method | Meaning | Safe? | Idempotent? |
|---|---|---|---|
| GET | Read a resource | ✓ | ✓ |
| POST | Create a resource or trigger an action | ✗ | ✗ |
| PUT | Replace a resource completely | ✗ | ✓ |
| PATCH | Partially update | ✗ | ✗ (usually) |
| DELETE | Remove | ✗ | ✓ |

**Idempotent** means that doing it twice has the same effect as doing it once. This matters when a network glitch makes a client **retry**. Retrying a GET or PUT is harmless, but retrying a POST might create two orders. That's why payment APIs use **idempotency keys** (Full-Stack week 10, Agentic week 5).

### Status codes

| Range | Meaning | Common examples |
|---|---|---|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved Permanently, 304 Not Modified |
| 4xx | **Client** error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | **Server** error | 500 Internal Server Error, 502 Bad Gateway, 503 Unavailable, 504 Gateway Timeout |

> [!tip] Who should fix it?
> 4xx means the request is wrong: fix the client, or don't retry. 5xx (and 429) means the server or something upstream had trouble: retry with **exponential backoff**.

### Headers

Headers are metadata. Some important ones:

- `Content-Type`: the format of the body (`application/json`, `text/html`)
- `Authorization`: credentials
- `Cache-Control`: caching rules
- `Cookie` / `Set-Cookie`: small pieces of state the browser stores and sends back
- `Accept`: the formats the client wants

### Statelessness

Each request stands alone, and the server doesn't remember the previous one. "Logged in" state is carried by the client on **every request**, in a cookie or a token.

```bash norun
curl -i https://httpbin.org/get            # -i shows the status line and headers
curl -X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"hi": 1}'
```

> [!recap]
> - A request is method + path + headers + body. A response is status + headers + body.
> - Know GET/POST/PUT/PATCH/DELETE and which are idempotent.
> - 4xx = client error, 5xx = server error. Retry with backoff on 5xx and 429.

# Lesson: JSON and REST APIs (25 min)

### JSON

**JSON** (JavaScript Object Notation) is the common data format of APIs. It has objects `{}`, arrays `[]`, strings, numbers, `true`/`false` and `null`.

```python
import json
order = {"id": 981, "items": [{"sku": "A1", "qty": 2}], "paid": False, "note": None}
text = json.dumps(order)          # Python -> JSON text
print(text)
back = json.loads(text)           # JSON text -> Python
print(back["items"][0]["qty"], type(back["paid"]))
```

Note the mapping: Python `None` ↔ JSON `null`, `True` ↔ `true`, and dict keys always become strings.

### REST: resources and verbs

**REST** is a style of designing HTTP APIs around **resources** (nouns) and standard methods (verbs):

| Action | Request |
|---|---|
| List orders | `GET /orders?status=pending&page=2` |
| Get one order | `GET /orders/42` |
| Create an order | `POST /orders` with a JSON body |
| Update an order's status | `PATCH /orders/42` with `{"status": "shipped"}` |
| Delete an order | `DELETE /orders/42` |
| An order's items | `GET /orders/42/items` |

Good API design:

- Use **plural nouns** with no verbs in paths (`/orders`, not `/getOrders`).
- Return the **right status codes**.
- Keep **error bodies consistent**: `{"error": "out_of_stock", "detail": "..."}`.
- **Paginate** long lists.
- **Version** the API: `/v1/...`.

### Calling an API from Python

```python norun
import requests   # pip install requests (or httpx)

r = requests.get("https://api.github.com/repos/python/cpython", timeout=10)
r.raise_for_status()               # raises for 4xx/5xx
data = r.json()
print(data["stargazers_count"])
```

Always set a **timeout**. A request without one can hang forever, which is a classic production bug.

> [!connect] An LLM API is just this
> `POST https://api.anthropic.com/v1/messages` with a JSON body containing the model and messages, and an API key header. The response is JSON, or a stream of events. Full-Stack weeks 1–3 and Agentic week 1 build on exactly this.

> [!recap]
> - JSON maps naturally to Python dicts and lists.
> - REST: resource paths + HTTP verbs + status codes.
> - In client code, always use timeouts and check status codes.

# Lesson: Authentication, cookies and CORS (20 min)

**Authentication** asks "who are you?" **Authorization** asks "what are you allowed to do?"

- **API keys**: a secret string sent in a header. Simple and common for server-to-server calls, such as LLM APIs. Never expose them in frontend code.
- **Sessions + cookies**: after login, the server stores a session and the browser sends back a session cookie automatically. Set the cookie flags `HttpOnly` (JavaScript can't read it), `Secure` (HTTPS only) and `SameSite`.
- **Tokens (JWT)**: after login the client receives a signed token and sends `Authorization: Bearer <token>` on each request. The server verifies the **signature** without a database lookup. You'll implement this in Full-Stack week 3.
- **OAuth 2.0 / OpenID Connect**: "Sign in with Google": the user logs in at a provider, and your app receives a token. Delegated authorization.

### CORS in one paragraph

Browsers block JavaScript on `site-a.com` from reading responses from `api.site-b.com` unless that API explicitly allows it with `Access-Control-Allow-Origin` headers. This is the **same-origin policy**, and **CORS** is how servers relax it. If your frontend says "blocked by CORS policy", the fix belongs on the **server**: configure the allowed origins (FastAPI's `CORSMiddleware`, Full-Stack week 3).

> [!warning] HTTPS everywhere
> Tokens, cookies and passwords sent over plain HTTP can be read by anyone on the network. Production apps use HTTPS only. Certificates from Let's Encrypt are free (DevOps week 2).

> [!recap]
> - API keys stay on the server. Cookies get HttpOnly + Secure + SameSite. JWTs are sent as Bearer tokens.
> - CORS errors are fixed on the server.

# Quiz

## Which part of `https://shop.io/cart?coupon=X#top` is never sent to the server?
- [ ] `shop.io`
- [ ] `/cart`
- [ ] `coupon=X`
- [x] `#top`
> The fragment is handled entirely by the browser. Single-page apps (like this one) use it for routing.

## A request returns 404. What does it mean?
- [ ] The server crashed
- [x] The requested resource wasn't found; the client asked for something that doesn't exist
- [ ] You are not logged in
- [ ] Too many requests
> 404 is a client error. A server crash is 5xx, not logged in is 401, and rate limiting is 429.

## Which method should be safe to retry automatically after a timeout?
- [ ] POST /payments
- [x] PUT /users/7 with a full replacement body
- [ ] POST /orders
- [ ] PATCH /counter (increment)
> PUT is idempotent: repeating it leaves the same final state. POSTs need idempotency keys to be retried safely.

## What is the JSON equivalent of Python's `None`?
- [ ] `None`
- [ ] `undefined`
- [x] `null`
- [ ] `""`
> `json.dumps(None)` gives `null`.

## Your API returns 503 occasionally. What should a well-behaved client do?
- [ ] Give up immediately
- [x] Retry with exponential backoff (and a limit)
- [ ] Retry immediately in a tight loop
- [ ] Switch to HTTP instead of HTTPS
> 503 is transient. Backoff avoids hammering a struggling server, and the retry limit prevents infinite loops.

## Which REST design is best for fetching the items of order 42?
- [ ] `GET /getOrderItems?id=42`
- [x] `GET /orders/42/items`
- [ ] `POST /orders/items/get`
- [ ] `GET /items/order=42`
> Use resource nouns in a hierarchy, with the HTTP verb expressing the action.

## A browser console shows "blocked by CORS policy". Where is the fix?
- [ ] In the user's browser settings
- [x] On the API server: allow the frontend's origin
- [ ] In the HTML file
- [ ] Switch from JSON to XML
> The server declares which origins may read its responses.

## Why must every API call in production code have a timeout?
- [ ] HTTP requires it
- [x] Without one, a stuck connection can hang your program or worker forever
- [ ] Timeouts make requests faster
- [ ] Servers reject requests without timeouts
> Network calls can stall indefinitely. Timeouts plus retries are basic resilience.

# Exercise: Design a REST API

Design (on paper or in your notes) the API for a **study-tracker** app with users, courses and lesson-completions. For each operation, write the method, the path, an example JSON body (if any), and the success status code:

1. Register a user
2. List courses (filter by category, paginated)
3. Get one course with its lessons
4. Mark a lesson complete for the current user
5. Undo a completion
6. Get the current user's progress summary

Then answer: which of these must be idempotent, and how would you make "mark complete" safe to retry?

## Solution

| # | Request | Body | Success |
|---|---|---|---|
| 1 | `POST /v1/users` | `{"email": "...", "password": "..."}` | 201 Created |
| 2 | `GET /v1/courses?category=ai&page=1&page_size=20` | none | 200 |
| 3 | `GET /v1/courses/{course_id}` (with lessons) | none | 200 |
| 4 | `PUT /v1/me/completions/{lesson_id}` | `{}` or `{"completed_at": "..."}` | 200 or 201 |
| 5 | `DELETE /v1/me/completions/{lesson_id}` | none | 204 |
| 6 | `GET /v1/me/progress` | none | 200 |

Modelling "mark complete" as a **PUT on a specific completion resource** makes it naturally idempotent: doing it twice still leaves one completion. With `POST /completions`, you'd need a unique constraint on (user, lesson) or an idempotency key. DELETE is idempotent too: deleting something that's already gone can return 204 or 404, but the state is the same. Errors: 401 if not logged in, 404 if the lesson doesn't exist, and 422 for invalid bodies.

# Sources

- [MDN: An overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
- [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [How DNS works (illustrated comic)](https://howdns.works/)
- [Microsoft: RESTful web API design best practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [JSON specification (json.org)](https://www.json.org/)
