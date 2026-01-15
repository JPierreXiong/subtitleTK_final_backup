# 并发限制修复说明

## 问题描述

用户反馈：任务失败后，系统提示"有1个活跃任务，最大并发任务数：1"，导致无法提交新任务。

### 用户需求
1. 免费只有1次机会，不代表只能做1个短视频提取
2. 如果免费机会用完了，开始扣credits，1个用户1次只能提交1个短视频链接
3. 处理完了可以进行下一个短视频，作为新任务

## 问题原因

当任务失败或超时后，如果状态仍然是 `processing`（因为 watchdog 还没运行），会被 `getActiveMediaTasks` 计入并发限制，导致用户无法提交新任务。

## 解决方案

### 1. 在提交任务前运行 Watchdog

在 `src/app/api/media/submit/route.ts` 中，在检查并发限制**之前**先运行 watchdog，确保超时/失败的任务被标记为 `failed`：

```typescript
// 🛡 Watchdog: Mark timeout tasks BEFORE checking concurrent limit
// This ensures failed/timeout tasks don't block new submissions
try {
  const { markTimeoutTasks } = await import('@/shared/models/media_task_watchdog');
  const timeoutCount = await markTimeoutTasks();
  if (timeoutCount > 0) {
    console.log(`[Watchdog] Marked ${timeoutCount} timeout tasks before submission`);
  }
} catch (watchdogError: any) {
  // Don't fail the request if watchdog fails, just log it
  console.error('[Watchdog Error]', watchdogError.message);
}

// Check plan limits (including free trial availability)
const planLimitsCheck = await checkAllPlanLimits({
  userId: currentUser.id,
  outputType: outputType || 'subtitle',
});
```

### 2. 修复 Watchdog SQL 语法

修复了 `src/shared/models/media_task_watchdog.ts` 中的 SQL 语法，使用 Drizzle ORM 的 `lt` 函数：

```typescript
import { eq, and, sql, lt } from 'drizzle-orm';

// 使用 lt 函数比较时间
lt(mediaTasks.updatedAt, timeoutThreshold)
```

## 工作原理

1. **提交任务时**：先运行 watchdog，标记所有超时的 `processing` 任务为 `failed`
2. **检查并发限制**：只计算真正"进行中"的任务（`processing` 或 `translating`）
3. **失败任务不影响**：`failed` 状态的任务不会被计入并发限制

## 活跃任务定义

`getActiveMediaTasks` 只计算以下状态的任务：
- `processing`：正在处理中
- `translating`：正在翻译中

**不计算**以下状态：
- `pending`：已创建，尚未开始（不算活跃）
- `completed`：已完成
- `failed`：已失败（包括 timeout）
- `extracted`：已提取完成

## 测试建议

1. 提交一个任务，让它失败或超时
2. 立即提交另一个任务，应该可以成功（因为失败任务已被标记为 `failed`）
3. 提交一个任务，等待它完成，然后提交另一个任务，应该可以成功

## 相关文件

- `src/app/api/media/submit/route.ts` - 提交任务路由（添加 watchdog 调用）
- `src/shared/models/media_task_watchdog.ts` - Watchdog 实现（修复 SQL 语法）
- `src/shared/models/media_task.ts` - `getActiveMediaTasks` 函数（只计算 processing/translating）
- `src/shared/services/media/plan-limits.ts` - 并发限制检查逻辑




