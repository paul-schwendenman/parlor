# Parlor - Legal Considerations for Game Implementations

## Disclaimer

This document is not legal advice. It summarizes general principles around intellectual property as they relate to implementing digital versions of existing tabletop games. Consult a lawyer if you plan to distribute or monetize Parlor publicly.

---

## The Short Version

- **Game mechanics and rules cannot be copyrighted** (in the US and most jurisdictions)
- **Specific creative expression can be copyrighted** (art, flavor text, card names, rulebook prose, graphic design)
- **Game names can be trademarked** (you generally cannot call your game "Quixx" or "Coup")
- **Patents can protect novel game mechanics**, but they're rare, expensive, and expire after 20 years

The key principle: **you can implement the same gameplay, but you must use your own names, art, graphic design, and written expression.**

---

## Intellectual Property Types

### Copyright

**What it protects**: Original creative expression - artwork, written text, specific card designs, rulebook prose, graphic layout, flavor text, character names, story elements.

**What it does NOT protect**: Ideas, systems, methods of operation, game mechanics, rules of play.

**Key legal precedent**: *Baker v. Selden* (1879) - The Supreme Court ruled that a system of bookkeeping (the "useful art") described in a book could not be monopolized by copyright. The expression (the book itself) was copyrightable, but the system was not. This principle has been consistently applied to games.

**Practical meaning for Parlor**:
- You CAN implement the same dice-rolling, number-marking mechanics as Quixx
- You CANNOT copy Quixx's scoresheet graphic design pixel-for-pixel
- You CANNOT copy the rulebook text verbatim
- You CAN describe the same rules in your own words
- You SHOULD create your own scoresheet layout and visual design

### Trademarks

**What it protects**: Brand names, logos, and other identifiers that distinguish products in the marketplace.

**Relevant trademarks**:
| Game | Publisher | Trademark Status |
|------|-----------|-----------------|
| Quixx | NSV (Nürnberger-Spielkarten-Verlag) | Likely trademarked in EU/US |
| Coup | Indie Boards & Cards | Registered trademark |
| Love Letter | AEG (Alderac Entertainment Group) / Z-Man Games | Registered trademark |
| Sushi Go | Gamewright | Registered trademark |

**Practical meaning for Parlor**:
- You CANNOT call your implementation "Quixx" - you need your own name
- You CANNOT use their logos or branding
- You CAN say "inspired by Quixx" or "similar to Quixx" in a factual, non-confusing way (nominative fair use)
- Internal/private documentation can reference the real names (as we do in these docs)

### Patents

**What it protects**: Novel, non-obvious inventions, including game mechanics in some cases.

**Relevant context**:
- Game mechanic patents are relatively rare
- Most classic game mechanics are unpatented or patents have expired
- Quixx (released 2012) could theoretically have a utility patent, but roll-and-write mechanics are not novel enough to patent
- Coup, Love Letter, and Sushi Go use well-established mechanics (bluffing, deduction, card drafting)

**Practical meaning for Parlor**:
- Very unlikely that any of the target games have active patents on their core mechanics
- A patent search on the USPTO could confirm this if desired
- Even if patented, patents expire after 20 years from filing

### Trade Dress

**What it protects**: The overall visual appearance and "look and feel" of a product as a brand identifier.

**Practical meaning for Parlor**:
- Don't make your Quixx implementation look so similar to the real Quixx that someone would confuse them
- Use your own color schemes, layouts, and design language
- The Parlor brand and visual identity should be clearly distinct

---

## Game-by-Game Analysis

### Quixx (NSV, 2012)

**Mechanics**: Roll dice, mark numbers on a grid, left-to-right constraint, row locking, triangular scoring.

- Roll-and-write is a well-established genre, not unique to Quixx
- The left-to-right constraint and locking rules are mechanical - not copyrightable
- The triangular scoring table is a mathematical formula - not copyrightable
- The specific 4-row, 2-12/12-2 layout with colored rows is a design choice. The concept is fine to replicate; the specific graphic design is not.

**Risk level**: Low. Rename the game, design your own scoresheet visuals.

### Coup (Rikki Tahta, 2012)

**Mechanics**: Hidden roles, bluffing, challenging, character actions (Assassin, Duke, Captain, Ambassador, Contessa).

