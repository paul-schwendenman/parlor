<script lang="ts">
  import ParlorMark from '$lib/components/ui/ParlorMark.svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { getSocket, joinRoomAction, lookupRoomAction, spectateRoomAction } from '$lib/stores/socketClient.js';
  import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@parlor/game-types';
  import { catalog, findGame } from '$lib/games/catalog.js';
  import { featuredShelfOrder, pickShelfGames } from '$lib/games/shelf.js';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';
  import GameCard from '$lib/components/games/GameCard.svelte';
  import CreateRoomDialog from '$lib/components/games/CreateRoomDialog.svelte';

  let prefillCode = $derived(($page.url.searchParams.get('join') ?? '').trim().toUpperCase());
  let editingCode = $derived(prefillCode.length !== ROOM_CODE_LENGTH || !/^[A-Z0-9]+$/.test(prefillCode));
  let codeInput = $state<HTMLInputElement | null>(null);
  let joinName = $state('');
  let joinCode = $derived(prefillCode);
  let normalizedCode = $derived(joinCode.trim().toUpperCase());
  let roomPreview = $state<({ code: string } & NonNullable<Awaited<ReturnType<typeof lookupRoomAction>>>) | null>(null);
  let visiblePreview = $derived(roomPreview?.code === normalizedCode ? roomPreview : null);
  let previewGame = $derived(findGame(visiblePreview?.gameId));
  let gameStatus = $derived(visiblePreview?.preview?.status);
  let spectateOnly = $derived(gameStatus === 'playing' || gameStatus === 'finished');
  let error = $state('');
  let loading = $state(false);
  let interactive = $state(false);
  let nameInput = $state<HTMLInputElement | null>(null);

  const shelf = pickShelfGames(catalog, { showAllUpTo: 0, strategy: featuredShelfOrder });

  // For game card "create" flow
  let selectedGameForCreate = $state<string | undefined>();
  let creatingRoom = $state(false);

  $effect(() => {
    const code = normalizedCode;
    roomPreview = null;
    if (code.length !== ROOM_CODE_LENGTH || !/^[A-Z0-9]+$/.test(code)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void lookupRoomAction(code).then((result) => {
        if (!cancelled && result) roomPreview = { code, ...result };
      }).catch(() => {
        // Room previews are optional when the lookup fails.
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  onMount(() => {
    interactive = true;
    // An invite link (or a pasted lobby link) already has the code: the name is next.
    if (prefillCode) nameInput?.focus();
    if (browser) {
      getSocket();
    }
  });

  async function changeCode() {
    editingCode = true;
    await tick();
    codeInput?.focus();
    codeInput?.select();
  }

  async function handleJoin() {
    if (loading || spectateOnly) return;
    if (!joinCode.trim()) { error = 'Enter the room code from your invite'; return; }
    if (!joinName.trim()) { error = 'Enter your name so the table knows who you are'; return; }
    loading = true;
    error = '';
    try {
      const result = await joinRoomAction(joinCode.trim(), joinName.trim());
      if (result.success) {
        await goto(resolve('/lobby/[roomCode]', { roomCode: joinCode.trim().toUpperCase() }));
      } else {
        error = result.error ?? 'Failed to join room';
      }
    } catch {
      error = 'Failed to join room';
    } finally {
      loading = false;
    }
  }

  async function handleWatch() {
    if (loading) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) { error = 'Enter the room code you want to watch'; return; }

    loading = true;
    error = '';
    try {
      await spectateRoomAction(code);
      await goto(resolve('/lobby/[roomCode]', { roomCode: code }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to watch room';
    } finally {
      loading = false;
    }
  }

  function openCreateRoom(gameId?: string) {
    error = '';
    selectedGameForCreate = gameId;
    creatingRoom = true;
  }

  function cancelCreate() {
    creatingRoom = false;
    selectedGameForCreate = undefined;
  }

  let rulesGameId = $state<string | null>(null);
  let rulesOpen = $derived(rulesGameId !== null);
  let rulesGame = $derived(findGame(rulesGameId));

  function openRules(gameId: string) {
    rulesGameId = gameId;
  }

  function closeRules() {
    rulesGameId = null;
  }

  function playFromRules() {
    if (rulesGameId) {
      openCreateRoom(rulesGameId);
      rulesGameId = null;
    }
  }

  function handleJoinSubmit(e: SubmitEvent) {
    e.preventDefault();
    handleJoin().catch(console.error);
  }

</script>

<svelte:head><title>Parlor - Game Night</title></svelte:head>

<header class="lid">
  <div class="lid-inner">
    <h1 class="wordmark"><ParlorMark />Parlor</h1>
    <p class="tagline">Game night, anywhere</p>
  </div>
</header>

<div class="home">
  <!-- Join -->
  <section class="join" aria-labelledby="join-title">
    <div aria-live="polite">
      <h2 id="join-title" class="join-title">
        {#if gameStatus === 'playing'}
          {previewGame?.name ?? 'Game'} in progress
        {:else if gameStatus === 'finished'}
          {previewGame?.name ?? 'Game'} has finished
        {:else}
          {prefillCode && visiblePreview?.preview?.hostName ? `Join ${visiblePreview.preview.hostName}’s room` : 'Join a room'}
        {/if}
      </h2>
      {#if prefillCode && visiblePreview?.preview}
        {@const count = visiblePreview.preview.peopleCount}
        <p class="join-invite">{count} {count === 1 ? 'person' : 'people'} here</p>
      {/if}
    </div>
    <form class="join-form" onsubmit={handleJoinSubmit} novalidate>
      <div>
        <div class="code-field">
          <label class="field">
            <span class="field-label">Room code</span>
            <input
              type="text"
              bind:value={joinCode}
              bind:this={codeInput}
              readonly={!!prefillCode && !editingCode}
              placeholder="ABCD"
              maxlength={ROOM_CODE_LENGTH}
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              class="input input-code"
              aria-invalid={!!error && !creatingRoom && !joinCode.trim()}
              aria-describedby={error && !creatingRoom ? 'join-error' : undefined}
            />
          </label>
          {#if prefillCode && !editingCode}
            <button type="button" class="btn-watch change-code" onclick={changeCode}>Change</button>
          {/if}
        </div>
        <div role="status">
          {#if previewGame && !spectateOnly}
            <div class="room-preview spine-{previewGame.shelf}">
              <strong>{previewGame.name}</strong>
              <span>{previewGame.tagline}</span>
            </div>
          {:else if visiblePreview && !spectateOnly}
            <p class="room-preview-message">
              {visiblePreview.exists ? 'Game selection happens in the lobby.' : 'Room not found. Check the code and try again.'}
            </p>
          {/if}
        </div>
      </div>
      {#if !spectateOnly}
        <label class="field">
          <span class="field-label">Your name</span>
          <input
            type="text"
            bind:value={joinName}
            bind:this={nameInput}
            placeholder="Your name"
            maxlength={PLAYER_NAME_MAX_LENGTH}
            autocomplete="nickname"
            class="input"
            aria-invalid={!!error && !creatingRoom && !!joinCode.trim() && !joinName.trim()}
            aria-describedby={error && !creatingRoom ? 'join-error' : undefined}
          />
        </label>
      {/if}
      {#if error && !creatingRoom}
        <p id="join-error" class="error" role="alert">{error}</p>
      {/if}
      {#if spectateOnly}
        <button type="button" class="btn btn-primary" onclick={handleWatch} disabled={!interactive || loading}>Spectate</button>
      {:else}
        <button type="submit" class="btn btn-primary" disabled={!interactive || loading}>Join</button>
      {/if}
    </form>
    {#if prefillCode && !spectateOnly}
      <details class="invite-options">
        <summary>Not what you meant?</summary>
        {@render watchButton()}
        <a href={resolve('/')}>Start a new room</a>
      </details>
    {:else if !spectateOnly}
      {@render watchButton()}
    {/if}
  </section>

  {#snippet watchButton()}
    <button type="button" class="btn-watch" onclick={handleWatch} disabled={!interactive || loading}>Watch as spectator</button>
  {/snippet}

  {#if !prefillCode}
    <!-- Game shelf -->
    <section class="shelf" aria-labelledby="shelf-title">
      <h2 id="shelf-title" class="shelf-title">Or start a new room</h2>
      <p class="shelf-hint">Create a room and choose the game in the lobby, or start with one below.</p>
      <button type="button" class="btn btn-accent create-room" onclick={() => openCreateRoom()} disabled={!interactive || loading}>Create a room</button>
      <div class="game-grid">
        {#each shelf.shown as game (game.id)}
          <GameCard {game} disabled={!interactive} onrules={openRules} onstart={openCreateRoom} />
        {/each}
      </div>
      {#if shelf.hidden > 0}
        <p class="browse-all">
          <a href={resolve('/games')}>See all {shelf.total} games and find one that fits your <span class="nowrap">group<svg class="arrow" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a>
        </p>
      {/if}
    </section>

    <RulesModal
      open={rulesOpen}
      gameId={rulesGameId}
      gameName={rulesGame?.name ?? ''}
      onclose={closeRules}
      onplay={playFromRules}
    />
  {/if}
</div>

<CreateRoomDialog open={creatingRoom} gameId={selectedGameForCreate} onclose={cancelCreate} />

<style>
  .code-field {
    display: flex;
    align-items: end;
    gap: 12px;
  }

  .code-field .field {
    flex: 1;
    min-width: 0;
  }

  .invite-options {
    margin-top: 16px;
    color: var(--color-espresso);
  }

  .invite-options summary,
  .invite-options a {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
  }

  .invite-options a {
    display: block;
    width: fit-content;
    padding: 0 8px;
    border-radius: 999px;
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.25em;
  }

  /* Lid */
  .lid {
    background: var(--color-terracotta);
    border-bottom: 3px solid var(--color-espresso);
  }

  .lid-inner {
    max-width: 800px;
    margin: 0 auto;
    padding: 44px 20px 96px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .wordmark {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.2em;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: clamp(3.5rem, 14vw, 4.75rem);
    line-height: 0.9;
    letter-spacing: -0.035em;
    text-transform: uppercase;
    color: var(--color-cream);
  }

  .tagline {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.25rem;
    color: var(--color-cream);
  }

  .home {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 20px 40px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 36px;
  }

  /* Join sheet: the one raised surface, overlapping the lid */
  .join {
    margin-top: -68px;
    max-width: 520px;
    width: 100%;
    box-sizing: border-box;
    background: var(--color-paper);
    border: 2.5px solid var(--color-espresso);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .join-title,
  .create-title {
    margin: 0 0 6px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--color-espresso);
  }

  .join-invite {
    margin: 0 0 14px;
    font-size: 1rem;
    line-height: 1.4;
    color: var(--color-ink-muted);
  }

  .join-form,
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-espresso);
  }

  .input {
    height: 50px;
    width: 100%;
    box-sizing: border-box;
    padding: 0 14px;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    background: var(--color-paper);
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-size: 1rem;
  }

  .input::placeholder {
    color: var(--color-ink-muted);
  }

  .input[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .input-code {
    height: 56px;
    background: var(--color-mustard-tint);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.625rem;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    text-align: center;
    /* Optical centring: tracking adds trailing space after the last letter. */
    padding-left: calc(14px + 0.32em);
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-danger);
  }

  .room-preview {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--spine-bg);
    color: var(--spine-fg);
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
  }

  .room-preview strong {
    font-family: var(--font-heading);
    font-size: 1rem;
  }

  .room-preview-message {
    margin: 8px 0 0;
    font-size: 0.875rem;
    color: var(--color-ink-muted);
  }

  /* Buttons */
  .btn {
    height: 54px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.1875rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
  }

  .btn-primary {
    margin-top: 4px;
    background: var(--color-espresso);
    color: var(--color-cream);
    text-transform: uppercase;
  }

  @media (hover: hover) {
    .btn-primary:hover:not(:disabled) {
      background: #2E2727;
    }
  }

  .btn-accent {
    padding: 0 24px;
    white-space: nowrap;
    background: var(--color-terracotta-deep);
    border-color: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-size: 1rem;
    letter-spacing: 0;
  }

  @media (hover: hover) {
    .btn-accent:hover:not(:disabled) {
      background: var(--color-terracotta-press);
      border-color: var(--color-terracotta-press);
    }
  }

  .btn:active:not(:disabled),
  .pill:active,
  .spine-ghost:active,
  .spine-solid:active {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .btn-watch {
    align-self: center;
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    background: none;
    color: var(--color-espresso);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.25em;
    cursor: pointer;
  }

  .btn-watch:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .pill {
    height: 50px;
    padding: 0 20px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  @media (hover: hover) {
    .pill:hover {
      background: rgba(59, 47, 47, 0.06);
    }
  }

  /* Shelf: each game keeps its own spine colour (catalog.ts, DESIGN.md: Game shelf). */
  .shelf-title {
    margin: 0 0 14px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.875rem;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--color-espresso);
  }

  .shelf-hint {
    margin: -6px 0 14px;
    max-width: 36rem;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .game-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  /* A section-level way out under the grid, not a footnote to the last card. */
  .browse-all {
    margin: 28px 0 0;
    text-align: center;
  }

  .browse-all a {
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    min-height: 44px;
    padding: 8px 16px;
    border-radius: 999px;
    align-content: center;
    color: var(--color-espresso);
    font-weight: 700;
    line-height: 1.4;
    text-wrap: balance;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.25em;
    transition: text-decoration-thickness 0.15s ease-out;
  }

  .browse-all .nowrap {
    white-space: nowrap;
  }

  .browse-all .arrow {
    display: inline-block;
    margin-left: 6px;
    vertical-align: -0.15em;
    transition: transform 0.15s ease-out;
  }

  @media (hover: hover) {
    .browse-all a:hover,
    .invite-options a:hover {
      text-decoration-thickness: 3px;
    }

    .browse-all a:hover .arrow {
      transform: translateX(3px);
    }
  }

  .browse-all a:active,
  .invite-options a:active {
    text-decoration-thickness: 3px;
  }

  .browse-all a:active .arrow {
    transform: translateX(3px);
  }

  @media (prefers-reduced-motion: reduce) {
    .browse-all a,
    .browse-all .arrow {
      transition: none;
    }
  }

  .create-room {
    margin-bottom: 16px;
  }

  @media (max-width: 600px) {
    .game-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    /* Two balanced lines that the focus pill can hug, not a full-width oval. */
    .browse-all a {
      max-width: 16rem;
    }
  }
</style>
