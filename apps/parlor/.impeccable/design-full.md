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

**Implementation status.** The Parlor app shell (home, lobby, game frame) and the shared `@parlor/ui` components follow this system. Game boards under `games/*` are migrated to the shared board kit one game at a time (all nine done 2026-11-27: Crazy Eights, Kings Corner, Quixx, Booty Dice, Liar's Dice, then the trick-taking four: Hearts, Spades, Euchre, Oh Hell); where a board and this file disagree, this file wins. See Game boards.

**Key Characteristics:**
- Terracotta "lid" header on every main screen, outlined at the bottom in ink.
- A 2–2.5px espresso outline on every surface that holds content; none on the cream ground.
- Pill-shaped buttons; Nunito 900 for anything that names a thing or an action.
- The room code is always shown as individual mustard letter tiles.
- Flat at rest. Shadows only for things that physically sit on top of the page.
- Each game gets a solid color block of its own, like box spines on a shelf.

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

Single column, centered, phone-first. Main content sits in a 20px gutter (`xl`). Lobby and game chrome are capped at 480px wide; the home page at 800px, where the game shelf may become a two-column grid. The one exception is the lobby while voting on a wide screen (900px and up): the page opens to 920px, the ballot on the left and the full player list in a 320px side column that stays in view, and the lid's wordmark and Leave room spread to match while the code tiles keep their phone size. The lid header always spans the full width of the viewport, edge to edge, so the screen reads as one box.

Spacing is tight inside groups and wide between them: 8px (`sm`) between player rows, 12px (`md`) between fields, 16px (`lg`) between panels, 28px (`2xl`) between major regions. On the home page, the join sheet overlaps the bottom of the lid by 68px, which ties the two together.

Actions sit at the bottom of the lobby (`margin-top: auto`), in thumb reach: the primary pill full-width (START GAME for the host, Ready for a guest). The hint explaining why Start is disabled (or, for a guest, what they are waiting on, naming the host) sits directly above the button it explains. Add bot lives with the seats, not in the action area. While voting, the host's PLAY HEARTS rides the bottom of the screen in a cream bar (sticky, with the soft upward shadow it earns by overlapping the ballot), with its hint above it.

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
The signature component. The code is shown as six separate mustard tiles (10px corners, 2px espresso outline, 58px tall, Nunito 900 letters) in an equal-width grid, with two cream outline pills below on one row (15px DM Sans 700, 44px, 14px side padding, so both fit at 390px without growing the lid). The first shares the invite link (`origin/?join=CODE`): "Share invite" with a drawn share icon where the browser has `navigator.share` (phones), opening the system share sheet; "Copy invite link" with a link icon elsewhere, which copies and reads "Link copied". A cancelled share sheet does nothing; any other share failure copies instead, and a copy failure says "Couldn't copy here. Read the code out instead." The second, "Show QR code" with a drawn QR icon, opens the **QR sheet**: a modal titled "Scan to join" holding a large QR of the same link (espresso modules on paper with the spec's four-module quiet zone, drawn locally as one SVG path by `src/lib/qr.ts` with `qrcode-generator`, never via a QR web service; 360px on a wide screen and the sheet's full width on a phone, 2.5px ink outline, 14px corners), the code in the same mustard letter tiles beneath it, one line "Scan with a phone camera to join." and an outline Close. Both pills are cream on the lid, so the lid stays the one terracotta block. The tile group gets `aria-label="Room code KQ7MPD"`. When typing a code, the input uses the same idea: a butter-filled, ink-outlined field with wide-tracked Nunito 900.

### Chips
- **Ready:** Felt fill, cream DM Sans 700 12px, pill.
- **Waiting:** Transparent, 1.5px espresso outline, espresso text.
- **Count badge:** Espresso fill, cream Nunito 800, pill, beside a heading.
- **Metadata (shelf):** 1.5px outline in the block's text color, tabular numerals ("2–4 · 15–25m").

### Player rows
Paper fill, 2px espresso outline, 14px corners. A 36px color avatar with the player's initial (cycling Kiln Terracotta, Felt, Mustard and Espresso), the name in Nunito 800, roles as Faded Ink text after it ("· host · you"), and the status chip on the right. Bot rows use linen with a dashed outline, an espresso avatar with a robot glyph, and an icon-only remove button (aria-labelled). The status chip (Ready / Not ready) only appears once a game is chosen (or while a reopened ballot still has a current game), and never on the host's row: the host's START is their ready. Open seats (a confirmed game's missing seats up to its minimum) use the same linen dashed row with a dashed-ring avatar holding the seat number, "Open seat" in Faded Ink, and, for the host, an outline Add bot pill (44px, labelled "Add bot to seat N"). Below the list, one quiet Faded Ink line ("Room for 2 more", or while voting on a wide screen "Short on players? Bots can fill seats.") carries the host's Add bot; when it is disabled, the reason sits beneath it in Faded Ink. While voting on a phone, the table comes first as a **player strip**: one paper row with the 2px ink outline holding the seat-coloured avatars (32px, overlapping, each ringed in paper; bots are espresso with the robot glyph), the count in Nunito 800 ("3 players") and the host's outline Add bot at the right. The full list (with remove-bot) follows the ballot. On a reopened ballot each ready non-host seat (bots too) wears a 15px felt check badge, ringed in paper, at its avatar's lower right.

