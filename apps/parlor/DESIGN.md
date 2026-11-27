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

<!-- impeccable:design-map -->
Name: Parlor
Colors: primary: terracotta #C4663A; secondary: forest-deep #2F5A3E; tertiary: mustard #D4A843; neutral: espresso #3B2F2F; primary: terracotta-deep #A9532D; primary: terracotta-press #8F4526 (+7 more in the sidecar)
Fonts: Nunito (display, headline, title, name, code, button); DM Sans (body, body-sm, label)
Spacing: xs 6px, sm 8px, md 12px, lg 16px, xl 20px, 2xl 28px
Radius: tile 10px, field 12px, row 14px, block 18px, sheet 20px, pill 999px
North Star: "The Game Box Lid"
Rules:
- The Deep Clay Rule. Text smaller than 24px (or 19px bold) never sits on Kiln Terracotta.
- The One Lid Rule. Each screen has at most one Kiln Terracotta block, and it sits at the top.
- The Ink-Only Text Rule. Text is espresso, cream, or Faded Ink.
- The Shout Once Rule. Uppercase Nunito 900 is reserved for the wordmark and the single primary action on a screen (JOIN, START GAME).
- The No-Eyebrow Rule. No small uppercase kicker above a heading or value ("ROOM CODE", "PLAYING").
- The Flat Box Rule. Nothing casts a shadow at rest unless it overlaps something.
- The No Block Shadow Rule. Outlines are ink, shadows are soft.
- The Ink Outline Rule. If it holds content, it has a full outline in espresso.
- The Collection Rule. Shared board chrome (TurnBanner, SeatChip, GameOver, lid rules button, and TrickTable / TeamScore where a game has tricks or teams) is the same in every game; a game's identity lives in its pieces and playing surface (see Game boards). Each game has one fixed colour, shared by its shelf spine, lobby row and pieces: Quixx felt, Crazy Eights mustard, Booty Dice clay, Liar's Dice espresso, Kings Corner linen, Hearts clay, Spades espresso, Euchre felt, Oh Hell mustard (source: `src/lib/games/catalog.ts`).
Elevation:
- Raised sheet: 0 10px 24px rgba(59, 47, 47, 0.16)
- Modal: 0 8px 32px rgba(59, 47, 47, 0.15)
- Lift: 0 4px 16px rgba(59, 47, 47, 0.12)
- Felt well: inset 0 2px 10px rgba(0, 0, 0, 0.25)
Don't:
- Don't use Tailwind-default indigo, slate, red or green anywhere.
- Don't put a bar down one side of a box; use a full outline or a fill.
- Don't put small uppercase labels above headings or values ("ROOM CODE", "PLAYING").
- Don't use stone greys for text (#a8a29e, #c7c2be fail contrast on cream); use Faded Ink.
- Don't put cream or white text under 24px on Kiln Terracotta (#C4663A, 3.69:1).
- Don't use zero-blur offset shadows, gradients, glass, or emoji as icons.
- Don't hide actions behind hover without showing them on `(hover: none)` devices.
Do:
- Do outline every content surface in espresso (2–2.5px) and leave the cream ground un-outlined.
- Do use Deep Clay (#A9532D) for any terracotta surface carrying text under 24px; Kiln Terracotta is for the lid.
- Do show the room code as six mustard letter tiles, everywhere it appears.
- (+4 more)
Full: .impeccable/design-full.md (read a section when you need its detail)
