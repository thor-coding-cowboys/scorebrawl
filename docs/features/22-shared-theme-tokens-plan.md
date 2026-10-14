# Shared Colour + Glow Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `packages/core/theme` the single authored source of every colour in web and mobile, consumed through a CSS-custom-property adapter on web and a hex shaper on mobile.

**Architecture:** `core/theme` authors a framework-agnostic `oklch` token tree (palette ramps + semantic/domain/glow tokens) plus two pure converters (`oklchToHex`, `themeCssVars`). `packages/client/theme` turns the var map into CSS rules and injects them once, so web's `index.css` becomes a consumer and Tailwind palette classes resolve to shared ramps. `apps/mobile`'s `Colors` becomes a shaper over the same tree, with keys renamed to core names and an explicit `mode`.

**Tech Stack:** TypeScript, Bun, Vitest, Tailwind CSS v4 (`@theme inline`), next-themes, Expo 57 / React Native 0.86.

**Spec:** `docs/features/22-shared-theme-tokens.md`

## Global Constraints

- Package manager: **bun** only. Never npm/yarn/pnpm. Never `bun test` — always `bun run test`. Never `bun deploy`.
- After any TypeScript change: `bun oxc && bun typecheck`. Every commit ends with `bun check && bun run test` green.
- `packages/core` stays dependency-free and pure: no React, no DOM, no React Native. `packages/core/tsconfig.json` keeps `lib: ["ES2023"]`.
- Worker never imports the theme.
- Every colour is authored **in `oklch`**, including alpha (`oklch(… / 10%)`). No hex, no `rgba()` in core.
- Tailwind only sees **static** class names. Never build tones by interpolation (`bg-${hue}-500/10` is never scanned). Computed tones go through CSS vars or inline `style`.
- Canonical values (unified deliberately, before/after screenshotted in the PR):
  - `destructive` = web's current oklch: light `oklch(0.577 0.245 27.325)`, dark `oklch(0.704 0.191 22.216)`.
  - Form W/D/L = `#16a34a` / `#d97706` / `#dc2626` (draw = amber) everywhere, both platforms.
  - `glowIntensity = 0.1`.
  - Avatar palette = web's 12-hue order at Tailwind 500/600 values.
  - Streak `fire` = web's 4-stop ramp `#ffcc00 #ff6a00 #ff8c00 #ff4500`.
- Semantic token **values** are today's `apps/web/src/index.css` values verbatim (`:root` light, `.dark` dark) — do not re-pick them.
- Migration is mechanical: adopt existing values, do not "improve" hues while moving them.
- App UI text is unchanged; no `@ts-expect-error` / `@ts-ignore`; no redundant comments.

## Review Focus

These are covered by a named test in the owning task; the task's tests must include them.

1. **Renaming a mobile key but missing a call site** — a stale `theme.surface` must fail compilation, not render `undefined`. Owned by Task 4 (`bun typecheck` is the test).
2. **A token added to `themes.light` but forgotten in `themes.dark`** — the tree must be recursive-key-identical. Owned by Task 1.
3. **A mobile value RN cannot parse** (`oklch` leaking to a native style prop) — every emitted mobile value must be a `#rrggbb`/`#rrggbbaa` string. Owned by Tasks 1 + 4.
4. **Web renders transparent colours because the adapter never ran** — `applyThemeTokens` must run before first render, and the injected rule must contain `--background`. Owned by Task 3.
5. **An out-of-gamut `oklch` producing a garbage hex** (e.g. `oklch(0.7 0.4 30)`) — the converter must clamp channels, never emit `NaN` or `-` prefixed bytes. Owned by Task 1.

---

### Task 1: `core/theme` — converter, token tree, CSS var map

**Files:**

- Create: `packages/core/src/theme/oklch.ts`, `packages/core/src/theme/palette.ts`, `packages/core/src/theme/tokens.ts`, `packages/core/src/theme/css-vars.ts`, `packages/core/src/theme/index.ts`
- Create: `packages/core/src/theme/oklch.spec.ts`, `packages/core/src/theme/tokens.spec.ts`, `packages/core/src/theme/css-vars.spec.ts`
- Modify: `packages/core/package.json`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `oklchToHex(value: string): string | null`
  - `withAlpha(value: string, alpha: number): string`
  - `palette: Record<string, Record<string, string>>`
  - `themes: { light: ThemeTokens; dark: ThemeTokens }`
  - `glowIntensity: 0.1`
  - `themeCssVars(mode: "light" | "dark"): Record<string, string>`
  - Subpath export `@coding-cowboys/scorebrawl-core/theme`.

- [ ] **Step 1: Write the failing converter test** — `oklch.spec.ts`

