<script lang="ts">
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import type { GameStateEnvelope } from '@parlor/game-types';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import QuixxGame from '@parlor/quixx/game-view';
  import CrazyEightsGame from '@parlor/crazy-eights/game-view';
  import BootyDiceGame from '@parlor/booty-dice/game-view';
  import LiarsDiceGame from '@parlor/liars-dice/game-view';
  import EuchreGame from '@parlor/euchre/game-view';
  import OhHellGame from '@parlor/oh-hell/game-view';
  import SpadesGame from '@parlor/spades/game-view';
  import PresidentGame from '@parlor/president/game-view';
  import GinRummyGame from '@parlor/gin-rummy/game-view';
  import GolfGame from '@parlor/golf/game-view';
  import HeartsGame from '@parlor/hearts/game-view';
  import CouncilLedgerGame from '@parlor/council-ledger/game-view';
  import CipherPostGame from '@parlor/cipher-post/game-view';
  import FaultLineGame from '@parlor/fault-line/game-view';
  import SignalRelayGame from '@parlor/signal-relay/game-view';
  import NightMarketGame from '@parlor/night-market/game-view';
  import RidgeRunGame from '@parlor/ridge-run/game-view';
  import HarborDiceGame from '@parlor/harbor-dice/game-view';
  import FarkleGame from '@parlor/farkle/game-view';
  import WordSplitGame from '@parlor/word-split/game-view';
  import KingsCornerGame from '@parlor/kings-corner/game-view';

  interface Props {
    /** The latest `game:state` envelope. The component is chosen by the game that sent the view. */
    state: GameStateEnvelope;
    socket: GameSocket;
    playerId: string;
    onBackToLobby?: () => void;
  }

  let { state, socket, playerId, onBackToLobby }: Props = $props();
</script>

<!-- Each game gets its typed view by narrowing the envelope on `gameId` (plan 3.1b). -->
{#if state.gameId === 'crazy-eights'}
  <CrazyEightsGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'quixx'}
  <QuixxGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'booty-dice'}
  <BootyDiceGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'liars-dice'}
  <LiarsDiceGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'oh-hell'}
  <OhHellGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'euchre'}
  <EuchreGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'spades'}
  <SpadesGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'hearts'}
  <HeartsGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'kings-corner'}
  <KingsCornerGame view={state.view} {socket} {playerId} />
{:else if state.gameId === 'council-ledger'}
  <CouncilLedgerGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'cipher-post'}
  <CipherPostGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'fault-line'}
  <FaultLineGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'signal-relay'}
  <SignalRelayGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'night-market'}
  <NightMarketGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'ridge-run'}
  <RidgeRunGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'harbor-dice'}
  <HarborDiceGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'farkle'}
  <FarkleGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'president'}
  <PresidentGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'gin-rummy'}
  <GinRummyGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'golf'}
  <GolfGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else if state.gameId === 'word-split'}
  <WordSplitGame view={state.view} {socket} {playerId} isHost={!!playerId && lobbyState.hostId === playerId} />
{:else}
  <div class="unknown">
    <p>Unknown game type</p>
    {#if onBackToLobby}<button type="button" onclick={onBackToLobby}>Back to Lobby</button>{/if}
  </div>
{/if}

<style>
  .unknown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 4rem 1rem;
    color: var(--color-ink-muted);
  }

  .unknown p {
    margin: 0;
  }

  .unknown button {
    height: 52px;
    padding: 0 28px;
    border: 0;
    border-radius: 999px;
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    cursor: pointer;
  }

  .unknown button:hover {
    background: var(--color-terracotta-press);
  }
</style>
