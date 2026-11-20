---
id: fs-w2
title: Chat UI, Streaming & Conversation UX
week: Week 2
summary: Building the chat interface: message state, file upload, safe markdown rendering, streaming responses with SSE and WebSockets, loading and error states, and conversation UX patterns.
builds_on: fs-w1, f-js
leads_to: fs-w3, fs-p1
---

The UI is where users judge your AI product. A great chat interface feels **fast** (streaming), **trustworthy** (clear errors, sources, the ability to stop or regenerate) and **safe** (no XSS from model output). This week you'll build those pieces with plain JavaScript concepts that transfer directly to React or Next.js.

# Lesson: Message state as data (30 min)

Treat the conversation as **state**, an array of message objects. Render the UI *from* that state. Never patch the DOM ad hoc.

```js
// A tiny, framework-free state store: the same idea as React's useReducer
function reducer(state, action) {
  switch (action.type) {
    case "user_sent":
      return { ...state, messages: [...state.messages,
        { id: action.id, role: "user", content: action.text, status: "done" },
        { id: action.id + "-a", role: "assistant", content: "", status: "streaming" }] };
    case "token": {
      const msgs = state.messages.map(m => m.id === action.id ? { ...m, content: m.content + action.text } : m);
      return { ...state, messages: msgs };
    }
    case "done":
      return { ...state, messages: state.messages.map(m => m.id === action.id ? { ...m, status: "done" } : m) };
    case "error":
      return { ...state, messages: state.messages.map(m => m.id === action.id ? { ...m, status: "error", error: action.error } : m) };
    default:
      return state;
  }
}

let state = { messages: [] };
const dispatch = (a) => { state = reducer(state, a); };
dispatch({ type: "user_sent", id: "m1", text: "What is RAG?" });
for (const t of ["RAG ", "retrieves ", "documents ", "first."]) dispatch({ type: "token", id: "m1-a", text: t });
dispatch({ type: "done", id: "m1-a" });
console.log(state.messages.map(m => `${m.role} [${m.status}]: ${m.content}`).join("\n"));
```

### Message model

```ts norun
type Message = {
  id: string;                         // client-generated for optimistic UI, replaced by the server id
  role: "user" | "assistant" | "tool";
  content: string;
  status: "pending" | "streaming" | "done" | "error" | "stopped";
  sources?: { id: string; title: string; url?: string }[];
  attachments?: { name: string; type: string; size: number; url?: string }[];
  createdAt: string;
};
```

**Optimistic UI**: show the user's message immediately, and confirm it when the server acknowledges. **Immutable updates** (`...spread`, `map`) make rendering predictable and enable undo, regenerate and edit.

> [!recap]
> - Conversation = an array of message objects, and the UI renders from the state.
> - A reducer with actions: sent, token, done, error, stopped.
> - Optimistic updates + per-message status.

# Lesson: Streaming responses: SSE, WebSockets and fetch streams (35 min)

LLM answers take seconds. **Streaming** shows tokens as they're generated, so the time to first token feels like the response time.

### Server-Sent Events (SSE)

A one-way stream from server to client over plain HTTP: `Content-Type: text/event-stream`, with each event as `data: ...\n\n`. It's simple, works through proxies, and reconnects automatically. It's ideal for LLM output.

