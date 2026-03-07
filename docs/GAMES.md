# Parlor - Game Catalog

## Overview

Parlor aims to host a variety of multiplayer tabletop games. This document catalogs all planned games, their key attributes, and how they map to Parlor's architecture.

---

## Full Game Catalog

| Game | Type | Players | Display Mode | Hidden Info | State Model | IP Concern | Spec |
|------|------|---------|-------------|-------------|-------------|------------|------|
| **Quixx** | Roll-and-write dice | 2-5 | Peer or Jackbox | None | Consensus or Server | Rename | [QUIXX.md](games/QUIXX.md) |
| **Can't Stop** | Push-your-luck dice | 2-4 | Jackbox (primary) | None | Consensus or Server | Rename | [CANT_STOP.md](games/CANT_STOP.md) |
| **Yahtzee** | Dice categories | 1+ | Peer or Jackbox | None | Consensus or Server | Rename | [YAHTZEE.md](games/YAHTZEE.md) |
| **Farkle** | Push-your-luck dice | 2+ | Peer or Jackbox | None | Consensus or Server | None | [FARKLE.md](games/FARKLE.md) |
| **Boggle** | Word-finding | 2+ | Peer or Jackbox | Words hidden during play | Server | Rename | [BOGGLE.md](games/BOGGLE.md) |
| **Coup** | Bluffing/deduction | 2-6 | Peer or Jackbox | Hidden roles | Server | Rename + re-theme | [COUP.md](games/COUP.md) |
| **Love Letter** | Deduction cards | 2-6 | Peer or Jackbox | Hidden hand (1 card) | Server | Rename + re-theme | [LOVE_LETTER.md](games/LOVE_LETTER.md) |
| **Sushi Go** | Card drafting | 2-5 | Peer | Hidden hands | Server | Rename + re-theme | [SUSHI_GO.md](games/SUSHI_GO.md) |
| **Bang! Dice** | Hidden roles, dice | 3-8 | Peer or Jackbox | Hidden roles | Server | Rename + re-theme | [BANG_DICE.md](games/BANG_DICE.md) |
| **Kings Corner** | Solitaire-style cards | 2-4 | Peer | Hidden hands | Server | None | [KINGS_CORNER.md](games/KINGS_CORNER.md) |
| **Hearts** | Trick-taking | 4 | Peer | Hidden hands | Server | None | [HEARTS.md](games/HEARTS.md) |
| **Euchre** | Trick-taking (teams) | 4 | Peer | Hidden hands | Server | None | [EUCHRE.md](games/EUCHRE.md) |

---

## Categories

### By Game Type

**Dice Games**
- Quixx - roll-and-write
- Can't Stop - push-your-luck
- Yahtzee - category scoring
- Farkle - push-your-luck
- Bang! Dice - hidden roles + dice

**Card Games (Custom Deck)**
- Coup - bluffing/deduction
- Love Letter - micro-deck deduction
- Sushi Go - card drafting

**Card Games (Standard 52-Card Deck)**
- Kings Corner - solitaire-style
- Hearts - trick-taking
- Euchre - trick-taking (teams)

**Word Games**
- Boggle - word finding

### By Hidden Information

**No Hidden Info** (all game state is public)
- Quixx
- Can't Stop
- Yahtzee
- Farkle

These games are candidates for the **client-side consensus** architecture. No secrets to protect, clients can validate all moves independently.

**Hidden Info** (requires server to protect secrets)
- Coup (hidden roles)
- Love Letter (hidden hand)
- Sushi Go (hidden hands during drafting)
- Bang! Dice (hidden roles)
- Kings Corner (hidden hands)
- Hearts (hidden hands)
- Euchre (hidden hands)

**Minimal Hidden Info** (hidden only during a timed phase)
- Boggle (word lists hidden during play, revealed after timer)

### By Display Mode

**Jackbox Mode Recommended** (shared screen is the primary experience)
- Can't Stop - board is central, phone controller is minimal
- Boggle - grid on big screen, type words on phone

**Jackbox Mode Works Well** (enhanced by shared screen, but peer mode is fine)
- Quixx - dice on big screen, scoresheets on phones
- Farkle - dice and scoreboard on big screen
- Yahtzee - dice and scorecards on big screen
- Bang! Dice - player circle on big screen, roles on phones
- Coup - action log on big screen, hidden cards on phones

**Peer Mode Preferred** (each player needs their own full view)
- Sushi Go - need to see your hand and make picks privately
- Kings Corner - need to see board and your hand together
- Hearts - need to see trick, hand, and play cards
- Euchre - need to see trick, hand, and play cards
- Love Letter - small enough to work either way

### By IP Status

**Public Domain / No Concerns** (standard deck games or generic mechanics)
- Kings Corner
- Hearts
- Euchre
- Farkle

**Rename Only** (mechanics are fine, name is trademarked)
- Quixx
- Can't Stop
- Yahtzee
- Boggle

