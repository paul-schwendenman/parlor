# Parlor - Visual Design Options

## Context

Parlor needs a visual identity that works across multiple games while feeling like a cohesive game night experience. The UI must be responsive (mobile and desktop equal), touch-friendly, and readable at phone-arm's-length distance. The host expressed interest in a cozy/warm direction but wants to see options before committing.

---

## Option A: Cozy Game Night

The living room game night aesthetic. Feels warm, inviting, and familiar.

### Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Warm cream | `#FDF6EC` | Page backgrounds |
| Surface | Soft linen | `#F5EDE0` | Cards, panels |
| Primary | Terracotta | `#C4663A` | Buttons, active states |
| Secondary | Forest green | `#4A7C59` | Accents, success states |
| Accent | Mustard | `#D4A843` | Highlights, badges |
| Text | Espresso | `#3B2F2F` | Body text |
| Text muted | Warm gray | `#8B7E74` | Secondary text |
| Error | Brick red | `#B5413B` | Errors, penalties |

### Typography

- **Headings**: Rounded sans-serif (e.g. Nunito, Quicksand) - friendly and approachable
- **Body**: Clean sans-serif (e.g. Inter, DM Sans) - readable at small sizes
- **Game elements**: Could use a playful display font per game for flavor

### Surface Treatment

- Subtle paper/linen textures on backgrounds (CSS noise or subtle SVG patterns)
- Soft drop shadows (warm-toned, not gray)
- Rounded corners (12-16px on cards, 8px on buttons)
- Warm gradients on primary surfaces

### Iconography

- Hand-drawn or rounded line icons
- Filled icons for active states
- Consistent stroke width

### Mood

> Like sitting around a wooden table with a warm lamp overhead. Coffee stains on the rulebook. Dice clatter softly.

---

## Option B: Playful & Colorful

Board game box art energy. Bright, bold, and fun.

### Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Off-white | `#FAFAFA` | Page backgrounds |
| Surface | White | `#FFFFFF` | Cards, panels |
| Primary | Coral | `#FF6B6B` | Buttons, CTAs |
| Secondary | Teal | `#4ECDC4` | Accents, success |
| Accent | Sunny yellow | `#FFE66D` | Highlights, badges |
| Purple | Soft violet | `#A78BFA` | Player colors, tags |
| Text | Near-black | `#2D3436` | Body text |
| Text muted | Cool gray | `#95A5A6` | Secondary text |

### Typography

- **Headings**: Bold geometric sans (e.g. Poppins, Outfit) - energetic and modern
- **Body**: System sans-serif stack - fast, familiar
- **Game elements**: Extra-bold weights, playful sizing

### Surface Treatment

- Clean flat design, minimal shadows
- Bold borders (2-3px) in accent colors
- Large rounded corners (16-20px)
- Solid color blocks, no textures

### Iconography

- Geometric, filled icons
- Bold strokes, slightly oversized
- Color-coded per function

### Mood

> Ripping open a new board game. Bright cards on a white table. Everyone's laughing.

---

## Option C: Dark & Modern

Evening gaming session aesthetic. Sleek, focused, and immersive.

### Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Deep charcoal | `#1A1A2E` | Page backgrounds |
| Surface | Slate | `#25253E` | Cards, panels |
| Primary | Electric indigo | `#6C63FF` | Buttons, active states |
| Secondary | Cyan | `#00D9FF` | Accents, links |
| Accent | Amber | `#FFB800` | Highlights, turn indicator |
| Success | Mint | `#00E676` | Success states |
| Text | Light gray | `#E8E8E8` | Body text |
| Text muted | Mid gray | `#8888A0` | Secondary text |
| Error | Rose | `#FF5252` | Errors, penalties |

### Typography

- **Headings**: Sharp geometric sans (e.g. Space Grotesk, Sora) - techy and clean
- **Body**: Monospace-influenced sans (e.g. JetBrains Sans, IBM Plex Sans)
- **Game elements**: All-caps tracking for labels, tabular numbers for scores

### Surface Treatment

