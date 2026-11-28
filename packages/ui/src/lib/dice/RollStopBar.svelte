<script lang="ts">
  import Button from '../Button.svelte';

  let { rollLabel = 'Roll', stopLabel, canRoll = true, canStop = true, onroll, onstop }: {
    rollLabel?: string;
    stopLabel: string;
    canRoll?: boolean;
    canStop?: boolean;
    onroll: () => void;
    onstop: () => void;
  } = $props();
</script>

<div class="actions">
  <Button shout disabled={!canRoll} onclick={onroll}>{rollLabel}</Button>
  <Button variant="secondary" disabled={!canStop} onclick={onstop}>{stopLabel}</Button>
</div>

<style>
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
</style>
