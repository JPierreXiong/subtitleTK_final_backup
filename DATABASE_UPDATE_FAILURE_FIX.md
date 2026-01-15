# 数据库更新失败修复说明

## 问题描述

根据错误日志分析，`update "media_tasks"` 失败的主要原因是：

1. **`duration` 字段类型不匹配**：API 返回的是字符串格式 `"00:28"`，但数据库期望的是整数（秒数）
2. **URL 字段可能过长**：TikTok 的 `thumbnail_url` 包含大量转义字符，可能超出字段限制
3. **空字符串问题**：`author` 字段为空字符串 `""`，可能导致约束冲突
4. **静默失败**：更新失败后没有 catch，导致任务一直停留在 `processing` 状态

## 解决方案

### 1. 创建数据清理工具（`src/shared/utils/media-data-sanitizer.ts`）

#### 核心功能

- **`parseDurationToSeconds`**：将各种格式的 duration 转换为秒数
  - `"00:28"` → `28`
  - `"01:23:45"` → `5025`
  - `28` → `28`
  - `"28"` → `28`

- **`sanitizeUrl`**：截断超长 URL（默认最大 2000 字符）

- **`sanitizeText`**：将空字符串转换为 `null`

- **`sanitizeInteger`**：确保整数类型

- **`sanitizeProgress`**：确保 progress 在 0-100 范围内

- **`sanitizeMediaTaskUpdate`**：一键清理所有字段

### 2. 更新代码使用 Sanitizer

在 `src/app/api/media/submit/route.ts` 中：

```typescript
// 更新前：直接传递原始数据（可能失败）
await updateMediaTaskById(taskId, {
  duration: mediaData.duration, // 可能是 "00:28"
  author: mediaData.author, // 可能是 ""
  thumbnailUrl: mediaData.thumbnailUrl, // 可能超长
  // ...
});

// 更新后：使用 sanitizer 清理数据
const { sanitizeMediaTaskUpdate } = await import('@/shared/utils/media-data-sanitizer');
const sanitizedData = sanitizeMediaTaskUpdate({
  duration: mediaData.duration,
  author: mediaData.author,
  thumbnailUrl: mediaData.thumbnailUrl,
  // ...
});
await updateMediaTaskById(taskId, sanitizedData);
```

### 3. 添加错误处理

如果 metadata 更新失败，自动标记任务为 `failed` 并触发退款：

```typescript
try {
  await updateMediaTaskById(taskId, sanitizedData);
} catch (updateError: any) {
  // 标记任务为 failed
  await updateMediaTaskById(taskId, {
    status: 'failed',
    errorMessage: `Metadata update failed: ${updateError.message}`,
    progress: 0,
    creditId: failedTask?.creditId || null,
  });
  throw updateError; // 停止后续处理
}
```

### 4. 数据库字段类型修复（SQL 脚本）

运行 `scripts/fix-media-tasks-field-types.sql` 确保：

- 所有 URL 字段都是 `TEXT` 类型（无长度限制）
- `duration` 字段是 `INTEGER` 类型
- `progress` 字段是 `INTEGER` 类型（0-100）
- `author` 字段允许 `NULL`

## 测试建议

### 测试 duration 解析

```typescript
import { parseDurationToSeconds } from '@/shared/utils/media-data-sanitizer';

// 测试各种格式
console.log(parseDurationToSeconds("00:28")); // 28
console.log(parseDurationToSeconds("01:23:45")); // 5025
console.log(parseDurationToSeconds(28)); // 28
console.log(parseDurationToSeconds("28")); // 28
console.log(parseDurationToSeconds("")); // null
console.log(parseDurationToSeconds(null)); // null
```

### 测试 URL 截断

```typescript
import { sanitizeUrl } from '@/shared/utils/media-data-sanitizer';

const longUrl = "https://..." + "x".repeat(3000);
console.log(sanitizeUrl(longUrl)); // 截断到 2000 字符
```

### 测试完整清理

```typescript
import { sanitizeMediaTaskUpdate } from '@/shared/utils/media-data-sanitizer';

const dirtyData = {
  duration: "00:28",
  author: "",
  thumbnailUrl: "https://..." + "x".repeat(3000),
  progress: 150,
};

const cleanData = sanitizeMediaTaskUpdate(dirtyData);
console.log(cleanData);
// {
//   duration: 28,
//   author: null,
//   thumbnailUrl: "https://..." (截断到 2000),
//   progress: 100,
// }
```

## 相关文件

- `src/shared/utils/media-data-sanitizer.ts` - 数据清理工具（新增）
- `src/app/api/media/submit/route.ts` - 使用 sanitizer 更新代码
- `scripts/fix-media-tasks-field-types.sql` - 数据库字段类型修复脚本（新增）

## 注意事项

1. **duration 格式**：数据库存储的是秒数（整数），不是 `"00:28"` 格式
2. **URL 长度**：虽然 PostgreSQL TEXT 可以存储很长，但我们限制为 2000 字符以防万一
3. **空字符串**：统一转换为 `null`，避免约束冲突
4. **错误处理**：更新失败时自动标记为 `failed`，确保任务不会卡在 `processing` 状态

## 与 Watchdog 的关系

这个修复与之前的 Watchdog 机制配合：

- **Watchdog**：处理超时任务（90 秒后自动标记为 failed）
- **Sanitizer**：防止更新失败（数据格式问题）
- **Error Handler**：更新失败时立即标记为 failed

三者结合，确保任务不会卡在 `processing` 状态。




