<script lang="ts">
  import PipDie from './PipDie.svelte';

  let {
    dice, count = 0, rollId, selected = [], eligible, onpick, disabled = false,
  }: {
    dice: readonly number[];
    count?: number;
    rollId?: number;
    selected?: readonly number[];
    eligible?: ReadonlySet<number>;
    onpick?: (index: number) => void;
    disabled?: boolean;
  } = $props();
</script>

{#key rollId}
  <div class="tray" role="group" aria-label={dice.length ? 'Rolled dice' : `${count} dice ready to roll`}>
    {#each dice as die, index (index)}
      {@const unavailable = eligible !== undefined && !eligible.has(index)}
      <PipDie value={die} picked={selected.includes(index)} dimmed={unavailable} rolling={rollId !== undefined}
        disabled={disabled || unavailable} onclick={onpick && (() => onpick(index))} />
    {:else}
      {#each Array.from({ length: count }) as _, index (index)}
        <span class="slot" aria-hidden="true"></span>
      {/each}
    {/each}
  </div>
{/key}

<style>
  .tray { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--dice-gap, 6px); }
  .slot { box-sizing: border-box; width: var(--die-size, 44px); aspect-ratio: 1; border: 2px dashed currentColor; border-radius: 24%; opacity: .4; }
</style>
