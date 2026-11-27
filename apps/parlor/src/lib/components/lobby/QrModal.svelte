<script lang="ts">
  import { Button, Modal } from '@parlor/ui';
  import { qrPath } from '$lib/qr.js';

  interface Props {
    open: boolean;
    /** The invite link the code encodes (origin + '?join=' + code). */
    url: string;
    roomCode: string;
    shareLabel?: string;
    onshare?: () => void;
    shareFailed?: boolean;
    onclose: () => void;
  }

  let { open, url, roomCode, shareLabel, onshare, shareFailed, onclose }: Props = $props();

  let qr = $derived(url ? qrPath(url) : null);
</script>

{#if open}
<Modal open={true} {onclose} title={onshare ? 'Invite players' : 'Scan to join'}>
  <div class="qr-sheet">
    {#if qr}
      <svg
        class="qr"
        role="img"
        aria-label="QR code for the invite link to room {roomCode}"
        viewBox="0 0 {qr.size} {qr.size}"
        shape-rendering="crispEdges"
      >
        <rect class="qr-paper" width={qr.size} height={qr.size} />
        <path d={qr.path} fill="currentColor" />
      </svg>
    {/if}
    <p class="sr-only">Room code {roomCode}</p>
    <div class="code-tiles" aria-hidden="true">
      {#each roomCode.split('') as char, i (i)}
        <span class="tile">{char}</span>
      {/each}
    </div>
    <p class="hint">Scan with a phone camera to join.</p>
  </div>
  {#if shareFailed}<p class="hint" role="status">Couldn't copy the link. Read the code out instead.</p>{/if}
  <div class="footer">
    {#if onshare}
      <Button onclick={onshare}>{shareLabel}</Button>
    {/if}
    <button type="button" class="btn-close" onclick={onclose}>Close</button>
  </div>
</Modal>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .qr-sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  /* Espresso on white paper, with the spec's four-module quiet zone drawn in
     the SVG itself. Big enough to scan across a room from a shared screen. */
  .qr {
    display: block;
    /* The sheet's widest content: 90vw less its padding and border. */
    width: min(360px, calc(90vw - 53px));
    height: auto;
    aspect-ratio: 1;
    box-sizing: border-box;
    border: 2.5px solid var(--color-espresso);
    border-radius: 14px;
    color: var(--color-espresso);
  }

  .qr-paper {
    fill: var(--color-paper);
  }

  .code-tiles {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }

  .tile {
    height: 52px;
    border-radius: 10px;
    border: 2px solid var(--color-espresso);
    background: var(--color-mustard);
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0;
    font-size: 1rem;
    line-height: 1.4;
    color: var(--color-espresso);
    text-align: center;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
  }

  .btn-close {
    height: 46px;
    padding: 0 20px;
    border-radius: 999px;
    font-size: 0.9375rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    background: transparent;
    border: 2px solid var(--color-espresso);
    color: var(--color-espresso);
    transition: background 0.2s ease;
  }

  @media (hover: hover) {
    .btn-close:hover {
      background: rgba(59, 47, 47, 0.06);
    }
  }
</style>
