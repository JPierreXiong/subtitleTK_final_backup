/**
 * 重置卡住的任务
 * 使用方法: pnpm reset:stuck-tasks
 * 
 * ⚠️ 警告：此脚本会将所有超过 5 分钟的 processing 任务标记为 failed
 */

import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function resetStuckTasks() {
  console.log('========================================');
  console.log('  重置卡住的任务');
  console.log('========================================');
  console.log('');

  try {
    const database = db();

    // 查找超过 5 分钟的 processing 任务
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

    if (stuckTasks.length === 0) {
      console.log('✅ 没有发现卡住的任务');
      console.log('');
      return;
    }

    console.log(`找到 ${stuckTasks.length} 个卡住的任务（超过 5 分钟）`);
    console.log('');

    // 显示将要重置的任务
    console.log('将要重置的任务:');
    stuckTasks.forEach((task, index) => {
      const createdAt = new Date(task.createdAt);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);
      
      console.log(`\n${index + 1}. 任务 ID: ${task.id}`);
      console.log(`   平台: ${task.platform}`);
      console.log(`   类型: ${task.outputType}`);
      console.log(`   URL: ${task.url}`);
      console.log(`   已卡住: ${minutesAgo} 分钟`);
    });
    console.log('');

    // 确认重置
    console.log('⚠️  即将重置这些任务为 failed 状态');
    console.log('   这将触发自动退款逻辑');
    console.log('');

    // 重置任务
    let resetCount = 0;
    for (const task of stuckTasks) {
      const createdAt = new Date(task.createdAt);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);

      try {
        await database
          .update(mediaTasks)
          .set({
            status: 'failed',
            errorMessage: `Manual reset - stuck for ${minutesAgo} minutes`,
            updatedAt: new Date(),
          })
          .where(eq(mediaTasks.id, task.id));

        console.log(`✅ 已重置: ${task.id} (${task.platform})`);
        resetCount++;
      } catch (error: any) {
        console.log(`❌ 重置失败: ${task.id} - ${error.message}`);
      }
    }

    console.log('');
    console.log('========================================');
    console.log(`  重置完成: ${resetCount}/${stuckTasks.length} 个任务`);
    console.log('========================================');
    console.log('');
    console.log('💡 提示:');
    console.log('  - 已重置的任务会触发自动退款');
    console.log('  - 用户可以重新提交任务');
    console.log('  - 如果问题持续，请检查 Vercel Logs 和 API 超时设置');
    console.log('');

  } catch (error: any) {
    console.error('❌ 重置失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行重置
resetStuckTasks().catch((error) => {
  console.error('重置过程中出错:', error);
  process.exit(1);
});
