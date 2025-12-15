import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import { PHASE_PRODUCTION_BUILD } from 'next/dist/shared/lib/constants'
import { Client } from 'pg'

import * as schema from '@/models/Schema'

import { Env } from './Env'

// Global database instance to prevent multiple connections
declare global {
  var __db: PgliteDatabase<typeof schema> | null
}

async function createDatabase() {
  // Use PostgreSQL if DATABASE_URL is available (production)
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD && Env.DATABASE_URL) {
    const client = new Client({
      connectionString: Env.DATABASE_URL,
    })
    await client.connect()
    return drizzlePg(client, { schema })
  }

  // Use PGlite for development
  if (!global.__db) {
    const client = new PGlite()
    await client.waitReady
    global.__db = drizzlePglite(client, { schema })
  }

  return global.__db
}

export const db = await createDatabase()
