# YouTube Transcript API 实现方案

## 📋 概述

基于教程中的简单API设计，实现一个简洁的YouTube转录API端点，同时保持与现有系统的兼容性。

---

## 一、需求分析

### 1.1 功能需求

**核心功能**：
- ✅ 接收YouTube视频URL
- ✅ 返回视频转录文本
- ✅ 简单的请求/响应格式
- ✅ 错误处理

**可选功能**：
- ⚠️ 用户认证（可选，保持简单）
- ⚠️ 积分消耗（可选，与现有系统集成）
- ⚠️ 缓存机制（提升性能）

### 1.2 API设计目标

**简单性**：
- 类似教程示例的简洁接口
- 同步或异步处理（根据需求）
- 清晰的错误信息

**兼容性**：
- 复用现有的RapidAPI服务
- 不破坏shipany结构
- 可选的与现有系统集成

---

## 二、API端点设计

### 2.1 端点路径

**方案A：独立端点**（推荐）
```
POST /api/youtube/transcript
```

**方案B：集成到现有端点**
```
POST /api/media/transcript  (新增)
```

**选择方案A的原因**：
- ✅ 保持API简洁清晰
- ✅ 不修改现有`/api/media/submit`逻辑
- ✅ 易于维护和扩展

### 2.2 请求格式

```json
{
  "url": "https://www.youtube.com/watch?v=JrNlpPXOqtk"
}
```

**可选参数**：
```json
{
  "url": "https://www.youtube.com/watch?v=JrNlpPXOqtk",
  "lang": "en",  // 可选：目标语言
  "format": "text"  // 可选：text | srt，默认text
}
```

### 2.3 响应格式

**成功响应**：
```json
{
  "success": true,
  "transcription": "This is the transcript of the video...",
  "metadata": {
    "title": "Video Title",
    "author": "Channel Name",
    "duration": 300,
    "sourceLang": "en"
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

---

## 三、实现方案

### 3.1 方案一：简单同步实现（类似教程）

**特点**：
- ✅ 同步处理，立即返回结果
- ✅ 代码简单（~50行）
- ✅ 适合快速调用
- ❌ 无任务管理
- ❌ 无进度跟踪

**实现位置**：
```
src/app/api/youtube/transcript/route.ts
```

**代码结构**：
```typescript
export async function POST(request: Request) {
  try {
    // 1. 解析请求
    const { url } = await request.json();
    
    // 2. 验证URL
    if (!url || !isValidYouTubeUrl(url)) {
      return respErr('Invalid YouTube URL');
    }
    
    // 3. 调用RapidAPI服务
    const transcriptData = await fetchYouTubeTranscript(url);
    
    // 4. 格式化响应
    return respData({
      transcription: transcriptData.text,
      metadata: transcriptData.metadata
    });
  } catch (error) {
    return respErr(error.message);
  }
}
```

**优点**：
- 实现简单快速
- 响应速度快
- 适合简单场景

**缺点**：
- 无任务管理
- 无进度跟踪
- 长时间处理会超时

---

### 3.2 方案二：异步任务实现（与现有系统集成）

**特点**：
- ✅ 异步处理，返回任务ID
- ✅ 完整的任务管理
- ✅ 进度跟踪
- ✅ 与现有积分系统集成
- ❌ 实现复杂度较高

**实现位置**：
```
src/app/api/youtube/transcript/route.ts
```

**代码结构**：
```typescript
export async function POST(request: Request) {
  try {
    // 1. 解析请求
    const { url, format } = await request.json();
    
    // 2. 验证和认证
    const user = await getUserInfo();
    if (!user) {
      return respErr('Authentication required');
    }
    
    // 3. 检查积分
    const requiredCredits = 10;
    if (!await checkCredits(user.id, requiredCredits)) {
      return respErr('Insufficient credits');
    }
    
    // 4. 创建任务
    const taskId = await createTranscriptTask({
      userId: user.id,
      url: url,
      format: format || 'text'
    });
    
    // 5. 后台处理
    processTranscriptTask(taskId, url).catch(console.error);
    
    // 6. 返回任务ID
    return respData({
      taskId: taskId,
      status: 'processing',
      message: 'Task created, use /api/youtube/transcript/status?taskId=xxx to check status'
    });
  } catch (error) {
    return respErr(error.message);
  }
}
```

**优点**：
- 完整的任务管理
- 与现有系统集成
- 支持长时间处理

**缺点**：
- 实现复杂
- 需要轮询状态

---

### 3.3 方案三：混合实现（推荐）

**特点**：
- ✅ 默认同步处理（简单快速）
- ✅ 可选异步模式（长时间任务）
- ✅ 复用现有RapidAPI服务
- ✅ 可选的认证和积分

**实现逻辑**：
```typescript
export async function POST(request: Request) {
  try {
    const { url, async, format } = await request.json();
    
    // 验证URL
    if (!isValidYouTubeUrl(url)) {
      return respErr('Invalid YouTube URL');
    }
    
    // 如果async=true，使用异步模式
    if (async) {
      return await handleAsyncMode(url, format);
    }
    
    // 否则使用同步模式
    return await handleSyncMode(url, format);
  } catch (error) {
    return respErr(error.message);
  }
}

