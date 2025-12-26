/**
 * Create video_cache table migration script
 * Executes the SQL migration to create the video_cache table
 */

import { envConfigs } from '@/config';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

async function createVideoCacheTable() {
  const databaseUrl = envConfigs.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('📋 Creating video_cache table...\n');

    // Execute CREATE TABLE statement directly
    console.log('Executing CREATE TABLE statement...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS video_cache (
          id TEXT PRIMARY KEY,
          original_url TEXT NOT NULL,
          download_url TEXT NOT NULL,
          platform TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;
      console.log('✅ CREATE TABLE executed successfully\n');
    } catch (error: any) {
      const errorCode = error.code;
      if (errorCode === '42P07') { // duplicate_table
        console.log('⚠️  Table already exists, skipping\n');
      } else {
        throw error;
      }
    }

    // Execute CREATE INDEX statement
    console.log('Executing CREATE INDEX statement...');
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_video_cache_expires ON video_cache(expires_at)
      `;
      console.log('✅ CREATE INDEX executed successfully\n');
    } catch (error: any) {
      const errorCode = error.code;
      if (errorCode === '42710') { // duplicate_object
        console.log('⚠️  Index already exists, skipping\n');
      } else {
        throw error;
      }
    }

    // Verify table creation
    console.log('🔍 Verifying table creation...\n');
    const tableResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'video_cache'
    `;

    if (tableResult && tableResult.length > 0) {
      console.log('✅ video_cache table created successfully!\n');
    } else {
      console.log('⚠️  Warning: video_cache table not found after creation\n');
    }

    // Verify index creation
    const indexResult = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'video_cache' 
      AND indexname = 'idx_video_cache_expires'
    `;

    if (indexResult && indexResult.length > 0) {
      console.log('✅ Index idx_video_cache_expires created successfully!\n');
    } else {
      console.log('⚠️  Warning: Index idx_video_cache_expires not found\n');
    }

    console.log('✅ Migration completed successfully!\n');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

createVideoCacheTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

