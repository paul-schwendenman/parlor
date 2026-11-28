---
version: 1
slug: "src-routes-games-page-svelte"
primary_target: "src/routes/games/+page.svelte"
related_targets: []
---

# /games: Browse all games

Mode: Operate. Audience: a host (or anyone at the table) choosing tonight's game before a room exists; mixed table incl. kids and older relatives. Job: narrow a growing catalogue to the games that fit this group, then read the rules or start a room. Constraints: phone and desktop equal; labelled chip rows (user choice), no counts on chips, dim options that would empty the list; URL holds filter state (`discovery.ts`); shares GameFilters with home shelf and lobby later (docs/DISCOVERY-PLAN.md phases 4-5).

## Direction contract

THESIS: The filters are the questions a host asks the table: How many of you? How long have you got? Cards or dice? Refuses the category default of a faceted sidebar of checkboxes beside a grid.

OWN-WORLD: Game Box Lid. Terracotta lid, a raised paper sheet overlapping it (like the home join sheet), mustard room-code-style number tiles for player count, espresso-pressed outline pills for the other answers, the home shelf's spine-coloured game blocks for results. Nunito 900 questions, DM Sans labels.

STORY: The visitor answers one or two questions in plain words, sees "5 games fit" update immediately, scans colour blocks it recognises from the shelf, opens How to play or Start game. Rarer filters (level, teams) wait behind More.

FIRST VIEWPORT: Lid with wordmark, Home and the search field. Sheet overlapping the lid's bottom holds the three questions as rows (question left on desktop, above on phone), More/Start over beneath. Below: "N games fit" heading with sort, then the shelf grid (2 columns desktop, 1 phone). Primary action per game: Start game. Phone: after scrolling past the sheet a sticky paper summary bar ("5 games fit · 4 players · 20–30 min" + Change) keeps the answers in view.

FORM: Ask the table, position 3 of my ordered list; seed:830b62e980532075.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
