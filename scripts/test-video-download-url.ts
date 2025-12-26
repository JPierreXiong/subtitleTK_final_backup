/**
 * Test getVideoDownloadUrl function with actual database data
 */

import { getVideoDownloadUrl } from '../src/shared/services/media/video-storage';
import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

async function testVideoDownloadUrl() {
  try {
    console.log('🔍 Testing getVideoDownloadUrl function...\n');

    // Get a recent TikTok video task
    const tasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.platform, 'tiktok'),
          eq(mediaTasks.outputType, 'video'),
          sql`${mediaTasks.videoUrlInternal} IS NOT NULL`
        )
      )
      .orderBy(desc(mediaTasks.createdAt))
      .limit(1);

    if (tasks.length === 0) {
      console.log('❌ No TikTok video tasks found');
      return;
    }

    const task = tasks[0];
    console.log(`Testing with Task ID: ${task.id}`);
    console.log(`videoUrlInternal: ${task.videoUrlInternal}\n`);

    // Test getVideoDownloadUrl function
    try {
      console.log('Calling getVideoDownloadUrl...');
      const downloadUrl = await getVideoDownloadUrl(task.videoUrlInternal!);
      console.log(`✅ Success! Download URL: ${downloadUrl}`);
      console.log(`   URL length: ${downloadUrl.length}`);
      console.log(`   URL starts with https: ${downloadUrl.startsWith('https')}`);
      
      // Try to create URL object to validate
      try {
        const urlObj = new URL(downloadUrl);
        console.log(`   ✅ Valid URL format:`);
        console.log(`      Protocol: ${urlObj.protocol}`);
        console.log(`      Host: ${urlObj.host}`);
        console.log(`      Path: ${urlObj.pathname}`);
      } catch (urlError: any) {
        console.log(`   ❌ Invalid URL format: ${urlError.message}`);
      }

    } catch (error: any) {
      console.error(`❌ Error calling getVideoDownloadUrl:`, error);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack: ${error.stack}`);
    }

    // Test split logic manually
    console.log('\n\n🔍 Testing split logic manually...\n');
    const testValue = task.videoUrlInternal!;
    console.log(`Original value: ${testValue}`);
    
    const [provider, identifier] = testValue.split(':', 2);
    console.log(`After split(':', 2):`);
    console.log(`   provider = "${provider}"`);
    console.log(`   identifier = "${identifier}"`);
    console.log(`   identifier length = ${identifier?.length || 0}`);

    if (provider === 'vercel-blob') {
      console.log(`   ✅ Provider matches 'vercel-blob'`);
      console.log(`   Should return identifier directly: "${identifier}"`);
    } else {
      console.log(`   ❌ Provider does NOT match 'vercel-blob'`);
    }

  } catch (error: any) {
    console.error('❌ Script error:', error);
    throw error;
  }
}

testVideoDownloadUrl()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

