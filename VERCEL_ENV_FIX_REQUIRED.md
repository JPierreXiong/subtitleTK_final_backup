# Vercel 环境变量修复清单

## ❌ 发现的问题

根据自动检查结果，发现以下配置问题：

### 1. 缺失的关键变量

- ❌ **DATABASE_URL**: 未设置（最严重！）
- ❌ **AUTH_URL**: 未设置

### 2. 值格式不正确

- ⚠️ **DATABASE_PROVIDER**: 值不符合预期格式（应该是 `postgresql`）
- ⚠️ **NEXT_PUBLIC_APP_URL**: 值不符合预期格式（应该是有效的 URL，如 `https://www.subtitletk.app`）

### 3. 需要删除的变量

以下变量存在但应该删除（代码不使用这些变量）：
- ❌ **AUTH_DATABASE_URL**: 存在（应删除）
- ❌ **POSTGRES_URL**: 存在（应删除）
- ❌ **POSTGRES_PRISMA_URL**: 存在（应删除）
- ❌ **POSTGRES_URL_NON_POOLING**: 存在（应删除）

## 🔧 修复步骤

### 步骤 1: 添加缺失的变量

在 Vercel Dashboard -> Settings -> Environment Variables 中添加：

#### DATABASE_URL（必需）

1. 点击 "Add New"
2. Key: `DATABASE_URL`
3. Value: 你的 Supabase Pooler 连接字符串
   ```
   postgresql://postgres.qeqgoztrtyrfzkgpfhvx:你的密码@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
   ```
   ⚠️ **重要**：
   - 必须使用 Pooler 地址（端口 6543）
   - 必须包含 `?pgbouncer=true`
   - 从你的 Supabase Dashboard 获取正确的连接字符串

4. Environment: 选择 `Production`, `Preview`, `Development`（全选）
5. 点击 "Save"

#### AUTH_URL（必需）

1. 点击 "Add New"
2. Key: `AUTH_URL`
3. Value: `https://www.subtitletk.app`
4. Environment: 选择 `Production`, `Preview`, `Development`（全选）
5. 点击 "Save"

### 步骤 2: 修复格式不正确的变量

#### DATABASE_PROVIDER

1. 找到现有的 `DATABASE_PROVIDER` 变量
2. 点击编辑（铅笔图标）
3. 确保 Value 为：`postgresql`（不是 `postgres`）
4. 点击 "Save"

#### NEXT_PUBLIC_APP_URL

1. 找到现有的 `NEXT_PUBLIC_APP_URL` 变量
2. 点击编辑（铅笔图标）
3. 确保 Value 为：`https://www.subtitletk.app`
4. 点击 "Save"

### 步骤 3: 删除不需要的变量

删除以下变量（代码不使用它们，可能会造成混淆）：

1. **AUTH_DATABASE_URL**
   - 找到该变量
   - 点击删除（垃圾桶图标）
   - 确认删除

2. **POSTGRES_URL**
   - 找到该变量
   - 点击删除
   - 确认删除

3. **POSTGRES_PRISMA_URL**
   - 找到该变量
   - 点击删除
   - 确认删除

4. **POSTGRES_URL_NON_POOLING**
   - 找到该变量
   - 点击删除
   - 确认删除

## ✅ 修复后的验证清单

修复完成后，确认以下变量：

- [ ] `DATABASE_URL` 已设置，指向 Supabase Pooler（端口 6543）
- [ ] `DATABASE_PROVIDER` 值为 `postgresql`
- [ ] `AUTH_SECRET` 已设置（✅ 已存在）
- [ ] `AUTH_URL` 已设置，值为 `https://www.subtitletk.app`
- [ ] `NEXT_PUBLIC_APP_URL` 值为 `https://www.subtitletk.app`
- [ ] `AUTH_DATABASE_URL` 已删除
- [ ] `POSTGRES_URL` 已删除
- [ ] `POSTGRES_PRISMA_URL` 已删除
- [ ] `POSTGRES_URL_NON_POOLING` 已删除

## 🚀 修复后的操作

### 1. 重新部署 Vercel（必须！）

1. 在 Vercel Dashboard 中点击 "Deployments"
2. 找到最新的部署
3. 点击 "..." -> "Redeploy"
4. ⚠️ **重要**：取消勾选 "Use existing Build Cache"
5. 点击 "Redeploy"
6. 等待部署完成（通常 2-5 分钟）

### 2. 验证修复

运行以下命令验证：

```bash
# 使用你的 Vercel Token 重新检查
VERCEL_TOKEN="你的token" pnpm check:vercel-env

# 测试认证功能
pnpm test:vercel-auth
```

## 📝 获取 Supabase 连接字符串

如果不知道 `DATABASE_URL` 的值，从 Supabase Dashboard 获取：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击 "Settings" -> "Database"
4. 找到 "Connection string" 部分
5. 选择 "Connection pooling" 标签
6. 选择 "Transaction" 模式
7. 复制连接字符串（格式：`postgresql://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`）

## ⚠️ 重要提示

1. **DATABASE_URL 是最关键的变量**，如果未设置或设置错误，认证功能将完全无法工作
2. 修改环境变量后，**必须重新部署**才能生效
3. 删除不需要的变量可以避免混淆，但不会影响功能（代码不使用它们）

## 🔍 如果问题仍然存在

如果修复后仍然有问题：

1. 运行 `pnpm check:vercel-env` 再次检查
2. 检查 Vercel Logs（参考 `scripts/check-vercel-logs.md`）
3. 运行 `pnpm diagnose:auth` 检查数据库连接
4. 运行 `pnpm test:vercel-auth` 测试认证功能



