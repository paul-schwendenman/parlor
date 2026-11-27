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
  import { getSocket, ballotAction, readyAction, roomExistsAction, startGameAction } from '$lib/stores/socketClient.js';
  import { catalog as games, findGame, minutesRange, playerCount, playerRange, playersNeeded, type CatalogGame } from '$lib/games/catalog.js';
  import { MAX_BOTS, type LobbyPlayer } from '@parlor/game-types';
  import { seatTone, initial } from '@parlor/ui';
  import LeaveRoomButton from '$lib/components/LeaveRoomButton.svelte';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';

  // While voting there is no game to size the room by, so Add bot stops at the
  // largest table any game in the catalogue can seat.
  const votingSeatCap = Math.max(...games.map(game => game.maxPlayers));

  let roomCode = $derived($page.params.roomCode ?? '');
  /** Why this page can't show the room: it's gone, or we couldn't check. */
  let roomMissing = $state<'gone' | 'unchecked' | null>(null);
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
      roomMissing = null;
      return;
    }
    if (connectionState.status !== 'connected') return;
    // Wait for the reconnect handshake: a returning player is recognised there.
    if (connectionState.reconnectPending) return;
    // No seat here (a pasted link, or a seat that expired). If the room is
    // live, send them to the join form with the code filled in; only a room
    // that is really gone gets the not-found page.
    const code = roomCode;
    let cancelled = false;
    void roomExistsAction(code).then((exists) => {
      if (cancelled || playerState.roomCode === code) return;
      if (exists) {
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve('/') plus a query string
        goto(`${resolve('/')}?join=${encodeURIComponent(code)}`, { replaceState: true }).catch(console.error);
      } else {
        roomMissing = exists === false ? 'gone' : 'unchecked';
      }
    });
    return () => {
      cancelled = true;
    };
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
  let codeChars = $derived(roomCode.split(''));

  // Ballot. Every game is ranked by votes, playable or not, so the summary
  // never hides a leader; what stands in its way is said alongside it.
  let votes = $derived(ballot?.votes ?? {});
  /**
   * After "Change game" the confirmed game stays the room's game: it leads
   * until a vote puts another game ahead, and wins ties it is part of (after
   * the host's own vote). Keeping it restores the room exactly.
   */
  let currentGame = $derived(findGame(ballot?.currentGameId));
  let anyVotes = $derived(games.some(game => (ballot?.totals[game.id] ?? 0) > 0));
  let leaders = $derived.by(() => {
    const high = Math.max(0, ...games.map(game => ballot?.totals[game.id] ?? 0));
    if (!high) return currentGame ? [currentGame] : [];
    return games.filter(game => (ballot?.totals[game.id] ?? 0) === high);
  });
  /** Games the room fits (or could, with more players or a bot), in shelf order. */
  let shelfGames = $derived(games.filter(game => seatCount <= game.maxPlayers));
  /** Games with too many people in the room: muted, at the bottom. */
  let crowdedGames = $derived(games.filter(game => seatCount > game.maxPlayers));

  function canPlay(game: CatalogGame): boolean {
    return seatCount <= game.maxPlayers && (!hasBots || !!game.supportsBots);
  }

  /** What stands between the room and this game, as a short note ('' if nothing). */
  function fitNote(game: CatalogGame): string {
    if (seatCount > game.maxPlayers) return `Seats ${seatsPhrase(game.minPlayers, game.maxPlayers)}`;
    if (seatCount < game.minPlayers) return playersNeeded(game.minPlayers - seatCount);
    if (hasBots && !game.supportsBots) return 'No bots';
    return '';
  }

  let leadSummary = $derived.by(() => {
    if (leaders.length > 1) return `Tied · ${leaders.map(game => game.name).join(', ')}`;
    const lead = leaders[0];
    if (!lead) return '';
    if (!anyVotes) return `Leading · ${lead.name} (current game)`;
    const note = seatCount > lead.maxPlayers ? 'too many players' : fitNote(lead).toLowerCase();
    return `Leading · ${lead.name}${note ? ` (${note})` : ''}`;
  });

  /** "Margaret", "Margaret and Joe", "Margaret, Joe and Ann". */
  function nameList(list: { name: string }[]): string {
    const names = list.map(p => p.name);
    return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  }

  function votersFor(gameId: string): LobbyPlayer[] {
    return lobbyState.players.filter(p => votes[p.id] === gameId);
  }

  /** "Hearts: current game, 2 votes, Margaret and Joe. Needs 1 more player." */
  function rowLabel(game: CatalogGame, voters: LobbyPlayer[]): string {
    const count = voters.length === 0 ? 'no votes' : `${voters.length} ${voters.length === 1 ? 'vote' : 'votes'}, ${nameList(voters)}`;
    const note = fitNote(game);
    return `${game.name}: ${game === currentGame ? 'current game, ' : ''}${count}.${note ? ` ${note}.` : ''}`;
  }

  function seatOf(player: LobbyPlayer): string {
    return player.isBot ? 'ink' : seatTone(lobbyState.players.indexOf(player));
  }

  // The host's one Play button follows the leader. A tie goes to the host's
  // own vote if it is one of the tied games, then the current game, else the
  // first one the room can play.
  let playTarget = $derived(leaders.find(game => game.id === ballot?.myVote)
    ?? leaders.find(game => game === currentGame)
    ?? leaders.find(canPlay) ?? leaders[0]);
  /**
   * The leader is the game the room already has. Play stays off (Keep, on the
   * current-game panel, is how the host backs out) so there's one Keep, not two.
   */
  let playKeeps = $derived(!!playTarget && playTarget === currentGame);
  let playHint = $derived.by(() => {
    const game = playTarget;
    if (!game) return 'Vote to pick a game.';
    if (playKeeps) return `${game.name} stays unless another game takes the lead.`;
    if (seatCount > game.maxPlayers) {
      return `${game.name} seats ${seatsPhrase(game.minPlayers, game.maxPlayers)}. ${hasBots ? 'Remove a bot or vote' : 'Vote'} for another game.`;
    }
    if (hasBots && !game.supportsBots) return `${game.name} doesn't use bots. Remove them or vote for another game.`;
    if (leaders.length > 1) {
      const others = nameList(leaders.filter(g => g !== game));
      return ballot?.myVote === game.id ? `Tied with ${others}. Your vote breaks the tie.` : `Tied with ${others}. Vote to break the tie.`;
    }
    if (seatCount < game.minPlayers) {
      return `${game.name} ${playersNeeded(game.minPlayers - seatCount).toLowerCase()}. Invite someone or add a bot.`;
    }
    return '';
  });
  let ballotIntro = $derived(spectator
    ? `${hostName} picks the game.`
    : isHost ? 'Tap a game to vote, then play the winner.' : `Tap a game to vote. ${hostName} picks the game.`);
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

  async function updateBallot(action: 'open' | 'vote' | 'confirm' | 'keep', gameId: string | null = null) {
    if (ballotPending) return;
    ballotError = '';
    ballotPending = true;
    try {
      await ballotAction(action, gameId, ballot?.roundId);
      await tick();
      if (action === 'confirm' || action === 'keep') gameHeading?.focus();
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

  function playGame(gameId: string) {
    rulesGameId = null;
    void updateBallot(gameId === currentGame?.id ? 'keep' : 'confirm', gameId);
  }

  function keepCurrentGame() {
    void updateBallot('keep');
  }

  /** The reopened ballot's panel line: who is choosing, and what happens to readiness. */
  let currentNote = $derived.by(() => {
    if (!currentGame) return '';
    if (isHost) return 'Choosing again. Anyone ready stays ready if you keep it.';
    if (me?.isReady) return `${hostName} is choosing again. You stay ready if ${currentGame.name} stays.`;
    return `${hostName} is choosing again. ${currentGame.name} stays unless another game is played.`;
  });

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

{#if roomMissing}
  <header class="lid">
    <div class="lid-inner">
      <div class="lid-bar">
        <a href={resolve('/')} class="wordmark">PARLOR</a>
      </div>
    </div>
  </header>
  <div class="content not-found">
    {#if roomMissing === 'gone'}
      <h1 class="not-found-title">This lobby doesn't exist or has ended.</h1>
      <p class="not-found-body">Check the code with whoever invited you, or start a new room.</p>
      <a href={resolve('/')} class="btn btn-accent">Back to home</a>
    {:else}
      <h1 class="not-found-title">Couldn't open lobby {roomCode}.</h1>
      <p class="not-found-body">Check your connection, then try again.</p>
      <button type="button" class="btn btn-accent" onclick={() => location.reload()}>Try again</button>
    {/if}
  </div>
{:else}
  <header class="lid" class:wide={!selectedGame && !!ballot}>
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

  {#snippet addBotLine()}
    {#if isHost && botsAllowed && botBlockReason && (seatsLeft > 0 || !selectedGame)}
      <p class="seat-reason">{botBlockReason}</p>
    {/if}
    {#if botError}
      <p class="action-error" role="alert">{botError}</p>
    {/if}
  {/snippet}

  {#snippet rowFace(game: CatalogGame, voters: LobbyPlayer[], voted: boolean)}
    {@const note = fitNote(game)}
    {@const current = game === currentGame}
    <span class="row-head">
      <span class="row-name">{game.name}</span>
      <span class="row-meta">{playerRange(game)} · {minutesRange(game)}m</span>
    </span>
    <span class="row-desc">{game.description}</span>
    {#if note || voters.length || voted || current}
      <span class="row-foot">
        {#if current}<span class="row-current">Current</span>{/if}
        {#if note}<span class="row-note">{note}</span>{/if}
        <span class="row-votes">
          {#if voted}
            <span class="your-vote">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              Your vote
            </span>
          {/if}
          {#if voters.length}
            <span class="voters" aria-hidden="true">
              {#each voters as voter (voter.id)}
                <span class="voter seat-{seatOf(voter)}" title={voter.name}>{initial(voter.name)}</span>
              {/each}
            </span>
          {/if}
        </span>
      </span>
    {/if}
  {/snippet}

  {#snippet ballotRow(game: CatalogGame, crowded: boolean)}
    {@const voters = votersFor(game.id)}
    {@const voted = ballot?.myVote === game.id}
    <li class="spine-row {crowded ? 'crowded' : `spine-${game.shelf}`}" class:voted>
      {#if me && !spectator && (!crowded || voted)}
        <button type="button" class="spine-face" aria-pressed={voted} aria-label="Vote for {game.name}"
          aria-describedby="votes-{game.id}" aria-disabled={ballotPending || undefined} onclick={() => voteFor(game.id)}>
          {@render rowFace(game, voters, voted)}
        </button>
      {:else}
        <div class="spine-face">{@render rowFace(game, voters, voted)}</div>
      {/if}
      <span class="sr-only" id="votes-{game.id}">{rowLabel(game, voters)}</span>
      <button type="button" class="icon-btn row-help" onclick={() => (rulesGameId = game.id)} aria-label="How to play {game.name}" title="How to play {game.name}">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/></svg>
      </button>
    </li>
  {/snippet}

  <div class="content" class:voting={!selectedGame && !!ballot} class:reopened={!selectedGame && !!currentGame}>
    {#if selectedGame}
      <section class="game-panel" aria-label="Selected game">
        <div class="game-panel-text">
          <h2 class="game-panel-name" tabindex="-1" bind:this={gameHeading}>{selectedGame.name}</h2>
          <span class="game-panel-meta">{playerCount(selectedGame)} · {minutesRange(selectedGame)} min</span>
        </div>
        {#if isHost}
          <button type="button" class="pill pill-on-dark" onclick={() => updateBallot('open')} disabled={ballotPending}>Change game</button>
        {/if}
      </section>
    {:else if ballot}
      {#if currentGame}
        <!-- "Change game" reopened the ballot: the game stays on, where the
             host tapped Change, with Keep to back out. -->
        <section class="game-panel current-panel" aria-label="Current game">
          <div class="game-panel-text">
            <h2 class="game-panel-name">{currentGame.name}</h2>
            <span class="game-panel-meta">{currentNote}</span>
          </div>
          {#if isHost}
            <button type="button" class="pill pill-on-dark" onclick={keepCurrentGame} aria-disabled={ballotPending || undefined}>Keep {currentGame.name}</button>
          {/if}
        </section>
      {/if}
      <!-- Phone: who's here, at a glance, above the ballot. Desktop shows the
           full list in the side column instead. -->
      <section class="table-strip" aria-label="Players">
        <div class="strip-bar">
          <ul class="strip-avatars">
            {#each lobbyState.players as player (player.id)}
              <li class="avatar strip-avatar seat-{seatOf(player)}" title={player.name}>
                {#if player.isBot}
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
                {:else}
                  <span aria-hidden="true">{initial(player.name)}</span>
                {/if}
                <span class="sr-only">{player.name}{player.id === lobbyState.hostId ? ', host' : ''}{player.id === playerState.id ? ', you' : ''}{player.isBot ? ', bot' : ''}</span>
              </li>
            {/each}
          </ul>
          <p class="strip-count">{seatCount} {seatCount === 1 ? 'player' : 'players'}</p>
          {#if isHost}
            <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason}>Add bot</button>
          {/if}
        </div>
        {@render addBotLine()}
      </section>

      <section class="picker" aria-labelledby="ballot-title">
        <h2 id="ballot-title" class="section-title" tabindex="-1" bind:this={ballotHeading}>Vote on a game</h2>
        <p class="ballot-intro">{ballotIntro}</p>
        <p class="ballot-summary" aria-live="polite" aria-atomic="true">{leadSummary}</p>
        <ul class="picker-list">
          {#each shelfGames as game (game.id)}
            {@render ballotRow(game, false)}
          {/each}
        </ul>
        {#if crowdedGames.length}
          <details class="crowded-group">
            <summary>
              <svg class="chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              Not for {seatCount} players ({crowdedGames.length})
            </summary>
            <ul class="picker-list">
              {#each crowdedGames as game (game.id)}
                {@render ballotRow(game, true)}
              {/each}
            </ul>
          </details>
        {/if}
        {#if isHost}
          <!-- The one shouted action while voting: play the leader. Any other
               game the room fits can be played from its "?" rules sheet. -->
          <div class="play-bar">
            {#if playHint}<p class="hint" aria-live="polite">{playHint}</p>{/if}
            <button type="button" class="btn btn-primary" disabled={!playTarget || playKeeps || !canPlay(playTarget)}
              aria-disabled={ballotPending || undefined}
              onclick={() => playTarget && playGame(playTarget.id)}>{playTarget && !playKeeps ? `Play ${playTarget.name}` : 'Play'}</button>
          </div>
        {/if}
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
        {#each lobbyState.players as player (player.id)}
          {@const isHostRow = player.id === lobbyState.hostId}
          <li class="player" class:bot={player.isBot}>
            {#if player.isBot}
              <span class="avatar seat-ink" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
              </span>
            {:else}
              <span class="avatar seat-{seatOf(player)}" aria-hidden="true">{initial(player.name)}</span>
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
              <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason}>Add bot</button>
            {/if}
          </div>
        {/if}
      {:else if !selectedGame && ballot && isHost}
        <div class="seat-line voting-bots">
          <p>Short on players? Bots can fill seats.</p>
          <button type="button" class="pill pill-row" onclick={addBot} disabled={!!botBlockReason}>Add bot</button>
        </div>
      {/if}
      <div class:voting-bots={!selectedGame}>{@render addBotLine()}</div>
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
    secondaryLabel={ballot?.myVote === rulesGameId ? 'Clear vote' : 'Vote'}
    onsecondary={isHost && ballot && rulesGame && (canPlay(rulesGame) || ballot.myVote === rulesGameId)
      ? () => { if (rulesGameId) voteFor(rulesGameId); rulesGameId = null; }
      : undefined}
    playLabel={isHost ? 'Play this' : ballot?.myVote === rulesGameId ? 'Clear vote' : 'Vote'}
    onplay={!ballot || !me || !rulesGame
      ? undefined
      : isHost
        ? canPlay(rulesGame) ? () => { if (rulesGameId) playGame(rulesGameId); } : undefined
        : seatCount <= rulesGame.maxPlayers || ballot.myVote === rulesGameId
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

  /* Ballot: each game is its shelf spine. Tap the box to vote for it. */
  .ballot-intro,
  .ballot-summary {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-ink-muted);
    text-wrap: pretty;
  }

  .ballot-summary {
    margin: 2px 0 12px;
    font-weight: 700;
    color: var(--color-espresso);
  }

  .picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .spine-row {
    position: relative;
    border-radius: 16px;
    color: var(--spine-fg);
  }

  .spine-face {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 8px 12px 10px 14px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 16px;
    background: var(--spine-bg);
    color: inherit;
    font: inherit;
    text-align: left;
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease;
  }

  button.spine-face {
    cursor: pointer;
  }

  button.spine-face:active {
    transform: scale(0.99);
  }

  @media (hover: hover) {
    button.spine-face:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12);
    }
  }

  /* Your pick comes off the shelf: a heavier ink edge and the check chip. */
  .spine-row.voted .spine-face {
    box-shadow: 0 0 0 2px var(--color-espresso);
  }

  @media (hover: hover) {
    .spine-row.voted button.spine-face:hover {
      box-shadow: 0 0 0 2px var(--color-espresso), 0 4px 16px rgba(59, 47, 47, 0.12);
    }
  }

  .row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    /* Room for the "?" button in the corner. */
    padding-right: 36px;
  }

  .row-name {
    min-width: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.3125rem;
    line-height: 1.1;
    letter-spacing: -0.015em;
  }

  .row-meta {
    flex-shrink: 0;
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1.5px solid currentColor;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .row-desc {
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.4;
    text-wrap: pretty;
    /* Two lines at most; the full rules are one tap away on "?". */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .row-foot {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    min-height: 28px;
    margin-top: 4px;
  }

  .row-note {
    font-size: 0.8125rem;
    font-weight: 800;
  }

  /* The game the room already has, on a reopened ballot: a plain outline tag
     in the spine's own text colour, so it never competes with "Your vote". */
  .row-current {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1.5px solid currentColor;
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .row-votes {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .your-vote {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 10px 0 7px;
    border-radius: 999px;
    border: 1.5px solid var(--color-espresso);
    background: var(--color-cream);
    color: var(--color-espresso);
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .voters {
    display: inline-flex;
    padding-left: 6px;
  }

  /* Voters are their seat-coloured avatars; a cream ring keeps a clay voter
     visible on the clay spine (and ink on ink). */
  .voter {
    width: 26px;
    height: 26px;
    margin-left: -6px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--color-cream);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 0.75rem;
    color: var(--color-cream);
    animation: vote-land 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes vote-land {
    from { transform: scale(0.3); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .voter { animation: none; }
    .spine-face { transition: none; }
  }

  .spine-row .row-help {
    position: absolute;
    top: 3px;
    right: 3px;
    color: var(--spine-fg);
  }

  @media (hover: hover) {
    .spine-row .row-help:hover {
      background: color-mix(in srgb, var(--spine-fg) 14%, transparent);
    }
  }

  .spine-row:not(.spine-mustard):not(.spine-linen):not(.crowded) .row-help:focus-visible {
    outline-color: var(--color-cream);
  }

  /* Too many people for these: muted, folded away at the bottom. */
  .crowded-group {
    margin-top: 14px;
  }

  .crowded-group summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 8px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-ink-muted);
    cursor: pointer;
    list-style: none;
  }

  .crowded-group summary::-webkit-details-marker {
    display: none;
  }

  .chevron {
    transition: transform 0.2s ease;
  }

  .crowded-group[open] .chevron {
    transform: rotate(90deg);
  }

  .crowded-group .picker-list {
    margin-top: 4px;
  }

  .spine-row.crowded {
    --spine-fg: var(--color-espresso);
  }

  /* One line each: name, why not, and any votes left on it. */
  .crowded .spine-face {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    column-gap: 10px;
    min-height: 52px;
    background: var(--color-linen);
    border-style: dashed;
    border-width: 2px;
    padding: 6px 48px 6px 14px;
  }

  .crowded .row-head {
    padding-right: 0;
  }

  .crowded .row-name {
    font-size: 1.0625rem;
  }

  .crowded .row-meta,
  .crowded .row-desc {
    display: none;
  }

  .crowded .row-foot {
    flex: 1;
    margin-top: 0;
  }

  .crowded .row-note {
    color: var(--color-ink-muted);
    font-weight: 700;
  }

  .crowded .row-help {
    top: 4px;
  }

  /* The host's one Play button rides the bottom of the screen while voting. */
  .play-bar {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin: 16px -20px 0;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    background: var(--color-cream);
    box-shadow: 0 -6px 16px rgba(59, 47, 47, 0.1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .play-bar .btn {
    width: 100%;
  }

  /* Phone: a strip of who's here above the ballot. */
  .strip-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    box-sizing: border-box;
    padding: 6px 6px 6px 12px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
  }

  .strip-avatars {
    list-style: none;
    margin: 0;
    padding: 0 0 0 8px;
    display: flex;
    flex-wrap: wrap;
    row-gap: 4px;
    min-width: 0;
  }

  .avatar.strip-avatar {
    width: 32px;
    height: 32px;
    margin-left: -8px;
    box-sizing: border-box;
    border: 2px solid var(--color-paper);
    font-size: 0.9375rem;
  }

  .strip-count {
    margin: 0 auto 0 0;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1rem;
    white-space: nowrap;
    color: var(--color-espresso);
  }

  .table-strip .seat-reason {
    margin-top: 6px;
  }

  .table-strip .action-error {
    margin-top: 6px;
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
    flex-shrink: 0;
    white-space: nowrap;
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

  /* While voting: phone keeps the strip on top and the full list (with
     remove-bot) below the ballot, so Add bot lives only in the strip. */
  @media (max-width: 899px) {
    .content.voting .voting-bots {
      display: none;
    }
  }

  /* Desktop: the ballot and a side column with the full player list. */
  @media (min-width: 900px) {
    .content.voting {
      max-width: 920px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      grid-template-areas: 'ballot players' 'actions players';
      align-items: start;
      column-gap: 32px;
      row-gap: 20px;
    }

    .content.voting .table-strip {
      display: none;
    }

    /* The lid lines up with the wider page; the code keeps its phone size. */
    .lid.wide .lid-inner {
      max-width: 920px;
    }

    .lid.wide .code-tiles {
      max-width: 440px;
    }

    /* Wide enough to cover a voted row's heavier edge as it scrolls under. */
    .content.voting .play-bar {
      margin: 16px -6px 0;
      padding: 12px 6px 16px;
    }

    .content.voting .picker {
      grid-area: ballot;
    }

    /* A reopened ballot keeps the current game on top of the ballot column. */
    .content.voting.reopened {
      grid-template-areas: 'current players' 'ballot players' 'actions players';
    }

    .content.voting .current-panel {
      grid-area: current;
    }

    .content.voting .players {
      grid-area: players;
      position: sticky;
      top: 20px;
    }

    .content.voting .actions {
      grid-area: actions;
      margin-top: 0;
    }

    .content.voting .actions:empty {
      display: none;
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
