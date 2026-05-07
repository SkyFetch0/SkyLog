import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1 })
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: join(__dirname, 'migrations'),
  })

  await client.end()
}

// Allow running directly: tsx src/db/migrate.ts
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('Running migrations...')
  await runMigrations()
  console.log('Migrations completed successfully.')
}