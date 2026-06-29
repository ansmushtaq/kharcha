/**
 * Seed Script — run once to create user accounts.
 * Does NOT seed categories (users set those up themselves via /settings).
 *
 * Usage: npx tsx src/lib/seed.ts
 */

import { db } from './db'
import { users, userBudgetConfig } from './schema'
import bcrypt from 'bcryptjs'

// ─── Define your users here ───────────────────────────────────────────────────
const SEED_USERS = [
  { name: 'Ans', email: 'ans@example.com', password: 'changeme123' },
  // add up to 4 more:
  // { name: 'Name', email: 'email@example.com', password: 'password' },
]

const DEFAULT_DAILY_LIMIT = 1200 // PKR

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Starting seed...\n')

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12)

    // Insert user — skip if email already exists
    const [user] = await db
      .insert(users)
      .values({
        name:         u.name,
        email:        u.email,
        passwordHash,
      })
      .onConflictDoNothing({ target: users.email })
      .returning()

    if (!user) {
      console.log(`⚠️  Skipped (already exists): ${u.email}`)
      continue
    }

    // Create default budget config for the user
    await db
      .insert(userBudgetConfig)
      .values({
        userId:     user.id,
        dailyLimit: DEFAULT_DAILY_LIMIT,
      })
      .onConflictDoNothing({ target: userBudgetConfig.userId })

    console.log(`✅ Created: ${u.name} <${u.email}>`)
  }

  console.log('\n✅ Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
