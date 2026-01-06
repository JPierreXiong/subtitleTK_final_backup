# 防尸体任务实现方案（软约束版）

## 核心原则

> **不改结构 ≠ 不能改语义**

> 我们把「started_at / timeout 状态」**提升到代码层实现**

---

## 一、实现概述

### ✅ 已实现的功能

1. **Watchdog 机制**（使用 `updated_at` 代替 `started_at`）
2. **逻辑状态机**（`timeout` 存储为 `failed`，通过 `error_message` 区分）
3. **前端硬超时**（2 分钟强制停止）
4. **状态 API 集成**（每次查询前自动运行 watchdog）

### ❌ 不改变的内容

- ❌ 不新增数据库字段
- ❌ 不修改表结构
- ❌ 不迁移数据
- ✅ 100% 兼容 ShipAny 现有结构

---

## 二、核心实现

### 1. Watchdog 判定公式

```sql
status = 'processing'
AND updated_at < now() - interval '90 seconds'
→ 强制标记为 'failed' (timeout)
```

**为什么用 `updated_at`？**
- ShipAny 在 update 时会自动更新 `updated_at`
- processing 阶段不会频繁更新
- 一旦任务卡死，`updated_at` 就"冻结"
- 不需要新增 `started_at` 字段

### 2. 逻辑状态映射

| 逻辑状态 | 数据库状态 | 识别方式 |
|---------|----------|---------|
| `timeout` | `failed` | `error_message` 包含 `'timeout'` 和 `'watchdog'` |
| `failed` | `failed` | 其他 `error_message` |

### 3. 状态流转（强约束）

```
pending
  ↓ start (update status + updated_at)
processing
  ├─ success → extracted/completed
  ├─ error   → failed
  └─ 超时   → failed (timeout) ← 防尸体关键
```

**禁止的操作：**
- ❌ processing → pending
- ❌ processing → processing（不更新 `updated_at`）

---

## 三、代码实现

### 1. Watchdog 函数

**文件**: `src/shared/models/media_task_watchdog.ts`

```typescript
export async function markTimeoutTasks(): Promise<number> {
  // 使用 updated_at 判断超时（不依赖 started_at）
  const timeoutThreshold = new Date();
  timeoutThreshold.setSeconds(timeoutThreshold.getSeconds() - 90);

  const timeoutTasks = await db()
    .select({ id, creditId, updatedAt })
    .from(mediaTasks)
    .where(
      and(
        eq(mediaTasks.status, 'processing'),
        sql`${mediaTasks.updatedAt} < ${timeoutThreshold}`
      )
    );

  // 标记为 failed (timeout 是逻辑状态)
  for (const task of timeoutTasks) {
    await updateMediaTaskById(task.id, {
      status: 'failed',
      errorMessage: 'Task timeout (watchdog): Exceeded 90 seconds',
      creditId: task.creditId || null,
    });
  }
}
```

### 2. Status API 集成

**文件**: `src/app/api/media/status/route.ts`

```typescript
export async function GET(request: Request) {
  // 🛡 Watchdog: 每次查询前先杀尸体
  await markTimeoutTasks();

  // 然后正常查询任务状态
  const task = await findMediaTaskById(taskId);
  return respData(task);
}
```

**效果**：
- 不跑 cron，也能杀尸体
- 用户查询时自动清理
- 零额外成本

### 3. 前端轮询（硬超时）

**文件**: `src/shared/hooks/use-media-task.ts`

```typescript
const POLL_INTERVAL = 2000; // 2 秒
const HARD_TIMEOUT = 120000; // 2 分钟

// 前端硬超时检查
if (Date.now() - startTime > HARD_TIMEOUT) {
  stopPolling();
  toast.error('The task took too long and was stopped. Your credits were not consumed.');
  return true;
}

// 处理 timeout 失败
if (task.status === 'failed' && 
    task.errorMessage?.includes('timeout') && 
    task.errorMessage?.includes('watchdog')) {
  toast.error('The task took too long and was stopped. Your credits were not consumed.');
}
```

### 4. 退款逻辑

**文件**: `src/shared/models/media_task.ts`

