---
id: do-w8
title: Configuration Management with Ansible
week: Week 8
summary: Configuration management concepts, Ansible inventories, modules, tasks and playbooks, variables and templates, handlers and roles, idempotency, managing users, packages and services, Ansible Vault, and combining Terraform with Ansible.
builds_on: do-w7, do-w3
leads_to: do-w9
---

Terraform **creates** infrastructure (week 7). **Configuration management** makes sure each machine is **configured correctly**: packages installed, users present, config files rendered, services running. And it keeps them that way. **Ansible** is agentless (it connects over SSH), readable (YAML) and idempotent. It turns your week 6 `bootstrap.sh` into a reliable, reusable automation.

# Lesson: Ansible fundamentals (30 min)

### How it works

The **control node** (your laptop or CI) reads an **inventory** of hosts, connects over **SSH**, pushes small **modules** (Python programs) that do the work, collects the results, and cleans up. Nothing needs to be installed on the targets except Python and SSH.

### Inventory

```ini
# inventory.ini
[web]
web1.example.com
web2.example.com ansible_host=203.0.113.11

[db]
db1.example.com

[prod:children]
web
db

[all:vars]
ansible_user=deploy
ansible_python_interpreter=/usr/bin/python3
```

Dynamic inventories can query the cloud (e.g. "all EC2 instances tagged `env=prod`"), or you can generate the inventory from Terraform outputs.

### Ad-hoc commands and modules

```bash norun
ansible all -i inventory.ini -m ping                       # connectivity check
ansible web -i inventory.ini -m apt -a "name=htop state=present" --become
ansible db -i inventory.ini -m command -a "uptime"
```

**Modules** describe the **desired state**: `apt name=nginx state=present` means "make sure nginx is installed". It isn't "run apt install". Core modules: `apt`/`dnf`/`package`, `user`, `group`, `file`, `copy`, `template`, `lineinfile`, `service`/`systemd`, `git`, `uri`, `docker_container`, `ufw`.

> [!recap]
> - Agentless: control node → SSH → modules → results.
> - Static or dynamic inventories with groups and variables.
> - Modules declare state (`state=present`), not commands.

# Lesson: Playbooks, variables, templates and handlers (35 min)

A **playbook** maps groups of hosts to ordered **tasks**:

```yaml
# site.yml
- name: Configure web servers
  hosts: web
  become: true                       # sudo
  vars:
    app_user: deploy
    app_port: 8000
    server_name: app.example.com
  tasks:
    - name: Install packages
      ansible.builtin.apt:
        name: [nginx, ufw, fail2ban, unattended-upgrades]
        state: present
        update_cache: true
        cache_valid_time: 3600

    - name: Create the deploy user
      ansible.builtin.user:
        name: "{{ app_user }}"
        groups: [docker]
        append: true
        shell: /bin/bash

    - name: Render the nginx site config
      ansible.builtin.template:
        src: templates/app.conf.j2
        dest: /etc/nginx/sites-available/app.conf
        mode: "0644"
        validate: nginx -t -c /etc/nginx/nginx.conf
      notify: Reload nginx                 # trigger a handler only if this task changed

    - name: Enable the site
      ansible.builtin.file:
        src: /etc/nginx/sites-available/app.conf
        dest: /etc/nginx/sites-enabled/app.conf
        state: link
      notify: Reload nginx

    - name: Ensure nginx is running and enabled
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

```jinja
# templates/app.conf.j2 (Jinja2 template)
server {
    listen 80;
    server_name {{ server_name }};
    location / {
        proxy_pass http://127.0.0.1:{{ app_port }};
        proxy_set_header Host $host;
    }
}
```

```bash norun
ansible-playbook -i inventory.ini site.yml --check --diff     # dry run: what would change?
ansible-playbook -i inventory.ini site.yml                    # apply
ansible-playbook -i inventory.ini site.yml --limit web1.example.com --tags nginx
```

### Variables and precedence

Variables come from many places: the role defaults (lowest), `group_vars/`, `host_vars/`, play `vars`, the registered results of earlier tasks, and `-e` extra vars (highest). A typical layout:

```text
inventories/prod/hosts.ini
inventories/prod/group_vars/web.yml       # per-environment values
inventories/staging/...
roles/  site.yml
```

**Handlers** run **once at the end of the play**, and **only if notified** by a task that actually changed something. Nginx reloads only when its config changed.

> [!recap]
> - Playbook = hosts + become + vars + tasks + handlers.
> - Jinja2 templates render the config. `validate` checks it before installing.
> - `--check --diff` for dry runs. Handlers run only on change.

# Lesson: Idempotency, roles, Vault and Terraform + Ansible (30 min)

### Idempotency: the central property

Running a playbook **once or ten times gives the same result**. The second run should report **`changed=0`**. That's what makes automation safe to re-run after failures, and usable for continuous enforcement.

- Use modules (they check before they act) instead of `command`/`shell` where possible.
- If you must use `command`, make it idempotent with `creates:`, `removes:` or `changed_when:`.
- `lineinfile` and `blockinfile` edit files idempotently. `copy`/`template` compare checksums.

```yaml
- name: Initialize the app DB only once
  ansible.builtin.command: /srv/app/bin/init-db
  args:
    creates: /srv/app/.db-initialized      # skipped if this file exists
```

### Roles: reusable structure

```text
roles/nginx/
├── defaults/main.yml      # default variables (overridable)
├── tasks/main.yml
├── handlers/main.yml
├── templates/app.conf.j2
└── meta/main.yml          # dependencies
```

```yaml
- hosts: web
  become: true
  roles:
    - common          # users, ssh hardening, ufw, unattended upgrades
    - docker
    - nginx
