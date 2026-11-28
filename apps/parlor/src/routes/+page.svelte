<script lang="ts">
  import ParlorMark from '$lib/components/ui/ParlorMark.svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { getSocket, createRoomAction, joinRoomAction, lookupRoomAction, spectateRoomAction } from '$lib/stores/socketClient.js';
  import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@parlor/game-types';
  import { catalog as games, findGame, minutesRange, playerRange } from '$lib/games/catalog.js';
  import { formatLabels, kindLabels, weightLabels } from '$lib/games/discovery.js';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';

  let prefillCode = $derived(($page.url.searchParams.get('join') ?? '').trim().toUpperCase());
  let editingCode = $derived(prefillCode.length !== ROOM_CODE_LENGTH || !/^[A-Z0-9]+$/.test(prefillCode));
  let codeInput = $state<HTMLInputElement | null>(null);
  let joinName = $state('');
  let joinCode = $derived(prefillCode);
  let normalizedCode = $derived(joinCode.trim().toUpperCase());
  let roomPreview = $state<({ code: string } & NonNullable<Awaited<ReturnType<typeof lookupRoomAction>>>) | null>(null);
  let visiblePreview = $derived(roomPreview?.code === normalizedCode ? roomPreview : null);
  let previewGame = $derived(findGame(visiblePreview?.gameId));
  let error = $state('');
  let loading = $state(false);
  let interactive = $state(false);
  let nameInput = $state<HTMLInputElement | null>(null);

  // For game card "create" flow
  let selectedGameForCreate = $state<string | undefined>();
  let creatingRoom = $state(false);
  let createName = $state('');
  let createDialog = $state<HTMLDialogElement | null>(null);
  let createGame = $derived(findGame(selectedGameForCreate));

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

  // Native <dialog>: focus moves inside, Escape closes, background is inert.
  $effect(() => {
    if (!createDialog) return;
    if (creatingRoom && !createDialog.open) createDialog.showModal();
    if (!creatingRoom && createDialog.open) createDialog.close();
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
    if (loading) return;
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

  async function handleCreateRoom() {
    if (!createName.trim()) { error = 'Enter your name'; return; }
    loading = true;
    error = '';
    try {
      const roomCode = await createRoomAction(createName.trim(), selectedGameForCreate);
      await goto(resolve('/lobby/[roomCode]', { roomCode }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create room';
    } finally {
      loading = false;
    }
  }

  function cancelCreate() {
    creatingRoom = false;
    selectedGameForCreate = undefined;
    createName = '';
    error = '';
  }

  function handleDialogClick(e: MouseEvent) {
    // A click on the dialog element itself (not its contents) is the backdrop.
    if (e.target === createDialog) cancelCreate();
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

  function handleCreateSubmit(e: SubmitEvent) {
    e.preventDefault();
    handleCreateRoom().catch(console.error);
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
      <h2 id="join-title" class="join-title">{prefillCode && visiblePreview?.preview?.hostName ? `Join ${visiblePreview.preview.hostName}’s room` : 'Join a room'}</h2>
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
          {#if previewGame}
            <div class="room-preview spine-{previewGame.shelf}">
              <strong>{previewGame.name}</strong>
              <span>{previewGame.tagline}</span>
            </div>
          {:else if visiblePreview}
            <p class="room-preview-message">
              {visiblePreview.exists ? 'Game selection happens in the lobby.' : 'Room not found. Check the code and try again.'}
            </p>
          {/if}
        </div>
      </div>
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
      {#if error && !creatingRoom}
        <p id="join-error" class="error" role="alert">{error}</p>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={!interactive || loading}>Join</button>
    </form>
    {#if prefillCode}
      <details class="invite-options">
        <summary>Not what you meant?</summary>
        {@render watchButton()}
        <a href={resolve('/')}>Start a new room</a>
      </details>
    {:else}
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
      <button type="button" class="btn btn-accent create-room" onclick={() => openCreateRoom()} disabled={!interactive || loading}>Create a room</button>
      <div class="game-grid">
        {#each games as game (game.id)}
          <article class="game-card spine-{game.shelf}">
            <div class="game-head">
              <h3 class="game-name">{game.name}</h3>
              <span class="game-meta">{playerRange(game)} · {minutesRange(game)}m</span>
            </div>
            <p class="game-desc">{game.description}</p>
            <p class="game-tags">{[kindLabels[game.kind], weightLabels[game.weight], ...(game.format === 'individual' ? [] : [formatLabels[game.format]])].join(' · ')}</p>
            <div class="game-actions">
              <button type="button" class="spine-ghost" onclick={() => openRules(game.id)} disabled={!interactive}>How to play</button>
              <button type="button" class="spine-solid" onclick={() => openCreateRoom(game.id)} disabled={!interactive}>Start game</button>
            </div>
          </article>
        {/each}
      </div>
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

<!-- Create room dialog -->
<dialog
  bind:this={createDialog}
  class="create"
  aria-labelledby="create-title"
  aria-describedby="create-desc"
  onclose={cancelCreate}
  onclick={handleDialogClick}
>
  {#if creatingRoom}
    <form class="create-form" onsubmit={handleCreateSubmit} novalidate>
      <h2 id="create-title" class="create-title">{createGame ? `Create a ${createGame.name} room` : 'Create a room'}</h2>
      <p id="create-desc" class="create-desc">{createGame?.description ?? 'Invite friends and vote on what to play.'}</p>
      <label class="field">
        <span class="field-label">Your name</span>
        <input
          type="text"
          bind:value={createName}
          placeholder="Enter your name"
          maxlength={PLAYER_NAME_MAX_LENGTH}
          autocomplete="nickname"
          class="input"
          aria-invalid={!!error && !createName.trim()}
          aria-describedby={error ? 'create-error' : undefined}
        />
      </label>
      {#if error}
        <p id="create-error" class="error" role="alert">{error}</p>
      {/if}
      <div class="create-actions">
        <button type="button" class="pill" onclick={cancelCreate}>Cancel</button>
        <button type="submit" class="btn btn-accent" disabled={loading}>
          {loading ? 'Creating…' : 'Create room'}
        </button>
      </div>
    </form>
  {/if}
</dialog>

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
    color: inherit;
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

  .game-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  /* Spine colours (--spine-bg, --spine-fg, --spine-solid-*) come from the
     shared .spine-{shelf} classes in app.css. */
  .game-card {
    background: var(--spine-bg);
    color: var(--spine-fg);
    border: 2.5px solid var(--color-espresso);
    border-radius: 18px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  @media (hover: hover) {
    .game-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12);
    }
  }

  .game-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .game-name {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.75rem;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .game-meta {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1.5px solid currentColor;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .game-desc {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
    flex: 1;
  }

  .game-tags {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .game-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .spine-ghost,
  .spine-solid {
    flex: 1;
    height: 44px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .spine-ghost {
    border: 2px solid var(--spine-fg);
    background: transparent;
    color: var(--spine-fg);
    font-weight: 700;
  }

  @media (hover: hover) {
    .spine-ghost:hover {
      background: color-mix(in srgb, var(--spine-fg) 12%, transparent);
    }
  }

  .spine-solid {
    border: 2px solid var(--spine-solid-bg);
    background: var(--spine-solid-bg);
    color: var(--spine-solid-fg);
    font-weight: 800;
  }

  @media (hover: hover) {
    .spine-solid:hover {
      background: color-mix(in srgb, var(--spine-solid-bg) 88%, var(--spine-fg));
    }
  }

  .game-card:not(.spine-mustard):not(.spine-linen) :focus-visible {
    outline-color: var(--color-cream);
  }

  .create-room {
    margin-bottom: 16px;
  }

  /* Create dialog */
  .create {
    /* Tailwind preflight zeroes dialog margins; restore centring. */
    margin: auto;
    width: min(420px, calc(100% - 32px));
    box-sizing: border-box;
    padding: 24px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 20px;
    background: var(--color-paper);
    color: var(--color-espresso);
    box-shadow: 0 8px 32px rgba(59, 47, 47, 0.15);
  }

  .create::backdrop {
    background: rgba(59, 47, 47, 0.5);
  }

  .create-desc {
    margin: -4px 0 4px;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .create-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  @media (max-width: 600px) {
    .game-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .create-actions > * {
      flex: 1;
    }
  }
</style>
