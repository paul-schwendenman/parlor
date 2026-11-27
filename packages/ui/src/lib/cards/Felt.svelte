<script lang="ts">
  /**
   * The playing surface: a block with an ink outline and a recessed well,
   * sitting on the cream page. Felt for cards and Quixx dice; `night` (an
   * espresso table) for the pirate games. Everything on it is cream.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    tone?: 'felt' | 'night';
    children: Snippet;
  }

  let { label = 'Table', tone = 'felt', children }: Props = $props();
</script>

<section class="felt" class:night={tone === 'night'} aria-label={label}>
  {@render children()}
</section>

<style>
  .felt {
    box-sizing: border-box;
    padding: 24px 16px 18px;
    border: 2.5px solid var(--color-espresso, #3B2F2F);
    border-radius: 18px;
    background: var(--color-forest-deep, #2F5A3E);
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.25);
    color: var(--color-cream, #FDF6EC);
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .felt.night {
    background: var(--color-espresso, #3B2F2F);
    box-shadow: inset 0 2px 12px rgba(0, 0, 0, 0.45);
  }
</style>
