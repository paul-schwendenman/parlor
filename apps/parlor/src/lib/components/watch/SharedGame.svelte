<script lang="ts">
  import type { GameStateEnvelope } from '@parlor/game-types';
  import FarkleScreen from '@parlor/farkle/shared-screen';
  import WordSplitScreen from './WordSplitScreen.svelte';

  import LiarsDiceScreen from './LiarsDiceScreen.svelte';

  import QuixxScreen from './QuixxScreen.svelte';

  import BootyDiceScreen from './BootyDiceScreen.svelte';

  import KingsCornerScreen from './KingsCornerScreen.svelte';

  import CrazyEightsScreen from './CrazyEightsScreen.svelte';

  let { state }: { state: GameStateEnvelope } = $props();
</script>

{#if state.gameId === 'farkle'}
  <FarkleScreen view={state.view} />
{:else if state.gameId === 'word-split'}
  <WordSplitScreen view={state.view} />
{:else if state.gameId === 'liars-dice'}
  <LiarsDiceScreen view={state.view} />
{:else if state.gameId === 'quixx'}
  <QuixxScreen view={state.view} />
{:else if state.gameId === 'booty-dice'}
  <BootyDiceScreen view={state.view} />
{:else if state.gameId === 'kings-corner'}
  <KingsCornerScreen view={state.view} />
{:else if state.gameId === 'crazy-eights'}
  <CrazyEightsScreen view={state.view} />
{/if}
