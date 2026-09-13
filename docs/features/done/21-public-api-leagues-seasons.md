# Public API — Leagues & Seasons listing (`read:leagues`, `read:seasons`)

## Status

Done: `GET /api/v1/leagues` (`read:leagues`) and `GET /api/v1/leagues/:leagueId/seasons` (`read:seasons`) shipped with bearer/scope enforcement, league-membership checks, `excludeClosed`/`scoreType` filters, and integration tests. Extends the public API from feature [19 — BullsAI integration](../19-bullsai-integration.md).

## Summary

Feature 19 makes ScoreBrawl an OAuth2 resource server and exposes match endpoints scoped to a single season:

```
POST/GET /api/v1/leagues/:leagueId/seasons/:seasonId/matches
```

That is enough to _write_ a result once the caller already knows the target, but not enough for the client to _discover_ it. The BullsAI/dartpilot lobby has to let the host pick the league and season to push into, and today there is no way to ask ScoreBrawl "which leagues am I in?" or "which seasons exist in this league?". This document specifies two additive read endpoints and the two scopes that gate them so that client can render a picker.

Granting access is unchanged: tokens are still issued through the OAuth provider from feature 19, verified locally against ScoreBrawl's `jwks`, and authorized against league membership.

## Scopes

| Scope          | Grants                                                             |
| -------------- | ------------------------------------------------------------------ |
| `read:leagues` | List the leagues (organizations) the token subject is a member of. |
| `read:seasons` | List the seasons of a league the token subject is a member of.     |

- Both are **read-only** and additive. Existing clients and tokens are unaffected.
- `read:matches` stays as-is for listing matches inside a season.
- Register both in `oauthProvider().scopes` (`apps/worker/src/lib/better-auth.ts`) and in the default scope set used by `/admin/oauth-clients` (`adminCreateOAuthClient`).
- A token only carrying `read:matches` gets `403 insufficient_scope` on these endpoints; the client must request the new scopes at authorize time.

## Endpoints

Both endpoints live under the existing `/api/v1` resource and use the same bearer middleware as the matches API: verify the JWT against the worker's `jwks` table (issuer + `aud` = `OAUTH_RESOURCE`), then enforce the required scope.

### `GET /api/v1/leagues`

Scope: `read:leagues`.

Returns the leagues where the token subject (`sub`) has a membership row. Backed by `league` (`organization`) joined to `member` on `userId = sub`.

**200**

```json
{
	"items": [
		{
			"id": "01J...",
			"name": "Reykjavík Darts League",
			"slug": "reykjavik-darts-league",
			"role": "owner"
		}
	]
}
```

- `role` is one of `owner | editor | member | viewer` (`member.role`).
- Return every membership, including `viewer`, and let the client decide which are eligible to push. (Only `owner | editor | member` can create matches; see `memberRoles` in `matches-v1.ts`.)
- Sorted by `name` for stable UI. Empty array when the subject has no memberships — not a `404`.

### `GET /api/v1/leagues/:leagueId/seasons`

Scope: `read:seasons`.

Returns seasons belonging to `leagueId`. The subject must be a member of `leagueId` (same check as the matches API). Backed by the `season` table filtered on `leagueId`.

**Query parameters**

| Name            | Type    | Default | Notes                                                                                           |
| --------------- | ------- | ------- | ----------------------------------------------------------------------------------------------- |
| `excludeClosed` | boolean | `false` | When `true`, omit seasons with `closed = true`. Accepts `true`/`false`.                         |
| `scoreType`     | string  | —       | Exact match on `season.scoreType` (e.g. `1-v-n-elo`, `elo`, `3-1-0`, `elo-individual-vs-team`). |

`excludeClosed` is the flag the dartpilot lobby uses to only offer pushable seasons. `scoreType=1-v-n-elo` narrows to the one format the current push endpoint accepts.

**200**

```json
{
	"items": [
		{
			"id": "01J...",
			"name": "Autumn 2026",
			"slug": "autumn-2026",
			"scoreType": "1-v-n-elo",
			"closed": false,
			"archived": false,
			"startDate": "2026-09-01T00:00:00.000Z",
			"endDate": null
		}
	]
}
```

- `startDate` / `endDate` are ISO 8601 strings (or `null` for `endDate`).
- Sorted by `startDate` descending (newest first) for the picker.
- Empty array when the league has no matching seasons.

## Errors

Common to both endpoints:

| Status | Body                                                                     | When                                            |
| ------ | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `401`  | `{ "error": "invalid_token", ... }` + `WWW-Authenticate`                 | Missing/expired/invalid bearer token            |
| `403`  | `{ "error": "insufficient_scope", "scope": "..." }` + `WWW-Authenticate` | Token lacks `read:leagues` / `read:seasons`     |
| `404`  | `{ "error": "not_found" }`                                               | League does not exist or subject isn't a member |

For `GET /leagues/:leagueId/seasons`, return `404` (not `403`) both when the league doesn't exist **and** when the subject isn't a member, so a client can't probe for league existence.

## Examples

```bash
curl -s https://scorebrawl.com/api/v1/leagues \
  -H "Authorization: Bearer $ACCESS_TOKEN"

curl -s "https://scorebrawl.com/api/v1/leagues/$LEAGUE_ID/seasons?scoreType=1-v-n-elo&excludeClosed=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Implementation notes

- **Auth config**: add `read:leagues` and `read:seasons` to `oauthProvider({ scopes: [...] })` in `apps/worker/src/lib/better-auth.ts`. Tokens issued before this change won't carry the scopes; clients re-authorize to add them.
- **Admin client defaults**: add the scopes to the default list in `apps/worker/src/trpc/router/admin-router.ts` (`oauthClients.create`) and the admin UI copy so new clients include them.
- **New router**: `apps/worker/src/routes/leagues-v1.ts` (Hono + `@hono/zod-validator`, matching `matches-v1.ts`). Reuse the bearer/scope middleware pattern and the league-membership query. Mount in `apps/worker/src/index.ts`:
  ```ts
  .route("/api/v1/leagues", leaguesV1Router)
  ```
  with the seasons route under the same router (`/:leagueId/seasons`).
- **DTO shape**: wrap responses in an object with an `items` array so paging/envelope attributes can be added later without breaking clients.
- **Tests**: extend `apps/worker/test/routes/matches-v1.spec.ts` patterns (OAuth util already exists in `apps/worker/test/setup/oauth-util.ts`). Cover: member lists their leagues; non-member gets `404`/`403`; missing scope gets `403 insufficient_scope`; `excludeClosed=true` hides closed seasons; `scoreType` filter works; invalid token gets `401`.

## Acceptance criteria

- A token with `read:leagues` can list exactly the leagues the subject belongs to, with role.
- A token with `read:seasons` can list the seasons of a league the subject belongs to, filtered by `scoreType` and `excludeClosed=true`.
- Missing scope returns `403 insufficient_scope` with `WWW-Authenticate`; missing/invalid token returns `401` with `WWW-Authenticate`.
- Non-members cannot read a league's seasons.
- The dartpilot lobby can populate a league + season picker limited to open `1-v-n-elo` seasons using only these two endpoints.
