# Armo Learn: six bootcamps in one study app

An offline-first study app (PWA for iPad, Android APK via a Trusted Web Activity) covering the six Quera bootcamps, **Python, Business Intelligence, Artificial Intelligence, Agentic AI, Full-Stack AI Engineering and DevOps**, plus a **Foundations** track for the prerequisites (algebra, linear algebra, calculus, probability, statistics, terminal & Git, web & HTTP, JavaScript, NumPy/pandas).

| | |
|---|---|
| Modules | 65 (one per bootcamp week, following each bootcamp's official syllabus, plus project weeks) |
| Lessons | 211 (about 70,000 words), with diagrams, formulas, "how this connects" notes and sources |
| Quiz questions | 412, with explanations, plus a spaced-repetition **Review** mode |
| Exercises | 85, of which 72 are **auto-checked** in the app (Python, SQL, JavaScript) |
| Projects | 11 portfolio projects with milestones and rubrics |
| Runnable code | Python (with numpy, pandas, scikit-learn), SQLite and JavaScript run **inside the app** |

Progress (completed lessons, quiz scores, exercises, project milestones, notes, bookmarks, streak) is saved on the device, and can be exported and imported to move it between your iPad and your phone. There is no server.

---

## 1. Run it on your computer (optional)

You need **Node.js 18+** (you have it).

```bash
npm install          # downloads Pyodide (Python) and sql.js (SQLite)
npm start            # copies the runtimes into ./vendor and serves http://localhost:5173
```

Open <http://localhost:5173>. Other useful commands:

```bash
npm run check        # validates every lesson/quiz and runs every exercise solution against its tests
npm run art          # regenerates the artwork and all icons (scripts/art.mjs)
```

---

## 2. Publish the app on GitHub Pages (free)

The app is a static website. GitHub hosts it for free and builds it for you with **GitHub Actions** (`.github/workflows/pages.yml`).

1. **Create a GitHub account** at <https://github.com> if you don't have one.
2. **Create a new public repository** named exactly **`<your-username>.github.io`**, for example `armin.github.io`.
   - This name gives you the address `https://<your-username>.github.io/`. The Android app needs the site at the *root* of the domain to run full-screen (see section 4).
   - Don't add a README or .gitignore on GitHub, because the project already has them.
3. **Push this folder** to the repository. In a terminal opened in this folder:

   ```bash
   git init -b main
   git add .
   git commit -m "Armo Learn: initial version"
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```

   Git for Windows opens a browser window to sign in to GitHub the first time.
4. **Turn on Pages**: in the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
5. Open the **Actions** tab. The **Deploy app to GitHub Pages** workflow runs automatically (re-run it if it started before you enabled Pages). It validates all content, builds the site and deploys it in about 3–5 minutes.
6. Visit `https://<your-username>.github.io/`. Your app is live.

> Every time you push to `main`, the site redeploys. Installed apps pick up new content the next time they're opened.

---

## 3. Install on your iPad (PWA)

1. Open your site in **Safari** on the iPad.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Launch **Armo Learn** from the home screen. It opens full-screen like a native app.
4. **Offline use**: open the app once while online, and it caches every lesson. The Python runtime (~10 MB) downloads the first time you press ▶ Run on Python code. numpy, pandas and scikit-learn (~100 MB in total) download the first time a lesson imports them. After that, they work offline too.

---

## 4. Build and install the Android app (APK)

The Android app is a **Trusted Web Activity (TWA)**: a small native wrapper that opens your PWA full-screen using Chrome. It's built by `.github/workflows/android.yml`, and the Gradle project lives in `android/`.

### 4.1 Create your permanent signing key (once)

Android apps must be signed. Keep using the **same key** forever, or the app can't be updated in place.

In **PowerShell**, in this folder (you already have Java 17, which provides `keytool`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-signing-key.ps1
```

This creates (inside the git-ignored `signing\` folder):
- `armo-learn-release.jks`: your key. **Back it up** somewhere safe, such as a password manager or a private cloud folder.
- `github-secrets.txt`: the values for the next step.
- `ANDROID_KEYSTORE_BASE64.txt`: the key, encoded as text.

(macOS/Linux: `bash scripts/create-signing-key.sh`.)

### 4.2 Add the key to GitHub as secrets

In your repository: **Settings → Secrets and variables → Actions → New repository secret**. Create these 4 secrets (the values are in `signing\github-secrets.txt`):

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the entire content of `signing\ANDROID_KEYSTORE_BASE64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the password from `github-secrets.txt` |
| `ANDROID_KEY_PASSWORD` | the same password |
| `ANDROID_KEY_ALIAS` | `armolearn` |

### 4.3 Publish the Digital Asset Links file

Go to **Actions → Deploy app to GitHub Pages → Run workflow**. With the secrets present, the workflow now also publishes `https://<your-username>.github.io/.well-known/assetlinks.json`, which proves to Android that the app and the website belong together. Without it, the app still works but shows a small URL bar at the top.

### 4.4 Build the APK

Go to **Actions → Build Android APK → Run workflow**. In about 5 minutes you get:
- a **GitHub Release** named `Armo Learn Android 1.0.N`, containing `ArmoLearn-1.0.N.apk` (easiest to download on your phone: open `https://github.com/<your-username>/<your-username>.github.io/releases`)
- the same APK as a workflow **artifact** (a zip) on the run's page.

The workflow automatically uses your site address. To point the app somewhere else, add a repository **variable** (Settings → Secrets and variables → Actions → *Variables*) named `PWA_URL`, e.g. `https://example.com/`.

### 4.5 Install it on Android

1. On the phone, open the Releases page and download the `.apk`.
2. Tap the downloaded file. If Android asks, allow **Install unknown apps** for your browser or Files app.
3. Open **Armo Learn**. Make sure **Google Chrome** is installed and up to date, because the TWA uses it.
4. If you see a URL bar at the top, the Digital Asset Links check failed: see Troubleshooting.

Updating: run the workflow again and install the new APK over the old one. Your progress is stored by Chrome for your site, so it survives app updates and reinstalls (it's shared with the site when opened in Chrome).

---

## 5. Move progress between iPad and phone

There's no server, so each device keeps its own progress. To sync: **Progress → Backup & sync → Export backup file** (or **Copy backup as text**) on one device, then **Import** on the other and choose **Merge**. Merging keeps the best of both: all completed items, the best quiz scores and the longest notes. Export a backup now and then anyway, as insurance.

---

## 6. How the app is organized

```
index.html, css/, js/          the app (vanilla JS, no build step)
  js/app.js                    routing, views, quizzes, review, exercises, progress UI
  js/md.js                     Markdown + math (TeX subset) + syntax highlighting
  js/parser.js                 turns a module .md file into lessons/quiz/exercises/projects
  js/store.js                  progress storage, export/import/merge
  js/runners.js, py-worker.js  Python (Pyodide in a Web Worker), SQL (sql.js), JS runners
content/catalog.js             course list, descriptions, prerequisites, module order
content/<course>/*.md          ONE FILE PER MODULE (week): all lessons, quiz, exercises, project
content/data/shop.sql          the sample database used by the BI/SQL lessons
content/roadmap.md             learning path and how the bootcamps connect
assets/art/*.svg               bootcamp artwork (generated by scripts/art.mjs)
sw.js, manifest.webmanifest    offline support and installability (PWA)
android/                       the TWA Android project (Gradle)
.github/workflows/             pages.yml (website), android.yml (APK)
scripts/                       dev server, vendoring, validation, art, signing key
```

### Writing or editing lessons

Each module file looks like this (see any file in `content/` for full examples):

````markdown
---
id: py-w2
title: Data Structures & Flow Control
week: Week 2
summary: One line shown on the course page.
builds_on: py-w1            # module ids → "Builds on" chips
leads_to: py-w3
---

Intro text for the module page.

# Lesson: While loops (20 min)
Markdown with `code`, **bold**, tables, $math$, $$display math$$ and callouts:
> [!tip] Title
> Body.            (types: note, tip, warning, important, connect, example, intuition, recap, mistake)

```python stdin="5"
n = int(input())     # every python/sql/js block gets a ▶ Run button ("norun" disables it)
```

# Quiz
## Question text?
- [ ] wrong option
- [x] right option (several [x] = "select all that apply")
> Explanation shown after answering.

# Exercise: Title
Prompt…
## Starter
```python
# code shown in the editor
```
## Tests
```python
assert run_program(["3"]).strip() == "9"   # or: ns = load(); assert ns["f"](2) == 4
```
## Hint
…
## Solution
…

# Project: Title
Brief…
## Milestones
- [ ] step one
- [ ] step two

# Sources
- [Link](https://…)
````

Run `npm run check` after editing. It verifies the structure, and that every exercise solution passes its tests (SQL exercises compare your query's result with the reference query in `## Tests`). To add a module, create the file and list it in `content/catalog.js`. To force installed apps to update immediately, bump `APP_VERSION` in `content/catalog.js`.

### Artwork

The bootcamp tiles use **original origami-style artwork** in the same style and colours as the cards on quera.org (eagle, octopus, snake, bird, dolphin, wolf, plus a turtle for Foundations). I drew them instead of copying Quera's image files, because the app is published on a public website. To use other images, replace the files in `assets/art/` (or change the `art` paths in `content/catalog.js`), and change the icons via `scripts/art.mjs`.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Pages workflow fails at "Validate lessons…" | Open the log: it names the module and exercise. Fix it, commit and push. |
| Site shows 404 | Settings → Pages → Source must be **GitHub Actions**; wait for the deploy job to finish. |
| Android app shows a URL bar | Open `https://<you>.github.io/.well-known/assetlinks.json`: it must exist and contain your key's SHA-256 (the APK build summary shows the fingerprint it used). Re-run the Pages workflow after adding the secrets. The repo must be named `<you>.github.io`. Then clear Chrome's data for the site, or reinstall the app. |
| APK build summary says "temporary key" | The 4 `ANDROID_*` secrets are missing or misnamed (section 4.2). |
| "App not installed" when updating | The new APK was signed with a different key: uninstall the old app first (progress is kept by Chrome). |
| Python "could not load" | The first run needs internet to download the runtime; try again online. |
| Old content after an update | Close and reopen the app (it updates in the background), or Progress → Check for updates. |

### If you use a different repository name

GitHub serves a repository named `my-app` at `https://<you>.github.io/my-app/`. The app works there (and on iPad), and the APK opens it, but Android looks for `assetlinks.json` at the **domain root**. To get full-screen, also create the repository `<you>.github.io` containing the file `.well-known/assetlinks.json` (copy it from `https://<you>.github.io/my-app/.well-known/assetlinks.json`) plus an empty `.nojekyll` file, and enable Pages on it.

---

## Credits and licenses

- In-browser runtimes: [Pyodide](https://pyodide.org) (MPL-2.0), [sql.js](https://sql.js.org) (MIT), numpy/pandas/scikit-learn/scipy (BSD), all served from your own site.
- Android wrapper: [android-browser-helper](https://github.com/GoogleChrome/android-browser-helper) (Apache-2.0).
- Course structure follows the public syllabi at quera.org/bootcamp. The lesson text, exercises and projects are original study material written for this app, and each module lists authoritative sources for further reading.
