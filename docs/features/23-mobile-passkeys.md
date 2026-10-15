# Mobile passkey sign-in + passkey management

## Status

Not started — design approved 2026-10-15. Branch `feat/mobile-passkeys` off `main`.

## Summary

Web has passkey sign-in (`apps/web/src/routes/_auth/auth/-components/sign-in-form.tsx`) and passkey management in profile (`apps/web/src/routes/_authenticated/_sidebar/profile.tsx`). Mobile has **neither** — `apps/mobile` contains zero passkey references. This is not a regression: it was never implemented.

Two blockers make it non-trivial:

1. `@better-auth/passkey/client` calls `startAuthentication` from `@simplewebauthn/browser` (`node_modules/@better-auth/passkey/dist/client.mjs:19`), which requires `navigator.credentials`. Unavailable in React Native, and the plugin exposes no injection point for a custom authenticator. A native WebAuthn module is required.
2. No platform association config exists anywhere in the repo — no `apple-app-site-association`, no `assetlinks.json`, and `apps/mobile/ios/Scorebrawl/Scorebrawl.entitlements` has only `aps-environment`.

The server is already mobile-compatible. rpID is derived per-request from the `Origin` header with a host fallback (`apps/worker/src/middleware/context.ts:58`). Native fetch sends no `Origin`, so it falls back to `https://scorebrawl.com` → rpID `scorebrawl.com`, which is the same rpID the web app uses. **One passkey therefore works on both surfaces — no data migration.**

## Prerequisites (cannot be satisfied in code)

- **Physical device.** Passkey UI does not run in the iOS Simulator or Android Emulator.
- **Reachable HTTPS domain** for the rpID, serving real AASA and assetlinks.
- **Android signing SHA-256 fingerprints** (`eas credentials -p android`): debug keystore + Play App Signing. Recorded as a placeholder until supplied.
- Apple Team ID `VWB9AT6XKY`, bundle `com.scorebrawl` (both already in `apps/mobile/eas.json`).

## Goal

- Native passkey sign-in on `apps/mobile/src/app/sign-in.tsx`.
- Passkey management (list / add / rename / delete) in the mobile profile screen.
- A passkey registered on web signs in on mobile, and vice versa (shared rpID).
- The worker serves the `.well-known` association files on `scorebrawl.com`.

## Acceptance criteria

- `expoPasskeyClient()` is in the mobile auth client; the mobile web build is unaffected (the package delegates to the stock browser client when `Platform.OS === "web"`).
- `apps/mobile/app.json` declares `ios.associatedDomains: ["webcredentials:scorebrawl.com"]`, and the entitlement survives `expo prebuild`.
- On a physical device, the sign-in button authenticates with a passkey registered in the web app.
- Profile lists passkeys with name / `deviceType` / backed-up, and add, rename and delete all work.
- `GET https://scorebrawl.com/.well-known/apple-app-site-association` → `{"webcredentials":{"apps":["VWB9AT6XKY.com.scorebrawl"]}}` with `content-type: application/json`, no redirect.
- `GET https://scorebrawl.com/.well-known/assetlinks.json` → a single `android_app` target for `com.scorebrawl` whose `sha256_cert_fingerprints` come from config; a documented marker while unset.
- Both paths 404 on `api.scorebrawl.com`.
- `buildPasskeyConfig` is exported and unit-tested: the `origin` array includes an `android:apk-key-hash:<hash>` entry per configured fingerprint, and honours the rpID override.
- `bun check && bun run test` pass.

## Design

### Decision: `expo-better-auth-passkey`

Drop-in for `passkeyClient()` — identical `signIn.passkey()` / `passkey.addPasskey()` surface, ceremony and error mapping already implemented, Expo module (autolinks, no config plugin), web build delegated internally. Version 1.6.1 peer-matches what we run (`@better-auth/passkey >=1.4.9`, `expo >=55`; we are on 1.7.3 / SDK 57).

Rejected:

- **`react-native-passkeys`** (Expo's docs recommendation). Low-level `Passkey.create/get`; we would implement the whole ceremony ourselves — `generate-register-options` → native → `verify-registration`, plus base64url handling, error-code mapping and session-signal invalidation (~200 lines we own, where the subtle bugs live).
- **Web-delegated via deep link.** No native module and no association files, but WebAuthn inside `ASWebAuthenticationSession` is unreliable on iOS and it fails the actual goal of a passkey button on the login screen.

The swap to `react-native-passkeys` later is contained to `auth-client.ts` and the sign-in handler, because the component-level API is identical.

### 1. rpID and origins — new `lib/passkey-config.ts`, `better-auth.ts`, `context.ts`, `wrangler.jsonc`

`origin` becomes an **array** (`PasskeyOptions.origin?: string | string[] | null` — confirmed): `[passkeyOrigin, ...hashes.map((h) => \`android:apk-key-hash:${h}\`)]`.

The derivation is currently inline inside `createAuth()` (`better-auth.ts:76-91`) and the plugin instance's options are not inspectable, so it cannot be tested as written. It moves to an exported pure function — `buildPasskeyConfig({ requestOrigin, rpIdOverride, androidKeyHashes })` in a new `apps/worker/src/lib/passkey-config.ts` — returning `{ rpID, origin }`, the two values the `passkey()` plugin takes. The existing `localhost` / `127.0.0.1` → `http://localhost:5173` special case (`better-auth.ts:88-90`) moves inside the helper and stays covered by a test.

- `PASSKEY_ANDROID_APK_KEY_HASHES` (new, comma-separated) goes in the shared `vars` in `wrangler.jsonc`. It only _adds_ allowed origins, so previews and local are unaffected.
- `PASSKEY_RP_ID` is an **optional override and is deliberately left unset in `wrangler.jsonc`**. There are no `env` blocks, so a value in the shared `vars` would also apply to previews; pinning `scorebrawl.com` there would make every preview's rpID a non-suffix of its `*.workers.dev` origin and break passkey sign-in on previews. Left unset, previews and local keep deriving their own host as today, and prod keeps deriving `scorebrawl.com` (only the app host serves `/api/*`, so that value is stable). The override exists so a preview or tunnel domain can be pinned for on-device testing.
- Because it is unset, the var produces no generated `Env` key. Read it the way `BETTER_AUTH_URL` already is (`context.ts:62`): optional field plus a cast. It must **not** be added to shared `vars` to satisfy typecheck — that is the change that breaks previews.
- Net effect on prod: no behaviour change, no existing passkey breaks.

### 2. `.well-known` files — `wrangler.jsonc`, new `routes/well-known.ts`

- Add `/.well-known/*` to `assets.run_worker_first`.
- Apple route: `{"webcredentials":{"apps":["VWB9AT6XKY.com.scorebrawl"]}}`, `application/json`, no redirect (Apple rejects both redirects and non-JSON here). `applinks` is deliberately omitted — only `webcredentials` is needed for passkeys.
- Android route: one `android_app` target for `com.scorebrawl` with **both** relations — `delegate_permission/common.get_login_creds` (the credential-sharing relation) and `delegate_permission/common.handle_all_urls` (Android's own docs list both, and the passkey codelab requires `handle_all_urls` for cross-platform passkeys). `sha256_cert_fingerprints` is rendered as colon-separated uppercase hex decoded from the base64url entries in `PASSKEY_ANDROID_APK_KEY_HASHES`.
- While that var is unset, `assetlinks.json` returns `200` with `application/json` and an **empty** `sha256_cert_fingerprints`, plus a `// TODO` in the route. Pinned by a test so doc and behaviour agree. This empty body ships to production until the fingerprints are supplied — Android passkey sign-in stays broken until then, iOS is unaffected.
- Register both routes **before** the catch-all `.use("*", enforceAuthMiddleware)` at `apps/worker/src/index.ts:60` — same placement as `/api/version` (line 45). Registered after it, they would 401 instead of returning association JSON.
- Serve from the worker rather than a file in `apps/web/public/.well-known/`: that path is not in `run_worker_first`, so the `single-page-application` fallback would answer with HTML.
- `enforceHostScope` already 404s these on `api.scorebrawl.com`, which is correct — the rpID domain is `scorebrawl.com`.

### 3. Mobile wiring

- `apps/mobile/app.json`: add `ios.associatedDomains: ["webcredentials:scorebrawl.com"]`. **Required for a working device login.** `apps/mobile/ios` is gitignored and regenerated (`apps/mobile/.gitignore: /ios`), so the entitlement cannot be hand-edited or committed — it has to come from config and be regenerated via `expo prebuild`. Without it `ASAuthorizationController` rejects the request on device. Android needs no manifest change; the association is server-side.
- `apps/mobile/package.json`: add `expo-better-auth-passkey` inline (single consumer) and declare the peers it actually has at 1.6.1: `better-auth`, `@better-auth/passkey`, `@better-fetch/fetch`, `@simplewebauthn/browser`.
- `@better-auth/passkey` gets a catalog entry — its consumers are worker and mobile, and `apps/web/src/lib/auth-client.ts:1` imports it today while declaring it nowhere. Add it to the root catalog and point worker, mobile and web at `catalog:`.
- `apps/mobile/src/lib/auth-client.ts`: add `expoPasskeyClient()` alongside `expoClient` and `organizationClient`.
- `apps/mobile/src/lib/auth-options.ts`: add `isPasskeyEnabled` kill-switch.

### 4. Sign-in screen — `sign-in.tsx`

- `handlePasskeySignIn()` → `authClient.signIn.passkey()`, then refresh the session and `router.replace("/")`.
- Map `error.code` (`ERROR_CEREMONY_ABORTED`, `AUTH_CANCELLED`, `UNKNOWN_ERROR`) to messages mirroring the web wording.
- Button first in the alternate-methods block; extend the `hasSocialOptions` gate to include it.

### 5. Profile management

Mirrors web (`profile.tsx:327-430`, `edit-passkey-dialog.tsx`) per the mobile-web-parity skill: list with name / `deviceType` / backed-up, add, rename, delete with confirm.

- New `apps/mobile/src/components/profile/passkey-*.tsx` beside the existing `edit-profile-modal.tsx`.
- `RowCard` → mobile row, shadcn `Dialog` → the mobile modal pattern, `AlertDialog` → `Alert.alert`, `toast` → the mobile feedback pattern, Hugeicons → `SymbolView`.
- Reuses `authClient.passkey.listUserPasskeys / addPasskey / updatePasskey / deletePasskey` under query key `["passkeys"]`. No new endpoints.

## Testing

Worker tests live in `apps/worker/test/**/*.spec.ts` — **not** `apps/worker/src/test/`, which does not exist (AGENTS.md is stale on this). `apps/worker/test/public-api/host-scope.spec.ts` is the model: mount the route or middleware into a bare `new Hono<HonoEnv>()` and drive it with `.request(url, {}, env)`, supplying the env by hand. These route tests inject their own env, so they do not depend on the values in `wrangler.jsonc` (which the worker runtime test config sources and strips assets from).

- `passkey-config.spec.ts` — `buildPasskeyConfig` composes the origin array: request-derived origin first, one `android:apk-key-hash:` entry per fingerprint, `rpIdOverride` respected when set, host-derived rpID when not.
- `well-known.spec.ts` — both routes return valid JSON with `application/json`; `assetlinks.json` carries a single `android_app` target for `com.scorebrawl`; with the hash var unset `sha256_cert_fingerprints` is `[]`.
- Host scope — both paths 404 on `api.scorebrawl.com` and 200 on `scorebrawl.com`. Covered by extending the existing `host-scope.spec.ts`-style request test.
- **Mobile** — typecheck only; the repo has no React Native test infrastructure.

## Verification

- `bun check && bun run test` green.
- `bun cf-typegen` after adding `PASSKEY_ANDROID_APK_KEY_HASHES` to `vars`, so the generated `Env` type includes it. `PASSKEY_RP_ID` is read as an optional field (see §1) and intentionally does not appear in the generated type.
- Automated assertions cover status, `content-type` and body. The **no-redirect** requirement is only meaningful against the deployed host and stays in the manual check below.
- Manual, on a physical device: register a passkey in the web app, then sign in with that same passkey in the mobile app. This is what proves the shared-rpID design.
- `curl -i https://scorebrawl.com/.well-known/apple-app-site-association` and `.../assetlinks.json` — status, `content-type`, body, and that neither redirects.

## Risks

- `expo-better-auth-passkey` is a single-maintainer community package that wraps `@better-auth/passkey` client internals; an upstream internals change can break it. Contained behind `auth-client.ts` and the sign-in handler.
- The exact encoding of the `android:apk-key-hash:` value (base64 vs base64url, padding) must be confirmed against the Credential Manager `clientDataJSON.origin` on a real device. Getting it wrong surfaces as a misleading "rpId cannot be validated" error, whose real cause is an origin mismatch.
- Running the worker on-device is a chicken-and-egg for local development: real AASA/assetlinks retrieval requires a public HTTPS domain, so device testing targets production or a preview domain rather than `scorebrawl.localhost`.
- iOS AutoFill-assisted requests hold a pending request open; not using them in v1 avoids the associated lifecycle handling.

## Out of scope

- iOS AutoFill / conditional UI (`cancelPasskeyAutoFill()` lifecycle on unmount and before other sign-in methods).
- Credential Manager signal-API sync (`signalAllAcceptedCredentials` / `signalUnknownCredential`) — iOS 26+ / Android 15+ only, silently no-ops below.
- Passkeys on the mobile web build (they work via the internal fallback; untested and not a target).
- A tunnel/Tailscale-based local device testing setup.
- Any change to the web passkey implementation.
