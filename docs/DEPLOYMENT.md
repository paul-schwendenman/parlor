# Parlor - Deployment Platform Analysis

## Requirements

Parlor's deployment needs are shaped by a few key constraints:

1. **WebSocket support** - Socket.io requires persistent connections (not just HTTP request/response)
2. **Independently deployable games** - Each game can run as its own service during development
3. **Combined app** - Mature games fold into a single deployable app
4. **Low latency** - Real-time game state updates need to feel instant
5. **Cost-effective** - This is a passion project, not a VC-funded startup
6. **Simple ops** - Minimal DevOps burden, ideally deploy-on-push

---

## Platform Comparison

### Fly.io

**Model**: Container-based, deploy Docker images to edge VMs

| Aspect | Details |
|--------|---------|
| WebSockets | Full support, native |
| Multi-service | Each game can be a separate Fly app |
| Scaling | Scale to zero (with caveats), scale up per region |
| Pricing | Free tier: 3 shared VMs, 160GB bandwidth. ~$3-5/mo per small VM after that |
| DX | `fly deploy` from CLI, Dockerfile-based |
| State | Ephemeral by default, can attach volumes for SQLite |
| Regions | Deploy close to players, multi-region possible |

**Pros**:
- Excellent WebSocket support
- Each game gets its own URL and process naturally
- Cheap for small scale
- Can attach persistent volumes for SQLite if/when needed
- Good CLI tooling

**Cons**:
- Cold starts if scaling to zero (bad for game sessions)
- Need a Dockerfile per game (some setup overhead)
- Multiple services = multiple things to monitor

**Best fit for**: Independent game deployment during development. Run each game as a separate Fly app with its own URL.

---

### Railway

**Model**: Container-based, GitHub-integrated auto-deploy

| Aspect | Details |
|--------|---------|
| WebSockets | Full support |
| Multi-service | Projects can have multiple services |
| Scaling | Auto-sleep on inactivity, wake on request |
| Pricing | $5/mo base, usage-based after ($0.000231/min vCPU, $0.000231/GB RAM) |
| DX | Connect GitHub repo, auto-deploy on push. Nixpacks or Dockerfile |
| State | Can provision Postgres, Redis as services |
| Regions | US regions primarily |

**Pros**:
- Very low friction - connect repo and go
- Monorepo support (deploy specific packages)
- Built-in Postgres/Redis provisioning
- Nice dashboard for monitoring

**Cons**:
- $5/mo minimum even for hobby use
- Sleep/wake latency for inactive services
- Fewer regions than Fly

**Best fit for**: If you want the simplest possible deploy workflow with built-in database provisioning.

---

### VPS (DigitalOcean / Hetzner)

**Model**: Rent a Linux server, run whatever you want

| Aspect | Details |
|--------|---------|
| WebSockets | Full support (you control everything) |
| Multi-service | Run all games on one server with PM2/systemd, or use Docker Compose |
| Scaling | Manual - upgrade droplet or add more |
| Pricing | DO: $6/mo (1GB RAM). Hetzner: ~$4/mo (2GB RAM, better value) |
| DX | SSH + deploy scripts, or Docker Compose + CI/CD |
| State | Full filesystem access, run any DB locally |
| Regions | Choose at creation time |

**Pros**:
- Cheapest option for running multiple games on one box
- Full control, no platform limitations
- No cold starts - server is always running
- Can run SQLite, Postgres, Redis, anything
- Combined app is just one process on the server

**Cons**:
- You manage updates, security, monitoring
- Scaling requires migration or load balancing setup
- More ops overhead than managed platforms
- No auto-deploy without CI/CD setup

**Best fit for**: Combined app deployment. One server runs the Parlor app with all games. Cheapest long-term option.

---

### Vercel + Separate WebSocket Server

**Model**: Frontend on Vercel (edge CDN), Socket.io server on a separate platform

| Aspect | Details |
|--------|---------|
| WebSockets | NOT supported on Vercel - need a separate server |
| Multi-service | Frontend per game on Vercel, shared WS server elsewhere |
| Scaling | Frontend scales automatically, WS server needs its own scaling |
| Pricing | Vercel free tier is generous for frontend. WS server cost depends on platform |
| DX | Great for SvelteKit frontend, but split deployment adds complexity |
| State | WS server holds state, Vercel is stateless |
| Regions | Vercel: global edge. WS server: wherever you put it |

