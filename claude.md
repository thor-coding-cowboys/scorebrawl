# Claude Code Guidelines for Scorebrawl

## Package Manager

**Use Bun for everything except Cloudflare/Wrangler:**

- `bun install` - install dependencies
- `bun add <package>` - add packages
- `bun remove <package>` - remove packages
- `bunx <command>` - execute packages
- `bun run <script>.ts` - run TypeScript scripts
- **Exception:** Use `npx` for Cloudflare and Wrangler commands

## After TypeScript Changes

Always run: `bun flint && bun typecheck`
