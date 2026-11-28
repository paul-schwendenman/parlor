<script lang="ts">
  let { title = 'Standings', rows }: {
    title?: string;
    rows: { id: string; name: string; value: string | number; detail?: string; active?: boolean }[];
  } = $props();
</script>
<h2>{title}</h2>
<ul>
  {#each rows as row (row.id)}
    <li class:active={row.active}>
      <div><strong>{row.name}</strong>{#if row.detail}<small>{row.detail}</small>{/if}</div>
      <span>{row.value}</span>
    </li>
  {/each}
</ul>
<style>
  h2 { margin: 0 0 14px; font: 900 clamp(1.45rem, 2vw, 2.25rem)/1 var(--font-heading); }
  ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 12px; border: 2px solid var(--color-espresso); border-radius: 12px; background: var(--color-cream); font-size: clamp(1rem, 1.5vw, 1.45rem); }
  li.active { background: var(--color-mustard-tint); }
  li div { min-width: 0; overflow-wrap: anywhere; }
  small { display: block; font-size: .72em; }
  span { text-align: right; font-weight: 900; font-variant-numeric: tabular-nums; }
</style>
