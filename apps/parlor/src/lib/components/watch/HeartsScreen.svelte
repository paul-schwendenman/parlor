<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import SharedTrickScreen from './SharedTrickScreen.svelte';

  let { view }: { view: GameView<'hearts'> } = $props();
  let name = $derived(new Map(view.players.map(({ id, name }) => [id, name])));
  let playing = $derived(view.phase === 'playing' || view.phase === 'trick-won');
  let title = $derived(view.phase === 'game-over'
    ? view.winnerIds.length === 1 ? `${name.get(view.winnerIds[0])} wins!` : 'Shared win!'
    : view.phase === 'passing' ? 'Passing cards'
    : view.phase === 'round-scoring' ? 'Round scores'
    : view.trickWinnerId ? `${name.get(view.trickWinnerId)} takes the trick`
    : `${name.get(view.activePlayerId ?? '')} to play`);
  let detail = $derived(view.phase === 'passing' ? `Pass three cards ${view.passDirection}`
    : view.moonShooterId ? `${name.get(view.moonShooterId)} shot the moon`
    : playing ? view.heartsBroken ? 'Hearts are broken' : 'Hearts are still unbroken' : undefined);
  let rows = $derived([...view.players].sort((a, b) => a.totalScore - b.totalScore).map((player) => ({
    ...player, value: player.totalScore, active: player.id === view.activePlayerId,
    detail: view.phase === 'passing' ? player.passed ? 'Ready' : 'Choosing' : `${player.roundScore} this round`,
  })));
</script>

<SharedTrickScreen {title} {detail} round={view.round} trickNumber={playing ? view.trickNumber : undefined}
  players={view.players} plays={view.trick} winnerId={view.trickWinnerId} {rows} />
