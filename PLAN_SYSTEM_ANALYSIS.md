# 套餐系统实施方案分析

## 📊 需求总结

### 套餐类型

1. **免费版 (Free)**
   - 免费测试：2次（YouTube或TikTok）
   - 下载文案：10积分
   - 下载视频：15积分
   - 翻译：5积分
   - 翻译字数限制：1000字
   - 支持语言：12种
   - 文件保留：24小时

2. **单次充值 (On-demand)**
   - 价格：4.90美元
   - 积分：50次 + 25积分赠送
   - 有效期：1年
   - 继承当前套餐

3. **基础版 (Base/Starter)**
   - 价格：9.9美元/月
   - 积分：200 + 50积分赠送
   - 有效期：30天
   - 视频长度限制：10分钟
   - 导出格式：SRT, CSV
   - 存储：24小时
   - 并发限制：1个任务
   - 支持：邮件支持

4. **专业版 (Pro/Professional)**
   - 价格：19.9美元/月
   - 积分：500 + 100积分赠送
   - 有效期：30天
   - 视频长度：无限制
   - 导出格式：SRT, CSV, VTT, TXT
   - 存储：72小时
   - 支持：优先人工支持
   - 标记：most popular

5. **每日打卡**
   - 奖励：5积分/天

---

## 🔍 ShipAny现有结构分析

### ✅ 已有的表结构

1. **subscription表**
   - ✅ `planName`: 套餐名称
   - ✅ `creditsAmount`: 积分数量
   - ✅ `creditsValidDays`: 积分有效期
   - ✅ `currentPeriodStart/End`: 订阅周期
   - ✅ `status`: 订阅状态

2. **order表**
   - ✅ `planName`: 套餐名称
   - ✅ `creditsAmount`: 积分数量
   - ✅ `creditsValidDays`: 积分有效期
   - ✅ `paymentType`: one_time, subscription

3. **credit表**
   - ✅ 完整的积分系统（FIFO队列、过期处理）
   - ✅ `subscriptionNo`: 关联订阅
   - ✅ `orderNo`: 关联订单
   - ✅ `expiresAt`: 过期时间

4. **user表**
   - ⚠️ 需要检查是否有plan相关字段

### ❌ 缺失的功能

1. **套餐类型字段**
   - ❌ `plan_type`: free, base, pro, on_demand
   - ❌ 需要添加到 `user` 表或 `subscription` 表

2. **套餐限制字段**
   - ❌ `max_video_duration`: 视频长度限制（秒）
   - ❌ `concurrent_limit`: 并发任务限制
   - ❌ `export_formats`: 导出格式（JSON数组）
   - ❌ `storage_hours`: 存储时长（小时）
   - ❌ `translation_char_limit`: 翻译字数限制

3. **免费测试次数**
   - ❌ `free_trial_count`: 免费测试次数
   - ❌ `free_trial_used`: 已使用次数

4. **每日打卡系统**
   - ❌ `daily_checkin` 表：记录打卡历史
   - ❌ `last_checkin_date`: 最后打卡日期

---

## ❓ 需要确认的关键问题

### 问题1: 套餐类型存储位置

**选项A**: 存储在 `user` 表
- 优点：查询快速，每个用户只有一个当前套餐
- 缺点：需要同步更新 `subscription` 表

**选项B**: 存储在 `subscription` 表
- 优点：历史记录完整，支持多套餐切换
- 缺点：需要查询当前激活的订阅

**选项C**: 两个表都存储
- 优点：查询快速 + 历史完整
- 缺点：需要同步更新

**推荐**: **选项C**（两个表都存储）
- `user.plan_type`: 当前套餐类型（快速查询）
- `subscription.plan_type`: 订阅套餐类型（历史记录）

---

### 问题2: 免费测试次数如何计算？

**场景1**: 免费测试是否消耗积分？
- 选项A：不消耗积分，但计入免费次数
- 选项B：消耗积分，但前2次免费

**场景2**: 免费次数如何重置？
- 选项A：永久2次（注册后）
- 选项B：每月重置
- 选项C：按套餐周期重置

