<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { GameOver, Button } from '@parlor/ui';
  import type { PlayerScore, RowColor, Scoresheet } from '../../types/game.js';
  import ScoresheetViewer from './ScoresheetViewer.svelte';

  interface PlayerData {
    id: string;
    name: string;
    isBot: boolean;
    sheet: Scoresheet;
    penalties: number;
    lockedRows: RowColor[];
  }

  let {
    socket,
    scores,
    players,
    myPlayerId,
  }: {
    socket: GameSocket<'quixx'>;
    /** Best first. */
    scores: PlayerScore[];
    players: PlayerData[];
    myPlayerId: string;
  } = $props();

  let viewerOpen = $state(false);

  let best = $derived(scores[0]?.total ?? 0);
  let leaders = $derived(scores.filter((s) => s.total === best));

  let headline = $derived(
    leaders.length > 1
      ? "It's a tie"
      : leaders[0]?.playerId === myPlayerId
        ? 'You win!'
        : `${leaders[0]?.name ?? 'Nobody'} wins!`,
  );

  let standings = $derived(
    scores.map((s) => {
      const seat = players.findIndex((p) => p.id === s.playerId);
      return {
        id: s.playerId,
        name: s.name,
        seat: Math.max(seat, 0),
        place: scores.findIndex((o) => o.total === s.total) + 1,
        detail: `${s.total} ${Math.abs(s.total) === 1 ? 'point' : 'points'}`,
        winner: s.total === best,
        you: s.playerId === myPlayerId,
        bot: players[seat]?.isBot ?? false,
      };
    }),
  );

  const playAgain = () => socket.emit('lobby:restartGame');
  const backToLobby = () => socket.emit('lobby:resetGame');
</script>

<GameOver
  {headline}
  detail={leaders.length > 1 ? `${leaders.map((l) => l.name).join(' and ')} share the top score.` : 'Highest score after the game closes.'}
  {standings}
  onplayagain={myPlayerId ? playAgain : undefined}
  onlobby={myPlayerId ? backToLobby : undefined}
>
  {#snippet more()}
    <div class="sheets">
      <Button variant="secondary" onclick={() => (viewerOpen = true)}>See everyone's scoresheets</Button>
    </div>
  {/snippet}
</GameOver>

<ScoresheetViewer
  {players}
  {scores}
  {myPlayerId}
  initialPlayerId={myPlayerId || scores[0]?.playerId || ''}
  bind:open={viewerOpen}
/>

<style>
  .sheets {
    display: flex;
    justify-content: center;
  }

  .sheets :global(.btn) {
    width: 100%;
  }
</style>
