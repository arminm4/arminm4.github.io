---
id: do-w7
title: Cloud Foundations & Terraform
week: Week 7
summary: Cloud building blocks (virtual machines, networks, storage, identity and access management), then Infrastructure as Code with Terraform: providers and resources, variables and outputs, plan/apply/destroy, dependencies, state, remote backends, locking and drift.
builds_on: do-p1, do-w2
leads_to: do-w8, do-w9
---

Clicking servers into existence in a web console doesn't scale, isn't reviewable and can't be reproduced. **Infrastructure as Code (IaC)** describes infrastructure in versioned files that are planned, reviewed and applied automatically. This week covers the cloud concepts you'll be codifying, then **Terraform**, the most widely used IaC tool.

# Lesson: Cloud building blocks (30 min)

Every major cloud (AWS, Azure, Google Cloud, and also providers like Hetzner, DigitalOcean and ArvanCloud) offers the same primitives under different names:

| Concept | AWS | Azure | GCP |
|---|---|---|---|
| Virtual machines | EC2 | Virtual Machines | Compute Engine |
| Private network | VPC + subnets | VNet + subnets | VPC + subnets |
| Firewall rules | Security groups / NACLs | NSGs | Firewall rules |
| Object storage | S3 | Blob Storage | Cloud Storage |
| Block storage (disks) | EBS | Managed Disks | Persistent Disk |
| Managed database | RDS | Azure Database | Cloud SQL |
| Identity & access | IAM | Entra ID + RBAC | IAM |
| Managed Kubernetes | EKS | AKS | GKE |

### Core ideas

- **Regions and availability zones (AZs)**: a region has several isolated data centres (AZs). Spreading across AZs survives a data-centre failure.
- **Networking**: a VPC (e.g. `10.0.0.0/16`, week 2) with **public subnets** (load balancers, bastions) and **private subnets** (apps, databases). Private instances reach the internet through a NAT gateway.
- **Storage types**: block (disks attached to a VM), object (files via an HTTP API, huge scale, cheap: backups, uploads, static sites) and file (shared filesystems).
- **IAM**: *who* (users, groups, **roles** for machines and services) can do *what* (actions) on *which resources*. Grant **least privilege**. Prefer roles with short-lived credentials over long-lived access keys. Turn on MFA for humans.
- **Shared responsibility**: the provider secures the cloud's infrastructure. You secure your configuration, data, identities and applications. Most cloud breaches are **misconfigurations** (public buckets, over-broad IAM).
- **Cost**: pay per use. Tag your resources, set budgets and alerts, and right-size them. Idle resources still cost money.

> [!recap]
> - VMs, VPC/subnets, firewall rules, object/block storage, managed DBs, IAM, managed Kubernetes.
> - Regions/AZs for resilience; public vs private subnets; least-privilege IAM with roles.
> - Shared responsibility. Tags and budgets for cost.

# Lesson: Terraform fundamentals (35 min)

Terraform uses the declarative **HCL** language. You describe the **desired state**, and Terraform computes the changes needed to reach it.

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "eu-central-1"
}
variable "instance_type" {
  type    = string
  default = "t3.small"
}
variable "env" {
  type = string
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "studymate-${var.env}" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id          # reference -> implicit dependency
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
}

