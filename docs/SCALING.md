# Scaling & Persistence

Currently the server runs as a single replica because all game state lives in-memory (`RoomManager`). This document outlines what's needed to remove that constraint.

## Current limitation

`RoomManager` is a plain JS `Map` in `@parlor/multiplayer`. Every room, player list, and game state object lives in the process. This means:

- Only 1 replica can run at a time
- A pod restart wipes all active game rooms
- No persistence across deploys

## What Redis buys us

### 1. Socket.io cross-instance messaging (`@socket.io/redis-adapter`)

Relatively small change. Swap the default in-memory Socket.io adapter for the Redis adapter so that broadcasts/emits work correctly when multiple pods are running.

```ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

### 2. Shared game state (the harder part)

Every room and its game state needs to move out of the in-process `Map` and into Redis. Key changes:

- `RoomManager` reads/writes rooms from Redis instead of a local Map
- All game state objects must be fully serializable (JSON round-trip safe)
- Mutations that need to be atomic (e.g. "add player to room") use Redis transactions or Lua scripts to avoid race conditions

### 3. Sticky sessions (middle-ground option)

Route all connections from the same room to the same pod via ingress session affinity. This avoids the state refactor but:
- A pod crash still loses all rooms on that pod
- Limits scaling flexibility
- Traefik supports this via `traefik.ingress.kubernetes.io/service.sticky.cookie: "true"`

Not recommended as a long-term solution.

## Recommended path

1. Audit game state objects for serializability — anything with class instances, functions, or circular refs needs to be flattened
2. Refactor `RoomManager` in `@parlor/multiplayer` to be backed by Redis
3. Add `@socket.io/redis-adapter`
4. Add Redis to the k8s manifests (or use a managed Redis)
5. Bump replicas in `k8s/deployment.yaml`

## k8s Redis (self-hosted sketch)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: parlor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: parlor
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

Then set `REDIS_URL=redis://redis:6379` in the parlor deployment env.

> Note: this Redis has no persistence configured. Add a PersistentVolumeClaim and `appendonly yes` if you want rooms to survive Redis restarts too.
