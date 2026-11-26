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

## Required configuration: `CORS_ORIGIN`

`CORS_ORIGIN` is **required in production**. `deployment.yaml` sets it to
`https://parlor.whatsdoom.com`; keep it in sync with the host in `ingress.yaml`. It is a
comma-separated allowlist of origins (scheme + host + optional port, no path).

- **Set:** the socket server rejects any Socket.io handshake, long-polling or WebSocket,
  whose `Origin` header isn't in the list. Polling gets a 403 and the WebSocket upgrade
  is aborted with a 400. The list also drives the polling CORS headers.
- **No `Origin` header:** allowed. Browsers always send `Origin` on WebSocket upgrades
  and cross-origin requests, so these are non-browser clients (curl, bots, tests) or
  same-origin polling GETs. Non-browser clients can forge `Origin` anyway; the check
  exists to stop third-party pages from driving their visitors' browsers.
- **Unset:** any origin is accepted (the dev default), and the server logs a warning
  at startup when `NODE_ENV=production`.

## Container security

- The image runs as the unprivileged `node` user (uid/gid 1000). The pod's
  `securityContext` enforces `runAsNonRoot` with that uid/gid, drops all capabilities,
  disallows privilege escalation, and uses the `RuntimeDefault` seccomp profile. No
  service-account token is mounted.
- The root filesystem is **read-only**. Nothing writes under `/app` at runtime. The
  only writable path is `/tmp`, a 64Mi in-memory `emptyDir` that holds tsx's
  transform cache (the server still runs TypeScript through `tsx` at startup).
- To reproduce the same constraints locally:

  ```bash
  docker run --rm --read-only --tmpfs /tmp --cap-drop ALL \
    --security-opt no-new-privileges -e CORS_ORIGIN=http://localhost:3010 \
    -p 3010:3010 ghcr.io/paul-schwendenman/parlor:main
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
