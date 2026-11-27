---
name: Parlor
description: Game night, anywhere. A printed, outlined, box-art system for remote tabletop play.
colors:
  terracotta: "#C4663A"
  terracotta-deep: "#A9532D"
  terracotta-press: "#8F4526"
  forest: "#4A7C59"
  forest-deep: "#2F5A3E"
  mustard: "#D4A843"
  mustard-tint: "#F3E2B6"
  espresso: "#3B2F2F"
  cream: "#FDF6EC"
  linen: "#F5EDE0"
  paper: "#FFFFFF"
  ink-muted: "#71625A"
  danger: "#991B1B"
typography:
  display:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "4.75rem"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  name:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.25
  code:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0em"
    fontFeature: "\"tnum\""
  button:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  tile: "10px"
  field: "12px"
  row: "14px"
  block: "18px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.cream}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "56px"
  button-accent:
    backgroundColor: "{colors.terracotta-deep}"
    textColor: "{colors.cream}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-accent-hover:
    backgroundColor: "{colors.terracotta-press}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "46px"
  room-code-tile:
    backgroundColor: "{colors.mustard}"
    textColor: "{colors.espresso}"
    typography: "{typography.code}"
    rounded: "{rounded.tile}"
    height: "58px"
  input-code:
    backgroundColor: "{colors.mustard-tint}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.field}"
    height: "56px"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.espresso}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "50px"
  player-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.espresso}"
    typography: "{typography.name}"
    rounded: "{rounded.row}"
    padding: "8px 12px 8px 8px"
  chip-ready:
    backgroundColor: "{colors.forest-deep}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-waiting:
    backgroundColor: "transparent"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  lid-header:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.cream}"
    padding: "18px 20px 24px"
  game-panel:
    backgroundColor: "{colors.forest-deep}"
    textColor: "{colors.cream}"
    rounded: "{rounded.block}"
    padding: "14px 16px"
---

# Design System: Parlor

## Overview

**Creative North Star: "The Game Box Lid"**

Parlor should feel like the lid of a well-made board game: printed in flat colors, outlined in ink, with lettering you can read from across the room. Each screen is a box you open. A terracotta lid sits on top and carries the wordmark and the room code. Below it, the contents are laid out on cream: outlined player rows, a felt-green panel for tonight's game, and colored blocks for each game on the shelf. It's warm because the palette is earthy (clay, felt, mustard, espresso ink on cream stock), and it's playful because the type is heavy and the shapes are chunky and round.

Density is low and the targets are large. Parlor is played on phones held at arm's length and on laptops propped on a kitchen table, usually while people are also talking to each other. So everything is generous and every action is a big, obvious pill. Hierarchy comes from weight and color blocks, not from fine grey type or subtle depth. Expression sits in a few signature moves: the lid, the letter-tile room code, the ink outline and the color-blocked game shelf. Everything else stays plain so those moves read clearly.

**Implementation status.** The Parlor app shell (home, lobby, game frame) and the shared `@parlor/ui` components follow this system. Game boards under `games/*` are migrated to the shared board kit one game at a time (Crazy Eights and Kings Corner done 2026-11-27); where a board and this file disagree, this file wins. See Game boards.

**Key Characteristics:**
- Terracotta "lid" header on every main screen, outlined at the bottom in ink.
- A 2–2.5px espresso outline on every surface that holds content; none on the cream ground.
- Pill-shaped buttons; Nunito 900 for anything that names a thing or an action.
- The room code is always shown as individual mustard letter tiles.
- Flat at rest. Shadows only for things that physically sit on top of the page.
- Each game gets a solid color block, rotating through the palette like box spines on a shelf.

## Colors

An earthy printed palette: clay, felt, mustard and espresso ink on cream stock, used as solid color blocks rather than tints or gradients.