```typescript
// timeout 存储为 failed，也会触发退款
if (updateMediaTask.status === 'failed') {
  // 自动退款逻辑（包括 timeout）
  // ...
}
```

---

## 四、数据库脚本

### 1. 添加索引（可选，提升性能）

**文件**: `scripts/migrate-add-watchdog-index.sql`

```sql
CREATE INDEX IF NOT EXISTS "idx_media_task_watchdog" 
ON "media_tasks" ("status", "updated_at")
WHERE "status" = 'processing';
```

### 2. 手动运行 Watchdog

**文件**: `scripts/watchdog-mark-timeout.sql`

```sql
UPDATE "media_tasks"
SET 
  status = 'failed',
  error_message = 'Task timeout (watchdog): Exceeded 90 seconds',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '90 seconds';
```

---

## 五、前端 UX 增强

### 显示文案

**提取中**：
```
Extracting media... This may take up to 2 minutes.
```

**超时提示**：
```
The task took too long and was stopped.
Your credits were not consumed.
```

---

## 六、这套方案能抗什么？

| 问题              | 是否解决 | 原理                    |
| --------------- | ---- | --------------------- |
| Vercel Free 杀进程 | ✅    | Watchdog 检测超时，标记为 failed |
| Promise 卡死      | ✅    | 前端硬超时 + Watchdog        |
| 前端无限等待          | ✅    | 2 分钟硬超时强制停止           |
| 无 failed 状态     | ✅    | Watchdog 自动标记           |
| 用户投诉            | ✅    | 明确提示 + 自动退款           |

---

## 七、关键设计决策

### 1. 为什么用 `updated_at` 不用 `started_at`？

- ✅ 不改变表结构
- ✅ ShipAny 自动维护
- ✅ 足够准确（processing 阶段不频繁更新）

### 2. 为什么 `timeout` 存储为 `failed`？

- ✅ 不新增状态值
- ✅ 通过 `error_message` 区分
- ✅ 退款逻辑统一（都是失败）

### 3. 为什么在 Status API 中运行 Watchdog？

- ✅ 不依赖 cron（Vercel Free 可能不支持）
- ✅ 用户查询时自动清理
- ✅ 零额外成本

---

## 八、使用步骤

### 1. 运行数据库索引（可选）

在 Supabase SQL Editor 运行：
```sql
-- scripts/migrate-add-watchdog-index.sql
```

### 2. 部署代码

代码已更新，直接部署即可。

### 3. 验证

1. 提交一个任务
2. 观察是否在 2 分钟内完成或超时
3. 检查超时任务的 `error_message` 是否包含 `timeout (watchdog)`
4. 验证积分是否自动退款

---

## 九、监控建议

### 查询超时任务

```sql
SELECT 
  id,
  status,
  error_message,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_stuck
FROM "media_tasks"
WHERE status = 'failed'
  AND error_message LIKE '%timeout (watchdog)%'
ORDER BY updated_at DESC
LIMIT 10;
```

### 查询可能超时的任务

```sql
SELECT 
  id,
  status,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_running
FROM "media_tasks"
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '60 seconds'
ORDER BY updated_at ASC;
```

---

## 十、总结

### 核心思想

> **"processing 是不稳定态，必须被时间'威胁'"**

### 实现方式

- ✅ 代码层逻辑状态机（不改变数据库）
- ✅ Watchdog 基于 `updated_at`（不新增字段）
- ✅ 前端硬超时（不依赖后端）
- ✅ 自动退款（统一处理）

### 优势

- ✅ 100% 兼容 ShipAny
- ✅ 可随时回滚
- ✅ 零迁移成本
- ✅ 线上系统最安全的改法

---

## 相关文件

- `src/shared/models/media_task_watchdog.ts` - Watchdog 核心逻辑
- `src/app/api/media/status/route.ts` - Status API（集成 Watchdog）
- `src/shared/hooks/use-media-task.ts` - 前端轮询（硬超时）
- `src/shared/models/media_task.ts` - 任务模型（退款逻辑）
- `scripts/migrate-add-watchdog-index.sql` - 索引迁移
- `scripts/watchdog-mark-timeout.sql` - 手动 Watchdog

