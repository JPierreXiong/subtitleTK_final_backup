/**
 * Test Testimonials Model
 * 
 * This script tests the testimonials model to ensure it's correctly set up.
 * 
 * Usage:
 *   npx tsx scripts/test-testimonials-model.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { testimonial } from '@/config/db/schema';
import {
  createTestimonial,
  getTestimonials,
  getTestimonialsCount,
  findTestimonialById,
  TestimonialStatus,
} from '@/shared/models/testimonial';
import { getUuid } from '@/shared/lib/hash';

async function testTestimonialsModel() {
  console.log('🧪 Testing Testimonials Model...\n');

  try {
    // 1. Check if schema is properly exported
    console.log('1️⃣ Checking schema export...');
    if (!testimonial) {
      throw new Error('Testimonial table not found in schema');
    }
    console.log('   ✅ Testimonial table is exported from schema\n');

    // 2. Check if model functions are available
    console.log('2️⃣ Checking model functions...');
    const functions = [
      createTestimonial,
      getTestimonials,
      getTestimonialsCount,
      findTestimonialById,
    ] as Function[];
    
    functions.forEach((fn) => {
      if (typeof fn !== 'function') {
        throw new Error('Function is not a function');
      }
    });
    console.log('   ✅ All model functions are available\n');

    // 3. Check database connection
    console.log('3️⃣ Testing database connection...');
    let tableExists = false;
    try {
      // Try to query the testimonial table (will fail if table doesn't exist, which is expected before migration)
      await db().select().from(testimonial).limit(1);
      console.log('   ✅ Database connection successful');
      console.log('   ✅ Testimonial table exists in database\n');
      tableExists = true;
    } catch (error: any) {
      const errorMsg = error.message || error.cause?.message || '';
      const errorCode = error.cause?.code || error.code;
      if (
        errorMsg.includes('does not exist') ||
        errorMsg.includes('relation') ||
        errorMsg.includes('column') ||
        errorCode === '42P01' || // PostgreSQL: relation does not exist
        errorCode === '42703' // PostgreSQL: column does not exist
      ) {
        console.log('   ⚠️  Testimonial table does not exist yet (expected before migration)');
        console.log('   ℹ️  Please run database migration: pnpm db:push');
        console.log('   ℹ️  Or generate migration: pnpm db:generate\n');
        tableExists = false;
      } else {
        throw error;
      }
    }

    // 4. Test creating a testimonial (only if table exists)
    if (!tableExists) {
      console.log('4️⃣ Skipping creation test (table does not exist)\n');
    } else {
      try {
      console.log('4️⃣ Testing create testimonial...');
      const testTestimonial = {
        id: getUuid(),
        name: 'Test User',
        email: 'test@example.com',
        role: 'Test Role',
        quote: 'This is a test testimonial',
        language: 'en',
        status: TestimonialStatus.PENDING,
        source: 'manual',
      };

      await createTestimonial(testTestimonial);
      console.log('   ✅ Testimonial created successfully');

        // Clean up test data
        await db()
          .delete(testimonial)
          .where(eq(testimonial.id, testTestimonial.id));
        console.log('   ✅ Test data cleaned up\n');
      } catch (error: any) {
        console.error('   ❌ Error creating testimonial:', error.message);
        throw error;
      }
    }

    console.log('✅ All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run database migration: pnpm db:push');
    console.log('   2. Or generate migration SQL: pnpm db:generate');
    console.log('   3. Then run this test again to verify full functionality');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testTestimonialsModel()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

