# Claude Code Guidelines for Scorebrawl

## Package Manager

**Use Bun for everything except Cloudflare/Wrangler:**

- `bun install` - install dependencies
- `bun add <package>` - add packages
- `bun remove <package>` - remove packages
- `bunx <command>` - execute packages
- `bun run <script>.ts` - run TypeScript scripts
- **Exception:** Use `npx` for Cloudflare and Wrangler commands

## Running Tests and Builds

**Always use `bun run` for these commands:**

- `bun run test` - run tests (NOT `bun test`)
- `bun run build` - build the project (NOT `bun build`)

## After TypeScript Changes

Always run: `bun flint && bun typecheck`
