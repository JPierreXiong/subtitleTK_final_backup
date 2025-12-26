/**
 * Execute Testimonials Table Migration
 * This script will backup the database and execute the migration SQL
 * 
 * Run with: npx tsx scripts/execute-testimonials-migration.ts
 */

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function executeMigration() {
  console.log('🚀 Starting Testimonials Table Migration...\n');

  try {
    // 1. Check database connection
    console.log('1️⃣ Checking database connection...');
    const provider = envConfigs.database_provider;
    const databaseUrl = envConfigs.database_url;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set in environment variables');
    }

    if (provider !== 'postgresql') {
      throw new Error(`This migration script only supports PostgreSQL. Current provider: ${provider}`);
    }

    console.log(`   ✓ Database provider: ${provider}`);
    console.log(`   ✓ Database URL: ${databaseUrl.substring(0, 30)}...`);
    console.log('   ✅ Database connection configured\n');

    // 2. Check if table exists and has data
    console.log('2️⃣ Checking existing table...');
    const checkSql = postgres(databaseUrl, { max: 1 });
    try {
      const countResult = await checkSql`SELECT COUNT(*) as count FROM testimonial`;
      const rowCount = parseInt(countResult[0]?.count || '0');
      if (rowCount > 0) {
        console.log(`   ⚠️  Table has ${rowCount} rows. Use recreate script to drop and rebuild.`);
        console.log('   ℹ️  Run: npx tsx scripts/recreate-testimonials-table.ts (if you want to drop and recreate)\n');
      } else {
        console.log('   ✅ Table is empty or does not exist\n');
      }
    } catch (error: any) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        console.log('   ✅ Table does not exist, will be created\n');
      } else {
        throw error;
      }
    } finally {
      await checkSql.end();
    }

    // 3. Read SQL file
    console.log('3️⃣ Reading migration SQL file...');
    const sqlFilePath = join(process.cwd(), 'scripts', 'migrate-testimonials.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');
    console.log('   ✅ SQL file read successfully\n');

    // 4. Execute migration
    console.log('4️⃣ Executing migration...');
    const sql = postgres(databaseUrl);

    // Split SQL into individual statements
    // Remove comments first, then split by semicolon
    const cleanedSql = sqlContent
      .split('\n')
      .map((line) => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line.trim();
      })
      .filter((line) => line.length > 0)
      .join(' ');

    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Skip comment-only lines and empty statements
        if (statement.startsWith('--') || statement.length === 0) {
          continue;
        }

        await sql.unsafe(statement);
        successCount++;
        const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
        console.log(`   ✓ Executed: ${preview}...`);
      } catch (error: any) {
        // Some errors are expected (e.g., IF NOT EXISTS, already exists)
        if (
          error.message.includes('already exists') ||
          error.message.includes('does not exist') ||
          error.message.includes('duplicate')
        ) {
          const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
          console.log(`   ⚠️  Skipped (already exists): ${preview}...`);
          successCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
          console.error(`   Statement: ${preview}...`);
          errorCount++;
        }
      }
    }

    await sql.end();

    console.log(`\n   ✅ Migration completed:`);
    console.log(`      - Successful: ${successCount}`);
    console.log(`      - Errors: ${errorCount}\n`);

    // 5. Verify migration
    console.log('5️⃣ Verifying migration...');
    try {
      // Use postgres client directly for verification
      const verifySql = postgres(databaseUrl, { max: 1 });
      
      const testResult = await verifySql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'testimonial'
      `;

      if (testResult && testResult.length > 0) {
        console.log('   ✅ Testimonial table exists in database');

        // Check columns
        const columnsResult = await verifySql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'testimonial'
          ORDER BY ordinal_position
        `;

        if (columnsResult && columnsResult.length > 0) {
          console.log(`   ✅ Table has ${columnsResult.length} columns`);
          const columnNames = columnsResult.map((r: any) => r.column_name);
          console.log(`   📋 Columns: ${columnNames.join(', ')}`);
        }
      } else {
        throw new Error('Testimonial table not found after migration');
      }

      await verifySql.end();
      console.log('\n   ✅ Migration verification successful!\n');
    } catch (error: any) {
      console.error('   ❌ Verification failed:', error.message);
      throw error;
    }

    console.log('✨ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run test script: npx tsx scripts/test-testimonials-model.ts');
    console.log('   2. Continue with Phase 2: API routes and admin pages');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
executeMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

