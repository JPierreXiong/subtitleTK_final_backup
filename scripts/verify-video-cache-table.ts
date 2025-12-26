/**
 * Verify video_cache table exists and check its structure
 */

import { envConfigs } from '@/config';
import postgres from 'postgres';

async function verifyVideoCacheTable() {
  const databaseUrl = envConfigs.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('🔍 Verifying video_cache table...\n');

    // Check if table exists
    const tableResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'video_cache'
    `;

    if (tableResult && tableResult.length > 0) {
      console.log('✅ video_cache table exists!\n');

      // Check columns
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'video_cache'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      console.log('📋 Table columns:');
      columns.forEach((col: any) => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Check indexes
      const indexes = await sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'video_cache'
        AND schemaname = 'public'
      `;

      console.log('\n📊 Indexes:');
      if (indexes && indexes.length > 0) {
        indexes.forEach((idx: any) => {
          console.log(`   - ${idx.indexname}`);
        });
      } else {
        console.log('   (no indexes found)');
      }

      // Check row count
      const countResult = await sql`SELECT COUNT(*) as count FROM video_cache`;
      const rowCount = parseInt(countResult[0]?.count || '0');
      console.log(`\n📈 Row count: ${rowCount}`);
    } else {
      console.log('❌ video_cache table does not exist');
      console.log('   Please run: npx drizzle-kit push');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

verifyVideoCacheTable()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

