# Shared colour + glow token set between web & mobile (`packages/core/theme`)

## Status

In progress — implements [#705](https://github.com/thor-coding-cowboys/scorebrawl/issues/705). One branch, eight commits (see [Slices](#slices)); mobile public key names are renamed to core names in the same branch.

## Summary

`apps/web` and `apps/mobile` each hand-maintain a colour system in an incompatible format with nothing keeping them in sync: web owns shadcn `oklch` CSS custom properties plus 621 Tailwind palette-class usages; mobile owns a hex `Colors.light`/`Colors.dark` record plus ~109 hex and ~54 `rgba()` literals elsewhere. Drift is already visible (`destructive`, form W/D/L, glow intensity, avatar palette, streak ramp) and one concept is encoded three ways on mobile alone. Dark mode is inferred by **string-comparing colour values** in two places.

This work makes `packages/core/theme` the single authored colour source: a framework-agnostic `oklch` token tree consumed by both clients through thin adapters. Colours + glow only — typography, spacing and radii are out of scope.

## Goal

- `packages/core` (`@coding-cowboys/scorebrawl-core`) authors every colour once, in `oklch`.
- `packages/client` provides a thin web adapter that turns the tokens into CSS custom properties.
- `apps/mobile`'s `constants/theme.ts` becomes a shaper over the tokens with an explicit `mode`, and its keys are renamed to match the shared tree.
- Glow (tints, radial card glows, glow buttons/badges) is data, not class strings and raw hex.
- `core` stays dependency-free: no React, DOM, or React Native imports. Worker stays out (it hardcodes no colours).

## Acceptance criteria

- `core/theme` is the only place colour values are authored; the drifted `destructive` and form/draw values are unified and pinned by a test.
- Web's CSS vars are produced from the tokens at runtime; editing a token changes web and mobile together with no second edit in `index.css`.
- Tailwind palette classes used by web resolve to the shared ramp tokens.
- Mobile `theme.ts` is a shaper over `core/theme`; no colour-string dark-mode detection remains.
- Glow is tokenized: web `glowColors`, `dashboard-card` radial gradients, mobile `CardGlow` and `glowBlue*` all read from shared tone records.
- A test asserts every token in `themes.light` has a matching key in `themes.dark`, and that each adapter covers the full tree.
- `core` has no React/DOM/RN imports; worker has no dependency on the theme.
- `bun check && bun run test` pass; unified values screenshot-compared on both platforms.

## Key risk: React Native cannot parse `oklch`

Verified: `@react-native/normalize-colors@0.86.3` (RN 0.86.3 / Expo 57) supports hex, `rgb`/`rgba`, `hsl`/`hsla`, `hwb` and named colours — **no** `oklch`/`oklab`/`lab`/`lch`.

Therefore `core` ships a pure, tested `oklchToHex()` and the mobile shaper applies it once at module load. Hex palettes (`avatar`, `streak`, status, role, score-type) are authored in `oklch` and converted, so there is still exactly one authored value per token. Documented in the PR.

## Design

### Package layout & dependency direction

```
packages/core/src/theme/
  index.ts     public exports: palette, themes, glowIntensity, oklchToHex, toMobileColors, selectAvatarIndex
  palette.ts   mode-invariant hue ramps (oklch)
  tokens.ts    themes.light / themes.dark (semantic + form/status/role/scoreType/avatar/chartSeries/streak/glow)
  oklch.ts     pure oklch -> sRGB hex (+ alpha) converter
  mobile.ts    pure shaper: tokens[mode] -> mobile key record
  avatar.ts    name hash -> palette index selector
  *.spec.ts
```

- `packages/core/package.json` gains `"./theme": "./src/theme/index.ts"`.
- Direction: `core/theme` (pure) ← `client/theme` (web CSS-var adapter, DOM-only, never imported by RN) and ← `apps/mobile`.
- `packages/core/tsconfig.json` keeps `lib: ["ES2023"]` so no DOM types can leak into core. `packages/client` already has DOM.
- Both package vitest environments are `node`, so adapter logic must be exposed as **pure functions** (below) with a thin DOM step.

### Token tree

`palette` — mode-invariant ramps, authored in `oklch`, copied from Tailwind v4's default values. Only the `(hue, step)` pairs web actually uses today:

| Hue     | Steps                        |
| ------- | ---------------------------- |
| blue    | 300, 400, 500, 600, 950      |
| red     | 100, 300, 400, 500, 600, 950 |
| emerald | 300, 400, 500, 600           |
| amber   | 300, 400, 500, 600, 700      |
| purple  | 300, 400, 500, 600           |
| green   | 500, 600                     |
| rose    | 400, 500, 600                |
| gray    | 400, 500, 600                |
| yellow  | 300, 500, 600                |
| orange  | 300, 400, 500, 600           |
| fuchsia | 300, 400, 500, 950           |
| cyan    | 200, 300, 400, 500, 600      |
| violet  | 400, 500, 600                |
| pink    | 300, 500, 600                |
| lime    | 500, 600                     |
| teal    | 500, 600                     |
| sky     | 400, 600                     |
| indigo  | 400, 500, 600                |

Hues/steps not listed are added later, when first used.

`themes[mode]` — identical shape for `light` and `dark`:

- **semantic** (shadcn names; values are today's `apps/web/src/index.css` verbatim): `background`, `foreground`, `card`, `cardForeground`, `popover`, `popoverForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `muted`, `mutedForeground`, `accent`, `accentForeground`, `destructive`, `border`, `input`, `ring`, `chart1`–`chart5`, `sidebar`, `sidebarForeground`, `sidebarPrimary`, `sidebarPrimaryForeground`, `sidebarAccent`, `sidebarAccentForeground`, `sidebarBorder`, `sidebarRing`.
- **mobile-only tokens promoted into core** (so mobile needs no local literals): `buttonPrimary`, `backgroundSelected`, `segmentTrack`, `segmentThumb`, `segmentThumbBorder`, `splashBackground`.
- **domain**:
  - `form`: `{ win, draw, loss }`
  - `seasonStatus`: `{ active, upcoming, ended, locked, archived }`
  - `invitationStatus`: `{ pending, accepted, rejected, canceled }`
  - `role`: `{ owner, editor, member, viewer }`
  - `scoreType`: `{ elo, threeOneZero, oneVnElo }`
  - `avatar`: 12 × `{ background, text, border }`
  - `chartSeries`: `{ a, b }`
  - `streak`: `{ fire: [...], ice: [...] }`
  - `glow`: `{ red, blue, emerald, amber, purple, pink }` × `{ text, solid, background, border }`. `background`/`border` are explicitly authored per mode because their light/dark alphas differ today; `solid` is the opaque hue used with `glowIntensity`.
  - `divider` — the low-alpha mid-grey used by dividers, header underlines and de-emphasised placeholders (`rgba(128,128,128,…)`, `#9CA3AF`).

`glowIntensity = 0.1` — the single knob for the **card radial glow** (web `dashboard-card` gradients and mobile `CardGlow`), applied over `glow[tone].solid`.

Every value carrying alpha is authored as `oklch(… / N%)`.

### `oklchToHex` (mobile, required)

`oklchToHex(value: string): string | null` in `core/theme/oklch.ts`. Pure: parse `oklch(L C H / A)`, oklab → linear sRGB → gamma-encode → 8-bit, **clamp out-of-gamut** components, emit `#rrggbb` or `#rrggbbaa`. Returns `null` for unparseable input so the shaper fails loudly instead of rendering nothing. Spec'd against known pairs (e.g. `oklch(1 0 0)` → `#ffffff`, `oklch(0.577 0.245 27.325)` → `#e7000b`).

### Web adapter (`packages/client/src/theme/`)

- `themeDeclarations(mode): Record<string, string>` — **pure**; returns `--background`, `--primary`, `--blue-500`, `--glow-blue-solid`, … for a mode. Unit-tested in node.
- `themeCss(mode): string` — wraps declarations into a `:root { … }` / `:root.dark { … }` rule body.
- `applyThemeTokens(doc: Document = document)` — one-shot; inserts/updates a single `<style id="scorebrawl-theme">` in `doc.head` containing both rules. Idempotent. Called from `apps/web/src/main.tsx` **before** `root.render`.

Dark switching is pure CSS: `next-themes` puts `.dark` on `<html>` (which is `:root`), and web's dark variant is `.dark *`. No `next-themes` subscription is needed.

`apps/web/src/index.css` becomes a consumer:

- delete the literal `:root` / `.dark` declarations;
- keep `--radius` / `--font-sans` (out of scope);
- extend `@theme inline` with the ramp mappings (`--color-blue-500: var(--blue-500)`, …) so `bg-blue-500/10` resolves to the shared value with **zero** class rewrites and `dark:bg-red-600/20` keeps working.

### Mobile adapter (`apps/mobile/src/constants/theme.ts`)

Becomes a shaper over `toMobileColors(mode)` from core, with **keys renamed to core names**:

| Today                                                           | Becomes                                       |
| --------------------------------------------------------------- | --------------------------------------------- |
| `text`                                                          | `foreground`                                  |
| `textSecondary`                                                 | `mutedForeground`                             |
| `surface`                                                       | `card`                                        |
| `backgroundElement`                                             | `muted`                                       |
| `backgroundSelected`                                            | `backgroundSelected` (core token)             |
| `primary`, `primaryForeground`, `border`, `destructive`, `card` | unchanged names, shared values                |
| `buttonPrimary`                                                 | `buttonPrimary` (core token)                  |
| `segmentTrack`, `segmentThumb`, `segmentThumbBorder`            | core tokens                                   |
| `splashBackground`                                              | core token                                    |
| `glowBlueBg` / `glowBlueText` / `glowBlueBorder`                | `glow.blue.background` / `.text` / `.border`  |
| `amberBg` / `amberText` / `amberBorder`                         | `glow.amber.background` / `.text` / `.border` |

- Adds explicit `mode: "light" | "dark"` and `isDark` to each record.
- **Deletes both colour-string comparisons**: `apps/mobile/src/components/session/theme.ts:6` (`theme.background === Colors.dark.background`) and `apps/mobile/src/app/(drawer)/(stack)/members.tsx:258` (`theme.text === "#ffffff" ? "dark" : "light"`). Both read `mode`/`isDark` instead.
- `useTheme()` (`apps/mobile/src/hooks/use-theme.ts`) keeps returning `Colors[resolved]`; its ~90 `theme.*` call sites are updated to the new key names in the same commit.
- `Fonts`, `Spacing`, `MaxContentWidth` are untouched.

### Drift unification (canon)

| Token           | Canon                                                                      | Files changed                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destructive`   | web oklch (`oklch(0.577 0.245 27.325)` / dark `oklch(0.704 0.191 22.216)`) | mobile `theme.ts` (`#dc2626` / `#f87171` shift)                                                                                                                                                                                                                                                                                                                                                                                    |
| `form` W/D/L    | `#16a34a` / `#d97706` / `#dc2626` (draw = amber)                           | web `ui/form-dots.tsx`, `season/form-bar.tsx`, `winner-stays/queue-panel.tsx`, `session/-components/score-stepper.tsx`, `matchResultsConfig` in `players/$leaguePlayerId/index.tsx` + `teams/$teamId/index.tsx` + `session/$sessionId/summary.tsx` (draw gray → amber); mobile `session/queue-tab.tsx` `DOT_COLORS`, `player/player-compare.tsx`; `packages/core/src/presentation/standings.ts` `FORM_COLORS` re-exports the token |
| `card` (dark)   | mobile `surface` `#0c0c0e` (`oklch(15.527% 0.0042 285.899)`)               | web `--card` dark darkens from `oklch(0.21 0.006 285.885)`; mobile cards keep the darker boxes from `main`                                                                                                                                                                                                                                                                                                                         |
| `glowIntensity` | `0.1`                                                                      | mobile `ui/card-glow.tsx` (0.18 → 0.1)                                                                                                                                                                                                                                                                                                                                                                                             |
| `avatar`        | web hue order at Tailwind 500/600                                          | web `ui/avatar-with-fallback.tsx`, mobile `components/avatar.tsx`                                                                                                                                                                                                                                                                                                                                                                  |
| `streak.fire`   | web 4-stop `#ffcc00 #ff6a00 #ff8c00 #ff4500`                               | mobile `components/streak-avatar.tsx` (fire ramp shifts; ice ramp moves to tokens unchanged)                                                                                                                                                                                                                                                                                                                                       |

Also folded in, as the same drift class:

- `seasonStatus` / `invitationStatus` / `scoreType` / `role` maps → tokens. Web: `seasons/index.tsx` (`getScoreTypeColor`, `getScoreTypeBgColor`, `getStatusColor`), `invitations.tsx` (`getStatusColor`, `roleConfig`), `seasons/-components/seasons/create-season-form.tsx` + `edit-season-form.tsx` (inline selected/dot maps), `admin/leagues/-components/admin-leagues-page.tsx` + `admin/users/-components/admin-users-page.tsx` (colour arrays), `match/create-match-drawer.tsx`, `match/create-one-vn-game-drawer.tsx`. Mobile: `seasons/index.tsx` (status + score-type configs), `invitations.tsx` (`STATUS_CONFIG`), `members.tsx` (`ROLE_COLORS`), `score-type-card.tsx` (`SCORE_TYPE_CONFIG`).
- Divider/placeholder greys (`#9CA3AF`, `rgba(128,128,128,…)`, `gray-400/500/600` variants) → the `divider` token: mobile `standing-row.tsx`, `season-standings.tsx`, `season-team-standings.tsx`, `session/standings-tab.tsx`, `latest-matches.tsx`, `user-card.tsx`, `ui/skeleton-rows.tsx`, `create-league-form.tsx`, `create-season-form.tsx`, `session-history.tsx`, `app/settings/notifications.tsx`, `app/(drawer)/(stack)/players/index.tsx`, `teams.tsx`, `seasons/index.tsx`, `invitations.tsx`, `members.tsx`.
- Web raw hex → tokens: `players/compare.tsx` (`#3b82f6` / `#f43f5e` → `chartSeries`), `matchResultsConfig` (→ `form`), `ui/chart.tsx` (`#ccc`/`#fff` → semantic tokens). `seasonHistoryConfig` (`var(--chart-1)` / `var(--chart-2)`) → `chartSeries`.
- Web `ui/glow-button.tsx` `glowColors` (6 tones × 3 Tailwind class strings) → token-backed per-tone color values (CSS-var references), consumed by `ui/glow-toggle.tsx` and ~22 routes. Keys stay `red|blue|emerald|amber|purple|pink`.
- Web target-icon/radial-gradient class strings (`dashboard-cards.tsx`, `session-dashboard-cards.tsx`, `weekly-performers.tsx`, and the repeated `bg-[radial-gradient(…)]` usages across `players/`, `teams/`, `members.tsx`, `seasons/`, `invitations.tsx`, `profile.tsx`) → glow tone + `glowIntensity`.

**Constraint:** Tailwind only sees static class names. Never build tones by interpolation (`bg-${hue}-500/10` is not scanned). Computed tones go through CSS vars or inline styles.

## Slices

One branch, eight commits:

1. `feat(core): shared theme token tree + oklch converter`
2. `feat(client): web theme adapter (CSS custom properties)`
3. `refactor(web): source CSS variables + ramps from shared tokens`
4. `refactor(mobile): source Colors from shared tokens, rename keys, explicit mode`
5. `refactor(theme): unify form/status/role/score-type/invitation/divider tokens`
6. `refactor(theme): share avatar palette + name-colour selector`
7. `refactor(theme): tokenize glow (web + mobile) + glowIntensity`
8. `refactor(theme): share streak ramps`

Each commit keeps `bun check && bun run test` green.

## Testing

- **core**
  - `oklchToHex`: known pairs, alpha handling, out-of-gamut clamping, invalid input → `null`.
  - `themes.light` ↔ `themes.dark` key parity, recursive.
  - `toMobileColors`: identical keys for both modes; every emitted value is a valid hex string (i.e. every token converted).
  - `selectAvatarIndex`: deterministic, empty-name fallback, stable across the 12 entries.
- **client**
  - `themeDeclarations(mode)` emits a var for **every** token path (coverage test — catches a token silently missing from the adapter).
  - `themeCss(mode)` uses `:root` for light and `:root.dark` for dark.
  - `applyThemeTokens` is idempotent against a fake `Document` (one style node, updated in place).
- **guard**
  - A test asserting `apps/web/src/index.css` contains no literal colour values (only `var()` mappings), pinning "core is the only authored source".

## Verification

- `bun check && bun run test` green.
- Web screenshots via agent-browser at `https://scorebrawl.localhost:1355` for every deliberately unified value (destructive, form draw, avatar tones, streak fire, card glow), before/after.
- Mobile via `expo start --web` (RN-web caveat noted in the PR — RN-web is not a native renderer).

## Risks

- `oklch` unsupported in RN 0.86 (confirmed) → the converter is mandatory; out-of-gamut clamping is a real quality decision.
- `@theme inline` combined with runtime `var()` for the ramps must be verified against Tailwind 4.1.18.
- Mobile key rename is the widest mechanical diff (~90 call sites).
- Removing literals from `index.css` leaves no CSS fallback if the adapter never runs. Acceptable: this app has no SSR and nothing renders before JS.
- `recharts` SVG must accept `var(--…)` colour values; verify, and fall back to resolved hex on web if not.

## Out of scope

Typography (`Fonts`), spacing (`Spacing`), radii (`--radius-*`), `MaxContentWidth`. Worker colour usage (it has none today).

Note: renaming mobile keys was originally floated as a deferrable follow-up, but is included in this branch by explicit decision.

## Implementation status

Landed (branch `feat/shared-theme-tokens`):

- `core/theme`: `palette`, `themes`, `glowIntensity`, `oklchToHex`, `withAlpha`, `themeCssVars`, `paletteVars`, `toMobileColors`, `mobileColorKeys`, `selectAvatarIndex`, `avatarTones` — with tests for the converter, light/dark key parity, domain mode-invariance, the CSS-var walker, the shaper (hex-only), and the avatar selector.
- `client/theme`: `themeDeclarations`, `themeCssRules`, `applyThemeTokens` (one-shot `<style id="scorebrawl-theme">`).
- Web: `index.css` is a consumer (no literal colours; palette `@theme inline` mappings for every hue/step used); `main.tsx` applies the tokens before first render; the deliberately-unified values are in place; card glows, halos and the vignette are `@utility` classes reading the glow tokens.
- Mobile: `constants/theme.ts` is a shaper over the tokens with keys renamed to core names and an explicit resolved mode via `useResolvedThemeMode()`; `MobileColors` keys are typed from the token tree, so a stale key fails to compile; both colour-string dark-mode checks are gone.

Deferred, not landed: **streak avatar surfaces**. `apps/web/src/routes/-components/streak-avatar.tsx` (39 literals), `apps/web/src/routes/-components/streak-flyout.tsx` (4) and `apps/mobile/src/components/streak-avatar.tsx` (21) still author their own values, so the "`core/theme` is the only place colour values are authored" acceptance criterion and the "streak `fire` = web's 4-stop ramp" canon are **not** fully met by this branch. The shared `streak.fire` / `streak.ice` tokens exist but are unconsumed. Reason: those two files are intricate animated SVGs whose remaining shades (comet heads, sweep stops, rim strokes, glass fills, glow shadows) are ~50 distinct values, ~32 of them alpha-baked and mobile-only, and they could not be screenshot-verified in this session.

Two further documented exceptions, both excluded from the mechanical literal sweep:

- `apps/web/src/routes/-components/ui/chart.tsx` — `#ccc`/`#fff` occur inside CSS _attribute selectors_ matching recharts' internal default stroke values, not as authored colours.
- `apps/mobile/src/components/animated-icon.module.css` — the Expo web build has no theme adapter, so custom properties would not resolve there.
