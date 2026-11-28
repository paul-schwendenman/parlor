<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import SharedTrickScreen from './SharedTrickScreen.svelte';

  let { view }: { view: GameView<'oh-hell'> } = $props();
  let names = $derived(new Map(view.players.map(({ id, name }) => [id, name])));
  let playing = $derived(view.phase === 'playing' || view.phase === 'trick-won');
  let title = $derived(view.phase === 'game-over'
    ? view.winnerIds.length === 1 ? `${names.get(view.winnerIds[0])} wins!` : 'Shared win!'
    : view.phase === 'round-scoring' ? 'Round scores'
    : view.trickWinnerId ? `${names.get(view.trickWinnerId)} takes the trick`
    : `${names.get(view.activePlayerId ?? '')} to ${view.phase === 'bidding' ? 'bid' : 'play'}`);
  let rows = $derived([...view.players].sort((a, b) => b.score - a.score).map((player) => ({
    ...player, value: player.score, active: player.id === view.activePlayerId,
    detail: `${player.tricks} tricks · ${player.bid ?? '—'} bid${player.roundPoints === null ? '' : ` · +${player.roundPoints} this round`}`,
  })));
</script>

<SharedTrickScreen {title} detail={view.phase === 'bidding' ? `Round ${view.round} of ${view.rounds} · ${view.handSize} cards each` : undefined}
  round={view.round} trickNumber={playing ? view.players.reduce((sum, player) => sum + player.tricks, 0) + (view.phase === 'trick-won' ? 0 : 1) : undefined}
  trump={view.trumpCard.suit} exposedCard={view.phase === 'bidding' ? view.trumpCard : undefined}
  players={view.players} plays={view.trick} winnerId={view.trickWinnerId} {rows} />