When START is enabled, a quiet line sits above it: a drawn check in a 22px felt circle and "Everyone's ready" in espresso Nunito 800 16px. It is never uppercase; START stays the one shout. A ready guest whose wait is only on the host reads "Everyone's ready. Waiting for Margaret to start."

### Game panel (tonight's game)
A felt block with a 2px espresso outline and 18px corners. The game name in cream Nunito 900 24px over its player count and time, a cream 44px "?" icon button ("How to play Hearts") that opens the rules sheet, and a cream outline "Change game" pill for the host (one line, never wraps); guests get the "?" alone. Change game reopens the ballot without losing the game: the panel stays on top of the ballot (in the ballot column on a wide screen), its second line saying who is choosing and what happens to readiness ("Choosing again. Anyone ready stays ready if you keep it." for the host; "Margaret is choosing again. You stay ready if Hearts stays." for a ready guest), and the host's pill becomes "Keep Hearts" in the same spot, which restores the room exactly. If the room has outgrown the current game (more people than it seats, or bots it can't use), there is no Keep pill: the panel line says what would fix it ("Hearts seats 4. Remove 2 bots to keep it.", or "…, and 5 people are here. Vote for another game." when removing bots can't), and guests read "Margaret is choosing again. Hearts seats 4, so it can't stay as things are." Too few players never blocks Keep, since seats are filled afterwards.

### Game shelf
Each game is a solid color block: 2.5px espresso outline, 18px corners, 18px padding. Each game keeps one block colour from Felt, Dice Mustard, Deep Clay, Espresso and Linen (see Game boards → Its colour), so a game looks the same wherever it appears. The text color on each block is cream or espresso, whichever passes. The block holds the game name (Nunito 900 28px), a metadata chip, a description (DM Sans 500 14px) and two pills: outline "How to play" and a solid "Start a room" in the block's contrasting color. The colours live in shared `.spine-{shelf}` classes in `app.css` (`--spine-bg`, `--spine-fg`, `--spine-solid-bg/fg`), used by both the home shelf and the lobby ballot.

### Ballot (voting on a game)
Voting should feel like pulling a box off the shelf. Under "Vote on a game" sit two plain lines: what to do ("Tap a game to vote. Margaret picks the game."; the host reads "Tap a game to vote, then play the winner.") and, in espresso 700, the standing with counts ("Leading · Hearts, 2 of 3 votes (needs 1 more player)", "Leading · Quixx, 1 vote" when it holds every vote, "Tied · Quixx, Hearts, 1 vote each"). While the host is the only player, the standing line is the invite prompt instead: "Share the code so others can join. You can vote while you wait." On a phone (under 520px) a single leader's standing line is pinned above the list as a status strip, never a button: paper fill, 2px ink outline, 14px corners, a small spine swatch (18x28, ink outline) in the leader's colour, the text and the leader's voter avatars ringed in paper. The list itself keeps shelf order, so nothing moves under a finger when someone else votes. Every game is ranked, playable or not, and the constraint is said alongside it.

Each game is its shelf spine, one step smaller: the game's block colour with a 2.5px ink outline and 16px corners, the name in Nunito 900 21px, the shelf metadata chip ("4 · 25–40m"), the description in DM Sans 500 13px (two lines at most, one under 520px) and a "?" icon button in the corner that opens the rules. Text on each spine is cream or espresso, as on the shelf. The whole box is the vote button ("Vote for Hearts", pressed when it's yours). A footer appears only when it has something to say: the fit note in the spine's text colour ("Needs 1 more player"; hidden on every row when it can't tell games apart, i.e. every shelf game just needs more people or every note is the same), a cream "Your vote" chip with a drawn check, and the voters themselves as 26px seat-coloured avatars ringed in cream so a clay voter still reads on the clay spine. Screen readers get one description per row ("Hearts: 2 votes, Margaret and Joe. Needs 1 more player."). Your pick wears a heavier ink edge (a 2px ink ring outside the outline). A new voter's avatar lands with a short overshoot pop; reduced motion drops it.

