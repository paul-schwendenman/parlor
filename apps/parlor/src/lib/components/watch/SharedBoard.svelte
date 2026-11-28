<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Felt } from '@parlor/ui';

  let { title, detail, children, sidebar }: {
    title: string;
    detail?: string;
    children: Snippet;
    sidebar: Snippet;
  } = $props();
</script>

<div class="board">
  <Felt label="Public table">
    <div class="stage">
      <div role="status">
        <h2>{title}</h2>
        {#if detail}<p>{detail}</p>{/if}
      </div>
      {@render children()}
    </div>
  </Felt>
  <aside aria-label="Table information">
    {@render sidebar()}
  </aside>
</div>

<style>
  .board { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(16rem, 1fr); gap: clamp(14px, 2vw, 32px); }
  .stage { display: grid; justify-items: center; align-content: center; gap: 24px; width: 100%; min-height: min(53vh, 540px); text-align: center; }
  h2 { margin: 0; font: 900 clamp(2rem, 4vw, 4.5rem)/1.05 var(--font-heading); overflow-wrap: anywhere; }
  p { margin: .5rem 0 0; font-size: clamp(1rem, 1.6vw, 1.45rem); }
  aside { min-width: 0; padding: clamp(14px, 2vw, 28px); border: 2.5px solid var(--color-espresso); border-radius: 18px; background: var(--color-linen); }
  @media (max-width: 760px) { .board { grid-template-columns: minmax(0, 1fr); } .stage { min-height: 240px; } }
</style>
