# Game Discovery Plan

Started: 2026-11-27. Why: the shelf is about to grow well past today's nine games, and a single fixed-order grid (home) and list (lobby) stop working somewhere around a dozen.

Scope agreed with the user: **chips + search inline on both the home shelf and the lobby ballot, plus a full browse page.** Filters: player count, length, type, difficulty, teams.

## Decisions

- **Structured metadata, not tags.** `GameMeta` carries `kind` (one of `GAME_KINDS`), `weight` (light / medium / heavy), `format` (individual / teams / coop) and `minutes: { min, max }`. `tags` are only search keywords (mechanisms, themes) and must not repeat the structured fields; `discovery.test.ts` enforces it. Labels live in `apps/parlor/src/lib/games/discovery.ts`, not the game packages.
- **One discovery module.** Filtering, search ranking, facet counts, sort and URL state are pure functions in `discovery.ts`, shared by every surface, so "a quick card game for 5" means the same thing everywhere.
- **Length buckets use the middle of the range**: quick < 20 min, medium 20–30, long > 30. A "15–30" game is medium, not both quick and long.
- **Type chips are OR, every other facet is AND.** "Cards or dice, for 4, easy to learn."
- **Facet counts ignore the facet's own selection**, so choosing "Cards" doesn't make "Dice" read 0. Options that would empty the list are dimmed, not hidden, so chips never move under a finger.
- **Search** is prefix-per-word, every word must match, case/accent/apostrophe-insensitive ("liars" finds Liar's Dice, "card" finds every card game). Name hits outrank tags/kind, which outrank description.
- **URL is the state on home and browse** (`?q=&players=&type=&length=&level=&play=&sort=`), so filters survive back/forward and can be shared ("here's what we could play"). Junk params are dropped, never thrown.
- **The lobby's filters are per-viewer and never shared.** Voting is a suggestion and the host's pick is final; one guest narrowing their own list mustn't change anyone else's view.
- **The lobby never hides the games that matter**: the current game, your vote and the current leaders stay visible whatever the filters say (shown above the filtered list, in shelf colours). Rows stay in shelf order (LOBBY-PLAN 3.x: no reordering under a finger).
- **Player count in the lobby is automatic.** The room already knows its size; the existing "Games with too few seats" fold stays, and there is no players chip there.

## Workflow

Same as LOBBY-PLAN: one PR-sized phase at a time, agents never commit, UI phases run `/impeccable` against the target and follow DESIGN.md (One Lid, Deep Clay, Shout Once, No-Eyebrow, Ink Outline, sentence case). Verify with `pnpm check`, `pnpm lint`, `pnpm test`, and Playwright screenshots at 390×844 and 1440×900 on a fresh `pnpm dev --port 3020`. Tick boxes and add a log row after each phase.

---

## Phase 1: Metadata and discovery module ✅

- [x] `GAME_KINDS`, `GAME_WEIGHTS`, `GAME_FORMATS` and the new `GameMeta` fields in `@parlor/game-types`; `estimatedMinutes` string replaced by `minutes: { min, max }`.
- [x] All nine games migrated. Tags cleaned to keywords (e.g. Spades: trick-taking, bidding, partners, classic).
- [x] `apps/parlor/src/lib/games/discovery.ts`: `filterGames`, `searchScore`, `facetCounts`, `lengthOf`, `playerOptions` / `kindsInUse` / …, `filtersFromParams` / `filtersToParams`, labels.
- [x] `discovery.test.ts`: real catalogue + a synthetic 40-game shelf (facet counts must agree with filtering for every option).
- [x] Home card's tag line now reads from the structured fields ("Cards · Some strategy · Teams").
- [x] `docs/ADDING_GAMES.md` meta section updated.

## Phases 2 + 3: "Ask the table" filters and the browse page (`/games`) ✅

Direction chosen 2026-11-28 from an impeccable decision round (three layouts sketched, desktop and phone): **Ask the table**. The filters are the host's questions, not a facet sidebar. Contract: `apps/parlor/.impeccable/surfaces/src-routes-games-page-svelte.md`. User picks: labelled rows on phones (every option visible), no counts on chips (empty options dimmed instead).

- [x] `lib/components/discovery/GameFilters.svelte`: the question sheet. "How many of you?" as mustard room-code tiles + Any; "How long have you got?"; "Cards or dice?" (becomes "What kind of game?" once there are 3+ kinds); "More: strategy, teams" disclosure for "How much to learn?" and "Teams or free-for-all?". Questions and options only appear when some game uses them. Toggle buttons with `aria-pressed`; tapping the current answer clears it; options that would empty the list are dimmed (opacity, "(none fit)" for screen readers) but still tappable. "Start over" when anything is set. Controlled: `filters` + `onchange`.
- [x] Search lives in the page's lid, not the component (the lobby will want its own placement).
- [x] `/games`: lid (wordmark → home, "Find a game", search), the sheet overlapping the lid, "N games fit" (polite live region) + sort select, home shelf blocks two-up (one on phones). URL is the state via `replaceState` (no history entry per tap; a deliberate change from the original pushState idea). Phone and desktop: once the sheet scrolls away a sticky bar shows "5 games fit · 4 players · 20–30 min" with Change (scrolls back, focuses the sheet).
- [x] Empty state: dashed linen box, "Try loosening one answer" with one pill per answer that would bring games back, and their count ("Any number of players · 2 games"), then Start over.
- [x] Extracted `GameCard.svelte` and `CreateRoomDialog.svelte` from the home page (home now uses both; behaviour unchanged, smoke e2e passes). Home shelf links to `/games` ("Browse all 9 games").
- [x] `filterSummary()` in `discovery.ts` (+ test). E2E `e2e/browseGames.test.ts`: link from home, answers narrow + URL, tap-to-clear, search, Start over, deep link + empty state, Start game → dialog.
- Not done from the old phase 3 list: grouping results under kind headings (the shelf order already clusters them and the sketch didn't group; revisit past ~15 games).

## Phase 4: Home shelf

- [ ] Compact `GameFilters` above the grid: search + players + length + type chips.
- [ ] Up to 12 games, show them all. Past 12, show the first 8 (shelf order, or "New" first once Phase 6 lands) and a "Browse all N games" link to `/games` carrying the current filters. Any active filter or query shows the full filtered result instead of the 8.
- [ ] Keep the join sheet first and unchanged; filters must not push the shelf heading below the fold on a phone any more than today.

## Phase 5: Lobby ballot

- [ ] Compact filters (search + type + length + difficulty, no players chip) above the ballot list, collapsed behind a "Find a game" pill until the shelf has more than ~10 games that seat the room.
- [ ] Pinned "always visible" rows (current game, your vote, leaders) when the filters would otherwise hide them, with a short "Not in your filter" note.
- [ ] Filters are local `$state`, reset when the game is chosen; nothing goes to the server.
- [ ] "Games with too few seats" fold respects the same filters.
- [ ] The rules sheet's Vote / Play still work from filtered rows. E2E: two players, one filters, the other's list is unchanged.

## Phase 6: Discovery extras (later, pick as needed)

- [ ] **New on the shelf**: `addedOn` date in the catalogue entry; "New" badge for ~30 days and a "New" chip.
- [ ] **Played in this room**: the lobby persists between games, so the server can keep a per-room history; ballot can show "Played 2×" and offer "Something new" (filter to unplayed).
- [ ] **With bots**: a players toggle that also counts games the group can fill with bots (`supportsBots`, room for `MAX_BOTS`).
- [ ] **Surprise me**: pick a random game from the current filtered result.
- [ ] **Favourites** per device (localStorage, try/catch), shown as a chip.

---

## Log

| Date | Phase | Summary | Commit |
|------|-------|---------|--------|
| 2026-11-27 | 1 | Structured meta (`kind`, `weight`, `format`, `minutes`), nine games migrated, `discovery.ts` + 23 tests, home tag line, ADDING_GAMES | b8915ec |
| 2026-11-28 | 2+3 | Ask the table: GameFilters sheet, `/games` with URL state, sticky answers bar, empty state; GameCard + CreateRoomDialog extracted; e2e | phase 2+3 commit |

## Notes

- Category judgement calls (review): weights — Quixx, Crazy Eights, Kings Corner, Liar's Dice, Booty Dice light; Hearts, Spades, Euchre, Oh Hell medium. Nothing is heavy yet, so `weightsInUse` hides that chip until a game uses it (the same goes for unused kinds and the Co-op format).
- `PRODUCT.md` rules out *public room* discovery; this plan is about finding games, not strangers' rooms, so it's compatible.
