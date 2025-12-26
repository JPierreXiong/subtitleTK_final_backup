/**
 * Check existing testimonial table structure
 */

import { envConfigs } from '@/config';
import postgres from 'postgres';

async function checkTable() {
  const databaseUrl = envConfigs.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Checking existing testimonial table structure...\n');

    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'testimonial'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    console.log('Existing columns:');
    columns.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log(`\nTotal: ${columns.length} columns`);

    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'testimonial'
      AND schemaname = 'public'
    `;

    console.log('\nExisting indexes:');
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.indexname}`);
    });
  } finally {
    await sql.end();
  }
}

checkTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

