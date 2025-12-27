/**
 * Cleanup corrupted media tasks with invalid videoUrlInternal
 * This script removes tasks that cannot be downloaded due to:
 * 1. videoUrlInternal is NULL (YouTube tasks before fix)
 * 2. videoUrlInternal is "https" (truncated due to split bug)
 */

import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

// Type inference from schema for selected fields
type MediaTaskRow = typeof mediaTasks.$inferSelect;

async function cleanupCorruptedTasks() {
  try {
    console.log('🧹 Starting cleanup of corrupted media tasks...\n');

    // Step 1: Query affected tasks
    console.log('1️⃣ Querying affected tasks...\n');

    // Check YouTube tasks with NULL videoUrlInternal
    const youtubeNullTasks = await db()
      .select({
        id: mediaTasks.id,
        platform: mediaTasks.platform,
        status: mediaTasks.status,
        outputType: mediaTasks.outputType,
        videoUrlInternal: mediaTasks.videoUrlInternal,
        createdAt: mediaTasks.createdAt,
      })
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.platform, 'youtube'),
          eq(mediaTasks.outputType, 'video'),
          isNull(mediaTasks.videoUrlInternal)
        )
      )
      .orderBy(sql`${mediaTasks.createdAt} DESC`);

    console.log(`   Found ${youtubeNullTasks.length} YouTube video tasks with NULL videoUrlInternal`);

    // Check all tasks with truncated "https" value
    const truncatedTasks = await db()
      .select({
        id: mediaTasks.id,
        platform: mediaTasks.platform,
        status: mediaTasks.status,
        outputType: mediaTasks.outputType,
        videoUrlInternal: mediaTasks.videoUrlInternal,
        createdAt: mediaTasks.createdAt,
      })
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.outputType, 'video'),
          eq(mediaTasks.videoUrlInternal, 'https')
        )
      )
      .orderBy(sql`${mediaTasks.createdAt} DESC`);

    console.log(`   Found ${truncatedTasks.length} tasks with truncated "https" videoUrlInternal\n`);

    // Display summary
    const totalAffected = youtubeNullTasks.length + truncatedTasks.length;
    console.log(`📊 Summary: ${totalAffected} corrupted tasks found\n`);

    if (totalAffected === 0) {
      console.log('✅ No corrupted tasks found. Database is clean!\n');
      return;
    }

    // Display details
    if (youtubeNullTasks.length > 0) {
      console.log('📋 YouTube tasks with NULL videoUrlInternal:');
      youtubeNullTasks.forEach((task: MediaTaskRow, index: number) => {
        console.log(`   ${index + 1}. Task ${task.id}`);
        console.log(`      Status: ${task.status}, Created: ${task.createdAt}`);
      });
      console.log('');
    }

    if (truncatedTasks.length > 0) {
      console.log('📋 Tasks with truncated "https" videoUrlInternal:');
      truncatedTasks.forEach((task: MediaTaskRow, index: number) => {
        console.log(`   ${index + 1}. Task ${task.id} (${task.platform})`);
        console.log(`      Status: ${task.status}, Created: ${task.createdAt}`);
      });
      console.log('');
    }

    // Step 2: Confirm deletion
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  Do you want to DELETE these ${totalAffected} corrupted tasks? (yes/no): `,
        resolve
      );
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled by user\n');
      return;
    }

    // Step 3: Delete corrupted tasks
    console.log('\n2️⃣ Deleting corrupted tasks...\n');

    // Delete YouTube tasks with NULL videoUrlInternal
    let deletedYoutube = 0;
    if (youtubeNullTasks.length > 0) {
      const deleteResult = await db()
        .delete(mediaTasks)
        .where(
          and(
            eq(mediaTasks.platform, 'youtube'),
            eq(mediaTasks.outputType, 'video'),
            isNull(mediaTasks.videoUrlInternal)
          )
        );
      deletedYoutube = youtubeNullTasks.length;
      console.log(`   ✅ Deleted ${deletedYoutube} YouTube tasks with NULL videoUrlInternal`);
    }

    // Delete tasks with truncated "https" value
    let deletedTruncated = 0;
    if (truncatedTasks.length > 0) {
      const deleteResult = await db()
        .delete(mediaTasks)
        .where(
          and(
            eq(mediaTasks.outputType, 'video'),
            eq(mediaTasks.videoUrlInternal, 'https')
          )
        );
      deletedTruncated = truncatedTasks.length;
      console.log(`   ✅ Deleted ${deletedTruncated} tasks with truncated "https" videoUrlInternal`);
    }

    console.log(`\n✅ Cleanup completed! Deleted ${deletedYoutube + deletedTruncated} corrupted tasks\n`);

    // Step 4: Verify cleanup
    console.log('3️⃣ Verifying cleanup...\n');
    const remainingCorrupted = await db()
      .select({ count: sql<number>`COUNT(*)` })
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.outputType, 'video'),
          or(
            and(
              eq(mediaTasks.platform, 'youtube'),
              isNull(mediaTasks.videoUrlInternal)
            ),
            eq(mediaTasks.videoUrlInternal, 'https')
          )
        )
      );

    const remainingCount = Number(remainingCorrupted[0]?.count || 0);
    if (remainingCount === 0) {
      console.log('✅ Verification passed! No corrupted tasks remaining.\n');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} corrupted tasks still exist.\n`);
    }

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

cleanupCorruptedTasks()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

