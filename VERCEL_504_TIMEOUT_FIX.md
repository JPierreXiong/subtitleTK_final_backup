# Vercel 504 Gateway Timeout 修复指南

## 🔴 问题描述

遇到 **504 Gateway Timeout** 错误，表示 Serverless 函数执行时间超过了 Vercel 的限制：
- **Free 版**：10 秒超时
- **Pro 版**：60 秒超时（可配置到 300 秒）

## ✅ 已实施的修复

### 1. 使用 Edge Runtime（关键修复）

在 `/api/media/rewrite/route.ts` 中添加：

```typescript
export const runtime = 'edge'; // 使用 Edge Runtime 绕过传统超时限制
export const maxDuration = 60; // 60 秒超时（Pro 版可配置到 300 秒）
```

**优势**：
- Edge Runtime 基于流式响应，不会因为长时间处理而触发超时
- 更适合 AI 流式输出场景
- 响应更快，延迟更低

### 2. 数据库连接超时优化

在 `src/core/db/index.ts` 中：

```typescript
connect_timeout: 5, // 从 10 秒减少到 5 秒，快速失败避免函数超时
```

**优势**：
- 如果数据库连接失败，5 秒内就会报错，而不是等待 10 秒导致函数超时
- 避免"连接挂起"导致的 504 错误

### 3. 数据库操作超时保护

为所有数据库操作添加超时保护：

```typescript
// 使用 Promise.race 确保数据库操作在 5 秒内完成或失败
const user = await Promise.race([
  getUserInfo(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('getUserInfo timeout')), 5000)
  )
]);
```

**优势**：
- 防止单个数据库操作阻塞整个函数
- 快速失败，给用户明确的错误提示

### 4. 流式输出优化

确保使用 SSE (Server-Sent Events) 流式输出：

```typescript
// 立即开始流式输出，不等待完整响应
for await (const chunk of rewriteStream) {
  fullContent += chunk;
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
}
```

**优势**：
- Vercel 看到有数据流输出，不会触发超时计时器
- 用户体验更好（实时看到生成内容）

### 5. 异步保存优化

使用 `waitUntil` 确保数据库保存不阻塞响应：

```typescript
const savePromise = updateMediaTaskById(taskId, {
  subtitleRewritten: fullContent,
}).catch((error) => {
  console.error('[Rewrite] Failed to save rewritten content:', error);
});

// 尝试使用 waitUntil（如果可用）
if (typeof globalThis !== 'undefined' && 'waitUntil' in globalThis) {
  try {
    (globalThis as any).waitUntil?.(savePromise);
  } catch (e) {
    // waitUntil 不可用，使用 fire-and-forget
  }
}
```

**优势**：
- 响应已发送给客户端后，后台保存数据
- 不阻塞流式输出

## 📋 检查清单

### 环境变量检查

确保 Vercel 环境变量正确设置：

```bash
# 必需的环境变量
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=true
```

**重要**：
- ✅ 必须使用 Pooler 地址（端口 6543）
- ✅ 必须包含 `?pgbouncer=true`
- ✅ 必须包含 `sslmode=require`

### Vercel 配置检查

检查 `vercel.json` 中的函数配置：

```json
{
  "functions": {
    "src/app/api/media/**/*.ts": {
      "maxDuration": 180
    }
  }
}
```

**注意**：
- Edge Runtime 的 `maxDuration` 在代码中设置（`export const maxDuration = 60`）
- `vercel.json` 中的配置主要用于 Node.js Runtime

### 日志检查

如果仍然遇到 504 错误，检查 Vercel 日志：

1. **Vercel Dashboard** -> **Logs**
2. 查看 **Runtime Logs** 和 **Function Logs**
3. 查找以下错误：
   - `FUNCTION_INVOCATION_TIMEOUT`
   - `Database connection timeout`
   - `getUserInfo timeout`

## 🚀 部署步骤

1. **提交代码**：
   ```bash
   git add .
   git commit -m "fix: optimize rewrite API for Vercel timeout (Edge Runtime + timeout protection)"
   git push
   ```

2. **重新部署**：
   - Vercel 会自动检测到代码更新并重新部署
   - 或手动触发 **Redeploy**（取消勾选 "Use existing Build Cache"）

3. **验证修复**：
   - 测试 AI 改写功能
   - 观察是否还有 504 错误
   - 检查流式输出是否正常工作

## 🔍 故障排查

### 如果仍然出现 504 错误

1. **检查 Edge Runtime 兼容性**：
   - Edge Runtime 不支持所有 Node.js API
   - 如果使用了不兼容的 API，可能需要回退到 Node.js Runtime

2. **检查 Gemini API 响应时间**：
   - 如果 Gemini API 响应很慢（>60 秒），可能需要：
     - 增加 `maxDuration`（Pro 版）
     - 或优化 Prompt 减少响应时间

3. **检查数据库连接**：
   - 确认 Supabase 连接正常
   - 检查连接池是否已满
   - 运行 `scripts/monitor_db_connections.sql` 监控连接数

4. **检查网络延迟**：
   - 如果从 Vercel 到 Supabase 的网络延迟很高，可能需要：
     - 使用 Supabase 的同一区域（Region）
     - 或使用 Supabase 的专用连接

## 📊 性能优化建议

### 1. 使用缓存

对于频繁访问的数据，考虑使用缓存：

```typescript
// 使用 Vercel KV 或 Redis 缓存用户信息
const cachedUser = await kv.get(`user:${userId}`);
```

### 2. 优化数据库查询

- 使用索引加速查询
- 避免 N+1 查询问题
- 使用连接池复用连接

### 3. 监控和告警

设置 Vercel 监控告警：
- 函数执行时间 > 50 秒
- 错误率 > 5%
- 504 错误 > 1%

## ✅ 预期效果

修复后，你应该看到：

1. ✅ **不再出现 504 错误**
2. ✅ **流式输出正常工作**（文字逐字显示）
3. ✅ **响应时间更快**（Edge Runtime 延迟更低）
4. ✅ **数据库操作快速失败**（5 秒超时）

## 🆘 如果问题仍然存在

1. **收集信息**：
   - Vercel 日志（Runtime Logs）
   - 浏览器控制台错误
   - 网络请求时间线

2. **联系支持**：
   - Vercel Support（如果是平台问题）
   - Supabase Support（如果是数据库问题）

---

**修复完成！** 🎉

现在你的 AI 改写功能应该能够：
- ✅ 在 Edge Runtime 上稳定运行
- ✅ 流式输出内容给用户
- ✅ 快速处理数据库操作
- ✅ 避免 504 超时错误
