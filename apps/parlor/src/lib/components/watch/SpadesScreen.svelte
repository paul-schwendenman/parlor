<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import SharedTrickScreen from './SharedTrickScreen.svelte';

  let { view }: { view: GameView<'spades'> } = $props();
  let names = $derived(new Map(view.players.map(({ id, name }) => [id, name])));
  let playing = $derived(view.phase === 'playing' || view.phase === 'trick-won');
  let teamName = (team: number) => view.players.filter((player) => player.team === team).map(({ name }) => name).join(' & ');
  let title = $derived(view.phase === 'game-over' && view.winningTeam !== null ? `${teamName(view.winningTeam)} win!`
    : view.phase === 'round-scoring' ? 'Round scores'
    : view.trickWinnerId ? `${names.get(view.trickWinnerId)} takes the trick`
    : view.phase === 'bidding' ? `${names.get(view.activePlayerId ?? '')} to bid`
    : `${names.get(view.activePlayerId ?? '')} to play`);
  let rows = $derived(view.teams.map((team) => ({
    id: String(team.team), name: teamName(team.team), value: team.score,
    detail: `${team.tricks} tricks · ${team.bid ?? '—'} bid · ${team.bags} bags`,
    active: view.players.some((player) => player.team === team.team && player.id === view.activePlayerId),
  })));
</script>

<SharedTrickScreen {title} detail={playing ? view.spadesBroken ? 'Spades are broken' : 'Spades are still unbroken' : undefined}
  round={view.round} trickNumber={playing ? view.trickNumber : undefined} trump="spades"
  players={view.players} plays={view.trick} winnerId={view.trickWinnerId} {rows} scoreTitle="Team scores" />
