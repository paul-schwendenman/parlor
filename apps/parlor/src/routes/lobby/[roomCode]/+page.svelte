<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket, ballotAction, readyAction, startGameAction } from '$lib/stores/socketClient.js';
  import { catalog as games, findGame, minutesRange, playerCount, playersNeeded } from '$lib/games/catalog.js';
  import { MAX_BOTS, type LobbyPlayer } from '@parlor/game-types';
  import LeaveRoomButton from '$lib/components/LeaveRoomButton.svelte';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';

  // Seat colours cycle through the palette; the first is Deep Clay, not Kiln
  // Terracotta, because a cream initial on #C4663A is below 4.5:1.
  const seatColors = ['seat-clay', 'seat-felt', 'seat-mustard', 'seat-ink'];
  // While voting there is no game to size the room by, so Add bot stops at the
  // largest table any game in the catalogue can seat.
  const votingSeatCap = Math.max(...games.map(game => game.maxPlayers));

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);
  let copyStatus = $state<'idle' | 'copied' | 'failed'>('idle');
  let botError = $state('');
  let ballotError = $state('');
  let ballotPending = $state(false);
  let gameHeading = $state<HTMLHeadingElement>();
  let ballotHeading = $state<HTMLHeadingElement>();

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
  let selectedGame = $derived(findGame(lobbyState.selectedGameId));
  let gameSupportsAI = $derived(selectedGame?.supportsBots ?? false);
  let botCount = $derived(lobbyState.players.filter(p => p.isBot).length);
  let hasBots = $derived(botCount > 0);
  let botsBlockStart = $derived(hasBots && !!selectedGame && !gameSupportsAI);
  let canStart = $derived(lobbyState.canStart && !!lobbyState.selectedGameId && !botsBlockStart);
  let ballot = $derived(lobbyState.ballot);
  let seatCount = $derived(lobbyState.players.length);
  let hostName = $derived(lobbyState.players.find(p => p.id === lobbyState.hostId)?.name ?? 'the host');
  let leaders = $derived.by(() => {
    const playable = games.filter(game => seatCount >= game.minPlayers && seatCount <= game.maxPlayers
      && (!hasBots || game.supportsBots));
    const high = Math.max(0, ...playable.map(game => ballot?.totals[game.id] ?? 0));
    return high ? playable.filter(game => ballot?.totals[game.id] === high) : [];
  });
  let codeChars = $derived(roomCode.split(''));

  // Seats: once a game is confirmed, the list fills out to its minimum with
  // open seats, and says how much room is left up to its maximum.
  let openSeats = $derived(selectedGame ? Math.max(0, selectedGame.minPlayers - seatCount) : 0);
  let openSeatNumbers = $derived(Array.from({ length: openSeats }, (_, k) => seatCount + k + 1));
  let seatsLeft = $derived(selectedGame ? Math.max(0, selectedGame.maxPlayers - seatCount) : 0);
  let overBy = $derived(selectedGame ? Math.max(0, seatCount - selectedGame.maxPlayers) : 0);
  let seatCap = $derived(selectedGame?.maxPlayers ?? votingSeatCap);
  /** Bots are an option for this room at all (the game uses them, or none is chosen yet). */
  let botsAllowed = $derived(!selectedGame || gameSupportsAI);
  /** Why Add bot is off right now, or '' when the host can add one. */
  let botBlockReason = $derived.by(() => {
    if (seatCount >= seatCap) {
      return selectedGame
        ? `${selectedGame.name} seats ${seatsPhrase(selectedGame.minPlayers, selectedGame.maxPlayers)}, and every seat is taken.`
        : `No game here seats more than ${votingSeatCap}.`;
    }
    if (botCount >= MAX_BOTS) return `Rooms can have ${MAX_BOTS} bots at most. Invite someone for the next seat.`;
    return '';
  });
  let botCanFill = $derived(botsAllowed && botCount < MAX_BOTS);

  function seatsPhrase(min: number, max: number): string {
    return min === max ? `${max}` : `up to ${max}`;
  }

  /** "Joe", "Joe and Ann", or "3 players". */
  function who(list: LobbyPlayer[]): string {
    return list.length <= 2 ? list.map(p => p.name).join(' and ') : `${list.length} players`;
  }

  // Humans the start is waiting on. The host's START is their ready, so they
  // never count; bots are always ready.
  let awayPlayers = $derived(lobbyState.players.filter(p => !p.isBot && !p.connected));
  let notReady = $derived(lobbyState.players.filter(p => !p.isBot && p.connected && !p.isReady
    && p.id !== lobbyState.hostId));

  // Order: seats, then bots the game can't use, then readiness.
  let startHint = $derived.by(() => {
    if (!selectedGame) return 'Choose a game first.';
    const name = selectedGame.name;
    if (openSeats > 0) {
      const needs = selectedGame.minPlayers === selectedGame.maxPlayers
        ? `${selectedGame.minPlayers} players`
        : `at least ${selectedGame.minPlayers} players`;
      return `${name} needs ${needs}. Invite ${openSeats} more${botCanFill ? ' or add a bot' : ''}.`;
    }
    if (overBy > 0) {
      return `${name} seats ${seatsPhrase(selectedGame.minPlayers, selectedGame.maxPlayers)}. ${hasBots ? 'Remove a bot or choose' : 'Choose'} another game.`;
    }
    if (botsBlockStart) return `${name} doesn't use bots. Remove them to start.`;
    if (awayPlayers.length) return `Waiting for ${who(awayPlayers)} to reconnect.`;
    if (notReady.length) return `Waiting for ${who(notReady)} to get ready.`;
    return 'Getting the table ready…';
  });

  // What a guest is waiting on, naming the host. Empty while their own Ready
  // button is the next step and nothing else is in the way.
  let guestHint = $derived.by(() => {
    if (!selectedGame) return '';
    const name = selectedGame.name;
    if (openSeats > 0) {
      return `${name} needs ${playersNeeded(openSeats).replace('Needs ', '')}. Waiting for ${hostName} to invite someone${botCanFill ? ' or add a bot' : ''}.`;
    }
    if (overBy > 0) {
      return `${name} seats ${seatsPhrase(selectedGame.minPlayers, selectedGame.maxPlayers)}. Waiting for ${hostName} to make room or choose another game.`;
    }
    if (botsBlockStart) return `${name} doesn't use bots. Waiting for ${hostName} to remove them.`;
    if (!me?.isReady) return '';
    if (awayPlayers.length) return `Waiting for ${who(awayPlayers)} to reconnect.`;
    const others = notReady.filter(p => p.id !== me?.id);
    if (others.length) return `Waiting for ${who(others)} to get ready.`;
    return `Waiting for ${hostName} to start.`;
  });

  // A bot error belongs to the game or ballot it happened in.
  let roundId = $derived(ballot?.roundId ?? null);
  $effect(() => {
    void lobbyState.selectedGameId;
    void roundId;
    botError = '';
  });

  function toggleReady() {
    if (me) readyAction(!me.isReady);
  }

  function startGame() {
    startGameAction();
  }

  let rulesGameId = $state<string | null>(null);
  let rulesOpen = $derived(rulesGameId !== null);
  let rulesGame = $derived(findGame(rulesGameId));

  async function updateBallot(action: 'open' | 'vote' | 'confirm', gameId: string | null = null) {
    if (ballotPending) return;
    ballotError = '';
    ballotPending = true;
    try {
      await ballotAction(action, gameId, ballot?.roundId);
      await tick();
      if (action === 'confirm') gameHeading?.focus();
      if (action === 'open') ballotHeading?.focus();
    } catch (error) {
      ballotError = error instanceof Error ? error.message : 'Could not update your game choice.';
    } finally {
      ballotPending = false;
    }
  }

  function voteFor(gameId: string) {
    void updateBallot('vote', ballot?.myVote === gameId ? null : gameId);
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
          <h2 class="game-panel-name" tabindex="-1" bind:this={gameHeading}>{selectedGame.name}</h2>
          <span class="game-panel-meta">{playerCount(selectedGame)} · {minutesRange(selectedGame)} min</span>
        </div>
        {#if isHost}
          <button type="button" class="pill pill-on-dark" onclick={() => updateBallot('open')} disabled={ballotPending}>Vote for next game</button>
        {/if}
      </section>
    {:else if ballot}
      <section class="picker" aria-labelledby="ballot-title">
        <h2 id="ballot-title" class="section-title" tabindex="-1" bind:this={ballotHeading}>Vote on a game</h2>
        <p class="ballot-summary" aria-live="polite">
          {#if leaders.length > 1}
            Tied for the lead · {leaders.map(game => game.name).join(', ')}
          {:else if leaders[0]}
            Leading · {leaders[0].name}
          {:else if isHost}
            Confirm a game when your group is ready.
          {:else}
            The host will confirm the game.
          {/if}
        </p>
        <ul class="picker-list">
          {#each games as game (game.id)}
            {@const voteCount = ballot.totals[game.id] ?? 0}
            {@const voted = ballot.myVote === game.id}
            {@const tooMany = seatCount > game.maxPlayers}
            <li class="picker-row" class:voted>
              <div class="picker-details">
                <div>
                  <h3 class="picker-name">{game.name}</h3>
                  <p class="picker-meta">
                    {playerCount(game)}
                    {#if tooMany}
                      · Too many players
                    {:else if seatCount < game.minPlayers}
                      · {playersNeeded(game.minPlayers - seatCount)}
                    {/if}
                  </p>
                </div>
                <span class="vote-count">{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</span>
                <button type="button" class="icon-btn" onclick={() => (rulesGameId = game.id)} aria-label="How to play {game.name}" title="How to play {game.name}">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/></svg>
                </button>
              </div>
              {#if me && !spectator}
                <div class="vote-actions">
                  <button type="button" class="pill" aria-pressed={voted} aria-label="Vote for {game.name}" aria-disabled={ballotPending || undefined} disabled={tooMany && !voted} onclick={() => voteFor(game.id)}>
                    {voted ? 'Voted ✓' : 'Vote'}
                  </button>
                  {#if isHost}
                    <button type="button" class="pill confirm-game" aria-label="Confirm {game.name}" aria-disabled={ballotPending || undefined} disabled={tooMany} onclick={() => updateBallot('confirm', game.id)}>Confirm</button>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="waiting-game">Loading game choices…</p>
    {/if}

    <!-- Players and seats -->
    <section class="players" aria-labelledby="players-title">
      <h2 id="players-title" class="section-title">
        Players
        {#if selectedGame && openSeats > 0}
          <span class="count">{seatCount} of {selectedGame.minPlayers}</span>
        {:else}
          <span class="count">{seatCount}</span>
        {/if}
      </h2>
      <ul class="player-list">
        {#each lobbyState.players as player, i (player.id)}
          {@const isHostRow = player.id === lobbyState.hostId}
          <li class="player" class:bot={player.isBot}>
            {#if player.isBot}
              <span class="avatar seat-ink" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
              </span>
            {:else}
              <span class="avatar {seatColors[i % seatColors.length]}" aria-hidden="true">{player.name.trim().charAt(0).toUpperCase()}</span>
            {/if}
            <span class="player-name">
              <span class="name-text" title={player.name}>{player.name}</span>
              <!-- Roles wrap as one unit so "· Host · You" never splits across lines. -->
              <span class="roles">
                {#if isHostRow}<span class="role">Host</span>{/if}
                {#if player.id === playerState.id}<span class="role">You</span>{/if}
                {#if player.isBot}<span class="role">Bot</span>{/if}
                {#if !player.connected}<span class="role">Reconnecting</span>{/if}
              </span>
            </span>
            <!-- Readiness only means something once a game is chosen, and the
                 host's START is their ready, so their row carries no chip. -->
            {#if selectedGame && !isHostRow}
              <span class="status" class:is-ready={player.isReady}>
                {player.isReady ? 'Ready' : 'Not ready'}
              </span>
            {/if}
            {#if isHost && player.isBot}
              <button type="button" class="icon-btn" onclick={() => removeBot(player.id)} aria-label="Remove {player.name}" title="Remove {player.name}">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            {/if}
          </li>
        {/each}
        {#each openSeatNumbers as seat (seat)}
          <li class="player open-seat">
            <span class="avatar seat-open" aria-hidden="true">{seat}</span>
            <span class="player-name"><span class="name-text">Open seat</span></span>
            {#if isHost && gameSupportsAI}
              <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason} aria-label="Add bot to seat {seat}">Add bot</button>
            {/if}
          </li>
        {/each}
      </ul>

      {#if selectedGame && openSeats === 0}
        {#if seatsLeft > 0 || (isHost && gameSupportsAI)}
          <div class="seat-line">
            <p>{seatsLeft > 0 ? `Room for ${seatsLeft} more` : `All ${seatCount} seats are taken`}</p>
            {#if isHost && gameSupportsAI}
              <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason} aria-describedby={botBlockReason ? 'bot-block' : undefined}>Add bot</button>
            {/if}
          </div>
        {/if}
      {:else if !selectedGame && ballot && isHost}
        <div class="seat-line">
          <p>Short on players? Bots can fill seats.</p>
          <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason} aria-describedby={botBlockReason ? 'bot-block' : undefined}>Add bot</button>
        </div>
      {/if}
      {#if isHost && botsAllowed && botBlockReason && (seatsLeft > 0 || !selectedGame)}
        <p class="seat-reason" id="bot-block">{botBlockReason}</p>
      {/if}
      {#if botError}
        <p class="action-error" role="alert">{botError}</p>
      {/if}
    </section>

    <!-- Actions -->
    <section class="actions" aria-label="Lobby actions">
      {#if lobbyState.gameStarting}
        <p class="starting" role="status">Game starting…</p>
      {/if}

      {#if spectator}
        <p class="hint">Watching as spectator</p>
      {:else if selectedGame && isHost}
        {#if !canStart}<p class="hint" aria-live="polite">{startHint}</p>{/if}
        <button type="button" class="btn btn-primary" onclick={startGame} disabled={!canStart}>Start Game</button>
      {:else if selectedGame}
        {#if guestHint}<p class="hint" aria-live="polite">{guestHint}</p>{/if}
        {#if me?.isReady}
          <button type="button" class="pill pill-wide" disabled={!me} onclick={toggleReady}>Not ready</button>
        {:else}
          <button type="button" class="btn btn-primary" disabled={!me} onclick={toggleReady}>Ready</button>
        {/if}
      {/if}

      {#if ballotError}
        <p class="action-error" role="alert">{ballotError}</p>
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
    playLabel={ballot?.myVote === rulesGameId ? 'Clear vote' : 'Vote'}
    onplay={ballot && me && rulesGame && (seatCount <= rulesGame.maxPlayers || ballot.myVote === rulesGameId)
      ? () => { if (rulesGameId) voteFor(rulesGameId); rulesGameId = null; }
      : undefined}
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
    padding: 16px 20px 22px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .lid-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .wordmark {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-cream);
    text-decoration: none;
    transition: color 0.2s ease;
    /* 44px hit area without a heavier lid: the text stays the same size. */
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  @media (hover: hover) {
    .wordmark:hover {
      color: var(--color-mustard-tint);
    }
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
    padding: 8px 10px 10px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
  }

  .picker-row.voted {
    background: var(--color-mustard-tint);
  }

  .picker-details,
  .vote-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .picker-details > div {
    flex: 1;
    min-width: 0;
  }

  .vote-actions {
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .vote-actions .pill {
    height: 44px;
    font-size: 0.875rem;
  }

  /* Pressed (voted) and Confirm are solid ink. Pill hover below is wrapped in
     :where() so it can never outrank these, and it only exists on devices
     that really hover, so a tap on a phone doesn't leave a sticky fill. */
  .vote-actions .pill[aria-pressed='true'],
  .vote-actions .confirm-game:not(:disabled) {
    background: var(--color-espresso);
    color: var(--color-cream);
  }

  @media (hover: hover) {
    .vote-actions .pill[aria-pressed='true']:hover,
    .vote-actions .confirm-game:not(:disabled):hover {
      background: #2E2727;
    }
  }

  .picker-name {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.0625rem;
  }

  .picker-meta,
  .ballot-summary {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  .ballot-summary {
    margin-bottom: 10px;
  }

  .vote-count {
    font-weight: 700;
    font-size: 0.875rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
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

  .player.bot,
  .player.open-seat {
    border-style: dashed;
    background: var(--color-linen);
    padding-right: 4px;
  }

  .player.open-seat {
    padding-right: 6px;
  }

  .open-seat .player-name {
    color: var(--color-ink-muted);
  }

  /* An empty chair: a dashed ring with the seat number. */
  .avatar.seat-open {
    border: 2px dashed var(--color-espresso);
    box-sizing: border-box;
    color: var(--color-ink-muted);
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
  }

  /* One quiet line under the list: room left, and the host's Add bot. */
  .seat-line {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-left: 8px;
  }

  .seat-line p,
  .seat-reason {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-ink-muted);
    text-wrap: pretty;
  }

  .seat-reason {
    margin-top: 6px;
    padding-left: 8px;
  }

  .players .action-error {
    margin-top: 8px;
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
  }

  /* Long names (up to 20 characters) end in an ellipsis rather than clip or
     wrap mid-word; the full name is in the title and the accessible text. */
  .name-text {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  @media (hover: hover) {
    .btn-primary:hover:not(:disabled) {
      background: #2E2727;
    }
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

  @media (hover: hover) {
    .btn-accent:hover {
      background: var(--color-terracotta-press);
      border-color: var(--color-terracotta-press);
    }
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

  @media (hover: hover) {
    .pill:where(:hover:not(:disabled)) {
      background: rgba(59, 47, 47, 0.06);
    }
  }

  .pill-wide {
    width: 100%;
  }

  /* Add bot inside a seat row or the seat line: a 44px target, row-sized type. */
  .pill-row {
    flex-shrink: 0;
    height: 44px;
    padding: 0 16px;
    font-size: 0.875rem;
  }

  .pill-on-dark {
    min-height: 44px;
    height: auto;
    padding: 0 14px;
    border-color: var(--color-cream);
    color: var(--color-cream);
    font-size: 0.8125rem;
  }

  @media (hover: hover) {
    .pill-on-dark:where(:hover:not(:disabled)) {
      background: rgba(253, 246, 236, 0.14);
    }
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
