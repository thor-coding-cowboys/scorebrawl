# Releasing and updating the mobile app

Two manual GitHub workflows ship the iOS app. Nothing publishes automatically.

| Change                                                                                                                       | Workflow                                       | Cost                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| JS/TS, assets, styles                                                                                                        | **Mobile Update** (EAS Update, OTA)            | none — metered by monthly active users |
| Anything native: new native/Expo module, `app.json` fields (icon, splash, permissions, plugins), `expo`/React Native upgrade | **Mobile Release** (build + TestFlight submit) | one EAS build + a review               |

## Prerequisites

- `EXPO_TOKEN` repository secret (used by both workflows).
- The `production` environment on EAS holds `EXPO_PUBLIC_API_URL`,
  `EXPO_PUBLIC_DISABLE_EMAIL_PASSWORD`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`,
  `EXPO_PUBLIC_GITHUB_CLIENT_ID` (`bunx eas-cli@latest env:list --environment production`).
  SDK 55+ `eas update --environment` reads **only** these; `.env` files and `eas.json`
  profile `env` are ignored.
- EAS iOS credentials: the EAS project must hold an App Store Connect API key (Admin or
  App Manager) so EAS can regenerate provisioning profiles when capabilities change.

## Publishing an update

```bash
gh workflow run mobile-update.yml --ref main
# or: Actions → Mobile Update → Run workflow (ref + optional message)
```

Publish only a ref whose CI and E2E runs are green — there is no gate inside the
workflow.

## The one rule: bump `version` for native changes

`runtimeVersion` uses the `appVersion` policy, so an update only reaches builds whose
`expo.version` matches. `autoIncrement` in `eas.json` moves `ios.buildNumber` only —
never `version`.

So: if a change touches native code, bump `version` in `app.json`, run **Mobile
Release**, and then republish the update for the new runtime version. Otherwise the
change never reaches anyone.

## Verifying

```bash
bunx eas-cli@latest channel:view production        # branch linked to the channel + latest update
bunx eas-cli@latest update:list --channel production
```

On a device running a build cut after the last Mobile Release: launch the app, let it
fetch, then relaunch — the new JS applies on the second launch
(`Updates.isEmbeddedLaunch` is then `false`).

If `channel:view` shows the channel is not linked to a branch, link it once:
`bunx eas-cli@latest channel:edit production --branch production`.

## Rolling back

```bash
bunx eas-cli@latest update:republish --group <groupId>   # reinstate a previous update
bunx eas-cli@latest update:rollback --channel production --runtime-version 1.0.0
```

## When a release build fails

A build with a new capability (e.g. `associatedDomains` for passkeys) fails with
`Provisioning profile ... doesn't include the <Capability> capability` when the EAS
profile is older than the capability, and EAS reports
`Failed to authenticate with the App Store Connect API key from EAS credentials
service`. Fix, in order:

1. Ensure a valid App Store Connect API key (Admin or App Manager) is set in the EAS
   project's iOS credentials — then EAS regenerates profiles on the next build.
2. Unblock immediately with `bunx eas-cli@latest credentials -p ios`, regenerating the
   provisioning profile so it includes the new capability.
