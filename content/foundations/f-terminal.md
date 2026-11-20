---
id: f-terminal
title: Terminal, Files & Git
week: Foundation 6
summary: How the shell works, navigating the file system, running programs, environment variables, and Git/GitHub for version control and collaboration.
leads_to: py-w1, py-x, do-w1, do-w3, do-w5
---

Every bootcamp assumes you can open a terminal, move around the file system, run programs and use Git. They're the daily tools of developers, data people and DevOps engineers alike. Commands are shown for **bash** (Linux/macOS, and Git Bash on Windows), with PowerShell equivalents where they differ.

# Lesson: The shell and the file system (25 min)

A **shell** is a program that reads commands you type and runs other programs. The **terminal** is the window it runs in. Common shells: `bash` and `zsh` (Linux/macOS), and PowerShell (Windows).

### Files live in a tree

The file system is a tree of **directories** (folders) holding files. A **path** names a location:

- **Absolute paths** start from the root: `/home/sara/projects/app` (Linux) or `C:\Users\Sara\projects` (Windows).
- **Relative paths** start from your **current working directory**: `projects/app`, `../data`.
- `.` means "this directory", `..` means "the parent directory", and `~` means your home directory.

```bash norun
pwd                 # print working directory
ls -la              # list files, including hidden ones (-a), with details (-l)
cd projects/app     # change directory (relative)
cd ..               # go up one level
cd ~                # go home
mkdir -p data/raw   # make directories (-p: create the parents too)
touch notes.txt     # create an empty file
cp notes.txt backup.txt
mv backup.txt data/ # move (also used to rename)
rm data/backup.txt  # delete: there is no recycle bin!
cat notes.txt       # print a file
less big.log        # page through a long file (q to quit)
```

> [!warning] `rm -rf` is forever
> The shell doesn't ask "are you sure?". `rm -rf somefolder` deletes everything inside, recursively. Double-check paths, especially ones that contain variables.

### Anatomy of a command

`command -options arguments`, for example `ls -l /var/log`. Use `man ls` or `ls --help` to read the manual. Press **Tab** to autocomplete names, and **↑** to recall earlier commands. Both save you hours.

> [!recap]
> - Absolute vs relative paths, `.`, `..` and `~`.
> - `pwd`, `ls`, `cd`, `mkdir`, `cp`, `mv`, `rm`, `cat`.
> - Tab completion and `--help` are your best friends.

# Lesson: Programs, pipes and environment variables (25 min)

### Running programs and scripts

```bash norun
python --version
python hello.py          # run a script
python -m venv .venv     # run a module as a program (Python week 3+)
./deploy.sh              # run an executable script in the current directory
```

How does the shell find `python`? It searches the directories listed in the **`PATH`** environment variable, in order. "Command not found" usually means the program isn't installed, or isn't on your PATH.

### Standard streams and redirection

Every program has three streams: **stdin** (input), **stdout** (normal output) and **stderr** (errors).

```bash norun
python report.py > out.txt      # stdout to a file (overwrite)
python report.py >> out.txt     # append
python report.py 2> errors.txt  # stderr to a file
python report.py < input.txt    # stdin from a file
```

### Pipes: small tools, combined

`|` feeds one program's stdout into the next program's stdin. This is the Unix philosophy: each tool does one thing well, and you compose them.

```bash norun
cat access.log | grep " 500 " | wc -l          # how many server errors?
cut -d',' -f3 sales.csv | sort | uniq -c | sort -rn | head   # top values of column 3
history | grep docker                           # find a command you ran before
```

### Environment variables

Key–value settings that a program inherits from its shell. They're used for configuration and **secrets** (API keys), so those never get hard-coded in source files.

```bash norun
export OPENAI_API_KEY="sk-..."     # bash: set for this session
echo $HOME $PATH
```

```python norun
import os
key = os.environ.get("OPENAI_API_KEY")   # read it in Python
```

PowerShell: `$env:OPENAI_API_KEY = "sk-..."`. Projects often keep a local `.env` file (git-ignored!) that a library loads at startup.

> [!connect] Where this goes
> Bash scripting and pipes are the core of DevOps week 3. Environment variables are how Docker, CI/CD and Kubernetes inject configuration and secrets (DevOps weeks 4–5 and 9, Full-Stack week 12). This is the **12-factor app** principle: keep config in the environment.

> [!recap]
> - `PATH` decides which programs the shell can find.
> - Redirect with `>`, `>>`, `2>` and `<`. Pipe with `|`.
> - Keep secrets in environment variables, never in code.

# Lesson: Git: version control from first principles (30 min)

**Git** records snapshots of your project over time. It lets you go back, see what changed and why, work on several ideas in parallel, and collaborate.

### The mental model: three areas

1. **Working directory**: the files you edit.
2. **Staging area (index)**: the changes you've chosen for the next snapshot.
3. **Repository**: the history of committed snapshots, called **commits**.

```bash norun
git init                      # start a repository
git status                    # what changed? (run it constantly)
git add app.py                # stage a file (git add . stages everything)
git commit -m "Add login form validation"
git log --oneline --graph     # history
git diff                      # unstaged changes; git diff --staged for staged ones
```

A **commit** is a snapshot plus metadata (author, time, message) and a pointer to its parent. Its ID is a hash, like `3f9a2c1`. Write messages that explain **why**: "Fix crash when cart is empty", not "update".

### Branches

A **branch** is a movable label pointing at a commit. You develop a feature on its own branch so `main` stays stable.

```bash norun
git switch -c feature/search   # create and switch to a new branch
# ...edit, add, commit...
git switch main
git merge feature/search       # bring the feature into main
```

