---
id: do-w10
title: Kubernetes Operations & Delivery
week: Week 10
summary: Ingress and TLS, persistent volumes and claims, Jobs and CronJobs, rolling updates and rollbacks, Horizontal Pod Autoscaling, Helm charts and values, per-environment configuration, service accounts and RBAC, and CI/CD (GitOps) to Kubernetes.
builds_on: do-w9, do-w5
leads_to: do-w11, do-p2
---

Week 9 got applications running. This week makes them **production-ready on Kubernetes**: reachable over HTTPS, storing data persistently, running batch work, updating without downtime, scaling automatically, packaged with Helm, secured with RBAC and deployed from Git.

# Lesson: Ingress, TLS and persistent storage (35 min)

### Ingress: HTTP routing into the cluster

An **Ingress controller** (ingress-nginx, Traefik, or a cloud load balancer) watches **Ingress** objects and routes external HTTP(S) traffic to Services by host and path, like the Nginx reverse proxy from week 2, but configured declaratively.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: studymate
  namespace: studymate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod      # automatic TLS
    nginx.ingress.kubernetes.io/proxy-buffering: "off"    # SSE streaming
spec:
  ingressClassName: nginx
  tls:
    - hosts: [app.example.com]
      secretName: studymate-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend: { service: { name: api, port: { number: 80 } } }
          - path: /
            pathType: Prefix
            backend: { service: { name: web, port: { number: 80 } } }
```

**cert-manager** obtains and renews Let's Encrypt certificates automatically, then stores them as Secrets. The newer **Gateway API** (Gateway + HTTPRoute) is the successor to Ingress, with richer, role-oriented routing.

### Persistent storage

Pods are ephemeral, so data needs **volumes** that outlive them:
- **PersistentVolumeClaim (PVC)**: the app's request ("10 Gi, ReadWriteOnce").
- **StorageClass**: how to provision the volume dynamically (cloud disks, local-path, Ceph).
- **PersistentVolume (PV)**: the actual provisioned storage, bound to the claim.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: uploads, namespace: studymate }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: standard
  resources: { requests: { storage: 10Gi } }
```

Stateful systems (databases, queues) use **StatefulSets**: stable Pod names (`postgres-0`), ordered rollout and a PVC per replica. Many teams still prefer **managed databases** (RDS, Cloud SQL) over running them in-cluster: backups, failover and upgrades become someone else's job.

> [!recap]
> - An Ingress (or the Gateway API) routes by host/path. cert-manager automates TLS.
> - PVC → StorageClass → PV for durable data. StatefulSets for stateful apps (or use managed DBs).

# Lesson: Jobs, rolling updates and autoscaling (35 min)

### Jobs and CronJobs

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-backup, namespace: studymate }
spec:
  schedule: "30 2 * * *"                   # same syntax as cron (week 3)
  concurrencyPolicy: Forbid                 # don't overlap runs
  jobTemplate:
    spec:
      backoffLimit: 3                       # retries
      activeDeadlineSeconds: 3600
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: ghcr.io/me/pg-backup:1.2
              envFrom: [{ secretRef: { name: backup-secrets } }]
```

**Jobs** run to completion (database migrations, report generation, batch AI evaluations). **CronJobs** schedule them.

### Rolling updates and rollbacks

Changing a Deployment's Pod template (e.g. the image tag) triggers a **rolling update**: new Pods come up, and old ones go down gradually.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%          # extra Pods allowed above the desired count during the update
      maxUnavailable: 0      # never drop below the desired count (zero downtime)
  minReadySeconds: 10
```

```bash norun
kubectl set image deploy/api api=ghcr.io/me/studymate-api:1.5.0 -n studymate
kubectl rollout status deploy/api -n studymate      # wait for success (use it in CI!)
kubectl rollout history deploy/api -n studymate
kubectl rollout undo deploy/api -n studymate        # back to the previous ReplicaSet
```

Zero-downtime needs **readiness probes** (traffic only goes to ready Pods), **graceful SIGTERM handling** (finish in-flight requests within `terminationGracePeriodSeconds`), and often a short `preStop` sleep, so load balancers stop sending traffic before the shutdown.

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api, namespace: studymate }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

