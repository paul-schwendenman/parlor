# Room game voting plan

Let the host create an invite-only room before the group decides what to play. Everyone can join with the existing room code, browse the games, and vote. The host confirms a game once the group is ready. The same room can hold another vote after a match.

## First release

1. Offer **Create room** alongside the game catalog. Creating from a game card still preselects that game. An unselected room shows the picker to every participant as soon as they join.
2. Give every seated human, including the host, one vote. They can change or clear it while voting is open. Show aggregate totals and each participant’s own vote. Spectators can follow the count. Bots and spectators do not vote.
3. Let players vote for games that fit within the current roster’s maximum. A game below its minimum is still an option while friends are joining. Show the required player range and explain what prevents play. Recheck compatibility when the host confirms a game. If the roster has grown past a game’s maximum, keep its tally visible, mark it unavailable, and let voters change their choice.
4. Highlight the playable vote leader and show ties explicitly. The host confirms the leader, breaks a tie, or chooses another compatible game. With zero votes, the host can still choose directly. Confirmation closes voting and runs the existing game-selection flow. Game setup, readiness, and Start then follow the selected game’s rules.
5. Back in the lobby, the last game is available for a rematch. **Vote for next game** opens a fresh ballot in the same room. It clears the current selection so the lobby regains its default seat capacity. Reopening requires an explicit host action.

## Server and client changes

- Keep ballot state with the room so it follows room cleanup and host migration. Use a round ID and a map from stable player ID to game ID. Keep the map server-side and send each client the round ID, phase, aggregate totals, and their own vote. Treat a repeat of the same vote as idempotent.
- In `apps/parlor/src/lib/server/socketServer.ts`, handle vote, open, and confirm through authenticated room membership and the existing acknowledgment and rate-limit conventions. Validate round ID, waiting status, actor role, and game metadata on the server. Keep the rules for voting scoped to the combined Parlor app. Reuse the existing selection path and `RoomManager.selectGame` so game invalidation, capacity, and readiness use the same logic. Apply selection and ballot closure together, and keep the ballot open if selection fails.
- Use the shared lobby lifecycle to refresh ballot snapshots on create, join, spectate, reconnect, roster changes, and permanent seat removal. Keep a disconnected player’s vote while their seat is reserved, and drop it on explicit leave or expiry. A new host inherits the ballot. Include the round ID on mutations to reject a late vote from a previous round. Keep roster and tally updates ordered so clients can display consistent eligibility.
- Wire snapshots into the Parlor socket client and lobby store. Extend the existing lobby picker with a vote control, vote count, and eligibility explanation on each card. Keep the host’s confirmation control distinct from their vote. Make the selected vote keyboard accessible and provide a readable status when an attempted change is rejected. Leave per-game standalone lobby flows on their current protocol.

## Implementation and verification

1. Add server ballot state and transitions, then cover them using the Parlor socket tests. Exercise vote changes and clearing, invalid IDs, duplicate requests, spectator and bot restrictions, host transfer, reconnect, seat expiry, and votes from closed or stale rounds.
2. Connect the lobby UI and creation entry point. Walk through a phone-sized flow with a host and two guests. Verify a tied vote, direct selection with zero votes, and a game becoming unavailable after another player joins. Check the invite link, keyboard interaction, and sensible focus when voting closes.
3. Start and finish a game, return to the same room, and open a new ballot. Check that the old votes disappear and a rematch still works. Run the existing Parlor and multiplayer suites, including game-first creation, readiness, start rollback, and standalone lobby behavior.
