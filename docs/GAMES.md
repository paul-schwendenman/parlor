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
| **Codenames** | Team word association | 4+ (teams) | Jackbox (primary) | Key card | Server | Rename | [CODENAMES.md](games/CODENAMES.md) |
| **Telestrations** | Drawing + guessing party | 4-8 | Jackbox (primary) | Drawings/guesses until reveal | Server | Rename | [TELESTRATIONS.md](games/TELESTRATIONS.md) |
| **Spades** | Trick-taking (teams) | 4 | Peer | Hidden hands | Server | None | [SPADES.md](games/SPADES.md) |
| **Welcome To** | Flip-and-write | 1-50+ | Jackbox (primary) | Sheets | Consensus or Server | Rename | [WELCOME_TO.md](games/WELCOME_TO.md) |
| **Liar's Dice** | Bluffing dice | 2-6 | Peer or Jackbox | Hidden dice | Server | None | [LIARS_DICE.md](games/LIARS_DICE.md) |
| **Skull** | Pure bluffing | 3-6 | Peer or Jackbox | Hidden coasters | Server | Rename | [SKULL.md](games/SKULL.md) |
| **The Mind** | Cooperative, real-time | 2-4 | Peer | Hidden hands | Server | Rename | [THE_MIND.md](games/THE_MIND.md) |

---

## Categories

### By Game Type

**Dice Games**
- Quixx - roll-and-write
- Can't Stop - push-your-luck
- Yahtzee - category scoring
- Farkle - push-your-luck
- Bang! Dice - hidden roles + dice
- Liar's Dice - bluffing

**Card Games (Custom Deck)**
- Coup - bluffing/deduction
- Love Letter - micro-deck deduction
- Sushi Go - card drafting
- Skull - pure bluffing

**Card Games (Standard 52-Card Deck)**
- Kings Corner - solitaire-style
- Hearts - trick-taking
- Euchre - trick-taking (teams)
- Spades - trick-taking (teams)

**Word / Party Games**
- Boggle - word finding
- Codenames - team word association
- Telestrations - drawing telephone

**Flip-and-Write**
- Welcome To - shared card flips, personal sheets

**Cooperative**
- The Mind - real-time card synchronization

### By Hidden Information

**No Hidden Info** (all game state is public)
- Quixx
- Can't Stop
- Yahtzee
- Farkle
- Welcome To (sheets are private but no competitive advantage to seeing them)

These games are candidates for the **client-side consensus** architecture. No secrets to protect, clients can validate all moves independently.

**Hidden Info** (requires server to protect secrets)
- Coup (hidden roles)
- Love Letter (hidden hand)
- Sushi Go (hidden hands during drafting)
- Bang! Dice (hidden roles)
- Kings Corner (hidden hands)
- Hearts (hidden hands)
- Euchre (hidden hands)
- Spades (hidden hands)
- Liar's Dice (hidden dice)
- Skull (hidden coasters)
- The Mind (hidden hands - the whole point)
- Codenames (key card hidden from guessers)

**Minimal Hidden Info** (hidden only during a timed phase)
- Boggle (word lists hidden during play, revealed after timer)
- Telestrations (drawings/guesses hidden until reveal)

### By Display Mode

**Jackbox Mode Recommended** (shared screen is the primary experience)
- Can't Stop - board is central, phone controller is minimal
- Boggle - grid on big screen, type words on phone
- Codenames - grid on big screen, spymasters/guessers on phones
- Telestrations - reveal plays out on big screen, drawing on phones
- Welcome To - flipped cards on big screen, sheets on phones

**Jackbox Mode Works Well** (enhanced by shared screen, but peer mode is fine)
- Quixx - dice on big screen, scoresheets on phones
- Farkle - dice and scoreboard on big screen
- Yahtzee - dice and scorecards on big screen
- Bang! Dice - player circle on big screen, roles on phones
- Coup - action log on big screen, hidden cards on phones
- Liar's Dice - bid history on big screen, dice on phones
- Skull - coaster table on big screen, choices on phones

**Peer Mode Preferred** (each player needs their own full view)
- Sushi Go - need to see your hand and make picks privately
- Kings Corner - need to see board and your hand together
- Hearts - need to see trick, hand, and play cards
- Euchre - need to see trick, hand, and play cards
- Spades - need to see trick, hand, and play cards
- Love Letter - small enough to work either way
- The Mind - need to see your hand and the pile, timing is everything

### By IP Status

**Public Domain / No Concerns** (standard deck games or generic mechanics)
- Kings Corner
- Hearts
- Euchre
- Spades
- Farkle
- Liar's Dice

**Rename Only** (mechanics are fine, name is trademarked)
- Quixx
- Can't Stop
- Yahtzee
- Boggle
- Codenames
- Telestrations
- Welcome To
- Skull
- The Mind

**Rename + Re-theme** (need original names, characters, and art)
- Coup (characters: Duke, Assassin, etc.)
- Love Letter (characters: Guard, Princess, etc.)
- Sushi Go (card types: Tempura, Sashimi, etc.)
- Bang! Dice (roles and characters)

