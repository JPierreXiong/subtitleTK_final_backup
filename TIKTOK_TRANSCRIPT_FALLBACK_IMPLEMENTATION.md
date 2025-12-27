# TikTok Transcript 降级策略实现完成

## ✅ 实现状态

**已完成**：在不改变shipany结构的前提下，实现了TikTok转录API的降级策略，参考YouTube的实现方式。

---

## 📋 实现内容

### 1. 核心功能

- ✅ **免费API优先**：先调用免费API（TikTok Transcriptor API3）
- ✅ **自动降级**：免费API失败后自动切换到付费API
- ✅ **严格调用**：每个API只调用1次，绝不重复
- ✅ **超时控制**：免费API 15秒超时，付费API 20秒超时
- ✅ **失败判断**：严格的成功/失败判断逻辑

### 2. 修改的文件

**文件**：`src/extensions/media/rapidapi.ts`

**修改内容**：
1. 修改 `fetchTikTokMedia()` 方法，实现降级策略
2. 新增 `fetchTikTokTranscriptFreeAPI()` 方法（免费API）
3. 新增 `fetchTikTokTranscriptPaidAPI()` 方法（付费API）
4. 保留原有 `fetchTikTokTranscript()` 方法（标记为deprecated，保持兼容）

### 3. API配置

#### API 1（免费优先）

**端点**：`https://tiktok-transcriptor-api3.p.rapidapi.com/index.php`

**方法**：POST

**Headers**：
```
Content-Type: application/json
x-rapidapi-host: tiktok-transcriptor-api3.p.rapidapi.com
x-rapidapi-key: {API_KEY}
```

**Body**：
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**超时**：15秒

---

#### API 2（付费兜底）

**端点**：`https://tiktok-transcript.p.rapidapi.com/transcribe-tiktok-audio`

**方法**：POST

**Headers**：
```
Content-Type: application/x-www-form-urlencoded
x-rapidapi-host: tiktok-transcript.p.rapidapi.com
x-rapidapi-key: {API_KEY}
```

**Body**（form-urlencoded）：
```
url=https://www.tiktok.com/@username/video/1234567890
```

**超时**：20秒

---

## 🔍 失败判断标准

### 免费API失败条件

| 场景 | HTTP状态 | 判断条件 | 动作 |
|------|---------|---------|------|
| 限流 | 429 | `status === 429` | 切换API 2 |
| 额度用完 | 403 | `status === 403` | 切换API 2 |
| 额度用完 | 200 | 错误信息包含"quota"/"limit" | 切换API 2 |
| 无transcript | 200 | transcript/subtitle/text为空 | 切换API 2 |
| 无效响应 | 200 | transcript长度 < 100字符 | 切换API 2 |
| 超时 | - | 15秒超时 | 切换API 2 |
| 网络错误 | - | 网络异常 | 切换API 2 |

### 付费API失败条件

| 场景 | HTTP状态 | 判断条件 | 动作 |
|------|---------|---------|------|
| HTTP错误 | 非200 | `!response.ok` | 返回错误 |
| 无transcription | 200 | transcription为空 | 返回错误 |
| 视频不存在 | 200 | 错误信息包含"video not found" | 返回错误 |
| 私有视频 | 200 | 错误信息包含"private video" | 返回错误 |
| 无字幕 | 200 | 错误信息包含"no subtitle" | 返回错误 |
| 超时 | - | 20秒超时 | 返回错误 |

---

## 🎯 关键特性

### 1. 不破坏shipany结构

- ✅ 所有修改都在 `RapidAPIProvider` 类内部
- ✅ 对外接口 `fetchMedia()` 保持不变
- ✅ 返回格式 `NormalizedMediaData` 保持不变
- ✅ 现有调用代码无需修改

### 2. 严格的调用控制

- ✅ 每个API只调用1次
- ✅ 成功立即返回，不再调用下一个
- ✅ 失败才切换，绝不重试

### 3. 完善的错误处理

- ✅ HTTP层面错误判断
- ✅ 业务层面错误判断
- ✅ 数据层面错误判断
- ✅ 超时控制
- ✅ 网络错误处理

### 4. 日志记录

- ✅ 记录API调用尝试
- ✅ 记录成功/失败原因
- ✅ 便于调试和监控

---

## 📊 调用流程

```
用户请求
  ↓
fetchMedia(url, 'subtitle')
  ↓
fetchTikTokMedia(url)
  ↓
┌─────────────────────────┐
│ 免费API (只调用1次)     │
│ - 15秒超时              │
│ - POST JSON格式         │
│ - 严格失败判断          │
└─────────────────────────┘
  ↓
  ├─ 成功 → 返回结果 → 结束
  │
  └─ 失败 → 切换付费API
      ↓
┌─────────────────────────┐
│ 付费API (只调用1次)     │
│ - 20秒超时              │
│ - POST form-urlencoded  │
│ - 严格失败判断          │
└─────────────────────────┘
  ↓
  ├─ 成功 → 返回结果 → 结束
  │
  └─ 失败 → 抛出错误
```

