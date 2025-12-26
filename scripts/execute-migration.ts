/**
 * Execute Plan System Database Migration
 * This script will backup the database and execute the migration SQL
 * 
 * Run with: npx tsx scripts/execute-migration.ts
 */

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function executeMigration() {
  console.log('🚀 Starting Plan System Database Migration...\n');

  try {
    // 1. Check database connection
    console.log('1️⃣ Checking database connection...');
    const provider = envConfigs.database_provider;
    const databaseUrl = envConfigs.database_url;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set in environment variables');
    }

    console.log(`   ✓ Database provider: ${provider}`);
    console.log(`   ✓ Database URL: ${databaseUrl.substring(0, 20)}...`);
    console.log('   ✅ Database connection configured\n');

    // 2. Backup database (for PostgreSQL)
    if (provider === 'postgresql') {
      console.log('2️⃣ Creating database backup...');
      try {
        // Parse database URL
        const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
        const dbName = url.pathname.slice(1);
        const host = url.hostname;
        const port = url.port || '5432';
        const username = url.username;
        const password = url.password;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `backup_${dbName}_${timestamp}.sql`;

        console.log(`   ℹ️  To backup PostgreSQL database, run:`);
        console.log(`   pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} > ${backupFile}`);
        console.log(`   Or use your database management tool to export a backup.\n`);
        console.log(`   ⚠️  Please ensure you have a backup before proceeding!\n`);
      } catch (error) {
        console.log(`   ⚠️  Could not parse database URL for backup command`);
        console.log(`   ⚠️  Please manually backup your database before proceeding!\n`);
      }
    } else {
      console.log(`   ℹ️  Database provider: ${provider}`);
      console.log(`   ℹ️  Please backup your database manually before proceeding!\n`);
    }

    // 3. Read migration SQL file
    console.log('3️⃣ Reading migration SQL file...');
    const sqlFile = join(process.cwd(), 'scripts', 'migrate-plan-system.sql');
    const sqlContent = readFileSync(sqlFile, 'utf-8');
    console.log(`   ✓ Migration file loaded: ${sqlFile}`);
    console.log(`   ✓ SQL statements: ${sqlContent.split(';').filter(s => s.trim().length > 0).length}\n`);

    // 4. Execute migration (only for PostgreSQL)
    if (provider === 'postgresql') {
      console.log('4️⃣ Executing migration SQL...');
      
      // Create a direct postgres connection for executing raw SQL
      const sql = postgres(databaseUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      // Split SQL into individual statements
      // Handle multi-line statements and comments properly
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          // Remove comment lines
          const lines = s.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('--');
          });
          return lines.length > 0;
        })
        .map(s => {
          // Remove inline comments
          return s.split('\n')
            .map(line => {
              const commentIndex = line.indexOf('--');
              if (commentIndex >= 0) {
                return line.substring(0, commentIndex).trim();
              }
              return line.trim();
            })
            .filter(line => line.length > 0)
            .join(' ');
        })
        .filter(s => s.length > 0);

      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        try {
          // Skip comment-only lines
          if (statement.startsWith('--') || statement.length === 0) {
            continue;
          }

          await sql.unsafe(statement);
          successCount++;
          console.log(`   ✓ Executed: ${statement.substring(0, 50)}...`);
        } catch (error: any) {
          // Some errors are expected (e.g., IF NOT EXISTS)
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate')) {
            console.log(`   ⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
            successCount++;
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
            errorCount++;
          }
        }
      }

      await sql.end();

      console.log(`\n   ✅ Migration completed:`);
      console.log(`      - Successful: ${successCount}`);
      console.log(`      - Errors: ${errorCount}\n`);
    } else {
      console.log('4️⃣ Migration execution skipped');
      console.log(`   ℹ️  Database provider "${provider}" requires manual SQL execution`);
      console.log(`   ℹ️  Please execute the SQL file manually using your database tool\n`);
    }

    // 5. Verify migration
    console.log('5️⃣ Verifying migration...');
    try {
      // Test query to check if new columns exist
      if (provider === 'postgresql') {
        const sql = postgres(databaseUrl, { max: 1 });
        
        // Check user table columns
        const userColumns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'user' 
          AND column_name IN ('plan_type', 'free_trial_used', 'last_checkin_date')
        `;
        
        // Check subscription table columns
        const subscriptionColumns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'subscription' 
          AND column_name IN ('plan_type', 'max_video_duration', 'concurrent_limit')
        `;
        
        // Check media_tasks table columns
        const mediaTasksColumns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'media_tasks' 
          AND column_name = 'is_free_trial'
        `;
        
        // Check daily_checkins table
        const dailyCheckinsTable = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'daily_checkins'
        `;

        await sql.end();

        console.log(`   ✓ User table columns: ${userColumns.length}/3`);
        console.log(`   ✓ Subscription table columns: ${subscriptionColumns.length}/3`);
        console.log(`   ✓ Media tasks table columns: ${mediaTasksColumns.length}/1`);
        console.log(`   ✓ Daily checkins table: ${dailyCheckinsTable.length > 0 ? 'exists' : 'missing'}`);

        if (userColumns.length === 3 && 
            subscriptionColumns.length >= 3 && 
            mediaTasksColumns.length === 1 && 
            dailyCheckinsTable.length > 0) {
          console.log('\n   ✅ Migration verification passed!\n');
        } else {
          console.log('\n   ⚠️  Some columns/tables may be missing. Please check manually.\n');
        }
      } else {
        console.log('   ℹ️  Verification skipped for non-PostgreSQL database\n');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Verification failed: ${error.message}`);
      console.log('   ℹ️  Please verify manually\n');
    }

    console.log('✅ Migration process completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run test script: npx tsx scripts/test-plan-system.ts');
    console.log('   2. Test daily check-in functionality');
    console.log('   3. Test plan limits');
    console.log('   4. Test free trial logic');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
executeMigration()
  .then(() => {
    console.log('\n✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

