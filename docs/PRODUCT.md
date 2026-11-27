# Parlor - Product Documentation

<!-- impeccable:product-schema 1 -->

## Platform

web

## Vision

Parlor is a multiplayer game platform for playing tabletop games remotely with friends and family. Modeled after real card and dice games, Parlor brings game night online. Think Jackbox meets Board Game Arena - a host starts a session, shares a code/link/QR, and everyone joins on their devices.

### Core Principles

- **Zero friction to play** - No account required to join. Enter a name, type a code, and you're in.
- **Games feel like the real thing** - Faithful implementations of published rules with satisfying interactions.
- **Flexible display modes** - Some games work best Jackbox-style (shared screen + phones), others work peer-to-peer. Support both patterns per game.
- **Persistent lobbies** - Finish one game, pick another. The group stays together.
- **Independently deployable** - Each game can be developed and deployed standalone, then composed into the main Parlor app when mature.

---

## Target Audience

- Friends and family playing remotely (primary)
- Anyone with a room code/link can join - no account needed
- Jackbox-style model: a host owns/starts the game, players join freely
- No public matchmaking, discovery, or stranger-pairing - rooms are private by invitation
- The table is mixed: tech-comfortable adults, kids playing with family, and older or less technical relatives can all be in the same room. Most players are comfortable with links and codes, but no one should be required to be.

---

## Positioning

Parlor is the classic card and dice games your group already knows, played privately, with nothing to install or sign up for, in a room that stays open all evening. Four claims, all of which future work must protect:

- **Real published games.** Faithful versions of familiar card and dice games, not invented party games. Players already know the rules or can learn them in a minute.
- **Zero-friction join.** A code or link and a name. No account, no app, no download.
- **The group stays together.** One lobby carries the whole evening across many games; nobody re-joins between rounds.
- **Private, ours.** Invite-only rooms for people who know each other. No strangers, no ads, no storefront, no public discovery.

Jackbox has the join model but its own invented games; Board Game Arena has real games but accounts and public matchmaking. Parlor is the overlap.

---

## Operating Context

All four play settings are real and must work:

- **Remote, on a video call.** Everyone at home, talking over FaceTime/Zoom/Discord, with Parlor in a browser tab beside or behind the call. Voice carries the social layer, so Parlor shouldn't compete with it.
- **Same room, own phones.** Around a couch or table, each person on their phone (peer mode), looking up at each other between turns.
- **Same room, shared screen.** A TV or laptop shows public state while phones act as controllers (Jackbox mode). Read from across a room.
- **Mixed.** Some people in the room, some dialed in remotely, in the same lobby.

The room code is usually read aloud or pasted into a group chat, so it has to survive both. Sessions are evening-length, with a few games in a row and breaks in between, so reconnects and wandering away are normal, not edge cases.

---

## Evidence on Hand

- Five shipped, playable games: Quixx, Crazy Eights, Booty Dice, Liar's Dice, Kings Corner (`games/`).
- Game descriptions, player counts and play times as written in `apps/parlor/src/routes/+page.svelte`.
- An approved visual direction and its mockups (`apps/parlor/DESIGN.md`).
- **None yet:** no testimonials, user counts, press, reviews, ratings, screenshots of real sessions, logo files, or published pricing. Do not invent any of these.

---

## Product Principles

1. **Join in under a minute.** Any step added between "here's the code" and "you're in the lobby" has to earn its place against a kid or a grandparent doing it alone.
2. **The talking is the game.** Parlor carries the rules and the state; the people carry the fun. Never compete with the call or the room for attention.
3. **Faithful first, house rules second.** Published rules are the default; variants are opt-in toggles for the host.
4. **The evening, not the match.** Optimize for the group moving smoothly from game to game, and for people dropping out and coming back.
5. **Private by default.** No feature that exposes a room, a name, or a player to anyone outside the invitation.

---

## Accessibility & Inclusion

No formal standard has been set beyond ordinary good practice. The audience spans kids and older relatives as well as tech-comfortable adults, so readable text sizes, plain-language copy and errors that say how to recover matter on every screen. In Jackbox mode, public state has to be legible from across a room.

---

## Identity & Accounts

- **Default: ephemeral** - Enter a display name to join, nothing persisted
- **Future: optional accounts** - For hosts who want to track stats, save preferences, or create custom game configurations
- Accounts are never required to play as a guest

