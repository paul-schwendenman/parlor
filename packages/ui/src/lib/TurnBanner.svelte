<script lang="ts">
  /**
   * The turn indicator every board opens with. Felt when it's your move (felt
   * is Parlor's "go" colour), paper while you wait.
   */
  interface Props {
    /** Whether the viewer is the one who has to act. */
    mine: boolean;
    title: string;
    detail?: string;
  }

  let { mine, title, detail }: Props = $props();
</script>

<div class="turn" class:mine role="status" aria-live="polite">
  <p class="title">{title}</p>
  {#if detail}<p class="detail">{detail}</p>{/if}
</div>

<style>
  .turn {
    box-sizing: border-box;
    min-height: 60px;
    padding: 12px 18px;
    border: 2.5px solid var(--color-espresso, #3B2F2F);
    border-radius: 18px;
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    text-align: center;
  }

  .turn.mine {
    background: var(--color-forest-deep, #2F5A3E);
    color: var(--color-cream, #FDF6EC);
  }

  .title {
    margin: 0;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 1.375rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .detail {
    margin: 0;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-weight: 500;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--color-ink-muted, #71625A);
  }

  .mine .detail {
    color: var(--color-cream, #FDF6EC);
  }
</style>
