// Edge Runtime compatible database configuration
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'

import * as schema from '@/models/Schema'

// Edge Runtime database instance
let edgeDb: PgliteDatabase<typeof schema> | null = null

export function getEdgeDb() {
  if (!edgeDb) {
    const client = new PGlite()
    edgeDb = drizzlePglite(client, { schema })
  }
  return edgeDb
}

// Edge Runtime compatible auth functions
export async function edgeAuth() {
  // This will be a minimal auth implementation for Edge Runtime
  // For now, return null to prevent Edge Runtime issues
  return null
}