The HPA formula is $\text{desired} = \lceil \text{current} \times \frac{\text{currentMetric}}{\text{targetMetric}} \rceil$, bounded by min/max, with a tolerance band to avoid flapping. CPU utilization is measured **relative to the requests**, so set requests realistically. Custom metrics (queue depth, requests per second) via KEDA or Prometheus adapters suit AI workers well (Full-Stack week 10). The **Cluster Autoscaler** or Karpenter adds nodes when Pods can't be scheduled.

> [!recap]
> - Jobs/CronJobs for batch work, with retries, deadlines and concurrency policies.
> - Rolling updates (maxSurge/maxUnavailable) + readiness + graceful shutdown = zero downtime. `rollout undo`.
> - HPA scales replicas toward a target metric. The cluster autoscaler scales nodes.

# Lesson: Helm, environments and RBAC (30 min)

### Helm: packaging Kubernetes apps

Raw YAML for many environments gets repetitive. **Helm** packages manifests as **charts**: templates plus **values**.

```text
charts/studymate/
├── Chart.yaml            # name, version, appVersion
├── values.yaml           # defaults
├── values-staging.yaml   # per-environment overrides
├── values-prod.yaml
└── templates/
    ├── deployment.yaml   # uses {{ .Values.image.tag }}, {{ .Values.replicas }} ...
    ├── service.yaml
    ├── ingress.yaml
    └── hpa.yaml
```

```yaml
# templates/deployment.yaml (excerpt)
spec:
  replicas: {{ .Values.replicas }}
  template:
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          resources: {{- toYaml .Values.resources | nindent 12 }}
```

```bash norun
helm upgrade --install studymate charts/studymate -n studymate --create-namespace \
  -f charts/studymate/values-prod.yaml --set image.tag=1.5.0 --atomic --wait
helm history studymate -n studymate
helm rollback studymate 7 -n studymate
helm template charts/studymate -f values-prod.yaml | less     # render locally to review
```

`--atomic` rolls back automatically if the upgrade fails. **Kustomize** (built into kubectl as `kubectl apply -k`) is a template-free alternative: a base plus per-environment overlays.

### Environment configuration

The same chart and the same image go to every environment. Differences live in the values files (replicas, resources, hostnames, feature flags) and the secrets. Use separate namespaces or clusters per environment.

### Service accounts and RBAC

Pods authenticate to the API server as **ServiceAccounts**. **RBAC** grants permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: config-reader, namespace: studymate }
rules:
  - apiGroups: [""]
    resources: [configmaps]
    verbs: [get, list, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: api-reads-config, namespace: studymate }