resource "aws_security_group" "web" {
  vpc_id = aws_vpc.main.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "ubuntu" {                             # a data source: read existing info
  most_recent = true
  owners      = ["099720109477"]                      # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
  tags                   = { Name = "app-${var.env}", Env = var.env }
}

output "app_public_ip" { value = aws_instance.app.public_ip }
```

### Core concepts

- **Providers**: plugins for APIs (AWS, Azure, GCP, Cloudflare, Kubernetes, GitHub…).
- **Resources**: things Terraform manages. **Data sources**: things it only reads.
- **Variables** (inputs, with types and validation), **outputs** (exported values), **locals** (named expressions).
- **Dependencies**: references (`aws_vpc.main.id`) create **implicit** dependencies, and Terraform builds a dependency graph to create, update or destroy in the right order, in parallel where possible (the DAG idea from week 5). `depends_on` is for hidden dependencies.
- **Modules**: reusable packages of resources (`module "network" { source = "./modules/vpc" ... }`).
- `count` / `for_each`: create multiple similar resources.

### The workflow

```bash norun
terraform init          # download providers, configure the backend
terraform fmt && terraform validate
terraform plan -var env=staging -out tfplan     # preview: + create, ~ update, - destroy, -/+ replace
terraform apply tfplan                           # apply exactly the reviewed plan
terraform output app_public_ip
terraform destroy -var env=staging               # tear down (careful!)
```

> [!important] Read every plan
> `-/+ replace` on a database means **data loss**. Use `lifecycle { prevent_destroy = true }` on critical resources, and review plans in pull requests (CI posts the plan as a comment).

> [!recap]
> - Declarative HCL: providers, resources, data sources, variables, outputs, modules.
> - References create a dependency graph. `for_each`/`count` for repetition.
> - init → fmt/validate → plan (review!) → apply → destroy.

# Lesson: State, remote backends, locking and drift (30 min)

### State

Terraform records what it manages in a **state file** (`terraform.tfstate`): a mapping from your configuration to real resource IDs and attributes. The plan compares **configuration ↔ state ↔ reality**.

- State can contain **secrets** (DB passwords, keys) in plain text. Treat it as sensitive.
- **Never** edit it by hand. Use `terraform state mv/rm` and `terraform import` when needed.

### Remote backends and locking

On a team, a local state file breaks down: two people apply at once and corrupt it, or one laptop holds the only copy. Use a **remote backend** with **locking**:

```hcl
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "studymate/staging/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true          # S3-native state locking (older setups used a DynamoDB table)
  }
}
```

Other options: Terraform Cloud/HCP, Azure Storage, GCS, and the PostgreSQL backend. **One state per environment** (separate keys or workspaces, or separate directories) limits the blast radius.

### Drift

**Drift** is when reality no longer matches the state: someone changed a security group in the console, or a resource was deleted manually. `terraform plan` reveals it (changes you didn't write). Fix it by updating the code to match the change (if it was intended) or by applying to revert it. Prevent it with **restricted console permissions**, all changes going through IaC pipelines, and scheduled drift-detection plans in CI.

> [!connect] IaC in the pipeline
> A typical flow: a PR runs `terraform fmt -check`, `validate` and `plan`, posting the plan for review. Merging to main runs `apply` with OIDC cloud credentials (week 5). Tools like Atlantis, Spacelift and Terraform Cloud automate this. **OpenTofu** is an open-source fork of Terraform with the same workflow.

> [!recap]
> - State maps config ↔ reality and is sensitive. Never hand-edit it.
> - A remote, encrypted backend + locking + one state per environment.
> - Drift: detect with plan; prevent with IaC-only changes and drift checks.

# Quiz

## Where should a production database usually live in a VPC?
- [ ] A public subnet with a public IP
- [x] A private subnet, reachable only from the app tier
- [ ] Outside the VPC
- [ ] On the bastion host
> Minimize exposure. Public subnets are for load balancers.

## Which is the best practice for a VM that needs to read from object storage?
- [ ] Hard-code access keys in the app
- [x] Attach an IAM role with a least-privilege policy, so the VM gets short-lived credentials automatically
- [ ] Make the bucket public
- [ ] Use the root account keys
> Roles + least privilege, with no long-lived keys.

## What does `terraform plan` do?
- [ ] Creates resources immediately
- [x] Compares the configuration with the state and reality, and shows the changes it would make without applying them
- [ ] Deletes the state
- [ ] Downloads providers only
> Always review the plan before applying.

## In a plan, `-/+ aws_db_instance.main` means:
- [ ] A minor in-place update
- [x] The resource will be destroyed and recreated: likely data loss for a database
- [ ] No change
- [ ] It will be imported
> Replacement often happens when changing immutable attributes. Investigate before applying.

## How does Terraform know to create the VPC before the subnet?
- [x] The subnet references `aws_vpc.main.id`, creating an implicit dependency in the graph
- [ ] Alphabetical order
- [ ] Order in the file
- [ ] Random
> References define the DAG.

## Why use a remote backend with locking?
- [ ] It's faster
- [x] Shared, durable state, and preventing concurrent applies from corrupting it
- [ ] It removes the need for providers
- [ ] It encrypts your code
> Teams need one source of truth plus mutual exclusion.

## Someone changed a security group in the console. What is that called, and how do you detect it?
- [ ] A merge conflict; via git
- [x] Drift; terraform plan shows changes you didn't write
- [ ] A rollback; via logs
- [ ] Nothing; Terraform ignores it
> Make all changes go through IaC to prevent it.

## Why is the Terraform state file sensitive?
- [ ] It contains your source code
- [x] It can contain secrets and resource details in plain text
- [ ] It's large
- [ ] It controls DNS
> Encrypt it, restrict access, and never commit it to Git.

# Exercise: Plan diff engine

Terraform's core is a diff. Write `plan(desired, current, force_new=("ami", "engine"))`. Both arguments map resource address → attribute dict. Return a dict with sorted lists:
- `"create"`: in desired but not current
- `"delete"`: in current but not desired
- `"update"`: in both, attributes differ, but no `force_new` attribute changed
- `"replace"`: in both, and at least one `force_new` attribute changed
- `"noop"`: identical

## Starter

```python
def plan(desired, current, force_new=("ami", "engine")):
    pass
```

## Tests

```python
ns = load()
desired = {
    "aws_vpc.main": {"cidr": "10.0.0.0/16"},
    "aws_instance.app": {"ami": "ubuntu-24", "type": "t3.small"},
    "aws_db.main": {"engine": "postgres16", "size": 20},
    "aws_s3.uploads": {"versioning": True},
}
current = {
    "aws_vpc.main": {"cidr": "10.0.0.0/16"},
    "aws_instance.app": {"ami": "ubuntu-22", "type": "t3.small"},
    "aws_db.main": {"engine": "postgres16", "size": 10},
    "aws_sg.old": {"port": 22},
}
p = ns["plan"](desired, current)
assert p == {"create": ["aws_s3.uploads"], "delete": ["aws_sg.old"], "update": ["aws_db.main"],
             "replace": ["aws_instance.app"], "noop": ["aws_vpc.main"]}, p
```

## Solution

```python
def plan(desired, current, force_new=("ami", "engine")):
    out = {"create": [], "delete": [], "update": [], "replace": [], "noop": []}
    for addr in sorted(set(desired) | set(current)):
        if addr not in current:
            out["create"].append(addr)
        elif addr not in desired:
            out["delete"].append(addr)
        else:
            d, c = desired[addr], current[addr]
            changed = {k for k in set(d) | set(c) if d.get(k) != c.get(k)}
            if not changed:
                out["noop"].append(addr)
            elif changed & set(force_new):
                out["replace"].append(addr)
            else:
                out["update"].append(addr)
    return out
```

Real Terraform adds provider-defined schemas (which attributes force replacement), unknown values computed at apply time, and dependency ordering. The core idea is still desired vs current state.

# Sources

- [Terraform documentation: language, state, backends](https://developer.hashicorp.com/terraform/docs)
- [HashiCorp tutorials: Get started with Terraform (AWS/Azure/GCP)](https://developer.hashicorp.com/terraform/tutorials)
- [AWS Well-Architected Framework (security, reliability, cost pillars)](https://aws.amazon.com/architecture/well-architected/)
- *Terraform: Up & Running, 3rd ed.* by Yevgeniy Brikman
- [OpenTofu documentation](https://opentofu.org/docs/)
- [AWS: IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
