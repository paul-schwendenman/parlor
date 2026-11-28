<script lang="ts">
  import { untrack } from 'svelte';
  import type { GameKind } from '@parlor/game-types';
  import {
    activeFilterCount,
    facetCounts,
    formatChipLabels,
    formatsInUse,
    kindLabels,
    kindsInUse,
    lengthLabels,
    lengthsInUse,
    playerOptions,
    playersLabel,
    PLAYERS_OR_MORE,
    weightLabels,
    weightsInUse,
    type DiscoverableGame,
    type GameFilters,
  } from '$lib/games/discovery.js';

  interface Props {
    filters: GameFilters;
    games: readonly DiscoverableGame[];
    onchange: (filters: GameFilters) => void;
    /** Id for the sheet, so a "Change" button elsewhere can bring it back. */
    id?: string;
    /** "5 games fit": shown at the sheet's foot on phones, where the results sit below the fold. */
    countLine?: string;
    /** The results section to jump to from that line. */
    resultsId?: string;
  }

  let { filters, games, onchange, id = 'table-questions', countLine, resultsId }: Props = $props();

  // Offer only what some game has: no "Trivia" chip on a shelf of cards and dice.
  let players = $derived(playerOptions(games));
  let lengths = $derived(lengthsInUse(games));
  let kinds = $derived(kindsInUse(games));
  let weights = $derived(weightsInUse(games));
  let formats = $derived(formatsInUse(games));
  let counts = $derived(facetCounts(games, filters));

  /** "Cards or dice?" while there are two kinds, then the general question. */
  let kindQuestion = $derived(
    kinds.length === 2 ? `${kindLabels[kinds[0]]} or ${kindLabels[kinds[1]].toLowerCase()}?` : 'What kind of game?',
  );
  let formatQuestion = $derived(
    formats.length === 2 && formats.includes('individual') && formats.includes('teams')
      ? 'Teams or free-for-all?'
      : 'How do you want to play?',
  );
  let moreQuestions = $derived([weights.length > 1 ? 'how much to learn' : null, formats.length > 1 ? 'teams' : null].filter(Boolean));
  let moreAnswered = $derived((filters.weight ? 1 : 0) + (filters.format ? 1 : 0));
  // Open the fold when a link arrives with one of its answers set; after
  // that it's the visitor's to open and close.
  let moreOpen = $state(untrack(() => !!(filters.weight || filters.format)));

  let anything = $derived(activeFilterCount(filters) > 0 || filters.query.trim() !== '');

  /** Whether any visible answer is dashed, so the sheet can say what dashed means. */
  let anyDashed = $derived(
    players.some((n) => counts.players[n] === 0 && filters.players !== n) ||
      lengths.some((l) => counts.length[l] === 0 && filters.length !== l) ||
      kinds.some((k) => counts.kinds[k] === 0 && !filters.kinds.includes(k)) ||
      (moreOpen &&
        (weights.some((w) => counts.weight[w] === 0 && filters.weight !== w) ||
          formats.some((fm) => counts.format[fm] === 0 && filters.format !== fm))),
  );
  /** The kind row's one tab stop: its first chosen answer, else "Any". */
  let kindStop = $derived(kinds.find((k) => filters.kinds.includes(k)) ?? null);

  /**
   * Each question is one Tab stop; arrow keys, Home and End move between its
   * answers (a toolbar's roving focus), so the keyboard path to the games is short.
   */
  function roving(node: HTMLElement) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const onkey = (e: KeyboardEvent) => {
      if (!(e.key in step) && e.key !== 'Home' && e.key !== 'End') return;
      const items = [...node.querySelectorAll<HTMLButtonElement>('button')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + step[e.key] + items.length) % items.length;
      items[next].focus();
    };
    node.addEventListener('keydown', onkey);
    return { destroy: () => node.removeEventListener('keydown', onkey) };
  }

  function set(patch: Partial<GameFilters>) {
    onchange({ ...filters, ...patch });
  }

  /** Single-answer questions: tapping the current answer clears it. */
  function pick<K extends 'players' | 'length' | 'weight' | 'format'>(key: K, value: GameFilters[K]) {
    set({ [key]: filters[key] === value ? null : value });
  }

  function toggleKind(kind: GameKind) {
    set({ kinds: filters.kinds.includes(kind) ? filters.kinds.filter((k) => k !== kind) : [...filters.kinds, kind] });
  }

  function startOver() {
    onchange({ query: '', players: null, kinds: [], length: null, weight: null, format: null });
    moreOpen = false;
  }
</script>

