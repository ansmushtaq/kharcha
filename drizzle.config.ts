import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema:  './src/lib/schema.ts',
  out:     './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Must use the UNPOOLED (direct) connection for migrations — not the pooled one
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
})
