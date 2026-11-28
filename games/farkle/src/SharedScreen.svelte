<script lang="ts">
  import { Felt, PipDie } from '@parlor/ui';
  import { TARGET_SCORE, scoringSelections } from './rules.js';
  import type { FarkleView } from './types.js';

  let { view }: { view: FarkleView } = $props();
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let next = $derived(view.players.find(({ id }) => id === view.nextPlayerId));
  let scores = $derived([...view.players].sort((a, b) => Number(a.out) - Number(b.out) || b.score - a.score));
  let over = $derived(view.phase === 'game-over');
  let winners = $derived(scores.filter(({ out, score }) => !out && score === scores[0].score));
  let scoringDice = $derived(new Set(scoringSelections(view.dice).flatMap(({ indices }) => indices)));

  let headline = $derived(
    over ? winners.length > 1 ? 'Shared win!' : winners.length ? `${winners[0].name} wins!` : 'Game over'
      : view.phase === 'bust' ? 'Farkle!'
      : view.phase === 'banked' ? `${active?.name} banks`
      : `${active?.name}’s turn`,
  );
  let instruction = $derived(
    over ? winners.map(({ name }) => name).join(' · ')
      : view.phase === 'bust' ? `${active?.name} loses their turn points.`
      : view.phase === 'banked' ? 'Points added to the standings.'
      : view.phase === 'selecting' ? 'Choosing dice to keep'
      : view.kept.length && view.diceToRoll === 6 ? 'Hot dice! All six can roll again.'
      : view.canBank ? 'Roll again or bank' : `Ready to roll ${view.diceToRoll} dice`,
  );
</script>

<div class="table">
  <Felt label="Farkle dice table">
    <div class="stage" class:bust={view.phase === 'bust'}>
      <div class="turn" role="status">
        <h2>{headline}</h2>
        <p>{instruction}</p>
      </div>
      {#if !over}
        {#key view.rollNumber}
          <div class="dice" class:rolled={view.dice.length > 0}>
            {#each view.dice as die, index (index)}
              <PipDie value={die} dimmed={view.phase === 'selecting' && !scoringDice.has(index)} />
            {:else}
              {#each Array(view.diceToRoll) as _, index (index)}
                <span class="die-slot" aria-hidden="true"></span>
              {/each}
            {/each}
          </div>
        {/key}
        <div class="turn-total">
          <strong>{view.turnScore.toLocaleString()}</strong>
          <span>{view.phase === 'bust' ? 'points lost' : view.phase === 'banked' ? 'points banked' : 'unbanked points'}</span>
        </div>
        {#if view.kept.length}
          <div class="kept" aria-label="Kept this turn">
            <span>Kept</span>
            {#each view.kept as group, index (index)}
              <span class="kept-group">
                {#each group.dice as die, dieIndex (dieIndex)}<PipDie value={die} />{/each}
                <strong>+{group.points.toLocaleString()}</strong>
              </span>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </Felt>

  <section class="scoreboard" aria-labelledby="farkle-standings">
    <div class="score-heading">
      <h2 id="farkle-standings">Standings</h2>
      <span>{view.finalRound ? 'Final turns' : `Play to ${TARGET_SCORE.toLocaleString()}`}</span>
    </div>
    <ol>
      {#each scores as player (player.id)}
        {@const playing = !over && player.id === view.activePlayerId}
        <li class:playing class:out={player.out}>
          <div class="seat">
            <strong>{player.name}</strong>
            {#if player.out}<small>Left</small>
            {:else if playing}<small>Current turn{player.bot ? ' · Bot' : !player.connected ? ' · Stand-in' : ''}</small>
            {:else if player.bot}<small>Bot</small>
            {:else if !player.connected}<small>Away</small>{/if}
          </div>
          <span>{player.score.toLocaleString()}</span>
        </li>
      {/each}
    </ol>
    {#if !over && next}<p class="next">Up next <strong>{next.name}</strong></p>{/if}
  </section>
</div>

<style>
  .table { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(17rem, 1fr); gap: clamp(16px, 2vw, 32px); align-items: stretch; }
  .stage { display: grid; justify-items: center; align-content: center; gap: clamp(14px, 2.2vw, 34px); width: 100%; min-height: min(53vh, 540px); text-align: center; }
  h2, p { margin: 0; }
  .turn h2 { font: 900 clamp(2.2rem, 4vw, 5rem)/1 var(--font-heading); overflow-wrap: anywhere; }
  .turn p { font-size: clamp(1rem, 1.65vw, 1.5rem); margin-top: .5em; }
  .dice { --die-size: clamp(39px, 6vw, 104px); display: flex; justify-content: center; flex-wrap: wrap; gap: clamp(5px, 0.85vw, 14px); }
  .die-slot { box-sizing: border-box; width: var(--die-size); aspect-ratio: 1; border: 2px dashed currentColor; border-radius: 24%; opacity: .4; }
  .rolled { animation: arrive .28s ease-out both; }
  @keyframes arrive { from { opacity: .25; transform: translateY(-8px) scale(.96); } }
  .turn-total { display: grid; gap: 2px; }
  .turn-total strong { font: 900 clamp(3rem, 6vw, 7rem)/.9 var(--font-heading); font-variant-numeric: tabular-nums; }
  .turn-total span { font-size: clamp(1rem, 1.5vw, 1.5rem); }
  .bust .turn h2, .bust .turn-total strong { color: var(--color-mustard-tint); }
  .kept { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; max-height: 8rem; overflow: auto; padding: 10px; border: 2px solid var(--color-espresso); border-radius: 12px; background: var(--color-linen); color: var(--color-espresso); }
  .kept-group { --die-size: clamp(19px, 2vw, 30px); display: inline-flex; align-items: center; gap: 3px; margin-inline: 4px; }
  .scoreboard { display: flex; flex-direction: column; gap: 14px; padding: clamp(14px, 1.7vw, 28px); border: 2.5px solid var(--color-espresso); border-radius: 18px; background: var(--color-linen); }
  .score-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; }
  .score-heading h2 { font: 900 clamp(1.5rem, 2vw, 2.35rem)/1 var(--font-heading); }
  .score-heading span { font-weight: 700; }
  ol { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 10px; border: 2px solid var(--color-espresso); border-radius: 11px; background: var(--color-cream); font-size: clamp(1rem, 1.6vw, 1.65rem); }
  li.playing { background: var(--color-mustard-tint); }
  li.out { color: var(--color-ink-muted); border-style: dashed; }
  li > span { font-weight: 900; font-variant-numeric: tabular-nums; }
  .seat { display: grid; overflow-wrap: anywhere; min-width: 0; }
  .seat small { font-size: .65em; font-weight: 700; }
  .next { margin-top: auto; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; font-size: clamp(1rem, 1.35vw, 1.4rem); }
  @media (max-width: 760px) { .table { grid-template-columns: minmax(0, 1fr); } .stage { min-height: 280px; } }
  @media (prefers-reduced-motion: reduce) { .rolled { animation: none; } }
</style>
