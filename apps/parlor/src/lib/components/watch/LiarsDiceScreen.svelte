<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import { PipDie } from '@parlor/ui';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'liars-dice'> } = $props();
  let names = $derived(new Map(view.players.map(({ id, name }) => [id, name])));
  let active = $derived(view.players[view.activePlayerIndex]);
  let challenge = $derived(view.challengeResult);
  let spotOn = $derived(view.spotOnResult);
  let title = $derived(view.gameOver ? `${names.get(view.winner ?? '') ?? 'Nobody'} wins!`
    : challenge ? `${names.get(challenge.challengerId)} called liar`
    : spotOn ? `${names.get(spotOn.callerId)} called spot-on`
    : `${active?.name}’s turn`);
  let detail = $derived(challenge ? `${names.get(challenge.loserId)} loses a die`
    : spotOn ? spotOn.wasExact ? 'The count was exact' : 'The count was off'
    : `Round ${view.round} · ${view.totalDiceInPlay} dice in play`);
</script>

<SharedBoard {title} {detail}>
  {#if view.currentBid}
    <div class="bid" aria-label="Current bid">
      <strong>{view.currentBid.quantity} ×</strong>
      <PipDie value={view.currentBid.faceValue} />
      <span>{names.get(view.currentBid.playerId)}’s bid</span>
    </div>
  {:else if !view.gameOver}
    <p>Waiting for the opening bid.</p>
  {/if}
  {#if view.revealedDice}
    <div class="reveal" aria-label="Revealed dice">
      <h3>{view.actualCount ?? challenge?.actualCount ?? spotOn?.actualCount ?? 0} matching dice</h3>
      {#each view.players as player (player.id)}
        {@const dice = view.revealedDice[player.id]}
        {#if dice?.length}
          <div class="dice"><strong>{player.name}</strong>{#each dice as value, index (index)}<PipDie {value} />{/each}</div>
        {/if}
      {/each}
    </div>
  {/if}
  {#snippet sidebar()}
    <SharedScores title="Dice remaining" rows={view.players.map((player) => ({ ...player, value: player.diceCount, active: !view.gameOver && view.phase === 'bidding' && player.id === active?.id, detail: player.eliminated ? 'Out' : player.isBot ? 'Bot' : !player.connected ? 'Away' : undefined }))} />
    {#if view.bidHistory.length}
      <h3>Recent bids</h3>
      <ol>
        {#each view.bidHistory.slice(-4).reverse() as bid, index (index)}
          <li>{names.get(bid.playerId)} <strong>{bid.quantity} × {bid.faceValue}</strong></li>
        {/each}
      </ol>
    {/if}
  {/snippet}
</SharedBoard>

<style>
  .bid, .dice { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
  .bid { --die-size: clamp(55px, 8vw, 115px); }
  .bid strong { font: 900 clamp(2rem, 5vw, 6rem)/1 var(--font-heading); }
  .bid span { flex-basis: 100%; font-size: 1.25rem; }
  .reveal { display: grid; gap: 8px; width: min(100%, 44rem); }
  .dice { --die-size: clamp(25px, 4vw, 52px); }
  .dice strong { margin-right: 6px; overflow-wrap: anywhere; }
  .reveal h3 { margin: 0 0 6px; font-size: 1.5rem; }
  ol { padding: 0; margin: 0; list-style: none; }
  li { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; }
</style>
