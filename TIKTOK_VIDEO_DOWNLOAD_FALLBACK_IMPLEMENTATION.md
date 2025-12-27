# TikTok Video Download 降级策略实现完成

## ✅ 实现状态

**已完成**：在不改变shipany结构的前提下，实现了TikTok视频下载API的降级策略，参考YouTube和TikTok转录的实现方式。

---

## 📋 实现内容

### 1. 核心功能

- ✅ **免费API优先**：先调用免费API（Snap Video3）
- ✅ **自动降级**：免费API失败后自动切换到付费API
- ✅ **严格调用**：每个API只调用1次，绝不重复
- ✅ **超时控制**：免费API 15秒超时，付费API 20秒超时
- ✅ **失败判断**：严格的成功/失败判断逻辑

### 2. 修改的文件

**文件**：`src/extensions/media/rapidapi.ts`

**修改内容**：
1. 修改 `fetchTikTokVideo()` 方法，实现降级策略
2. 新增 `fetchTikTokVideoDownloadFreeAPI()` 方法（免费API）
3. 新增 `fetchTikTokVideoDownloadPaidAPI()` 方法（付费API）
4. 保留原有 `fetchTikTokVideoDownload()` 方法（标记为deprecated，保持兼容）

### 3. API配置

#### API 1（免费优先）

**端点**：`https://snap-video3.p.rapidapi.com/download`

**方法**：POST

**Headers**：
```
Content-Type: application/x-www-form-urlencoded
x-rapidapi-host: snap-video3.p.rapidapi.com
x-rapidapi-key: {API_KEY}
```

**Body**（form-urlencoded）：
```
url=https://www.tiktok.com/@username/video/1234567890
```

**超时**：15秒

---

#### API 2（付费兜底）

**端点**：`https://tiktok-video-no-watermark2.p.rapidapi.com/`

**方法**：POST

**Headers**：
```
Content-Type: application/x-www-form-urlencoded
x-rapidapi-host: tiktok-video-no-watermark2.p.rapidapi.com
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
| 无视频URL | 200 | videoUrl为空或不存在 | 切换API 2 |
| 无效URL格式 | 200 | videoUrl不是http/https链接 | 切换API 2 |
| 超时 | - | 15秒超时 | 切换API 2 |
| 网络错误 | - | 网络异常 | 切换API 2 |

### 付费API失败条件

| 场景 | HTTP状态 | 判断条件 | 动作 |
|------|---------|---------|------|
| HTTP错误 | 非200 | `!response.ok` | 返回错误 |
| 无视频URL | 200 | videoUrl为空 | 返回错误 |
| 无效URL格式 | 200 | videoUrl不是http/https链接 | 返回错误 |
| 视频不存在 | 200 | 错误信息包含"video not found" | 返回错误 |
| 私有视频 | 200 | 错误信息包含"private video" | 返回错误 |
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
- ✅ 数据层面错误判断（视频URL验证）
- ✅ 超时控制
- ✅ 网络错误处理

### 4. 视频URL提取

- ✅ 支持多种响应格式
- ✅ 尝试多个可能的字段名
- ✅ 验证URL格式（必须是http/https）

---

## 📊 调用流程

```
用户请求
  ↓
fetchMedia(url, 'video')
  ↓
fetchTikTokVideo(url)
  ↓
┌─────────────────────────┐
│ 免费API (只调用1次)     │
│ - 15秒超时              │
│ - POST form-urlencoded  │
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

## 🔄 与其他实现的一致性

| 特性 | YouTube转录 | TikTok转录 | TikTok视频下载 | 一致性 |
|------|------------|-----------|---------------|--------|
| **降级策略** | ✅ 免费→付费 | ✅ 免费→付费 | ✅ 免费→付费 | ✅ 一致 |
| **调用控制** | ✅ 只调用1次 | ✅ 只调用1次 | ✅ 只调用1次 | ✅ 一致 |
| **超时控制** | ✅ 15s/20s | ✅ 15s/20s | ✅ 15s/20s | ✅ 一致 |
| **失败判断** | ✅ 严格判断 | ✅ 严格判断 | ✅ 严格判断 | ✅ 一致 |
| **日志记录** | ✅ 完整日志 | ✅ 完整日志 | ✅ 完整日志 | ✅ 一致 |
| **API格式** | GET/POST | POST/POST | POST/POST | ⚠️ 不同 |

**关键差异**：
- YouTube转录使用GET（免费API）和POST（付费API）
- TikTok转录和视频下载都使用POST，但格式不同（JSON vs form-urlencoded）

---

## 🧪 测试建议

### 1. 成功场景测试

```typescript
// 测试1: 免费API成功
// 输入：有效的TikTok URL
// 预期：使用免费API返回视频URL，不调用付费API

// 测试2: 免费API失败，付费API成功
// 输入：免费API返回429
// 预期：自动切换到付费API并返回视频URL
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
// 测试5: 免费API返回空videoUrl
// 预期：切换到付费API

// 测试6: 免费API返回无效URL格式
// 预期：切换到付费API
```

---

## 📝 使用示例

### 现有代码无需修改

```typescript
// 现有调用代码保持不变
const rapidAPI = getRapidAPIService();
const mediaData = await rapidAPI.fetchMedia(url, 'video');

// 返回格式保持不变
// mediaData.videoUrl 包含视频下载URL
// mediaData.metadata 包含元数据
```

### 日志输出示例

```
[TikTok Video Download] Attempting Free API...
[TikTok Video Download] Free API succeeded!
```

或

```
[TikTok Video Download] Attempting Free API...
[TikTok Video Download] Free API failed: RATE_LIMIT - Free API rate limit exceeded
[TikTok Video Download] Switching to Paid API as fallback...
[TikTok Video Download] Paid API succeeded!
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

如需调整，修改 `fetchTikTokVideoDownloadFreeAPI()` 和 `fetchTikTokVideoDownloadPaidAPI()` 方法中的常量。

---

## 🔄 后续优化建议

### Phase 2（可选）

1. **缓存机制**
   - 对成功的视频URL进行缓存
   - 避免重复调用相同视频

2. **监控指标**
   - 记录免费API成功率
   - 记录付费API调用次数
   - 监控成本

3. **配置化**
   - 将超时时间移到配置文件
   - 将API端点移到配置文件

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
- [x] 视频URL验证
- [x] 正确处理form-urlencoded格式

---

## 📚 相关文档

- `YOUTUBE_TRANSCRIPT_FALLBACK_IMPLEMENTATION.md` - YouTube转录降级实现
- `TIKTOK_TRANSCRIPT_FALLBACK_IMPLEMENTATION.md` - TikTok转录降级实现
- `YOUTUBE_TRANSCRIPT_FALLBACK_STRATEGY.md` - 降级策略方案

---

**实现完成时间**：2024年
**状态**：✅ 已完成，待测试验证

**下一步**：
1. 测试免费API和付费API的调用
2. 验证降级逻辑是否正确工作
3. 验证视频URL提取是否正确
4. 监控API调用成功率



