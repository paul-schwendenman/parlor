<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<section class="board" aria-label={label}>
  {@render children()}
</section>

<style>
  .board {
    --card-w: 64px;
    box-sizing: border-box;
    max-width: 560px;
    margin: 0 auto;
    padding: 4px 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--color-espresso);
    font-family: var(--font-body);
  }

  @media (min-width: 600px) {
    .board { --card-w: 80px; gap: 20px; }
  }
</style>
