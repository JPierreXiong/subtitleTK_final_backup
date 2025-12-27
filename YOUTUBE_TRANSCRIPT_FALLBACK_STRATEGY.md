# YouTube Transcript API 降级策略实现方案

## 📋 核心约束（必须严格遵守）

1. **每个功能有2个替代方案**
   - ① 免费优先（API 1）
   - ② 失败/限额/不可用 → 启用付费（API 2）

2. **严格调用顺序**
   - Link 1 → **只调用1次API**
   - 如果报错/quota/link unavailable → **切到Link 2**
   - ❌ **绝不能对同一个link重复调用API**

3. **目标功能**
   - YouTube 文案提取/转写/下载（transcript）

---

## 一、两个API方案对比分析

### 1.1 API方案A：免费优先（Primary）

**YouTube Video Summarizer GPT AI - Version 2**

```http
GET https://youtube-video-summarizer-gpt-ai.p.rapidapi.com/api/v1/get-transcript-v2
?video_id={VIDEO_ID}&platform=youtube

Headers:
  x-rapidapi-host: youtube-video-summarizer-gpt-ai.p.rapidapi.com
  x-rapidapi-key: {API_KEY}
```

**特点**：
- ✅ 免费额度多
- ⚠️ 稳定性中等（可能触发429/限额）
- ⚠️ 返回结构可能不稳定（有时只有summary，transcript可能被截断）
- ⚠️ 更适合内容理解，不是纯转写

**风险点**：
1. `429 Too Many Requests` - 免费接口最容易触发
2. `Quota exceeded` - 免费额度用完
3. `Free plan disabled` - 免费计划被禁用
4. 返回结构不稳定 - transcript可能为空但summary存在

---

### 1.2 API方案B：付费兜底（Fallback）

**Youtube Transcripts - Transcribe Youtube Video to Text**

```http
POST https://youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com/transcribe

Headers:
  Content-Type: application/json
  x-rapidapi-host: youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com
  x-rapidapi-key: {API_KEY}

Body:
  {
    "url": "https://www.youtube.com/watch?v={VIDEO_ID}"
  }
```

**特点**：
- ✅ 价格便宜
- ✅ 稳定性高
- ✅ 返回结构极其稳定：`{"transcription": "..."}`
- ✅ 失败原因清晰（视频无字幕、私有视频、URL不合法）
- ✅ 非常适合作为fallback

---

## 二、失败判断标准（关键）

### 2.1 API 1（免费）失败判断条件

**必须同时满足以下条件才判定为失败**：

```typescript
interface FailureConditions {
  // HTTP层面失败
  httpFailure: boolean;  // status !== 200
  
  // 业务层面失败
  quotaExceeded: boolean;  // status === 429 || message包含"quota"|"limit"
  freePlanDisabled: boolean;  // message包含"free plan"|"disabled"
  
  // 数据层面失败
  noTranscript: boolean;  // response.transcript不存在或为空
  transcriptTooShort: boolean;  // transcript长度 < 最小阈值（如300字符）
  onlySummary: boolean;  // 只有summary但没有transcript
}
```

**成功条件（必须全部满足）**：
```typescript
const isSuccess = 
  response.status === 200 &&
  response.data?.transcript &&
  response.data.transcript.length >= MIN_TRANSCRIPT_LENGTH &&
  !response.data.transcript.includes('summary only');  // 防止误判
```

**失败场景分类**：

| 场景 | HTTP状态 | 错误信息特征 | 是否切换API 2 |
|------|---------|------------|-------------|
| 429限流 | 429 | "rate limit" / "too many requests" | ✅ 是 |
| 额度用完 | 200/429 | "quota exceeded" / "limit reached" | ✅ 是 |
| 免费计划禁用 | 403/200 | "free plan disabled" | ✅ 是 |
| 无transcript | 200 | transcript字段不存在/为空 | ✅ 是 |
| 只有summary | 200 | 有summary但无transcript | ✅ 是 |
| 网络错误 | 500+ | 网络超时/连接失败 | ✅ 是 |
| 视频无字幕 | 200 | "no transcript available" | ✅ 是 |

