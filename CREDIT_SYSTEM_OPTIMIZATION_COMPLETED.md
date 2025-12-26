# 积分系统优化完成报告

## ✅ 已完成的优化

### 1. Schema更新

**文件**: `src/config/db/schema.ts`

**修改**:
- ✅ 添加 `creditId` 字段到 `mediaTasks` 表
- ✅ 用于追踪积分扣除记录，支持失败返还

### 2. createMediaTask函数优化

**文件**: `src/shared/models/media_task.ts`

**修改**:
- ✅ 参考 `createAITask` 的实现模式
- ✅ 在事务中创建任务并扣除积分
- ✅ 保存 `creditId` 到任务记录

**逻辑**:
```typescript
1. 创建任务记录
2. 如果 costCredits > 0，扣除积分
3. 保存 creditId 到任务记录
4. 返回任务结果（包含 creditId）
```

### 3. updateMediaTaskById函数优化

**文件**: `src/shared/models/media_task.ts`

**修改**:
- ✅ 参考 `updateAITaskById` 的实现模式
- ✅ 检测任务失败状态
- ✅ 如果有 `creditId`，自动返还积分

**逻辑**:
```typescript
1. 检测状态是否为 'failed'
2. 如果有 creditId，获取积分扣除记录
3. 从 consumedDetail 中解析扣除详情
4. 返还所有扣除的积分
5. 标记积分记录为 DELETED
6. 更新任务状态
```

### 4. /api/media/submit路由优化

**文件**: `src/app/api/media/submit/route.ts`

**修改**:
- ✅ 在创建任务前检查积分（立即反馈）
- ✅ 在 `createMediaTask` 中扣除积分（事务保护）
- ✅ 移除后台处理函数中的积分扣除逻辑

**流程**:
```typescript
1. 验证参数
2. 计算所需积分
3. 检查积分余额（立即反馈）
4. 创建任务（扣除积分，保存creditId）
5. 启动后台处理（不再扣除积分）
```

### 5. /api/media/translate路由优化

**文件**: `src/app/api/media/translate/route.ts`

**修改**:
- ✅ 扣除积分后保存 `creditId`
- ✅ 翻译失败时通过 `creditId` 返还积分

**流程**:
```typescript
1. 检查积分余额
2. 扣除积分并获取 creditId
3. 更新任务状态为 translating，保存 creditId
4. 执行翻译
5. 如果失败，更新状态为 failed（自动返还积分）
```

---

## 🔧 技术实现细节

### 1. 积分扣除时机

**之前**: 在后台异步函数中扣除
**现在**: 在创建任务时扣除（事务保护）

**优点**:
- ✅ 立即反馈积分不足
- ✅ 避免无效任务创建
- ✅ 事务保护，避免并发问题

### 2. 失败返还机制

**实现**: 在 `updateMediaTaskById` 中检测失败状态

**逻辑**:
```typescript
if (status === 'failed' && creditId) {
  // 1. 获取积分扣除记录
  // 2. 解析 consumedDetail
  // 3. 返还所有扣除的积分
  // 4. 标记记录为 DELETED
}
```

### 3. 事务保护

**实现**: 使用数据库事务

**保护范围**:
- ✅ 任务创建 + 积分扣除（原子性）
- ✅ 任务更新 + 积分返还（原子性）

---

## 📊 优化效果对比

| 项目 | 优化前 | 优化后 |
|------|--------|--------|
| 积分检查时机 | 后台异步 | API路由（立即） |
| 积分扣除时机 | 后台异步 | 创建任务时（事务） |
| creditId保存 | ❌ 无 | ✅ 有 |
| 失败返还 | ❌ 无 | ✅ 自动返还 |
| 并发保护 | ⚠️ 部分 | ✅ 完整 |
| 用户体验 | ⚠️ 延迟反馈 | ✅ 立即反馈 |

---

## ⚠️ 重要注意事项

### 1. 不需要额外的credit-guard.ts

**原因**:
- ✅ `consumeCredits()` 已实现余额检查
- ✅ 直接调用即可
- ✅ 参考AI任务的实现模式

### 2. 不需要全局Middleware

**原因**:
- ✅ ShipAny已有完整的积分系统
- ✅ 在API路由中处理即可
- ✅ 避免性能损耗和逻辑冲突

### 3. 失败返还是自动的

**机制**:
- ✅ 在 `updateMediaTaskById` 中自动检测
- ✅ 如果状态为 `failed` 且有 `creditId`，自动返还
- ✅ 无需手动调用返还函数

---

## 🚀 下一步

### 数据库迁移
运行以下命令同步Schema：
```bash
npx drizzle-kit push
```

### 测试建议
1. ✅ 测试积分不足的情况
2. ✅ 测试任务失败时的积分返还
3. ✅ 测试并发提交的情况
4. ✅ 测试翻译失败时的积分返还

---

**优化完成时间**: 2024-12-25
**状态**: ✅ 已完成，无语法错误，待数据库同步和测试


