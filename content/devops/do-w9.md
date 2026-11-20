---
id: do-w9
title: Kubernetes Foundations
week: Week 9
summary: Why Kubernetes, cluster architecture, declarative YAML and kubectl, namespaces, labels and selectors, Pods, Deployments and ReplicaSets, Services and discovery, ConfigMaps and Secrets, resource requests and limits, probes, and troubleshooting.
builds_on: do-w4, do-w8, do-w2
leads_to: do-w10
---

Running a few containers on one server works (week 6). Running hundreds across many machines, with self-healing, scaling and zero-downtime updates, needs an **orchestrator**. **Kubernetes** (K8s) has become the industry standard. Its central idea is the one you met in Terraform: **declare the desired state, and controllers continuously make reality match it.**

> [!tip] Practice locally
> Install **kind** (Kubernetes in Docker), **minikube** or **k3d**, plus `kubectl`. `kind create cluster` gives you a cluster in about a minute.

# Lesson: Architecture and the declarative model (30 min)

```text
                 ┌───────────── Control plane ─────────────┐
 kubectl ──────► │ kube-apiserver  ◄──► etcd (cluster state)│
 (YAML)          │ scheduler   controller-manager            │
                 └───────────────┬──────────────────────────┘
                                 │ watches/updates
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                         ▼
   Worker node              Worker node               Worker node
   kubelet + container      kubelet + runtime         kubelet + runtime
   runtime (containerd)     kube-proxy                kube-proxy
   kube-proxy  [Pods]       [Pods]                    [Pods]
```

- **kube-apiserver**: the front door. Everything (kubectl, controllers, kubelets) talks to it.
- **etcd**: a consistent key–value store holding the desired and current state.
- **scheduler**: picks a node for each new Pod (based on resource requests, constraints and affinity).
- **controller-manager**: runs **controllers**, control loops that compare the desired state to the actual state and act. For example: "the Deployment wants 3 replicas, only 2 exist → create one."
- **kubelet** (on each node): makes sure the Pods assigned to its node are running and healthy.

### The reconciliation loop

```text
observe actual state → compare with desired state → act to converge → repeat (forever)
```

This is why Kubernetes **self-heals**: a crashed Pod or a dead node is just a difference to reconcile. It's the same feedback-loop idea you'll see in autoscaling (week 10) and SLOs (week 11).

> [!recap]
> - Control plane (apiserver, etcd, scheduler, controllers) + nodes (kubelet, runtime, kube-proxy).
> - Declarative desired state plus continuous reconciliation gives you self-healing.

# Lesson: Pods, Deployments and kubectl (35 min)

- **Pod**: the smallest deployable unit: one or more containers that share the network (one IP) and volumes. Pods are **ephemeral** and replaceable. Never rely on a specific Pod.
- **ReplicaSet**: keeps N identical Pods running.
- **Deployment**: manages ReplicaSets to provide **rolling updates** and **rollbacks**. **This is what you normally create.**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: studymate
  labels: { app: api }
spec:
  replicas: 3
  selector:
    matchLabels: { app: api }              # which Pods this Deployment owns
  template:                                # the Pod template
    metadata:
      labels: { app: api, version: "1.4.0" }
    spec:
      containers:
        - name: api
          image: ghcr.io/me/studymate-api:1.4.0
          ports: [{ containerPort: 8000 }]
          env:
            - name: LOG_LEVEL
              value: info
```

```bash norun
kubectl create namespace studymate
kubectl apply -f deployment.yaml                 # declarative: create or update to match the file
kubectl get deploy,rs,pods -n studymate -o wide
kubectl describe pod <name> -n studymate         # events: scheduling, pulls, restarts
kubectl logs -f deploy/api -n studymate
kubectl exec -it deploy/api -n studymate -- sh
kubectl delete pod <one-pod> -n studymate        # watch the ReplicaSet replace it (self-healing)
kubectl scale deploy/api --replicas=5 -n studymate
```

### Namespaces, labels and selectors

- **Namespaces** partition a cluster (per team, app or environment), with their own quotas and RBAC.
- **Labels** are key/value tags on any object (`app: api`, `env: prod`). **Selectors** pick objects by label. Deployments find their Pods this way, and Services find their endpoints this way.

```bash norun
kubectl get pods -l app=api,version=1.4.0 -n studymate
```

> [!recap]
> - Pods are ephemeral. Deployments → ReplicaSets → Pods provide replicas, self-healing and rolling updates.
> - `kubectl apply -f` (declarative), `get`, `describe`, `logs`, `exec`.
> - Namespaces partition the cluster. Labels + selectors connect everything.

# Lesson: Services, configuration and resources (35 min)

### Services: stable networking for ephemeral Pods

Pod IPs change constantly. A **Service** gives a stable virtual IP and DNS name, and load-balances across the Pods matching its selector.

```yaml
apiVersion: v1
kind: Service
metadata: { name: api, namespace: studymate }
spec:
  selector: { app: api }
  ports: [{ port: 80, targetPort: 8000 }]
  type: ClusterIP            # internal only (default)