**场景3**: 免费次数是否区分操作类型？
- 选项A：总计2次（提取+视频+翻译算1次）
- 选项B：分别计算（提取2次、翻译2次）

**推荐**: 
- 免费测试不消耗积分
- 永久2次（注册后）
- 总计2次（一次完整流程算1次）

---

### 问题3: 套餐限制如何生效？

**场景1**: 视频长度限制
- 何时检查：提交任务时？处理完成后？
- 如何处理：拒绝任务？允许但警告？

**场景2**: 并发限制
- 如何计算：processing + translating 状态？
- 如何处理：拒绝新任务？排队？

**场景3**: 翻译字数限制
- 如何计算：原始字数？翻译后字数？
- 如何处理：拒绝翻译？截断？

**推荐**:
- 提交任务时检查所有限制
- 并发限制：拒绝新任务，提示用户
- 翻译字数：按原始字数计算，超过拒绝

---

### 问题4: 每日打卡如何实现？

**场景1**: 打卡时间窗口
- 选项A：UTC时间（全球统一）
- 选项B：用户时区（本地时间）
- 选项C：服务器时区

**场景2**: 打卡奖励发放
- 选项A：立即发放（事务）
- 选项B：延迟发放（后台任务）

**场景3**: 打卡记录存储
- 选项A：单独表（`daily_checkin`）
- 选项B：记录在 `credit` 表（transaction_type: 'award'）

**推荐**:
- UTC时间（全球统一）
- 立即发放（事务保护）
- 单独表 + credit记录（双重记录）

---

### 问题5: 套餐切换逻辑

**场景1**: 用户从免费版升级到基础版
- 如何处理：立即生效？下个周期？
- 免费次数如何处理：保留？重置？

**场景2**: 用户从基础版降级到免费版
- 如何处理：立即降级？等待到期？
- 未使用的积分如何处理：保留？清零？

**场景3**: 用户同时有订阅和单次充值
- 如何处理：优先使用哪个？
- 积分如何合并？

**推荐**:
- 升级：立即生效
- 降级：等待到期
- 积分：FIFO队列自动处理（已有实现）

---

### 问题6: UI显示逻辑

**场景1**: 预计消耗积分计算
- 如何计算：提取10 + 视频15 + 翻译5 = 30？
- 何时显示：提交前？选择输出类型后？

**场景2**: 套餐限制提示
- 如何提示：警告？阻止？
- 何时提示：选择视频时？提交时？

**场景3**: 免费次数显示
- 如何显示：剩余次数？已用次数？
- 位置：顶部？按钮旁？

**推荐**:
- 动态计算预计消耗（实时显示）
- 提交时检查所有限制（阻止+提示）
- 顶部显示剩余免费次数

---

## 🛠️ 实施方案

### 方案A: 最小改动（推荐）⭐

**核心思路**: 利用现有结构，最小化Schema改动

#### 1. Schema修改

**user表新增字段**:
```typescript
planType: text('plan_type').default('free'), // free, base, pro, on_demand
freeTrialUsed: integer('free_trial_used').default(0), // 已使用免费次数
lastCheckinDate: date('last_checkin_date'), // 最后打卡日期
```

**subscription表新增字段**:
```typescript
planType: text('plan_type'), // free, base, pro, on_demand
maxVideoDuration: integer('max_video_duration'), // 视频长度限制（秒）
concurrentLimit: integer('concurrent_limit').default(1), // 并发限制
exportFormats: text('export_formats'), // JSON数组: ["SRT","CSV"]
storageHours: integer('storage_hours').default(24), // 存储时长（小时）
translationCharLimit: integer('translation_char_limit'), // 翻译字数限制
```

**新增daily_checkin表**:
```typescript
id: text('id').primaryKey(),
userId: text('user_id').references(() => user.id),
checkinDate: date('checkin_date').notNull(), // UTC日期
creditsAwarded: integer('credits_awarded').default(5),
createdAt: timestamp('created_at').defaultNow(),
```

#### 2. 套餐配置（常量）