---

## Games

### Shipped Games

| Game | Type | Players | Display Mode |
|------|------|---------|-------------|
| Quixx | Roll-and-write dice | 2-5 | Peer |
| Crazy Eights | Shedding cards | 2-5 | Peer |
| Booty Dice | Push-your-luck dice | 2-6 | Peer |
| Liar's Dice | Bluffing dice | 2-6 | Peer |
| Kings Corner | Solitaire-style cards | 2-4 | Peer |

### Planned Games

| Game | Type | Players | Display Mode |
|------|------|---------|-------------|
| Coup | Bluffing/deduction cards | 2-6 | TBD |
| Love Letter | Deduction cards | 2-6 | TBD |
| Sushi Go | Drafting cards | 2-5 | TBD |

### Game Rules Policy

- Implement exact published rules by default
- Rule variants and house rules may be added per game as configurable options toggled by the host

### Display Modes

Each game declares which display modes it supports:

- **Peer mode** - Every player sees the full game on their own device. No shared screen needed.
- **Jackbox mode** - A shared "host screen" (TV/laptop) shows public game state. Players interact on their phones as controllers. Audio/sound effects are possible on the host screen.

The host selects the display mode when starting a game (if the game supports both).

---

## Lobby System

### Room Lifecycle

1. **Create** - Host creates a lobby (optionally selecting a game, or picking one later)
2. **Share** - Room code, QR code, and share link are all available
3. **Join** - Players join by any method, enter a display name
4. **Configure** - Host can change game, toggle rule variants, set options (turn timers, etc.)
5. **Play** - Host starts the game
6. **Finish** - Game ends, lobby persists. Host can start another game or switch games.
7. **Dissolve** - Lobby is destroyed when all players leave or after inactivity timeout

### Join Mechanisms

- **Room code** - Short alphanumeric code (currently 6 characters, `ROOM_CODE_LENGTH` in `@parlor/game-types`), easy to say out loud
- **Share link** - URL with embedded room code, shareable via native share sheet / messaging
- **QR code** - Displayed on host screen or in lobby, scannable by phone camera

### Lobby Persistence

Lobbies persist between games. After a game finishes, the group can:
- Play the same game again
- Switch to a different game
- Adjust settings

Players do not need to re-join between games.

### Game Selection Flows

Two entry points, both supported:
1. **Lobby first** - Create/join a lobby, then the host picks a game from within the lobby
2. **Game first** - Browse games, select one, then create/join a lobby for that game

---

## Player Experience

### Reconnection

- Players who lose connection are auto-reconnected with state restored
- Timeout window (~60 seconds) before a disconnected player is removed
- Reconnected players see current game state immediately

### Spectators

- Supported per game/lobby (some games may disable spectators)
- Spectators can join a room and watch without participating
- Spectators see public game state only (no hidden hands)

### Chat

- Available everywhere (lobby and during gameplay)
- Non-intrusive - always accessible but never in the way
- Text-based, not a priority feature but present

### Turn Timers

- Optional per lobby, configurable by the host
- When enabled, players have a time limit per turn
- Behavior on timeout is game-specific (auto-pass, random action, etc.)

### Bot Players

- Implemented for some games: the host can add and remove bots in the lobby when the selected game supports them; not required for every game
- Most important for games with rigid player count requirements
- Bots should follow the same game interface as human players

---

## Technical Architecture

### Monorepo Structure

```
parlor/
  packages/
    game-types/       # Shared TypeScript types and interfaces
    multiplayer/      # Socket.io client/server, room management
    ui/               # Shared Svelte component library
    game-engine/      # Core game lifecycle, state management patterns (future)
  games/
    quixx/            # Standalone SvelteKit app for Quixx
    coup/             # Standalone SvelteKit app for Coup
    ...
  apps/
    parlor/           # Combined app - hosts all mature games with selection menu
```

- **Tooling**: pnpm workspaces + Turborepo
- **Language**: TypeScript throughout
- **Frontend**: Svelte 5 (SvelteKit for apps)
- **Realtime**: Socket.io
- **Styling**: Tailwind CSS
- **Linting**: ESLint + Prettier (with Svelte plugins)
- **Testing**: Vitest (unit) + Playwright (E2E)

