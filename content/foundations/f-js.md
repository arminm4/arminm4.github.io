---
id: f-js
title: JavaScript Essentials
week: Foundation 8
summary: Modern JavaScript for Python developers: values, functions, arrays and objects, async/await and fetch, the DOM, modules and a taste of TypeScript.
builds_on: f-web, py-w3
leads_to: fs-w2
---

The Full-Stack bootcamp expects "basic familiarity with Python and JavaScript": JavaScript runs your chat UI in the browser. This module teaches modern JavaScript (ES2020+) by comparing it with the Python you already know. Every JavaScript block runs right here, and `console.log` output appears below it.

# Lesson: Values, variables and equality (20 min)

```js
const name = "Sara";       // can't be reassigned (prefer const)
let count = 0;             // can be reassigned
count += 1;
console.log(typeof name, typeof count, typeof true, typeof undefined, typeof null);
```

- Use `const` by default and `let` when you must reassign. Avoid the old `var`.
- JavaScript has **one** number type (64-bit float, like Python's `float`), plus `BigInt` for huge integers.
- There are two "empty" values: `undefined` (never assigned) and `null` (deliberately empty).

### Template literals ≈ f-strings

```js
const price = 19.5, qty = 3;
console.log(`Total: ${(price * qty).toFixed(2)}`);
```

### Equality: always use `===`

`==` converts types before comparing, with surprising results. `===` compares without conversion.

```js
console.log(0 == "", "1" == 1, null == undefined);   // true true true 😬
console.log(0 === "", "1" === 1, null === undefined); // false false false
```

### Truthiness: slightly different from Python

Falsy values: `false, 0, "", null, undefined, NaN`. But **empty arrays and objects are truthy** in JavaScript (in Python they're falsy).

```js
console.log(Boolean([]), Boolean({}), Boolean(""));
const user = null;
console.log(user?.name ?? "anonymous");   // optional chaining + nullish coalescing
```

`a?.b` safely returns `undefined` if `a` is null or undefined. `x ?? y` gives `y` only when `x` is null or undefined. Unlike `||`, it keeps `0` and `""`.

> [!recap]
> - `const`/`let`, template literals, and `===` always.
> - `[]` and `{}` are truthy in JavaScript.
> - `?.` and `??` handle missing data safely.

# Lesson: Functions, arrays and objects (30 min)

### Functions

```js
function add(a, b) { return a + b; }
const mul = (a, b) => a * b;           // arrow function
const greet = (name = "friend") => `Hi ${name}`;
console.log(add(2, 3), mul(2, 3), greet(), greet("Ali"));
```

Functions are values: you can pass them around, just like Python's `lambda` and `def`.

### Arrays ≈ Python lists

```js
const nums = [5, 3, 8, 1];
nums.push(10);                                   // append
console.log(nums.length, nums[0], nums.at(-1));  // at(-1) like Python [-1]
const doubled = nums.map(n => n * 2);            // like [n*2 for n in nums]
const big = nums.filter(n => n > 4);             // like [n for n in nums if n > 4]
const total = nums.reduce((acc, n) => acc + n, 0); // like sum(nums)
console.log(doubled, big, total);
console.log([...nums].sort((a, b) => a - b));    // numeric sort needs a comparator!
```

> [!mistake] `[10, 9, 1].sort()` gives `[1, 10, 9]`
> By default `sort` compares values **as strings**. For numbers, always pass `(a, b) => a - b`. Also note that `sort` mutates the array in place. Copy it first with `[...arr]`, or use `toSorted()`.

### Objects ≈ Python dicts

```js
const order = { id: 7, items: ["pen", "book"], paid: false };
order.paid = true;                           // const binding, mutable object
console.log(order.id, order["items"].length);
const { id, items } = order;                 // destructuring (unpacking)
const updated = { ...order, status: "shipped" };  // spread: copy + override
console.log(id, items, updated);
console.log(Object.keys(order), Object.entries(order).length);
console.log(JSON.stringify(updated));
```

### Classes

```js
class Counter {
  #value = 0;                          // private field
  increment(by = 1) { this.#value += by; return this; }
  get value() { return this.#value; }
}
const c = new Counter().increment().increment(5);
console.log(c.value);
```

> [!recap]
> - Arrow functions; `map`/`filter`/`reduce` are the comprehensions of JavaScript.
> - Sort numbers with a comparator.
> - Objects work like dicts: destructuring and `...spread` copy and merge them.

# Lesson: Asynchronous JavaScript: promises, async/await and fetch (30 min)

JavaScript in the browser runs on **one thread** with an **event loop**. Slow operations (network, timers) don't block. They complete later, and their callbacks run when the thread is free. That's why the UI stays responsive while a chat response streams in.

```js
console.log("1: start");
setTimeout(() => console.log("3: timer fired"), 0);
console.log("2: end of script");
await new Promise(r => setTimeout(r, 10));
```

Even a 0 ms timer runs **after** the current code finishes.

### Promises and async/await

A **Promise** represents a value that will be available later (or an error). `async`/`await` lets you write asynchronous code that reads like synchronous code:

```js
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchUser(id) {
  await wait(100);                       // pretend network call
  if (id < 0) throw new Error("invalid id");
  return { id, name: "User " + id };
}

const u = await fetchUser(1);
console.log(u.name);

// run requests in parallel, not one after another:
const t0 = Date.now();
const users = await Promise.all([fetchUser(2), fetchUser(3), fetchUser(4)]);
console.log(users.map(x => x.name), `took ~${Date.now() - t0} ms, not 300`);

try { await fetchUser(-1); } catch (e) { console.log("caught:", e.message); }
```

### fetch: HTTP from JavaScript

```js norun
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Hello" }),
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch does NOT throw on 4xx/5xx!
const data = await res.json();
```

> [!warning] `fetch` only rejects on network failure
> A 404 or 500 still **resolves** successfully. Always check `res.ok` or `res.status`. This trips up almost everyone at first.

> [!connect] Streaming in Full-Stack week 2
> LLM responses are streamed token by token. In JavaScript you read `res.body` with a reader in an `async` loop, or use `EventSource` for Server-Sent Events, and append each chunk to the UI as it arrives.

> [!recap]
> - One thread plus an event loop: async work finishes later.
> - `async`/`await` with `try/catch`, and `Promise.all` for parallel work.
> - `fetch` doesn't throw on HTTP errors, so check `res.ok`.

# Lesson: The DOM, modules and a taste of TypeScript (25 min)

### The DOM

The browser turns HTML into a tree of objects, the **Document Object Model (DOM)**. JavaScript reads and changes that tree to update the page:

```js norun
const list = document.querySelector("#messages");
const li = document.createElement("li");
li.textContent = "Hello!";          // textContent is safe; avoid innerHTML with user data (XSS!)
list.append(li);
document.querySelector("#send").addEventListener("click", () => { /* ... */ });
```

> [!warning] XSS
> Never put untrusted text into `innerHTML`. That includes LLM output: a model can be tricked into emitting `<script>` or `<img onerror=...>`. Render markdown with a sanitizer (Full-Stack week 2).

### Modules

Split code into files with `export` and `import`:

```js norun
// api.js
export async function sendMessage(text) { /* ... */ }
// main.js
import { sendMessage } from "./api.js";
```

Packages come from **npm** (`npm install marked`). A **bundler** such as Vite builds them for the browser. Frameworks like **React** organize a UI into components whose state drives what is rendered.

### TypeScript in one minute

TypeScript is JavaScript plus **static types**, checked before the code runs. Most professional frontends use it:

```ts norun
type Message = { role: "user" | "assistant"; content: string; createdAt: Date };

function lastUserMessage(msgs: Message[]): Message | undefined {
  return msgs.findLast(m => m.role === "user");
}
```

The compiler catches typos and wrong shapes, like Pydantic models in Python (Full-Stack week 3), but at build time.

> [!recap]
> - The DOM is the page as objects. Use `textContent` for untrusted text.
> - `import`/`export` modules, npm packages and bundlers.
> - TypeScript adds compile-time types.

# Quiz

## What does `[] ? "yes" : "no"` evaluate to in JavaScript?
- [x] "yes"
- [ ] "no"
- [ ] an error
- [ ] undefined
> Empty arrays and objects are truthy in JavaScript, unlike in Python.

## Which comparison should you use by default?
- [ ] `==`
- [x] `===`
- [ ] `=`
- [ ] `equals()`
> `===` compares without type coercion. `=` is assignment.

## What does `[10, 9, 1].sort()` return?
- [ ] [1, 9, 10]
- [x] [1, 10, 9]
- [ ] [10, 9, 1]
- [ ] an error
> Default sort compares strings: "1" < "10" < "9". Pass `(a, b) => a - b`.

## `const user = { name: "Ali" }; user.name = "Sara";` What happens?
- [ ] TypeError: assignment to constant
- [x] It works; `const` prevents rebinding the name, not mutating the object
- [ ] It creates a copy
- [ ] Nothing changes
> The binding `user` can't point to another object, but the object itself is mutable.

## What is printed first?
```js norun
setTimeout(() => console.log("A"), 0);
console.log("B");
```
- [ ] A
- [x] B
- [ ] They are printed at the same time
- [ ] Nothing
> The timer callback is queued and runs after the current code finishes.

## `await fetch(url)` returns a 500 response. What happens?
- [ ] fetch throws an error
- [x] The promise resolves; `res.ok` is false and you must check it
- [ ] The browser retries automatically
- [ ] The promise never resolves
> fetch only rejects on network failure. HTTP errors are normal responses.

## Why use `Promise.all([a(), b(), c()])`?
- [ ] To run the functions one after another
- [x] To start them concurrently and wait for all of them
- [ ] To ignore errors
- [ ] To convert callbacks to promises
> The total time is roughly the slowest call, not the sum of all three.

## Why is `el.innerHTML = llmOutput` dangerous?
- [ ] It's slow
- [x] Untrusted HTML can execute scripts (XSS)
- [ ] It can't render text
- [ ] It's deprecated
> Treat model output like any other user input: sanitize it, or use `textContent`.

# Exercise: Shopping-cart helpers

Implement three functions:

- `cartTotal(items)`: `items` is an array of `{price, qty}` objects. Return the total rounded to 2 decimals.
- `groupBy(arr, keyFn)`: return an object mapping each key to an array of the items that have it.
- `topN(arr, n, keyFn)`: return a **new** array of the `n` items with the largest `keyFn(item)`, largest first, **without** mutating `arr`.

## Starter

```js
function cartTotal(items) {
}

function groupBy(arr, keyFn) {
}

function topN(arr, n, keyFn) {
}

console.log(cartTotal([{price: 9.99, qty: 3}, {price: 0.5, qty: 1}]));
```

## Tests

```js
assert(cartTotal([{price: 9.99, qty: 3}, {price: 0.5, qty: 1}]) === 30.47, "cartTotal");
assert(cartTotal([]) === 0, "empty cart");
const g = groupBy([1, 2, 3, 4, 5], n => n % 2 ? "odd" : "even");
assert(JSON.stringify(g.odd) === "[1,3,5]" && JSON.stringify(g.even) === "[2,4]", "groupBy");
const arr = [{s: 3}, {s: 9}, {s: 1}, {s: 7}];
const top = topN(arr, 2, x => x.s);
assert(top.length === 2 && top[0].s === 9 && top[1].s === 7, "topN order");
assert(arr[0].s === 3, "topN must not mutate the input");
console.log("all good");
```

## Hint

`cartTotal`: `reduce`, then `Math.round(x * 100) / 100`. `groupBy`: start from `{}` and use `(acc[k] ??= []).push(item)`. `topN`: `[...arr].sort((a, b) => keyFn(b) - keyFn(a)).slice(0, n)`.

## Solution

```js
function cartTotal(items) {
  const t = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  return Math.round(t * 100) / 100;
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}

function topN(arr, n, keyFn) {
  return [...arr].sort((a, b) => keyFn(b) - keyFn(a)).slice(0, n);
}
```

# Sources

- [MDN: JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [javascript.info: The Modern JavaScript Tutorial](https://javascript.info/)
- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: The event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [OWASP: Cross-Site Scripting (XSS)](https://owasp.org/www-community/attacks/xss/)
