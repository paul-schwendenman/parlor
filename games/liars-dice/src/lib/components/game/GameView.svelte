<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { TurnBanner, SeatChip, GameOver, Button, Felt, PipDie } from '@parlor/ui';
  import type { LiarsDicePlayerView } from '../../types/game.js';
  import { isValidBid } from '../../game/bidding.js';

  let {
    view,
    socket,
    playerId,
  }: {
    view: LiarsDicePlayerView;
    socket: GameSocket<'liars-dice'>;
    playerId: string;
  } = $props();

  const PLURAL = ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const SINGULAR = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
  const faceWord = (face: number, n: number) => (n === 1 ? SINGULAR[face] : PLURAL[face]);

  let quantity = $state(1);
  let face = $state(2);

  // Start the controls on the lowest legal bid each time it changes. An
  // opening bid starts on one of your most common face instead of "one 1".
  $effect(() => {
    if (!view.minimumBid) return;
    if (!view.currentBid && view.myDice.length > 0) {
      const tally = [2, 3, 4, 5, 6].map((f) => ({ f, n: view.myDice.filter((d) => d === f).length }));
      face = tally.reduce((best, t) => (t.n > best.n ? t : best)).f;
      quantity = 1;
      return;
    }
    quantity = view.minimumBid.quantity;
    face = view.minimumBid.faceValue;
  });

  let active = $derived(view.players[view.activePlayerIndex] ?? null);
  let nameOf = (id: string | undefined) => view.players.find((p) => p.id === id)?.name ?? 'Someone';
  let revealing = $derived(view.phase === 'challenge' || view.phase === 'spot-on');
  let bidding = $derived(view.isMyTurn && view.phase === 'bidding');
  let bidOk = $derived(isValidBid({ quantity, faceValue: face }, view.currentBid));
  let maxQuantity = $derived(view.totalDiceInPlay);

  // During a reveal, dice that count toward the bid: the face, plus wild 1s.
  const counts = (die: number) =>
    !!view.currentBid && (die === view.currentBid.faceValue || (die === 1 && view.currentBid.faceValue !== 1));

  let outcome = $derived.by(() => {
    if (view.challengeResult) {
      const r = view.challengeResult;
      return r.bidWasCorrect
        ? `The bid stood. ${nameOf(r.loserId)} loses a die.`
        : `The bid was a lie. ${nameOf(r.loserId)} loses a die.`;
    }
    if (view.spotOnResult) {
      const r = view.spotOnResult;
      return r.wasExact ? 'Exactly right. Everyone else loses a die.' : `Not exact. ${nameOf(r.callerId)} loses a die.`;
    }
    return '';
  });

  let banner = $derived.by(() => {
    if (view.phase === 'challenge') return { mine: false, title: `${nameOf(view.challengeResult?.challengerId)} called Liar!`, detail: outcome };
    if (view.phase === 'spot-on') return { mine: false, title: `${nameOf(view.spotOnResult?.callerId)} called Spot on!`, detail: outcome };
    if (bidding) {
      return {
        mine: true,
        title: 'Your bid',
        detail: view.currentBid ? 'Raise the bid, or call the last bidder a liar.' : 'Open the bidding: how many of one face are on the whole table?',
      };
    }
    return { mine: false, title: `${active?.name ?? 'Someone'} is bidding`, detail: undefined };
  });

  let standings = $derived(
    view.players
      .map((p, seat) => ({ p, seat }))
      .sort((a, b) => (b.p.id === view.winner ? 1 : 0) - (a.p.id === view.winner ? 1 : 0) || b.p.diceCount - a.p.diceCount)
      .map(({ p, seat }) => ({
        id: p.id,
        name: p.name,
        seat,
        detail: p.eliminated ? 'Out' : `${p.diceCount} ${p.diceCount === 1 ? 'die' : 'dice'} left`,
        winner: p.id === view.winner,
        you: p.id === playerId,
        bot: p.isBot,
      })),
  );

  let winnerName = $derived(nameOf(view.winner ?? undefined));

  const bid = () => socket.emit('game:action', { type: 'bid', quantity, faceValue: face });
  const liar = () => socket.emit('game:action', { type: 'challenge' });
  const spotOn = () => socket.emit('game:action', { type: 'spot-on' });
  const nextRound = () => socket.emit('game:action', { type: 'nextRound' });
  const playAgain = () => socket.emit('lobby:restartGame');
  const backToLobby = () => socket.emit('lobby:resetGame');
