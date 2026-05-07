import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(migrationClient)

console.log('Running migrations...')

await migrate(db, {
  migrationsFolder: join(__dirname, 'migrations'),
})

console.log('Migrations completed successfully.')

await migrationClient.end()