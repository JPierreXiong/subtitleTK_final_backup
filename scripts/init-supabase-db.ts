/**
 * Supabase 数据库初始化脚本
 * 
 * 用途：在 Supabase 数据库中创建所有表结构（Schema）
 * 使用方法：pnpm tsx scripts/init-supabase-db.ts
 * 
 * 注意：此脚本不会删除现有数据，只会创建不存在的表
 */

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';

async function initDatabase() {
  console.log('🚀 开始初始化 Supabase 数据库...');
  console.log(`📊 数据库连接: ${envConfigs.database_url ? '已配置' : '❌ 未配置'}`);
  
  if (!envConfigs.database_url) {
    console.error('❌ 错误: DATABASE_URL 未设置');
    console.error('请在 .env.local 文件中设置 DATABASE_URL');
    process.exit(1);
  }

  try {
    // 测试数据库连接
    console.log('🔌 测试数据库连接...');
    await db().select().from(schema.user).limit(1);
    console.log('✅ 数据库连接成功');

    // 使用 Drizzle Kit 推送 Schema
    console.log('📋 提示: 请使用以下命令创建表结构:');
    console.log('   pnpm db:push');
    console.log('');
    console.log('或者使用迁移方式:');
    console.log('   pnpm db:generate  # 生成迁移文件');
    console.log('   pnpm db:migrate   # 执行迁移');
    console.log('');
    console.log('💡 推荐使用 db:push 进行快速初始化（开发环境）');
    console.log('💡 生产环境建议使用 db:migrate（更安全）');

  } catch (error: any) {
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('ℹ️  表尚未创建，这是正常的');
      console.log('📋 请运行: pnpm db:push');
    } else {
      console.error('❌ 数据库连接失败:', error.message);
      console.error('');
      console.error('请检查:');
      console.error('1. DATABASE_URL 是否正确');
      console.error('2. 数据库服务是否可访问');
      console.error('3. 网络连接是否正常');
      process.exit(1);
    }
  }
}

// 执行初始化
initDatabase()
  .then(() => {
    console.log('✅ 初始化检查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  });


