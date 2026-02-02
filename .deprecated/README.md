# 🎯 Scorebrawl

**Where every point counts, every victory matters**

Scorebrawl is the ultimate battleground for tracking and amplifying your competitive edge! Whether you're conquering video games or dominating office games like pool and darts, Scorebrawl is your go-to arena for registering and settling scores with friends, colleagues, or in real competitions. Fuel the fun, ignite the rivalry, and show off your victories! Bragging rights are just a score away with Scorebrawl!

🌐 **Live App**: [https://app.scorebrawl.com](https://app.scorebrawl.com)

![Scorebrawl Screenshot](apps/scorebrawl/public/screenshot.png)

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
- **⚛️ Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **📡 API**: [tRPC](https://trpc.io/) for end-to-end typesafe APIs
- **🗄️ Database**: [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **🔐 Authentication**: [Better-Auth](https://better-auth.com/) for comprehensive auth
- **📤 File Uploads**: [UploadThing](https://uploadthing.com/) for seamless file handling
- **🎨 UI**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **⚡ Background Jobs**: [Trigger.dev](https://trigger.dev/) for async processing
- **🚀 Deployment**: [Vercel](https://vercel.com/) for hosting and CI/CD
- **📦 Monorepo**: [Turborepo](https://turbo.build/) for efficient builds and caching

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [UploadThing](https://uploadthing.com/) account for file uploads

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd scorebrawl-nextjs
   bun install
   ```

2. **Start local database**:
   ```bash
   cd apps/scorebrawl
   bun run db-start  # Start local PostgreSQL with Docker
   ```

3. **Database Setup**:
   ```bash
   cd apps/scorebrawl
   bun run drizzle-generate  # Generate migrations
   bun run drizzle-migrate   # Run migrations
   ```

4. **Start Development**:
   ```bash
   bun run dev
   ```

### 🎯 Database Seeding

The `apps/scorebrawl/scripts/` directory contains utilities for database management:

- **`import-dump.ts`** - Import anonymized production data for development
- **`anonymize-dump.ts`** - Create anonymized database dumps
- **`truncate-database.ts`** - Clean database for fresh start
- **`migrate-db.ts`** - Run database migrations

#### Import Database Dump

The `import-dump.ts` script supports importing to different databases:

```bash
cd apps/scorebrawl

# Import to e2e database (default)
bun run scripts/import-dump.ts

# Import to dev database
bun run scripts/import-dump.ts --db=dev

# Import specific file to dev database
bun run scripts/import-dump.ts my-dump.sql --db=dev
```

**Database Options:**
- `--db=e2e` - E2E test database (default)
- `--db=dev` - Local development database

#### Test User Credentials

When using the anonymized dump, you can log in with this test user:

- **Email**: `jensen_bauch31@gmail.com`
- **Password**: `rimmen-6vacsi-viPmob`

### 📝 Available Scripts

```bash
# Development
bun run dev              # Start development server
bun run build           # Build for production
bun run flint           # Format and lint code

# Database
bun run drizzle-studio  # Open Drizzle Studio
bun run db-start        # Start local PostgreSQL (Docker)
bun run db-stop         # Stop local PostgreSQL

# Testing
bun run test           # Run all tests
```

## 🤝 Contributing

1. Follow the existing code style and use `bun run flint` for formatting
2. Create database migrations with `bun run drizzle-generate`
3. Add tests for new features
4. Update documentation as needed

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using modern web technologies. Ready to settle some scores? 🏆