subjects: [{ kind: ServiceAccount, name: api, namespace: studymate }]
roleRef: { kind: Role, name: config-reader, apiGroup: rbac.authorization.k8s.io }
```

Role/RoleBinding are namespaced, and ClusterRole/ClusterRoleBinding are cluster-wide. **Least privilege**: most apps need **no** API access at all (`automountServiceAccountToken: false`). CI deployers get rights only to their namespace.

### CI/CD to Kubernetes, and GitOps

- **Push-based**: CI runs `helm upgrade` with namespace-scoped credentials after building the image, then `kubectl rollout status` as a deployment check.
- **GitOps (pull-based)**: a Git repository holds the desired cluster state (charts and values with image tags). **Argo CD** or **Flux** inside the cluster continuously reconcile the cluster to match Git. Deploying = a PR that bumps the image tag. Rollback = a git revert. Drift is corrected automatically.

> [!recap]
> - Helm charts = templates + values per environment. `upgrade --install --atomic`, history and rollback. Kustomize as an alternative.
> - ServiceAccounts + RBAC with least privilege; disable token automount when it isn't needed.
> - Push-based CI deploys vs GitOps (Argo CD/Flux) reconciling from Git.

# Quiz

## What issues and renews TLS certificates automatically for Ingress resources?
- [ ] kube-proxy
- [x] cert-manager (e.g. with Let's Encrypt)
- [ ] The scheduler
- [ ] etcd
> It stores the certificates as Secrets referenced by the Ingress.

## With `maxSurge: 1` and `maxUnavailable: 0`, a rolling update:
- [ ] Stops all Pods first
- [x] Adds a new Pod before removing an old one, never dropping below the desired count
- [ ] Doubles the replicas permanently
- [ ] Skips readiness checks
> That's zero-downtime rollout behaviour.

## Which workload type fits a nightly database backup?
- [ ] Deployment
- [x] CronJob
- [ ] Service
- [ ] Ingress
> Scheduled, run-to-completion work.

## An HPA targets 70% CPU. 4 Pods average 140% of their requests. Roughly how many replicas will it want?
- [ ] 2
- [ ] 4
- [x] 8
- [ ] 140
> ceil(4 × 140/70) = 8 (bounded by min/max).

## Why does HPA CPU utilization depend on resource requests?
- [x] Utilization is measured as a percentage of the requested CPU
- [ ] It doesn't
- [ ] Requests set the max replicas
- [ ] Limits are ignored by Kubernetes
> Unrealistic requests make autoscaling misbehave.

## What does `helm upgrade --install ... --atomic` add?
- [ ] Faster downloads
- [x] It installs if absent, upgrades if present, and rolls back automatically if the upgrade fails
- [ ] Encryption
- [ ] Multi-cluster deploys
> Safer releases.

## In GitOps with Argo CD, how do you deploy a new version?
- [ ] SSH into nodes
- [x] Commit the new image tag to the Git repository; Argo CD syncs the cluster to match
- [ ] kubectl edit in production
- [ ] Restart the API server
> Git is the source of truth. Rollback = revert.

## Most application Pods should have which Kubernetes API permissions?
- [ ] cluster-admin
- [x] None (disable token automount), or a minimal namespaced Role if truly needed
- [ ] Full access to Secrets
- [ ] Permission to create nodes
> Least privilege limits the damage if a Pod is compromised.

# Exercise: HPA decision function

Implement `hpa_desired(current, current_metric, target, min_r, max_r, tolerance=0.1)`:
1. `ratio = current_metric / target`
2. If `abs(ratio - 1) <= tolerance`, keep `current` (avoid flapping).
3. Otherwise `desired = ceil(current * ratio)`.
4. Clamp to `[min_r, max_r]`.
5. If `current` is 0, return `min_r`.

## Starter

```python
import math

def hpa_desired(current, current_metric, target, min_r, max_r, tolerance=0.1):
    pass
```

## Tests

```python
ns = load()
h = ns["hpa_desired"]
assert h(4, 140, 70, 2, 20) == 8
assert h(4, 74, 70, 2, 20) == 4, "within the 10% tolerance"
assert h(10, 20, 70, 2, 20) == 3
assert h(10, 5, 70, 2, 20) == 2, "clamped to min"
assert h(15, 210, 70, 2, 20) == 20, "clamped to max"
assert h(0, 100, 70, 3, 10) == 3
```

## Solution

```python
import math

def hpa_desired(current, current_metric, target, min_r, max_r, tolerance=0.1):
    if current == 0:
        return min_r
    ratio = current_metric / target
    if abs(ratio - 1) <= tolerance:
        desired = current
    else:
        desired = math.ceil(current * ratio)
    return max(min_r, min(max_r, desired))
```

The real HPA also has scale-down stabilization windows (default 5 minutes) and rate policies, so a brief dip doesn't remove Pods you'll need again in a minute.

# Sources

- [Kubernetes docs: Ingress, Gateway API, Persistent Volumes, Jobs/CronJobs](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes docs: Horizontal Pod Autoscaling (algorithm details)](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes docs: Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Helm documentation: chart template guide](https://helm.sh/docs/chart_template_guide/)
- [cert-manager documentation](https://cert-manager.io/docs/)
- [Argo CD documentation (GitOps)](https://argo-cd.readthedocs.io/) and [OpenGitOps principles](https://opengitops.dev/)
