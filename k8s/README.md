# Parlor — Kubernetes Deployment

Deployed at https://parlor.whatsdoom.com on a k3s cluster (donnie, `152.53.90.120`).

The GitHub Action builds and pushes a new image to GHCR on every push to `main`.
Deployment to the cluster is manual — port 6443 is firewalled to the innernet network only.

## Deploy a new version

```bash
kubectl rollout restart deployment/parlor -n parlor
kubectl rollout status deployment/parlor -n parlor
```

## First deploy (or after manifest changes)

```bash
kubectl apply -f k8s/
kubectl apply -f k8s/  # run twice — namespace must exist before other resources
```

## Check status

```bash
kubectl get pods -n parlor
kubectl get certificate -n parlor
kubectl logs -n parlor -l app=parlor --tail=50
```

## Tear down

```bash
kubectl delete namespace parlor  # removes everything
```

## Automating deploys (future)

Port 6443 is only reachable on the innernet network, so the GitHub Action can't
reach the cluster directly. Options when this becomes worth automating:

- **Self-hosted runner** on an innernet peer (the k3s node works)
- **Keel** — runs in-cluster, watches GHCR, triggers rollouts automatically (no runner needed)

See `docs/SCALING.md` for broader infrastructure notes.