```

Other Pods reach it at `http://api.studymate.svc.cluster.local` (or just `http://api` within the same namespace), thanks to cluster DNS.

| Service type | Exposure |
|---|---|
| ClusterIP | Inside the cluster only |
| NodePort | A port on every node (mostly for testing) |
| LoadBalancer | A cloud load balancer with an external IP |
| (Ingress / Gateway API) | HTTP routing by host and path, plus TLS (week 10) |

### ConfigMaps and Secrets

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: api-config, namespace: studymate }
data:
  LOG_LEVEL: info
  FEATURE_RAG: "true"
---
apiVersion: v1
kind: Secret
metadata: { name: api-secrets, namespace: studymate }
type: Opaque
stringData:                     # base64-encoded on storage: NOT encryption
  DATABASE_URL: postgresql://app:CHANGE_ME@postgres:5432/app
```

```yaml
# in the container spec:
          envFrom:
            - configMapRef: { name: api-config }
            - secretRef: { name: api-secrets }
```

> [!warning] Kubernetes Secrets are only base64-encoded by default
> Enable **encryption at rest** for etcd, restrict access with RBAC, and keep secrets out of Git, or encrypt them with **Sealed Secrets** or SOPS, or pull them from an external store with the **External Secrets Operator** (Vault, AWS Secrets Manager).

### Requests, limits and probes

```yaml
          resources:
            requests: { cpu: "250m", memory: "256Mi" }   # guaranteed; used for scheduling
            limits:   { cpu: "1",    memory: "512Mi" }   # cap; exceeding memory → OOMKilled
          readinessProbe:                                 # ready to receive traffic?
            httpGet: { path: /health/ready, port: 8000 }
            periodSeconds: 5
          livenessProbe:                                  # stuck? restart it
            httpGet: { path: /health/live, port: 8000 }
            periodSeconds: 10
            failureThreshold: 3
          startupProbe:                                   # slow starters: hold off liveness until started
            httpGet: { path: /health/live, port: 8000 }
            failureThreshold: 30
            periodSeconds: 2
