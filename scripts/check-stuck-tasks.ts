/**
 * 检查卡住的任务
 * 使用方法: pnpm check:stuck-tasks
 */

import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function checkStuckTasks() {
  console.log('========================================');
  console.log('  检查卡住的任务');
  console.log('========================================');
  console.log('');

  try {
    const database = db();

    // 1. 检查所有 processing 状态的任务
    console.log('📋 步骤 1: 检查所有 processing 状态的任务');
    console.log('----------------------------------------');
    const processingTasks = await database
      .select()
      .from(mediaTasks)
      .where(eq(mediaTasks.status, 'processing'))
      .orderBy(mediaTasks.createdAt);

    console.log(`找到 ${processingTasks.length} 个 processing 状态的任务`);
    console.log('');

    if (processingTasks.length > 0) {
      console.log('卡住的任务列表:');
      processingTasks.forEach((task, index) => {
        const createdAt = new Date(task.createdAt);
        const now = new Date();
        const minutesAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);
        
        console.log(`\n${index + 1}. 任务 ID: ${task.id}`);
        console.log(`   平台: ${task.platform}`);
        console.log(`   类型: ${task.outputType}`);
        console.log(`   URL: ${task.url}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   进度: ${task.progress || 0}%`);
        console.log(`   创建时间: ${createdAt.toLocaleString()}`);
        console.log(`   已卡住: ${minutesAgo} 分钟`);
        if (task.errorMessage) {
          console.log(`   错误信息: ${task.errorMessage}`);
        }
        if (task.metadata) {
          console.log(`   元数据: ${JSON.stringify(task.metadata).substring(0, 100)}...`);
        }
      });
      console.log('');
    }

    // 2. 检查超过 5 分钟的 processing 任务（可能卡住）
    console.log('📋 步骤 2: 检查超过 5 分钟的 processing 任务');
    console.log('----------------------------------------');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckTasks = await database
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.status, 'processing'),
          sql`${mediaTasks.createdAt} < ${fiveMinutesAgo.toISOString()}`
        )
      )
      .orderBy(mediaTasks.createdAt);

    console.log(`找到 ${stuckTasks.length} 个可能卡住的任务（超过 5 分钟）`);
    console.log('');

    if (stuckTasks.length > 0) {
      console.log('⚠️  建议手动重置以下任务:');
      stuckTasks.forEach((task, index) => {
        const createdAt = new Date(task.createdAt);
        const now = new Date();
        const minutesAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);
        
        console.log(`\n${index + 1}. 任务 ID: ${task.id}`);
        console.log(`   平台: ${task.platform}`);
        console.log(`   URL: ${task.url}`);
        console.log(`   已卡住: ${minutesAgo} 分钟`);
        console.log(`   SQL 重置命令:`);
        console.log(`   UPDATE "media_tasks" SET status = 'failed', error_message = 'Manual reset - stuck for ${minutesAgo} minutes' WHERE id = '${task.id}';`);
      });
      console.log('');
    }

    // 3. 检查最近的任务（所有状态）
    console.log('📋 步骤 3: 检查最近 10 个任务（所有状态）');
    console.log('----------------------------------------');
    const recentTasks = await database
      .select()
      .from(mediaTasks)
      .orderBy(sql`${mediaTasks.createdAt} DESC`)
      .limit(10);

    console.log(`最近 10 个任务:`);
    recentTasks.forEach((task, index) => {
      const createdAt = new Date(task.createdAt);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);
      
      console.log(`\n${index + 1}. [${task.status.toUpperCase()}] ${task.platform} - ${task.outputType}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   URL: ${task.url?.substring(0, 50)}...`);
      console.log(`   进度: ${task.progress || 0}%`);
      console.log(`   时间: ${createdAt.toLocaleString()} (${minutesAgo} 分钟前)`);
      if (task.errorMessage) {
        console.log(`   错误: ${task.errorMessage.substring(0, 100)}...`);
      }
    });
    console.log('');

    // 4. 统计各状态的任务数量
    console.log('📋 步骤 4: 任务状态统计');
    console.log('----------------------------------------');
    const statusCounts = await database
      .select({
        status: mediaTasks.status,
        count: sql<number>`count(*)`,
      })
      .from(mediaTasks)
      .groupBy(mediaTasks.status);

    console.log('各状态的任务数量:');
    statusCounts.forEach(({ status, count }) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // 5. 检查 Session 表（认证问题可能导致任务卡住）
    console.log('📋 步骤 5: 检查 Session 表');
    console.log('----------------------------------------');
    try {
      const { session } = await import('../src/config/db/schema');
      const sessions = await database
        .select()
        .from(session)
        .orderBy(sql`${session.createdAt} DESC`)
        .limit(5);

      console.log(`Session 表中有 ${sessions.length} 条记录（显示最近 5 条）`);
      if (sessions.length === 0) {
        console.log('⚠️  Session 表为空！这可能导致认证问题，任务可能因此卡住。');
        console.log('   建议运行 scripts/fix-supabase-rls.sql 修复 RLS 设置');
      } else {
        sessions.forEach((s, index) => {
          const expiresAt = new Date(s.expiresAt);
          const now = new Date();
          const isExpired = expiresAt < now;
          console.log(`\n${index + 1}. Session ID: ${s.id.substring(0, 20)}...`);
          console.log(`   用户 ID: ${s.userId}`);
          console.log(`   过期时间: ${expiresAt.toLocaleString()}`);
          console.log(`   状态: ${isExpired ? '❌ 已过期' : '✅ 有效'}`);
        });
      }
    } catch (error: any) {
      console.log(`⚠️  检查 Session 表时出错: ${error.message}`);
    }
    console.log('');

    // 总结
    console.log('========================================');
    console.log('  检查总结');
    console.log('========================================');
    console.log('');
    if (stuckTasks.length > 0) {
      console.log('❌ 发现卡住的任务，建议手动重置');
      console.log('');
      console.log('修复步骤:');
      console.log('  1. 在 Supabase SQL Editor 中运行上述 SQL 命令');
      console.log('  2. 或者运行: pnpm reset:stuck-tasks');
      console.log('  3. 检查 Session 表是否正常');
      console.log('  4. 检查 Vercel Logs 中的超时错误');
    } else if (processingTasks.length > 0) {
      console.log('⚠️  有任务正在处理中，请等待或检查是否真的卡住');
    } else {
      console.log('✅ 没有发现卡住的任务');
    }
    console.log('');

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行检查
checkStuckTasks().catch((error) => {
  console.error('检查过程中出错:', error);
  process.exit(1);
});
