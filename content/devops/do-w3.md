---
id: do-w3
title: Scripting & Application Operations
week: Week 3
summary: Bash scripting (variables, conditions, loops, functions, exit codes, environment), deployment scripts, Git release workflows and tags, dependencies and config, systemd services, cron jobs, and database backup and restore.
builds_on: do-w2, f-terminal
leads_to: do-w4, do-w5
---

Before containers and orchestration, there's the fundamental skill of **automating operations with scripts** and running applications as proper services. These skills never go away: CI pipelines run shell, containers start with entrypoint scripts, and every incident involves `systemctl` and logs.

# Lesson: Bash scripting essentials (35 min)

```bash norun
#!/usr/bin/env bash
set -euo pipefail          # exit on error (-e), error on unset vars (-u), fail pipelines (-o pipefail)
IFS=$'\n\t'                # safer word splitting

APP_NAME="studymate"                       # variables: no spaces around =
RELEASE_DIR="/srv/${APP_NAME}/releases"
VERSION="${1:-}"                           # first argument, default empty

if [[ -z "$VERSION" ]]; then               # [[ ]] tests: -z empty, -n non-empty, -f file, -d dir
  echo "usage: $0 <version>" >&2           # errors go to stderr
  exit 2
fi

for dir in "$RELEASE_DIR"/*; do            # loops over globs; always quote "$vars"
  echo "found release: $(basename "$dir")" # command substitution $(...)
done

count=0
while read -r line; do                     # read a file line by line
  ((count++)) || true
done < /etc/hosts
echo "hosts entries: $count"
```

### Functions and exit codes

Every command returns an **exit code**: 0 = success, non-zero = failure. `$?` holds the last one. `&&` runs the next command only on success, and `||` only on failure.

```bash norun
log() { echo "[$(date -Is)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

check_health() {
  local url="$1" tries="${2:-10}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS "$url" > /dev/null; then return 0; fi
    log "health check $i/$tries failed; retrying in 3s"
    sleep 3
  done
  return 1
}

check_health "http://127.0.0.1:8000/health" 5 || die "app did not become healthy"
```

### Environment variables