// 同步模式：立即返回结果
async function handleSyncMode(url: string, format?: string) {
  const rapidAPI = getRapidAPIService();
  const data = await rapidAPI.fetchYouTubeMedia(url);
  
  let transcription = data.subtitleRaw || '';
  
  // 格式化输出
  if (format === 'text' && transcription) {
    // 从SRT提取纯文本
    transcription = extractTextFromSRT(transcription);
  }
  
  return respData({
    transcription: transcription,
    metadata: {
      title: data.title,
      author: data.author,
      duration: data.duration,
      sourceLang: data.sourceLang
    }
  });
}

// 异步模式：返回任务ID
async function handleAsyncMode(url: string, format?: string) {
  // 类似方案二，创建任务并后台处理
  // ...
}
```

---

## 四、技术实现细节

### 4.1 复用现有服务

**使用现有的RapidAPI服务**：
```typescript
import { getRapidAPIServiceWithConfigs } from '@/shared/services/media/rapidapi';
import { getAllConfigs } from '@/shared/models/config';

async function getRapidAPIService() {
  const configs = await getAllConfigs();
  return getRapidAPIServiceWithConfigs(configs);
}
```

**优势**：
- ✅ 复用现有代码
- ✅ 统一的配置管理
- ✅ 统一的错误处理

### 4.2 URL验证

```typescript
function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}
```

### 4.3 SRT到文本转换

```typescript
function extractTextFromSRT(srt: string): string {
  // 移除SRT时间戳和序号
  return srt
    .replace(/^\d+$/gm, '')  // 移除序号
    .replace(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/gm, '')  // 移除时间戳
    .replace(/^\s*$/gm, '')  // 移除空行
    .trim();
}
```

### 4.4 错误处理

```typescript
// 错误代码定义
const ERROR_CODES = {
  INVALID_URL: 'INVALID_URL',
  NO_TRANSCRIPT: 'NO_TRANSCRIPT',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS'
};

// 统一错误响应
function respErr(message: string, code?: string) {
  return Response.json({
    success: false,
    error: message,
    code: code || 'UNKNOWN_ERROR'
  }, { status: 400 });
}
```

---

## 五、文件结构

### 5.1 新建文件

```
src/app/api/youtube/
  └── transcript/
      └── route.ts          # 主API端点
```

### 5.2 可选：工具函数

```
src/shared/lib/
  └── youtube-transcript.ts  # YouTube转录工具函数
    - isValidYouTubeUrl()
    - extractTextFromSRT()
    - normalizeYouTubeUrl()
```

---

## 六、实现步骤

### 阶段一：基础实现（方案一）

1. **创建API端点**
   - 创建 `src/app/api/youtube/transcript/route.ts`
   - 实现基本的POST处理

2. **URL验证**
   - 实现 `isValidYouTubeUrl()` 函数
   - 添加URL格式检查

3. **集成RapidAPI服务**
   - 复用现有的 `getRapidAPIServiceWithConfigs()`
   - 调用 `fetchYouTubeMedia()` 方法

4. **格式化响应**
   - 提取转录文本
   - 格式化元数据
   - 返回标准JSON响应

5. **错误处理**
   - 添加try-catch
   - 定义错误代码
   - 返回友好错误信息

**预计代码量**：~100行
**预计时间**：1-2小时

---

### 阶段二：功能增强（可选）

1. **支持SRT格式**
   - 添加format参数
   - 实现SRT到文本转换

2. **可选认证**
   - 检查用户登录状态
   - 可选：积分消耗

3. **缓存机制**
   - 检查视频缓存
   - 避免重复API调用

4. **异步模式**
   - 添加async参数
   - 实现任务队列

**预计代码量**：+200行
**预计时间**：2-3小时

---

## 七、API使用示例

### 7.1 基本使用（同步）

**请求**：
```bash
curl -X POST http://localhost:3000/api/youtube/transcript \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=JrNlpPXOqtk"}'
```

**响应**：
```json
{
  "success": true,
  "transcription": "This is the transcript of the video...",
  "metadata": {
    "title": "Video Title",
    "author": "Channel Name",
    "duration": 300,
    "sourceLang": "en"
  }
}
```

### 7.2 使用Python

```python
import requests

url = "https://your-domain.com/api/youtube/transcript"
payload = {"url": "https://www.youtube.com/watch?v=JrNlpPXOqtk"}

response = requests.post(url, json=payload)

if response.status_code == 200:
    data = response.json()
    if data["success"]:
        print("Transcription:", data["transcription"])
    else:
        print("Error:", data["error"])
else:
    print("HTTP Error:", response.status_code)
```

### 7.3 使用Postman

1. 创建新请求
2. 方法：POST
3. URL：`http://localhost:3000/api/youtube/transcript`
4. Headers：`Content-Type: application/json`
5. Body (raw JSON)：
   ```json
   {
     "url": "https://www.youtube.com/watch?v=JrNlpPXOqtk"
   }
   ```
