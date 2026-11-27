<script lang="ts">
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import type { GameStateEnvelope } from '@parlor/game-types';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import QuixxGame from '@parlor/quixx/game-view';
  import CrazyEightsGame from '@parlor/crazy-eights/game-view';
  import BootyDiceGame from '@parlor/booty-dice/game-view';
  import LiarsDiceGame from '@parlor/liars-dice/game-view';
  import SpadesGame from '@parlor/spades/game-view';
  import HeartsGame from '@parlor/hearts/game-view';
  import KingsCornerGame from '@parlor/kings-corner/game-view';

  interface Props {
    /** The latest `game:state` envelope. The component is chosen by the game that sent the view. */
    state: GameStateEnvelope;
    socket: GameSocket;
    playerId: string;
    onBackToLobby?: () => void;
  }

  let { state, socket, playerId, onBackToLobby }: Props = $props();
</script>

<!-- Each game gets its typed view by narrowing the envelope on `gameId` (plan 3.1b). -->
{#if state.gameId === 'crazy-eights'}
  <CrazyEightsGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'quixx'}
  <QuixxGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'booty-dice'}
  <BootyDiceGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'liars-dice'}
  <LiarsDiceGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'spades'}
  <SpadesGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'hearts'}
  <HeartsGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'kings-corner'}
  <KingsCornerGame view={state.view} {socket} {playerId} />
{:else}
  <div class="unknown">
    <p>Unknown game type</p>
    {#if onBackToLobby}<button type="button" onclick={onBackToLobby}>Back to Lobby</button>{/if}
  </div>
{/if}

<style>
  .unknown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 4rem 1rem;
    color: var(--color-ink-muted);
  }

  .unknown p {
    margin: 0;
  }

  .unknown button {
    height: 52px;
    padding: 0 28px;
    border: 0;
    border-radius: 999px;
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    cursor: pointer;
  }

  .unknown button:hover {
    background: var(--color-terracotta-press);
  }
</style>
