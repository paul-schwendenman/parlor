<script lang="ts">
  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="drawer-backdrop" onclick={handleBackdropClick} role="presentation">
    <aside class="drawer">
      <header class="drawer-header">
        <h2>Game Rules</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close rules">&times;</button>
      </header>

      <div class="drawer-content">
        <section>
          <h3>Objective</h3>
          <p>Be the <strong>last player with dice remaining</strong>.</p>
        </section>

        <section>
          <h3>Setup</h3>
          <ul>
            <li>2-6 players</li>
            <li>Each player starts with 5 dice</li>
            <li>All players roll simultaneously — only you can see your dice</li>
          </ul>
        </section>

        <section>
          <h3>Bidding</h3>
          <p>On your turn, bid on how many of a face value exist across <strong>all players' dice combined</strong>.</p>
          <p>Each bid must be higher than the last:</p>
          <ul>
            <li>Raise the quantity (e.g. "three 4s" → "four 4s")</li>
            <li>Raise the face value at the same quantity (e.g. "three 4s" → "three 5s")</li>
          </ul>
        </section>

        <section>
          <h3>Wild Ones</h3>
          <p><strong>1s count as any face value</strong>. If someone bids "four 3s", every die showing 1 or 3 counts.</p>
          <ul>
            <li>Bidding on 1s: quantity is halved (rounded up)</li>
            <li>Going from 1s to another number: quantity is doubled + 1</li>
          </ul>
        </section>

        <section>
          <h3>Challenge ("Liar!")</h3>
          <p>Instead of bidding, call the previous bidder a liar:</p>
          <ul>
            <li>All dice are revealed</li>
            <li>If the bid was correct: <strong>you</strong> lose a die</li>
            <li>If the bid was wrong: the <strong>bidder</strong> loses a die</li>
          </ul>
        </section>

        <section>
          <h3>Spot On</h3>
          <p>Call "Spot On" if you think the count exactly matches the bid:</p>
          <ul>
            <li>If exact: <strong>everyone else</strong> loses a die</li>
            <li>If not exact: <strong>you</strong> lose a die</li>
          </ul>
        </section>

        <section>
          <h3>Elimination</h3>
          <p>Lose all your dice and you're out. The loser of a challenge starts the next round.</p>
        </section>
      </div>
    </aside>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 360px;
    max-width: 90vw;
    background: #1e1e1e;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
    overflow-y: auto;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: #2a2a2a;
    border-bottom: 1px solid #333;
    position: sticky;
    top: 0;
  }

  .drawer-header h2 { margin: 0; font-size: 1.25rem; color: #d4a574; }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.75rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover { color: #eee; }

  .drawer-content { padding: 1.25rem; }

  section { margin-bottom: 1.5rem; }
  section:last-child { margin-bottom: 0; }

  h3 {
    font-size: 1rem;
    color: #d4a574;
    margin: 0 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  p { margin: 0 0 0.5rem; color: #ccc; line-height: 1.5; }
  ul { margin: 0; padding-left: 1.25rem; color: #ccc; }
  li { margin-bottom: 0.25rem; line-height: 1.4; }
  strong { color: #eee; }
</style>
