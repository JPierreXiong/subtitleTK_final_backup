# RapidAPIService 实施计划

## 📋 文件结构规划

基于ShipAny的代码结构，建议创建以下文件：

### 1. 扩展层（Provider实现）
- `src/extensions/media/rapidapi.ts` - RapidAPI Provider实现
- `src/extensions/media/subtitle-formatter.ts` - 字幕格式转换工具

### 2. 服务层（Manager）
- `src/shared/services/media/rapidapi.ts` - RapidAPI服务管理器（可选，如果需要）

### 3. 类型定义
- 在 `src/extensions/media/rapidapi.ts` 中定义接口和类型

---

## 🏗️ 类结构设计

### 核心接口

```typescript
// 标准化媒体元数据输出
export interface NormalizedMediaData {
  platform: 'youtube' | 'tiktok';
  title: string;
  author?: string;
  likes: number;
  views: number;
  shares: number;
  duration?: number;
  publishedAt?: Date;
  thumbnailUrl?: string;
  videoUrl?: string;        // 原始视频下载地址（用于R2上传）
  subtitleRaw?: string;     // 格式化后的SRT字符串
  sourceLang?: string;      // 检测到的源语言
}

// RapidAPI配置
export interface RapidAPIConfigs {
  apiKey: string;
  hostTikTokDownload?: string;
  hostTikTokTranscript?: string;
  hostYouTubeTranscript?: string;
}
```

### 类结构

```typescript
// 1. RapidAPI Provider（核心类）
export class RapidAPIProvider {
  private configs: RapidAPIConfigs;
  
  constructor(configs: RapidAPIConfigs) {
    this.configs = configs;
  }
  
  // 主入口：根据URL自动识别平台并提取数据
  async fetchMedia(url: string): Promise<NormalizedMediaData>
  
  // TikTok处理
  private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData>
  
  // YouTube处理
  private async fetchYouTubeMedia(url: string): Promise<NormalizedMediaData>
  
  // 元数据归一化
  private normalizeMetadata(raw: any, platform: 'youtube' | 'tiktok'): Partial<NormalizedMediaData>
  
  // 字幕归一化
  private normalizeSubtitles(raw: any, platform: 'youtube' | 'tiktok'): string | null
}

// 2. 字幕格式转换器（工具类）
export class SubtitleFormatter {
  // JSON数组转SRT
  static jsonToSRT(data: Array<{start: number, duration: number, text: string}>): string
  
  // VTT转SRT
  static vttToSRT(vttContent: string): string
  
  // 时间戳格式化（秒转SRT格式）
  static formatTimestamp(seconds: number): string
}
```

---

## 🔧 实施步骤

### Step 1: 创建字幕格式转换工具
先实现 `SubtitleFormatter`，这是基础工具。

### Step 2: 创建RapidAPI Provider
实现核心的 `RapidAPIProvider` 类。

### Step 3: 创建服务入口
在 `src/shared/services/media/` 下创建服务入口函数。

---

## ⚠️ 注意事项

1. **遵循ShipAny模式**: 使用Provider模式，不破坏现有结构
2. **错误处理**: 字幕提取失败不应导致整个任务失败
3. **超时设置**: API调用设置合理的超时时间（3分钟）
4. **并发优化**: 元数据和字幕可以并行获取

---

**准备开始实施，请确认文件结构是否符合ShipAny规范？**


