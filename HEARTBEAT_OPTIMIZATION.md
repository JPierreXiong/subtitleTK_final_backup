# 心跳机制优化说明

## 背景

系统已经实现了"可控失败"机制：
- ✅ Watchdog 自动清理超时任务
- ✅ 失败任务自动退款
- ✅ 用户能看到明确的错误提示

但是，在 Vercel Free 环境下，任务可能因为平台冻结而超时，即使任务实际上还在执行。

## 解决方案：心跳机制

### 核心思想

在关键步骤更新 `updated_at` 字段，让 watchdog 知道任务还在执行。

**不改表结构**：利用 ShipAny 的 `$onUpdate` 自动更新 `updated_at`

### 实现

#### 1. 心跳工具 (`src/shared/utils/task-heartbeat.ts`)

```typescript
export async function sendTaskHeartbeat(
  taskId: string,
  progress?: number
): Promise<void>
```

- 更新 `progress`（如果提供）
- `updated_at` 自动更新（ShipAny 行为）
- 心跳失败不影响任务执行

#### 2. 在关键步骤添加心跳

**API 调用前** (progress: 20)
```typescript
await sendTaskHeartbeat(taskId, 20);
const mediaData = await fetchMediaFromRapidAPI(...);
```

**Metadata 更新后** (progress: 40)
```typescript
await sendTaskHeartbeat(taskId, 40);
// 开始视频上传等长时间操作
```

**视频上传前** (progress: 50)
```typescript
await sendTaskHeartbeat(taskId, 50);
await uploadVideoToStorage(...);
```

## 工作原理

1. **任务执行中**：心跳定期更新 `updated_at`
2. **Watchdog 检查**：`updated_at` 在最近更新 → 任务还在执行
3. **真正卡死**：`updated_at` 超过 90 秒未更新 → 标记为 timeout

## 效果

### 之前
- Vercel 冻结任务 → `updated_at` 不更新
- Watchdog 90 秒后标记为 timeout
- 即使任务还在执行也会被误杀

### 现在
- 关键步骤发送心跳 → `updated_at` 更新
- Watchdog 知道任务还在执行
- 只有真正卡死的任务才会被标记为 timeout

## 与 Watchdog 的配合

| 场景 | Watchdog 行为 | 心跳作用 |
|------|-------------|---------|
| 任务正常执行 | 不触发 | 心跳保持 `updated_at` 更新 |
| 任务卡死 | 90 秒后标记 timeout | 心跳失败，`updated_at` 不更新 |
| Vercel 冻结但任务还在执行 | 可能误杀 | 心跳在关键步骤更新，减少误杀 |

## 注意事项

1. **心跳频率**：只在关键步骤发送，不频繁调用
2. **心跳失败**：不影响任务执行，只记录警告
3. **不改结构**：完全利用现有字段和 ShipAny 行为

## 相关文件

- `src/shared/utils/task-heartbeat.ts` - 心跳工具（新增）
- `src/app/api/media/submit/route.ts` - 在关键步骤添加心跳
- `src/shared/models/media_task_watchdog.ts` - Watchdog 实现

## 下一步优化（可选）

如果需要更精确的心跳控制，可以考虑：

1. **动态心跳间隔**：根据任务类型调整心跳频率
2. **心跳超时检测**：如果心跳失败多次，主动标记为 failed
3. **心跳统计**：记录心跳次数，用于监控和调试

但目前这个简单的心跳机制已经足够解决大部分问题。


