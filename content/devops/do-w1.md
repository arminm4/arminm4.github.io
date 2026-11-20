---
id: do-w1
title: DevOps & Linux Foundations
week: Week 1
summary: What DevOps is, the software delivery lifecycle and environments, then Linux: the terminal, file system, packages, users, groups and permissions, processes and signals, pipes and redirection, logs and system resources.
builds_on: f-terminal
leads_to: do-w2, do-w3
---

DevOps is a culture and a set of practices that shorten the path from **code** to **reliable production**, and back to code through feedback. Almost all of that production runs on **Linux**. This week sets up both: the DevOps mindset and day-one Linux administration skills.

> [!tip] Practice environment
> Use any Linux: an Ubuntu VM (VirtualBox, UTM), **WSL2** on Windows (`wsl --install`), a cheap cloud VM, or `docker run -it ubuntu:24.04 bash`. Type every command yourself.

# Lesson: What DevOps is (and isn't) (25 min)

Traditionally, developers wanted change while operations wanted stability, and handoffs between them were slow and painful. **DevOps** breaks that wall with shared ownership: *you build it, you run it*.

**CALMS** summarizes the practices:
- **Culture**: shared responsibility, blameless learning from incidents.
- **Automation**: builds, tests, infrastructure, deployments.
- **Lean**: small batches, fast flow, limiting work in progress.
- **Measurement**: data about delivery and reliability.
- **Sharing**: knowledge, tools, documentation.

### The software delivery lifecycle

```text
plan → code → build → test → release → deploy → operate → monitor ─┐
  ▲                                                                 │
  └──────────────────────── feedback ───────────────────────────────┘
```

### Environments

- **Development**: laptops and dev containers, where things change fast.
- **Staging**: production-like, used for final verification. It should mirror production's configuration and versions.
- **Production**: real users. Change it only through automated, reviewed pipelines.

**Configuration differs between environments; the artifact doesn't.** The same container image moves from staging to production with different environment variables (12-factor).

### Measuring delivery: the DORA metrics

| Metric | Elite teams (DORA research) |
|---|---|
| Deployment frequency | On demand (many per day) |
| Lead time for changes | Less than a day |
| Change failure rate | Low (roughly 0–15%) |
| Time to restore service | Less than an hour |

The DORA research found that speed and stability **reinforce each other**: small, frequent, automated changes are both faster *and* safer.

> [!recap]
> - DevOps = culture + practices (CALMS) for fast, reliable delivery.
> - The lifecycle loops through feedback. Promote one artifact through dev → staging → prod.
> - DORA metrics: frequency, lead time, change failure rate, time to restore.

# Lesson: Linux essentials: the file system and packages (30 min)

### The filesystem hierarchy

| Path | Contents |
|---|---|
| `/etc` | System configuration (`/etc/nginx/`, `/etc/ssh/sshd_config`) |
| `/var` | Variable data: `/var/log` (logs), `/var/lib` (databases, Docker) |
| `/home/<user>` | Users' home directories |
| `/usr/bin`, `/usr/local/bin` | Programs |
| `/tmp` | Temporary files (cleared on reboot) |
| `/opt` | Optional/third-party software |
| `/proc`, `/sys` | Virtual files exposing kernel and process information |
| `/dev` | Devices (disks, terminals) |

"Everything is a file" in Linux: devices, process info (`/proc/<pid>/`) and sockets are all accessed through file interfaces.

```bash norun
cat /etc/os-release          # which distribution?
uname -a                     # kernel version
df -h                        # disk usage per filesystem
du -sh /var/log/*            # size of each log directory
find /etc -name "*.conf" -mtime -7     # config files changed in the last 7 days
grep -rn "listen" /etc/nginx/          # search inside files
```

### Package management

```bash norun
# Debian/Ubuntu (apt)
sudo apt update                       # refresh package lists
sudo apt install -y nginx curl htop
apt list --installed | grep nginx
sudo apt upgrade                      # apply updates (security!)
# RHEL/Fedora/Rocky (dnf)
sudo dnf install -y nginx
```

Packages come from signed **repositories**, and dependencies are resolved automatically. Keep servers patched. Unattended security updates are common in production.

> [!recap]
> - Know `/etc`, `/var/log`, `/home`, `/usr/bin`, `/proc`.
> - `df`, `du`, `find`, `grep -r`.
> - apt/dnf install, update and upgrade, from signed repositories.

# Lesson: Users, groups and permissions (30 min)

Linux is multi-user. Every file has an **owner**, a **group** and **permission bits** for owner/group/others.

```bash norun
ls -l /var/www/app/config.yml
# -rw-r----- 1 deploy www-data 512 Nov 20 10:00 config.yml
#  │└┬┘└┬┘└┬┘   owner  group
#  │ │  │  └── others: ---  (no access)
#  │ │  └───── group:  r--  (read)
#  │ └──────── owner:  rw-  (read, write)
#  └────────── type: - file, d directory, l symlink
```

| Symbol | File | Directory | Octal |
|---|---|---|---|
| r | read contents | list entries | 4 |
| w | modify | create/delete entries | 2 |
| x | execute | enter (`cd`) | 1 |

