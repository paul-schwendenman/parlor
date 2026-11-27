<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, PlayingCard, SeatChip, TurnBanner, SUIT_NAMES } from '@parlor/ui';
  import type { HeartsAction, HeartsView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: HeartsView;
    socket: GameSocket<'hearts'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  let selected = $state<Card[]>([]);
  let pending = $state(false);
  let error = $state('');
  let activeName = $derived(view.players.find((player) => player.id === view.activePlayerId)?.name);
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId)?.name);
  let moonShooter = $derived(view.players.find((player) => player.id === view.moonShooterId)?.name);
  let winners = $derived(view.players.filter((player) => view.winnerIds.includes(player.id)));
  let playing = $derived(!!playerId && view.activePlayerId === playerId);

  let passing = $derived(view.phase === 'passing');
  let scoring = $derived(view.phase === 'round-scoring');
  let lead = $derived(view.trick[0]?.card.suit);
  let standings = $derived(view.players.map((player, seat) => ({
    id: player.id,
    name: player.name,
    detail: `${player.totalScore} pts`,
    seat,
    place: 1 + view.players.filter((other) => other.totalScore < player.totalScore).length,
    winner: view.winnerIds.includes(player.id),
    you: player.id === playerId,
  })).sort((a, b) => a.place - b.place));

  function isPlayable(card: Card): boolean {
    return view.canPass
      ? selected.length < 3 || includes(selected, card)
      : includes(view.playableCards, card);
  }

  function includes(cards: Card[], card: Card): boolean {
    return cards.some((other) => cardEquals(other, card));
  }

  async function send(action: HeartsAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) error = result.message;
      else if (action.type === 'pass-cards') selected = [];
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function choose(card: Card) {
    if (!view.canPass) {
      void send({ type: 'play-card', card });
      return;
    }
    if (includes(selected, card)) selected = selected.filter((other) => !cardEquals(other, card));
    else if (selected.length < 3) selected = [...selected, card];
  }
</script>

<CardBoard label="Hearts game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={winners.length === 1 ? standings[0].you ? 'You win!' : `${winners[0].name} wins!` : 'Shared win!'}
      detail={moonShooter ? `${moonShooter} shot the moon!` : undefined}
      {standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    {#if passing}
      <TurnBanner mine={view.canPass}
        title={view.canPass ? `Pass three cards ${view.passDirection}` : 'Passing cards'}
        detail={view.canPass ? `${selected.length} of 3 selected` : 'Waiting for everyone to finish choosing.'} />
    {:else if scoring}
      <TurnBanner mine={false} title={`Round ${view.round} complete`}
        detail={moonShooter ? `${moonShooter} shot the moon!` : undefined} />
    {:else}
      <TurnBanner mine={playing}
        title={trickWinner ? `${trickWinner} took the trick` : playing ? 'Your turn' : `${activeName} to play`}
        detail={playing && lead ? `Follow ${SUIT_NAMES[lead].toLowerCase()} if you can.` : undefined} />
    {/if}

    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        {@const progress = passing ? player.passed ? 'Ready' : 'Choosing' : `+${player.roundScore} this round`}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId}
          active={player.id === view.activePlayerId} stat={`${player.totalScore} pts · ${progress}`} /></li>
      {/each}
    </ul>

    {#if passing}
      <Felt label="Hearts pass table">
        <div class="pass-slots" aria-label="Cards selected to pass" role="group">
          {#each [0, 1, 2] as index (index)}
            {#if selected[index]}
              <PlayingCard rank={selected[index].rank} suit={selected[index].suit} />
            {:else}
              <div class="card-slot" aria-hidden="true"></div>
            {/if}
          {/each}
        </div>
      </Felt>
    {:else if !scoring}
      <Felt label="Hearts table">
        <div class="table">
          <div class="trick-heading">
            <span>Trick {view.trickNumber} of 13</span>
            <span>Hearts {view.heartsBroken ? 'broken' : 'unbroken'}</span>
          </div>
          <ul class="trick" aria-label="Cards played">
            {#each view.players as player (player.id)}
              {@const play = view.trick.find((entry) => entry.playerId === player.id)}
              <li>
                {#if play}
                  <div class:winning={player.id === view.trickWinnerId}>
                    <PlayingCard rank={play.card.rank} suit={play.card.suit} />
                  </div>
                {:else}
                  <div class="card-slot" aria-hidden="true"></div>
                {/if}
                <small title={player.name}>{player.id === playerId ? 'You' : player.name}</small>
              </li>
            {/each}
          </ul>
        </div>
      </Felt>
    {/if}

    {#if view.myHand.length}
      <CardHand cards={view.myHand} active={(view.canPass || playing) && !pending}
        {isPlayable} selected={view.canPass ? selected : null}
        isMarked={(card) => view.trickNumber === 1 && includes(view.receivedCards, card)}
        onpick={choose} />
      {#if view.canPass}
        <div class="pass">
          <Button shout disabled={selected.length !== 3 || pending}
            onclick={() => { void send({ type: 'pass-cards', cards: $state.snapshot(selected) }); }}>Confirm pass</Button>
        </div>
      {:else if view.trickNumber === 1 && view.receivedCards.length}
        <p class="note">Outlined cards were passed to you</p>
      {/if}
    {/if}
    <p class="note">Round {view.round} · Low score wins at {view.goal}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .trick { list-style: none; margin: 0; padding: 0; }
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .seats li { max-width: 100%; }
  .table { width: 100%; min-width: 0; --card-w: clamp(45px, 13vw, 80px); }
  .trick-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: .85rem; }
  .trick { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
  .trick li { display: grid; justify-items: center; gap: 6px; min-width: 0; }
  .trick small { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-slot { box-sizing: border-box; width: var(--card-w); height: calc(var(--card-w) * 1.42); border: 1px dashed currentColor; border-radius: 8px; opacity: .55; }
  .winning { outline: 2px solid var(--color-mustard); outline-offset: 2px; border-radius: 8px; }
  .pass-slots { display: flex; justify-content: center; gap: 8px; }
  .pass { display: flex; justify-content: center; }
  .note, .error { text-align: center; margin: 0; }
  .note { font-size: .85rem; color: var(--color-ink-muted); }
  .error { color: var(--color-terracotta-deep); }
</style>