```ts
import { describe, expect, it } from "vitest";
import { oklchToHex, withAlpha } from "./oklch";

describe("oklchToHex", () => {
	it("converts white and black", () => {
		expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
		expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
	});
	it("converts a chromatic value close to the historical hex", () => {
		expect(oklchToHex("oklch(0.577 0.245 27.325)")).toMatch(/^#e[0-9a-f]000[0-9a-f]$/);
	});
	it("carries alpha into an 8-digit hex", () => {
		expect(oklchToHex("oklch(1 0 0 / 10%)")).toBe("#ffffff1a");
	});
	it("clamps out-of-gamut channels instead of emitting NaN", () => {
		expect(oklchToHex("oklch(0.7 0.4 30)")).toMatch(/^#[0-9a-f]{6}$/);
	});
	it("returns null for unparseable input", () => {
		expect(oklchToHex("#fff")).toBeNull();
		expect(oklchToHex("rgb(1,2,3)")).toBeNull();
	});
});

describe("withAlpha", () => {
	it("appends a percentage alpha", () => {
		expect(withAlpha("oklch(0.5 0.1 200)", 0.1)).toBe("oklch(0.5 0.1 200 / 10%)");
	});
	it("replaces an existing alpha", () => {
		expect(withAlpha("oklch(0.5 0.1 200 / 5%)", 0.25)).toBe("oklch(0.5 0.1 200 / 25%)");
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun --cwd packages/core test oklch`
Expected: FAIL — cannot resolve `./oklch`.

- [ ] **Step 3: Implement `oklch.ts`**

`oklchToHex` must: match `oklch(<L> <C> <H>[ / <A>%?])` with numbers or percentages for L; return `null` otherwise. Convert oklch → oklab (`a = C·cos(H)`, `b = C·sin(H)`), oklab → linear sRGB with the standard LMS matrix and its inverse:

```
l_ = L + 0.3963377774*a + 0.2158037573*b
m_ = L - 0.1055613458*a - 0.0638541728*b
s_ = L - 0.0894841775*a - 1.2914855480*b
l = l_^3, m = m_^3, s = s_^3
r = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
b = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
```

then gamma-encode (`c <= 0.0031308 ? 12.92c : 1.055c^(1/2.4) - 0.055`), clamp each channel to `[0, 1]`, round to 8 bits, lowercase hex. Alpha (default 1) becomes `Math.round(alpha * 255)` and is appended as two hex digits **only when alpha < 1**. Round-trip must not throw on any input.

`withAlpha(value, alpha)` returns `value` with its `/ …` suffix replaced by ` / <alpha*100>%` (strip any existing suffix first, then append).

- [ ] **Step 4: Run the converter test — expect PASS**

Run: `bun --cwd packages/core test oklch`

- [ ] **Step 5: Author the palette** — `palette.ts`

`export const palette` with exactly the `(hue, step)` pairs listed in the spec's table (18 hues), each value an `oklch(...)` string copied from Tailwind v4's default palette. Also export `export type PaletteHue = keyof typeof palette;`.

- [ ] **Step 6: Author the token tree** — `tokens.ts`

`themes.light` / `themes.dark` share one shape:

- **semantic**: copy every `:root` (light) and `.dark` (dark) declaration from `apps/web/src/index.css` verbatim, camel-cased (`--card-foreground` → `cardForeground`, `--chart-1` → `chart1`, `--sidebar-ring` → `sidebarRing`). All 29 keys per mode.
- **chrome** (values verbatim from `apps/mobile/src/constants/theme.ts`): `buttonPrimary`, `backgroundSelected`, `segmentTrack`, `segmentThumb`, `segmentThumbBorder`, `splashBackground`.
- **`glow`** — one entry per tone `red, blue, emerald, amber, purple, pink`, each `{ text, solid, background, border, radial }`. `text`/`solid` are the tone's Tailwind 600/500 hue; web's current values are in `apps/web/src/routes/-components/ui/glow-button.tsx:76-107` and mobile's in `apps/mobile/src/constants/theme.ts:20-25,45-50`. light `background`/`border` = `solid` at 10%/20%, dark = `solid` at 20%/30% (matching today's classes). `radial` = `withAlpha(solid, glowIntensity)` in both modes.
- **`role`** — `owner, editor, member, viewer`, each `{ text, solid }`. Values verbatim from `apps/mobile/src/app/(drawer)/(stack)/members.tsx:37-42` (per mode: the `light`/`dark` pair become `text`/`solid`).
- **`divider`** — `oklch(... / 25%)` mid-grey and `dividerBorder` — `oklch(... / 30%)` mid-grey, identical both modes; `overlay` = `oklch(0 0 0 / 50%)`, `overlaySoft` = `oklch(0 0 0 / 40%)`.
- Spread the shared `domain` const (authored once, identical in both modes) into each mode:
  - `form: { win, draw, loss }` — `#16a34a` / `#d97706` / `#dc2626` as oklch.
  - `seasonStatus`, `invitationStatus`, `scoreType`: each key `{ text, solid }`. Web's per-key values are in `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/index.tsx:70-111` and `invitations.tsx:237-250`; use web's `text-<hue>-600` as `text` and `bg-<hue>-500` as `solid` (for `scoreType` web uses 500 for both, so `text === solid`).
  - `chartSeries: { a, b }` — `#3b82f6`, `#f43f5e`.
  - `avatar`: 12 × `{ background, text, border }` — web's 12 Tailwind triples in `apps/web/src/routes/-components/ui/avatar-with-fallback.tsx:51-64` resolved to oklch (500 at 10% / 600 / 500 at 20%).
  - `streak: { fire, ice }` — `fire` = web's 4 stops from `apps/web/src/routes/-components/streak-avatar.tsx:126-136`; `ice` = mobile's 5 stops from `apps/mobile/src/components/streak-avatar.tsx:407`.
  - `warning` = `#d97706`; `link` = `#3c87f7`; `brandFrom` = `#3c9ffe`; `brandTo` = `#0274df`; `faint` = `#9ca3af`.