6. 点击Send

---

## 八、与现有系统集成

### 8.1 复用现有服务

**不破坏shipany结构**：
- ✅ 新建独立端点 `/api/youtube/transcript`
- ✅ 复用现有的RapidAPI服务层
- ✅ 不修改现有 `/api/media/submit` 逻辑
- ✅ 可选的与积分系统集成

### 8.2 配置管理

**使用现有配置**：
```typescript
// 自动从数据库或环境变量读取
const configs = await getAllConfigs();
const rapidAPI = getRapidAPIServiceWithConfigs(configs);
```

### 8.3 可选集成点

**积分系统**（可选）：
```typescript
// 如果启用认证，检查积分
if (requireAuth) {
  const user = await getUserInfo();
  if (user) {
    await consumeCredits(user.id, 10);
  }
}
```

**缓存系统**（可选）：
```typescript
// 检查视频缓存
const cached = await findValidVideoCache(fingerprint);
if (cached && cached.subtitleRaw) {
  return respData({ transcription: cached.subtitleRaw });
}
```

---

## 九、测试计划

### 9.1 单元测试

```typescript
// 测试URL验证
test('isValidYouTubeUrl', () => {
  expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
  expect(isValidYouTubeUrl('invalid-url')).toBe(false);
});

// 测试SRT转换
test('extractTextFromSRT', () => {
  const srt = '1\n00:00:00,000 --> 00:00:05,000\nHello world';
  expect(extractTextFromSRT(srt)).toBe('Hello world');
});
```

### 9.2 集成测试

```typescript
// 测试完整API流程
test('POST /api/youtube/transcript', async () => {
  const response = await fetch('/api/youtube/transcript', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=JrNlpPXOqtk'
    })
  });
  
  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data.transcription).toBeDefined();
});
```

### 9.3 错误场景测试

- ❌ 无效URL
- ❌ 无转录的视频
- ❌ RapidAPI错误
- ❌ 网络超时
- ❌ 认证失败（如果启用）

---

## 十、性能考虑

### 10.1 响应时间

**同步模式**：
- 目标：< 5秒
- 实际：取决于RapidAPI响应时间

**优化方案**：
- ✅ 缓存机制（减少API调用）
- ✅ 超时控制（避免长时间等待）
- ✅ 错误快速失败

### 10.2 并发处理

**限制**：
- 根据用户计划限制并发数
- 使用队列管理长时间任务

### 10.3 资源消耗

**API调用**：
- 复用现有RapidAPI服务
- 避免重复调用

**数据库**：
- 可选：缓存结果到数据库
- 定期清理过期缓存

---

## 十一、安全考虑

### 11.1 输入验证

- ✅ URL格式验证
- ✅ URL长度限制
- ✅ 防止注入攻击

### 11.2 认证（可选）

- ⚠️ 可选：要求用户登录
- ⚠️ 可选：API密钥认证
- ⚠️ 可选：速率限制

### 11.3 错误信息

- ✅ 不暴露内部错误细节
- ✅ 返回友好的错误消息
- ✅ 记录详细错误日志

---

## 十二、部署考虑

### 12.1 环境变量

**必需**：
```env
NEXT_PUBLIC_RAPIDAPI_KEY=your-key
```

**可选**：
```env
YOUTUBE_TRANSCRIPT_REQUIRE_AUTH=false
YOUTUBE_TRANSCRIPT_REQUIRE_CREDITS=false
YOUTUBE_TRANSCRIPT_CACHE_ENABLED=true
```

### 12.2 监控

- ✅ API调用次数
- ✅ 错误率
- ✅ 响应时间
- ✅ 缓存命中率

---

## 十三、推荐方案

### 13.1 推荐：方案三（混合实现）

**理由**：
1. ✅ 默认简单（同步模式）
2. ✅ 可选复杂（异步模式）
3. ✅ 复用现有服务
4. ✅ 不破坏现有结构
5. ✅ 易于扩展

### 13.2 实现优先级

**Phase 1（必须）**：
- ✅ 基础同步实现
- ✅ URL验证
- ✅ 错误处理

**Phase 2（推荐）**：
- ⚠️ SRT格式支持
- ⚠️ 缓存机制

**Phase 3（可选）**：
- ⚠️ 异步模式
- ⚠️ 认证集成
- ⚠️ 积分集成

---

## 十四、总结

### 14.1 核心设计原则

1. **简单优先**：默认提供简单的同步API
2. **复用现有**：充分利用现有RapidAPI服务
3. **不破坏结构**：新建独立端点，不修改现有代码
4. **易于扩展**：支持后续功能增强

### 14.2 实现建议

**立即实现**：
- 方案一：简单同步实现（~100行代码）

**后续优化**：
- 添加缓存机制
- 支持SRT格式
- 可选异步模式

### 14.3 预期效果

- ✅ 提供类似教程的简洁API
- ✅ 保持与现有系统兼容
- ✅ 易于使用和维护
- ✅ 可选的与现有功能集成

---

**文档版本**：v1.0
**创建时间**：2024年
**状态**：待实现



