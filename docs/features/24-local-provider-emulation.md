# Local provider emulation (`emulate`)

GitHub and Google OAuth are emulated **by the Worker itself** (see
[`apps/worker/src/emulate`](../../apps/worker/src/emulate)), so dev, e2e and
previews all use the same code path and the same origin as the app.

| Provider | Endpoints                                  | Used for             |
| -------- | ------------------------------------------ | -------------------- |
| Google   | `/emulate/google/o/oauth2/v2/auth` + token | Google OAuth sign-in |
| GitHub   | `/emulate/github/login/oauth/authorize`    | GitHub OAuth sign-in |
| Health   | `/emulate/health`                          | Readiness probes     |

The answer to "why not `@emulators/*`": those packages call
`fileURLToPath(import.meta.url)` and `readFileSync` for bundled fonts at module
load, which crashes workerd before the Worker starts, and the preview deploy
bundles with wrangler's esbuild where Node builtins cannot be aliased. The
in-Worker emulator is dependency-free and stateless (codes and tokens are
base64url-encoded grants), so it works across isolates and cold starts.

## Running it

```bash
bun dev                  # app + emulated providers, on https://scorebrawl.localhost:1355
```

`bun dev` (see [`scripts/dev.ts`](../../scripts/dev.ts)) writes a gitignored
`apps/worker/.env.local` with `EMULATE_ENABLED=true`, the same-origin provider
URLs, dummy client secrets and `BETTER_AUTH_URL` (portless strips `:1355` from
the `Host` header). No emulator process or extra ports are involved.

Use the real providers instead:

```bash
EMULATE=0 bun dev        # or delete apps/worker/.env.local
```

The providers are signature-compatible with the upstream flows better-auth
uses: Google is PKCE + OIDC-shaped userinfo, GitHub serves `/user` and
`/user/emails`. Redirect URIs and client secrets are not validated, which is
what lets any preview origin sign in without per-PR OAuth app configuration.

Seeded picker users (matching the D1 seed and e2e accounts):

- `seed@example.com` (GitHub login `seed`)
- `emulate-e2e@example.com`
- `signup-e2e@example.com`
- `invitee-e2e@example.com`

## How the worker is wired

- `apps/worker/src/index.ts` routes `/emulate/*` to the emulator when
  `EMULATE_ENABLED=true`, importing the module lazily so production never
  evaluates it. Production leaves the flag unset and keeps the built-in
  providers.
- `apps/worker/src/middleware/context.ts` passes `EMULATE_GITHUB_URL` /
  `EMULATE_GOOGLE_URL` to `createAuth`.
- `apps/worker/src/lib/better-auth.ts` registers those providers through
  better-auth's `genericOAuth` plugin instead of the built-in
  `socialProviders`, because the built-in GitHub/Google providers hardcode
  upstream endpoints. Provider ids stay `github` / `google`, so `signIn.social`,
  account linking and `trustedProviders` behave as in production.
- `EMULATE_*_URL` is only used for the browser's authorize redirect. The code
  exchange and userinfo lookup run in-process via `getToken` / `getUserInfo`, so
  the callback never makes a Worker-to-itself request (no dependence on
  loop-back routing or local TLS trust), and there is no `discoveryUrl` fetch at
  auth init.

## E2E authentication

Both suites sign in through the emulated Google provider.
`apps/e2e/lib/emulated-sign-in.ts` completes the OAuth round trip against the
API (better-auth authorize URL -> emulator callback -> app callback) and the
session cookie lands in the shared request context; specs then load the app.
Because the emulator accepts any email, users that must not exist yet (signup,
invitation accept) need no extra seeding.

The mobile suite runs the Expo web export against the same API on
`http://localhost:5173`, so the emulator is reached there too.

## Previews

`prepare-wrangler-config.ts` sets `EMULATE_ENABLED=true` and points both provider
URLs at the preview's own `workers.dev` origin, so reviewers sign in as
`seed@example.com` (which keeps `ADMIN_USER_IDS` working) without registering
per-PR callbacks.

## Caveats

- `genericOAuth({ config: [] })` is registered unconditionally: making the
  plugin list conditional broke better-auth's plugin type inference for the
  organization plugin. With no URLs set it registers nothing.
- There is no emulated Resend mailbox: `RESEND_API_KEY` is left empty, so
  invitation links are logged instead of emailed.
- Worker integration tests run under `@cloudflare/vitest-pool-workers`, which
  mocks outbound `fetch` by default; the emulator itself is unit-tested in
  `apps/worker/test/emulate`.
- Emulated users are separate from the D1 seed; `seed@example.com` exists in both
  so the GitHub spec can assert real account linking.
- e2e signs in for every spec from one IP, which trips better-auth's per-IP rate
  limiter, so the generated env sets `DISABLE_RATE_LIMIT=true`.
