/**
 * 检查 Session 状态
 * 使用方法: pnpm check:session
 */

import { db } from '../src/core/db';
import { session, user } from '../src/config/db/schema';
import { eq, gte, desc } from 'drizzle-orm';

async function checkSessionStatus() {
  console.log('========================================');
  console.log('  Session 状态检查');
  console.log('========================================');
  console.log('');

  try {
    const database = db();

    // 1. 检查 Session 表总数
    console.log('📋 步骤 1: 检查 Session 表');
    console.log('----------------------------------------');
    const allSessions = await database.select().from(session);
    console.log(`Session 表总记录数: ${allSessions.length}`);
    console.log('');

    if (allSessions.length === 0) {
      console.log('⚠️  Session 表为空！');
      console.log('');
      console.log('这会导致:');
      console.log('  - 登录后无法保持会话');
      console.log('  - 任务提交时认证失败');
      console.log('  - 进度更新被拦截');
      console.log('');
      console.log('解决方案:');
      console.log('  1. 在 Supabase SQL Editor 中运行 scripts/fix-supabase-rls.sql');
      console.log('  2. 重新登录');
      console.log('  3. 检查 Session 表是否有新记录');
      console.log('');
    } else {
      console.log('✅ Session 表有记录');
      console.log('');
    }

    // 2. 检查有效的 Session（未过期）
    console.log('📋 步骤 2: 检查有效的 Session');
    console.log('----------------------------------------');
    const now = new Date();
    const validSessions = allSessions.filter(s => new Date(s.expiresAt) > now);
    console.log(`有效 Session 数: ${validSessions.length}`);
    console.log(`过期 Session 数: ${allSessions.length - validSessions.length}`);
    console.log('');

    if (validSessions.length > 0) {
      console.log('有效的 Session:');
      validSessions.slice(0, 5).forEach((s, index) => {
        const expiresAt = new Date(s.expiresAt);
        const createdAt = new Date(s.createdAt);
        console.log(`\n  ${index + 1}. Session ID: ${s.id.substring(0, 20)}...`);
        console.log(`     用户 ID: ${s.userId}`);
        console.log(`     创建时间: ${createdAt.toLocaleString()}`);
        console.log(`     过期时间: ${expiresAt.toLocaleString()}`);
        console.log(`     剩余时间: ${Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)} 分钟`);
      });
    }
    console.log('');

    // 3. 检查最近的 Session（最近 1 小时）
    console.log('📋 步骤 3: 检查最近的 Session（最近 1 小时）');
    console.log('----------------------------------------');
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentSessions = await database
      .select()
      .from(session)
      .where(gte(session.createdAt, oneHourAgo))
      .orderBy(desc(session.createdAt))
      .limit(10);

    console.log(`最近 1 小时内有 ${recentSessions.length} 个 Session`);
    console.log('');

    if (recentSessions.length > 0) {
      console.log('最近的 Session:');
      recentSessions.forEach((s, index) => {
        const createdAt = new Date(s.createdAt);
        const expiresAt = new Date(s.expiresAt);
        console.log(`\n  ${index + 1}. 创建时间: ${createdAt.toLocaleString()}`);
        console.log(`     过期时间: ${expiresAt.toLocaleString()}`);
        console.log(`     用户 ID: ${s.userId}`);
        if (s.ipAddress) {
          console.log(`     IP: ${s.ipAddress}`);
        }
      });
    } else {
      console.log('⚠️  最近 1 小时内没有新的 Session');
      console.log('   这可能意味着登录后 Session 没有成功创建');
      console.log('');
    }
    console.log('');

    // 4. 检查 Session 与用户的关联
    console.log('📋 步骤 4: 检查 Session 与用户的关联');
    console.log('----------------------------------------');
    if (validSessions.length > 0) {
      const userIds = [...new Set(validSessions.map(s => s.userId))];
      console.log(`有 ${userIds.length} 个用户有有效 Session`);
      console.log('');

      for (const userId of userIds.slice(0, 5)) {
        const userInfo = await database
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        if (userInfo.length > 0) {
          const u = userInfo[0];
          const userSessions = validSessions.filter(s => s.userId === userId);
          console.log(`  用户: ${u.email} (${u.name})`);
          console.log(`    有效 Session 数: ${userSessions.length}`);
        }
      }
    }
    console.log('');

    // 5. 诊断建议
    console.log('========================================');
    console.log('  诊断建议');
    console.log('========================================');
    console.log('');

    if (allSessions.length === 0) {
      console.log('❌ 严重问题: Session 表为空');
      console.log('');
      console.log('必须修复:');
      console.log('  1. 运行 scripts/fix-supabase-rls.sql 禁用 RLS');
      console.log('  2. 重新登录');
      console.log('  3. 验证 Session 表有新记录');
      console.log('');
    } else if (validSessions.length === 0) {
      console.log('⚠️  所有 Session 已过期');
      console.log('');
      console.log('建议:');
      console.log('  1. 重新登录');
      console.log('  2. 检查 Session 过期时间设置');
      console.log('');
    } else {
      console.log('✅ Session 状态正常');
      console.log('');
      console.log('如果任务仍然卡住，可能的原因:');
      console.log('  1. API 调用超时');
      console.log('  2. Vercel Function 超时限制');
      console.log('  3. RapidAPI 响应慢');
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. 数据库连接失败');
    console.log('  2. 表不存在');
    console.log('  3. 权限问题');
    console.log('');
  }
}

// 运行检查
checkSessionStatus().catch((error) => {
  console.error('检查过程中出错:', error);
  process.exit(1);
});