### Primary
- **Kiln Terracotta** (`terracotta`): The lid. The full-width header block on main screens, and the accent on the shelf. It's a surface color, not a text-bearing button color. Cream text on it reaches only 3.69:1, so text on it must be 24px+ or 19px bold+ (wordmark, tagline, headings).
- **Deep Clay** (`terracotta-deep`): Every terracotta button, chip or small text-bearing surface (Start a room, accent actions, the shelf's clay block). Cream on it reaches 4.94:1.
- **Fired Clay** (`terracotta-press`): Hover and pressed state for Deep Clay surfaces.

### Secondary
- **Card-Table Felt** (`forest-deep`): Tonight's game panel, the "Ready" chip and the felt block on the shelf. It's the "go" color: being ready and having a game chosen are both shown in felt.
- **Garden Forest** (`forest`): Small non-text marks only (status dots, ready indicator fills next to text). Too light for body text on cream.

### Tertiary
- **Dice Mustard** (`mustard`): The room-code tiles and the mustard block on the shelf. Always with espresso text (5.8:1), never cream.
- **Butter** (`mustard-tint`): The background of the room-code input, so typing a code feels like filling in the tiles.

### Neutral
- **Espresso Ink** (`espresso`): All primary text, every outline, the primary button fill and count badges. It is the ink the whole lid is printed with.
- **Cream Stock** (`cream`): The page ground and the text color on every dark surface.
- **Linen** (`linen`): A secondary surface for placeholder or less important rows (bot seats, a shelf block that needs a light option).
- **Paper** (`paper`): Content surfaces that sit on cream: player rows, the join sheet, text inputs.
- **Faded Ink** (`ink-muted`): Secondary text (descriptions' asides, hints, metadata). Passes 4.5:1 on cream, linen, paper and butter. The only grey-ish text color allowed.
- **Spilled Wine** (`danger`): Error text and destructive confirmation. 7.74:1 on cream.

### Named Rules
**The Deep Clay Rule.** Text smaller than 24px (or 19px bold) never sits on Kiln Terracotta. Use Deep Clay for anything text-bearing that needs to read as terracotta.

**The One Lid Rule.** Each screen has at most one Kiln Terracotta block, and it sits at the top. Terracotta further down the page is Deep Clay, used on buttons and the shelf.

**The Ink-Only Text Rule.** Text is espresso, cream, or Faded Ink. No stone greys (#a8a29e, #c7c2be, #78716c) and no Tailwind slates.

## Typography

**Display Font:** Nunito (with system-ui, sans-serif)
**Body Font:** DM Sans (with system-ui, sans-serif)

**Character:** Nunito at 800–900 is the printed box-art lettering: round, heavy and friendly. It names things: the wordmark, headings, game names, player names, codes and primary actions. DM Sans is the small print on the back of the box: rules, descriptions, hints and labels.

### Hierarchy
- **Display** (900, 4.75rem, 0.9): The PARLOR wordmark on the home lid. Uppercase, tight tracking. Once per app, not per screen.
- **Headline** (900, 1.875rem, 1.05): Section headings that open a region ("Or open a new box").
- **Title** (900, 1.5rem, 1.1): Card and panel headings (Join a room, tonight's game). Game names on shelf blocks run one step larger (1.75rem, same weight).
- **Name** (800, 1.0625rem): Player names in rows.
- **Code** (900, 1.875rem, tabular): Room-code letters inside tiles; also the code input at 1.625rem with 0.32em tracking.
- **Button** (900, 1.1875rem, +0.02em): The primary action on each screen, set in uppercase. Secondary buttons use DM Sans 700 at 0.9375rem in sentence case.
- **Body** (400, 1rem, 1.45): Rules text and long descriptions, kept to 65ch.
- **Body small** (500, 0.875rem, 1.45): Game descriptions, hints.
- **Label** (700, 0.8125rem): Form labels, chips, status, metadata.

### Named Rules
**The Shout Once Rule.** Uppercase Nunito 900 is reserved for the wordmark and the single primary action on a screen (JOIN, START GAME). Everything else is sentence case.

**The No-Eyebrow Rule.** No small uppercase kicker above a heading or value ("ROOM CODE", "PLAYING"). The thing speaks for itself. Add a plain sentence below it if context is needed.

## Layout

Single column, centered, phone-first. Main content sits in a 20px gutter (`xl`). Lobby and game chrome are capped at 480px wide; the home page at 800px, where the game shelf may become a two-column grid. The lid header always spans the full width of the viewport, edge to edge, so the screen reads as one box.

Spacing is tight inside groups and wide between them: 8px (`sm`) between player rows, 12px (`md`) between fields, 16px (`lg`) between panels, 28px (`2xl`) between major regions. On the home page, the join sheet overlaps the bottom of the lid by 68px, which ties the two together.

Actions sit at the bottom of the lobby (`margin-top: auto`), in thumb reach: the primary pill full-width, with secondary pills in a two-column grid beneath it. The hint explaining why Start is disabled sits directly above the button it explains.

The existing breakpoint is 600px: below it, join fields stack and the shelf is one column. Touch targets are at least 44px everywhere; hover-revealed actions must always be visible on `(hover: none)` devices.

## Elevation & Depth

Flat by default. Depth comes from color blocks and ink outlines, the way a printed box shows hierarchy, not from shadows. A shadow means "this is physically on top of the page": the raised join sheet overlapping the lid, a modal, a toast. Interactive surfaces may lift on hover or touch (a 2px translate plus a soft shadow) to show they can be picked up, then settle back.

### Shadow Vocabulary
- **Raised sheet** (`box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16)`): The join sheet overlapping the lid; any panel that physically overlaps another.
- **Modal** (`box-shadow: 0 8px 32px rgba(59, 47, 47, 0.15)`): Dialogs over an espresso scrim at 50% (`rgba(59, 47, 47, 0.5)`), never a black scrim.
- **Lift** (`box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12)`, `translateY(-2px)`): Hover/touch on pickable surfaces (shelf blocks, picker cards).
- **Felt well** (`box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.25)`): Optional, on felt surfaces only, to suggest a recessed table.

### Named Rules
**The Flat Box Rule.** Nothing casts a shadow at rest unless it overlaps something. No ambient shadows on ordinary cards.

**The No Block Shadow Rule.** Outlines are ink, shadows are soft. No zero-blur offset shadows (`4px 4px 0`). The printed look comes from the outline, not a fake neo-brutalist drop.

## Shapes

Chunky and round. Every content surface has a full espresso outline (2px on rows, chips and buttons; 2.5px on sheets and shelf blocks; 3px on the lid's bottom edge), never a partial or one-sided border. Corners scale with the size of the object: 10px tiles, 12px fields, 14px rows, 18px blocks, 20px sheets, and full pills for every button and chip. Avatars and status dots are circles. A dashed outline marks a seat that isn't a real person (bot rows).

### Named Rules
**The Ink Outline Rule.** If it holds content, it has a full outline in espresso. If it's the ground, it has none. A bar down one side of a box is never the answer: use a full outline, a fill, or a leading icon.

## Components

### Buttons
Every button is a pill.
- **Shape:** Full pill (999px).
- **Primary:** Espresso fill, cream Nunito 900 uppercase, 56px tall, full-width in the action area, 2px espresso outline. One per screen (JOIN, START GAME).
- **Accent:** Deep Clay fill, cream text, 44–52px. For "Start a room" and other positive actions on light surfaces. Hover → Fired Clay.
- **Outline:** Transparent, 2px espresso outline, espresso DM Sans 700, 46px. Not ready, Add bot, How to play, Change, Leave room. On dark surfaces (lid, felt, dark shelf blocks) the outline and text flip to cream.
- **Hover / Focus:** Hover darkens fills by one step or tints outlines with a 6% espresso fill. Focus is a 3px espresso ring offset by 2px (cream on dark surfaces). Press scales to 0.98 over 100ms.
- **Disabled:** 50% opacity, `not-allowed` cursor, with a hint sentence above the button saying why.

### Room code
The signature component. The code is shown as six separate mustard tiles (10px corners, 2px espresso outline, 58px tall, Nunito 900 letters) in an equal-width grid, with a cream outline pill below reading "Copy invite link" with a link icon. The tile group gets `aria-label="Room code KQ7MPD"`. When typing a code, the input uses the same idea: a butter-filled, ink-outlined field with wide-tracked Nunito 900.

### Chips
- **Ready:** Felt fill, cream DM Sans 700 12px, pill.
- **Waiting:** Transparent, 1.5px espresso outline, espresso text.
- **Count badge:** Espresso fill, cream Nunito 800, pill, beside a heading.
- **Metadata (shelf):** 1.5px outline in the block's text color, tabular numerals ("2–4 · 15–25m").

### Player rows
Paper fill, 2px espresso outline, 14px corners. A 36px color avatar with the player's initial (cycling Kiln Terracotta, Felt, Mustard and Espresso), the name in Nunito 800, roles as Faded Ink text after it ("· host · you"), and the status chip on the right. Bot rows use linen with a dashed outline, an espresso avatar with a robot glyph, and an icon-only remove button (aria-labelled).

### Game panel (tonight's game)
A felt block with a 2px espresso outline and 18px corners. The game name in cream Nunito 900 24px, and a cream outline "Change" pill for the host.

### Game shelf
Each game is a solid color block: 2.5px espresso outline, 18px corners, 18px padding. Blocks rotate through Felt, Dice Mustard, Deep Clay, Espresso and Linen. The text color on each block is cream or espresso, whichever passes. The block holds the game name (Nunito 900 28px), a metadata chip, a description (DM Sans 500 14px) and two pills: outline "How to play" and a solid "Start a room" in the block's contrasting color.

### Inputs / Fields
- **Style:** Paper fill, 2px espresso outline, 12px corners, 50px tall, DM Sans 16px. The label sits above the field in DM Sans 700 13px, as a real `<label>`.
- **Focus:** 3px espresso focus ring, offset 2px.
- **Placeholder:** Faded Ink, the same as secondary text. Placeholders must still pass 4.5:1, and the label above carries the meaning.
- **Error:** Spilled Wine text below the field naming the problem and the fix; the outline stays espresso.

### Lid header / navigation
A terracotta block running edge to edge with a 3px espresso bottom edge. The wordmark sits at the left (PARLOR, Nunito 900, links home), with a cream-filled, ink-outlined "Leave room" pill on the right when the player is in a room. Pills on the lid are always cream-filled: cream text on Kiln Terracotta would break the Deep Clay Rule. The home lid holds the 76px display wordmark and the tagline. The connection-status bar sits above the lid: mustard for disconnected, Deep Clay for reconnecting and Spilled Wine for errors, always with text in the passing color.

## Game boards

Every game is a box in the same collection. The boards don't share a colour scheme, but they share the way the box is printed, so moving from Crazy Eights to Quixx feels like opening a different box from the same shelf.

**Shared by every board** (built once, in `@parlor/ui`):
- **Turn banner** (`TurnBanner`): the first thing on every board. Felt with cream text when it's your move, paper while you wait. The title is Nunito 900 ("Your turn", "Margaret's turn", "Pick a suit"), and one optional sentence of DM Sans tells you what you can do right now.
- **Seats** (`SeatChip`): other players as outlined pills with the seat-coloured avatar from the lobby (robot glyph for bots), the name in Nunito 800 and one game stat ("7 cards"). The seat whose turn it is turns felt. A disconnected seat is dashed on linen.
- **How to play**: a cream "?" button on the game lid, beside Leave room. Boards don't carry their own rules buttons.
- **Game over** (`GameOver`): a felt result block (mustard trophy, "You win!"), standings as outlined rows with place, avatar and the game's own measure, then PLAY AGAIN (the one shouted action) and an outline "Back to lobby".
- **Buttons** are `Button` pills; the board's single primary move is `shout`.
- **Seat colours** come from `seatTone(index)`, so a player has the same colour in the lobby, on the board and in the standings.

**Owned by each game:**
- **Its colour** is its shelf spine on the home page: Quixx felt, Crazy Eights mustard, Booty Dice clay, Liar's Dice espresso, Kings Corner linen. It shows up on the game's printed pieces (card backs, dice, sheet headers), not as a second lid.
- **Its playing surface**: card games play on `Felt` (felt-well inset, ink outline, 18px corners), with the stock as `DrawPile` and the hand as `CardHand` (one overlapping row, selected card lifts on butter); Quixx on a printed paper scoresheet; the pirate games on espresso "night table" blocks with cream text. A surface is always an outlined block on cream, never a full-page theme.
- **Its pieces**: cards are `PlayingCard` (paper stock, ink outline, Nunito index top-left, drawn SVG suits, backs printed in the game's colour via `--card-back`). A mustard ring always means "you can act here" (a drawable stock, a pile a picked card can go to); butter means "picked up". Dice and sheets follow the same printed-ink rules.

**The Collection Rule.** If two games show the same kind of thing (whose turn it is, who's at the table, how it ended), they show it with the same component. A game's own identity goes into its pieces and its surface, never into the chrome around them.

## Do's and Don'ts

### Do:
- **Do** outline every content surface in espresso (2–2.5px) and leave the cream ground un-outlined.
- **Do** use Deep Clay (#A9532D) for any terracotta surface carrying text under 24px; Kiln Terracotta is for the lid.
- **Do** show the room code as six mustard letter tiles, everywhere it appears.
- **Do** keep one uppercase Nunito 900 primary pill per screen, with a hint above it when it's disabled.
- **Do** use Faded Ink (#71625A) for all secondary text; it passes 4.5:1 on every light surface in the palette.
- **Do** use an espresso scrim (`rgba(59, 47, 47, 0.5)`) behind modals.
- **Do** draw icons as inline stroke SVG (2–2.5px stroke, round caps) and give icon-only buttons an `aria-label`.

### Don't:
- **Don't** use Tailwind-default indigo, slate, red or green anywhere.
- **Don't** put a bar down one side of a box; use a full outline or a fill.
- **Don't** put small uppercase labels above headings or values ("ROOM CODE", "PLAYING").
- **Don't** use stone greys for text (#a8a29e, #c7c2be fail contrast on cream); use Faded Ink.
- **Don't** put cream or white text under 24px on Kiln Terracotta (#C4663A, 3.69:1).
- **Don't** use zero-blur offset shadows, gradients, glass, or emoji as icons.
- **Don't** hide actions behind hover without showing them on `(hover: none)` devices.