`chmod 640 config.yml` → owner rw- (6), group r-- (4), others --- (0). `chmod 755 script.sh` → rwxr-xr-x.

```bash norun
sudo useradd -m -s /bin/bash deploy          # create a user with a home directory
sudo usermod -aG docker deploy               # add to a group (-a = append!)
id deploy                                    # uid, gid, groups
sudo chown deploy:www-data /var/www/app -R   # change owner and group recursively
chmod u+x deploy.sh                          # symbolic mode: add execute for the owner
sudo -u deploy whoami                        # run a command as another user
```

### Root and sudo

**root** (uid 0) can do anything. Administrators use **sudo** to run individual commands as root, with logging and fine-grained rules (`/etc/sudoers`, always edited with `visudo`).

> [!important] Least privilege
> Services run as dedicated unprivileged users (`www-data`, `postgres`, a `deploy` user), never as root. Secrets files get `600` (owner only). If a service is compromised, the damage stays contained. This principle appears in Docker (non-root containers), Kubernetes (RBAC) and the cloud (IAM).

```python
def mode_to_symbolic(octal: str) -> str:
    bits = "rwx"
    return "".join(bits[i] if int(d) & (4 >> i) else "-" for d in octal for i in range(3))
for m in ["755", "644", "600", "750"]:
    print(m, mode_to_symbolic(m))
```

> [!recap]
> - Owner/group/others × r/w/x, in octal 4/2/1.
> - `useradd`, `usermod -aG`, `chown`, `chmod`, `sudo`.
> - Least privilege: services as unprivileged users, secrets 600.

# Lesson: Processes, signals, pipes and logs (35 min)

### Processes

Every running program is a **process**, with a PID, a parent, a user, CPU and memory usage, and a state.

```bash norun
ps aux | head                     # all processes
ps aux --sort=-%mem | head -5     # top memory users
top        # or: htop             # live view (q to quit)
pgrep -a nginx                    # find processes by name
sleep 300 &                       # run in the background; 'jobs', 'fg', 'bg'
```

### Signals

Signals are messages sent to processes:

| Signal | Number | Meaning |
|---|---|---|
| SIGTERM | 15 | "Please terminate". Can be handled for a **graceful shutdown** (the default for `kill`) |
| SIGKILL | 9 | Kill immediately. Can't be caught, so there's no cleanup |
| SIGINT | 2 | Ctrl+C |
| SIGHUP | 1 | Hang-up; many daemons reload their configuration on it |

```bash norun
kill <pid>          # SIGTERM: try this first
kill -9 <pid>       # SIGKILL: last resort
```

> [!connect] Graceful shutdown matters later
> Docker and Kubernetes send **SIGTERM**, wait (default 10 s in Docker, 30 s in Kubernetes), then send SIGKILL. Apps must handle SIGTERM to finish in-flight requests, which enables zero-downtime deploys (DevOps weeks 4 and 10, Full-Stack week 10).

### Pipes and redirection: operations power tools

```bash norun
# Top 10 client IPs hitting the server
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
# Count 5xx responses per minute
awk '$9 ~ /^5/ {print substr($4, 2, 17)}' /var/log/nginx/access.log | uniq -c
# Follow a log live, filtering errors
tail -f /var/log/syslog | grep -i --line-buffered error
```

### Logs and resources

- Systemd services log to the **journal**: `journalctl -u nginx --since "1 hour ago" -f`.
- Traditional files: `/var/log/syslog` (or `messages`), `/var/log/auth.log` (logins, sudo), and application logs.
- Resources: `free -h` (memory), `uptime` (load average), `df -h` (disk), `iostat`, `vmstat`, `ss -tulpn` (listening ports).

The **load average** is the average number of runnable (plus uninterruptible) processes over 1, 5 and 15 minutes. Compare it with the number of CPU cores (`nproc`).

> [!recap]
> - `ps`, `top`/`htop`, `pgrep`, and background jobs.
> - SIGTERM first (graceful), SIGKILL as the last resort. Containers rely on SIGTERM.
> - Pipes + `awk`/`sort`/`uniq` for log analysis. `journalctl`, `free`, `df`, `ss`, load average.

# Quiz

## Which DORA metric measures how long it takes to recover from a production failure?
- [ ] Deployment frequency
- [ ] Lead time for changes
- [ ] Change failure rate
- [x] Time to restore service
> It's also called mean time to recovery (MTTR).

## What does "the configuration differs, the artifact doesn't" mean?
- [x] The same build (e.g. container image) is promoted through environments, with environment-specific config injected
- [ ] Every environment builds its own version
- [ ] Production has no configuration
- [ ] Staging uses different code
> Build once, deploy many times.

## Where are system configuration files typically stored?
- [ ] /var/log
- [x] /etc
- [ ] /tmp
- [ ] /home
> /etc holds the configuration. /var holds variable data like logs.

## What permissions does `chmod 640 secrets.env` give?
- [ ] Everyone can read
- [x] Owner read/write, group read, others nothing
- [ ] Owner read only
- [ ] Owner execute
> 6 = rw-, 4 = r--, 0 = ---.

