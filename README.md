# BillTrack

BillTrack is a multi-tenant, mobile-first shop management platform for retail
owners. It supports approval-based tenant onboarding, item and stock
management, purchase recording, staff permissions, and PDF sales reports.

## Workspace

```txt
apps/
  web/      Customer-facing shop app
  admin/    Superadmin console
  api/      Fastify API

packages/
  auth/     Session and permission helpers
  db/       Prisma schema and database client
  shared/   Domain constants and shared types
  ui/       Shared React UI components
```

## Getting Started

Use this flow when setting up the project for the first time after cloning it.

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and fill in local values.
3. Start Postgres with `docker compose up -d postgres`.
4. Generate the Prisma Client with `pnpm db:generate`.
5. Apply database migrations with `pnpm db:migrate`.
6. Insert required default data with `pnpm db:seed`.
7. Start development with `pnpm dev`.

## Common Commands

```bash
# Install dependencies.
# Use initially after cloning, and later whenever package.json changes.
pnpm install

# Start local Postgres through Docker.
# Use before running migrations, seeds, the API, or Prisma Studio.
docker compose up -d postgres

# Stop local Docker services.
# Use when you want to shut down the local database.
docker compose down

# Generate Prisma Client.
# Use initially, and later whenever schema.prisma changes or Prisma Client types are outdated.
pnpm db:generate

# Create and apply a database migration.
# Use whenever you intentionally change packages/db/prisma/schema.prisma.
pnpm db:migrate -- --name describe_your_change

# Seed required default data.
# Use initially after migrations, and later when seed.ts changes or default data needs to be restored.
pnpm db:seed

# Open Prisma Studio.
# Use when you want to inspect or edit local database records in a browser.
pnpm studio

# Start all apps in development mode.
# Use during normal development after the database is running.
pnpm dev

# Typecheck all workspaces.
# Use before committing or after larger TypeScript changes.
pnpm typecheck

# Build all workspaces.
# Use before deployment or when checking production build compatibility.
pnpm build
```

## Database Workflow

The Prisma schema lives at `packages/db/prisma/schema.prisma`.

### First-Time Database Setup

Run these commands once after cloning and configuring `.env`:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

What each command does:

- `pnpm db:generate` creates the TypeScript Prisma Client from `schema.prisma`.
- `pnpm db:migrate` creates/applies SQL migrations so Postgres matches `schema.prisma`.
- `pnpm db:seed` inserts required default data, currently the predefined permissions.

### Later Schema Changes

When `packages/db/prisma/schema.prisma` changes, run:

```bash
pnpm db:migrate -- --name describe_your_change
```

This creates a SQL migration under `packages/db/prisma/migrations/` and
applies it to the local Postgres database.

After migration, run `pnpm db:generate` if Prisma Client types need to be
refreshed. Prisma often generates automatically during migration, but running it
manually is safe.

### Later Seed Changes

When `packages/db/prisma/seed.ts` changes, run:

```bash
pnpm db:seed
```

The seed is safe to rerun because it uses upserts for permissions.

## Architecture Rules

- Authorization checks permissions, not role names.
- Every tenant-owned record stores `shopId`.
- Every protected API request validates authentication, active account status,
  tenant ownership, and required permission.
- Superadmins manage roles and permissions.
- Owners assign available roles to staff.