---

### 2.2 API 2（付费）失败判断条件

**失败条件**：
```typescript
interface FailureConditions {
  httpFailure: boolean;  // status !== 200
  noTranscription: boolean;  // response.transcription不存在或为空
  videoNotFound: boolean;  // "video not found" / "invalid url"
  privateVideo: boolean;  // "private video" / "access denied"
  noSubtitle: boolean;  // "no subtitle available"
}
```

**成功条件**：
```typescript
const isSuccess = 
  response.status === 200 &&
  response.transcription &&
  response.transcription.length > 0;
```

---

## 三、实现架构设计

### 3.1 调用流程图

```
开始
  ↓
提取video_id（统一预处理）
  ↓
┌─────────────────────────────────┐
│ API 1: 免费Summarizer (GET)     │
│ - 只调用1次                       │
│ - 严格判断成功/失败               │
└─────────────────────────────────┘
  ↓
  ├─ 成功 → 返回结果 → 结束
  │
  └─ 失败 → 判断失败类型
      ↓
      ├─ 429/Quota → 切换API 2
      ├─ No Transcript → 切换API 2
      └─ 其他错误 → 切换API 2
      ↓
┌─────────────────────────────────┐
│ API 2: 付费Transcript (POST)    │
│ - 只调用1次                       │
│ - 最终兜底                       │
└─────────────────────────────────┘
  ↓
  ├─ 成功 → 返回结果 → 结束
  │
  └─ 失败 → 返回错误（两个都失败）
```

---

### 3.2 核心实现逻辑

#### Step 0: 统一预处理

```typescript
/**
 * 从YouTube URL提取video_id
 * 支持多种URL格式
 */
function extractYouTubeVideoId(url: string): string | null {
  // 支持格式：
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}
```

---

#### Step 1: API 1调用（免费，只调用1次）

```typescript
/**
 * 调用免费API（只调用1次，失败即切换）
 */
async function fetchWithFreeAPI(videoId: string): Promise<TranscriptResult | FailureReason> {
  const apiUrl = `https://youtube-video-summarizer-gpt-ai.p.rapidapi.com/api/v1/get-transcript-v2?video_id=${videoId}&platform=youtube`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'youtube-video-summarizer-gpt-ai.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      signal: AbortSignal.timeout(30000),  // 30秒超时
    });
    
    // HTTP层面失败
    if (!response.ok) {
      if (response.status === 429) {
        return {
          failed: true,
          reason: 'RATE_LIMIT',
          message: 'Free API rate limit exceeded',
        };
      }
      return {
        failed: true,
        reason: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    // 业务层面失败判断
    const errorMessage = (data.error || data.message || '').toLowerCase();
    
    // 检查额度/限额
    if (
      response.status === 429 ||
      errorMessage.includes('quota') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('free plan disabled')
    ) {
      return {
        failed: true,
        reason: 'QUOTA_EXCEEDED',
        message: 'Free API quota exceeded or disabled',
      };
    }
    
    // 数据层面失败判断
    const transcript = data.transcript || data.transcription || '';
    
    // 检查是否有transcript
    if (!transcript || transcript.trim().length === 0) {
      return {
        failed: true,
        reason: 'NO_TRANSCRIPT',
        message: 'No transcript available in response',
      };
    }
    
    // 检查transcript长度（防止只有summary）
    const MIN_TRANSCRIPT_LENGTH = 300;  // 最小300字符
    if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
      // 如果只有summary但transcript太短，判定为失败
      if (data.summary && data.summary.length > transcript.length) {
        return {
          failed: true,
          reason: 'ONLY_SUMMARY',
          message: 'Only summary available, transcript too short',
        };
      }
    }
    
    // ✅ 成功：返回transcript
    return {
      success: true,
      transcript: transcript,
      source: 'free_api',
      metadata: {
        title: data.title,
        author: data.author,
        summary: data.summary,  // 额外bonus
      },
    };
    
  } catch (error: any) {
    // 网络错误/超时
    return {
      failed: true,
      reason: 'NETWORK_ERROR',
      message: error.message || 'Network error',
    };
  }
}
```

---

#### Step 2: API 2调用（付费，只调用1次）

```typescript
/**
 * 调用付费API（只调用1次，最终兜底）
 */
