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

## Scaling beyond one replica (not yet implemented)

The deployment is pinned to `replicas: 1` because game state (`RoomManager`) lives
in each pod's memory and Socket.io connections are stateful. Two prerequisites must
land **before** raising the replica count, or players will be routed to pods that
don't hold their room:

1. **Sticky sessions (Traefik).** Socket.io's HTTP long-polling handshake must return
   to the same pod for the whole session. Enable cookie-based session affinity on the
   Service so Traefik pins each client to one backend:

   ```yaml
   # service.yaml — add to the Service
   annotations:
     traefik.ingress.kubernetes.io/service.sticky.cookie: "true"
     traefik.ingress.kubernetes.io/service.sticky.cookie.name: "parlor_affinity"
   ```

   Sticky sessions alone are not enough — a pod restart or rebalance still strands a
   client, and cross-pod broadcasts (`io.to(playerId)`) won't reach other replicas.

2. **Redis adapter (`@socket.io/redis-adapter`).** Wire every pod's Socket.io server to
   a shared Redis so room broadcasts fan out across replicas. This also needs a shared
   Redis-backed `RoomManager` (state is currently in-memory per pod), which is a larger
   change tracked separately.

Once both are in place, bump `replicas` and drop the single-replica comment in
`deployment.yaml`. See `docs/SCALING.md` for broader infrastructure notes.

## Automating deploys (future)

Port 6443 is only reachable on the innernet network, so the GitHub Action can't
reach the cluster directly. Options when this becomes worth automating:

- **Self-hosted runner** on an innernet peer (the k3s node works)
- **Keel** — runs in-cluster, watches GHCR, triggers rollouts automatically (no runner needed)

See `docs/SCALING.md` for broader infrastructure notes.
