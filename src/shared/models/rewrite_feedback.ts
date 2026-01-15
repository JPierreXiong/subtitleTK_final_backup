import { desc, eq, sql, and, gte, count } from 'drizzle-orm';

import { db } from '@/core/db';
import { rewriteFeedback } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export type RewriteFeedback = typeof rewriteFeedback.$inferSelect;
export type NewRewriteFeedback = typeof rewriteFeedback.$inferInsert;
export type UpdateRewriteFeedback = Partial<
  Omit<NewRewriteFeedback, 'id' | 'createdAt' | 'userId' | 'taskId'>
>;

/**
 * Create a new feedback record
 */
export async function createRewriteFeedback(
  feedback: Omit<NewRewriteFeedback, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RewriteFeedback> {
  const newFeedback = {
    id: getUuid(),
    ...feedback,
  };

  const [result] = await db()
    .insert(rewriteFeedback)
    .values(newFeedback)
    .returning();

  return result;
}

/**
 * Get feedback by ID
 */
export async function getRewriteFeedbackById(
  id: string
): Promise<RewriteFeedback | undefined> {
  const [result] = await db()
    .select()
    .from(rewriteFeedback)
    .where(eq(rewriteFeedback.id, id))
    .limit(1);

  return result;
}

/**
 * Get feedback by task ID
 */
export async function getRewriteFeedbackByTaskId(
  taskId: string
): Promise<RewriteFeedback | undefined> {
  const [result] = await db()
    .select()
    .from(rewriteFeedback)
    .where(eq(rewriteFeedback.taskId, taskId))
    .orderBy(desc(rewriteFeedback.createdAt))
    .limit(1);

  return result;
}

/**
 * Get feedback list (for admin)
 */
export async function getRewriteFeedbacks({
  page = 1,
  limit = 30,
  taskId,
  userId,
  rating,
  startDate,
}: {
  page?: number;
  limit?: number;
  taskId?: string;
  userId?: string;
  rating?: number;
  startDate?: Date;
} = {}): Promise<RewriteFeedback[]> {
  const conditions = [];

  if (taskId) {
    conditions.push(eq(rewriteFeedback.taskId, taskId));
  }

  if (userId) {
    conditions.push(eq(rewriteFeedback.userId, userId));
  }

  if (rating !== undefined) {
    conditions.push(eq(rewriteFeedback.rating, rating));
  }

  if (startDate) {
    conditions.push(gte(rewriteFeedback.createdAt, startDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db()
    .select()
    .from(rewriteFeedback)
    .where(whereClause)
    .orderBy(desc(rewriteFeedback.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

/**
 * Get feedback count
 */
export async function getRewriteFeedbacksCount({
  taskId,
  userId,
  rating,
  startDate,
}: {
  taskId?: string;
  userId?: string;
  rating?: number;
  startDate?: Date;
} = {}): Promise<number> {
  const conditions = [];

  if (taskId) {
    conditions.push(eq(rewriteFeedback.taskId, taskId));
  }

  if (userId) {
    conditions.push(eq(rewriteFeedback.userId, userId));
  }

  if (rating !== undefined) {
    conditions.push(eq(rewriteFeedback.rating, rating));
  }

  if (startDate) {
    conditions.push(gte(rewriteFeedback.createdAt, startDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [result] = await db()
    .select({ count: count() })
    .from(rewriteFeedback)
    .where(whereClause);

  return result?.count || 0;
}

/**
 * Get feedback statistics (for admin dashboard)
 */
export async function getRewriteFeedbackStats(
  days: number = 30
): Promise<{
  total: number;
  positive: number; // rating >= 4
  negative: number; // rating <= 2
  neutral: number; // rating === 3
  averageRating: number;
  positiveRate: string;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [stats] = await db()
    .select({
      total: count(),
      positive: sql<number>`count(*) filter (where ${rewriteFeedback.rating} >= 4)`,
      negative: sql<number>`count(*) filter (where ${rewriteFeedback.rating} <= 2)`,
      neutral: sql<number>`count(*) filter (where ${rewriteFeedback.rating} = 3)`,
      averageRating: sql<number>`avg(${rewriteFeedback.rating})`,
    })
    .from(rewriteFeedback)
    .where(gte(rewriteFeedback.createdAt, startDate));

  const total = stats?.total || 0;
  const positive = stats?.positive || 0;
  const negative = stats?.negative || 0;
  const neutral = stats?.neutral || 0;
  const averageRating = stats?.averageRating ? Number(stats.averageRating) : 0;
  const positiveRate = total > 0 ? ((positive / total) * 100).toFixed(1) : '0.0';

  return {
    total,
    positive,
    negative,
    neutral,
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    positiveRate: `${positiveRate}%`,
  };
}
