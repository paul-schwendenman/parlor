<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import LeaveRoomButton from '$lib/components/LeaveRoomButton.svelte';
  import GameRenderer from '$lib/components/games/GameRenderer.svelte';
  import RulesModal from '$lib/components/lobby/RulesModal.svelte';

  const GAME_NAMES: Record<string, string> = {
    quixx: 'Quixx',
    'crazy-eights': 'Crazy Eights',
    'kings-corner': 'Kings Corner',
    'booty-dice': 'Booty Dice',
    'liars-dice': "Liar's Dice",
  };

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) getSocket();
  });

  $effect(() => {
    if (playerState.roomCode === roomCode) {
      roomNotFound = false;
      return;
    }
    if (connectionState.status !== 'connected') return;
    // Wait for the reconnect handshake before declaring the game gone.
    if (connectionState.reconnectPending) return;
    roomNotFound = true;
  });

  let view = $derived(gameState.state);
  let gameName = $derived(view ? (GAME_NAMES[view.gameId] ?? '') : '');
  let rulesOpen = $state(false);
  // Games whose rules the shared RulesModal carries and that have no rules
  // button of their own yet. Booty Dice and Liar's Dice still ship their own
  // drawer; they join this list as they move to the shared board kit.
  const SHELL_RULES = new Set(['quixx', 'crazy-eights']);
  let hadView = false;

  $effect(() => {
    if (view) {
      hadView = true;
    } else if (hadView && playerState.roomCode === roomCode) {
      goto(resolve('/lobby/[roomCode]', { roomCode })).catch(console.error);
    }
  });

  function handleBackToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
    lobbyState.gameStarting = false;
    goto(resolve('/lobby/[roomCode]', { roomCode })).catch(console.error);
  }
</script>

<svelte:head><title>Playing - Parlor</title></svelte:head>

<header class="lid">
  <div class="lid-inner">
    <span class="wordmark">PARLOR</span>
    {#if playerState.roomCode === roomCode}
      <span class="code">
        <span class="sr-only">Room code {roomCode}</span>
        {#each roomCode.split('') as char, i (i)}
          <span class="code-tile" aria-hidden="true">{char}</span>
        {/each}
      </span>
      {#if !playerState.id}<span class="spectating">Watching as spectator</span>{/if}
      <div class="lid-actions">
        {#if view && SHELL_RULES.has(view.gameId)}
          <button type="button" class="rules-btn" onclick={() => (rulesOpen = true)} aria-label="How to play {gameName}" title="How to play">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          </button>
        {/if}
        <LeaveRoomButton />
      </div>
    {/if}
  </div>
</header>

{#if !view}
  <div class="loading">
    {#if roomNotFound}
      <h1 class="state-title">This game doesn't exist or has ended.</h1>
      <p class="state-body">Check the code with whoever invited you, or start a new room.</p>
      <a href={resolve('/')} class="back-link">Back to home</a>
    {:else}
      <p class="state-body" role="status">Loading game…</p>
    {/if}
  </div>
{:else}
  <GameRenderer
    state={view}
    socket={getSocket()}
    playerId={playerState.id}
    onBackToLobby={playerState.id ? handleBackToLobby : undefined}
  />
{/if}

<RulesModal open={rulesOpen} gameId={view?.gameId ?? null} {gameName} onclose={() => (rulesOpen = false)} />

<style>
  /* A slim lid: identity and the room code without taking the board's space. */
  .lid {
    background: var(--color-terracotta);
    border-bottom: 3px solid var(--color-espresso);
    margin-bottom: 12px;
  }

  .lid-inner {
    max-width: 800px;
    margin: 0 auto;
    padding: 10px 16px;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
  }

  .wordmark {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-cream);
  }

  /* The room code as letter tiles, scaled down for the slim lid. */
  .code {
    display: inline-flex;
    gap: 3px;
  }

  .code-tile {
    width: 26px;
    height: 32px;
    box-sizing: border-box;
    border: 2px solid var(--color-espresso);
    border-radius: 7px;
    background: var(--color-mustard);
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  /* Phones: one row for code, rules and Leave. Mid-game the room code is the
     identity that matters, so the wordmark steps aside. */
  @media (max-width: 420px) {
    .wordmark {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    .code {
      gap: 2px;
    }

    .code-tile {
      width: 21px;
      height: 28px;
      border-radius: 6px;
      font-size: 0.9375rem;
    }
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

  .spectating {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--color-cream);
    color: var(--color-espresso);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .lid-actions {
    margin-left: auto;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  /* Rules live in the same place in every game. Cream fill on the lid
     (DESIGN.md: pills on the lid are always cream-filled). */
  .rules-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 2px solid var(--color-espresso);
    border-radius: 50%;
    background: var(--color-cream);
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .rules-btn:hover {
    background: var(--color-paper);
  }

  .rules-btn:active {
    transform: scale(0.96);
  }

  .lid :global(:focus-visible) {
    outline-color: var(--color-cream);
  }

  .loading {
    max-width: 480px;
    margin: 0 auto;
    padding: 32px 20px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .state-title {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.15;
    color: var(--color-espresso);
  }

  .state-body {
    margin: 0 0 8px;
    font-size: 1rem;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    height: 52px;
    padding: 0 28px;
    border-radius: 999px;
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    text-decoration: none;
    transition: background 0.2s ease;
  }

  .back-link:hover {
    background: var(--color-terracotta-press);
  }
</style>
