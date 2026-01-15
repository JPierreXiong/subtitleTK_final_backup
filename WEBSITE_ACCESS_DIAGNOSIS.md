# 网站访问问题诊断指南

## 🔴 问题：上周能访问，这周不行了

这种情况通常由以下几个原因导致，按优先级排查：

---

## 📋 快速诊断清单

### 1. 数据库连接数超限（最可能）✅ 已修复

**症状**：
- 网站返回 500 错误
- 控制台显示 "Max client connections reached"
- API 请求失败

**原因**：
- 连接数达到 Supabase 限制
- 代码未使用连接池优化

**解决方案**：
- ✅ **已修复**：代码已优化（`src/core/db/index.ts`）
- ✅ **需要操作**：
  1. 在 Vercel 设置环境变量：`DB_SINGLETON_ENABLED = true`
  2. 重新部署 Vercel
  3. 等待连接数自然下降（20秒空闲超时）

**验证**：
```sql
-- 在 Supabase SQL Editor 运行
SELECT count(*) 
FROM pg_stat_activity 
WHERE datname = current_database();
```

---

### 2. Vercel 环境变量过期或丢失

**症状**：
- 网站完全无法访问
- 或返回 500 错误
- Vercel 部署日志显示环境变量错误

**可能原因**：
- 环境变量被意外删除
- 环境变量值过期（如数据库密码）
- 环境变量格式错误

**检查步骤**：

1. **登录 Vercel Dashboard**
   - 进入项目 -> Settings -> Environment Variables

2. **检查必需变量**：
   ```
   ✅ DATABASE_URL (Supabase Pooler, 端口 6543)
   ✅ DATABASE_PROVIDER = postgresql
   ✅ AUTH_SECRET
   ✅ AUTH_URL
   ✅ NEXT_PUBLIC_APP_URL
   ✅ DB_SINGLETON_ENABLED = true (新增)
   ```

3. **验证 DATABASE_URL 格式**：
   ```
   正确格式：
   postgresql://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
   
   必须包含：
   - 端口 6543 (Pooler)
   - ?pgbouncer=true
   - sslmode=require
   ```

4. **重新部署**：
   - 修改环境变量后必须 Redeploy
   - 取消勾选 "Use existing Build Cache"

---

### 3. Supabase 配额用尽

**症状**：
- 数据库查询失败
- Supabase Dashboard 显示配额警告
- API 返回 503 或超时

**检查步骤**：

1. **登录 Supabase Dashboard**
   - 查看项目概览
   - 检查 "Usage" 标签

2. **检查配额**：
   - Database Size（数据库大小）
   - API Requests（API 请求数）
   - Bandwidth（带宽）
   - Connection Pool（连接池）

3. **如果配额用尽**：
   - 升级 Supabase 计划
   - 或清理不必要的数据

---

### 4. Vercel 部署失败

**症状**：
- 网站显示 "Deployment Error"
- 或显示旧的部署版本
- Vercel Dashboard 显示构建失败

**检查步骤**：

1. **查看 Vercel 部署日志**：
   - Vercel Dashboard -> Deployments
   - 点击最新的部署
   - 查看 "Build Logs" 和 "Function Logs"

2. **常见构建错误**：
   - 依赖安装失败
   - TypeScript 编译错误
   - 环境变量缺失

3. **解决方案**：
   - 修复构建错误
   - 重新部署
   - 如果构建缓存问题，清除缓存后重新部署

---

### 5. 域名/DNS 问题

**症状**：
- 网站完全无法访问
- 浏览器显示 "无法访问此网站"
- DNS 解析失败

**检查步骤**：

1. **检查域名状态**：
   ```bash
   # 检查 DNS 解析
   nslookup your-domain.com
   
   # 检查域名是否指向 Vercel
   dig your-domain.com
   ```

2. **检查 Vercel 域名设置**：
   - Vercel Dashboard -> Settings -> Domains
   - 确认域名已正确配置

3. **检查 SSL 证书**：
   - Vercel 会自动管理 SSL
   - 如果过期，Vercel 会显示警告

---

### 6. 代码更新导致的问题

**症状**：
- 上周正常，这周更新代码后无法访问
- 特定功能失效

**检查步骤**：

1. **查看 Git 提交历史**：
   ```bash
   git log --since="1 week ago" --oneline
   ```

2. **回滚到上周的版本**（如果需要）：
   ```bash
   git log --oneline  # 找到上周的 commit hash
   git checkout <commit-hash>
   git push --force  # 谨慎使用！
   ```

3. **或修复当前代码**：
   - 查看最近的错误日志
   - 修复问题后重新部署

---

## 🚀 快速修复流程（按顺序执行）

### Step 1: 检查 Vercel 部署状态

1. 登录 Vercel Dashboard
2. 查看最新部署是否成功
3. 如果失败，查看错误日志

### Step 2: 检查环境变量

1. 确认所有必需变量存在
2. 验证 `DATABASE_URL` 格式正确
3. 添加 `DB_SINGLETON_ENABLED = true`

### Step 3: 检查数据库连接

1. 在 Supabase SQL Editor 运行：
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
2. 如果连接数 > 50，等待自然超时或清理

### Step 4: 重新部署

1. 在 Vercel 点击 **Redeploy**
2. **取消勾选** "Use existing Build Cache"
3. 等待部署完成

### Step 5: 验证修复

1. 访问网站首页
2. 检查浏览器控制台错误
3. 测试关键功能（登录、API 调用）

---

## 🔍 详细诊断命令

### 检查 Vercel 部署

```bash
# 查看最近的部署
vercel ls

# 查看部署日志
vercel logs <deployment-url>
```

### 检查数据库连接

```sql
-- 查看连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看连接详情
SELECT pid, usename, state, query 
FROM pg_stat_activity 
WHERE datname = current_database();
```

### 检查环境变量（本地）

```bash
# 检查 .env.local
cat .env.local

# 验证环境变量格式
node -e "console.log(process.env.DATABASE_URL)"
```

---

## 📊 常见错误代码对照

| 错误代码 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 500 | 数据库连接失败 | 检查 DATABASE_URL 和连接数 |
| 503 | Supabase 配额用尽 | 升级计划或清理数据 |
| 401 | 认证失败 | 检查 AUTH_SECRET |
| 404 | 路由不存在 | 检查部署是否成功 |
| DNS Error | 域名配置问题 | 检查 Vercel 域名设置 |

---

## 🆘 如果问题仍然存在

1. **收集信息**：
   - Vercel 部署日志
   - 浏览器控制台错误
   - Supabase 连接数
   - 环境变量列表（隐藏敏感信息）

2. **检查时间线**：
   - 什么时候开始无法访问？
   - 这期间做了什么操作？
   - 是否有代码更新？

3. **联系支持**：
   - Vercel Support（如果是部署问题）
   - Supabase Support（如果是数据库问题）

---

## ✅ 预防措施

1. **定期监控**：
   - 每周检查 Supabase 配额
   - 监控连接数趋势
   - 查看 Vercel 部署状态

2. **环境变量备份**：
   - 保存环境变量列表
   - 使用版本控制（不包含敏感值）

3. **自动化测试**：
   - 部署后自动运行健康检查
   - 设置监控告警

---

**根据你的情况，最可能的原因是数据库连接数超限。我们已经修复了代码，现在需要：**
1. ✅ 设置 `DB_SINGLETON_ENABLED = true`
2. ✅ 重新部署 Vercel
3. ✅ 等待连接数下降

**如果问题仍然存在，请按照上述步骤逐一排查。** 🔍
