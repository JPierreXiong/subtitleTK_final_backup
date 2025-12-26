# 套餐系统测试指南

## 🧪 测试清单

### 1. 免费测试次数测试

**测试步骤**:
1. 注册新用户（或重置现有用户的freeTrialUsed）
2. 提交第一个媒体任务（YouTube或TikTok）
3. 验证：任务标记为 `isFreeTrial: true`
4. 验证：不消耗积分
5. 验证：freeTrialUsed增加到1
6. 提交第二个媒体任务
7. 验证：freeTrialUsed增加到2
8. 提交第三个媒体任务
9. 验证：返回错误"Free trial limit reached"
10. 验证：需要积分才能继续

**API测试**:
```bash
# 1. 提交任务（应该使用免费测试）
curl -X POST http://localhost:3000/api/media/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=...", "outputType": "subtitle"}'

# 2. 检查任务状态
curl http://localhost:3000/api/media/status?taskId=...
```

### 2. 套餐限制测试

#### 2.1 并发限制测试（Base计划）

**测试步骤**:
1. 设置用户planType为'base'
2. 提交第一个任务
3. 验证：任务状态为processing
4. 立即提交第二个任务
5. 验证：返回错误"Concurrent limit exceeded"

**API测试**:
```bash
# 提交第一个任务
curl -X POST http://localhost:3000/api/media/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=...", "outputType": "subtitle"}'

# 立即提交第二个任务（应该失败）
curl -X POST http://localhost:3000/api/media/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@...", "outputType": "subtitle"}'
```

#### 2.2 视频长度限制测试（Base计划）

**测试步骤**:
1. 设置用户planType为'base'（限制10分钟）
2. 提交超过10分钟的视频
3. 验证：获取视频信息后返回错误"Video duration limit exceeded"

#### 2.3 翻译字数限制测试（Free计划）

**测试步骤**:
1. 设置用户planType为'free'（限制1000字）
2. 提交翻译请求（字幕超过1000字）
3. 验证：返回错误"Translation character limit exceeded"

### 3. 每日打卡测试

**测试步骤**:
1. 用户首次打卡
2. 验证：返回成功，获得5积分
3. 验证：lastCheckinDate更新
4. 验证：dailyCheckins表有记录
5. 立即再次打卡
6. 验证：返回错误"已经打过卡了"
7. 等待到第二天（UTC时间）
8. 验证：可以再次打卡

**API测试**:
```bash
# 1. 检查是否可以打卡
curl http://localhost:3000/api/user/checkin

# 2. 执行打卡
curl -X POST http://localhost:3000/api/user/checkin

# 3. 再次打卡（应该失败）
curl -X POST http://localhost:3000/api/user/checkin
```

### 4. 积分消耗测试

**测试步骤**:
1. 用户有100积分
2. 提交subtitle任务（消耗10积分）
3. 验证：剩余90积分
4. 提交video任务（消耗15积分）
5. 验证：剩余75积分
6. 提交翻译（消耗5积分）
7. 验证：剩余70积分

### 5. 预计消耗显示测试

**前端测试**:
1. 输入YouTube链接
2. 选择outputType为'subtitle'
3. 验证：显示"预计消耗10积分"
4. 选择outputType为'video'
5. 验证：显示"预计消耗25积分"
6. 勾选"翻译"
7. 验证：显示"预计消耗30积分"

## 🔧 测试工具

### 使用测试脚本
```bash
npx tsx scripts/test-plan-system.ts
```

### 使用数据库管理工具
```bash
npm run db:studio
```

## 📊 测试数据准备

### 创建测试用户
```sql
INSERT INTO "user" (id, name, email, plan_type, free_trial_used)
VALUES ('test-user-1', 'Test User', 'test@example.com', 'free', 0);
```

### 设置用户套餐
```sql
UPDATE "user" SET plan_type = 'base' WHERE email = 'test@example.com';
```

### 重置免费测试次数
```sql
UPDATE "user" SET free_trial_used = 0 WHERE email = 'test@example.com';
```

### 添加测试积分
```sql
-- 通过credit表添加积分
INSERT INTO credit (id, user_id, transaction_no, transaction_type, credits, remaining_credits, status)
VALUES ('test-credit-1', 'test-user-1', 'test-txn-1', 'grant', 100, 100, 'active');
```

## ✅ 测试通过标准

- [ ] 免费测试次数限制正确
- [ ] 套餐限制正确执行
- [ ] 每日打卡功能正常
- [ ] 积分消耗正确
- [ ] 预计消耗显示准确
- [ ] 错误提示清晰

---

**完成所有测试后，套餐系统即可投入使用！**


