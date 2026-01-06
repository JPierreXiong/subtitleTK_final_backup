/**
 * 诊断 401 认证错误的脚本
 * 检查数据库连接、环境变量、用户表状态
 */

import { db } from '../src/core/db';
import { envConfigs } from '../src/config';
import { user } from '../src/config/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseAuth401() {
  console.log('========================================');
  console.log('  401 认证错误诊断工具');
  console.log('========================================');
  console.log('');

  // 1. 检查环境变量
  console.log('📋 步骤 1: 检查环境变量');
  console.log('----------------------------------------');
  console.log(`DATABASE_URL: ${envConfigs.database_url ? '✅ 已设置' : '❌ 未设置'}`);
  if (envConfigs.database_url) {
    // 隐藏密码显示
    const url = envConfigs.database_url;
    const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
    console.log(`  连接字符串: ${maskedUrl}`);
  }
  console.log(`DATABASE_PROVIDER: ${envConfigs.database_provider}`);
  console.log(`AUTH_SECRET: ${envConfigs.auth_secret ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`AUTH_URL: ${envConfigs.auth_url || '未设置（使用默认）'}`);
  console.log(`APP_URL: ${envConfigs.app_url}`);
  console.log('');

  // 2. 测试数据库连接
  console.log('📋 步骤 2: 测试数据库连接');
  console.log('----------------------------------------');
  try {
    const database = db();
    console.log('✅ 数据库连接对象创建成功');
    
    // 尝试查询用户表
    const userCount = await database.select().from(user).limit(1);
    console.log('✅ 用户表查询成功（数据库连接正常）');
  } catch (error: any) {
    console.log('❌ 数据库连接失败');
    console.log(`   错误信息: ${error.message}`);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. DATABASE_URL 配置错误');
    console.log('  2. 数据库服务器不可访问');
    console.log('  3. 数据库表尚未初始化（需要运行 pnpm db:push）');
    console.log('  4. 网络连接问题');
    return;
  }
  console.log('');

  // 3. 检查用户表结构
  console.log('📋 步骤 3: 检查用户表数据');
  console.log('----------------------------------------');
  try {
    const database = db();
    const allUsers = await database.select().from(user).limit(10);
    console.log(`✅ 用户表存在，当前有 ${allUsers.length} 条记录（显示前10条）`);
    console.log('');
    
    if (allUsers.length > 0) {
      console.log('用户列表:');
      allUsers.forEach((u: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${u.id}`);
        console.log(`     Email: ${u.email}`);
        console.log(`     Name: ${u.name}`);
        console.log(`     Email Verified: ${u.emailVerified}`);
        console.log(`     Created At: ${u.createdAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  用户表为空，没有注册用户');
      console.log('');
      console.log('建议:');
      console.log('  1. 在应用中重新注册一个新用户');
      console.log('  2. 确保注册时使用的是正确的数据库连接');
    }
  } catch (error: any) {
    console.log('❌ 查询用户表失败');
    console.log(`   错误信息: ${error.message}`);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. 用户表不存在（需要运行 pnpm db:push）');
    console.log('  2. 表名不匹配（应该是 "user"，不是 "User"）');
    console.log('  3. 数据库权限问题');
  }
  console.log('');

  // 4. 检查认证相关表
  console.log('📋 步骤 4: 检查认证相关表');
  console.log('----------------------------------------');
  try {
    const database = db();
    const schemaModule = await import('../src/config/db/schema');
    
    // 检查 session 表
    try {
      const sessions = await database.select().from(schemaModule.session).limit(5);
      console.log(`✅ Session 表存在，有 ${sessions.length} 条记录（显示前5条）`);
    } catch (error: any) {
      console.log(`⚠️  Session 表查询失败: ${error.message}`);
    }

    // 检查 account 表
    try {
      const accounts = await database.select().from(schemaModule.account).limit(5);
      console.log(`✅ Account 表存在，有 ${accounts.length} 条记录（显示前5条）`);
    } catch (error: any) {
      console.log(`⚠️  Account 表查询失败: ${error.message}`);
    }

    // 检查 verification 表
    try {
      const verifications = await database.select().from(schemaModule.verification).limit(5);
      console.log(`✅ Verification 表存在，有 ${verifications.length} 条记录（显示前5条）`);
    } catch (error: any) {
      console.log(`⚠️  Verification 表查询失败: ${error.message}`);
    }
  } catch (error: any) {
    console.log(`⚠️  检查认证表时出错: ${error.message}`);
  }
  console.log('');

  // 5. 诊断建议
  console.log('📋 步骤 5: 诊断建议');
  console.log('----------------------------------------');
  console.log('如果遇到 401 错误，请检查以下事项:');
  console.log('');
  console.log('1. 环境变量配置:');
  console.log('   ✅ 确保 Vercel 中的 DATABASE_URL 指向 Supabase');
  console.log('   ✅ 确保 DATABASE_PROVIDER 设置为 "postgresql"');
  console.log('   ✅ 确保 AUTH_SECRET 已正确配置');
  console.log('');
  console.log('2. 数据库迁移:');
  console.log('   ✅ 确保已运行 pnpm db:push 创建所有表');
  console.log('   ✅ 确保 Supabase 数据库已正确初始化');
  console.log('');
  console.log('3. 用户数据:');
  console.log('   ✅ 如果用户表为空，需要重新注册');
  console.log('   ✅ 确保注册时使用的是正确的数据库');
  console.log('');
  console.log('4. Vercel 部署:');
  console.log('   ✅ 修改环境变量后，必须重新部署（Redeploy）');
  console.log('   ✅ 确保已卸载旧的 Neon 集成');
  console.log('');
  console.log('5. Supabase 配置:');
  console.log('   ✅ 检查 Supabase 的 Row Level Security (RLS) 设置');
  console.log('   ✅ 确保服务端可以访问 user 表');
  console.log('');

  console.log('========================================');
  console.log('  诊断完成');
  console.log('========================================');
}

// 运行诊断
diagnoseAuth401().catch((error) => {
  console.error('诊断过程中出错:', error);
  process.exit(1);
});

