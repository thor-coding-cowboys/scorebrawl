# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Releases and updates

JS/asset changes ship as an over-the-air **EAS Update**; native changes ship through the
**Mobile Release** workflow (build + TestFlight submit). Both are manual GitHub
workflows: run **Mobile Update** to publish an update and **Mobile Release** to build.
Nothing publishes automatically, to keep build credits and CI minutes down. Details in
`docs/releasing.md`.

**Bump `version` in `app.json` whenever a change touches native code** — a new
native/Expo module, native `app.json` fields (icon, splash, permissions, plugins), or an
`expo`/React Native upgrade. The runtime version policy is `appVersion`, so an update
only reaches builds with the same `version`; a native change needs a new Mobile Release
build and a republished update.
