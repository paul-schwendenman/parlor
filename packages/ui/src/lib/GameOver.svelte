<script lang="ts">
  /**
   * The end-of-game screen every board shares: who won on felt, the final
   * standings as outlined rows, then Play again / Back to lobby.
   */
  import Button from './Button.svelte';
  import { seatTone, initial, type Standing } from './seat.js';

  interface Props {
    /** "You win!" or "Margaret wins!". */
    headline: string;
    /** One sentence on how it ended. */
    detail?: string;
    /** Best first. */
    standings: Standing[];
    onplayagain?: () => void;
    onlobby?: () => void;
  }

  let { headline, detail, standings, onplayagain, onlobby }: Props = $props();

  function ordinal(n: number): string {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
  }
</script>

<section class="game-over" aria-labelledby="game-over-title">
  <div class="result">
    <svg class="trophy" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h2.5a1.5 1.5 0 0 1 1.5 1.5v.5a4 4 0 0 1-4 4M7 6H4.5A1.5 1.5 0 0 0 3 7.5v.5a4 4 0 0 0 4 4" />
    </svg>
    <h2 id="game-over-title" class="headline">{headline}</h2>
    {#if detail}<p class="detail">{detail}</p>{/if}
  </div>

  <ol class="standings">
    {#each standings as s, i (s.id)}
      <li class="row" class:winner={s.winner}>
        <span class="place">{ordinal(i + 1)}</span>
        <span class="avatar tone-{s.bot ? 'ink' : seatTone(s.seat)}" aria-hidden="true">
          {#if s.bot}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
          {:else}
            {initial(s.name)}
          {/if}
        </span>
        <span class="name">
          {s.name}
          {#if s.you}<span class="role">you</span>{:else if s.bot}<span class="role">bot</span>{/if}
        </span>
        <span class="measure">{s.detail}</span>
      </li>
    {/each}
  </ol>

  {#if onplayagain || onlobby}
    <div class="actions">
      {#if onplayagain}<Button shout onclick={onplayagain}>Play again</Button>{/if}
      {#if onlobby}<Button variant="secondary" onclick={onlobby}>Back to lobby</Button>{/if}
    </div>
  {/if}
</section>

<style>
  .game-over {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--color-espresso, #3B2F2F);
  }

  .result {
    padding: 22px 20px 24px;
    border: 2.5px solid var(--color-espresso, #3B2F2F);
    border-radius: 18px;
    background: var(--color-forest-deep, #2F5A3E);
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.25);
    color: var(--color-cream, #FDF6EC);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }

  .trophy {
    color: var(--color-mustard, #D4A843);
  }

  .headline {
    margin: 0;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 2.25rem;
    line-height: 1.05;
    letter-spacing: -0.02em;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .detail {
    margin: 0;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 1rem;
    line-height: 1.45;
  }

  .standings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    min-height: 56px;
    box-sizing: border-box;
    padding: 8px 14px 8px 12px;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: 14px;
    background: var(--color-paper, #FFFFFF);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .row.winner {
    background: var(--color-mustard-tint, #F3E2B6);
    border-width: 2.5px;
  }

  .place {
    width: 2.25rem;
    flex-shrink: 0;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 1.0625rem;
    font-variant-numeric: tabular-nums;
  }

  .avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 1.0625rem;
    color: var(--color-cream, #FDF6EC);
  }

  .tone-clay { background: var(--color-terracotta-deep, #A9532D); }
  .tone-felt { background: var(--color-forest-deep, #2F5A3E); }
  .tone-mustard { background: var(--color-mustard, #D4A843); color: var(--color-espresso, #3B2F2F); }
  .tone-ink { background: var(--color-espresso, #3B2F2F); }

  .name {
    flex: 1;
    min-width: 0;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 800;
    font-size: 1.0625rem;
    overflow-wrap: anywhere;
  }

  .role {
    margin-left: 6px;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-weight: 600;
    font-size: 0.8125rem;
    color: var(--color-ink-muted, #71625A);
  }

  .measure {
    flex-shrink: 0;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-weight: 700;
    font-size: 0.875rem;
    color: var(--color-ink-muted, #71625A);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
  }

  .actions :global(.btn) {
    width: 100%;
  }
</style>