## Why add a user to a group with `usermod -aG docker deploy` instead of `-G docker`?
- [ ] -G is faster
- [x] Without -a, the user's other supplementary groups would be replaced
- [ ] -a creates the group
- [ ] There's no difference
> -a = append. A classic mistake that locks people out of groups.

## Docker stops a container. Which signal does the app receive first?
- [ ] SIGKILL
- [x] SIGTERM (then SIGKILL after a grace period)
- [ ] SIGHUP
- [ ] SIGINT
> Handle SIGTERM for graceful shutdowns.

## Which command shows the logs of a systemd service named api for the last hour?
- [ ] cat /var/log/api
- [x] journalctl -u api --since "1 hour ago"
- [ ] systemctl logs api
- [ ] tail api.service
> journald collects the service output.

## A 4-core server shows load average 12.0. What does it suggest?
- [ ] It's idle
- [x] Heavy contention: about 3× more runnable processes than cores
- [ ] The disk is full
- [ ] Memory is free
> Compare the load average with `nproc`.

# Exercise: Permissions calculator

Write `symbolic_to_octal(s)` that converts a 9-character permission string like `"rwxr-x---"` to an octal string like `"750"`, and `can(perms, owner, group, user, user_groups, action)`. `perms` is a 9-char string, `action` is `"r"`, `"w"` or `"x"`, and the function returns True if `user` may perform `action`, following Linux rules: if the user is the owner, **only** the owner bits apply; else if the user is in the file's group, only the group bits apply; else the others bits apply. (Ignore root.)

## Starter

```python
def symbolic_to_octal(s):
    pass

def can(perms, owner, group, user, user_groups, action):
    pass
```

## Tests

```python
ns = load()
s2o, can = ns["symbolic_to_octal"], ns["can"]
assert s2o("rwxr-x---") == "750" and s2o("rw-r--r--") == "644" and s2o("---------") == "000"
assert can("rw-r-----", "deploy", "www", "deploy", {"deploy"}, "w") is True
assert can("rw-r-----", "deploy", "www", "nginx", {"www"}, "r") is True
assert can("rw-r-----", "deploy", "www", "nginx", {"www"}, "w") is False
assert can("rw-r-----", "deploy", "www", "bob", {"bob"}, "r") is False
assert can("---rwxrwx", "deploy", "www", "deploy", {"www"}, "r") is False, "owner bits apply exclusively"
```

## Solution

```python
def symbolic_to_octal(s):
    out = ""
    for i in range(0, 9, 3):
        triad = s[i:i + 3]
        out += str((4 if triad[0] == "r" else 0) + (2 if triad[1] == "w" else 0) + (1 if triad[2] == "x" else 0))
    return out

def can(perms, owner, group, user, user_groups, action):
    pos = {"r": 0, "w": 1, "x": 2}[action]
    if user == owner:
        triad = perms[0:3]
    elif group in user_groups:
        triad = perms[3:6]
    else:
        triad = perms[6:9]
    return triad[pos] != "-"
```

The last test surprises many people: if you're the owner and the owner bits deny access, group membership doesn't help.

# Exercise: Linux scavenger hunt (hands-on)

On a real Linux machine (a VM, WSL or a container), find and write down:
1. Your distribution and kernel version.
2. The 3 processes using the most memory.
3. Which ports are listening, and which programs own them (`sudo ss -tulpn`).
4. The size of `/var/log` and its largest file.
5. Create a user `appuser` and a group `apps`, put the user in the group, create `/srv/app/secret.env` owned by `appuser:apps` with mode 640, and prove that another user can't read it.
6. Start `sleep 1000 &`, find its PID and stop it gracefully.

## Solution

```bash norun
cat /etc/os-release; uname -r
ps aux --sort=-%mem | head -4
sudo ss -tulpn
sudo du -sh /var/log; sudo find /var/log -type f -printf "%s %p\n" | sort -rn | head -1
sudo groupadd apps; sudo useradd -m -G apps appuser
sudo mkdir -p /srv/app && echo "API_KEY=x" | sudo tee /srv/app/secret.env >/dev/null
sudo chown appuser:apps /srv/app/secret.env && sudo chmod 640 /srv/app/secret.env
cat /srv/app/secret.env      # as your normal user -> Permission denied
sleep 1000 & pgrep -a sleep; kill %1     # or: kill <pid>
```

# Sources

- [DORA: Accelerate State of DevOps research and the four key metrics](https://dora.dev/)
- *The DevOps Handbook* by Kim, Humble, Debois & Willis; *Accelerate* by Forsgren, Humble & Kim
- [The Linux Command Line by William Shotts (free book)](https://linuxcommand.org/tlcl.php)
- [Linux Journey (free interactive lessons)](https://linuxjourney.com/)
- [Arch Wiki: File permissions and attributes](https://wiki.archlinux.org/title/File_permissions_and_attributes)
- [man7.org: signal(7) manual page](https://man7.org/linux/man-pages/man7/signal.7.html)
