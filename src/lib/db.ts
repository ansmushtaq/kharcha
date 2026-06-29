import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ponytail: lazy client so importing this module doesn't crash Edge middleware
// (postgres opens TCP sockets — Node.js only, not Edge)
let _db: PostgresJsDatabase<typeof schema> | null = null

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL!, {
      ssl: process.env.DATABASE_URL?.includes('neon.tech') ? 'require' : false,
    })
    _db = drizzle(client, { schema })
  }
  return _db
}

// convenience re-export — aliased for the rest of the codebase
export const db: PostgresJsDatabase<typeof schema> = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop]
  },
})
