# 积分系统分析与优化方案

## 📊 当前状态分析

### ✅ ShipAny已有完整的积分系统

1. **数据库结构**
   - ✅ `credit` 表：存储积分交易记录
   - ✅ 支持FIFO队列、过期处理、失败返还
   - ✅ `consumeCredits()` 函数：已实现余额检查和扣除（事务保护）
   - ✅ `getRemainingCredits()` 函数：获取剩余积分

2. **AI任务积分处理**
   - ✅ `createAITask()`: 在创建任务时扣除积分，保存 `creditId`
   - ✅ `updateAITaskById()`: 任务失败时自动返还积分（通过 `creditId`）

### ⚠️ Media任务当前实现的问题

1. **积分扣除时机**
   - ❌ 在后台异步函数 `processMediaTask` 中扣除
   - ❌ 如果任务提交后立即失败，积分可能已扣除但无法返还
   - ❌ 没有保存 `creditId` 到 `mediaTasks` 表

2. **积分返还机制**
   - ❌ 任务失败时没有返还积分
   - ❌ 没有 `creditId` 字段关联积分记录

3. **积分检查时机**
   - ⚠️ 前端有检查，但后端在异步处理中才检查
   - ⚠️ 存在并发问题风险

---

## 🔍 风险评估

### 风险1: 并发问题
**问题**: 如果两个请求同时提交，可能都通过积分检查
**影响**: 用户可能被扣除双倍积分
**当前缓解**: `consumeCredits()` 使用事务，但检查时机太晚

### 风险2: 失败不返还
**问题**: 任务失败时积分已扣除但未返还
**影响**: 用户积分损失
**当前状态**: ❌ 未实现

### 风险3: 积分检查延迟
**问题**: 积分检查在后台异步函数中，用户可能已经提交了无效请求
**影响**: 用户体验差，需要等待才知道积分不足

---

## ✅ 优化方案

### 方案1: 在API路由中提前检查（推荐）

**优点**:
- ✅ 立即反馈积分不足
- ✅ 避免无效任务创建
- ✅ 符合ShipAny现有模式（参考AI任务）

**实现**:
1. 在 `/api/media/submit` 中先检查积分
2. 创建任务时扣除积分并保存 `creditId`
3. 任务失败时通过 `creditId` 返还积分

### 方案2: 创建积分检查辅助函数（可选）

**目的**: 统一积分检查逻辑，便于维护

**实现**: 创建 `checkCreditsBeforeTask()` 函数

---

## 🛠️ 实施建议

### 1. 添加 `creditId` 字段到 `mediaTasks` 表

**需要修改**: `src/config/db/schema.ts`

```typescript
creditId: text('credit_id'), // credit consumption record id
```

### 2. 修改 `createMediaTask` 函数

**参考**: `createAITask` 的实现模式

### 3. 修改 `updateMediaTaskById` 函数

**添加**: 失败返还逻辑（参考 `updateAITaskById`）

### 4. 修改 `/api/media/submit` 路由

**调整**: 在创建任务前检查并扣除积分

---

## 📋 实施步骤

1. ✅ 检查Schema是否需要添加 `creditId` 字段
2. ✅ 修改 `createMediaTask` 支持积分扣除
3. ✅ 修改 `updateMediaTaskById` 支持积分返还
4. ✅ 调整 `/api/media/submit` 路由逻辑
5. ✅ 调整 `/api/media/translate` 路由逻辑

---

**准备开始实施...**


