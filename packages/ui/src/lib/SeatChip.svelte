<script lang="ts">
  /**
   * A player at the table, as a compact pill: seat-coloured avatar, name, and
   * one game-specific stat ("7 cards"). The seat whose turn it is turns felt.
   */
  import { seatTone, initial } from './seat.js';

  interface Props {
    name: string;
    /** Position at the table; picks the avatar colour (same as the lobby). */
    seat: number;
    stat?: string;
    active?: boolean;
    connected?: boolean;
    you?: boolean;
    bot?: boolean;
  }

  let { name, seat, stat, active = false, connected = true, you = false, bot = false }: Props = $props();

  // The robot avatar already says "bot" on screen; the label says it aloud.
  let roles = $derived([you && 'you', !connected && 'away'].filter(Boolean).join(' · '));
  let label = $derived(
    [name, you && 'you', bot && 'bot', !connected && 'away', stat, active && 'playing now'].filter(Boolean).join(', '),
  );
</script>

<div class="seat" class:active class:away={!connected} aria-label={label} role="group">
  <span class="avatar tone-{bot ? 'ink' : seatTone(seat)}" aria-hidden="true">
    {#if bot}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
    {:else}
      {initial(name)}
    {/if}
  </span>
  <span class="name" aria-hidden="true">{name}</span>
  {#if roles}<span class="meta" aria-hidden="true">{roles}</span>{/if}
  {#if stat}<span class="stat" aria-hidden="true">{stat}</span>{/if}
</div>

<style>
  .seat {
    box-sizing: border-box;
    min-height: 44px;
    max-width: 100%;
    padding: 4px 14px 4px 4px;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: 999px;
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.25s ease, color 0.25s ease;
  }

  .seat.active {
    background: var(--color-forest-deep, #2F5A3E);
    color: var(--color-cream, #FDF6EC);
  }

  .seat.away {
    border-style: dashed;
    background: var(--color-linen, #F5EDE0);
  }

  .avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 0.9375rem;
    color: var(--color-cream, #FDF6EC);
  }

  /* On felt, a felt avatar needs an edge to stay visible. */
  .active .avatar {
    box-shadow: 0 0 0 2px var(--color-cream, #FDF6EC);
  }

  .tone-clay { background: var(--color-terracotta-deep, #A9532D); }
  .tone-felt { background: var(--color-forest-deep, #2F5A3E); }
  .tone-mustard { background: var(--color-mustard, #D4A843); color: var(--color-espresso, #3B2F2F); }
  .tone-ink { background: var(--color-espresso, #3B2F2F); }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 800;
    font-size: 1rem;
  }

  .meta,
  .stat {
    flex-shrink: 0;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink-muted, #71625A);
    font-variant-numeric: tabular-nums;
  }

  .stat {
    font-weight: 700;
  }

  .active .meta,
  .active .stat {
    color: var(--color-cream, #FDF6EC);
  }

  /* Phones: two or three seats share one row. */
  @media (max-width: 480px) {
    .seat {
      min-height: 40px;
      padding-right: 12px;
      gap: 6px;
    }

    .avatar {
      width: 28px;
      height: 28px;
      font-size: 0.875rem;
    }

    .name {
      font-size: 0.9375rem;
    }

    .meta,
    .stat {
      font-size: 0.75rem;
    }
  }
</style>
