/**
 * Recreate Testimonials Table
 * This script drops the existing testimonial table and recreates it with the new structure
 * WARNING: This will delete all existing data!
 * 
 * Run with: npx tsx scripts/recreate-testimonials-table.ts
 */

import { envConfigs } from '@/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function recreateTable() {
  console.log('🚀 Recreating Testimonials Table...\n');

  try {
    const provider = envConfigs.database_provider;
    const databaseUrl = envConfigs.database_url;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set in environment variables');
    }

    if (provider !== 'postgresql') {
      throw new Error(`This script only supports PostgreSQL. Current provider: ${provider}`);
    }

    console.log('1️⃣ Checking existing table...');
    const checkSql = postgres(databaseUrl, { max: 1 });
    let hasData = false;
    try {
      const countResult = await checkSql`SELECT COUNT(*) as count FROM testimonial`;
      const rowCount = parseInt(countResult[0]?.count || '0');
      if (rowCount > 0) {
        hasData = true;
        console.log(`   ⚠️  WARNING: Table has ${rowCount} rows!`);
        console.log('   ⚠️  All data will be deleted!\n');
      } else {
        console.log('   ✅ Table is empty\n');
      }
    } catch (error: any) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        console.log('   ✅ Table does not exist\n');
      } else {
        throw error;
      }
    } finally {
      await checkSql.end();
    }

    console.log('2️⃣ Reading SQL file...');
    const sqlFilePath = join(process.cwd(), 'scripts', 'recreate-testimonials-table.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');
    console.log('   ✅ SQL file read successfully\n');

    console.log('3️⃣ Executing recreation...');
    const sql = postgres(databaseUrl, { max: 1 });

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
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        successCount++;
        const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
        console.log(`   ✓ Executed: ${preview}...`);
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
        console.error(`   Statement: ${preview}...`);
        throw error;
      }
    }

    await sql.end();
    console.log(`\n   ✅ Recreation completed (${successCount} statements)\n`);

    console.log('4️⃣ Verifying new table structure...');
    const verifySql = postgres(databaseUrl, { max: 1 });
    try {
      const columnsResult = await verifySql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'testimonial'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      if (columnsResult && columnsResult.length > 0) {
        console.log(`   ✅ Table created with ${columnsResult.length} columns`);
        const columnNames = columnsResult.map((r: any) => r.column_name);
        console.log(`   📋 Columns: ${columnNames.join(', ')}`);
        
        const expectedColumns = ['id', 'user_id', 'name', 'email', 'role', 'quote', 'avatar_url', 'language', 'status', 'rating', 'source', 'sort', 'approved_at', 'approved_by', 'created_at', 'updated_at', 'deleted_at'];
        const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));
        if (missingColumns.length > 0) {
          console.log(`   ⚠️  Missing columns: ${missingColumns.join(', ')}`);
        } else {
          console.log('   ✅ All expected columns present');
        }
      } else {
        throw new Error('Table not found after recreation');
      }

      await verifySql.end();
      console.log('\n   ✅ Verification successful!\n');
    } catch (error: any) {
      console.error('   ❌ Verification failed:', error.message);
      throw error;
    }

    console.log('✨ Table recreation completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run test script: npx tsx scripts/test-testimonials-model.ts');
    console.log('   2. Continue with Phase 2: API routes and admin pages');
  } catch (error: any) {
    console.error('\n❌ Recreation failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

recreateTable()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

