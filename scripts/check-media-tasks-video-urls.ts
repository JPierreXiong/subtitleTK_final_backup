/**
 * Check media_tasks table for videoUrlInternal values
 * This script checks TikTok video download tasks to see what's stored in videoUrlInternal
 */

import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Type inference from schema
type MediaTaskRow = typeof mediaTasks.$inferSelect;

async function checkMediaTasksVideoUrls() {
  try {
    console.log('🔍 Checking media_tasks table for video URL data...\n');

    // Get recent TikTok video tasks (outputType = 'video')
    const recentTikTokVideoTasks = await db()
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
      .limit(10);

    console.log(`Found ${recentTikTokVideoTasks.length} TikTok video tasks with videoUrlInternal\n`);

    if (recentTikTokVideoTasks.length > 0) {
      console.log('Recent TikTok Video Tasks:');
      recentTikTokVideoTasks.forEach((task: MediaTaskRow, index: number) => {
        console.log(`\n  Task ${index + 1}:`);
        console.log(`    ID: ${task.id}`);
        console.log(`    Status: ${task.status}`);
        console.log(`    Platform: ${task.platform}`);
        console.log(`    Output Type: ${task.outputType}`);
        console.log(`    Video URL (original): ${task.videoUrl || 'N/A'}`);
        console.log(`    Video URL Internal: ${task.videoUrlInternal || 'NULL'}`);
        console.log(`    Video URL Internal length: ${task.videoUrlInternal?.length || 0}`);
        if (task.videoUrlInternal) {
          console.log(`    Video URL Internal starts with:`);
          console.log(`      - "original:": ${task.videoUrlInternal.startsWith('original:')}`);
          console.log(`      - "vercel-blob:": ${task.videoUrlInternal.startsWith('vercel-blob:')}`);
          console.log(`      - "r2:": ${task.videoUrlInternal.startsWith('r2:')}`);
          console.log(`      - "https": ${task.videoUrlInternal.startsWith('https')}`);
          if (task.videoUrlInternal.includes(':')) {
            const [prefix, ...rest] = task.videoUrlInternal.split(':');
            console.log(`    Split result: prefix="${prefix}", rest="${rest.join(':')}"`);
          }
        }
        console.log(`    Expires At: ${task.expiresAt || 'NULL'}`);
        console.log(`    Created At: ${task.createdAt}`);
        console.log(`    Updated At: ${task.updatedAt}`);
      });
    }

    // Also check YouTube video tasks
    const recentYouTubeVideoTasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.platform, 'youtube'),
          eq(mediaTasks.outputType, 'video')
        )
      )
      .orderBy(desc(mediaTasks.createdAt))
      .limit(5);

    console.log(`\n\nFound ${recentYouTubeVideoTasks.length} YouTube video tasks\n`);

    if (recentYouTubeVideoTasks.length > 0) {
      console.log('Recent YouTube Video Tasks:');
      recentYouTubeVideoTasks.forEach((task: MediaTaskRow, index: number) => {
        console.log(`\n  Task ${index + 1}:`);
        console.log(`    ID: ${task.id}`);
        console.log(`    Status: ${task.status}`);
        console.log(`    Platform: ${task.platform}`);
        console.log(`    Output Type: ${task.outputType}`);
        console.log(`    Video URL Internal: ${task.videoUrlInternal || 'NULL (NOT SET!)'}`);
        console.log(`    Created At: ${task.createdAt}`);
      });
    }

    // Check for tasks with problematic videoUrlInternal values
    console.log('\n\n🔍 Checking for problematic videoUrlInternal values...\n');
    
    const problematicTasks = await db()
      .execute(sql`
        SELECT id, platform, status, output_type, 
               video_url_internal, 
               LENGTH(video_url_internal) as url_length,
               created_at
        FROM media_tasks
        WHERE output_type = 'video'
          AND video_url_internal IS NOT NULL
          AND (
            video_url_internal = 'https'
            OR video_url_internal LIKE 'https:%'
            OR LENGTH(video_url_internal) < 10
          )
        ORDER BY created_at DESC
        LIMIT 10
      `);

    if (problematicTasks.rows && problematicTasks.rows.length > 0) {
      console.log(`Found ${problematicTasks.rows.length} tasks with problematic videoUrlInternal:\n`);
      problematicTasks.rows.forEach((task: any, index: number) => {
        console.log(`  ${index + 1}. Task ${task.id}`);
        console.log(`     Platform: ${task.platform}`);
        console.log(`     Status: ${task.status}`);
        console.log(`     videoUrlInternal: "${task.video_url_internal}"`);
        console.log(`     Length: ${task.url_length}`);
        console.log(`     Created: ${task.created_at}`);
      });
    } else {
      console.log('✅ No problematic videoUrlInternal values found');
    }

  } catch (error: any) {
    console.error('❌ Error checking media tasks:', error);
    throw error;
  }
}

checkMediaTasksVideoUrls()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