```python norun
# FastAPI: stream tokens as SSE
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    async def events():
        async for chunk in llm_gateway.stream(req.messages):          # yields text deltas
            yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'usage': llm_gateway.last_usage})}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

The browser's `EventSource` supports only GET. For a POST with a JSON body, read the stream with **fetch**:

```js norun
const controller = new AbortController();          // lets the user press "Stop"
const res = await fetch("/api/chat/stream", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ conversationId, message }), signal: controller.signal,
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const events = buffer.split("\n\n");
  buffer = events.pop();                            // keep the incomplete tail for the next chunk
  for (const ev of events) {
    if (!ev.startsWith("data: ")) continue;
    const msg = JSON.parse(ev.slice(6));
    if (msg.type === "token") dispatch({ type: "token", id: assistantId, text: msg.text });
    if (msg.type === "done") dispatch({ type: "done", id: assistantId });
  }
}
```

> [!warning] Chunks don't align with events
> A network chunk can contain half an event or several events. Always **buffer and split on the delimiter**, and keep the incomplete remainder (the exercise below tests exactly this).

### WebSockets

A **bidirectional** persistent connection. Use it when the server must push things *unprompted* (collaboration, live agent status, typing indicators) or when the client streams audio. It needs more infrastructure (sticky sessions, heartbeats, reconnect logic). For request → streamed-response chat, SSE or fetch streaming is usually simpler.

| | SSE / fetch stream | WebSocket |
|---|---|---|
| Direction | Server → client | Both ways |
| Protocol | Plain HTTP | Upgrade to ws:// / wss:// |
| Reconnect | Built into EventSource | You implement it |
| Best for | LLM token streams, progress | Real-time collaboration, voice, push |

### Stop and regenerate

**Stop**: abort the fetch (`controller.abort()`). The server should detect the disconnect and **cancel the upstream LLM call** to save tokens. **Regenerate**: re-send the same history and replace the last assistant message, optionally keeping the alternatives.

> [!recap]
> - SSE (`text/event-stream`, `data:` lines) for one-way token streams. WebSockets for two-way real-time.
> - Read fetch streams with a buffer: split on the event delimiter and keep the remainder.
> - Stop = abort plus server-side cancellation. Regenerate = replace the last answer.

# Lesson: Rendering markdown safely, and file uploads (25 min)

### Markdown rendering

Models answer in **markdown**: headings, lists, code blocks, tables. Render it with a library (`marked`, `markdown-it`, or `react-markdown`), and add:
- **Syntax highlighting** for code blocks, plus a **copy** button.
- **Incremental rendering** while streaming. Unclosed code fences mid-stream can break the layout, so many apps re-render the full markdown on each update (throttled with `requestAnimationFrame`).

> [!warning] Model output is untrusted HTML
> Markdown can contain raw HTML. A prompt-injected model (or a malicious document it quoted) could output `<img src=x onerror="steal()">`. **Sanitize** the rendered HTML (e.g. DOMPurify), or use a renderer that disallows raw HTML. Never use `innerHTML` with unsanitized model output. Open links with `rel="noopener noreferrer"`.

### File upload

```html norun
<input type="file" accept=".pdf,.txt,.md,.png,.jpg" multiple>
```

- **Validate on the client** (type, size) for UX, **and again on the server** for security.
- Upload with `FormData` (multipart) to your backend, or directly to object storage with a **pre-signed URL**.
- Show **progress**, allow **cancel**, and show chips for the attached files in the composer.
- On the server: scan or limit the size, store the file, **extract the text** (PDF parsing, OCR for images, or send images to a vision model), and connect it to the conversation (RAG over the attachments).

> [!recap]
> - Render markdown + highlighting. Throttle re-renders while streaming.
> - Sanitize all model-generated HTML.
> - Validate uploads on both sides, show progress, extract text on the server.

# Lesson: Loading, errors and conversation UX (25 min)

### States every message needs

| State | UI |
|---|---|
| Pending (before first token) | A "thinking" indicator; show the agent's steps if it uses tools ("Searching orders…") |
| Streaming | Text grows; a visible **Stop** button |
| Done | Copy, regenerate, 👍/👎 feedback, sources |
| Error | A clear message + **Retry**; keep the user's text so nothing is lost |
| Stopped | A "Stopped" label, with an option to continue |

### Error handling

- Map errors to human messages: 429 → "Busy, retrying…" (auto-retry with backoff), 5xx/timeout → "Something went wrong, retry", content-policy refusals → explain politely.
- **Never lose user input** on failure.
- Distinguish network loss (offline banner) from model errors.

### UX patterns that build trust

- **Sources and citations** for factual answers (RAG), with clickable links.
- **Suggested prompts** on the empty state, to teach users what the product does.
- **Editable user messages** (edit → re-run from that point) and conversation **branching**.
- **Feedback** buttons that store the rating along with the message metadata. This becomes eval data (week 11).
- **Accessibility**: announce streaming text to screen readers with `aria-live="polite"`, make everything keyboard-navigable, and respect reduced motion.
- **Conversation list**: auto-generated titles, search, rename, delete.

> [!recap]
> - Design the pending, streaming, done, error and stopped states explicitly.
> - Friendly error mapping, auto-retry for transient errors, never lose input.
> - Sources, feedback, edit/regenerate and accessibility.

# Quiz

## Why render the chat from a messages array (state) rather than editing the DOM directly?
- [ ] It's required by browsers
- [x] It makes the UI predictable and enables features like regenerate, edit and persistence
- [ ] DOM editing is impossible
- [ ] It reduces tokens
> Single source of truth: state → UI.

## Which transport is the simplest fit for streaming an LLM answer to the browser?
- [x] Server-Sent Events (or a fetch-readable stream)
- [ ] WebSockets are required
- [ ] Long polling every 5 seconds
- [ ] Email
> One-way, plain HTTP, proxy-friendly.

## A network chunk contains `data: {"a":1}\n\ndata: {"b"` . What should the client do?
- [ ] Parse both and fail
- [x] Process the complete first event, and keep the incomplete second part in a buffer for the next chunk
- [ ] Discard the chunk
- [ ] Reload the page
> Always buffer and split on the event delimiter.

## Why must model-generated markdown be sanitized?
- [ ] It's too long
- [x] It can contain HTML/JS that leads to XSS, especially via prompt injection
- [ ] Markdown is slow
- [ ] Browsers don't support markdown
> Treat model output as untrusted input.

## The user clicks "Stop" mid-answer. What should happen on the server?
- [ ] Nothing
- [x] Detect the disconnect or abort and cancel the upstream LLM call to stop spending tokens
- [ ] Restart the request
- [ ] Delete the conversation
> Propagate the cancellation end to end.

## A request fails with a 500 after the user typed a long message. Best UX?
- [ ] Clear the input box
- [x] Show a clear error with Retry, and keep the user's text
- [ ] Silently retry forever
- [ ] Show the stack trace
> Never lose user input. Bounded retries.

## When are WebSockets preferable to SSE?
- [ ] For any chat app
- [x] When you need bidirectional real-time messaging, like collaboration, live agent events or voice
- [ ] When the server is slow
- [ ] When you want simpler infrastructure
> SSE is simpler for one-way streams.

# Exercise: SSE stream parser

Write `createParser(onEvent)` that returns an object with a `push(chunk)` method. Chunks are arbitrary pieces of an SSE stream. Each complete event ends with `"\n\n"` and has one `data: <json>` line. For each complete event, call `onEvent(parsedJson)`. Keep incomplete data buffered between pushes. Ignore events whose line doesn't start with `data: `.

## Starter

```js
function createParser(onEvent) {
  let buffer = "";
  return {
    push(chunk) {
      // your code
    }
  };
}
```

## Tests

```js
const got = [];
const p = createParser(e => got.push(e));
p.push('data: {"type":"token","text":"He"}\n\ndata: {"type":"tok');
assert(got.length === 1 && got[0].text === "He", "first complete event parsed");
p.push('en","text":"llo"}\n');
assert(got.length === 1, "event not complete yet");
p.push('\n: comment line\n\ndata: {"type":"done"}\n\n');
assert(got.length === 3 && got[1].text === "llo" && got[2].type === "done", JSON.stringify(got));
console.log("parser ok");
```

## Solution

```js
function createParser(onEvent) {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      const parts = buffer.split("\n\n");
      buffer = parts.pop();                 // incomplete remainder
      for (const part of parts) {
        if (part.startsWith("data: ")) onEvent(JSON.parse(part.slice(6)));
      }
    }
  };
}
```

# Exercise: Build the chat UI (project-sized)

Build a single-page chat UI (plain JS, React or Vue) against a **mock streaming backend**: a local function that yields words with random delays. Requirements: an optimistic user message; streaming assistant text; a Stop button (AbortController-style cancellation of your mock); a Retry button on simulated errors (fail 20% of requests); safe markdown rendering with code highlighting and copy; `aria-live` on the message list; and a conversation list kept in localStorage.

## Hint

Write the mock backend as an async generator: `async function* fakeLLM(text, signal) { for (const w of words) { if (signal.aborted) return; await sleep(50); yield w + " "; } }`. Then wire it to your reducer exactly as you would the real SSE stream. Next week you'll swap in a real FastAPI backend.

# Sources

- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN: Streams API, consuming a fetch body as a stream](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
- [MDN: WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [FastAPI docs: StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [DOMPurify (HTML sanitizer)](https://github.com/cure53/DOMPurify)
- [React docs: Extracting state logic into a reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- [Vercel AI SDK: streaming UI concepts](https://ai-sdk.dev/docs/foundations/streaming)
