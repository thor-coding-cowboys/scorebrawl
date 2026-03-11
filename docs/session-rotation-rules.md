# Session Rotation Rules (Winner-Stays)

How many players rotate out = `min(waitingCount, playingCount)`.

## Rotation Precedence (highest to lowest)

1. **No waiters → nobody out.** If no players are waiting, nobody rotates out — regardless of any other rule. You can't bench someone with no replacement.

2. **Waiters >= playing → everyone out.** If enough waiters to replace all playing players, everyone rotates out. Win/lose is irrelevant.

3. **maxConsecutiveGames forces rotation.** If set, any player with `consecutiveGames >= max` must rotate out. Forced players are grouped into tiers by `consecutiveGames` value and processed highest-first. Within a tier (same `consecutiveGames`), losers go before winners. This means a forced winner with 5 consecutive rotates out **before** a forced loser with 3 consecutive — `consecutiveGames` is the primary sort, win/loss is only a tiebreaker at the same tier.

4. **Losers out before winners.** Remaining slots (after forced) are filled by losers first, then winners. Higher `consecutiveGames` goes first within each group.

5. **Coin toss / random draw.** When players in the same group (e.g. two losers) have identical `consecutiveGames` and a choice must be made, a coin toss (2 players) or random draw (3+) decides.

## Tiebreaker

`consecutiveGames` (games played in a row without sitting out) is the universal tiebreaker within every rule above.

## Queue Priority

The waiting queue determines which players enter play next. Priority order:

1. **Newly added players** — inserted at front of queue (highest priority).
2. **Longest-waiting players** — ordered by games since last played. Players who have been sitting out longer play first.
3. **Just-finished players** — all players who just completed a match go to the back of the queue, regardless of whether they won or lost.

## Draws

On a draw, the team with the higher total `consecutiveGames` is treated as the "loser" (they've been playing longer). If sums are equal, a draw-tiebreak coin toss determines which team is the "loser."

## Team Placement

When `autoRandomize` is **off** (default):

- Surviving winners stay on the winning team's side.
- Waiters (by queue order) + surviving losers fill the opposing side.
- If the winner side is short, promote from the opposing pool.

When `autoRandomize` is **on**:

- All players who will play are shuffled randomly across home/away teams.

Always-split constraints are enforced last via swaps (regardless of randomize setting).
