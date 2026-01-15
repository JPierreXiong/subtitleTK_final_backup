# AI 爆款改写功能实现方案

## 📋 概述

基于现有 ShipAny 架构，实现 **AI 爆款改写**功能，使用 Gemini 1.5 Flash 进行流式输出，提供实时打字机效果。

---

## 🎯 核心功能

### 1. **改写模式（Rewrite）**
- 输入：原始字幕文案（SRT 格式或纯文本）
- 输出：改写后的爆款脚本（保留核心逻辑，优化语气和结构）
- 支持平台风格：TikTok、YouTube Shorts、小红书

### 2. **翻译模式（Translation）**
- 复用现有翻译功能，但增加流式输出支持

---

## 🏗️ 架构设计

### 1. 后端 API：`/api/media/rewrite`

**位置**：`src/app/api/media/rewrite/route.ts`

**功能**：
- 接收任务 ID、改写模式、目标平台/风格
- 从数据库获取原始字幕
- 调用 Gemini API 进行流式改写
- 返回 Server-Sent Events (SSE) 流

**积分消费**：
- 改写：10 积分（VIP 专属或每日限 3 次）
- 复用现有积分检查逻辑

### 2. 前端 Hook：`use-ai-rewrite.ts`

**位置**：`src/shared/hooks/use-ai-rewrite.ts`

**功能**：
- 处理 SSE 流式数据
- 实时更新改写结果
- 管理加载状态和错误处理

### 3. UI 组件增强

**位置**：`src/shared/blocks/generator/media.tsx`

**新增区域**：
- "AI 改写中心"卡片（在下载区域下方）
- 风格选择器（TikTok/YouTube/小红书）
- 实时预览区域（打字机效果）
- 对比模式（原文 vs 改写版）

---

## 📝 技术实现细节

### 1. Gemini Prompt 模板

**改写模式 Prompt**：
```
你是一名拥有千万粉丝的短视频爆款操盘手，精通 TikTok、YouTube Shorts 和小红书的流量底层逻辑。

任务：将以下视频文案通过"爆款公式"重构成极具吸引力的短视频脚本。

规则：
1. **Hook（黄金钩子）**：前 3 秒必须极其吸睛，使用"反直觉"、"结果先行"或"制造紧迫感"策略
2. **结构重组**：按照 [黄金 3 秒 Hook + 价值/反转内容 + 强力行动呼吁 CTA] 重新编写
3. **语言风格化**：使用地道的网络口语，增加情绪词，适配 {{target_platform}} 的语境
4. **节奏感**：短句为主，每句不超过 15 个字
5. **转场提示**：在脚本中注明逻辑转场点（例如：[画面切入]、[语气增强]）

原始文案：
{{original_text}}

请直接输出改写后的脚本，不要包含任何解释或说明。
```

**翻译模式 Prompt**（复用现有）：
- 使用 `GeminiTranslator.buildTranslationPrompt()`

### 2. 流式输出实现

**后端**：使用 Gemini API 的 `generateContentStream`
**前端**：使用 `ReadableStream` 和 `TextDecoder` 处理 SSE

### 3. 数据库扩展（可选）

如果需要保存改写结果：
- 在 `media_tasks` 表添加 `subtitleRewritten` 字段（text）
- 或创建新表 `media_rewrites` 存储多次改写版本

---

## 💰 积分策略

### 免费用户
- 每日限 3 次改写
- 每次消耗 10 积分

### VIP 用户
- 无限次改写
- 每次消耗 10 积分（或更低）

### 积分检查
- 复用 `checkTranslationLimit` 逻辑
- 在 API 路由中检查积分和限制

---

## 🎨 UI/UX 设计

### 1. 改写按钮位置
- 在"下载区域"下方新增"AI 改写中心"卡片
- 仅在 `status === 'extracted' || status === 'completed'` 时显示

### 2. 风格选择器
```
[TikTok 爆款] [YouTube Shorts] [小红书风格] [专业干货] [搞笑幽默]
```

### 3. 实时预览
- 左侧：原始文案（只读）
- 右侧：AI 改写结果（流式显示，打字机效果）
- 底部：操作按钮（复制、下载、替换）

### 4. 对比模式
- 支持并排对比
- 支持切换显示（原文/改写版）

---

## 🔍 SEO 优化建议

### 1. Meta Tags（多语言）
- 中文：`AI 短视频脚本改写助手 - 一键生成 TikTok/YouTube 爆款文案`
- 英文：`AI TikTok Script Rewriter - Transform Videos into Viral Shorts`
- 法文：`Assistant de Réécriture de Script AI - Boostez vos Vidéos TikTok & YouTube`

### 2. 内容中心页面
- 创建 `/ai-rewrite` 页面
- 展示改写示例和教程
- 自动生成改写案例页面（用户选择公开时）

### 3. 长尾词覆盖
- `TikTok Script Template`
- `短视频脚本公式`
- `AI 脚本改写工具`

---

## 📦 文件清单

### 新增文件
1. `src/app/api/media/rewrite/route.ts` - 改写 API 路由
2. `src/shared/hooks/use-ai-rewrite.ts` - 改写 Hook
3. `src/shared/services/media/gemini-rewriter.ts` - Gemini 改写服务（扩展现有 translator）

### 修改文件
1. `src/shared/blocks/generator/media.tsx` - 添加改写 UI
2. `src/shared/services/media/gemini-translator.ts` - 添加流式输出支持
3. `src/config/db/schema.ts` - 可选：添加 `subtitleRewritten` 字段

---

## ✅ 实施步骤

### Phase 1: 后端基础（1-2 天）
1. 创建 `/api/media/rewrite` 路由
2. 扩展 `GeminiTranslator` 支持流式输出
3. 实现改写 Prompt 模板

### Phase 2: 前端集成（1-2 天）
1. 创建 `use-ai-rewrite` Hook
2. 在 `media.tsx` 添加改写 UI
3. 实现打字机效果

### Phase 3: 优化与测试（1 天）
1. 积分限制和错误处理
2. SEO Meta Tags
3. 用户体验优化

---

## 🚨 注意事项

1. **不改变 ShipAny 结构**：所有新增功能都在现有架构基础上扩展
2. **复用现有服务**：尽量复用 `GeminiTranslator` 和积分系统
3. **流式输出性能**：注意 Gemini API 的速率限制
4. **成本控制**：改写比翻译消耗更多 Token，需要合理定价

---

## 📊 预期效果

1. **用户体验**：实时看到 AI 改写过程，提升科技感
2. **商业价值**：VIP 专属功能，提升付费转化
3. **SEO 价值**：增加页面停留时长，提升搜索排名
4. **内容质量**：专业 Prompt 确保改写质量

---

## 🎯 下一步

**请确认以下事项：**
1. ✅ 是否批准此方案？
2. ✅ 积分定价：改写 10 积分是否合适？
3. ✅ 是否需要保存改写结果到数据库？
4. ✅ 风格选择器需要哪些预设选项？

**批准后，我将开始实施 Phase 1（后端基础）。**
