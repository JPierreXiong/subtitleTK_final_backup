# Vercel 环境变量检查清单

## 🔍 必须检查的环境变量

请在 Vercel Dashboard -> Settings -> Environment Variables 中检查以下变量：

### 必需变量

1. **DATABASE_URL** ✅
   - 值应该是：`postgres://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`
   - ⚠️ **重要**：确保这是 Supabase Pooler 地址（端口 6543），不是直接连接
   - ⚠️ **重要**：确保包含 `?pgbouncer=true` 参数

2. **DATABASE_PROVIDER** ✅
   - 值应该是：`postgresql`
   - ⚠️ **注意**：不是 `postgres`，必须是 `postgresql`

3. **AUTH_SECRET** ✅
   - 值应该是：一个长随机字符串（通常由 `openssl rand -base64 32` 生成）
   - ⚠️ **重要**：必须与本地 `.env.local` 中的值一致

4. **AUTH_URL** ✅
   - 值应该是：`https://www.subtitletk.app`
   - 或者：`https://www.subtitletk.app`（生产环境）

5. **NEXT_PUBLIC_APP_URL** ✅
   - 值应该是：`https://www.subtitletk.app`

### 需要删除的变量

- ❌ **AUTH_DATABASE_URL** - 如果存在，请删除（代码不使用此变量）
- ❌ **POSTGRES_URL** - 如果存在且指向 Neon，请删除
- ❌ **POSTGRES_PRISMA_URL** - 如果存在且指向 Neon，请删除
- ❌ **POSTGRES_URL_NON_POOLING** - 如果存在且指向 Neon，请删除

### 检查步骤

1. 登录 Vercel Dashboard
2. 进入项目设置
3. 点击 "Environment Variables"
4. 检查每个变量：
   - ✅ 确认 `DATABASE_URL` 指向 Supabase
   - ✅ 确认 `DATABASE_PROVIDER` 为 `postgresql`
   - ✅ 确认 `AUTH_SECRET` 已设置
   - ❌ 删除所有指向 Neon 的变量
   - ❌ 删除 `AUTH_DATABASE_URL`（如果存在）

### 修改后的操作

1. **必须重新部署**：
   - 在 Vercel Dashboard 中点击 "Deployments"
   - 找到最新的部署
   - 点击 "..." -> "Redeploy"
   - ⚠️ **重要**：取消勾选 "Use existing Build Cache"
   - 点击 "Redeploy"

2. **验证部署**：
   - 等待部署完成
   - 运行 `pnpm test:vercel-auth` 测试认证功能

## 🔧 常见问题

### 问题 1: 环境变量已更新但未生效

**原因**：Vercel 缓存了旧的构建

**解决**：
1. 重新部署（不使用缓存）
2. 清除浏览器缓存
3. 等待 1-2 分钟让 CDN 更新

### 问题 2: 仍然连接到 Neon

**原因**：Neon 集成可能自动注入了 `DATABASE_URL`

**解决**：
1. 在 Vercel Dashboard 中卸载 Neon 集成
2. 手动设置 `DATABASE_URL` 为 Supabase 地址
3. 重新部署

### 问题 3: AUTH_SECRET 不匹配

**原因**：本地和生产环境的 `AUTH_SECRET` 不同

**解决**：
1. 检查本地 `.env.local` 中的 `AUTH_SECRET`
2. 确保 Vercel 中的值与之完全一致
3. 如果不一致，更新 Vercel 中的值并重新部署

## 📝 验证命令

在本地运行以下命令验证配置：

```bash
# 检查本地环境变量
pnpm diagnose:auth

# 测试 Vercel 部署
pnpm test:vercel-auth
```



