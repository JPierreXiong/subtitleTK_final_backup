/**
 * 初始化管理员脚本
 * 
 * 此脚本将指定邮箱设置为超级管理员（super_admin）
 * 
 * 使用方法:
 *   npx tsx src/scripts/init-admin.ts
 * 
 * 注意: 执行完成后建议删除此脚本文件，以防在生产环境被误用
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { user, role, userRole } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

const ADMIN_EMAIL = 'xiongjp_fr@163.com';

async function initAdmin() {
  try {
    console.log('🚀 开始初始化管理员...\n');

    // 步骤1: 查找用户
    console.log(`📧 查找用户: ${ADMIN_EMAIL}`);
    const [adminUser] = await db()
      .select()
      .from(user)
      .where(eq(user.email, ADMIN_EMAIL));

    if (!adminUser) {
      console.error(`❌ 错误: 未找到用户 ${ADMIN_EMAIL}`);
      console.log('\n💡 提示:');
      console.log('   1. 请确保该邮箱已注册并登录过系统');
      console.log('   2. 如果未注册，请先访问登录页面完成注册');
      process.exit(1);
    }

    console.log(`✅ 找到用户: ${adminUser.name} (${adminUser.email})\n`);

    // 步骤2: 查找或创建 super_admin 角色
    console.log('🔍 查找 super_admin 角色...');
    let [superAdminRole] = await db()
      .select()
      .from(role)
      .where(eq(role.name, 'super_admin'));

    if (!superAdminRole) {
      console.log('⚠️  super_admin 角色不存在，正在创建...');
      
      // 创建 super_admin 角色
      const roleId = getUuid();
      await db().insert(role).values({
        id: roleId,
        name: 'super_admin',
        title: 'Super Admin',
        description: 'Full system access with all permissions',
        status: 'active',
        sort: 1,
      });

      [superAdminRole] = await db()
        .select()
        .from(role)
        .where(eq(role.id, roleId));

      console.log('✅ super_admin 角色创建成功\n');
    } else {
      console.log(`✅ 找到角色: ${superAdminRole.title}\n`);
    }

    // 步骤3: 检查用户是否已有该角色
    console.log('🔍 检查用户角色...');
    const [existingUserRole] = await db()
      .select()
      .from(userRole)
      .where(
        and(
          eq(userRole.userId, adminUser.id),
          eq(userRole.roleId, superAdminRole.id)
        )
      );

    if (existingUserRole) {
      console.log('ℹ️  用户已经是超级管理员，无需重复设置');
      console.log('\n✅ 设置完成！');
      process.exit(0);
    }

    // 步骤4: 分配角色
    console.log('🔄 正在分配 super_admin 角色...');
    await db().insert(userRole).values({
      id: getUuid(),
      userId: adminUser.id,
      roleId: superAdminRole.id,
    });

    console.log('\n🎉 设置完成！');
    console.log('\n📊 摘要:');
    console.log(`   用户: ${adminUser.name} (${adminUser.email})`);
    console.log(`   角色: ${superAdminRole.title} (${superAdminRole.name})`);
    console.log('\n💡 下一步:');
    console.log('   1. 退出并重新登录以刷新权限');
    console.log('   2. 访问 http://localhost:3000/admin/settings/payment 验证权限');
    console.log('   3. 建议删除此脚本文件: src/scripts/init-admin.ts');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行初始化
initAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });










