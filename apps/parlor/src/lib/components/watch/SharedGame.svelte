<script lang="ts">
  import type { GameStateEnvelope } from '@parlor/game-types';
  import FarkleScreen from '@parlor/farkle/shared-screen';
  import WordSplitScreen from './WordSplitScreen.svelte';

  let { state }: { state: GameStateEnvelope } = $props();
</script>

{#if state.gameId === 'farkle'}
  <FarkleScreen view={state.view} />
{:else if state.gameId === 'word-split'}
  <WordSplitScreen view={state.view} />
{/if}
