<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import QuixxGame from '@parlor/quixx/game-view';
  import CrazyEightsGame from '@parlor/crazy-eights/game-view';
  import BootyDiceGame from '@parlor/booty-dice/game-view';

  interface Props {
    gameId: string | null;
    view: unknown;
    socket: GameSocket;
    playerId: string;
    onBackToLobby: () => void;
  }

  let { gameId, view, socket, playerId, onBackToLobby }: Props = $props();
</script>

{#if gameId === 'quixx'}
  <QuixxGame view={view as any} {socket} {playerId} />
{:else if gameId === 'crazy-eights'}
  <CrazyEightsGame view={view as any} {socket} {playerId} />
{:else if gameId === 'booty-dice'}
  <BootyDiceGame view={view as any} {socket} {playerId} {onBackToLobby} />
{:else}
  <div style="text-align: center; padding: 4rem 1rem; color: #a8a29e;">
    <p>Unknown game type</p>
    <button onclick={onBackToLobby} style="padding: 0.7rem 1.5rem; background: var(--color-terracotta); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
      Back to Lobby
    </button>
  </div>
{/if}