`export VAR=value` makes a variable visible to child processes. Scripts read config from the environment (`${DATABASE_URL:?DATABASE_URL is required}` fails fast if it's missing). Load a `.env` file with `set -a; source .env; set +a` (local development only).

> [!warning] Quoting matters
> `rm -rf $DIR/` with `DIR` empty becomes `rm -rf /`. Always quote (`"$DIR"`), use `set -u`, and validate inputs. Check your scripts with **ShellCheck**, which catches most bash pitfalls automatically.

> [!recap]
> - `set -euo pipefail`. Quote variables. `[[ ]]` tests, loops, `$(...)`.
> - Functions with `local`. Exit codes, `&&`/`||`, `return`/`exit`.
> - Config from the environment, with `${VAR:?msg}` for required values. Lint with ShellCheck.

# Lesson: Releases, deployment scripts and configuration (30 min)

### A Git release workflow

- **Trunk-based development**: short-lived feature branches merged into `main` frequently, with CI on every PR.
- **Release tags**: `git tag -a v1.4.0 -m "Release 1.4.0" && git push origin v1.4.0`. Tags mark exactly what was deployed.
- **Semantic versioning**: `MAJOR.MINOR.PATCH`. MAJOR for breaking changes, MINOR for features, PATCH for fixes.
- Changelogs come from conventional commit messages (`feat:`, `fix:`).

### A classic "releases + symlink" deploy

```bash norun
#!/usr/bin/env bash
set -euo pipefail
VERSION="$1"; BASE=/srv/studymate; NEW="$BASE/releases/$VERSION"
git clone --depth 1 --branch "$VERSION" https://github.com/me/studymate.git "$NEW"
python3 -m venv "$NEW/.venv" && "$NEW/.venv/bin/pip" install -r "$NEW/requirements.txt"
ln -sfn "$BASE/shared/.env" "$NEW/.env"                  # config/secrets live outside releases
"$NEW/.venv/bin/alembic" -c "$NEW/alembic.ini" upgrade head
ln -sfn "$NEW" "$BASE/current"                           # atomic switch
sudo systemctl restart studymate
check_health http://127.0.0.1:8000/health 10 || { echo "rollback"; ln -sfn "$(ls -dt $BASE/releases/* | sed -n 2p)" "$BASE/current"; sudo systemctl restart studymate; exit 1; }
ls -dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf   # keep the last 5 releases
```

Key ideas: **immutable releases**, **config outside the release**, **atomic switch**, **health check**, **automatic rollback** and **retention**. Containers and Kubernetes formalize these same ideas (weeks 4 and 10).

### Dependencies and configuration

- **Pin** your dependencies (lock files) for reproducible builds.
- Config hierarchy: defaults in code → config files → **environment variables** (highest priority). Secrets only via the environment or a secret manager.
- Separate config per environment (dev/staging/prod), never separate code.

> [!recap]
> - Trunk-based development, semver tags, conventional commits.
> - Immutable releases + an atomic symlink switch + a health check + rollback + retention.
> - Pinned dependencies. Config from the environment, outside the release.

# Lesson: systemd services and cron jobs (30 min)

### systemd: running an app as a service

```ini
# /etc/systemd/system/studymate.service
[Unit]
Description=StudyMate API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=deploy
WorkingDirectory=/srv/studymate/current
EnvironmentFile=/srv/studymate/shared/.env
ExecStart=/srv/studymate/current/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=3
TimeoutStopSec=30            # SIGTERM, wait 30s, then SIGKILL (graceful shutdown window)
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/studymate/shared

[Install]
WantedBy=multi-user.target
```

```bash norun
sudo systemctl daemon-reload            # after editing unit files
sudo systemctl enable --now studymate   # start now and at boot
systemctl status studymate
journalctl -u studymate -f              # follow the logs
sudo systemctl restart studymate
```

`Restart=on-failure` gives you automatic recovery. The hardening options (`NoNewPrivileges`, `ProtectSystem`) implement least privilege.

### cron and systemd timers

```text
# crontab -e        ┌ minute (0-59)
#                   │ ┌ hour (0-23)
#                   │ │ ┌ day of month (1-31)
#                   │ │ │ ┌ month (1-12)
#                   │ │ │ │ ┌ day of week (0-6, Sun=0)
#                   * * * * *  command
30 2 * * *    /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1   # daily at 02:30
*/5 * * * *   /usr/local/bin/check-disk.sh                              # every 5 minutes
0 9 * * 1     /usr/local/bin/weekly-report.sh                           # Mondays 09:00
```

Cron jobs run with a **minimal environment** (use absolute paths, set PATH), and their output is lost unless you redirect it. **systemd timers** are a modern alternative with logging in the journal and missed-run catch-up (`Persistent=true`). Make scheduled jobs **idempotent** and **alert when they fail**. Silent failure is the classic backup disaster.

> [!recap]
> - Unit files: User, EnvironmentFile, ExecStart, Restart, TimeoutStopSec, hardening.
> - `systemctl enable --now`, `status`, `journalctl -u`.
> - Cron syntax; absolute paths, redirect the output, idempotent jobs, alert on failure. Timers as an alternative.

# Lesson: Database backup and restore (25 min)

> [!important] A backup you haven't restored is not a backup
> Teams routinely discover that their backups are empty, corrupted or missing a table, during the outage. Schedule regular **restore tests**.

### PostgreSQL

```bash norun
# Logical backup (portable, per database)
pg_dump -Fc -d "$DATABASE_URL" -f /backups/app-$(date +%F).dump    # custom format, compressed
pg_restore --clean --if-exists -d "$RESTORE_DATABASE_URL" /backups/app-2025-11-20.dump

# Physical/continuous: base backups + WAL archiving enable point-in-time recovery (PITR)
#   tools: pgBackRest, WAL-G, or managed cloud databases with automated PITR
```

### MySQL

`mysqldump --single-transaction --routines db > db.sql` for a consistent InnoDB snapshot, or **Percona XtraBackup** for physical backups. Restore with `mysql db < db.sql`.

### A backup strategy

- **RPO** (recovery point objective): how much data you can afford to lose (e.g. 15 minutes means continuous WAL archiving). **RTO** (recovery time objective): how quickly you must be back (e.g. 1 hour).
- **3-2-1 rule**: 3 copies, on 2 different media, 1 off-site (another region or provider). Encrypt the backups. Restrict who can delete them (immutable/object-lock storage protects against ransomware).
- **Retention** (e.g. Grandfather-Father-Son): keep 7 daily, 4 weekly and 12 monthly backups.
- Monitor them: alert if a backup is missing, much smaller than usual, or failed.

> [!recap]
> - `pg_dump`/`pg_restore` (logical); base backup + WAL for PITR. `mysqldump --single-transaction`.
> - Define RPO/RTO. 3-2-1. Encrypt. GFS retention. Test restores. Monitor.

# Quiz

## What does `set -euo pipefail` do in a bash script?
- [x] Exits on errors, treats unset variables as errors, and makes pipelines fail if any command fails
- [ ] Enables debugging output
- [ ] Runs the script as root
- [ ] Makes variables global
> It's the safety baseline for scripts.

## What exit code means success?
- [x] 0
- [ ] 1
- [ ] 255
- [ ] -1
> Anything non-zero signals failure.

## Why switch releases with `ln -sfn new current` instead of copying files over the live directory?
- [ ] Symlinks are faster to type
- [x] The switch is atomic, the previous release stays intact for instant rollback, and there's no half-updated state
- [ ] systemd requires symlinks
- [ ] To save disk space
> Immutable releases + an atomic pointer flip.

## In a systemd unit, what does `Restart=on-failure` provide?
- [ ] Restarts on every config change
- [x] Automatic restart if the service exits with an error or crashes
- [ ] Daily restarts
- [ ] Restarts the whole server
> Basic self-healing for services.

## What schedule does the cron entry `30 2 * * *` represent?
- [ ] Every 30 minutes
- [x] Every day at 02:30
- [ ] At 30 past every hour on day 2
- [ ] February 30
> Fields: minute, hour, day-of-month, month, day-of-week.

## Your cron backup script works manually but fails in cron. Most likely?
- [ ] Cron is broken
- [x] Cron's minimal environment: a missing PATH or variables, and relative paths
- [ ] The disk is full
- [ ] Bash isn't installed
> Use absolute paths, set the environment explicitly, and log the output.

## RPO = 15 minutes means:
- [ ] Restore must finish within 15 minutes
- [x] At most 15 minutes of data may be lost
- [ ] Backups take 15 minutes
- [ ] Keep backups for 15 days
> RPO is about data loss. RTO is about downtime.

## What is the single most important practice for backups?
- [ ] Compressing them
- [x] Regularly testing restores
- [ ] Naming them by date
- [ ] Storing them on the same server
> Untested backups often fail exactly when needed.

# Exercise: Backup retention (Grandfather-Father-Son)

Write `to_keep(dates, daily=7, weekly=4, monthly=12)`. `dates` is a list of `datetime.date` backup dates. Return the **sorted set** of dates to keep:
- the newest `daily` backups (distinct dates)
- for the newest `weekly` ISO weeks that have backups (other than any constraint), the **latest** backup in each week
- for the newest `monthly` months that have backups, the **latest** backup in each month

Everything not selected may be deleted.

## Starter

```python
import datetime as dt

def to_keep(dates, daily=7, weekly=4, monthly=12):
    pass
```

## Tests

```python
import datetime as dt
ns = load()
start = dt.date(2025, 1, 1)
dates = [start + dt.timedelta(days=i) for i in range(120)]       # daily backups for 120 days
keep = ns["to_keep"](dates, daily=7, weekly=4, monthly=3)
assert keep == sorted(set(keep))
last = dates[-1]
assert all((last - dt.timedelta(days=i)) in keep for i in range(7)), "7 most recent days"
assert dt.date(2025, 3, 31) in keep and dt.date(2025, 2, 28) in keep, "month-end backups kept"
assert dt.date(2025, 1, 31) not in keep, "only 3 monthly"
assert len(keep) <= 7 + 4 + 3
assert dt.date(2025, 1, 15) not in keep
```

## Hint

Sort the dates in descending order. Weekly key: `d.isocalendar()[:2]` (year, week). Monthly key: `(d.year, d.month)`. Walk the dates newest-first and record the first date seen for each new key, until you have enough keys.

## Solution

```python
import datetime as dt

def _latest_per(dates_desc, keyfn, n):
    picked, seen = [], set()
    for d in dates_desc:
        k = keyfn(d)
        if k not in seen:
            seen.add(k)
            picked.append(d)
            if len(seen) == n:
                break
    return picked

def to_keep(dates, daily=7, weekly=4, monthly=12):
    desc = sorted(set(dates), reverse=True)
    keep = set(desc[:daily])
    keep |= set(_latest_per(desc, lambda d: tuple(d.isocalendar())[:2], weekly))
    keep |= set(_latest_per(desc, lambda d: (d.year, d.month), monthly))
    return sorted(keep)
```

Tools like restic, borg and pgBackRest implement exactly this policy (`--keep-daily 7 --keep-weekly 4 --keep-monthly 12`).

# Sources

- [GNU Bash Reference Manual](https://www.gnu.org/software/bash/manual/bash.html) and [ShellCheck](https://www.shellcheck.net/)
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- [systemd.service and systemd.timer man pages (freedesktop.org)](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)
- [crontab.guru: cron expression editor](https://crontab.guru/)
- [PostgreSQL docs: Backup and Restore (pg_dump, continuous archiving and PITR)](https://www.postgresql.org/docs/current/backup.html)
- [Semantic Versioning 2.0.0](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/)
