<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket, selectGameAction, readyAction, startGameAction } from '$lib/stores/socketClient.js';
  import type { GameMeta } from '@parlor/game-types';
  import LeaveRoomButton from '$lib/components/LeaveRoomButton.svelte';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';

  const games: GameMeta[] = [
    { id: 'quixx', name: 'Quixx', description: 'Fast-paced dice game', minPlayers: 2, maxPlayers: 5, estimatedMinutes: '15-20', tags: ['dice', 'strategy'], displayModes: ['peer'], supportsBots: true },
    { id: 'crazy-eights', name: 'Crazy Eights', description: 'Classic card game', minPlayers: 2, maxPlayers: 5, estimatedMinutes: '10-15', tags: ['cards', 'classic'], displayModes: ['peer'] },
    { id: 'booty-dice', name: 'Booty Dice', description: 'Pirate dice game', minPlayers: 2, maxPlayers: 6, estimatedMinutes: '15-30', tags: ['dice', 'pirates'], displayModes: ['peer'], supportsBots: true },
    { id: 'liars-dice', name: "Liar's Dice", description: 'Bluff and bid dice game', minPlayers: 2, maxPlayers: 6, estimatedMinutes: '15-25', tags: ['dice', 'bluffing'], displayModes: ['peer'], supportsBots: true },
    { id: 'kings-corner', name: 'Kings Corner', description: 'Solitaire-style card game', minPlayers: 2, maxPlayers: 4, estimatedMinutes: '15-25', tags: ['cards', 'classic'], displayModes: ['peer'], supportsBots: true },
  ];

  // Seat colours cycle through the palette; the first is Deep Clay, not Kiln
  // Terracotta, because a cream initial on #C4663A is below 4.5:1.
  const seatColors = ['seat-clay', 'seat-felt', 'seat-mustard', 'seat-ink'];

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);
  let copyStatus = $state<'idle' | 'copied' | 'failed'>('idle');
  let botError = $state('');

  onMount(() => {
    if (browser) getSocket();
  });

  $effect(() => {
    // State arrived (or we already have an identity): we are in this room.
    if (playerState.roomCode === roomCode) {
      roomNotFound = false;
      return;
    }
    if (connectionState.status !== 'connected') return;
    // Wait for the reconnect handshake before declaring the room gone.
    if (connectionState.reconnectPending) return;
    roomNotFound = true;
  });

  $effect(() => {
    if (playerState.roomCode === roomCode && (lobbyState.gameStarting || gameState.view)) {
      goto(resolve('/game/[roomCode]', { roomCode })).catch(console.error);
    }
  });

  let isHost = $derived(!!playerState.id && lobbyState.hostId === playerState.id);
  let spectator = $derived(playerState.roomCode === roomCode && !playerState.id);
  let me = $derived(lobbyState.players.find(p => p.id === playerState.id));
  let selectedGame = $derived(games.find(g => g.id === lobbyState.selectedGameId));
  let gameSupportsAI = $derived(selectedGame?.supportsBots ?? false);
  let hasBots = $derived(lobbyState.players.some(p => p.isBot));
  let botsBlockStart = $derived(hasBots && !gameSupportsAI);
  let canStart = $derived(lobbyState.canStart && !!lobbyState.selectedGameId && !botsBlockStart);
  let codeChars = $derived(roomCode.split(''));

  let startHint = $derived.by(() => {
    if (!lobbyState.selectedGameId) return 'Choose a game first';
    if (botsBlockStart) return `Remove bots — ${selectedGame?.name} doesn't support AI players`;
    if (lobbyState.players.length < 2) return 'Need at least 2 players';
    return 'Waiting for all players to ready up';
  });

  function toggleReady() {
    if (me) readyAction(!me.isReady);
  }

  function startGame() {
    startGameAction();
  }

  let rulesGameId = $state<string | null>(null);
  let rulesOpen = $derived(rulesGameId !== null);
  let rulesGame = $derived(games.find((g) => g.id === rulesGameId));

  function selectGame(gameId: string) {
    selectGameAction(gameId);
  }

  function addBot() {
    botError = '';
    getSocket().emit('lobby:addBot', (success, error) => {
      if (!success) botError = error ?? 'Could not add a bot. Try again.';
    });
  }

  function removeBot(botId: string) {
    botError = '';
    getSocket().emit('lobby:removeBot', botId, (success, error) => {
      if (!success) botError = error ?? 'Could not remove that bot. Try again.';
    });
  }

  function legacyCopy(text: string): boolean {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok: boolean;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  async function copyLink() {
    const url = window.location.origin + '?join=' + roomCode;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      ok = false;
    }
    // Clipboard API is missing on plain-http LAN addresses; fall back.
    if (!ok) ok = legacyCopy(url);
    copyStatus = ok ? 'copied' : 'failed';
    setTimeout(() => (copyStatus = 'idle'), ok ? 2000 : 4000);
  }