- Hidden role + bluffing is a common mechanic
- The specific character names (Duke, Assassin, etc.) and their abilities as a set are creative expression
- The character artwork is definitely copyrighted

**Risk level**: Low-Medium. Rename the game AND rename the characters. Keep the same mechanical abilities but give them new names and new art. Example: instead of "Duke" who collects 3 coins, call it "Baron" or "Merchant" with the same mechanical effect.

### Love Letter (Seiji Kanai, 2012)

**Mechanics**: Deck of 16 cards with numbered values and abilities, draw-and-play, last player standing or highest card wins.

- The core mechanic (tiny deck, draw one play one, player elimination) is not protectable
- The specific card names and abilities as a set are creative expression
- Many official re-themes exist (Love Letter: Batman, Star Wars, etc.) which shows the mechanic is separable from the theme

**Risk level**: Low. Rename the game, create your own themed characters with equivalent abilities.

### Sushi Go (Phil Walker-Harding, 2013)

**Mechanics**: Card drafting (pick one, pass the rest), set collection, simultaneous selection.

- Card drafting is an ancient mechanic
- The sushi theme and specific card art are copyrighted
- The specific card types (Maki Roll, Tempura, Sashimi, Dumpling, etc.) are themed names for mechanical effects

**Risk level**: Low. Rename, re-theme (doesn't have to be sushi), design your own card art. The scoring mechanics for sets can be identical.

### Booty Dice

**Mechanics**: Push-your-luck dice rolling.

- Push-your-luck is one of the oldest game mechanics
- Risk level is very low regardless of specific implementation

---

## What Parlor Needs To Do

### Required

1. **Create original names** for each game implementation
   - Don't call it "Quixx" - call it something else (e.g. "Cross", "Marks", "Row Score", etc.)
   - Same for all other games

2. **Create original visual design**
   - Own scoresheet layout and styling
   - Own card designs and artwork
   - Own color schemes (though using red/yellow/green/blue for Quixx rows is functional, not protectable)

3. **Write your own rule descriptions**
   - Explain rules in your own words
   - Don't copy rulebook text

4. **Create original character/card names** (for Coup, Love Letter, Sushi Go)
   - Same mechanical effects, different names and themes

### Recommended

5. **Add "inspired by" attribution** where appropriate
   - "Inspired by games in the roll-and-write genre" (no need to name Quixx specifically)
   - This is a courtesy, not legally required

6. **Keep the project private or personal use**
   - If it's just for your friend group and not publicly distributed or monetized, the risk is essentially zero
   - Risk only becomes meaningful if you go public AND attract the attention of publishers

7. **Document your original creative choices**
   - If ever questioned, showing that you independently created names, art, and design demonstrates good faith

---

## Risk Assessment by Distribution Model

| Model | Risk Level | Notes |
|-------|-----------|-------|
| Private, friends only, not public | Negligible | Publishers won't know or care |
| Public, free, open source | Low | Use original names/art, don't reference original games in marketing |
| Public, free, references original names | Medium | Trademark issues if you call it "Quixx" |
| Public, monetized | Medium-High | More scrutiny, need clean IP story |
| App store distribution | Higher | App stores respond to takedown requests |

---

## Precedents & Context

Many digital implementations of tabletop games exist in gray areas:

- **Board Game Arena** - Licensed implementations, pays publishers for rights
- **Tabletop Simulator** - Provides tools, community creates (often unlicensed) mods
- **Colonist.io** - Clone of Catan, was forced to rename from "Colonist" and remove Catan references
- **Dominion Online** - Licensed implementation
- **Various mobile clones** - Many exist on app stores with original names/themes, most go unchallenged unless they use the original game's name

The pattern is clear: **publishers care most about trademark (using their game's name) and direct commercial competition.** Re-themed implementations for personal use attract essentially zero enforcement.

---

## Summary

For Parlor as a personal/friends project:

1. Implement whatever mechanics you want - they're not protectable
2. Give each game your own name
3. Design your own visuals
4. Write rules in your own words
5. Re-theme characters/cards with original names
6. Don't worry about it unless you go public and commercial

The mechanics of Quixx, Coup, Love Letter, Sushi Go, and Booty Dice are all fair game. Just dress them in your own clothes.