```typescript
// src/shared/config/plans.ts
export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    freeTrialCount: 2,
    credits: { extract: 10, video: 15, translate: 5 },
    translationCharLimit: 1000,
    maxVideoDuration: null, // 无限制
    concurrentLimit: 1,
    exportFormats: ['SRT', 'CSV'],
    storageHours: 24,
  },
  base: {
    name: 'Base',
    price: 9.9,
    credits: 200,
    creditsBonus: 50,
    validDays: 30,
    maxVideoDuration: 600, // 10分钟
    concurrentLimit: 1,
    exportFormats: ['SRT', 'CSV'],
    storageHours: 24,
  },
  pro: {
    name: 'Pro',
    price: 19.9,
    credits: 500,
    creditsBonus: 100,
    validDays: 30,
    maxVideoDuration: null, // 无限制
    concurrentLimit: null, // 无限制
    exportFormats: ['SRT', 'CSV', 'VTT', 'TXT'],
    storageHours: 72,
  },
  on_demand: {
    name: 'On-demand',
    price: 4.9,
    credits: 50,
    creditsBonus: 25,
    validDays: 365,
  },
};
```

#### 3. 限制检查函数

```typescript
// src/shared/services/media/plan-limits.ts
export async function checkPlanLimits(userId: string, task: MediaTask) {
  const user = await getUserById(userId);
  const plan = PLAN_CONFIG[user.planType];
  
  // 检查免费次数
  if (user.planType === 'free' && user.freeTrialUsed >= plan.freeTrialCount) {
    throw new Error('Free trial limit reached');
  }
  
  // 检查视频长度
  if (plan.maxVideoDuration && task.duration > plan.maxVideoDuration) {
    throw new Error(`Video exceeds ${plan.maxVideoDuration}s limit`);
  }
  
  // 检查并发限制
  const activeTasks = await getActiveMediaTasks(userId);
  if (plan.concurrentLimit && activeTasks.length >= plan.concurrentLimit) {
    throw new Error(`Concurrent limit: ${plan.concurrentLimit}`);
  }
  
  // 检查翻译字数
  if (task.subtitleRaw && plan.translationCharLimit) {
    const charCount = task.subtitleRaw.length;
    if (charCount > plan.translationCharLimit) {
      throw new Error(`Translation limit: ${plan.translationCharLimit} chars`);
    }
  }
}
```

---

### 方案B: 完整重构（不推荐）

**核心思路**: 创建独立的 `plan` 表和 `user_plan` 关联表

**优点**: 更灵活，支持自定义套餐
**缺点**: 改动太大，不符合ShipAny现有结构

---

## ⚠️ 风险评估

### 风险1: 数据一致性 ⚠️ 中等风险

**问题**: `user.plan_type` 和 `subscription.plan_type` 可能不同步

**缓解**:
- 使用事务更新两个表
- 定期同步检查脚本

### 风险2: 免费次数滥用 ⚠️ 低风险

**问题**: 用户可能注册多个账号

**缓解**:
- IP限制（可选）
- 邮箱验证

### 风险3: 并发限制性能 ⚠️ 低风险

**问题**: 频繁查询 `mediaTasks` 表

**缓解**:
- 使用缓存（Redis）
- 索引优化

---

## 📋 实施检查清单

### 必须实施
- [ ] 添加 `plan_type` 字段到 `user` 和 `subscription` 表
- [ ] 添加套餐限制字段到 `subscription` 表
- [ ] 创建 `daily_checkin` 表
- [ ] 实现套餐限制检查函数
- [ ] 实现每日打卡API
- [ ] 修改媒体任务API添加限制检查
- [ ] UI显示预计消耗和限制提示

### 可选优化
- [ ] 套餐切换逻辑
- [ ] 免费次数重置机制
- [ ] 打卡奖励推送通知

---

## 🎯 推荐方案总结

**采用方案A（最小改动）**:
- ✅ 利用现有结构
- ✅ 最小化Schema改动
- ✅ 快速实施
- ✅ 易于维护

**关键决策**:
1. `plan_type` 存储在 `user` 和 `subscription` 两个表
2. 免费测试不消耗积分，永久2次
3. 所有限制在提交任务时检查
4. 每日打卡使用UTC时间，立即发放

---

**等待批准后开始实施...**