```

- **Requests** decide where Pods can fit. **Limits** cap them. A Pod that exceeds its memory limit is **OOMKilled**, and CPU is throttled. Requests = limits gives the "Guaranteed" QoS class.
- **Readiness**: failing removes the Pod from the Service endpoints (no traffic), without restarting it. Use it for dependencies like DB connectivity and warm-up.
- **Liveness**: failing restarts the container. Check only the process's own health, **never** external dependencies (otherwise a database blip restarts everything).
- **Startup**: protects slow-starting apps from premature liveness kills.

### Troubleshooting checklist

| Status / symptom | Look at |
|---|---|
| `Pending` | `kubectl describe pod`: insufficient CPU/memory, node selectors, a PVC not bound |
| `ImagePullBackOff` | Wrong image name or tag, or registry credentials (`imagePullSecrets`) |
| `CrashLoopBackOff` | `kubectl logs --previous`: the app crashes on start (config, missing secret) |
| `OOMKilled` | Memory limit too low, or a memory leak |
| Running but no traffic | Readiness failing; Service selector doesn't match the Pod labels (`kubectl get endpoints`) |

```bash norun
kubectl get events -n studymate --sort-by=.lastTimestamp | tail -20
kubectl logs <pod> --previous -n studymate
kubectl get endpoints api -n studymate
kubectl top pods -n studymate          # needs metrics-server
```

> [!recap]
> - Services give stable DNS/IP over a label selector. ClusterIP / NodePort / LoadBalancer, and Ingress for HTTP.
> - ConfigMaps for config, Secrets for secrets (encrypt and manage them properly).
> - Requests/limits; readiness vs liveness vs startup probes.
> - Troubleshoot with describe, events, logs --previous, endpoints.

# Quiz

## What does a Kubernetes controller do?
- [ ] Builds container images
- [x] Continuously compares the desired state with the actual state and acts to converge them
- [ ] Stores the cluster data
- [ ] Routes HTTP traffic
> Reconciliation loops are the heart of Kubernetes.

## Where is the cluster's desired and current state stored?
- [ ] On each Pod
- [x] etcd (accessed through the API server)
- [ ] The container registry
- [ ] The kubelet
> etcd is the consistent source of truth.

## Why shouldn't you create bare Pods for an application?
- [ ] Pods can't run containers
- [x] Bare Pods aren't recreated or updated automatically; Deployments manage replicas, self-healing and rolling updates
- [ ] Pods are deprecated
- [ ] Pods can't have labels
> Use Deployments (or StatefulSets/Jobs for other patterns).

## How does a Service know which Pods to send traffic to?
- [ ] By Pod name
- [x] By its label selector matching the Pod labels (and only Pods that are ready)
- [ ] By IP address list in YAML
- [ ] Randomly
> Check `kubectl get endpoints` when traffic doesn't flow.

## A liveness probe checks database connectivity. The DB has a 30-second blip. What happens?
- [ ] Nothing
- [x] All app containers restart unnecessarily, potentially causing a cascading outage
- [ ] Only the DB restarts
- [ ] Traffic is paused gracefully
> Put dependency checks in readiness, not liveness.

## A Pod shows `CrashLoopBackOff`. First command to run?
- [ ] kubectl delete namespace
- [x] kubectl logs <pod> --previous (and describe) to see why the last run crashed
- [ ] Increase the replicas
- [ ] Restart the cluster
> The previous container's logs explain the crash.

## Are Kubernetes Secrets encrypted by default?
- [ ] Yes, with AES-256 everywhere
- [x] No: they're base64-encoded; enable encryption at rest, restrict RBAC, and use tools like Sealed Secrets or External Secrets
- [ ] Only in the default namespace
- [ ] Only on managed clusters
> base64 is an encoding, not encryption.

## A container uses more memory than its limit. Result?
- [ ] It's throttled
- [x] It's OOMKilled and restarted
- [ ] Nothing
- [ ] The node reboots
> CPU over-use is throttled. Memory over-use gets the container killed.

# Exercise: Selector matching and reconciliation

Write two functions:
- `matches(selector, labels)`: True if every key/value in `selector` exists in `labels` (equality-based selectors).
- `reconcile(desired, pods)`: `desired` is `{"replicas": n, "selector": {...}, "template_labels": {...}}`, and `pods` is a list of `{"name", "labels", "phase"}` dicts. Consider only pods matching the selector whose phase isn't `"Failed"`. Return `{"create": k}` if there are too few, `{"delete": [names]}` (delete the **newest**, i.e. the last ones in the list) if there are too many, or `{}` if it's correct. Also include `"cleanup": [names]` for matching pods in phase `"Failed"`, when there are any.

## Starter

```python
def matches(selector, labels):
    pass

def reconcile(desired, pods):
    pass
```

## Tests

```python
ns = load()
assert ns["matches"]({"app": "api"}, {"app": "api", "version": "1"}) is True
assert ns["matches"]({"app": "api", "env": "prod"}, {"app": "api"}) is False
d = {"replicas": 3, "selector": {"app": "api"}, "template_labels": {"app": "api"}}
pods = [{"name": "api-1", "labels": {"app": "api"}, "phase": "Running"},
        {"name": "web-1", "labels": {"app": "web"}, "phase": "Running"},
        {"name": "api-2", "labels": {"app": "api"}, "phase": "Failed"}]
assert ns["reconcile"](d, pods) == {"create": 2, "cleanup": ["api-2"]}
many = [{"name": f"api-{i}", "labels": {"app": "api"}, "phase": "Running"} for i in range(5)]
assert ns["reconcile"](d, many) == {"delete": ["api-3", "api-4"]}
assert ns["reconcile"](d, many[:3]) == {}
```

## Solution

```python
def matches(selector, labels):
    return all(labels.get(k) == v for k, v in selector.items())

def reconcile(desired, pods):
    mine = [p for p in pods if matches(desired["selector"], p["labels"])]
    healthy = [p for p in mine if p["phase"] != "Failed"]
    failed = [p["name"] for p in mine if p["phase"] == "Failed"]
    action = {}
    diff = desired["replicas"] - len(healthy)
    if diff > 0:
        action["create"] = diff
    elif diff < 0:
        action["delete"] = [p["name"] for p in healthy[diff:]]
    if failed:
        action["cleanup"] = failed
    return action
```

That's a ReplicaSet controller in miniature. Kubernetes runs loops like this for Deployments, Services (endpoints), nodes and more, continuously.

# Sources

- [Kubernetes documentation: Concepts (architecture, workloads, services, configuration)](https://kubernetes.io/docs/concepts/)
- [Kubernetes: Configure liveness, readiness and startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Kubernetes: Resource management for Pods and containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [kind: Kubernetes in Docker](https://kind.sigs.k8s.io/)
- *Kubernetes Up & Running, 3rd ed.* by Burns, Beda, Hightower & Evenson
- [Learnk8s: A visual guide on troubleshooting Kubernetes deployments](https://learnk8s.io/troubleshooting-deployments)
