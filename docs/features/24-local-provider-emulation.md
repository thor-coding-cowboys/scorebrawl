# Local provider emulation (`emulate`)

[`emulate`](https://github.com/vercel-labs/emulate) provides stateful local
stand-ins for third-party APIs. We use it for the providers better-auth talks
to, so dev and e2e never hit real GitHub/Google/Resend.

| Service | URL                     | Used for                                          |
| ------- | ----------------------- | ------------------------------------------------- |
| GitHub  | `http://localhost:4001` | GitHub OAuth sign-in                              |
| Google  | `http://localhost:4002` | Google OAuth sign-in (PKCE, OIDC-shaped userinfo) |
| Resend  | `http://localhost:4008` | Invitation / guest-claim emails                   |

Seed users, OAuth client ids and redirect URIs live in
[`emulate.config.yaml`](../../emulate.config.yaml). Ports are pinned there, so
starting a subset (`--service github,google`) keeps stable URLs.

## Running it

```bash
bun dev                  # app + emulators, on https://scorebrawl.localhost:1355
```

`bun dev` (see [`scripts/dev.ts`](../../scripts/dev.ts)) starts the emulators on
`:4001`/`:4002`/`:4008`, waits for them to answer, then boots the app. On first
run it writes a gitignored `apps/worker/.env.local` with the emulator URLs,
matching dummy secrets and `BETTER_AUTH_URL` (portless strips `:1355` from the
`Host` header, so OAuth callbacks need it pinned).

Use the real providers instead:

```bash
EMULATE=0 bun dev        # or delete/edit apps/worker/.env.local
```

The emulators can also be run on their own:

```bash
bun run emulate          # only the emulators
```

Playwright starts the emulator itself (second `webServer` entry in
`apps/e2e/playwright.config.ts`); `bun dev` detects that it is already running
and skips its own copy, so `bun run test:e2e` needs no extra setup.

Inspect captured mail:

```bash
curl http://localhost:4008/emails -H "Authorization: Bearer re_emulated_key"
```

The emulator also serves an inspector at `/` on each service port.

## How the worker is wired

- `apps/worker/src/middleware/context.ts` reads `EMULATE_GITHUB_URL` /
  `EMULATE_GOOGLE_URL` and passes them to `createAuth` as `emulate`.
- `apps/worker/src/lib/better-auth.ts` then registers those providers through
  better-auth's `genericOAuth` plugin instead of the built-in `socialProviders`,
  because the built-in GitHub/Google providers hardcode upstream endpoints
  (`https://github.com/login/oauth/...`, `https://accounts.google.com/...`).
  Provider ids stay `github` / `google`, so `signIn.social`, account linking and
  `trustedProviders` behave exactly as in production.
- Both providers use explicit endpoints rather than `discoveryUrl`, so auth init
  makes no network calls: a stale `EMULATE_*_URL` stays quiet and only fails at
  sign-in. Google's OIDC-shaped profile (`sub`) and GitHub's `/user` +
  `/user/emails` are mapped into better-auth profiles by hand, including
  `emailVerified`.
- Emails: the `resend` SDK reads `RESEND_BASE_URL` at module load; set it to the
  emulator to capture mail instead of sending it.

Both `EMULATE_*_URL` variables are unset in production, so the built-in
providers stay in use. When set, the `genericOAuth` plugin registers providers
and the built-in ones are skipped.

## Environment

`apps/worker/.env.e2e` (checked in) holds the e2e values; `bun dev` generates the
equivalent `apps/worker/.env.local` for interactive work.

The worker reads its bindings from wrangler dotenv files, not from the shell
environment, which is why the dev script writes that file rather than exporting
variables. `VITE_GITHUB_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` are the exception —
vite reads those from the process environment, so the dev script sets them
directly (they are public ids, already committed in `wrangler.jsonc`).

Portless strips the port from the `Host` header, so the same provider is reached
with both `https://scorebrawl.localhost/...` and
`https://scorebrawl.localhost:1355/...` callbacks; the seed config registers
both.

## Caveats

- `genericOAuth({ config: [] })` is registered unconditionally: making the
  plugin list conditional broke better-auth's plugin type inference for the
  organization plugin. With no URLs set it registers nothing.
- Worker integration tests run under `@cloudflare/vitest-pool-workers`, which
  mocks outbound `fetch` by default — no test currently reaches the emulator.
- Emulated users are separate from the D1 seed; `seed@example.com` exists in both
  so the GitHub spec can assert real account linking.