Export `export const glowIntensity = 0.1;`, `export type ThemeMode = "light" | "dark";`, `export type ThemeTokens` (the mode record shape), and `export type GlowTone = keyof ThemeTokens["glow"]`.

- [ ] **Step 7: Write the parity + shape test** — `tokens.spec.ts`

```ts
it("has identical key paths in light and dark", () => {
	expect(leafPaths(themes.light)).toEqual(leafPaths(themes.dark));
});
it("authors nothing in hex or rgba", () => {
	for (const value of leafValues(themes.light)) {
		expect(value).toMatch(/^oklch\(/);
	}
});
it("derives glow radial from glowIntensity", () => {
	expect(themes.dark.glow.blue.radial).toBe(withAlpha(themes.dark.glow.blue.solid, 0.1));
});
```

`leafPaths`/`leafValues` are local recursive helpers (arrays keep their index as a path segment).

- [ ] **Step 8: Implement the CSS var walker** — `css-vars.ts` + `css-vars.spec.ts`

`themeCssVars(mode)` walks `themes[mode]` recursively and returns `{ "--<kebab-path>": value }`, where array indices become the index (`--avatar-0-background`). An explicit `RENAMES` map handles the irregular names: `chart1..chart5` → `chart-1..chart-5`; `scoreType.threeOneZero` → `score-type-three-one-zero`. Test:

```ts
it("emits a var for every leaf", () => {
	const vars = themeCssVars("light");
	expect(Object.keys(vars).length).toBe(leafPaths(themes.light).length);
});
it("spot-checks irregular names", () => {
	const vars = themeCssVars("light");
	expect(vars["--chart-1"]).toBe(themes.light.chart1);
	expect(vars["--avatar-0-background"]).toBe(themes.light.avatar[0].background);
	expect(vars["--glow-blue-radial"]).toBe(themes.light.glow.blue.radial);
});
it("emits the same var names for both modes", () => {
	expect(Object.keys(themeCssVars("light"))).toEqual(Object.keys(themeCssVars("dark")));
});
it("exposes every palette ramp separately", () => {
	expect(paletteVars()["--blue-500"]).toBe(palette.blue["500"]);
});
```

Export two pure functions: `themeCssVars(mode)` (tree only) and `paletteVars()` (ramps only, mode-invariant). Keeping them separate makes the leaf-count assertion exact; the client merges them.

- [ ] **Step 9: Wire exports**

`packages/core/src/theme/index.ts` re-exports `oklch.ts`, `palette.ts`, `tokens.ts`, `css-vars.ts`. Add to `packages/core/package.json` `exports`: `"./theme": "./src/theme/index.ts"`.

