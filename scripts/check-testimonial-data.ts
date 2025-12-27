/**
 * Check if testimonial table has data
 */

import { envConfigs } from '@/config';
import postgres from 'postgres';

async function checkData() {
  const databaseUrl = envConfigs.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Checking testimonial table data...\n');

    const count = await sql`SELECT COUNT(*) as count FROM testimonial`;
    const rowCount = count[0]?.count || 0;

    console.log(`Total rows: ${rowCount}`);

    if (rowCount > 0) {
      console.log('\n⚠️  Table has existing data!');
      console.log('Sample rows:');
      const samples = await sql`SELECT * FROM testimonial LIMIT 5`;
      samples.forEach((row: any, idx: number) => {
        console.log(`\n  Row ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]: [string, unknown]) => {
          console.log(`    ${key}: ${value}`);
        });
      });
    } else {
      console.log('\n✅ Table is empty, safe to drop and recreate');
    }
  } finally {
    await sql.end();
  }
}

checkData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