async function fetchWithPaidAPI(youtubeUrl: string): Promise<TranscriptResult | FailureReason> {
  const apiUrl = 'https://youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com/transcribe';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      body: JSON.stringify({ url: youtubeUrl }),
      signal: AbortSignal.timeout(30000),  // 30秒超时
    });
    
    // HTTP层面失败
    if (!response.ok) {
      return {
        failed: true,
        reason: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    // 业务层面失败判断
    const transcription = data.transcription || '';
    
    if (!transcription || transcription.trim().length === 0) {
      const errorMsg = data.error || data.message || 'No transcription available';
      return {
        failed: true,
        reason: 'NO_TRANSCRIPTION',
        message: errorMsg,
      };
    }
    
    // 检查特定错误信息
    const errorMessage = (errorMsg || '').toLowerCase();
    if (
      errorMessage.includes('video not found') ||
      errorMessage.includes('invalid url')
    ) {
      return {
        failed: true,
        reason: 'VIDEO_NOT_FOUND',
        message: 'Video not found or invalid URL',
      };
    }
    
    if (
      errorMessage.includes('private video') ||
      errorMessage.includes('access denied')
    ) {
      return {
        failed: true,
        reason: 'PRIVATE_VIDEO',
        message: 'Video is private or access denied',
      };
    }
    
    if (errorMessage.includes('no subtitle')) {
      return {
        failed: true,
        reason: 'NO_SUBTITLE',
        message: 'Video has no subtitle available',
      };
    }
    
    // ✅ 成功：返回transcription
    return {
      success: true,
      transcript: transcription,
      source: 'paid_api',
      metadata: {},
    };
    
  } catch (error: any) {
    // 网络错误/超时
    return {
      failed: true,
      reason: 'NETWORK_ERROR',
      message: error.message || 'Network error',
    };
  }
}
```

---

#### Step 3: 主流程（严格顺序，只调用1次）

```typescript
/**
 * 主流程：按顺序调用，每个API只调用1次
 */
async function fetchYouTubeTranscript(
  youtubeUrl: string
): Promise<TranscriptResult | FinalFailure> {
  // Step 0: 预处理
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    return {
      failed: true,
      reason: 'INVALID_URL',
      message: 'Invalid YouTube URL format',
    };
  }
  
  // Step 1: 调用免费API（只调用1次）
  console.log('[API 1] Attempting free API...');
  const result1 = await fetchWithFreeAPI(videoId);
  
  // 如果成功，立即返回（不再调用API 2）
  if (result1.success) {
    console.log('[API 1] Success! Using free API result.');
    return result1;
  }
  
  // Step 2: 免费API失败，切换到付费API（只调用1次）
  console.log(`[API 1] Failed: ${result1.reason} - ${result1.message}`);
  console.log('[API 2] Attempting paid API as fallback...');
  
  const result2 = await fetchWithPaidAPI(youtubeUrl);
  
  // 如果成功，返回结果
  if (result2.success) {
    console.log('[API 2] Success! Using paid API result.');
    return result2;
  }
  
  // Step 3: 两个API都失败，返回最终错误
  console.log(`[API 2] Failed: ${result2.reason} - ${result2.message}`);
  return {
    failed: true,
    reason: 'ALL_APIS_FAILED',
    message: `Both APIs failed. API 1: ${result1.reason}, API 2: ${result2.reason}`,
    details: {
      api1Failure: result1,
      api2Failure: result2,
    },
  };
}
```

---

## 四、类型定义

```typescript
/**
 * 成功结果
 */
interface TranscriptResult {
  success: true;
  transcript: string;
  source: 'free_api' | 'paid_api';
  metadata?: {
    title?: string;
    author?: string;
    summary?: string;
    duration?: number;
    sourceLang?: string;
  };
}

/**
 * 失败原因
 */