---

## 🔄 与YouTube实现的对比

| 特性 | YouTube实现 | TikTok实现 | 一致性 |
|------|------------|-----------|--------|
| **降级策略** | ✅ 免费→付费 | ✅ 免费→付费 | ✅ 一致 |
| **调用控制** | ✅ 只调用1次 | ✅ 只调用1次 | ✅ 一致 |
| **超时控制** | ✅ 15s/20s | ✅ 15s/20s | ✅ 一致 |
| **失败判断** | ✅ 严格判断 | ✅ 严格判断 | ✅ 一致 |
| **日志记录** | ✅ 完整日志 | ✅ 完整日志 | ✅ 一致 |
| **API格式** | GET/POST | POST/POST | ⚠️ 不同 |
| **Body格式** | JSON | JSON/form-urlencoded | ⚠️ 不同 |

**关键差异**：
- TikTok API 2使用 `form-urlencoded` 格式，需要特殊处理
- TikTok视频通常较短，最小transcript长度阈值设为100字符（YouTube为300字符）

---

## 🧪 测试建议

### 1. 成功场景测试

```typescript
// 测试1: 免费API成功
// 输入：有效的TikTok URL
// 预期：使用免费API返回结果，不调用付费API

// 测试2: 免费API失败，付费API成功
// 输入：免费API返回429
// 预期：自动切换到付费API并返回结果
```

### 2. 失败场景测试

```typescript
// 测试3: 两个API都失败
// 输入：两个API都返回错误
// 预期：抛出明确的错误信息

// 测试4: 超时测试
// 输入：API响应超过15秒
// 预期：自动切换到付费API
```

### 3. 边界场景测试

```typescript
// 测试5: 免费API返回空transcript
// 预期：切换到付费API

// 测试6: 付费API返回form-urlencoded格式错误
// 预期：正确处理form-urlencoded格式
```

---

## 📝 使用示例

### 现有代码无需修改

```typescript
// 现有调用代码保持不变
const rapidAPI = getRapidAPIService();
const mediaData = await rapidAPI.fetchMedia(url, 'subtitle');

// 返回格式保持不变
// mediaData.subtitleRaw 包含转录文本
// mediaData.metadata 包含元数据
```

### 日志输出示例

```
[TikTok Transcript] Attempting Free API...
[TikTok Transcript] Free API succeeded!
```

或

```
[TikTok Transcript] Attempting Free API...
[TikTok Transcript] Free API failed: RATE_LIMIT - Free API rate limit exceeded
[TikTok Transcript] Switching to Paid API as fallback...
[TikTok Transcript] Paid API succeeded!
```

---

## ⚙️ 配置说明

### 环境变量（无需新增）

使用现有的RapidAPI配置：
```env
NEXT_PUBLIC_RAPIDAPI_KEY=558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b
```

### 超时配置（代码中硬编码）

- 免费API超时：15秒
- 付费API超时：20秒
- 最小transcript长度：100字符（TikTok视频通常较短）

如需调整，修改 `fetchTikTokTranscriptFreeAPI()` 和 `fetchTikTokTranscriptPaidAPI()` 方法中的常量。

---

## 🔄 后续优化建议

### Phase 2（可选）

1. **缓存机制**
   - 对成功的transcript结果进行缓存
   - 避免重复调用相同视频

2. **监控指标**
   - 记录免费API成功率
   - 记录付费API调用次数
   - 监控成本

3. **配置化**
   - 将超时时间移到配置文件
   - 将最小长度移到配置文件

---

## ✅ 验证清单

- [x] 代码编译通过
- [x] 无lint错误
- [x] 保持shipany结构不变
- [x] 对外接口不变
- [x] 返回格式不变
- [x] 实现降级策略
- [x] 严格调用控制（每个API只调用1次）
- [x] 超时控制
- [x] 失败判断逻辑
- [x] 日志记录
- [x] 正确处理form-urlencoded格式

---

## 📚 相关文档

- `YOUTUBE_TRANSCRIPT_FALLBACK_STRATEGY.md` - YouTube降级策略方案
- `YOUTUBE_TRANSCRIPT_FALLBACK_IMPLEMENTATION.md` - YouTube实现文档

---

**实现完成时间**：2024年
**状态**：✅ 已完成，待测试验证

**下一步**：
1. 测试免费API和付费API的调用
2. 验证降级逻辑是否正确工作
3. 监控API调用成功率
4. 优化错误处理（如需要）