### Game as Package + Standalone App

Each game is developed as a standalone SvelteKit app under `games/`. It has:
- Its own dev server, routes, and deployment
- Dependencies on shared packages (`@parlor/game-types`, `@parlor/multiplayer`, `@parlor/ui`)

When a game is mature ("fully cooked"), it gets integrated into `apps/parlor` - the combined app that hosts all games with a selection menu and shared lobby system.

Games expose their logic and UI components as importable modules so the combined app can mount them.

### State Management Architecture

Games can use different state authority models depending on their needs. Three architectures are documented below. Each game declares which model it uses.

#### Option A: Server-Authoritative

```
Client --> sends action --> Server validates --> broadcasts new state --> all Clients
```

- Server holds canonical game state
- Clients send action intents (e.g. "mark cell 3,4")
- Server validates legality, applies the action, computes new state
- Server broadcasts the new state (filtered per player for hidden info)
- **Pros**: Simple, cheat-proof, easy to reason about
- **Cons**: Requires a server process, latency on every action
- **Best for**: Games with hidden information (Coup, Love Letter), complex validation

#### Option B: Client-Side Consensus (Raft-inspired)

```
Client --> proposes action --> other Clients vote/validate --> committed if majority agrees
```

- No central server holding game state (server is relay only)
- One client is elected "leader" (similar to Raft leader election)
- Leader proposes state transitions, other clients validate and ack
- If leader disconnects, a new leader is elected
- State is replicated across all clients
- **Pros**: No server game logic needed, works peer-to-peer, resilient to server issues
- **Cons**: More complex, harder to handle hidden information, requires client-side validation
- **Best for**: Open-information games (Quixx, Booty Dice) where all state is public
- **Hidden info approach**: Clients could commit hashed values that are revealed later (commit-reveal scheme)

##### Consensus Protocol Sketch

1. **Leader election**: When a game starts or a leader disconnects, clients run an election. Highest priority (e.g. by join order) wins. Heartbeat-based failure detection.
2. **Action proposal**: The acting player sends an action to the leader. Leader validates against current state.
3. **Log replication**: Leader appends the action to its log, broadcasts to all clients. Clients validate independently and ack.
4. **Commit**: Once majority ack, the action is committed. Leader broadcasts commit confirmation.
5. **State recovery**: New/reconnecting clients receive the full action log and replay to derive current state.

##### Open Questions for Consensus Model

- How to handle hidden information without a trusted server (commit-reveal? encrypted state?)
- Should the relay server also maintain state as a "voter" for tie-breaking?
- Network partition handling - what if 2 of 4 clients lose connection?
- Performance with large action logs - snapshot/compaction strategy?

#### Option C: Hybrid

- Server-authoritative for hidden information and validation
- Client-side for UI state, animations, optimistic updates
- Server acts as one voter in a consensus model, providing a trust anchor

**Default recommendation**: Start with server-authoritative for Quixx (simple, proven). Explore consensus model as an alternative architecture for games with fully public state.

### Deployment Options

Deployment target is TBD. Documented options:

| Platform | Pros | Cons | Notes |
|----------|------|------|-------|
| **Fly.io / Railway** | Container-based, easy multi-service, WebSocket support | Cost per service | Good for independently deployed games |
| **VPS (DigitalOcean)** | Full control, single server, cheap | Manual ops, scaling | Good for combined app |
| **Vercel + separate server** | Great frontend DX, edge CDN | Socket.io needs separate server | Split deployment complexity |
| **Cloudflare Workers + Durable Objects** | Edge-first, great latency, built-in state | Different programming model, vendor lock-in | Durable Objects are natural fit for rooms |

Each game being independently deployable means it needs its own server process (or serverless function) for the Socket.io backend. The combined app consolidates these into a single server with namespaced Socket.io connections.

### Database / Persistence

- **Current**: In-memory (rooms and state live in server memory)
- **Future**: Add persistence when needed for:
  - Game history and replay
  - Player stats and leaderboards
  - Lobby recovery after server restarts
  - Account data
- DB choice deferred - will evaluate SQLite (single server) vs Postgres (multi-instance) when the time comes

### Reconnection Architecture

- Socket.io's built-in reconnection with `connectionStateRecovery`
- Server keeps disconnected player state for a timeout window (~60s)
- On reconnect, client receives a state snapshot to restore their view
- Player marked as `connected: false` during disconnection (other players see status)

