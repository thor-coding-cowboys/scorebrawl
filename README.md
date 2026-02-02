# 🎯 Scorebrawl

**Where every point counts, every victory matters**

Scorebrawl is the ultimate battleground for tracking and amplifying your competitive edge! Whether you're conquering video games or dominating office games like pool and darts, Scorebrawl is your go-to arena for registering and settling scores with friends, colleagues, or in real competitions. Fuel the fun, ignite the rivalry, and show off your victories! Bragging rights are just a score away with Scorebrawl!

🌐 **Live App**: [https://app.scorebrawl.com](https://app.scorebrawl.com)

![Scorebrawl](public/scorebrawl.jpg)

## ✨ Features

- **Create Leagues**: Set up competitive leagues for any game or sport
- **Track Matches**: Record scores and match results with detailed statistics
- **Player Rankings**: Automatic ELO-based ranking system
- **Team Competition**: Support for both individual and team-based competitions
- **Real-time Updates**: Live score tracking and leaderboards
- **Achievement System**: Unlock achievements and celebrate milestones
- **Profile Management**: Customize your player profile with avatars

## 🏗️ Architecture

This is a **Turborepo monorepo** managed with **Bun**, featuring a modern full-stack TypeScript application built with cutting-edge web technologies.

### Tech Stack

- **🏃‍♂️ Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager
- **⚛️ Frontend**: [React 19](https://react.dev/) SPA with [TanStack Router](https://tanstack.com/router) for type-safe routing
- **🔧 Backend**: [Cloudflare Workers](https://workers.cloudflare.com/) with [Hono](https://hono.dev/) framework
- **📡 API**: [tRPC](https://trpc.io/) for end-to-end typesafe APIs
- **🗄️ Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) with [Drizzle ORM](https://orm.drizzle.team/)
- **🔐 Authentication**: [Better-Auth](https://better-auth.com/) for comprehensive auth
- **🎨 UI**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **📦 Monorepo**: [Turborepo](https://turbo.build/) for efficient builds and caching
- **🚀 Deployment**: [Cloudflare](https://cloudflare.com/) edge deployment

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)

### Installation

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd scorebrawl
   bun install
   ```

2. **Database Setup**:

   ```bash
   # Generate migrations
   bun db:generate

   # Apply migrations locally
   bun db:migrate
   ```

3. **Start Development**:
   ```bash
   bun run dev
   ```

### 📝 Available Scripts

```bash
# Development
bun run dev              # Start development servers
bun run build           # Build for production
bun oxc                 # Format and lint code with auto-fix
bun check               # Run typecheck, lint, and format checks

# Database
bun db:studio           # Open Drizzle Studio
bun db:generate         # Generate migrations
bun db:migrate          # Run local migrations
bun db:migrate:prod     # Deploy migrations to production
bun db:reset            # Clean and reapply migrations

# Testing
bun run test           # Run all tests
```

## 🤝 Contributing

1. Follow the existing code style and use `bun oxc` for formatting
2. Create database migrations with `bun db:generate`
3. Add tests for new features in `apps/worker/src/test/`
4. Update documentation as needed

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using modern web technologies. Ready to settle some scores? 🏆