interface FailureReason {
  failed: true;
  reason:
    | 'RATE_LIMIT'           // 429限流
    | 'QUOTA_EXCEEDED'       // 额度用完
    | 'NO_TRANSCRIPT'        // 无transcript
    | 'ONLY_SUMMARY'         // 只有summary
    | 'HTTP_ERROR'           // HTTP错误
    | 'NETWORK_ERROR'        // 网络错误
    | 'VIDEO_NOT_FOUND'      // 视频不存在
    | 'PRIVATE_VIDEO'        // 私有视频
    | 'NO_SUBTITLE'         // 无字幕
    | 'INVALID_URL'          // 无效URL
    | 'ALL_APIS_FAILED';     // 两个都失败
  message: string;
}

/**
 * 最终失败（两个API都失败）
 */
interface FinalFailure extends FailureReason {
  details?: {
    api1Failure: FailureReason;
    api2Failure: FailureReason;
  };
}
```

---

## 五、集成到现有ShipAny架构

### 5.1 修改位置

**文件**：`src/extensions/media/rapidapi.ts`

**方法**：`fetchYouTubeMedia()` 或新增 `fetchYouTubeTranscriptWithFallback()`

### 5.2 集成方式

```typescript
/**
 * 在RapidAPIProvider类中新增方法
 */
export class RapidAPIProvider {
  // ... 现有代码 ...
  
  /**
   * 获取YouTube转录（带降级策略）
   * 先尝试免费API，失败后使用付费API
   */
  async fetchYouTubeTranscriptWithFallback(
    url: string
  ): Promise<NormalizedMediaData> {
    // 调用主流程
    const result = await fetchYouTubeTranscript(url);
    
    // 处理成功结果
    if (result.success) {
      return this.normalizeTranscriptResult(result);
    }
    
    // 处理失败结果
    throw new Error(`Failed to fetch transcript: ${result.message}`);
  }
  
  /**
   * 标准化转录结果
   */
  private normalizeTranscriptResult(
    result: TranscriptResult
  ): NormalizedMediaData {
    return {
      platform: 'youtube',
      title: result.metadata?.title || '',
      author: result.metadata?.author,
      subtitleRaw: result.transcript,
      sourceLang: 'auto',
      subtitleCharCount: result.transcript.length,
      subtitleLineCount: this.countSRTLines(result.transcript),
      // ... 其他字段
    };
  }
}
```

### 5.3 在现有流程中调用

**文件**：`src/app/api/media/submit/route.ts`

**修改点**：在 `processMediaTask()` 函数中

```typescript
async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  // ... 现有代码 ...
  
  // 如果是YouTube字幕提取，使用降级策略
  if (outputType === 'subtitle' && url.includes('youtube.com')) {
    try {
      const rapidAPI = getRapidAPIService();
      const mediaData = await rapidAPI.fetchYouTubeTranscriptWithFallback(url);
      
      // 保存结果
      await updateMediaTaskById(taskId, {
        status: 'extracted',
        subtitleRaw: mediaData.subtitleRaw,
        // ... 其他字段
      });
      
      return;  // 成功，结束
    } catch (error) {
      // 两个API都失败，更新任务状态
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message,
      });
      return;
    }
  }
  
  // ... 其他平台的现有逻辑 ...
}
```

---

## 六、配置管理

### 6.1 环境变量

```env
# RapidAPI配置（复用现有）
NEXT_PUBLIC_RAPIDAPI_KEY=558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b

# YouTube转录API配置（可选）
YOUTUBE_TRANSCRIPT_MIN_LENGTH=300  # 最小transcript长度
YOUTUBE_TRANSCRIPT_TIMEOUT=30000    # 超时时间（毫秒）
YOUTUBE_TRANSCRIPT_ENABLE_FALLBACK=true  # 是否启用降级
```

### 6.2 配置结构

```typescript
interface YouTubeTranscriptConfig {
  // API 1 (免费)
  freeAPI: {
    host: 'youtube-video-summarizer-gpt-ai.p.rapidapi.com';
    endpoint: '/api/v1/get-transcript-v2';
    method: 'GET';
    timeout: 30000;
  };
  
