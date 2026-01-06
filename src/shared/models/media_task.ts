import { and, eq, or, inArray, desc, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { mediaTasks, credit } from '@/config/db/schema';
import { CreditStatus } from '@/shared/models/credit';
import { appendUserToResult, User } from '@/shared/models/user';

import { consumeCredits } from './credit';

export type MediaTask = typeof mediaTasks.$inferSelect & {
  user?: User;
};
export type NewMediaTask = typeof mediaTasks.$inferInsert;
export type UpdateMediaTask = Partial<
  Omit<NewMediaTask, 'id' | 'createdAt'>
>;

export type MediaTaskStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'translating'
  | 'completed'
  | 'failed';
// Note: 'timeout' is a logical state, stored as 'failed' with error_message = 'Task timeout (watchdog)'

/**
 * Create a new media task with credit consumption
 * Reference: createAITask implementation pattern
 */
export async function createMediaTask(
  newMediaTask: NewMediaTask,
  costCredits: number
) {
  const result = await db().transaction(async (tx: any) => {
    // 1. create media task record
    const [taskResult] = await tx
      .insert(mediaTasks)
      .values(newMediaTask)
      .returning();

    // 2. consume credits if costCredits > 0
    if (costCredits > 0) {
      const consumedCredit = await consumeCredits({
        userId: newMediaTask.userId,
        credits: costCredits,
        scene: 'payment',
        description: `Media extraction: ${newMediaTask.outputType || 'subtitle'}`,
        metadata: JSON.stringify({
          type: 'media-task',
          taskId: taskResult.id,
          outputType: newMediaTask.outputType,
        }),
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(mediaTasks)
          .set({ creditId: consumedCredit.id })
          .where(eq(mediaTasks.id, taskResult.id));
      }
    }

    return taskResult;
  });

  return result;
}

/**
 * Find media task by ID
 */
export async function findMediaTaskById(id: string) {
  const [result] = await db()
    .select()
    .from(mediaTasks)
    .where(eq(mediaTasks.id, id));
  return result;
}

/**
 * Update media task by ID
 * Reference: updateAITaskById implementation pattern
 * Supports credit refund on task failure
 */
export async function updateMediaTaskById(
  id: string,
  updateMediaTask: UpdateMediaTask
) {
  const result = await db().transaction(async (tx: any) => {
    // Task failed (including timeout), refund credit consumption record
    // Note: timeout is stored as 'failed' with error_message containing 'timeout'
    if (updateMediaTask.status === 'failed') {
      // Get creditId from updateMediaTask or from existing task
      let creditIdToRefund = updateMediaTask.creditId;
      
      // If creditId not in update, get from existing task
      if (!creditIdToRefund) {
        const [existingTask] = await tx
          .select({ creditId: mediaTasks.creditId })
          .from(mediaTasks)
          .where(eq(mediaTasks.id, id));
        creditIdToRefund = existingTask?.creditId;
      }

      if (creditIdToRefund) {
        // Get consumed credit record
        const [consumedCredit] = await tx
          .select()
          .from(credit)
          .where(eq(credit.id, creditIdToRefund));

        if (consumedCredit && consumedCredit.status === CreditStatus.ACTIVE) {
          const consumedItems = JSON.parse(consumedCredit.consumedDetail || '[]');

          // Add back consumed credits
          await Promise.all(
            consumedItems.map((item: any) => {
              if (item && item.creditId && item.creditsConsumed > 0) {
                return tx
                  .update(credit)
                  .set({
                    remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
                  })
                  .where(eq(credit.id, item.creditId));
              }
            })
          );

          // Mark consumed credit record as deleted
          await tx
            .update(credit)
            .set({
              status: CreditStatus.DELETED,
            })
            .where(eq(credit.id, creditIdToRefund));
        }
      }
    }

    // Update task
    const [taskResult] = await tx
      .update(mediaTasks)
      .set(updateMediaTask)
      .where(eq(mediaTasks.id, id))
      .returning();

    return taskResult;
  });

  return result;
}

/**
 * Check if user has active media task
 */
export async function hasActiveMediaTask(userId: string): Promise<boolean> {
  const [result] = await db()
    .select()
    .from(mediaTasks)
    .where(
      and(
        eq(mediaTasks.userId, userId),
        or(
          eq(mediaTasks.status, 'processing'),
          eq(mediaTasks.status, 'translating')
        )
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get active media tasks for a user
 */
export async function getActiveMediaTasks(userId: string) {
  const result = await db()
    .select()
    .from(mediaTasks)
    .where(
      and(
        eq(mediaTasks.userId, userId),
        or(
          eq(mediaTasks.status, 'processing'),
          eq(mediaTasks.status, 'translating')
        )
      )
    );

  return result;
}

/**
 * Get media task history for a user
 * @param userId User ID
 * @param page Page number (1-based)
 * @param limit Items per page
 * @returns List of media tasks and total count
 */
export async function getMediaTaskHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  // Get total count
  const [countResult] = await db()
    .select({ count: mediaTasks.id })
    .from(mediaTasks)
    .where(eq(mediaTasks.userId, userId));

  const total = countResult?.count ? Number(countResult.count) : 0;

  // Get paginated results
  const tasks = await db()
    .select()
    .from(mediaTasks)
    .where(eq(mediaTasks.userId, userId))
    .orderBy(desc(mediaTasks.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    list: tasks,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