<!-- "Any" is the unanswered state, so it never outweighs a real answer;
     its name says which question it belongs to. -->
{#snippet any(label: string, name: string, pressed: boolean, onclick: () => void)}
  <button type="button" class="chip chip-any" aria-label={name} aria-pressed={pressed} tabindex={pressed ? 0 : -1} {onclick}>{label}</button>
{/snippet}

{#snippet chip(label: string, pressed: boolean, empty: boolean, onclick: () => void, stop = pressed, check = false)}
  <button type="button" class="chip" class:empty={empty && !pressed} class:check aria-pressed={pressed} tabindex={stop ? 0 : -1} {onclick}>
    {#if check && pressed}<svg class="tick" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{/if}{label}{#if empty && !pressed}<span class="sr-only"> (none fit)</span>{/if}
  </button>
{/snippet}

<section class="sheet" {id} aria-label="Find a game">
  {#if players.length > 1}
    <div class="question" role="group" aria-labelledby="{id}-players">
      <span class="q" id="{id}-players">How many of you?</span>
      <div class="answers tiles" use:roving>
        {#each players as n (n)}
          {@const empty = counts.players[n] === 0 && filters.players !== n}
          <button type="button" class="tile" class:empty aria-pressed={filters.players === n} tabindex={filters.players === n ? 0 : -1} onclick={() => pick('players', n)}>
            {#if n >= PLAYERS_OR_MORE}<span aria-hidden="true">{playersLabel(n)}</span><span class="sr-only">{n} or more</span>{:else}{n}{/if}{#if empty}<span class="sr-only"> (none fit)</span>{/if}
          </button>
        {/each}
        <button type="button" class="tile tile-any" aria-label="Any number of players" aria-pressed={filters.players === null} tabindex={filters.players === null ? 0 : -1} onclick={() => set({ players: null })}>Any</button>
      </div>
    </div>
  {/if}

  {#if lengths.length > 1}
    <div class="question" role="group" aria-labelledby="{id}-length">
      <span class="q" id="{id}-length">How long have you got?</span>
      <div class="answers" use:roving>
        {#each lengths as l (l)}
          {@render chip(lengthLabels[l], filters.length === l, counts.length[l] === 0, () => pick('length', l))}
        {/each}
        {@render any('Any', 'Any length', filters.length === null, () => set({ length: null }))}
      </div>
    </div>
  {/if}

  {#if kinds.length > 1}
    <div class="question" role="group" aria-labelledby="{id}-kind">
      <span class="q" id="{id}-kind">{kindQuestion}</span>
      <div class="answers" use:roving>
        <!-- The one question that takes several answers: chosen kinds carry a tick. -->
        {#each kinds as k (k)}
          {@render chip(kindLabels[k], filters.kinds.includes(k), counts.kinds[k] === 0, () => toggleKind(k), kindStop === k, true)}
        {/each}
        {@render any(kinds.length === 2 ? 'Either' : 'Any', kinds.length === 2 ? 'Either kind' : 'Any kind', filters.kinds.length === 0, () => set({ kinds: [] }))}
      </div>
    </div>
  {/if}

  {#if anyDashed}
    <p class="hint"><span class="dash" aria-hidden="true"></span>Dashed answers would leave no games.</p>
  {/if}

  {#if moreQuestions.length || anything}
    <div class="foot">
      {#if moreQuestions.length}
        <button type="button" class="more-toggle" aria-expanded={moreOpen} aria-controls="{id}-more" onclick={() => (moreOpen = !moreOpen)}>
          <svg class="chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          More questions{#if moreAnswered && !moreOpen}&nbsp;({moreAnswered} answered){/if}
        </button>
      {/if}
      {#if anything}
        <button type="button" class="start-over" onclick={startOver}>Start over</button>
      {/if}
    </div>
  {/if}

  {#if moreQuestions.length}
    <div class="more-body" id="{id}-more" hidden={!moreOpen}>
      {#if weights.length > 1}
        <div class="question" role="group" aria-labelledby="{id}-weight">
          <span class="q" id="{id}-weight">How much to learn?</span>
          <div class="answers" use:roving>
            {#each weights as w (w)}
              {@render chip(weightLabels[w], filters.weight === w, counts.weight[w] === 0, () => pick('weight', w))}
            {/each}
            {@render any('Any', 'Any amount to learn', filters.weight === null, () => set({ weight: null }))}
          </div>
        </div>
      {/if}
      {#if formats.length > 1}
        <div class="question" role="group" aria-labelledby="{id}-format">
          <span class="q" id="{id}-format">{formatQuestion}</span>
          <div class="answers" use:roving>
            {#each formats as fm (fm)}
              {@render chip(formatChipLabels[fm], filters.format === fm, counts.format[fm] === 0, () => pick('format', fm))}
            {/each}
            {@render any('Any', 'Any way to play', filters.format === null, () => set({ format: null }))}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if countLine && resultsId}
    <!-- Phones only: the results start below the fold, so the answer's effect shows here. -->
    <a class="see" href="#{resultsId}">
      <strong>{countLine}</strong>
      <span class="see-go">See them<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
    </a>
  {/if}
</section>

<style>
  .sheet {
    position: relative;
    background: var(--color-paper);
    border: 2.5px solid var(--color-espresso);
    border-radius: 20px;
    padding: 22px 26px;
    /* Raised: it overlaps the lid. */
    box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .question {
    display: grid;
    grid-template-columns: 280px 1fr;
    align-items: center;
    gap: 8px 20px;
  }

  .q {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .answers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button {
    font: inherit;
    color: var(--color-espresso);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.1s ease;
  }

  button:active {
    transform: scale(0.96);
  }

  /* Player count: the room code's mustard letter tiles. */
  .tile {
    width: 54px;
    height: 56px;
    border: 2px solid var(--color-espresso);
    border-radius: 10px;
    background: var(--color-mustard-tint);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.875rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .tile[aria-pressed='true'] {
    background: var(--color-mustard);
    box-shadow: 0 0 0 3px var(--color-paper), 0 0 0 5px var(--color-espresso);
  }

  .tile-any {
    width: auto;
    padding: 0 16px;
    background: transparent;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
  }

  /* Unanswered: a linen fill, never the espresso of a real choice. */
  .tile-any[aria-pressed='true'],
  .chip.chip-any[aria-pressed='true'] {
    background: var(--color-linen);
    color: var(--color-espresso);
    box-shadow: none;
  }

  .chip {
    min-height: 44px;
    padding: 0 18px;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: transparent;
    font-weight: 700;
    font-size: 1rem;
    white-space: nowrap;
  }

  .chip[aria-pressed='true'] {
    background: var(--color-espresso);
    color: var(--color-cream);
  }

  .chip.check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .tick {
    flex-shrink: 0;
    margin-left: -4px;
  }

  .hint {
    margin: -6px 0 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  /* A swatch of the dashed outline the hint is talking about. */
  .dash {
    flex-shrink: 0;
    width: 28px;
    height: 16px;
    border: 2px dashed var(--color-ink-muted);
    border-radius: 999px;
  }

  .see {
    display: none;
  }

  /* Would leave no games with the other answers: still tappable, just quiet.
     A dashed Faded Ink outline, as for seats that aren't a real person, keeps
     the label at 4.5:1 instead of fading the whole control. */
  .chip.empty,
  .tile.empty {
    border-style: dashed;
    border-color: var(--color-ink-muted);
    color: var(--color-ink-muted);
  }

  .tile.empty {
    background: var(--color-paper);
  }

  @media (hover: hover) {
    .chip:where(:not([aria-pressed='true'])):hover,
    .chip-any[aria-pressed='true']:hover,
    .tile-any:where(:not([aria-pressed='true'])):hover {
      background: rgba(59, 47, 47, 0.06);
    }

    .tile:where(:not(.tile-any):not([aria-pressed='true'])):hover {
      background: color-mix(in srgb, var(--color-mustard) 45%, var(--color-mustard-tint));
    }
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 2px solid var(--color-linen);
    padding-top: 10px;
    margin-bottom: -8px;
  }

  .more-toggle,
  .start-over {
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: none;
    font-weight: 700;
    font-size: 1rem;
  }

  .more-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: -6px;
    text-align: left;
  }

  .start-over {
    align-self: flex-end;
    margin-left: auto;
    margin-right: -6px;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.25em;
    white-space: nowrap;
  }

  .more-toggle:active,
  .start-over:active {
    transform: none;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  [aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }

  .more-body {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-top: 4px;
  }

  .more-body[hidden] {
    display: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    button,
    .chevron {
      transition: none;
    }
  }

  @media (max-width: 720px) {
    .sheet {
      padding: 16px 14px;
      gap: 14px;
    }

    .question {
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .hint {
      margin-top: -4px;
    }

    .see {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 48px;
      margin: 2px -2px -2px;
      padding: 0 16px;
      border: 2px solid var(--color-espresso);
      border-radius: 999px;
      background: var(--color-mustard-tint);
      color: var(--color-espresso);
      text-decoration: none;
    }

    .see strong {
      font-family: var(--font-heading);
      font-weight: 900;
      font-size: 1.1875rem;
    }

    .see-go {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      white-space: nowrap;
    }

    .q {
      font-size: 1.1875rem;
    }

    .answers {
      gap: 6px;
    }

    /* Tiles share one even row: 2–5, 6+ and Any. */
    .tiles {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
    }

    .tile {
      width: auto;
      height: 48px;
      font-size: 1.5rem;
    }

    .tile-any {
      width: auto;
      padding: 0 4px;
      font-size: 1rem;
    }

    .chip {
      padding: 0 14px;
      font-size: 1rem;
    }
  }

  /* Smallest phones: six tiles won't fit at 44px, so Any takes the second row. */
  @media (max-width: 380px) {
    .tiles {
      grid-auto-flow: row;
      grid-template-columns: repeat(5, minmax(44px, 1fr));
    }

    .tile-any {
      grid-column: span 2;
    }

    .chip {
      padding: 0 12px;
    }
  }
</style>