**Rename + Re-theme** (need original names, characters, and art)
- Coup (characters: Duke, Assassin, etc.)
- Love Letter (characters: Guard, Princess, etc.)
- Sushi Go (card types: Tempura, Sashimi, etc.)
- Bang! Dice (roles and characters)

### By Player Count

| Players | Games |
|---------|-------|
| 1+ | Yahtzee |
| 2+ | Quixx, Farkle, Boggle, Coup, Love Letter, Kings Corner |
| 2-5 | Sushi Go |
| 2-4 | Can't Stop |
| 3-8 | Bang! Dice |
| 4 (exactly) | Hearts, Euchre |

### By Team Structure

**Free-for-all** (every player for themselves)
- Quixx, Can't Stop, Yahtzee, Farkle, Boggle, Love Letter, Sushi Go, Kings Corner, Hearts

**Teams (fixed)**
- Euchre (2v2, partners across)

**Hidden teams**
- Coup (free-for-all but alliances form)
- Bang! Dice (hidden roles create implicit teams)

---

## Complexity & Build Effort

Rough estimate of implementation complexity, considering game logic, UI, and special requirements.

| Game | Logic | UI | Special Needs | Overall |
|------|-------|----|---------------|---------|
| Farkle | Simple | Simple | None | Low |
| Can't Stop | Simple | Medium (board) | Jackbox infra | Low-Medium |
| Yahtzee | Simple | Medium (scorecard) | None | Low-Medium |
| Kings Corner | Medium | Medium (card layout) | Drag-and-drop | Medium |
| Quixx | Medium | Medium (scoresheet) | Simultaneous phase 1 | Medium |
| Love Letter | Medium | Medium | Private reveals | Medium |
| Hearts | Medium | Medium | Card passing, trick-taking | Medium |
| Boggle | Medium | Medium | Dictionary/trie, path validation | Medium |
| Sushi Go | Medium | Medium | Simultaneous picks, hand rotation | Medium |
| Euchre | Medium-High | Medium | Bower logic, team play | Medium-High |
| Coup | High | Medium | Challenge/block flow, timed windows | High |
| Bang! Dice | High | High | Character abilities, role interactions | High |

---

## Suggested Build Order

### Phase 1: Foundation Games
Build the first 2-3 games to validate both display modes and the core architecture.

1. **Quixx** - First game. Validates peer mode, scoresheet UI, simultaneous player actions, dice rolling.
2. **Can't Stop** - Validates Jackbox mode, shared board rendering, minimal phone controller.
3. **Farkle** - Simple logic, reinforces dice game patterns. Tests push-your-luck flow.

### Phase 2: Card Game Foundation
Introduce card game primitives and hidden information.

4. **Kings Corner** - Standard deck, card rendering, drag-and-drop. No IP concerns.
5. **Love Letter** - Small deck, private reveals, multi-round scoring.
6. **Hearts** - Trick-taking foundation, card passing. Reusable for Euchre.

### Phase 3: Complex Games
Build on established patterns for more complex games.

7. **Euchre** - Builds on Hearts' trick-taking. Adds teams and bower logic.
8. **Sushi Go** - Card drafting, simultaneous selection, hand rotation. Re-theme needed.
9. **Coup** - Challenge/block system, timed windows, bluffing UI. Re-theme needed.

### Phase 4: Specialized
Games with unique requirements.

10. **Yahtzee** - Easy logic, but low priority since Farkle fills a similar niche.
11. **Boggle** - Requires dictionary infrastructure and word validation.
12. **Bang! Dice** - Most complex: character abilities, hidden roles, large player count.

---

## Shared Component Opportunities

Several games share mechanical patterns that can be built as reusable components:

### Dice Components
- **Dice roller** (visual + logic): Quixx, Can't Stop, Yahtzee, Farkle, Bang! Dice
- **Keep/re-roll selection**: Yahtzee, Farkle, Bang! Dice
- **Push-your-luck flow** (roll/stop decision): Can't Stop, Farkle

### Card Components
- **Standard 52-card deck**: Kings Corner, Hearts, Euchre
- **Card hand display**: All card games
- **Trick-taking engine**: Hearts, Euchre
- **Card passing**: Hearts, Sushi Go (hand rotation)

### Game Flow Components
- **Simultaneous action phase** (wait for all players): Quixx (phase 1), Sushi Go (picking), Boggle
- **Timed action windows**: Coup (challenge/block), Boggle (word finding)
- **Round/scoring cycle**: Love Letter, Sushi Go, Boggle, Hearts, Euchre

### UI Components
- **Scoreboard/leaderboard**: All games
- **Turn indicator**: All turn-based games
- **Timer display**: Boggle, Coup, any game with turn timers
- **Player circle/seating**: Bang! Dice, Euchre, Hearts (seat position matters)