On a reopened ballot the current game's row carries an outline "Current" tag in the spine's text colour (never filled, so it doesn't compete with "Your vote"). With no votes it leads ("Leading · Hearts (current game)"); a vote for another game puts that one ahead, and in a tie the host's own vote wins, then the current game. A current game the room has outgrown loses both: with no votes the standing reads "No votes yet". While the current game leads, the host's PLAY is disabled with "Hearts stays unless another game takes the lead." (Keep is on the panel, so there is only ever one Keep). Picking a different game asks every guest to get ready again; bots stay ready.

Games the room has too many people for fold into a native disclosure at the bottom, "Not for 6 players (6)" in Faded Ink with a drawn chevron. Inside, they are one-line linen rows with dashed outlines: name, "Seats 4" in Faded Ink and any votes left on them. Games that only need more players stay on the shelf, since a bot can fix that.

There are no per-game Confirm buttons. Guests only ever vote. The host gets one shouted action, PLAY HEARTS, bound to the leader (a tie goes to the host's own vote if it is among the tied games, otherwise the first the room fits), disabled with a hint when nothing has votes ("Vote to pick a game.") or the leader can't be played ("Hearts seats 4. Remove a bot or vote for another game."). Any other game the room fits is played from its rules sheet (see Rules sheet).

### Rules sheet
The shared modal titled "How to play Hearts", used on the home shelf, in the lobby and on the game lid. Under the title, one Faded Ink line in DM Sans 600 gives the fit from the catalogue: "4 players · bots can fill seats" ("2–5 players · no bots" for a game without bots). Section headings are sentence case. Trick-game rules explain their jargon in plain words the first time it appears: what a trick is, trump, the led suit, leading, bags, nil, the bowers, makers and defenders.

The footer is pinned to the bottom of the sheet (sticky, paper fill, a 2px linen rule above it), so on a phone the rules scroll beneath it and the actions never scroll away. It holds sentence-case pills only, never a shouted label (the screen's one shout stays on the page behind): an outline Close; in the lobby a **vote toggle**, an outline "Vote" that becomes "Your vote" with a drawn check on a butter fill when pressed (`aria-pressed`, pressing again clears it), never a filled accent button; and a Deep Clay "Play Hearts" that names the game, for the host in the lobby and on the home shelf (where it opens Start a room). On the lobby's confirmed-game panel the sheet has Close only for guests, and Close plus an outline "Change game" for the host (it closes the sheet and reopens the ballot). Mid-game there is only Close. On a phone (under 520px) the pills grow to share the row, and a third wraps to its own full-width row.

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
- **Seats** (`SeatChip`): players as outlined pills with the seat-coloured avatar from the lobby (robot glyph for bots), the name in Nunito 800 and one game stat ("7 cards"). The seat whose turn it is turns felt. A disconnected seat is dashed on linen; a seat that's out is linen with its name struck through. Games with several stats per player (Booty Dice) draw them as icon + number in the seat (`wide` rows for a list). When the viewer must pick a player, the seats become buttons wearing the mustard ring.
- **How to play**: a cream "?" button on the game lid, beside Leave room. Boards don't carry their own rules buttons.
- **Game over** (`GameOver`): a felt result block (mustard trophy, "You win!"), standings as outlined rows with place, avatar and the game's own measure, then PLAY AGAIN (the one shouted action) and an outline "Back to lobby".
- **Buttons** are `Button` pills; the board's single primary move is `shout`. A yes/no option (Euchre's "Go alone") is a secondary pill with `pressed`, printed on butter when on, never a bare checkbox.
- **Team scores** (`TeamScore`): in partnership games (Spades, Euchre), one outlined paper block per team with the score in Nunito 900, mustard-tint for your team; game-specific breakdowns sit inside it.
- **Seat colours** come from `seatTone(index)`, so a player has the same colour in the lobby, on the board and in the standings.

**Owned by each game:**
- **Its colour** is its shelf spine on the home page: Quixx felt, Crazy Eights mustard, Booty Dice clay, Liar's Dice espresso, Kings Corner linen, Hearts clay, Spades espresso, Euchre felt, Oh Hell mustard. The trick-taking four share the felt table and default espresso card back, so their colours follow the suit (Hearts red clay, Spades black ink) and keep neighbouring shelf blocks different in one and two columns. The colours are fixed per game in `src/lib/games/catalog.ts`, not assigned by shelf position. It shows up on the game's printed pieces (card backs, dice, sheet headers), not as a second lid.
- **Its playing surface**: card games play on `Felt` (felt-well inset, ink outline, 18px corners), with the stock as `DrawPile` and the hand as `CardHand` (one overlapping row, selected card lifts on butter; cards you can't play are faded print on solid linen stock, so an overlapping hand never shows through). A card is played on the second tap: the first lifts it and the banner says "Tap the King of Clubs again to play it." Trick-taking games draw the current trick with `TrickTable`: one slot per seat in seat order (dashed until that seat plays), the player's name under it, the trick's winner wearing the mustard ring, and a heading row for the trick count and trump; Quixx on a printed paper scoresheet; the pirate games on `Felt tone="night"`, an espresso table with cream text. A surface is always an outlined block on cream, never a full-page theme.
- **Its pieces**: cards are `PlayingCard` (paper stock, ink outline, Nunito index top-left, drawn SVG suits, backs printed in the game's colour via `--card-back`). A mustard ring always means "you can act here" (a drawable stock, a pile a picked card can go to); butter means "picked up". Dice are printed too (`PipDie` for numbered dice, with `--die-face` / `--die-pip` per game; Booty Dice draws its own faces as stroke icons on Deep Clay): ink outline, drawn SVG pips, white dice on paper and coloured dice in their row ink. Quixx's scoresheet is four ink bands of tinted boxes (row inks in `games/quixx/.../inks.css`, each tuned to 4.5:1); boxes you can cross are paper with an ink outline, the picked box is ink-filled (butter would vanish on the yellow row), crosses are pen strokes, and boxes left of your last cross fade out.

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