```

Community roles and collections come from **Ansible Galaxy**. Test roles with **Molecule**, and lint with `ansible-lint`.

### Secrets with Ansible Vault

```bash norun
ansible-vault create inventories/prod/group_vars/all/vault.yml     # encrypted YAML
ansible-vault edit   inventories/prod/group_vars/all/vault.yml
ansible-playbook site.yml --ask-vault-pass        # or --vault-password-file (from a CI secret)
```

By convention, define `vault_db_password` in the vault and reference it from a normal variable (`db_password: "{{ vault_db_password }}"`). Add `no_log: true` to tasks that handle secrets, so they never appear in output.

### Terraform + Ansible

| | Terraform | Ansible |
|---|---|---|
| Purpose | Provision infrastructure (VMs, networks, DNS) | Configure the inside of machines (packages, files, services) |
| Model | Declarative + state file | Procedural task list of declarative modules; no state |
| Typical flow | `terraform apply` → outputs IPs | Inventory from those outputs → `ansible-playbook` |

Common integration: Terraform writes an inventory file (or tags instances for a dynamic inventory), then CI runs the playbook. Increasingly, containers plus Kubernetes reduce in-VM configuration, but you still need Ansible-style tools for base images, bare-metal hosts and the Kubernetes nodes themselves.

> [!recap]
> - Idempotency means a second run reports `changed=0`. Use modules, `creates`/`changed_when`.
> - Roles for reuse. Galaxy, Molecule, ansible-lint.
> - Vault for secrets, plus `no_log`. Terraform provisions, Ansible configures.

# Quiz

## What does "agentless" mean for Ansible?
- [ ] It needs no control node
- [x] Nothing special runs on the managed hosts; Ansible connects over SSH and runs modules temporarily
- [ ] It only works in the cloud
- [ ] It needs no inventory
> SSH + Python on the targets is enough.

## `apt: name=nginx state=present` on a host where nginx is already installed:
- [ ] Reinstalls nginx
- [x] Does nothing and reports "ok" (not changed)
- [ ] Fails
- [ ] Upgrades nginx
> Modules check the current state first, which is what idempotency means.

## When does a handler run?
- [ ] At the start of every play
- [x] Once at the end of the play, only if a task that notified it reported "changed"
- [ ] After every task
- [ ] Only in check mode
> Restart or reload only when needed.

## What does `ansible-playbook site.yml --check --diff` do?
- [x] A dry run that shows what would change, including file diffs, without changing anything
- [ ] Applies the changes and shows the diffs
- [ ] Checks YAML syntax only
- [ ] Deletes changed files
> Use it before applying to production.

## How do you make a `command` task idempotent?
- [ ] You can't
- [x] Use `creates:`/`removes:` or `changed_when:` so it runs or reports a change only when appropriate
- [ ] Run it twice
- [ ] Use `become: true`
> Prefer real modules when they exist.

## Where should a production database password used by Ansible be stored?
- [ ] Plain text in group_vars
- [x] In an Ansible Vault-encrypted file (with no_log on the tasks that use it)
- [ ] In the playbook name
- [ ] In the inventory hostname
> Encrypted at rest, and hidden in the logs.

## Which tool would you use to create a VPC and 3 VMs, then install and configure nginx on them?
- [ ] Ansible for both
- [ ] Terraform for both
- [x] Terraform to provision the VPC and VMs, then Ansible to configure them
- [ ] Docker Compose
> Each tool for its strength.

# Exercise: Idempotent lineinfile

Implement a mini `lineinfile(content, regexp, line)` that mimics Ansible's module. `content` is a file's text. If a line matches `regexp` (with `re.search`), replace the **last** matching line with `line`. If no line matches, append `line` (ensuring the result ends with a newline). Return `(new_content, changed)`, where `changed` is False if the content didn't change. Running it twice must report `changed=False` the second time.

## Starter

```python
import re

def lineinfile(content, regexp, line):
    pass
```

## Tests

```python
ns = load()
f = ns["lineinfile"]
conf = "Port 22\nPermitRootLogin yes\nPasswordAuthentication yes\n"
new, changed = f(conf, r"^PermitRootLogin", "PermitRootLogin no")
assert changed and "PermitRootLogin no" in new and "PermitRootLogin yes" not in new
again, changed2 = f(new, r"^PermitRootLogin", "PermitRootLogin no")
assert not changed2 and again == new, "second run must be a no-op"
added, ch3 = f("a=1", r"^b=", "b=2")
assert ch3 and added == "a=1\nb=2\n", repr(added)
dup = "X=1\nX=2\n"
out, ch4 = f(dup, r"^X=", "X=9")
assert out == "X=1\nX=9\n" and ch4, "replace the last match"
```

## Solution

```python
import re

def lineinfile(content, regexp, line):
    lines = content.splitlines()
    pattern = re.compile(regexp)
    idx = None
    for i, l in enumerate(lines):
        if pattern.search(l):
            idx = i
    if idx is not None:
        lines[idx] = line
    else:
        lines.append(line)
    new = "\n".join(lines) + "\n"
    return new, new != content
```

Comparing the old and new content to decide `changed` is exactly how real modules report state. It's what makes `changed=0` on the second run possible.

# Sources

- [Ansible documentation: Getting started, playbooks, roles, Vault](https://docs.ansible.com/ansible/latest/getting_started/index.html)
- [Ansible: Tips and tricks / best practices](https://docs.ansible.com/ansible/latest/tips_tricks/ansible_tips_tricks.html)
- *Ansible for DevOps* by Jeff Geerling (also see his free Ansible 101 video series)
- [Molecule: testing Ansible roles](https://ansible.readthedocs.io/projects/molecule/)
- [ansible-lint](https://ansible.readthedocs.io/projects/lint/)
