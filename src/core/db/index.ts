import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSQLite } from 'drizzle-orm/libsql';
import postgres from 'postgres';
import { createClient } from '@libsql/client';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Use 'any' type to allow both PostgreSQL and SQLite drizzle instances
// Both have compatible query APIs (.select(), .from(), etc.)
type Database = any;

// Global database connection instance (singleton pattern)
let dbInstance: Database | null = null;
let client: ReturnType<typeof postgres> | ReturnType<typeof createClient> | null = null;

export function db(): Database {
  let databaseUrl = envConfigs.database_url;
  const provider = envConfigs.database_provider;

  // Support SQLite for local development
  if (provider === 'sqlite' || provider === 'turso') {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    // Singleton mode: reuse existing connection
    if (envConfigs.db_singleton_enabled === 'true') {
      if (dbInstance) {
        return dbInstance;
      }

      // Create SQLite client
      const sqliteClient = createClient({
        url: databaseUrl,
      });

      client = sqliteClient;
      dbInstance = drizzleSQLite(sqliteClient);
      return dbInstance;
    }

    // Non-singleton mode: create new connection each time
    const sqliteClient = createClient({
      url: databaseUrl,
    });

    return drizzleSQLite(sqliteClient);
  }

  // PostgreSQL support (original code)
  let isHyperdrive = false;

  if (isCloudflareWorker) {
    const { env }: { env: any } = { env: {} };
    // Detect if set Hyperdrive
    isHyperdrive = 'HYPERDRIVE' in env;

    if (isHyperdrive) {
      const hyperdrive = env.HYPERDRIVE;
      databaseUrl = hyperdrive.connectionString;
      console.log('using Hyperdrive connection');
    }
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    console.log('in Cloudflare Workers environment');
    // Workers environment uses minimal configuration
    const client = postgres(databaseUrl, {
      prepare: false,
      max: 1, // Limit to 1 connection in Workers
      idle_timeout: 10, // Shorter timeout for Workers
      connect_timeout: 5,
    });

    return drizzle(client);
  }

  // Singleton mode: reuse existing connection (good for traditional servers)
  if (envConfigs.db_singleton_enabled === 'true') {
    // Return existing instance if already initialized
    if (dbInstance) {
      return dbInstance;
    }

    // Create connection pool only once
    client = postgres(databaseUrl, {
      prepare: false,
      max: 10, // Maximum connections in pool
      idle_timeout: 30, // Idle connection timeout (seconds)
      connect_timeout: 10, // Connection timeout (seconds)
    });

    dbInstance = drizzle({ client });
    return dbInstance;
  }

  // Non-singleton mode: create new connection each time (good for serverless)
  // In serverless, the connection will be cleaned up when the function instance is destroyed
  const serverlessClient = postgres(databaseUrl, {
    prepare: false,
    max: 1, // Use single connection in serverless
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle({ client: serverlessClient }) as Database;
}

// Optional: Function to close database connection (useful for testing or graceful shutdown)
// Note: Only works in singleton mode
export async function closeDb() {
  if (envConfigs.db_singleton_enabled && client) {
    const provider = envConfigs.database_provider;
    if (provider === 'sqlite' || provider === 'turso') {
      // SQLite client doesn't have an end() method, just clear references
      client = null;
      dbInstance = null;
    } else {
      // PostgreSQL client
      await (client as ReturnType<typeof postgres>).end();
      client = null;
      dbInstance = null;
    }
  }
}