  // API 2 (付费)
  paidAPI: {
    host: 'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com';
    endpoint: '/transcribe';
    method: 'POST';
    timeout: 30000;
  };
  
  // 业务规则
  rules: {
    minTranscriptLength: 300;  // 最小transcript长度
    enableFallback: true;      // 是否启用降级
  };
}
```

---

## 七、错误处理和日志

### 7.1 错误分类

```typescript
enum TranscriptErrorCode {
  // API 1错误
  FREE_API_RATE_LIMIT = 'FREE_API_RATE_LIMIT',
  FREE_API_QUOTA_EXCEEDED = 'FREE_API_QUOTA_EXCEEDED',
  FREE_API_NO_TRANSCRIPT = 'FREE_API_NO_TRANSCRIPT',
  FREE_API_ONLY_SUMMARY = 'FREE_API_ONLY_SUMMARY',
  
  // API 2错误
  PAID_API_NO_TRANSCRIPTION = 'PAID_API_NO_TRANSCRIPTION',
  PAID_API_VIDEO_NOT_FOUND = 'PAID_API_VIDEO_NOT_FOUND',
  PAID_API_PRIVATE_VIDEO = 'PAID_API_PRIVATE_VIDEO',
  
  // 通用错误
  INVALID_URL = 'INVALID_URL',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  ALL_APIS_FAILED = 'ALL_APIS_FAILED',
}
```

### 7.2 日志记录

```typescript
/**
 * 记录API调用日志
 */
function logAPICall(
  apiName: 'free' | 'paid',
  videoId: string,
  result: 'success' | 'failure',
  reason?: string
) {
  console.log(`[YouTube Transcript] ${apiName.toUpperCase()} API:`, {
    videoId,
    result,
    reason,
    timestamp: new Date().toISOString(),
  });
  
  // 可选：记录到数据库或日志服务
  // await logToDatabase({ apiName, videoId, result, reason });
}
```

---

## 八、测试用例

### 8.1 成功场景

```typescript
// 测试1: API 1成功
test('API 1 success - should not call API 2', async () => {
  const result = await fetchYouTubeTranscript('https://www.youtube.com/watch?v=abc123');
  expect(result.success).toBe(true);
  expect(result.source).toBe('free_api');
  // 验证API 2未被调用
});

// 测试2: API 1失败，API 2成功
test('API 1 failure, API 2 success', async () => {
  // Mock API 1返回429
  mockAPI1.mockReturnValue({ status: 429 });
  
  const result = await fetchYouTubeTranscript('https://www.youtube.com/watch?v=abc123');
  expect(result.success).toBe(true);
  expect(result.source).toBe('paid_api');
  // 验证API 1只调用1次
  expect(mockAPI1).toHaveBeenCalledTimes(1);
  // 验证API 2只调用1次
  expect(mockAPI2).toHaveBeenCalledTimes(1);
});
```

### 8.2 失败场景

```typescript
// 测试3: 两个API都失败
test('Both APIs failed', async () => {
  mockAPI1.mockReturnValue({ status: 429 });
  mockAPI2.mockReturnValue({ status: 500 });
  
  const result = await fetchYouTubeTranscript('https://www.youtube.com/watch?v=abc123');
  expect(result.failed).toBe(true);
  expect(result.reason).toBe('ALL_APIS_FAILED');
});

// 测试4: 无效URL
test('Invalid URL', async () => {
  const result = await fetchYouTubeTranscript('invalid-url');
  expect(result.failed).toBe(true);
  expect(result.reason).toBe('INVALID_URL');
});
```

### 8.3 边界场景

```typescript
// 测试5: API 1返回空transcript
test('API 1 returns empty transcript', async () => {
  mockAPI1.mockReturnValue({
    status: 200,
    data: { transcript: '' }
  });
  
  const result = await fetchYouTubeTranscript('https://www.youtube.com/watch?v=abc123');
  // 应该切换到API 2
  expect(mockAPI2).toHaveBeenCalledTimes(1);
});