**Pros**:
- Excellent frontend performance and DX
- Free frontend hosting
- Great for SSR/SSG parts of the app (landing page, game rules, etc.)

**Cons**:
- **Split deployment** - frontend and WebSocket server are separate, adds complexity
- Need CORS configuration between frontend and WS server
- Two things to deploy and manage for every change
- SvelteKit's server-side features can't easily talk to Socket.io

**Best fit for**: Only if you want the best possible static/SSR performance for non-game pages. The split deployment is a real downside for a game platform.

---

### Cloudflare Workers + Durable Objects

**Model**: Edge functions with stateful objects that live close to users

| Aspect | Details |
|--------|---------|
| WebSockets | Supported via Durable Objects |
| Multi-service | Each game could be a separate Worker, or routes within one |
| Scaling | Automatic, per-request. Durable Objects scale per room naturally |
| Pricing | Workers free tier: 100K req/day. DO: $0.15/million requests + $0.50/GB-month storage |
| DX | Different programming model (no Node.js, no Socket.io, native WebSockets) |
| State | Durable Objects have built-in transactional storage |
| Regions | Global edge, DO runs closest to first requester |

**Pros**:
- **Durable Objects are a natural fit for game rooms** - each room is a stateful object
- Extremely low latency (runs at the edge)
- Built-in persistence (DO storage survives restarts)
- Scales automatically, no server management
- Very cheap at low scale

**Cons**:
- **No Socket.io** - must use native WebSockets, rewrite the multiplayer layer
- Different runtime (not Node.js) - some npm packages won't work
- Vendor lock-in to Cloudflare's platform
- Learning curve for the Durable Objects model
- Harder to run locally for development
- SvelteKit adapter for Cloudflare exists but has limitations

**Best fit for**: If you're willing to invest in the Durable Objects model, it's arguably the best architecture for this type of app. Each game room becomes a Durable Object with its own state, WebSocket connections, and lifecycle. But it requires rethinking the multiplayer layer from scratch.

---

## Recommendation Matrix

| Priority | Recommended Platform |
|----------|---------------------|
| Fastest to ship | **Railway** - connect repo, deploy, done |
| Cheapest long-term | **Hetzner VPS** - $4/mo runs everything |
| Best architecture fit | **Cloudflare DO** - rooms as objects, but requires rewrite |
| Best for independent game deploys | **Fly.io** - each game is a separate app |
| Best for combined app | **VPS** or **Fly.io** (single service) |

## Suggested Phased Approach

### Phase 1: Development (Now)
- Run everything locally with `turbo dev`
- Each game is a standalone SvelteKit app with embedded Socket.io server
- No deployment needed yet

### Phase 2: First Deploy (Quixx ready)
- **Fly.io** for the first game - simple, supports WebSockets, free tier
- Single Fly app running the Quixx SvelteKit app + Socket.io server
- Deploy on push via GitHub Actions

### Phase 3: Multiple Games
- Each game gets its own Fly app during development
- OR consolidate onto a VPS with Docker Compose if cost becomes a concern

### Phase 4: Combined App
- `apps/parlor` deployed as a single service
- Fly.io (single larger VM) or VPS
- Individual game apps can be sunset or kept as demos

### Phase 5: Scale (If needed)
- Evaluate Cloudflare DO migration if scale demands it
- Or stay on Fly.io/VPS - these games are small-scale by nature

---

## Socket.io vs Native WebSockets

This decision is worth calling out because it affects platform choice:

### Keep Socket.io
- Already scaffolded in `@parlor/multiplayer`
- Automatic reconnection, room management, event-based API
- Works on Fly.io, Railway, VPS
- Does NOT work on Cloudflare Workers

### Switch to Native WebSockets
- Required for Cloudflare Workers/Durable Objects
- Lighter weight, no dependency
- Need to implement reconnection, rooms, and event dispatch manually (or use a lighter library like PartyKit)
- More work but more portable

### PartyKit (Alternative)
- Built on Cloudflare DO under the hood
- Provides room/connection primitives similar to Socket.io
- Much simpler DX than raw Durable Objects
- Could replace both Socket.io and the deployment platform decision
- Worth evaluating if the Cloudflare direction is appealing

---

## Decision: TBD

Start building with Socket.io locally. Deploy Quixx to Fly.io as the first test. Revisit platform choice as more games are added and real usage patterns emerge.