- [ ] **Step 10: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`
Expected: all green.

```bash
git add packages/core
git commit -m "feat(core): shared theme token tree + oklch converter"
```

---

### Task 2: `client/theme` — web adapter

**Files:**

- Create: `packages/client/src/theme/index.ts`, `packages/client/src/theme/css.ts`, `packages/client/src/theme/apply.ts`, `packages/client/src/theme/css.spec.ts`, `packages/client/src/theme/apply.spec.ts`
- Modify: `packages/client/package.json` (`exports`), `packages/client/src/index.ts`

**Interfaces:**

- Consumes: `themeCssVars(mode)` from Task 1.
- Produces:
  - `themeDeclarations(mode: ThemeMode): Record<string, string>`
  - `themeCssRules(): string` — both rules, light then dark
  - `applyThemeTokens(doc?: Document): void`
  - Subpath export `@coding-cowboys/scorebrawl-client/theme`. `ThemeMode` is imported as a type from `@coding-cowboys/scorebrawl-core/theme`.

- [ ] **Step 1: Write the failing CSS test** — `css.spec.ts`

```ts
it("declares light vars on :root and dark vars on :root.dark", () => {
	const css = themeCssRules();
	expect(css).toContain(":root{");
	expect(css).toContain(":root.dark{");
	expect(css).toContain("--background:");
	expect(css).toContain("--blue-500:");
	expect(css).toContain("--glow-blue-solid:");
});
it("re-exports the full token var set", () => {
	expect(Object.keys(themeDeclarations("light"))).toEqual(Object.keys(themeDeclarations("dark")));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun --cwd packages/client test css`
Expected: FAIL — cannot resolve `./css`.

- [ ] **Step 3: Implement `themeDeclarations` and `themeCssRules`**

`themeDeclarations(mode: ThemeMode)` = `{ ...paletteVars(), ...themeCssVars(mode) }`, importing `ThemeMode` as a type from `@coding-cowboys/scorebrawl-core/theme` (the walker guarantees no token can be omitted). `themeCssRules()` serialises `:root{${decls("light")}}:root.dark{${decls("dark")}}` with one `prop:value;` per declaration.

- [ ] **Step 4: Run the CSS test — expect PASS**

Run: `bun --cwd packages/client test css`

- [ ] **Step 5: Write the failing apply test** — `apply.spec.ts`

Use a minimal fake document (vitest env is `node`, no `document`):

```ts
function fakeDoc() {
	const nodes: Array<{ id: string; textContent: string }> = [];
	return {
		head: {
			querySelector: (sel: string) => nodes.find((n) => sel.includes(n.id)) ?? null,
			appendChild: (n: { id: string; textContent: string }) => void nodes.push(n),
		},
		createElement: () => ({ id: "", textContent: "" }),
		nodes,
	};
}
it("is idempotent", () => {
	const doc = fakeDoc();
	applyThemeTokens(doc as unknown as Document);
	applyThemeTokens(doc as unknown as Document);
	expect(doc.nodes).toHaveLength(1);
	expect(doc.nodes[0].textContent).toContain("--background:");
	expect(doc.nodes[0].textContent).toContain(":root.dark{");
});
```

- [ ] **Step 6: Implement `applyThemeTokens`**

Look up `#scorebrawl-theme` in `doc.head`; if absent create a `style` element with that id, set `textContent = themeCssRules()`, and append it. If present, update `textContent`. Default parameter `doc: Document = document`.

- [ ] **Step 7: Wire exports and subpath**

Add `"theme"` to `packages/client/package.json` `exports` (`"./theme": "./src/theme/index.ts"`). Do **not** re-export `theme` from `packages/client/src/index.ts` — it is browser-only and must stay off the React Native import graph.

- [ ] **Step 8: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add packages/client
git commit -m "feat(client): web theme adapter (CSS custom properties)"
```

---

### Task 3: Web consumes the tokens

**Files:**

- Modify: `apps/web/src/index.css` (remove `:root` + `.dark` literal blocks; extend `@theme inline`)
- Modify: `apps/web/src/main.tsx`
- Create: `packages/client/src/theme/index-css.spec.ts`

**Interfaces:**

- Consumes: `applyThemeTokens` (Task 2).
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing guard test** — `packages/client/src/theme/index-css.spec.ts`

Reads the file relative to the test: `new URL("../../../../apps/web/src/index.css", import.meta.url)`.

```ts
it("authors no literal colours in web index.css", () => {
	const css = readFileSync(new URL("../../../../apps/web/src/index.css", import.meta.url), "utf8");
	const body = css.replace(/@theme inline\s*\{[\s\S]*\}/, "");
	expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
	expect(body).not.toMatch(/\b(oklch|rgb|rgba|hsl)\(/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun --cwd packages/client test index-css`
Expected: FAIL — index.css still contains literal `oklch(...)`.

- [ ] **Step 3: Rewrite `index.css`**

Delete the `:root { … }` and `.dark { … }` blocks entirely. Keep `--radius` under `:root` (spacing is out of scope) and `--font-sans` in `@theme inline` (typography is out of scope). Extend `@theme inline` with the ramp mappings for the 62 pairs from the spec's table:

```css
@theme inline {
	/* …existing --color-* semantic mappings… */
	--color-blue-500: var(--blue-500);
	--color-red-500: var(--red-500);
	/* …one line per (hue, step) in the spec's table… */
}
```

Keep `@custom-variant dark (&:is(.dark *))` and the `@layer base` block unchanged.

- [ ] **Step 4: Wire `main.tsx`**

Add `import { applyThemeTokens } from "@coding-cowboys/scorebrawl-client/theme";` and call `applyThemeTokens();` immediately after the `index.css` import and **before** `createRoot(...).render(...)`.

- [ ] **Step 5: Run the guard test — expect PASS**

Run: `bun --cwd packages/client test index-css`

- [ ] **Step 6: Verify no visual regression (manual)**

Run: `bun dev`, open `https://scorebrawl.localhost:1355`, log in as `seed@example.com`. Use the **agent-browser** skill. Check: dashboard, a season page, a session, and the dark/light toggle. Assert backgrounds, cards, borders and `bg-blue-500/10`-style badges render (not transparent). Capture before/after screenshots for the PR.

- [ ] **Step 7: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add apps/web packages/client
git commit -m "refactor(web): source CSS variables + ramps from shared tokens"
```

---

### Task 4: Mobile shaper + key rename

**Files:**

- Create: `packages/core/src/theme/mobile.ts`, `packages/core/src/theme/mobile.spec.ts`
- Modify: `packages/mobile/src/constants/theme.ts` → `apps/mobile/src/constants/theme.ts`
- Modify: `apps/mobile/src/components/session/theme.ts`, `apps/mobile/src/app/(drawer)/(stack)/members.tsx:258`
- Modify: every mobile file with a renamed `theme.*` key (see Step 6)

**Interfaces:**

- Consumes: `themes`, `oklchToHex` (Task 1).
- Produces: `toMobileColors(mode: ThemeMode): MobileColors` where `MobileColors` is a flat `Record<string, string>` of hex values, plus `mobileColorKeys: readonly string[]`.

- [ ] **Step 1: Write the failing shaper test** — `mobile.spec.ts`

```ts
it("emits only 6-digit hex (no oklch may reach React Native)", () => {
	for (const mode of ["light", "dark"] as const) {
		for (const value of Object.values(toMobileColors(mode))) {
			expect(value).toMatch(/^#[0-9a-f]{6,8}$/);
		}
	}
});
it("exposes the same keys for both modes", () => {
	expect(Object.keys(toMobileColors("light"))).toEqual(Object.keys(toMobileColors("dark")));
});
it("carries the unified destructive and form values", () => {
	expect(toMobileColors("dark").destructive).toMatch(/^#/);
	expect(toMobileColors("light").formWin).toBe("#16a34a");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun --cwd packages/core test mobile`
Expected: FAIL — cannot resolve `./mobile`.

- [ ] **Step 3: Implement `toMobileColors`**

Walk `themes[mode]` and convert every leaf with `oklchToHex`, flattening to kebab→camel keys. Keys are the **core names**: `foreground`, `background`, `muted`, `mutedForeground`, `card`, `cardForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `accent`, `accentForeground`, `destructive`, `border`, `input`, `ring`, `chart1`…`chart5`, `sidebar*`, then `buttonPrimary`, `backgroundSelected`, `segmentTrack`, `segmentThumb`, `segmentThumbBorder`, `splashBackground`, `divider`, `dividerBorder`, `overlay`, `overlaySoft`, `faint`, `formWin`/`formDraw`/`formLoss`, `seasonStatusActiveText`/`…Solid`, `invitationStatus*`, `scoreTypeEloText`/`scoreTypeEloSolid`, …, `glowBlueText`/`glowBlueSolid`/`glowBlueBackground`/`glowBlueBorder`, `roleOwnerText`/`roleOwnerSolid`, …, `avatar0Background`/`avatar0Text`/`avatar0Border`, …, `streakFire0`…, `warning`, `link`, `brandFrom`, `brandTo`. Export `mobileColorKeys`.

- [ ] **Step 4: Run the shaper test — expect PASS**

Run: `bun --cwd packages/core test mobile`

- [ ] **Step 5: Rewrite `apps/mobile/src/constants/theme.ts`**

```ts
import { toMobileColors } from "@coding-cowboys/scorebrawl-core/theme";

export const Colors = {
	light: { ...toMobileColors("light"), mode: "light" as const, isDark: false },
	dark: { ...toMobileColors("dark"), mode: "dark" as const, isDark: true },
} as const;
```

Keep `ThemeColor`, `Fonts`, `Spacing`, `MaxContentWidth` as they are. `useTheme()` keeps returning `Colors[resolved]`.

- [ ] **Step 6: Rename keys at the call sites**

Apply these mechanical renames across `apps/mobile/src` (only `theme.` and `Colors.<mode>.` accesses):

| Old                       | New                                |
| ------------------------- | ---------------------------------- |
| `theme.text`              | `theme.foreground`                 |
| `theme.textSecondary`     | `theme.mutedForeground`            |
| `theme.surface`           | `theme.card`                       |
| `theme.backgroundElement` | `theme.muted`                      |
| `theme.glowBlueBg`        | `theme.glowBlueBackground`         |
| `theme.glowBlueText`      | `theme.glowBlueText` (unchanged)   |
| `theme.glowBlueBorder`    | `theme.glowBlueBorder` (unchanged) |
| `theme.amberBg`           | `theme.glowAmberBackground`        |
| `theme.amberText`         | `theme.glowAmberText`              |
| `theme.amberBorder`       | `theme.glowAmberBorder`            |
| `theme.destructive`       | unchanged                          |

`backgroundSelected`, `segmentTrack`, `segmentThumb`, `segmentThumbBorder`, `splashBackground`, `primary`, `primaryForeground`, `border` keep their names.

- [ ] **Step 7: Delete both colour-string comparisons**

`apps/mobile/src/components/session/theme.ts`: replace `const isDark = theme.background === Colors.dark.background;` with `const isDark = theme.isDark;` (keep the light/dark branches). `apps/mobile/src/app/(drawer)/(stack)/members.tsx:258`: replace `theme.text === "#ffffff" ? "dark" : "light"` with `theme.mode`.

- [ ] **Step 8: Verify (typecheck is the test) and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`
Expected: green; the rename is proven complete because a missed key fails `tsgo`.

```bash
git add apps/mobile packages/core
git commit -m "refactor(mobile): source Colors from shared tokens, rename keys, explicit mode"
```

---

### Task 5: Unify form / status / role / score-type / divider / misc literals

**Files:**

- Modify: `packages/core/src/presentation/standings.ts` (`FORM_COLORS` derived from the token)
- Modify (web): `routes/-components/ui/form-dots.tsx`, `.../season/form-bar.tsx`, `.../winner-stays/queue-panel.tsx`, `.../session/-components/score-stepper.tsx`, `.../season/dashboard-cards.tsx`, `players/$leaguePlayerId/index.tsx`, `teams/$teamId/index.tsx`, `session/$sessionId/summary.tsx`, `.../season/weekly-performers.tsx`, `.../seasons/index.tsx`, `.../invitations.tsx`, `.../admin/leagues/-components/admin-leagues-page.tsx`, `.../admin/users/-components/admin-users-page.tsx`
- Modify (mobile): `components/standing-row.tsx`, `components/season-standings.tsx`, `components/season-team-standings.tsx`, `components/session/standings-tab.tsx`, `components/session/queue-tab.tsx`, `components/session/session-config-modal.tsx`, `components/player/player-compare.tsx`, `components/player/player-detail.tsx`, `components/session/session-summary.tsx`, `components/score-type-card.tsx`, `app/(drawer)/(stack)/seasons/index.tsx`, `app/(drawer)/(stack)/invitations.tsx`, `app/(drawer)/(stack)/members.tsx`, `components/latest-matches.tsx`, `components/user-card.tsx`, `components/ui/skeleton-rows.tsx`, `components/create-league-form.tsx`, `components/create-season-form.tsx`, `components/session-history.tsx`, `app/settings/notifications.tsx`, `components/create-match-modal.tsx`, `components/record-game-modal.tsx`, `components/themed-text.tsx`, `components/animated-icon.tsx`

**Interfaces:**

- Consumes: `themeCssVars` (Task 1), `themes`/`toMobileColors` (Tasks 1, 4).
- Produces: `FORM_COLORS` keeps its `Record<StandingFormResult, string>` hex shape.

- [ ] **Step 1: Derive `FORM_COLORS` from the token** — `packages/core/src/presentation/standings.ts`

Replace the literal map with `oklchToHex`-converted `domain.form` values. Add a spec assertion in `standings.spec.ts`:

```ts
it("pins the unified form triple", () => {
	expect(FORM_COLORS).toEqual({ W: "#16a34a", D: "#d97706", L: "#dc2626" });
});
```

- [ ] **Step 2: Run the core test**

Run: `bun --cwd packages/core test standings`
Expected: PASS.

- [ ] **Step 3: Point web at the tokens**

- `form-dots.tsx` / `form-bar.tsx`: replace the `colorClasses` maps with CSS-var-backed inline styles (`background: var(--form-win)`, etc.). Keep the W/D/L keys and the existing `shadow-[…rgba()]` glow only if it resolves to a token; otherwise use `boxShadow: \`0 0 8px ${var(--form-win)}\``.
- `queue-panel.tsx` / `score-stepper.tsx` `dotColor`: draw becomes `var(--form-draw)` (was `bg-yellow-500`).
- `matchResultsConfig` in `players/$leaguePlayerId/index.tsx:57-65`, `teams/$teamId/index.tsx:93-101`, `session/$sessionId/summary.tsx:53-55`: replace the hex triple with `var(--form-win|draw|loss)` (draw was gray → amber).
- `seasons/index.tsx` `getScoreTypeColor`/`getScoreTypeBgColor`/`getStatusColor`, `invitations.tsx` `getStatusColor`: replace class string maps with inline styles from `var(--score-type-*)` / `var(--season-status-*)` / `var(--invitation-status-*)`.
- `admin-leagues-page.tsx:61-70`, `admin-users-page.tsx:51-60`: replace the 8-entry class array with an inline-style array from `var(--chart-*)`/`--glow-*` tones.
- `dashboard-cards.tsx`, `session-dashboard-cards.tsx`, `weekly-performers.tsx`: replace `iconColor="text-red-600"` with `iconColor="var(--glow-red-text)"`. The `glowColor` gradient prop moves in Task 7, not here.
- `themed-text.tsx:66`: `#3c87f7` → `var(--link)`. `animated-icon.tsx:144` + `animated-icon.module.css:2`: `#3C9FFE`/`#0274DF` → `var(--brand-from)`/`var(--brand-to)`.

- [ ] **Step 4: Point mobile at the tokens**

- `standing-row.tsx:22` (`#16a34a`/`#dc2626`), `:143`/`:148` (`rgba(128,128,128,…)`), `:169` (`#9CA3AF`): use `theme.formWin`/`theme.formLoss`, `theme.divider`, `theme.faint`.
- `season-standings.tsx:84`, `season-team-standings.tsx:80`, `session/standings-tab.tsx:146`, `latest-matches.tsx:335`, `user-card.tsx:136`, `ui/skeleton-rows.tsx:119`, `create-league-form.tsx:224`, `create-season-form.tsx:380`, `session-history.tsx:101`, `app/settings/notifications.tsx:177`, `players/index.tsx:433,488`, `teams.tsx:310,347`, `seasons/index.tsx:605,648,716`, `invitations.tsx:490,508,573`, `members.tsx:397,421,441`: `rgba(128,128,128,0.25|0.3)` → `theme.divider`; `0.4` backdrops → `theme.dividerBorder`; `0.6` placeholder → `theme.faint`.
- `queue-tab.tsx:28` `DOT_COLORS` and `player-compare.tsx:263-266`: draw → `theme.formDraw`, win/loss → `theme.formWin`/`theme.formLoss`.
- `player-detail.tsx:89,411`, `session-summary.tsx:159`: `#22c55e`/`#ef4444` → `theme.formWin`/`theme.formLoss`.
- `score-type-card.tsx:19-38` `SCORE_TYPE_CONFIG`, `seasons/index.tsx:46-93` (status + score type): → `theme.scoreType*` / `theme.seasonStatus*`.
- `invitations.tsx:43-63` `STATUS_CONFIG` → `theme.invitationStatus*`.
- `members.tsx:37-42` `ROLE_COLORS` → `theme.role*Text`/`theme.role*Solid` (drop the local light/dark pair; `theme.mode` already selects).
- `create-match-modal.tsx:432,723`, `record-game-modal.tsx:260,353`: `#d97706` → `theme.warning`.
- `session-config-modal.tsx:272` (`#10b981`) → `theme.scoreTypeEloSolid`; `next-match-tab.tsx:1036` + `session-config-modal.tsx:802` (`rgba(0,0,0,0.4)`) → `theme.overlaySoft`; `(drawer)/_layout.tsx:15` + `league-switcher.tsx:184` (`rgba(0,0,0,0.5)`) → `theme.overlay`.

- [ ] **Step 5: Verify no literals remain**

Run: `rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/mobile/src apps/web/src --glob '!**/*.css' --glob '!**/streak-avatar.tsx'`
Expected: only hits inside `apps/web/src/routes/-components/ui/chart.tsx` (moved in Task 8) and `streak-avatar.tsx` (Task 8). Every other hit must be resolved here using the tokens authored in Task 1 — do not leave a literal behind.

- [ ] **Step 6: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add apps/web apps/mobile packages/core
git commit -m "refactor(theme): unify form/status/role/score-type/invitation/divider tokens"
```

---

### Task 6: Avatar palette + name-colour selector

**Files:**

- Create: `packages/core/src/theme/avatar.ts`, `packages/core/src/theme/avatar.spec.ts`
- Modify: `packages/core/src/theme/index.ts`
- Modify: `apps/web/src/routes/-components/ui/avatar-with-fallback.tsx`, `apps/mobile/src/components/avatar.tsx`

**Interfaces:**

- Consumes: `themes.light.avatar`, `oklchToHex`.
- Produces:
  - `AVATAR_TONE_COUNT: number`
  - `selectAvatarIndex(name: string): number` — `-1` means "no tones apply" (empty name), so callers can pick their gray.
  - `avatarTones(mode: ThemeMode): Array<{ background: string; text: string; border: string }>` (hex)

- [ ] **Step 1: Write the failing selector test** — `avatar.spec.ts`

```ts
it("is deterministic and in range", () => {
	const i = selectAvatarIndex("Ada Lovelace");
	expect(i).toBe(selectAvatarIndex("Ada Lovelace"));
	expect(i).toBeGreaterThanOrEqual(0);
	expect(i).toBeLessThan(AVATAR_TONE_COUNT);
});
it("normalises case and whitespace", () => {
	expect(selectAvatarIndex("  ada   lovelace ")).toBe(selectAvatarIndex("ada lovelace"));
});
it("returns -1 for an empty name", () => {
	expect(selectAvatarIndex("   ")).toBe(-1);
});
it("never emits oklch", () => {
	for (const tone of avatarTones("dark")) {
		expect(tone.text).toMatch(/^#[0-9a-f]{6}$/);
	}
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun --cwd packages/core test avatar`
Expected: FAIL — cannot resolve `./avatar`.

- [ ] **Step 3: Implement `avatar.ts`**

Lift web's `getNameColor` hash verbatim (`apps/web/src/routes/-components/ui/avatar-with-fallback.tsx:33-49`) into `selectAvatarIndex`: trim, lowercase, collapse whitespace, djb2 (`hash = (hash << 5) - hash + charCode`, `hash &= hash`), `Math.abs(hash) % AVATAR_TONE_COUNT`; return `-1` when the normalised name is empty. `avatarTones(mode)` maps `themes[mode].avatar` through `oklchToHex` (throwing if a token fails to convert, so a bad token is loud).

- [ ] **Step 4: Run the avatar test — expect PASS**

Run: `bun --cwd packages/core test avatar`

- [ ] **Step 5: Consume on web**

`avatar-with-fallback.tsx`: delete the local `colors` class-triple array and `getNameColor`; import `selectAvatarIndex` from core. Apply the tone via inline `style` using `var(--avatar-<index>-background|text|border)`; when `selectAvatarIndex` returns `-1`, use `var(--divider)` background / `var(--muted-foreground)` text. Keep the existing initials logic.

- [ ] **Step 6: Consume on mobile**

`avatar.tsx`: delete `NAME_COLORS` and `GRAY`; import `selectAvatarIndex` + `avatarTones`. Fall back to `theme.divider`/`theme.mutedForeground` for `-1`.

- [ ] **Step 7: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add packages/core apps/web apps/mobile
git commit -m "refactor(theme): share avatar palette + name-colour selector"
```

---

### Task 7: Tokenize glow

**Files:**

- Modify: `apps/web/src/routes/-components/ui/glow-button.tsx`, `apps/web/src/routes/-components/ui/glow-toggle.tsx`
- Modify: `apps/web/src/routes/.../season/dashboard-card.tsx`, `dashboard-cards.tsx`, `session/-components/session-dashboard-cards.tsx`, `season/weekly-performers.tsx`, and every `bg-[radial-gradient(…)]` usage (list from the spec's inventory)
- Modify: `apps/mobile/src/components/ui/card-glow.tsx`, `apps/mobile/src/components/ui/button.tsx`, and mobile `glowBlue*` consumers (`date-field.tsx:121`, `create-match-modal.tsx:234,456,457,464,568,588`, `record-game-modal.tsx:237,238,245`, `season/season-dashboard.tsx:152`, `nav/header-buttons.tsx:64`, `seasons/index.tsx:304,307`)

**Interfaces:**

- Consumes: `themes[mode].glow`, `glowIntensity`, `toMobileColors`.
- Produces: `glowColorVars: Record<GlowTone, { background: string; text: string; border: string }>` on web (values are `var(...)` expressions).

- [ ] **Step 1: Add a `cardGlowStyle(tone)` helper**

Export from `apps/web/src/routes/-components/ui/glow-button.tsx` (or a sibling `glow-tokens.ts`) `cardGlowStyle(tone: GlowTone): { backgroundImage: string }` returning `radial-gradient(circle at top right, var(--glow-<tone>-radial), transparent 60%)`.

- [ ] **Step 2: Convert `glow-button.tsx`**

Replace the `glowColors` class-string maps with `glowColorVars` whose values are `var(--glow-<tone>-background|text|border)`, and apply them through `style={{ backgroundColor, color, borderColor }}` instead of `cn(...)` class strings. Keep the tone keys and the `GlowButtonProps.glowColor` object shape `{ background, text, border }`. Keep the string-format branch (`text-foreground` default) as `color: "var(--foreground)"`.

- [ ] **Step 3: Convert web radial glows**

`dashboard-card.tsx`: change the `glowColor?: string` prop to `glowStyle?: CSSProperties` and render `style={glowStyle}` on the overlay div. Update `dashboard-cards.tsx`, `session-dashboard-cards.tsx`, `weekly-performers.tsx`, and every other `bg-[radial-gradient(…)]` call site to pass `cardGlowStyle("<tone>")`. This removes the interpolated class strings entirely.

- [ ] **Step 4: Convert mobile `CardGlow` and button glow**

`card-glow.tsx`: default `intensity = glowIntensity` (import from core), and have callers pass `color={theme.glowBlueSolid}` (already-hex, RN-safe). `button.tsx` glow variant: `glowBlueBackground` / `glowBlueBorder` / `glowBlueText` (already renamed in Task 4; verify they resolve to the glow tokens). Update the remaining `glowBlue*` consumers listed above.

- [ ] **Step 5: Verify no `rgba(` remains in glow code**

Run: `rg -n "rgba?\(" apps/web/src/routes/-components/ui apps/mobile/src/components/ui`
Expected: no matches.

- [ ] **Step 6: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add apps/web apps/mobile
git commit -m "refactor(theme): tokenize glow (web + mobile) + glowIntensity"
```

---

### Task 8: Share streak ramps

**Files:**

- Modify: `apps/web/src/routes/-components/streak-avatar.tsx`, `apps/mobile/src/components/streak-avatar.tsx`, `packages/.../ui/chart.tsx`

**Interfaces:**

- Consumes: `themes[mode].streak` (Task 1).
- Produces: nothing consumed later.

- [ ] **Step 1: Replace literal ramps with token reads**

Both `streak-avatar.tsx` files: replace the fire/ice literal arrays and gradient stops with reads from the shared `streak` tokens (web via `var(--streak-fire-<i>)`, mobile via `theme.streakFire<i>`). The web comet config (`#ffcc00 #ff6a00 #ff8c00 #ff4500`) is canonical; keep the surrounding animation logic untouched. `ui/chart.tsx:56` (`#ccc`/`#fff`): replace with `var(--muted-foreground)` / `var(--foreground)`.

- [ ] **Step 2: Verify no literals remain**

Run: `rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/web/src apps/mobile/src --glob '!**/*.css'`
Expected: no matches.

- [ ] **Step 3: Verify and commit**

Run: `bun oxc && bun typecheck && bun check && bun run test`

```bash
git add apps/web apps/mobile
git commit -m "refactor(theme): share streak ramps"
```

---

## Final verification (before PR)

- [ ] `bun check && bun run test` green.
- [ ] `rg -n "oklch\(" apps/mobile/src` returns nothing outside `node_modules`.
- [ ] `rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/web/src apps/mobile/src --glob '!**/*.css'` returns nothing.
- [ ] `rg -n "=== *.dark\.|=== \"#ffffff\"|theme\.background ===" apps/mobile/src` returns nothing.
- [ ] `rg -n "@coding-cowboys/scorebrawl-core/theme|scorebrawl-client/theme" apps/worker/src` returns nothing.
- [ ] Web screenshots (agent-browser at `https://scorebrawl.localhost:1355`) before/after for: destructive, form draw dots, avatar tones, streak fire, card glow. Attach to the PR.
- [ ] Mobile screenshots via `expo start --web` for the same five (note the RN-web caveat in the PR).