// 测试6: API 1返回只有summary
test('API 1 returns only summary', async () => {
  mockAPI1.mockReturnValue({
    status: 200,
    data: {
      summary: 'Long summary...',
      transcript: 'Short'  // 太短
    }
  });
  
  const result = await fetchYouTubeTranscript('https://www.youtube.com/watch?v=abc123');
  // 应该切换到API 2
  expect(mockAPI2).toHaveBeenCalledTimes(1);
});
```

---

## 九、性能优化

### 9.1 超时控制

```typescript
const API_TIMEOUT = 30000;  // 30秒

// 使用AbortSignal控制超时
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

### 9.2 缓存机制（可选）

```typescript
/**
 * 缓存成功的transcript结果
 * 避免重复调用相同视频
 */
async function fetchWithCache(
  videoId: string,
  fetchFn: () => Promise<TranscriptResult>
): Promise<TranscriptResult> {
  // 检查缓存
  const cached = await getCachedTranscript(videoId);
  if (cached) {
    return cached;
  }
  
  // 调用API
  const result = await fetchFn();
  
  // 缓存成功结果
  if (result.success) {
    await setCachedTranscript(videoId, result);
  }
  
  return result;
}
```

---

## 十、监控和告警

### 10.1 关键指标

```typescript
interface Metrics {
  // API调用统计
  api1SuccessCount: number;
  api1FailureCount: number;
  api2SuccessCount: number;
  api2FailureCount: number;
  
  // 失败原因统计
  failureReasons: Record<string, number>;
  
  // 性能指标
  api1AvgResponseTime: number;
  api2AvgResponseTime: number;
  
  // 成本指标（如果API 2是付费的）
  api2CallCount: number;  // 监控付费API调用次数
}
```

### 10.2 告警规则

```typescript
// 如果API 1失败率 > 50%，告警
if (api1FailureRate > 0.5) {
  alert('API 1 failure rate is high, consider switching to API 2 by default');
}

// 如果API 2调用次数激增，告警（成本控制）
if (api2CallCount > dailyLimit) {
  alert('API 2 call count exceeded daily limit');
}
```

---

## 十一、实施步骤

### Phase 1: 基础实现（必须）

1. ✅ 实现 `extractYouTubeVideoId()` 函数
2. ✅ 实现 `fetchWithFreeAPI()` 函数
3. ✅ 实现 `fetchWithPaidAPI()` 函数
4. ✅ 实现 `fetchYouTubeTranscript()` 主流程
5. ✅ 添加严格的失败判断逻辑
6. ✅ 集成到现有 `RapidAPIProvider` 类

**预计时间**：2-3小时
**代码量**：~300行

---

### Phase 2: 测试和优化（推荐）

1. ⚠️ 编写单元测试
2. ⚠️ 编写集成测试
3. ⚠️ 性能测试
4. ⚠️ 错误场景测试

**预计时间**：2-3小时

---

### Phase 3: 监控和告警（可选）

1. ⚠️ 添加日志记录
2. ⚠️ 添加指标统计
3. ⚠️ 设置告警规则

**预计时间**：1-2小时

---

## 十二、总结

### 12.1 核心原则

1. ✅ **免费优先**：先调用免费API
2. ✅ **只调用1次**：每个API严格只调用1次
3. ✅ **严格判断**：明确的成功/失败判断标准
4. ✅ **自动降级**：失败后自动切换到付费API
5. ✅ **不破坏结构**：集成到现有ShipAny架构

### 12.2 关键设计点

1. **失败判断要严格**：防止误判导致重复调用
2. **超时控制**：避免长时间等待
3. **错误分类**：清晰的错误原因，便于调试
4. **日志记录**：完整的调用日志，便于排查问题

### 12.3 预期效果

- ✅ 最大化利用免费API额度
- ✅ 在免费API失败时自动降级
- ✅ 每个API只调用1次，避免浪费
- ✅ 稳定的转录服务，提高成功率

---

**文档版本**：v1.0
**创建时间**：2024年
**状态**：待实现