If both branches changed the same lines, Git stops with a **merge conflict**. Edit the file to keep the right version, remove the `<<<<<<< ======= >>>>>>>` markers, then `git add` and `git commit`.

### `.gitignore`

List files Git should never track: `node_modules/`, `.venv/`, `__pycache__/`, `.env`, large datasets, build output.

> [!recap]
> - Working directory → (add) → staging → (commit) → history.
> - Commit small, focused changes with "why" messages.
> - Use a branch per feature, merge it back, and resolve conflicts by editing.

# Lesson: GitHub and team workflow (20 min)

**GitHub** hosts Git repositories online and adds collaboration features: pull requests, code review, issues and Actions (CI/CD).

```bash norun
git clone https://github.com/user/repo.git   # copy a remote repository
git remote -v                                # where is 'origin'?
git pull                                     # fetch + merge others' changes
git push -u origin feature/search            # publish your branch
```

### The pull-request workflow

1. Create a branch for your change.
2. Commit and push it.
3. Open a **pull request (PR)** on GitHub that describes what changed and why.
4. Teammates review it, and automated checks (tests, linting) run in **GitHub Actions**.
5. When the PR is approved and green, **merge** it into `main`.

> [!tip] Authentication
> GitHub doesn't accept account passwords for `git push`. Use the **GitHub CLI** (`gh auth login`), an **SSH key**, or a personal access token. SSH keys are covered in DevOps week 2.

> [!connect] You'll use this to ship this very app
> The README of this app walks you through pushing it to GitHub, where **GitHub Actions** builds the website and your Android APK. That's a real CI/CD pipeline, the topic of DevOps week 5.

> [!recap]
> - `clone`, `pull`, `push`. `origin` is the remote.
> - Branch → PR → review + CI → merge.

# Quiz

## You are in `/home/sara/app/src`. Where does `cd ../data` take you?
- [ ] /home/sara/app/src/data
- [x] /home/sara/app/data
- [ ] /data
- [ ] /home/sara/data
> `..` goes up one level to `/home/sara/app`, then down into `data`.

## What does `cat log.txt | grep ERROR | wc -l` print?
- [ ] All lines of log.txt
- [ ] The word ERROR
- [x] The number of lines containing "ERROR"
- [ ] The number of words in the file
> A pipe chains the programs: print the file → keep the matching lines → count the lines.

## Why store API keys in environment variables instead of source code?
- [ ] Environment variables are encrypted
- [x] So secrets aren't committed to Git and can differ per environment
- [ ] Python can't read strings from files
- [ ] It makes the program faster
> Code gets shared and versioned. Config and secrets belong in the environment (the 12-factor principle).

## In Git, what does `git add` do?
- [ ] Creates a commit
- [x] Moves changes into the staging area for the next commit
- [ ] Uploads changes to GitHub
- [ ] Creates a new branch
> Staging lets you choose exactly what goes into the next commit.

## What is a Git branch?
- [ ] A full copy of the project folder
- [x] A movable pointer to a commit
- [ ] A backup on GitHub
- [ ] A tag that never moves
> Branches are lightweight labels, which is why creating them is instant.

## Which file tells Git to never track `.env` and `node_modules/`?
- [ ] .gitconfig
- [x] .gitignore
- [ ] .env
- [ ] README.md
> Patterns listed in `.gitignore` are ignored by `git status` and `git add`.

## A teammate's PR shows failing checks. What does that usually mean?
- [ ] GitHub is down
- [x] The automated CI pipeline (tests or lint) failed on the PR's code
- [ ] The branch was deleted
- [ ] There are too many commits
> PR checks are CI jobs, usually GitHub Actions. Fix the code until they pass before merging.

# Exercise: Practise in a real terminal

This exercise happens on your computer, not in the app. Tick it off when you're done.

1. Open a terminal (Git Bash or PowerShell on Windows, Terminal on macOS).
2. Create the directory `~/learning/terminal-practice` and `cd` into it.
3. Create `notes.md` containing one line (`echo "# Notes" > notes.md`).
4. Run `git init`, `git add .` and `git commit -m "Start notes"`.
5. Create a branch `idea`, add a second line to `notes.md`, and commit it.
6. Switch back to `main`, change the *same* line differently, commit, then `git merge idea`. Resolve the conflict you created on purpose.
7. Run `git log --oneline --graph --all` and explain each line of the output to yourself.

## Hint

To append a line: `echo "second line" >> notes.md`. If you get stuck mid-merge, `git status` tells you what Git expects next. `git merge --abort` returns you to the state before the merge.

## Solution

```bash norun
mkdir -p ~/learning/terminal-practice && cd ~/learning/terminal-practice
echo "# Notes" > notes.md
git init && git add . && git commit -m "Start notes"
git switch -c idea
echo "Idea: learn pipes" >> notes.md && git commit -am "Add idea"
git switch main
echo "Plan: learn git" >> notes.md && git commit -am "Add plan"
git merge idea          # CONFLICT -> open notes.md, keep both lines, delete markers
git add notes.md && git commit -m "Merge idea"
git log --oneline --graph --all
```

# Sources

- [The Missing Semester of Your CS Education (MIT): Shell, Scripting, Version Control](https://missing.csail.mit.edu/)
- [Pro Git book (free, official)](https://git-scm.com/book/en/v2)
- [GitHub Docs: Hello World and the GitHub flow](https://docs.github.com/en/get-started/start-your-journey/hello-world)
- [Learn Git Branching (interactive visual tutorial)](https://learngitbranching.js.org/)
- [The Twelve-Factor App: Config](https://12factor.net/config)
