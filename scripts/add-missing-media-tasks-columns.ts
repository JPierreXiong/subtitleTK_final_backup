/**
 * Add missing columns to media_tasks table
 */

import { db } from '../src/core/db';
import { sql } from 'drizzle-orm';

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to media_tasks table...');

    // Add subtitle fields
    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "subtitle_raw" text
    `);
    console.log('✓ Added subtitle_raw column');

    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "subtitle_translated" text
    `);
    console.log('✓ Added subtitle_translated column');

    // Add video storage fields
    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "video_url_internal" text
    `);
    console.log('✓ Added video_url_internal column');

    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp
    `);
    console.log('✓ Added expires_at column');

    // Add output type field
    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "output_type" text
    `);
    console.log('✓ Added output_type column');

    // Add credit id field
    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "credit_id" text
    `);
    console.log('✓ Added credit_id column');

    // Add free trial field
    await db().execute(sql`
      ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "is_free_trial" boolean DEFAULT false
    `);
    console.log('✓ Added is_free_trial column');

    // Verify columns exist
    const columns = await db().execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'media_tasks'
      ORDER BY ordinal_position
    `);

    console.log('\nAll columns in media_tasks table:');
    if (columns.rows) {
      columns.rows.forEach((row: any) => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }

    console.log('\n✓ All columns added successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addMissingColumns();

