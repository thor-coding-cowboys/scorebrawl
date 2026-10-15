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
- On a physical device, the sign-in button authenticates with a passkey registered in the web app.
- Profile lists passkeys with name / `deviceType` / backed-up, and add, rename and delete all work.
- `GET https://scorebrawl.com/.well-known/apple-app-site-association` → `{"webcredentials":{"apps":["VWB9AT6XKY.com.scorebrawl"]}}` with `content-type: application/json`, no redirect.
- `GET https://scorebrawl.com/.well-known/assetlinks.json` → a single `android_app` target for `com.scorebrawl` whose `sha256_cert_fingerprints` come from config; a documented marker while unset.
- Both paths 404 on `api.scorebrawl.com`.
- The passkey plugin's `origin` is an array that includes an `android:apk-key-hash:<hash>` entry per configured fingerprint.
- `bun check && bun run test` pass.

## Design

### Decision: `expo-better-auth-passkey`

Drop-in for `passkeyClient()` — identical `signIn.passkey()` / `passkey.addPasskey()` surface, ceremony and error mapping already implemented, Expo module (autolinks, no config plugin), web build delegated internally. Version 1.6.1 peer-matches what we run (`@better-auth/passkey >=1.4.9`, `expo >=55`; we are on 1.7.3 / SDK 57).

Rejected:

- **`react-native-passkeys`** (Expo's docs recommendation). Low-level `Passkey.create/get`; we would implement the whole ceremony ourselves — `generate-register-options` → native → `verify-registration`, plus base64url handling, error-code mapping and session-signal invalidation (~200 lines we own, where the subtle bugs live).
- **Web-delegated via deep link.** No native module and no association files, but WebAuthn inside `ASWebAuthenticationSession` is unreliable on iOS and it fails the actual goal of a passkey button on the login screen.

The swap to `react-native-passkeys` later is contained to `auth-client.ts` and the sign-in handler, because the component-level API is identical.

### 1. rpID and origins — `better-auth.ts`, `context.ts`, `wrangler.jsonc`

- `origin` becomes an **array** (`PasskeyOptions.origin?: string | string[] | null` — confirmed): `[passkeyOrigin, ...hashes.map((h) => \`android:apk-key-hash:${h}\`)]`.
- New vars: `PASSKEY_RP_ID` (prod: `scorebrawl.com` — identical to the value derived today, so no existing passkey breaks) and `PASSKEY_ANDROID_APK_KEY_HASHES` (comma-separated).
- Rationale: native sends no `Origin` header, so today rpID is inferred from the request host. Making it explicit removes an implicit dependency and allows a preview domain to be configured for on-device testing.

### 2. `.well-known` files — `wrangler.jsonc`, new `routes/well-known.ts`

- Add `/.well-known/*` to `assets.run_worker_first`.
- Apple route: `{"webcredentials":{"apps":["VWB9AT6XKY.com.scorebrawl"]}}`, `application/json`, no redirect (Apple rejects both redirects and non-JSON here).
- Android route: one `android_app` target, `relation: ["delegate_permission/common.get_login_creds"]`, `sha256_cert_fingerprints` rendered as colon-separated uppercase hex decoded from the base64url entries in `PASSKEY_ANDROID_APK_KEY_HASHES`.
- Serve from the worker rather than a file in `apps/web/public/.well-known/`: that path is not in `run_worker_first`, so the `single-page-application` fallback would answer with HTML.
- `enforceHostScope` already 404s these on `api.scorebrawl.com`, which is correct — the rpID domain is `scorebrawl.com`.

### 3. Mobile client wiring

- `apps/mobile/package.json`: add `expo-better-auth-passkey` inline (single consumer) and declare the peers it needs explicitly: `@simplewebauthn/browser`, `@better-fetch/fetch`, `nanostores`.
- `@better-auth/passkey` gains a second consumer (worker + mobile) → move to the root catalog and point the worker at `catalog:`.
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

- **Worker** (`apps/worker/src/test/`): both `.well-known` routes return valid JSON with `application/json`; both 404 on the API host; the passkey `origin` array includes an `android:apk-key-hash:` entry per configured fingerprint.
- **Mobile**: typecheck only — the repo has no React Native test infrastructure.

## Verification

- `bun check && bun run test` green.
- Manual, on a physical device: register a passkey in the web app, then sign in with that same passkey in the mobile app. This is what proves the shared-rpID design.
- `curl -i https://scorebrawl.com/.well-known/apple-app-site-association` and `.../assetlinks.json` — status, `content-type`, body.

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
