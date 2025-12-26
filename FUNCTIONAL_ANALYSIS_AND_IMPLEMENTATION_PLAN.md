# 功能分析与实现方案

## 📋 目录

1. [当前功能实现小结](#当前功能实现小结)
2. [新需求分析](#新需求分析)
3. [数据库存储方案](#数据库存储方案)
4. [视频暂存24小时方案](#视频暂存24小时方案)
5. [Gemini 3 Flash 翻译方案](#gemini-3-flash-翻译方案)
6. [UI/UX 改进方案](#uiux-改进方案)
7. [进度条与Loading动效方案](#进度条与loading动效方案)
8. [CSV导出功能方案](#csv导出功能方案)
9. [实施优先级建议](#实施优先级建议)

---

## 一、当前功能实现小结

### 1.1 现有架构

#### 前端组件 (`src/shared/blocks/generator/media.tsx`)
- **URL输入**: 支持YouTube和TikTok链接输入
- **语言选择**: 
  - 源语言：显示检测到的语言（只读）
  - 目标语言：12种语言下拉菜单（en, zh-CN, es, fr, de, ja, ko, pt, ru, it, ar, hi）
- **输出类型**: subtitle（字幕）或 video（视频）
- **状态管理**: 
  - 使用轮询机制（每3秒）查询任务状态
  - 进度条显示（0-100%）
  - 超时处理（3分钟）

#### 后端API
- **`/api/media/submit`**: 提交媒体处理任务
- **`/api/media/status`**: 查询任务状态

#### 数据库表结构 (`mediaTasks`)
```typescript
{
  id: string
  userId: string
  platform: 'youtube' | 'tiktok'
  videoUrl: string
  thumbnailUrl?: string
  title?: string          // ✅ 已存在
  author?: string
  duration?: number
  likes?: integer         // ✅ 已存在
  views?: integer         // ✅ 已存在
  shares?: integer        // ✅ 已存在
  publishedAt?: timestamp
  sourceLang?: string
  targetLang?: string
  status: 'pending' | 'extracting' | 'translating' | 'completed' | 'failed'
  progress: 0-100
  srtUrl?: string         // 原生语言SRT文件URL
  translatedSrtUrl?: string  // 翻译后SRT文件URL
  resultVideoUrl?: string     // TikTok视频下载URL
  errorMessage?: string
}
```

### 1.2 当前工作流程

1. **用户输入URL** → 验证URL格式
2. **选择目标语言和输出类型** → 前端验证
3. **点击提取按钮** → 提交到 `/api/media/submit`
4. **后端创建任务** → 状态：pending
5. **前端轮询状态** → 每3秒查询 `/api/media/status`
6. **后端处理** → 状态变化：extracting → translating → completed
7. **前端显示结果** → 提供下载按钮

### 1.3 当前限制

- ❌ 视频元数据（标题、点赞、播放量、转发）可能未完全提取和保存
- ❌ 视频文案（字幕文本）未存储在数据库中
- ❌ 视频文件未实现24小时暂存机制
- ❌ 翻译可能使用Google翻译，需要替换为Gemini 3 Flash
- ❌ UI布局不符合新需求（3个按钮布局）
- ❌ 进度条和Loading动效需要优化
- ❌ 缺少CSV导出功能

---

## 二、新需求分析

### 2.1 UI布局需求

**当前布局**:
```
[URL输入框]
[源语言] (只读)
[目标语言下拉菜单]
[输出类型下拉菜单] (subtitle/video)
[提取按钮]
```

**新需求布局**:
```
[URL输入框]
[按钮1: 母语] (不可选择，显示检测到的语言)
[按钮2: 目标语言下拉菜单] (12种语言)
[按钮3: 输出类型下拉菜单] (subtitle/video)
[下载按钮] (只有选择下载时才显示/启用)
```

**关键变化**:
- 第一个按钮显示母语，不可选择
- 第二个按钮是下拉菜单，可选12种语言
- 第三个按钮选择subtitle或video
- 只有选择"下载"时才启用下载按钮
- 所有显示默认使用英语

### 2.2 功能流程需求

#### 场景1: 提取字幕（Subtitle）
1. 用户输入YouTube/TikTok链接
2. 点击"提取字幕"按钮
3. **第一阶段（约3分钟）**:
   - 显示Loading动效和进度条
   - 提取视频字幕
   - **同时提取并保存**: 标题、点赞数、播放量、转发等元数据到数据库
   - 生成原生语言SRT文件
4. **第一阶段完成**:
   - 显示原生语言SRT下载按钮
   - **跳出下拉菜单**选择需要翻译的目标语言
5. **第二阶段（约1分钟）**:
   - 显示翻译进度条
   - 使用Gemini 3 Flash翻译字幕
   - 生成翻译后的SRT文件
6. **完成**:
   - 显示两个SRT文件下载按钮

#### 场景2: 下载视频（仅TikTok）
1. 用户输入TikTok链接
2. 选择"视频"输出类型
3. 点击"下载视频"按钮
4. **处理过程（约3分钟）**:
   - 显示Loading动效和进度条
   - 下载TikTok视频
   - **同时提取并保存**: 标题、点赞数、播放量、转发等元数据到数据库
   - 视频暂存24小时
5. **完成**:
   - 显示视频下载按钮

---

## 三、数据库存储方案

### 3.1 视频文案存储方案

#### 方案A: 在现有表中添加字段（推荐）

**修改 `mediaTasks` 表**:
```sql
ALTER TABLE media_tasks ADD COLUMN subtitle_text TEXT;  -- 原生语言字幕文本
ALTER TABLE media_tasks ADD COLUMN translated_text TEXT;  -- 翻译后字幕文本
ALTER TABLE media_tasks ADD COLUMN subtitle_json JSONB;  -- 字幕时间轴数据（可选）
```

**优点**:
- 简单直接，无需新建表
- 数据关联清晰，查询方便
- 适合字幕文本不太长的场景

**缺点**:
- 如果字幕文本很长，可能影响查询性能
- 不适合存储大量历史数据

#### 方案B: 新建字幕表（适合大量数据）

**新建 `subtitle_texts` 表**:
```sql
CREATE TABLE subtitle_texts (
  id TEXT PRIMARY KEY,
  media_task_id TEXT NOT NULL REFERENCES media_tasks(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,  -- 'source' 或目标语言代码
  text_content TEXT NOT NULL,
  srt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subtitle_media_task ON subtitle_texts(media_task_id);
```

**优点**:
- 数据分离，查询性能更好
- 支持多语言扩展
- 可以存储完整的时间轴信息

**缺点**:
- 需要额外的JOIN查询
- 表结构更复杂

**推荐**: **方案A**（简单场景）或 **方案B**（需要存储完整时间轴数据）

### 3.2 元数据存储确认

**当前表结构已包含**:
- ✅ `title` - 视频标题
- ✅ `likes` - 点赞数
- ✅ `views` - 播放量
- ✅ `shares` - 转发数
- ✅ `author` - 作者
- ✅ `duration` - 时长
- ✅ `publishedAt` - 发布时间

**需要确认**:
- 这些字段是否在提取过程中被正确填充？
- 是否需要添加更多字段（如评论数、收藏数等）？

### 3.3 数据提取时机

**在 `/api/media/submit` 或后台处理任务中**:
1. 解析视频URL
2. 调用视频信息提取API（YouTube Data API / TikTok API）
3. 提取元数据：
   ```typescript
   {
     title: string,
     likes: number,
     views: number,
     shares: number,
     author: string,
     duration: number,
     publishedAt: Date,
     thumbnailUrl: string
   }
   ```
4. 更新 `mediaTasks` 记录：
   ```typescript
   await updateMediaTaskById(taskId, {
     title: metadata.title,
     likes: metadata.likes,
     views: metadata.views,
     shares: metadata.shares,
     author: metadata.author,
     duration: metadata.duration,
     publishedAt: metadata.publishedAt,
     thumbnailUrl: metadata.thumbnailUrl
   });
   ```

---

## 四、视频暂存24小时方案

### 4.1 存储方案选择

#### 方案A: 使用现有存储服务（R2/S3）

**流程**:
1. 下载TikTok视频到临时目录
2. 上传到R2/S3存储
3. 设置存储桶生命周期策略：24小时后自动删除
4. 返回临时访问URL（24小时有效）

**优点**:
- 利用现有基础设施
- 自动清理，无需手动管理
- 支持CDN加速

**缺点**:
- 需要配置存储桶生命周期策略
- 可能产生存储费用

#### 方案B: 服务器本地存储 + 定时清理

**流程**:
1. 下载TikTok视频到服务器临时目录：`/tmp/videos/{taskId}.mp4`
2. 记录过期时间：`expiresAt = createdAt + 24小时`
3. 创建定时任务（Cron Job）：
   ```typescript
   // 每天凌晨2点清理过期视频
   cron.schedule('0 2 * * *', async () => {
     const expiredTasks = await db()
       .select()
       .from(mediaTasks)
       .where(
         and(
           eq(mediaTasks.resultVideoUrl, isNotNull()),
           lt(mediaTasks.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
         )
       );
     
     for (const task of expiredTasks) {
       // 删除本地文件
       await fs.unlink(`/tmp/videos/${task.id}.mp4`);
       // 更新数据库
       await updateMediaTaskById(task.id, { resultVideoUrl: null });
     }
   });
   ```

**优点**:
- 不依赖外部存储服务
- 完全控制文件生命周期

**缺点**:
- 占用服务器存储空间
- 需要手动实现清理逻辑
- 不适合分布式部署

#### 方案C: 混合方案（推荐）

**流程**:
1. 视频上传到R2/S3
2. 生成预签名URL（24小时有效）
3. 存储预签名URL到数据库
4. 24小时后，预签名URL自动失效
5. 可选：配置存储桶生命周期策略，30天后删除文件

**优点**:
- URL自动过期，无需手动清理
- 利用云存储的CDN优势
- 适合分布式部署

**推荐**: **方案C**

### 4.2 实现细节

**修改 `mediaTasks` 表**:
```sql
ALTER TABLE media_tasks ADD COLUMN video_expires_at TIMESTAMP;  -- 视频过期时间
```

**上传视频代码**:
```typescript
// 上传视频到R2/S3
const uploadResult = await storageService.uploadFile({
  body: videoBuffer,
  key: `videos/${taskId}.mp4`,
  contentType: 'video/mp4',
  bucket: 'media-bucket'
});

// 生成预签名URL（24小时有效）
const videoUrl = await storageService.getPresignedUrl({
  key: `videos/${taskId}.mp4`,
  expiresIn: 24 * 60 * 60  // 24小时
});

// 更新数据库
await updateMediaTaskById(taskId, {
  resultVideoUrl: videoUrl,
  videoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
```

---

## 五、Gemini 3 Flash 翻译方案

### 5.1 可行性分析

**Gemini 3 Flash 特点**:
- ✅ Google最新发布的轻量级AI模型
- ✅ 支持多语言翻译
- ✅ API调用简单
- ✅ 响应速度快（适合实时翻译）
- ✅ 成本较低

**对比Google翻译API**:
- Google翻译API：专门用于翻译，但可能有限制
- Gemini 3 Flash：通用AI模型，可以用于翻译，更灵活

### 5.2 实现方案

#### 步骤1: 添加Gemini配置

**环境变量**:
```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash  # 或 gemini-1.5-pro
```

#### 步骤2: 创建Gemini翻译服务

**新建文件**: `src/extensions/ai/gemini.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiTranslator {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async translateSubtitle(
    subtitleText: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    
    const prompt = `You are a professional subtitle translator. 
Translate the following subtitle text from ${sourceLang} to ${targetLang}.
Keep the timing information intact. Only translate the text content.
Return the translated subtitle in SRT format.

Subtitle text:
${subtitleText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}.
Only return the translated text, no explanations.

Text:
${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}
```

#### 步骤3: 集成到媒体处理流程

**修改媒体处理任务**:
```typescript
// 在翻译阶段使用Gemini
if (targetLang && sourceLang !== targetLang) {
  const geminiTranslator = new GeminiTranslator(
    process.env.GEMINI_API_KEY!,
    'gemini-1.5-flash'
  );
  
  // 读取原生SRT文件
  const sourceSrtContent = await fs.readFile(sourceSrtPath, 'utf-8');
  
  // 使用Gemini翻译
  const translatedSrtContent = await geminiTranslator.translateSubtitle(
    sourceSrtContent,
    sourceLang,
    targetLang
  );
  
  // 保存翻译后的SRT文件
  const translatedSrtPath = `/tmp/subtitles/${taskId}-${targetLang}.srt`;
  await fs.writeFile(translatedSrtPath, translatedSrtContent);
  
  // 上传到存储并更新数据库
  const translatedSrtUrl = await uploadSrtFile(translatedSrtPath);
  await updateMediaTaskById(taskId, {
    translatedSrtUrl,
    status: 'completed'
  });
}
```

### 5.3 成本估算

**Gemini 3 Flash定价**（参考，需确认最新价格）:
- 输入: ~$0.075 per 1M tokens
- 输出: ~$0.30 per 1M tokens

**典型字幕翻译**:
- 输入: ~500 tokens（字幕文本）
- 输出: ~500 tokens（翻译后文本）
- 成本: ~$0.0002 per translation（非常低）

### 5.4 错误处理

```typescript
try {
  const translatedText = await geminiTranslator.translateSubtitle(...);
} catch (error) {
  // 如果Gemini API失败，可以降级到Google翻译API
  console.error('Gemini translation failed, falling back to Google Translate');
  const translatedText = await googleTranslateAPI.translate(...);
}
```

---

## 六、UI/UX 改进方案

### 6.1 新UI布局

```tsx
<Card>
  <CardHeader>
    <CardTitle>Video Subtitle Extractor</CardTitle>
  </CardHeader>
  <CardContent>
    {/* URL输入 */}
    <div className="space-y-2">
      <Label>Video URL</Label>
      <Input 
        placeholder="Enter YouTube or TikTok URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
    </div>

    {/* 三个按钮布局 */}
    <div className="grid grid-cols-3 gap-2">
      {/* 按钮1: 母语（只读） */}
      <Button 
        variant="outline" 
        disabled
        className="w-full"
      >
        <Globe className="mr-2 h-4 w-4" />
        {sourceLang ? getLanguageName(sourceLang) : 'Detecting...'}
      </Button>

      {/* 按钮2: 目标语言下拉菜单 */}
      <Select value={targetLang} onValueChange={setTargetLang}>
        <SelectTrigger>
          <SelectValue placeholder="Target Language" />
        </SelectTrigger>
        <SelectContent>
          {TARGET_LANGUAGES.map(lang => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 按钮3: 输出类型下拉菜单 */}
      <Select value={outputType} onValueChange={setOutputType}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="subtitle">Subtitle</SelectItem>
          <SelectItem value="video">Video</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* 下载按钮（条件显示） */}
    {outputType === 'video' && (
      <Button 
        onClick={handleDownloadVideo}
        disabled={!url || isProcessing}
        className="w-full"
      >
        <Download className="mr-2 h-4 w-4" />
        Download Video
      </Button>
    )}

    {/* 提取字幕按钮 */}
    {outputType === 'subtitle' && (
      <Button 
        onClick={handleExtractSubtitle}
        disabled={!url || !targetLang || isProcessing}
        className="w-full"
      >
        <FileText className="mr-2 h-4 w-4" />
        Extract Subtitle
      </Button>
    )}
  </CardContent>
</Card>
```

### 6.2 两阶段翻译UI

**第一阶段完成后**:
```tsx
{taskStatus?.status === 'extracting' && taskStatus.srtUrl && (
  <div className="space-y-4">
    {/* 显示原生SRT下载 */}
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium mb-2">Native Subtitle Ready</p>
      <Button onClick={() => downloadSrt(taskStatus.srtUrl)}>
        Download Native SRT
      </Button>
    </div>

    {/* 翻译语言选择（新出现） */}
    <div className="space-y-2">
      <Label>Translate to:</Label>
      <Select value={translateLang} onValueChange={setTranslateLang}>
        <SelectTrigger>
          <SelectValue placeholder="Select target language" />
        </SelectTrigger>
        <SelectContent>
          {TARGET_LANGUAGES.map(lang => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button 
        onClick={handleTranslate}
        disabled={!translateLang}
      >
        Translate
      </Button>
    </div>
  </div>
)}
```

---

## 七、进度条与Loading动效方案

### 7.1 进度条设计

#### 阶段1: 提取字幕（0-70%）
- **0-20%**: 解析URL，提取视频信息
- **20-50%**: 下载视频/提取音频
- **50-70%**: 语音识别，生成SRT
- **70%**: 完成，显示原生SRT下载

#### 阶段2: 翻译（70-100%）
- **70-85%**: 调用Gemini API翻译
- **85-95%**: 格式化SRT文件
- **95-100%**: 上传翻译后SRT
- **100%**: 完成

### 7.2 Loading动效

**使用Framer Motion或CSS动画**:

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
  className="flex items-center justify-center space-x-2"
>
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
  />
  <span>Processing video...</span>
</motion.div>
```

**进度条组件**:
```tsx
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span>{getStatusText()}</span>
    <span className="font-medium">{progress}%</span>
  </div>
  <Progress value={progress} className="h-2" />
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>{getStageText()}</span>
    <span>{getEstimatedTimeRemaining()}</span>
  </div>
</div>
```

### 7.3 状态文本

```typescript
const getStatusText = () => {
  if (progress < 20) return 'Parsing video URL...';
  if (progress < 50) return 'Downloading video...';
  if (progress < 70) return 'Extracting subtitles...';
  if (progress < 85) return 'Translating subtitles...';
  if (progress < 95) return 'Generating SRT file...';
  return 'Almost done...';
};

const getEstimatedTimeRemaining = () => {
  const elapsed = Date.now() - startTime;
  const rate = progress / elapsed; // progress per ms
  const remaining = (100 - progress) / rate;
  return `~${Math.ceil(remaining / 1000)}s remaining`;
};
```

---

## 八、CSV导出功能方案

### 8.1 导出数据结构

**CSV格式**:
```csv
Video URL,Platform,Title,Author,Likes,Views,Shares,Duration,Published At,Source Language,Target Language,Subtitle Text,Translated Text,Created At
https://youtube.com/...,youtube,Video Title,Channel Name,1000,50000,200,300,2024-01-01,en,zh-CN,"Subtitle text...","翻译后的文本...",2024-01-15
```

### 8.2 实现方案

#### 方案A: 前端导出（推荐，简单）

**新建组件**: `src/shared/components/export-csv-button.tsx`

```tsx
export function ExportCSVButton({ tasks }: { tasks: MediaTask[] }) {
  const handleExport = () => {
    const csv = convertToCSV(tasks);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `media-tasks-${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}

function convertToCSV(tasks: MediaTask[]): string {
  const headers = [
    'Video URL', 'Platform', 'Title', 'Author', 'Likes', 'Views', 
    'Shares', 'Duration', 'Published At', 'Source Language', 
    'Target Language', 'Subtitle Text', 'Translated Text', 'Created At'
  ];

  const rows = tasks.map(task => [
    task.videoUrl,
    task.platform,
    task.title || '',
    task.author || '',
    task.likes || 0,
    task.views || 0,
    task.shares || 0,
    task.duration || 0,
    task.publishedAt?.toISOString() || '',
    task.sourceLang || '',
    task.targetLang || '',
    task.subtitleText || '',
    task.translatedText || '',
    task.createdAt.toISOString()
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}
```

#### 方案B: 后端API导出

**新建API**: `/api/media/export`

```typescript
export async function GET(request: Request) {
  const user = await getUserInfo();
  if (!user) return respErr('no auth');

  const tasks = await db()
    .select()
    .from(mediaTasks)
    .where(eq(mediaTasks.userId, user.id));

  const csv = convertToCSV(tasks);
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="media-tasks-${Date.now()}.csv"`
    }
  });
}
```

**推荐**: **方案A**（前端导出，简单快速）

### 8.3 导出位置

**在用户设置页面或任务列表页面添加导出按钮**:
```tsx
<div className="flex justify-between items-center">
  <h2>My Media Tasks</h2>
  <ExportCSVButton tasks={userTasks} />
</div>
```

---

## 九、实施优先级建议

### Phase 1: 核心功能（必须）
1. ✅ **UI布局改进** - 3个按钮布局
2. ✅ **视频元数据提取和保存** - 确保title, likes, views, shares正确保存
3. ✅ **两阶段翻译流程** - 第一阶段完成后显示翻译选择

### Phase 2: 存储和翻译（重要）
4. ✅ **视频文案存储** - 添加subtitle_text和translated_text字段
5. ✅ **Gemini 3 Flash集成** - 替换Google翻译
6. ✅ **视频暂存24小时** - 实现预签名URL或生命周期策略

### Phase 3: 用户体验（优化）
7. ✅ **进度条优化** - 更详细的进度显示和预估时间
8. ✅ **Loading动效** - 添加动画效果
9. ✅ **CSV导出功能** - 实现数据导出

### Phase 4: 测试和优化（完善）
10. ✅ **错误处理** - 完善错误提示和降级方案
11. ✅ **性能优化** - 优化大文件处理
12. ✅ **文档更新** - 更新用户文档

---

## 十、技术栈建议

### 新增依赖
```json
{
  "@google/generative-ai": "^0.21.0",  // Gemini API
  "papaparse": "^5.4.1",  // CSV处理（可选）
  "framer-motion": "^11.0.0"  // 动画效果（可选）
}
```

### 环境变量
```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
```

---

## 十一、风险评估

### 风险1: Gemini API限制
- **风险**: API调用频率限制或成本超支
- **缓解**: 实现请求重试和降级到Google翻译API

### 风险2: 视频存储成本
- **风险**: 24小时暂存可能产生大量存储费用
- **缓解**: 使用生命周期策略自动清理，监控存储使用量

### 风险3: 大文件处理性能
- **风险**: 长视频处理可能超时
- **缓解**: 实现分块处理，增加超时时间，使用后台任务队列

---

## 十二、总结

### 关键修改点

1. **数据库**:
   - 添加 `subtitle_text` 和 `translated_text` 字段
   - 添加 `video_expires_at` 字段（可选）

2. **后端**:
   - 实现视频元数据提取逻辑
   - 集成Gemini 3 Flash翻译服务
   - 实现视频暂存和预签名URL生成

3. **前端**:
   - 重新设计UI布局（3个按钮）
   - 实现两阶段翻译流程UI
   - 优化进度条和Loading动效
   - 添加CSV导出功能

4. **配置**:
   - 添加Gemini API密钥配置
   - 配置存储服务生命周期策略

### 预计工作量

- **Phase 1**: 3-5天
- **Phase 2**: 5-7天
- **Phase 3**: 3-5天
- **Phase 4**: 2-3天

**总计**: 约13-20个工作日

---

## 附录：参考资源

- [Gemini API文档](https://ai.google.dev/docs)
- [Neon数据库文档](https://neon.tech/docs)
- [R2生命周期策略](https://developers.cloudflare.com/r2/buckets/lifecycle/)
- [SRT文件格式](https://en.wikipedia.org/wiki/SubRip)