### By Player Count

| Players | Games |
|---------|-------|
| 1+ | Yahtzee, Welcome To |
| 2+ | Quixx, Farkle, Boggle, Coup, Love Letter, Kings Corner, Liar's Dice |
| 2-4 | Can't Stop, The Mind |
| 2-5 | Sushi Go |
| 3-6 | Skull |
| 3-8 | Bang! Dice |
| 4 (exactly) | Hearts, Euchre, Spades |
| 4+ (teams) | Codenames |
| 4-8 | Telestrations |

### By Team Structure

**Free-for-all** (every player for themselves)
- Quixx, Can't Stop, Yahtzee, Farkle, Boggle, Love Letter, Sushi Go, Kings Corner, Hearts, Liar's Dice, Skull

**Teams (fixed)**
- Euchre (2v2, partners across)
- Spades (2v2, partners across)
- Codenames (2 teams, variable size)

**Hidden teams**
- Coup (free-for-all but alliances form)
- Bang! Dice (hidden roles create implicit teams)

**Cooperative**
- The Mind (all players vs the game)
- Telestrations (no competition, just fun)

---

## Complexity & Build Effort

Rough estimate of implementation complexity, considering game logic, UI, and special requirements.

| Game | Logic | UI | Special Needs | Overall |
|------|-------|----|---------------|---------|
| Skull | Simple | Simple | None | Low |
| Farkle | Simple | Simple | None | Low |
| Liar's Dice | Simple | Simple | None | Low |
| The Mind | Simple | Simple | Real-time timing, latency handling | Low-Medium |
| Can't Stop | Simple | Medium (board) | Jackbox infra | Low-Medium |
| Yahtzee | Simple | Medium (scorecard) | None | Low-Medium |
| Kings Corner | Medium | Medium (card layout) | Drag-and-drop | Medium |
| Quixx | Medium | Medium (scoresheet) | Simultaneous phase 1 | Medium |
| Love Letter | Medium | Medium | Private reveals | Medium |
| Hearts | Medium | Medium | Card passing, trick-taking | Medium |
| Spades | Medium | Medium | Bidding, bags, trick-taking | Medium |
| Boggle | Medium | Medium | Dictionary/trie, path validation | Medium |
| Sushi Go | Medium | Medium | Simultaneous picks, hand rotation | Medium |
| Codenames | Medium | Medium | Word list, team roles, Jackbox layout | Medium |
| Welcome To | Medium | Medium-High | Complex scoresheet, many actions | Medium |
| Euchre | Medium-High | Medium | Bower logic, team play | Medium-High |
| Telestrations | Medium | High | Drawing canvas, image storage, reveal flow | Medium-High |
| Coup | High | Medium | Challenge/block flow, timed windows | High |
| Bang! Dice | High | High | Character abilities, role interactions | High |

---

## Suggested Build Order

### Phase 1: Foundation Games
Build the first 2-3 games to validate both display modes and the core architecture.

1. **Quixx** - First game. Validates peer mode, scoresheet UI, simultaneous player actions, dice rolling.
2. **Can't Stop** - Validates Jackbox mode, shared board rendering, minimal phone controller.
3. **Farkle** - Simple logic, reinforces dice game patterns. Tests push-your-luck flow.

### Phase 2: Quick Wins + Card Foundation
Simple bluffing games and card game primitives.

4. **Skull** - Dead simple, validates bluffing UI patterns. Low effort, high fun.
5. **Liar's Dice** - Simple bluffing + dice, hidden info, bidding mechanic.
6. **Kings Corner** - Standard deck, card rendering, drag-and-drop. No IP concerns.
7. **Love Letter** - Small deck, private reveals, multi-round scoring.

### Phase 3: Trick-Taking Suite
Build the shared trick-taking engine, then stamp out 3 games.

8. **Hearts** - Trick-taking foundation, card passing. Reusable engine.
9. **Spades** - Reuses Hearts' engine. Adds bidding, bags, nil.
10. **Euchre** - Reuses engine. Adds teams and bower logic.

### Phase 4: Party Games
Higher-effort games with unique UI requirements.

11. **Codenames** - Team word association, Jackbox primary. Needs word list.
12. **Telestrations** - Drawing canvas, image storage, dramatic reveal. High fun payoff.
13. **The Mind** - Cooperative, real-time. Unique timing challenges in digital format.

### Phase 5: Deeper Games
More complex logic or specialized needs.

14. **Sushi Go** - Card drafting, simultaneous selection, hand rotation. Re-theme needed.
15. **Coup** - Challenge/block system, timed windows, bluffing UI. Re-theme needed.
16. **Welcome To** - Complex scoresheet, many action types. Supports huge player counts.
17. **Boggle** - Requires dictionary infrastructure and word validation.
18. **Yahtzee** - Easy logic, but lower priority since Farkle fills a similar niche.
19. **Bang! Dice** - Most complex: character abilities, hidden roles, large player count.

---

## Shared Component Opportunities

Several games share mechanical patterns that can be built as reusable components:

### Dice Components
- **Dice roller** (visual + logic): Quixx, Can't Stop, Yahtzee, Farkle, Bang! Dice, Liar's Dice
- **Keep/re-roll selection**: Yahtzee, Farkle, Bang! Dice
- **Push-your-luck flow** (roll/stop decision): Can't Stop, Farkle

### Card Components
- **Standard 52-card deck**: Kings Corner, Hearts, Euchre, Spades
- **Card hand display**: All card games
- **Trick-taking engine**: Hearts, Euchre, Spades
- **Card passing**: Hearts, Sushi Go (hand rotation)

### Game Flow Components
- **Simultaneous action phase** (wait for all players): Quixx (phase 1), Sushi Go (picking), Boggle, Welcome To, Telestrations
- **Timed action windows**: Coup (challenge/block), Boggle (word finding), Telestrations (draw/guess)
- **Bidding system**: Liar's Dice, Spades
- **Team management**: Codenames, Euchre, Spades

### Drawing / Creative Components
- **Drawing canvas**: Telestrations (reusable for any future drawing game)
- **Image storage/transmission**: Telestrations

### Word / Content Components
- **Word list management**: Codenames, Boggle, Telestrations (drawing prompts)
- **Round/scoring cycle**: Love Letter, Sushi Go, Boggle, Hearts, Euchre

### UI Components
- **Scoreboard/leaderboard**: All games
- **Turn indicator**: All turn-based games
- **Timer display**: Boggle, Coup, any game with turn timers
- **Player circle/seating**: Bang! Dice, Euchre, Hearts (seat position matters)

---

## Future Game Ideas

Games we may want to build. No full specs yet - just tracking ideas and how they'd fit the platform.

### Dice Games

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| Liar's Dice | 2-6 | Bluffing, bidding on total dice across all players | Hidden dice | Either |
| Sagrada | 2-4 | Dice drafting, fill a grid with placement constraints | None | Peer |
| Martian Dice | 2+ | Push-your-luck, Yahtzee-lite, very quick rounds | None | Either |

### Card Games (Standard Deck)

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| Spades | 4 (teams) | Trick-taking with bidding, shares engine with Hearts/Euchre | Hands | Peer |
| Cribbage | 2 | Pegging board, unique scoring, classic 2-player | Hands | Peer |
| Rummy / Gin Rummy | 2-4 | Set collection, melding runs and groups | Hands | Peer |
| President (A-hole) | 3-8 | Shedding game, social hierarchy between rounds | Hands | Either |
| Crazy Eights / UNO-style | 2-8 | Shedding, color/number matching, simple and universal | Hands | Either |
| Go Fish | 2-6 | Simple asking game, great for kids/family | Hands | Either |

### Party / Social Deduction

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| Werewolf / Mafia | 5-15 | Hidden roles, day/night cycle, discussion + voting | Roles | Jackbox |
| The Resistance / Avalon | 5-10 | Hidden traitors, team missions, no player elimination | Roles | Either |
| Skull | 3-6 | Bluffing with coasters, extremely simple rules | Hidden tiles | Either |
| Cockroach Poker | 2-6 | Bluffing, pass cards and lie about what they are | Current card | Peer |

### Strategy (Light)

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| 6 Nimmt! (Take 5) | 2-10 | Simultaneous card play, avoid taking rows | Hands | Either |
| No Thanks | 3-7 | Push-your-luck bidding with chips, very simple | Hands | Either |
| Port Royal | 2-5 | Push-your-luck card flipping + market buying | None | Either |
| For Sale | 3-6 | Two-phase auction game, very quick | Hands (phase 2) | Either |
| Welcome To | 1-50+ | Flip-and-write, everyone uses same drawn cards, no player limit | Sheets | Jackbox |
| Coloretto | 2-5 | Set collection, push-your-luck row building | None | Either |

### Word Games

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| Codenames | 4+ (teams) | Team word association, spymasters give clues | Key card | Jackbox |
| Just One | 3-7 | Cooperative, one-word clues, duplicates eliminated | Clues until reveal | Jackbox |
| Bananagrams | 2-8 | Competitive speed crossword building | Own board | Peer |
| Scrabble-like | 2-4 | Crossword tile placement on shared board | Tile rack | Peer |

### Drawing / Creative

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| Telestrations | 4-8 | Telephone + Pictionary, alternating draw/guess | Previous entries | Jackbox |
| Fake Artist | 5-10 | Everyone draws the same thing, one person doesn't know what | The prompt (1 player) | Jackbox |
| Wavelength | 2+ (teams) | Guess where a concept falls on a spectrum | Target position | Jackbox |

### Cooperative

| Game | Players | Notes | Hidden Info | Jackbox? |
|------|---------|-------|-------------|----------|
| The Mind | 2-4 | Play cards 1-100 in ascending order, no communication | Hands | Either |
| Hanabi | 2-5 | You see everyone's hand except your own, give clues | Own hand | Peer |
| The Game | 1-5 | Play cards on ascending/descending piles cooperatively | Hands | Either |