</script>

<div class="board">
  {#if view.gameOver}
    <GameOver
      headline={view.winner === playerId ? 'You win!' : `${winnerName} wins!`}
      detail="Last player with dice in the cup."
      {standings}
      onplayagain={playerId ? playAgain : undefined}
      onlobby={playerId ? backToLobby : undefined}
    />
  {:else}
    <TurnBanner mine={banner.mine} title={banner.title} detail={banner.detail} />

    <ul class="seats" aria-label="Players">
      {#each view.players as p, seat (p.id)}
        <li>
          <SeatChip
            name={p.name}
            {seat}
            stat={p.eliminated ? undefined : `${p.diceCount} ${p.diceCount === 1 ? 'die' : 'dice'}`}
            active={!revealing && seat === view.activePlayerIndex}
            connected={p.connected}
            you={seat === view.myIndex}
            bot={p.isBot}
            out={p.eliminated}
          />
        </li>
      {/each}
    </ul>

    <Felt tone="night" label="Table">
      <div class="table">
        {#if revealing && view.revealedDice}
          <ul class="reveal" aria-label="Everyone's dice">
            {#each view.players.filter((p) => !p.eliminated) as p (p.id)}
              <li class="cup">
                <span class="cup-name">{p.name}</span>
                <span class="cup-dice">
                  {#each view.revealedDice[p.id] ?? [] as die, i (i)}
                    <PipDie value={die} picked={counts(die)} dimmed={!counts(die)} />
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
          {#if view.currentBid && view.actualCount !== null}
            <p class="count">
              {view.actualCount} {faceWord(view.currentBid.faceValue, view.actualCount)}
              {#if view.currentBid.faceValue !== 1}<span class="wild">counting wild ones</span>{/if}
              <span class="against">against a bid of {view.currentBid.quantity}</span>
            </p>
          {/if}
        {:else if view.currentBid}
          <p class="bid" aria-label="Current bid: {view.currentBid.quantity} {faceWord(view.currentBid.faceValue, view.currentBid.quantity)}, by {nameOf(view.currentBid.playerId)}">
            <span class="bid-line" aria-hidden="true">
              <span class="bid-qty">{view.currentBid.quantity}</span>
              <span class="times">×</span>
              <PipDie value={view.currentBid.faceValue} />
            </span>
            <span class="bid-by" aria-hidden="true">{nameOf(view.currentBid.playerId)}'s bid</span>
          </p>
        {:else}
          <p class="bid-empty">No bids yet this round</p>
        {/if}
      </div>
    </Felt>

    {#if revealing}
      <div class="actions">
        <Button shout onclick={nextRound}>Next round</Button>
      </div>
    {/if}

    {#if !revealing && view.myDice.length > 0}
      <section class="cup-mine" aria-labelledby="mine-title">
        <h2 id="mine-title" class="h">Your dice</h2>
        <div class="my-dice">
          {#each view.myDice as die, i (i)}
            <PipDie value={die} />
          {/each}
        </div>
      </section>
    {/if}

    {#if bidding}
      <section class="bidder" aria-label="Your bid">
        <div class="stepper" role="group" aria-label="How many">
          <button type="button" class="step" onclick={() => (quantity = Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="One fewer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
          </button>
          <output class="qty" aria-live="polite">{quantity}</output>
          <button type="button" class="step" onclick={() => (quantity = Math.min(maxQuantity, quantity + 1))} disabled={quantity >= maxQuantity} aria-label="One more">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" /></svg>
          </button>
        </div>

        <div class="faces" role="group" aria-label="Which face">
          {#each [1, 2, 3, 4, 5, 6] as f (f)}
            <PipDie value={f} picked={face === f} label={PLURAL[f]} onclick={() => (face = f)} />
          {/each}
        </div>

        {#if !bidOk}
          <p class="hint">Too low. Raise the count, or pick a higher face.</p>
        {/if}
        <div class="actions">
          <Button shout disabled={!bidOk} onclick={bid}>Bid {quantity} × {faceWord(face, quantity)}</Button>
          {#if view.canChallenge}
            <div class="calls" class:single={!view.canSpotOn}>
              <Button variant="danger" onclick={liar}>Liar!</Button>
              {#if view.canSpotOn}<Button variant="secondary" onclick={spotOn}>Spot on</Button>{/if}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if view.bidHistory.length > 0 && !revealing}
      <section class="history" aria-labelledby="history-title">
        <h2 id="history-title" class="h">Bids this round</h2>
        <ol class="history-list" reversed>
          {#each view.bidHistory.toReversed() as b, i (i)}
            <li>
              <span class="who">{nameOf(b.playerId)}</span>
              <span class="what">{b.quantity} × {faceWord(b.faceValue, b.quantity)}</span>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  {/if}
</div>

<style>
  /* Liar's Dice is the espresso box: an espresso night table, and your own
     dice printed espresso with cream pips. Revealed dice are paper, with the
     ones that count picked out in butter. */
  .board {
    --die-size: 40px;
    max-width: 560px;
    margin: 0 auto;
    padding: 4px 16px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--color-espresso);
    font-family: var(--font-body);
  }

  @media (min-width: 600px) {
    .board {
      --die-size: 46px;
      gap: 18px;
    }
  }

  .seats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .seats li {
    max-width: 100%;
  }

  .table {
    width: 100%;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  .bid {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .bid-line {
    display: flex;
    align-items: center;
    gap: 12px;
    --die-size: 56px;
  }

  .bid-qty {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 3.5rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .times {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.75rem;
  }

  .bid-by,
  .bid-empty {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .reveal {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    --die-size: 34px;
  }

  .cup {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
  }

  .cup-name {
    font-family: var(--font-heading);
    font-weight: 800;
  }

  .cup-dice {
    display: flex;
    gap: 5px;
  }

  .count {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    text-align: center;
  }

  .wild,
  .against {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .h {
    margin: 0 0 8px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.125rem;
  }

  .cup-mine {
    text-align: center;
  }

  .my-dice {
    display: flex;
    justify-content: center;
    gap: 8px;
    --die-face: var(--color-espresso);
    --die-pip: var(--color-cream);
    --die-size: 48px;
  }

  .bidder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 18px;
    background: var(--color-paper);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .step {
    width: 48px;
    height: 48px;
    padding: 0;
    border: 2px solid var(--color-espresso);
    border-radius: 50%;
    background: transparent;
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .step:hover:not(:disabled) {
    background: rgba(59, 47, 47, 0.06);
  }

  .step:active:not(:disabled) {
    transform: scale(0.96);
  }

  .step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .step svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }

  .qty {
    min-width: 3ch;
    text-align: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 2.5rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .faces {
    display: flex;
    gap: 8px;
    --die-size: 44px;
  }

  @media (max-width: 400px) {
    .faces {
      gap: 5px;
      --die-size: 42px;
    }
  }

  .hint {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-ink-muted);
    text-align: center;
  }

  .actions {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
    display: grid;
    gap: 10px;
  }

  .calls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .calls.single {
    grid-template-columns: 1fr;
  }

  .history {
    padding: 14px 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 168px;
    overflow-y: auto;
  }

  .history-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1.5px solid var(--color-linen);
    font-size: 0.9375rem;
  }

  .history-list li:first-child {
    font-weight: 700;
  }

  .history-list li:last-child {
    border-bottom: 0;
  }

  .who {
    font-family: var(--font-heading);
    font-weight: 800;
  }

  .what {
    font-variant-numeric: tabular-nums;
  }
</style>
