import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { requireAdminAccess } from '@/core/rbac/permission';
import { respData, respErr } from '@/shared/lib/resp';
import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';

/**
 * GET /api/admin/monitor
 * Real-time system monitoring for admin
 * Only accessible by admin users
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check admin access
    await requireAdminAccess({
      redirectUrl: '/admin/no-permission',
      locale: 'en',
    });

    // 1. Get database connection pool status
    let poolStats;
    try {
      const result = await db().execute(sql`
        SELECT 
          count(*)::int as total_conns,
          count(*) filter (where state = 'active')::int as active_conns,
          count(*) filter (where state = 'idle')::int as idle_conns
        FROM pg_stat_activity 
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
      `);
      poolStats = result[0] || { total_conns: 0, active_conns: 0, idle_conns: 0 };
    } catch (error) {
      console.error('[Monitor] Failed to get pool stats:', error);
      poolStats = { total_conns: 0, active_conns: 0, idle_conns: 0 };
    }

    // 2. Get ongoing rewrite tasks
    const ongoingTasksResult = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(mediaTasks)
      .where(sql`${mediaTasks.status} = 'processing' AND ${mediaTasks.subtitleRewritten} IS NULL`);

    const ongoingTasks = ongoingTasksResult[0]?.count || 0;

    // 3. Get completed tasks in last 24 hours
    const last24hResult = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(mediaTasks)
      .where(
        sql`${mediaTasks.status} = 'completed' AND ${mediaTasks.updatedAt} > now() - interval '24 hours'`
      );

    const last24hCompleted = last24hResult[0]?.count || 0;

    // 4. Get failed tasks in last 24 hours
    const failed24hResult = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(mediaTasks)
      .where(
        sql`${mediaTasks.status} = 'failed' AND ${mediaTasks.updatedAt} > now() - interval '24 hours'`
      );

    const last24hFailed = failed24hResult[0]?.count || 0;

    // 5. Get tasks with rewritten content (successful rewrites)
    const rewrittenResult = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(mediaTasks)
      .where(
        sql`${mediaTasks.subtitleRewritten} IS NOT NULL AND ${mediaTasks.subtitleRewritten} != ''`
      );

    const totalRewritten = rewrittenResult[0]?.count || 0;

    // Calculate usage rate
    const totalConns = poolStats.total_conns || 1;
    const activeConns = poolStats.active_conns || 0;
    const usageRate = totalConns > 0 ? ((activeConns / totalConns) * 100).toFixed(1) : '0.0';

    return respData({
      timestamp: new Date().toISOString(),
      database: {
        total: poolStats.total_conns,
        active: poolStats.active_conns,
        idle: poolStats.idle_conns,
        usage_rate: `${usageRate}%`,
      },
      tasks: {
        ongoing: ongoingTasks,
        last_24h_completed: last24hCompleted,
        last_24h_failed: last24hFailed,
        total_rewritten: totalRewritten,
        success_rate_24h:
          last24hCompleted + last24hFailed > 0
            ? `${((last24hCompleted / (last24hCompleted + last24hFailed)) * 100).toFixed(1)}%`
            : 'N/A',
      },
    });
  } catch (error: any) {
    console.error('[Monitor] Error:', error);
    return respErr(error.message || 'Failed to get monitoring data');
  }
}