- Subtle glassmorphism (backdrop-blur on overlays)
- Thin borders (`1px` in muted tones)
- Tight rounded corners (6-8px)
- Subtle glow effects on interactive elements

### Iconography

- Sharp, outlined icons
- Thin strokes, geometric
- Glow on hover/active

### Mood

> Late night game session. Screens dim, the game glows. Focus mode.

---

## Option D: Hybrid - Cozy with Dark Mode

Start with Cozy Game Night as the default, add a dark mode variant.

### Light Mode

Same as Option A (Cozy Game Night).

### Dark Mode

| Role | Light | Dark |
|------|-------|------|
| Background | `#FDF6EC` | `#1E1B18` |
| Surface | `#F5EDE0` | `#2A2520` |
| Primary | `#C4663A` | `#D4784A` (slightly lighter) |
| Secondary | `#4A7C59` | `#5A9C69` |
| Accent | `#D4A843` | `#E4B853` |
| Text | `#3B2F2F` | `#E8DFD4` |
| Text muted | `#8B7E74` | `#9B8E84` |

Keeps the warm tone even in dark mode - brown-blacks instead of blue-blacks.

---

## Game-Specific Theming

Regardless of which base theme is chosen, individual games can layer on their own color accents:

- **Quixx**: Red, yellow, green, blue row colors are part of the game's identity
- **Coup**: Rich political tones - deep reds, golds, navy
- **Love Letter**: Romantic reds and pinks, parchment textures
- **Sushi Go**: Bright food-inspired pastels

The base theme provides chrome (lobby, nav, chat, buttons). Game-specific components use their own palette within the game area.

---

## Component Patterns

These apply regardless of theme choice:

### Cards
- Consistent card component with front/back states
- Flip animation (CSS transform, ~300ms)
- Subtle hover lift on desktop
- Tap feedback on mobile

### Dice
- SVG-based dice faces for crispness at any size
- Roll animation: quick tumble (CSS keyframes, ~600ms)
- Configurable size (phone vs. host screen)

### Scoresheet (Quixx-specific)
- Grid layout, tap-to-mark cells
- Clear visual for marked vs. available vs. locked cells
- Row colors match dice colors
- Large enough touch targets for phone use (min 44x44px)

### Lobby
- Player avatars in a circle or row (generated from name, like initials or a simple icon)
- Room code displayed prominently (large, monospace, copy-on-tap)
- QR code generated client-side
- Share button using Web Share API where available

### Turn Indicator
- Clear "your turn" state - could be a banner, glow, or pulse animation
- Visible but not jarring "waiting for [Player]" state for others

---

## Animation Guidelines

Moderate polish - satisfying but not slow.

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page transitions | Fade + slight slide | 200ms | ease-out |
| Card play | Slide to center + slight scale | 300ms | ease-out |
| Card flip | 3D rotate Y | 300ms | ease-in-out |
| Dice roll | Tumble + settle | 500-700ms | custom bounce |
| Score update | Number count-up | 400ms | ease-out |
| Turn change | Pulse/glow on active player | 600ms | ease-in-out |
| Toast/notification | Slide in from top | 200ms | ease-out |
| Cell mark (Quixx) | Scale pop + color fill | 150ms | ease-out |

Use Svelte transitions (`fly`, `fade`, `scale`) and CSS animations. No JS animation libraries unless needed for dice physics.

---

## Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 640px | Phone portrait | Single column, stacked UI |
| 640-1024px | Phone landscape / tablet | Flexible, side-by-side where useful |
| > 1024px | Desktop / host screen | Full layout, larger game area |

### Host Screen (Jackbox mode)

- Optimized for 1080p TV/monitor
- Large text readable from couch distance
- Room code and QR code prominently displayed
- Game state takes center stage, minimal chrome

### Phone (Player controller)

- Single-column layout
- Large touch targets (44px minimum)
- Bottom-anchored action buttons (thumb-reachable)
- Minimal scrolling during gameplay

---

## Next Steps

1. Pick a base direction (A, B, C, or D)
2. Build a small Tailwind theme config with the chosen palette
3. Prototype the Quixx scoresheet component to validate the feel
4. Iterate from there
