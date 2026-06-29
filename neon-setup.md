# Neon DB Setup — Vercel Integration

Complete setup guide. Do this before running any code.

---

## Step 1 — Create Neon Database on Vercel

1. Open your project on [vercel.com](https://vercel.com)
2. Click the **Storage** tab in the top nav
3. Click **Connect Store** → choose **Neon**
4. Click **Create New** (or connect an existing Neon project)
5. Pick a name (e.g. `kharcha-db`)
6. Choose region — pick closest to your users:
   - Pakistan → **AWS ap-south-1 (Mumbai)** or **AWS ap-southeast-1 (Singapore)**
7. Click **Create & Continue** → **Connect**

Vercel automatically injects these env vars into your project:

```
DATABASE_URL             # pooled — use this in your app (API routes, server components)
DATABASE_URL_UNPOOLED    # direct — use this for drizzle-kit migrations only
PGHOST
PGHOST_UNPOOLED
PGUSER
PGPASSWORD
PGDATABASE
```

---

## Step 2 — Pull Env Vars Locally

```bash
vercel env pull .env.local
```

This writes all the Neon env vars into your `.env.local`. You should see `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in there.

> Make sure `.env.local` is in `.gitignore` (it should be by default with Next.js).

---

## Step 3 — Install Packages

```bash
npm install drizzle-orm @neondatabase/serverless bcryptjs
npm install -D drizzle-kit tsx @types/bcryptjs
```

> `tsx` is needed to run the seed script directly with TypeScript.

---

## Step 4 — File Placement

Put the files at these exact paths in your Next.js project:

```
your-project/
├── drizzle.config.ts          ← root of project
├── src/
│   └── lib/
│       ├── schema.ts
│       ├── db.ts
│       └── seed.ts
```

---

## Step 5 — Generate + Run Migration

```bash
# Generate the SQL migration from your schema.ts
npx drizzle-kit generate

# Apply the migration to Neon
npx drizzle-kit migrate
```

After this, your Neon database will have the 4 tables:
- `users`
- `user_categories`
- `user_budget_config`
- `expenses`

You can verify in the Neon console at [console.neon.tech](https://console.neon.tech) → Tables.

---

## Step 6 — Seed User Accounts

Edit `src/lib/seed.ts` — fill in your actual users in the `SEED_USERS` array.

Then run:

```bash
npx tsx src/lib/seed.ts
```

Expected output:
```
🌱 Starting seed...

✅ Created: Ans <ans@example.com>

✅ Seed complete.
```

Re-running is safe — `onConflictDoNothing` skips existing emails.

---

## Step 7 — Add NEXTAUTH_SECRET

This is the only env var NOT auto-provided by Neon. Generate one and add it manually:

```bash
# Generate secret
openssl rand -base64 32
```

Add to Vercel:
1. Vercel project → **Settings** → **Environment Variables**
2. Add `NEXTAUTH_SECRET` = (your generated string)
3. Apply to: Production, Preview, Development

Then pull again locally:
```bash
vercel env pull .env.local
```

---

## Final .env.local (what it should look like)

```env
# Auto-injected by Vercel Neon integration
DATABASE_URL="postgresql://user:pass@pooled-host/dbname?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@direct-host/dbname?sslmode=require"
PGHOST="pooled-host.neon.tech"
PGHOST_UNPOOLED="direct-host.neon.tech"
PGUSER="your_user"
PGPASSWORD="your_password"
PGDATABASE="your_dbname"

# Added manually
NEXTAUTH_SECRET="your-generated-32-char-secret"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Migration Cheatsheet

```bash
# Any time you change schema.ts, run these two:
npx drizzle-kit generate    # creates new SQL file in /drizzle folder
npx drizzle-kit migrate     # applies it to Neon

# Inspect your DB visually
npx drizzle-kit studio      # opens local DB browser at localhost:4983
```

---

## Gotchas

| Issue | Fix |
|---|---|
| `DATABASE_URL_UNPOOLED` not found | Run `vercel env pull .env.local` again |
| Migration fails with SSL error | Make sure URL has `?sslmode=require` at the end |
| Seed fails with "Cannot find module" | Run from project root, not from src/ |
| `drizzle-kit migrate` vs `push` | Use `migrate` (not `push`) — safer for production |
| Vercel build fails — no DB | Add env vars to Vercel project settings, not just .env.local |
