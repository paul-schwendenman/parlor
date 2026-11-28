<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import ParlorMark from '$lib/components/ui/ParlorMark.svelte';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';
  import GameCard from '$lib/components/games/GameCard.svelte';
  import CreateRoomDialog from '$lib/components/games/CreateRoomDialog.svelte';
  import GameFilters from '$lib/components/discovery/GameFilters.svelte';
  import { catalog, findGame } from '$lib/games/catalog.js';
  import {
    emptyFilters,
    filterGames,
    filtersFromParams,
    filtersToParams,
    filterSummary,
    isEmpty,
    kindLabels,
    lengthLabels,
    sortLabels,
    weightLabels,
    formatChipLabels,
    GAME_SORTS,
    type GameFilters as Filters,
    type GameSort,
  } from '$lib/games/discovery.js';
  import { getSocket } from '$lib/stores/socketClient.js';

  // The URL is the state: back/forward and shared links restore the answers.
  const initial = filtersFromParams(page.url.searchParams);
  let filters = $state<Filters>(initial.filters);
  let sort = $state<GameSort>(initial.sort);

  let results = $derived(filterGames(catalog, filters, sort));
  let summary = $derived(filterSummary(filters));
  let countLine = $derived(
    isEmpty(filters)
      ? `All ${catalog.length} games`
      : results.length === 0
        ? 'No games fit'
        : `${results.length} ${results.length === 1 ? 'game fits' : 'games fit'}`,
  );

  /** Ways out of an empty result: drop one answer, and how many games that brings back. */
  let loosen = $derived.by(() => {
    if (results.length) return [];
    const options: { label: string; patch: Partial<Filters> }[] = [];
    if (filters.query.trim()) options.push({ label: `Clear the search “${filters.query.trim()}”`, patch: { query: '' } });
    if (filters.players !== null) options.push({ label: 'Any number of players', patch: { players: null } });
    if (filters.length) options.push({ label: `Not just ${lengthLabels[filters.length].toLowerCase()}`, patch: { length: null } });
    if (filters.kinds.length) options.push({ label: `Not just ${filters.kinds.map((k) => kindLabels[k].toLowerCase()).join(' or ')}`, patch: { kinds: [] } });
    if (filters.weight) options.push({ label: `Not just ${weightLabels[filters.weight].toLowerCase()}`, patch: { weight: null } });
    if (filters.format) options.push({ label: `Not just ${formatChipLabels[filters.format].toLowerCase()}`, patch: { format: null } });
    return options
      .map((o) => ({ ...o, count: filterGames(catalog, { ...filters, ...o.patch }).length }))
      .filter((o) => o.count > 0);
  });

  $effect(() => {
    const search = filtersToParams(filters, sort).toString();
    if (!browser || search === page.url.searchParams.toString()) return;
    // The path is resolve()d; only the query string is appended.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(`${resolve('/games')}${search ? `?${search}` : ''}`, page.state);
  });

  // Sticky summary: once the questions scroll off the top, keep the answers in view.
  let sheetGone = $state(false);
  onMount(() => {
    getSocket();
    const sheet = document.getElementById('table-questions');
    if (!sheet) return;
    const observer = new IntersectionObserver(([entry]) => {
      sheetGone = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  });

  function changeAnswers() {
    const sheet = document.getElementById('table-questions');
    if (!sheet) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sheet.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    sheet.querySelector<HTMLButtonElement>('button[aria-pressed="true"], button')?.focus({ preventScroll: true });
  }

  // Rules sheet and create-room dialog, as on the home shelf.
  let rulesGameId = $state<string | null>(null);
  let rulesGame = $derived(findGame(rulesGameId));
  let createGameId = $state<string | undefined>();
  let creating = $state(false);

  function openCreate(gameId: string) {
    createGameId = gameId;
    creating = true;
  }
</script>

<svelte:head><title>Find a game · Parlor</title></svelte:head>

<header class="lid">
  <div class="lid-inner">
    <div class="lid-top">
      <a class="wordmark" href={resolve('/')} aria-label="Parlor home"><ParlorMark />Parlor</a>
      <h1 class="title">Find a game</h1>
    </div>
    <label class="search">
      <span class="sr-only">Search games</span>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={filters.query}
        oninput={(e) => (filters = { ...filters, query: e.currentTarget.value })}
        placeholder="Search, like “pirates” or “trick-taking”"
        autocomplete="off"
        spellcheck="false"
        maxlength="80"
      />
    </label>
  </div>
</header>

<div class="sticky" class:shown={sheetGone} aria-hidden={!sheetGone} inert={!sheetGone}>
  <div class="sticky-inner">
    <div class="sticky-text">
      <strong>{countLine}</strong>
      {#if summary}<span>{summary}</span>{/if}
    </div>
    <button type="button" class="pill" onclick={changeAnswers}>Change</button>
  </div>
</div>

<main class="page">
  <GameFilters {filters} games={catalog} onchange={(next) => (filters = next)} />

  <section class="results" aria-labelledby="results-title">
    <div class="results-head">
      <h2 id="results-title" class="results-title" aria-live="polite" aria-atomic="true">{countLine}</h2>
      <label class="sort">
        <span class="sr-only">Sort games</span>
        <select bind:value={sort}>
          {#each GAME_SORTS as s (s)}
            <option value={s}>{sortLabels[s]}</option>
          {/each}
        </select>
      </label>
    </div>

    {#if results.length}
      <div class="game-grid">
        {#each results as game (game.id)}
          <GameCard {game} onrules={(id) => (rulesGameId = id)} onstart={openCreate} />
        {/each}
      </div>
    {:else}
      <div class="empty">
        <p class="empty-lead">Nothing on the shelf matches all of that.</p>
        {#if loosen.length}
          <p class="empty-hint">Try loosening one answer:</p>
          <ul class="loosen">
            {#each loosen as option (option.label)}
              <li>
                <button type="button" class="pill" onclick={() => (filters = { ...filters, ...option.patch })}>
                  {option.label}
                  <span class="loosen-count">{option.count} {option.count === 1 ? 'game' : 'games'}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <button type="button" class="link" onclick={() => (filters = { ...emptyFilters, kinds: [] })}>Start over</button>
      </div>
    {/if}
  </section>
</main>

<RulesModal
  open={rulesGameId !== null}
  gameId={rulesGameId}
  gameName={rulesGame?.name ?? ''}
  onclose={() => (rulesGameId = null)}
  onplay={() => {
    if (rulesGameId) openCreate(rulesGameId);
    rulesGameId = null;
  }}
/>

<CreateRoomDialog open={creating} gameId={createGameId} onclose={() => (creating = false)} />

<style>
  .lid {
    background: var(--color-terracotta);
    border-bottom: 3px solid var(--color-espresso);
  }

  .lid-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 20px 92px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .lid-top {
    display: flex;
    align-items: baseline;
    gap: 18px;
    min-width: 0;
  }

  .wordmark {
    display: flex;
    align-items: center;
    gap: 0.2em;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.875rem;
    line-height: 1;
    letter-spacing: -0.035em;
    text-transform: uppercase;
    color: var(--color-cream);
    text-decoration: none;
    min-height: 44px;
  }

  .wordmark:focus-visible {
    outline-color: var(--color-cream);
  }

  .title {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--color-cream);
    white-space: nowrap;
  }

  .search {
    margin-left: auto;
    flex: 0 1 400px;
    height: 50px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    background: var(--color-paper);
    color: var(--color-ink-muted);
  }

  .search:focus-within {
    outline: 3px solid var(--color-espresso);
    outline-offset: 2px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-size: 1rem;
  }

  .search input::placeholder {
    color: var(--color-ink-muted);
  }

  .page {
    max-width: 900px;
    margin: -70px auto 0;
    padding: 0 20px 48px;
    box-sizing: border-box;
  }

  .results {
    margin-top: 28px;
  }

  .results-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .results-title {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .sort select {
    height: 44px;
    padding: 0 36px 0 14px;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    background: var(--color-paper)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B2F2F' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
      no-repeat right 12px center;
    appearance: none;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
  }

  .game-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  /* Sticky answers bar (shown once the questions scroll away). */
  .sticky {
    position: fixed;
    inset: 0 0 auto;
    z-index: 20;
    background: var(--color-paper);
    border-bottom: 2px solid var(--color-espresso);
    box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12);
    transform: translateY(-110%);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sticky.shown {
    transform: none;
  }

  .sticky-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 10px 20px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sticky-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .sticky-text strong {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
  }

  .sticky-text span {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .pill:active {
    transform: scale(0.98);
  }

  @media (hover: hover) {
    .pill:hover {
      background: rgba(59, 47, 47, 0.06);
    }
  }

  /* Empty result */
  .empty {
    padding: 24px;
    border: 2px dashed var(--color-espresso);
    border-radius: 18px;
    background: var(--color-linen);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .empty-lead {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.1875rem;
  }

  .empty-hint {
    margin: 0;
    color: var(--color-ink-muted);
    font-weight: 600;
  }

  .loosen {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .loosen .pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--color-paper);
  }

  .loosen-count {
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  .link {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-espresso);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.25em;
    cursor: pointer;
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
    .sticky,
    .pill {
      transition: none;
    }
  }

  @media (max-width: 720px) {
    .lid-inner {
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
      padding: 16px 16px 72px;
    }

    .wordmark {
      font-size: 1.5rem;
    }

    .title {
      font-size: 1.1875rem;
    }

    .search {
      margin-left: 0;
      flex-basis: auto;
    }

    .page {
      margin-top: -56px;
      padding: 0 16px 40px;
    }

    .results {
      margin-top: 22px;
    }

    .results-title {
      font-size: 1.5rem;
    }

    .game-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .sticky-inner {
      padding: 10px 16px;
    }
  }
</style>
