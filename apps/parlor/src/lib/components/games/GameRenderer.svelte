<script lang="ts">
  import type { GameStateEnvelope } from '@parlor/game-types';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import QuixxGame from '@parlor/quixx/game-view';
  import CrazyEightsGame from '@parlor/crazy-eights/game-view';
  import BootyDiceGame from '@parlor/booty-dice/game-view';
  import LiarsDiceGame from '@parlor/liars-dice/game-view';
  import KingsCornerGame from '@parlor/kings-corner/game-view';

  interface Props {
    /** The latest `game:state` envelope. The component is chosen by the game that sent the view. */
    state: GameStateEnvelope;
    socket: GameSocket;
    playerId: string;
    onBackToLobby: () => void;
  }

  let { state, socket, playerId, onBackToLobby }: Props = $props();
</script>

<!-- Each game gets its typed view by narrowing the envelope on `gameId` (plan 3.1b). -->
{#if state.gameId === 'crazy-eights'}
  <CrazyEightsGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'quixx'}
  <QuixxGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'booty-dice'}
  <BootyDiceGame view={state.view} {socket} {playerId} {onBackToLobby} />
{:else if state.gameId === 'liars-dice'}
  <LiarsDiceGame view={state.view} {socket} {playerId} {onBackToLobby} />
{:else if state.gameId === 'kings-corner'}
  <KingsCornerGame view={state.view} {socket} {playerId} {onBackToLobby} />
{:else}
  <div style="text-align: center; padding: 4rem 1rem; color: #a8a29e;">
    <p>Unknown game type</p>
    <button onclick={onBackToLobby} style="padding: 0.7rem 1.5rem; background: var(--color-terracotta); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
      Back to Lobby
    </button>
  </div>
{/if}
