<script lang="ts">
  /**
   * One partnership's score in a team game (Spades, Euchre): an outlined
   * paper block, mustard-tinted for the viewer's own team. Anything the game
   * adds (a round breakdown) goes underneath.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    name: string;
    score: number;
    /** One line under the name, e.g. "2 bags · 4/5 tricks". */
    detail?: string;
    mine?: boolean;
    children?: Snippet;
  }

  let { name, score, detail, mine = false, children }: Props = $props();
</script>

<section class="team" class:mine aria-label={name}>
  <header>
    <h2>{name}</h2>
    <strong>{score} <small>pts</small></strong>
  </header>
  {#if detail}<p>{detail}</p>{/if}
  {@render children?.()}
</section>

<style>
  .team {
    box-sizing: border-box;
    min-width: 0;
    padding: 10px 12px;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: 14px;
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
  }

  .team.mine {
    background: var(--color-mustard-tint, #F3E2B6);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 2px 12px;
  }

  h2 {
    margin: 0;
    font: 900 1rem/1.1 var(--font-heading, 'Nunito', system-ui, sans-serif);
  }

  strong {
    font: 900 1.375rem/1 var(--font-heading, 'Nunito', system-ui, sans-serif);
  }

  strong small {
    font-size: 0.8125rem;
  }

  p {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    color: var(--color-ink-muted, #71625A);
  }
</style>