---

## UI & Design

### Responsive Design

- Mobile and desktop are both first-class
- Responsive layouts that work on phones, tablets, and desktops
- Touch-friendly interactions (tap, swipe) that also work with mouse/keyboard

### Visual Direction

- Leaning **cozy / warm** - warm tones, soft textures, game-night atmosphere
- Validated with mockups and committed on 2026-11-27; the visual system lives in `apps/parlor/DESIGN.md`
- Consistent across all games via `@parlor/ui` shared components

### Animations

- **Moderate polish** - Satisfying animations for key game moments (dice rolls, card plays, turn transitions)
- Not over-the-top - functional and delightful without being slow
- CSS transitions and Svelte transitions as primary tools

### Audio

- Silent by default for now
- Future: optional sound effects on host/central display in Jackbox mode
- No background music planned initially

### Component Library (`@parlor/ui`)

Shared Svelte components used across all games:
- Buttons, modals, toasts (already scaffolded)
- Lobby UI (player list, room code display, QR code, share button)
- Game chrome (turn indicator, timer, scoreboard shell)
- Card and dice primitives (reusable across games)
- Chat panel

Styled with Tailwind CSS. Games can extend with game-specific components.

---

## Quixx - First Game Spec

### Overview

Quixx is a roll-and-write dice game for 2-5 players. Players mark numbers on four colored rows, trying to score the most points.

### Rules (Standard Published)

- 6 dice: 2 white, 1 red, 1 yellow, 1 green, 1 blue
- 4 rows on each player's scoresheet:
  - Red: 2-12 (left to right, ascending)
  - Yellow: 2-12 (left to right, ascending)
  - Green: 12-2 (left to right, descending)
  - Blue: 12-2 (left to right, descending)
- Active player rolls all 6 dice
- **White dice sum**: Any/all players may mark this number on any row
- **Colored combos**: Active player only may mark one white + one colored die sum on the matching colored row
- Numbers must be marked left-to-right (skip allowed, but can never go back)
- **Locking a row**: If a player marks the last number in a row AND has 5+ marks in that row, the row is locked for everyone and the corresponding colored die is removed
- **Penalty**: If the active player marks nothing on their turn, they take a penalty (-5 points)
- **Game end**: When 2 rows are locked OR a player takes their 4th penalty
- **Scoring**: Per row: 1 mark = 1pt, 2 = 3pt, 3 = 6pt, 4 = 10pt, 5 = 15pt, 6 = 21pt, 7 = 28pt, 8 = 36pt, 9 = 45pt, 10 = 55pt, 11 = 66pt, 12 = 78pt. Minus 5 per penalty. Locked row bonus: +1 mark (the lock itself counts).

### Quixx-Specific Features

- **Dice rolling**: Configurable - active player rolls on phone, server auto-rolls, or central screen rolls
- **Scoresheet**: Each player has their own interactive scoresheet on their device
- **Timer**: Optional per-turn timer (host configurable)
- **Spectators**: Can watch and see all scoresheets

---

## Dev Process

### Testing Strategy

- **Unit tests (Vitest)**: Game logic, state machines, validation rules
- **E2E tests (Playwright)**: Critical user flows - create lobby, join, play a turn, finish a game
- **Game logic tests are the priority** - UI tests are secondary

### CI/CD

- TBD - likely GitHub Actions
- Lint, type-check, test on PR
- Auto-deploy on merge to main (once deployment target is chosen)

### Code Style

- ESLint + Prettier with Svelte plugin
- TypeScript strict mode
- Svelte 5 runes (`$state`, `$derived`, `$effect`)

---

## Open Questions & Future Ideas

- [x] Final visual design direction: "The Game Box Lid", chosen from mockups 2026-11-27 (see `apps/parlor/DESIGN.md`)
- [ ] Deployment platform selection
- [ ] Database selection (when persistence is needed)
- [ ] Consensus model deep dive - prototype for Quixx?
- [ ] Account system design (when ready)
- [ ] Game submission/creation tools for hosts
- [ ] Native app wrapper (PWA) - planned for later
- [ ] Audio/sound design for Jackbox-mode games
- [ ] Leaderboards and stats persistence
- [ ] Game replay / history viewing