</script>

<svelte:head><title>Lobby {roomCode} - Parlor</title></svelte:head>

{#if roomNotFound}
  <header class="lid">
    <div class="lid-inner">
      <div class="lid-bar">
        <a href={resolve('/')} class="wordmark">PARLOR</a>
      </div>
    </div>
  </header>
  <div class="content not-found">
    <h1 class="not-found-title">This lobby doesn't exist or has ended.</h1>
    <p class="not-found-body">Check the code with whoever invited you, or start a new room.</p>
    <a href={resolve('/')} class="btn btn-accent">Back to home</a>
  </div>
{:else}
  <header class="lid">
    <div class="lid-inner">
      <div class="lid-bar">
        <a href={resolve('/')} class="wordmark">PARLOR</a>
        {#if playerState.roomCode === roomCode}<LeaveRoomButton />{/if}
      </div>

      <div class="code">
        <p class="sr-only">Room code {roomCode}</p>
        <div class="code-tiles" aria-hidden="true">
          {#each codeChars as char, i (i)}
            <span class="tile">{char}</span>
          {/each}
        </div>
        <button type="button" class="copy" onclick={copyLink}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
          {copyStatus === 'copied' ? 'Link copied' : 'Copy invite link'}
        </button>
        <span class="sr-only" aria-live="polite">
          {copyStatus === 'copied' ? 'Invite link copied' : copyStatus === 'failed' ? "Couldn't copy the link. Read the code out instead." : ''}
        </span>
        {#if copyStatus === 'failed'}
          <p class="copy-failed">Couldn't copy here. Read the code out instead.</p>
        {/if}
      </div>
    </div>
  </header>

  <div class="content">
    <!-- Game selection -->
    {#if selectedGame}
      <section class="game-panel" aria-label="Selected game">
        <div class="game-panel-text">
          <h2 class="game-panel-name">{selectedGame.name}</h2>
          <span class="game-panel-meta">{selectedGame.minPlayers}–{selectedGame.maxPlayers} players · {selectedGame.estimatedMinutes.replace('-', '–')} min</span>
        </div>
        {#if isHost}
          <button type="button" class="pill pill-on-dark" onclick={() => selectGameAction(null)} aria-label="Change game">Change</button>
        {/if}
      </section>
    {:else if isHost}
      <section class="picker">
        <h2 class="section-title">Choose a game</h2>
        <ul class="picker-list">
          {#each games as game (game.id)}
            <li class="picker-row">
              <button type="button" class="picker-pick" onclick={() => selectGame(game.id)}>
                <span class="picker-name">{game.name}</span>
                <span class="picker-meta">{game.minPlayers}–{game.maxPlayers} players</span>
              </button>
              <button type="button" class="icon-btn" onclick={() => (rulesGameId = game.id)} aria-label="How to play {game.name}" title="How to play {game.name}">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/></svg>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="waiting-game">Waiting for the host to choose a game…</p>
    {/if}

    <!-- Players -->
    <section class="players">
      <h2 class="section-title">Players <span class="count">{lobbyState.players.length}</span></h2>
      <ul class="player-list">
        {#each lobbyState.players as player, i (player.id)}
          <li class="player" class:bot={player.isBot}>
            {#if player.isBot}
              <span class="avatar seat-ink" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
              </span>
            {:else}
              <span class="avatar {seatColors[i % seatColors.length]}" aria-hidden="true">{player.name.trim().charAt(0).toUpperCase()}</span>
            {/if}
            <span class="player-name">
              <span>{player.name}</span>
              <!-- Roles wrap as one unit so "· Host · You" never splits across lines. -->
              <span class="roles">
                {#if player.id === lobbyState.hostId}<span class="role">Host</span>{/if}
                {#if player.id === playerState.id}<span class="role">You</span>{/if}
                {#if player.isBot}<span class="role">Bot</span>{/if}
              </span>
            </span>
            <span class="status" class:is-ready={player.isReady}>
              {player.isReady ? 'Ready' : 'Waiting'}
            </span>
            {#if isHost && player.isBot}
              <button type="button" class="icon-btn" onclick={() => removeBot(player.id)} aria-label="Remove {player.name}" title="Remove {player.name}">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <!-- Actions -->
    <section class="actions" aria-label="Lobby actions">
      {#if lobbyState.gameStarting}
        <p class="starting" role="status">Game starting…</p>
      {/if}

      {#if spectator}
        <p class="hint">Watching as spectator</p>
      {:else if isHost}
        {#if !canStart}<p class="hint">{startHint}</p>{/if}
        <button type="button" class="btn btn-primary" onclick={startGame} disabled={!canStart}>Start Game</button>
        <div class="secondary" class:single={!gameSupportsAI}>
          <button type="button" class="pill" disabled={!me} onclick={toggleReady}>
            {me?.isReady ? 'Not Ready' : 'Ready Up'}
          </button>
          {#if gameSupportsAI}
            <button type="button" class="pill" onclick={addBot}>Add Bot</button>
          {/if}
        </div>
      {:else}
        {#if me?.isReady}
          <p class="hint">Waiting for the host to start…</p>
          <button type="button" class="pill pill-wide" disabled={!me} onclick={toggleReady}>Not Ready</button>
        {:else}
          <button type="button" class="btn btn-primary" disabled={!me} onclick={toggleReady}>Ready Up</button>
        {/if}
      {/if}

      {#if botError}
        <p class="action-error" role="alert">{botError}</p>
      {/if}
      {#if connectionState.actionError}
        <p class="action-error" role="alert">{connectionState.actionError}</p>
      {/if}
    </section>
  </div>

  <RulesModal
    open={rulesOpen}
    gameId={rulesGameId}
    gameName={rulesGame?.name ?? ''}
    onclose={() => (rulesGameId = null)}
    onplay={() => { if (rulesGameId) { selectGame(rulesGameId); rulesGameId = null; } }}
  />
{/if}

<style>
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

  /* Lid: full-bleed terracotta header, one per screen. */
  .lid {
    background: var(--color-terracotta);
    border-bottom: 3px solid var(--color-espresso);
  }

  .lid-inner {
    max-width: 480px;
    margin: 0 auto;
    padding: 18px 20px 22px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .lid-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .wordmark {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 40px;
    letter-spacing: -0.02em;
    color: var(--color-cream);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .wordmark:hover {
    color: var(--color-mustard-tint);
  }

  .lid :global(:focus-visible) {
    outline-color: var(--color-cream);
  }

  .code {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .code-tiles {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }

  .tile {
    height: 58px;
    border-radius: 10px;
    border: 2px solid var(--color-espresso);
    background: var(--color-mustard);
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.875rem;
    font-variant-numeric: tabular-nums;
  }

  .copy {
    height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    background: var(--color-cream);
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  @media (hover: hover) {
    .copy:hover {
      background: var(--color-paper);
    }
  }

  .copy:active {
    transform: scale(0.98);
  }

  .copy-failed {
    margin: 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--color-cream);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-espresso);
  }

  /* Contents */
  .content {
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 20px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: calc(100vh - 230px);
  }

  .section-title {
    margin: 0 0 10px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count {
    font-family: var(--font-heading);
    font-size: 0.875rem;
    font-weight: 800;
    background: var(--color-espresso);
    color: var(--color-cream);
    border-radius: 999px;
    padding: 1px 9px;
    font-variant-numeric: tabular-nums;
  }

  /* Tonight's game: felt panel */
  .game-panel {
    background: var(--color-forest-deep);
    color: var(--color-cream);
    border: 2px solid var(--color-espresso);
    border-radius: 18px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .game-panel-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .game-panel-name {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .game-panel-meta {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-cream);
  }

  .game-panel :focus-visible {
    outline-color: var(--color-cream);
  }

  /* Host game picker */
  .picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .picker-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 4px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  @media (hover: hover) {
    .picker-row:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12);
    }
  }

  .picker-pick {
    flex: 1;
    min-height: 52px;
    padding: 8px 14px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--color-espresso);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    text-align: left;
    cursor: pointer;
  }

  .picker-name {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.0625rem;
  }

  .picker-meta {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink-muted);
    white-space: nowrap;
  }

  .waiting-game {
    margin: 0;
    padding: 16px;
    border: 2px dashed var(--color-espresso);
    border-radius: 18px;
    background: var(--color-linen);
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  /* Players */
  .player-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .player {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    box-sizing: border-box;
    padding: 8px 12px 8px 8px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
    color: var(--color-espresso);
  }

  .player.bot {
    border-style: dashed;
    background: var(--color-linen);
    padding-right: 4px;
  }

  .avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    color: var(--color-cream);
  }

  .seat-clay { background: var(--color-terracotta-deep); }
  .seat-felt { background: var(--color-forest-deep); }
  .seat-mustard { background: var(--color-mustard); color: var(--color-espresso); }
  .seat-ink { background: var(--color-espresso); }

  /* Name and roles are flex items: roles wrap under the name as one unit,
     with no dangling separator at the start of the line. */
  .player-name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.0625rem;
    overflow-wrap: anywhere;
  }

  .roles {
    white-space: nowrap;
  }

  .roles:empty {
    display: none;
  }

  .role {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.8125rem;
    color: var(--color-ink-muted);
  }

  .role + .role::before {
    content: ' · ';
  }

  .status {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1.5px solid var(--color-espresso);
    color: var(--color-espresso);
  }

  .status.is-ready {
    background: var(--color-forest-deep);
    border-color: var(--color-forest-deep);
    color: var(--color-cream);
  }

  /* Icon buttons (help, remove bot): 44px target */
  .icon-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  @media (hover: hover) {
    .icon-btn:hover {
      background: rgba(59, 47, 47, 0.08);
    }
  }

  /* Actions */
  .actions {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn {
    height: 56px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.1875rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
  }

  .btn-primary {
    background: var(--color-espresso);
    color: var(--color-cream);
    text-transform: uppercase;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2E2727;
  }

  .btn-accent {
    height: 52px;
    padding: 0 28px;
    background: var(--color-terracotta-deep);
    border-color: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-size: 1.0625rem;
    letter-spacing: 0;
  }

  .btn-accent:hover {
    background: var(--color-terracotta-press);
    border-color: var(--color-terracotta-press);
  }

  .btn:active:not(:disabled),
  .pill:active:not(:disabled) {
    transform: scale(0.98);
  }

  /* Disabled reads as "not yet", not as broken: dashed outline, Faded Ink. */
  .btn:disabled,
  .pill:disabled {
    background: var(--color-linen);
    border-style: dashed;
    color: var(--color-ink-muted);
    cursor: not-allowed;
  }

  .secondary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .secondary.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .pill {
    height: 46px;
    padding: 0 18px;
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

  .pill:hover:not(:disabled) {
    background: rgba(59, 47, 47, 0.06);
  }

  .pill-wide {
    width: 100%;
  }

  .pill-on-dark {
    flex-shrink: 0;
    height: 40px;
    padding: 0 14px;
    border-color: var(--color-cream);
    color: var(--color-cream);
    font-size: 0.8125rem;
  }

  .pill-on-dark:hover:not(:disabled) {
    background: rgba(253, 246, 236, 0.14);
  }

  .hint {
    margin: 0;
    text-align: center;
    text-wrap: balance;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  .action-error {
    margin: 0;
    text-align: center;
    text-wrap: balance;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-danger);
  }

  .starting {
    margin: 0;
    padding: 12px 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-mustard-tint);
    text-align: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    color: var(--color-espresso);
  }

  /* Actions sit in the thumb zone on phones; on a laptop they follow the list. */
  @media (min-width: 720px) {
    .content {
      min-height: 0;
    }

    .actions {
      margin-top: 8px;
    }
  }

  /* Not found */
  .not-found {
    align-items: flex-start;
    gap: 12px;
    padding-top: 32px;
    min-height: 0;
  }

  .not-found-title {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.15;
    color: var(--color-espresso);
  }

  .not-found-body {
    margin: 0 0 8px;
    font-size: 1rem;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }
</style>
