# 数据库连接数优化修复指南

## 🔴 问题诊断

**错误信息**：
```
Max client connections reached
Failed query: select "name", "value" from "config"
```

**根本原因**：
1. **Vercel Serverless 环境**：每次 API 请求可能创建新连接
2. **Next.js 热重载（HMR）**：开发环境下热重载会重复创建连接
3. **PgBouncer 配置**：使用 Supabase Pooler (6543端口) 时必须设置 `prepare: false`

---

## ✅ 已实施的修复

### 1. 代码优化 (`src/core/db/index.ts`)

**关键改进**：
- ✅ 使用全局变量 (`globalForDb`) 防止 HMR 重复创建连接
- ✅ 确保所有 PostgreSQL 连接都设置了 `prepare: false`（适配 PgBouncer）
- ✅ 添加 SSL 支持（Supabase 要求）
- ✅ 优化连接超时设置（20秒空闲自动释放）

**核心修复点**：
```typescript
// 1. 全局单例防止 HMR 问题
const globalForDb = global as unknown as {
  dbInstance: Database | undefined;
  client: ReturnType<typeof postgres> | undefined;
};

// 2. 强制 prepare: false（PgBouncer 要求）
client = postgres(databaseUrl, {
  prepare: false,  // !!! 关键：PgBouncer 不支持预编译语句
  max: 10,         // 单例模式：最多 10 个连接
  idle_timeout: 20, // 20秒空闲自动释放
  ssl: 'require',   // Supabase 要求 SSL
});
```

---

## 🛠️ 部署步骤

### Step 1: 设置环境变量（Vercel）

在 Vercel Dashboard -> Settings -> Environment Variables 中：

1. **启用单例模式**（推荐）：
   ```
   DB_SINGLETON_ENABLED = true
   ```

2. **确认数据库连接字符串**：
   - 使用 **Pooler 连接**（端口 6543）
   - 格式：`postgresql://user:pass@host:6543/db?pgbouncer=true`

### Step 2: 清理现有连接（Supabase）

在 Supabase Dashboard -> SQL Editor 中执行：

```sql
-- 查看当前连接数
SELECT count(*), state 
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state;

-- 如果连接数过多，清理空闲连接（安全）
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() 
  AND pid <> pg_backend_pid()
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes';
```

**或者使用提供的脚本**：
- `scripts/monitor_db_connections.sql` - 监控连接状态
- `scripts/cleanup_db_connections.sql` - 清理连接

### Step 3: 重新部署

在 Vercel Dashboard：
1. 点击 **Redeploy** 或 **Deploy**
2. 等待部署完成
3. 验证连接数是否下降

---

## 🔍 验证修复

### 1. 检查连接数

在 Supabase SQL Editor 运行：
```sql
SELECT count(*) as total_connections
FROM pg_stat_activity 
WHERE datname = current_database();
```

**预期结果**：
- 正常情况下：5-15 个连接
- 如果超过 50：可能仍有问题

### 2. 测试 API

访问以下端点，确认不再报错：
- `http://localhost:3000/api/auth/get-session`
- `http://localhost:3000/api/config/get-configs`

**预期结果**：
- ✅ 返回 200 状态码
- ✅ 不再出现 "Max client connections" 错误

### 3. 监控连接趋势

使用 `scripts/monitor_db_connections.sql` 定期检查：
- 连接数是否稳定
- 是否有长时间空闲的连接（潜在泄漏）

---

## 📊 连接池配置说明

### 单例模式 (`DB_SINGLETON_ENABLED=true`)

**适用场景**：
- ✅ 传统服务器环境
- ✅ 开发环境（防止 HMR 问题）
- ✅ 需要连接复用的场景

**配置**：
- `max: 10` - 最多 10 个连接
- `idle_timeout: 20` - 20秒空闲自动释放
- 全局单例，防止重复创建

### 非单例模式（默认）

**适用场景**：
- ✅ Vercel Serverless（函数实例自动清理）
- ✅ 低并发场景

**配置**：
- `max: 1` - 每个实例最多 1 个连接
- `idle_timeout: 20` - 20秒空闲自动释放
- 仍使用全局变量防止 HMR 问题

---

## ⚠️ 重要注意事项

### 1. PgBouncer 要求

使用 Supabase Pooler (6543端口) 时：
- ✅ **必须**设置 `prepare: false`
- ✅ **必须**使用 Transaction 模式（不是 Session 模式）
- ✅ 连接字符串必须包含 `pgbouncer=true`

### 2. SSL 要求

Supabase 要求所有连接使用 SSL：
- ✅ 代码中已自动检测并设置 `ssl: 'require'`
- ✅ 连接字符串通常已包含 SSL 参数

### 3. 连接清理

如果连接数仍然很高：
1. 检查是否有长时间运行的查询
2. 检查是否有未关闭的事务
3. 使用 `scripts/cleanup_db_connections.sql` 清理空闲连接

---

## 🚀 预期效果

修复后：
- ✅ **Auth API 恢复正常**：`/api/auth/get-session` 不再 500
- ✅ **配置加载正常**：`select from config` 不再报错
- ✅ **连接数稳定**：保持在合理范围内（5-15 个）
- ✅ **性能提升**：减少连接创建开销，响应更快

---

## 🆘 如果问题仍然存在

1. **检查环境变量**：
   - 确认 `DATABASE_URL` 使用 Pooler (6543端口)
   - 确认 `DB_SINGLETON_ENABLED` 已设置

2. **检查 Supabase 设置**：
   - Pooling Mode 应为 **Transaction**
   - 不是 Session 模式

3. **查看详细日志**：
   - Vercel 函数日志
   - Supabase 连接日志

4. **联系支持**：
   - 提供 `scripts/monitor_db_connections.sql` 的输出结果

---

**修复完成后，全站功能（包括 AI 改写）应该恢复正常！** 🎉
