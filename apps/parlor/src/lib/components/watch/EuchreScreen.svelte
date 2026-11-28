<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import SharedTrickScreen from './SharedTrickScreen.svelte';

  let { view }: { view: GameView<'euchre'> } = $props();
  let names = $derived(new Map(view.players.map(({ id, name }) => [id, name])));
  let active = $derived(names.get(view.activePlayerId ?? ''));
  let playing = $derived(view.phase === 'playing' || view.phase === 'trick-won');
  let teamName = (team: number) => view.players.filter((player) => player.team === team).map(({ name }) => name).join(' & ');
  let title = $derived(view.phase === 'game-over' && view.winningTeam !== null ? `${teamName(view.winningTeam)} win!`
    : view.phase === 'round-scoring' ? 'Round scores'
    : view.phase === 'order-up' || view.phase === 'name-trump' ? `${active} to call trump`
    : view.phase === 'discard' ? `${active} to discard`
    : view.trickWinnerId ? `${names.get(view.trickWinnerId)} takes the trick` : `${active} to play`);
  let detail = $derived(view.lonerId ? `${names.get(view.lonerId)} is going alone`
    : view.phase === 'round-scoring' && view.result ? `${teamName(view.result.team)} earn ${view.result.points} points`
    : view.makerId ? `${names.get(view.makerId)} called trump` : undefined);
  let rows = $derived(view.teams.map((score, team) => ({
    id: String(team), name: teamName(team), value: score, detail: `${view.tricks[team]} tricks`,
    active: view.players.some((player) => player.team === team && player.id === view.activePlayerId),
  })));
</script>

<SharedTrickScreen {title} {detail} round={view.round} trickNumber={playing ? view.trickNumber : undefined} trump={view.trump}
  exposedCard={view.phase === 'order-up' ? view.upCard : undefined} players={view.players} plays={view.trick}
  winnerId={view.trickWinnerId} {rows} scoreTitle="Team scores" />
