# 401 认证错误完整修复指南

## 🎯 问题根源

根据诊断结果，核心问题是：
1. **Session 表为空** - 登录后无法创建会话记录
2. **可能的原因**：
   - RLS (Row Level Security) 阻止写入
   - 表结构不匹配
   - Vercel 环境变量配置错误

## 📋 完整修复流程

### 步骤 1: 修复 Supabase RLS（最重要）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **打开 SQL Editor**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "New query"

3. **运行修复脚本**
   - 复制 `scripts/fix-supabase-rls.sql` 的内容
   - 粘贴到 SQL Editor
   - 点击 "Run" 执行

4. **验证结果**
   - 脚本会显示 RLS 状态
   - 如果看到 "✅ Session 表写入测试成功！"，说明修复成功

### 步骤 2: 验证表结构

在本地运行：

```bash
pnpm verify:schema
```

这个命令会检查：
- 表是否存在
- 字段是否匹配
- 类型是否正确

**如果表不存在**，运行：

```bash
pnpm db:push
```

### 步骤 3: 检查 Vercel 环境变量

参考 `scripts/check-vercel-env.md`，确保：

1. **DATABASE_URL** 指向 Supabase
   - 格式：`postgresql://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`
   - ⚠️ 必须是 Pooler 地址（端口 6543）

2. **DATABASE_PROVIDER** 为 `postgresql`

3. **AUTH_SECRET** 与本地一致

4. **删除不需要的变量**
   - `AUTH_DATABASE_URL`（如果存在）
   - 所有 Neon 相关变量

### 步骤 4: 重新部署 Vercel

**重要**：必须重新部署才能生效！

1. 登录 Vercel Dashboard
2. 进入项目
3. 点击 "Deployments"
4. 找到最新部署，点击 "..." -> "Redeploy"
5. ⚠️ **取消勾选** "Use existing Build Cache"
6. 点击 "Redeploy"
7. 等待部署完成（通常 2-5 分钟）

### 步骤 5: 检查 Vercel Logs

如果问题仍然存在，检查日志：

1. **在 Vercel Dashboard 中**：
   - 进入 "Deployments"
   - 选择最新部署
   - 点击 "Functions" 标签
   - 找到 `/api/auth/[...all]`
   - 查看 "Logs"

2. **查找错误信息**：
   - 参考 `scripts/check-vercel-logs.md`
   - 查找关键词：`permission denied`、`row-level security`、`column does not exist`

### 步骤 6: 测试修复

1. **运行自动化测试**：
   ```bash
   pnpm test:vercel-auth
   ```

2. **手动测试**：
   - 在浏览器中访问 https://www.subtitletk.app/sign-up
   - 注册一个新账号
   - 尝试登录
   - 检查 Supabase 中的 `session` 表是否有新记录

## 🔍 验证清单

修复后，确认以下项：

- [ ] Supabase RLS 已禁用或配置策略
- [ ] Session 表可以写入（运行测试脚本验证）
- [ ] Vercel 环境变量正确
- [ ] Vercel 已重新部署（不使用缓存）
- [ ] `pnpm test:vercel-auth` 显示 Sign In 成功
- [ ] Supabase 中的 `session` 表有新记录

## 🚨 常见问题

### 问题 1: RLS 禁用后仍然无法写入

**可能原因**：
- 表权限问题
- 外键约束问题

**解决**：
```sql
-- 检查表权限
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'session';

-- 如果需要，授予权限
GRANT ALL ON "session" TO postgres;
```

### 问题 2: 表结构不匹配

**可能原因**：
- Schema 定义与数据库不一致
- 字段名大小写问题

**解决**：
```bash
# 重新推送 schema
pnpm db:push
```

### 问题 3: Vercel 环境变量未生效

**可能原因**：
- 未重新部署
- 使用了缓存

**解决**：
1. 确认环境变量已保存
2. 重新部署（不使用缓存）
3. 等待 2-3 分钟让 CDN 更新

### 问题 4: Sign In 仍然返回 401

**检查项**：
1. Vercel Logs 中的错误信息
2. Supabase 中的 `session` 表是否有新记录
3. Cookie 是否正确设置

**如果 Session 表仍然为空**：
- 检查 Vercel Logs 中的 SQL 错误
- 可能是字段名不匹配（驼峰 vs 蛇形）

## 📞 需要帮助？

如果问题仍然存在，请提供：

1. **Supabase SQL 查询结果**：
   - RLS 状态
   - Session 表结构
   - 写入测试结果

2. **Vercel Logs**：
   - 登录尝试时的错误信息
   - 完整的错误堆栈

3. **测试结果**：
   - `pnpm test:vercel-auth` 的完整输出
   - `pnpm verify:schema` 的结果

## 🎯 预期结果

修复成功后：

- ✅ Sign Up 成功
- ✅ Sign In 成功
- ✅ Session 表有新记录
- ✅ Get Session 返回用户信息
- ✅ Sign Out 成功

## 📝 下一步

修复完成后：

1. 考虑在生产环境配置合适的 RLS 策略（而不是完全禁用）
2. 监控 Session 表的记录数
3. 定期检查 Vercel Logs 是否有错误

