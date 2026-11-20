---
id: do-p2
title: Capstone: Production Platform on Kubernetes
week: Weeks 12–13
kind: project
summary: Provision infrastructure with Terraform, configure it with Ansible, run a multi-service app on Kubernetes with Helm, deliver with GitOps CI/CD, and operate it with SLOs, dashboards, alerts and a game day.
builds_on: do-w11, do-w10, do-w9, do-w8, do-w7
---

The DevOps capstone brings together all 11 weeks: an end-to-end platform that a real team could run.

# Project: The StudyMate platform

**Application**: the Full-Stack StudyMate app (API, worker, web, Postgres, Redis), or any 3+ service app. If you haven't built it yet, use a public sample microservices app, e.g. Google's "Online Boutique".

### Requirements

**1. Infrastructure as Code (Terraform)**
- Network (VPC/subnets or the provider's equivalent), a Kubernetes cluster (managed EKS/AKS/GKE/DOKS, or k3s on VMs), a container registry, DNS records, an object-storage bucket for backups.
- A remote state backend with locking; separate staging and prod states; modules; CI plan on PRs and apply on merge (with approval for prod).

**2. Configuration (Ansible)**
- If you use VMs: harden the nodes (users, SSH, firewall, updates) and install k3s via roles. If the cluster is managed: use Ansible for a bastion/runner host and any non-K8s servers.
- Idempotent (second run `changed=0`), Vault for secrets, linted.

**3. Kubernetes (Helm)**
- A Helm chart for the app with values per environment; Deployments with probes, requests and limits; an HPA; PDBs; Ingress with cert-manager TLS; a CronJob for backups; RBAC with least privilege; secrets via Sealed Secrets or the External Secrets Operator.
- Databases: a managed DB *or* a StatefulSet with PVCs. Document the choice.

**4. CI/CD**
- App repo: lint/test/scan (Trivy) → build → push with SHA tags → update the image tag in a **GitOps repo** (Argo CD or Flux) → auto-sync to staging → PR-based promotion to prod.
- Prove a **rollback** (git revert) and a **zero-downtime** rolling update under load.

**5. Observability and reliability**
- kube-prometheus-stack (Prometheus, Alertmanager, Grafana), Loki for logs (optional), OpenTelemetry traces (optional).
- Define **2–3 SLOs** (availability and latency for the API) with a Grafana SLO dashboard and **multi-window burn-rate alerts** routed to a chat channel.
- Load test with k6: document the capacity and the bottleneck.
- **Game day**: deliberately break things (kill Pods, fill a disk, break the DB credentials, push a bad release). Practise the runbooks and write one blameless postmortem.

### Deliverables

- Repositories: `infra/` (Terraform + Ansible), `app/` (code + Dockerfiles + CI), `gitops/` (Helm values per environment).
- Architecture diagram, `RUNBOOK.md`, the SLO document, a cost estimate per month, the postmortem, and a 10-minute demo video.

## Milestones

- [ ] Terraform: network, cluster, registry, DNS, bucket; remote state; CI plan/apply flow
- [ ] Ansible: hardening/runner roles; idempotent; Vault
- [ ] Helm chart: probes, resources, HPA, PDB, Ingress + TLS, CronJob backup, RBAC, secrets solution
- [ ] App CI: lint, test, scan, build, push; GitOps tag bump; Argo CD/Flux sync to staging
- [ ] Prod promotion via PR; demonstrated rollback and zero-downtime update under load
- [ ] Monitoring stack; SLO dashboard; burn-rate alerts to chat; runbooks
- [ ] k6 capacity test + game day + postmortem
- [ ] Documentation pack + demo video; tear down or right-size to control costs

## Rubric

| Criterion | Weight |
|---|---|
| IaC quality (Terraform modules, state, environments, CI) | 20% |
| Kubernetes design (Helm, probes, resources, security, storage) | 20% |
| Delivery (GitOps, promotion, rollback, zero downtime) | 20% |
| Observability and SRE (SLOs, alerts, dashboards, load test) | 20% |
| Operations maturity (runbooks, game day, postmortem, docs, cost) | 20% |

## Stretch goals

- Policy as code (Kyverno or OPA Gatekeeper): require resource limits and non-root containers, and disallow `:latest`.
- Canary releases with Argo Rollouts, analysed against Prometheus metrics.
- Disaster-recovery drill: restore the DB from a backup into a fresh cluster, and time the RTO.
- Cost dashboards (Kubecost/OpenCost) and right-sizing.

# Sources

- [Google: microservices-demo (Online Boutique)](https://github.com/GoogleCloudPlatform/microservices-demo)
- [kube-prometheus-stack Helm chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Argo CD: Getting started](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- [Google SRE Workbook: Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [CNCF Landscape (to explore the ecosystem)](https://landscape.cncf.io/)
