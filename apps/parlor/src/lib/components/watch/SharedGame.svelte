<script lang="ts">
  import type { GameStateEnvelope } from '@parlor/game-types';
  import FarkleScreen from '@parlor/farkle/shared-screen';
  import WordSplitScreen from './WordSplitScreen.svelte';

  import LiarsDiceScreen from './LiarsDiceScreen.svelte';

  import QuixxScreen from './QuixxScreen.svelte';

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
{/if}
