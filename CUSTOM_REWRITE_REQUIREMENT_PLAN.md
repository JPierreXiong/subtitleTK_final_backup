# 用户自定义需求改写功能实施方案

## 📋 概述

在现有 AI 改写功能基础上，增加**用户自定义需求输入**功能，允许用户通过文本输入框指定特定的改写要求，实现"预设风格 + 用户定制"的双重改写模式。

---

## 🎯 核心功能需求

### 1. **用户输入自定义需求**
- 用户在风格选择器下方输入自定义改写要求
- 支持快捷需求标签（一键填充）
- 自定义需求与预设风格结合使用

### 2. **后端 Prompt 增强**
- 将用户需求整合到 Gemini Prompt 中
- 用户需求优先级高于预设风格
- 保持流式输出支持

### 3. **UI/UX 优化**
- 未来感输入框设计（紫色呼吸灯效果）
- 快捷需求标签
- 状态联动（有输入时按钮文字变化）

---

## 🏗️ 技术架构

### 一、前端改动

#### 1. **AIRewriteCenter 组件增强** (`src/shared/blocks/generator/media.tsx`)

**新增状态：**
```typescript
const [userRequirement, setUserRequirement] = useState<string>('');
```

**新增 UI 区域（在风格选择器下方）：**
- 自定义需求输入框（Textarea）
- 快捷需求标签（4-6 个常用需求）
- 状态指示器（输入状态、字数统计）

**按钮文字联动：**
```typescript
{userRequirement.trim() 
  ? '按要求改写' 
  : '开始改写'}
```

#### 2. **useAIRewrite Hook 增强** (`src/shared/hooks/use-ai-rewrite.ts`)

**修改 `generateRewrite` 方法签名：**
```typescript
generateRewrite: (
  taskId: string, 
  style: RewriteStyle,
  userRequirement?: string  // 新增参数
) => Promise<void>;
```

**修改 API 请求：**
```typescript
body: JSON.stringify({ 
  taskId, 
  style,
  userRequirement: userRequirement?.trim() || undefined
}),
```

---

### 二、后端改动

#### 1. **API 路由增强** (`src/app/api/media/rewrite/route.ts`)

**接收新参数：**
```typescript
const { taskId, style, userRequirement } = await request.json();
```

**传递到 Gemini 服务：**
```typescript
const rewriteStream = rewriteContentWithGeminiStream(
  task.subtitleRaw!,
  style,
  userRequirement  // 新增参数
);
```

#### 2. **GeminiTranslator 类增强** (`src/shared/services/media/gemini-translator.ts`)

**需要实现的方法（如果不存在）：**
- `rewriteContentStream(text: string, style: string, userRequirement?: string)`
- `extractPlainTextFromSRT(srt: string): string`
- `buildRewritePrompt(text: string, style: string, userRequirement?: string): string`

**Prompt 构建逻辑：**
```typescript
private buildRewritePrompt(
  text: string, 
  style: string, 
  userRequirement?: string
): string {
  const styleConfigs: Record<string, string> = {
    tiktok: "TikTok 爆款模式：前3秒黄金钩子，强节奏感，高频情绪词。",
    youtube: "YouTube 深度模式：结构化内容，长线逻辑，干货密度大。",
    redbook: "小红书种草模式：语气亲切，多使用 Emoji，引导收藏点赞。",
    emotional: "情感共鸣模式：慢节奏、金句频出，适合情感类账号。",
    script: "专业分镜模式：带场景建议（视觉+听觉）的专业分镜脚本。"
  };

  const baseInstructions = styleConfigs[style] || styleConfigs.tiktok;
  
  // 核心：用户需求优先级最高
  const customSection = userRequirement?.trim()
    ? `【用户特定要求】（优先级最高）：请务必满足以下要求：${userRequirement.trim()}`
    : "请按照预设风格进行自由发挥。";

  return `你是一个顶级的短视频文案专家。
你的任务是重写下方的原始文案。

【核心指导准则】：
1. ${baseInstructions}
2. 严禁使用 AI 常用口癖（如"总而言之"、"首先其次"），多使用反问句和非正式的口语表达，确保文案看起来像是真人创作。
3. ${customSection}

【原始文案】：
"""
${text}
"""

直接输出改写后的最终脚本，保持结构清晰。不要输出任何解释性文字。`;
}
```

---

## 📝 完整业务流程

### 流程 1：仅使用预设风格（现有功能）
1. 用户选择风格（如 "TikTok 爆款"）
2. 不输入自定义需求
3. 点击"开始改写"
4. 后端使用预设风格 Prompt
5. 流式返回改写结果

### 流程 2：预设风格 + 自定义需求（新功能）
1. 用户选择风格（如 "TikTok 爆款"）
2. **输入自定义需求**（如 "请把结尾改成引导用户去主页领取免费资料"）
3. 点击"按要求改写"（按钮文字已变化）
4. 后端将用户需求整合到 Prompt 中（优先级最高）
5. 流式返回定制改写结果

### 流程 3：仅使用自定义需求（高级用法）
1. 用户选择任意风格（作为基础）
2. **输入详细的自定义需求**（如 "改成脱口秀风格，加入更多吐槽，针对 20 岁左右的年轻人"）
3. 点击"按要求改写"
4. 后端优先执行用户需求，风格作为辅助参考

---

## 🎨 UI 设计细节

### 1. 自定义需求输入框

**位置：** 风格选择器下方，内容预览区域上方

**样式：**
- 半透明背景（`bg-black/60 backdrop-blur-xl`）
- 紫色渐变边框（呼吸灯效果）
- 占位符提示："输入你的特定改写要求，Gemini 将为您深度定制..."
- 最小高度：100px
- 右下角：字数统计 + 重置按钮（有内容时显示）

### 2. 快捷需求标签

**位置：** 输入框下方

**标签示例：**
- "更幽默点"
- "缩短篇幅"
- "增加专业感"
- "翻译成法文"
- "加入更多 Emoji"
- "改成疑问句风格"

**交互：**
- 点击标签 → 自动填充到输入框
- 标签样式：小气泡，hover 时高亮

### 3. 状态联动

**按钮文字：**
- 无输入：`开始改写`（默认）
- 有输入：`按要求改写`（强调定制化）

**输入框状态：**
- 空：显示占位符
- 有内容：显示字数统计 + 重置按钮
- 焦点：边框呼吸灯动画

---

## 🔧 实现步骤

### Phase 1: 后端 Prompt 增强
1. ✅ 检查 `GeminiTranslator` 类是否有 `rewriteContentStream` 方法
2. ✅ 如果没有，实现该方法（包括 `extractPlainTextFromSRT` 和 `buildRewritePrompt`）
3. ✅ 修改 `buildRewritePrompt` 支持 `userRequirement` 参数
4. ✅ 修改 `rewriteContentWithGeminiStream` 导出函数

### Phase 2: API 路由增强
1. ✅ 修改 `/api/media/rewrite/route.ts` 接收 `userRequirement`
2. ✅ 传递 `userRequirement` 到 Gemini 服务
3. ✅ 更新错误处理和日志

### Phase 3: 前端 Hook 增强
1. ✅ 修改 `useAIRewrite` Hook 支持 `userRequirement` 参数
2. ✅ 更新 API 请求 body

### Phase 4: UI 组件增强
1. ✅ 在 `AIRewriteCenter` 中添加输入框状态
2. ✅ 实现自定义需求输入框 UI
3. ✅ 实现快捷需求标签
4. ✅ 实现按钮文字联动
5. ✅ 实现状态指示器

---

## 🧪 测试场景

### 测试 1：仅预设风格
- 选择 "TikTok 爆款"
- 不输入自定义需求
- 验证：使用预设 Prompt

### 测试 2：预设 + 自定义
- 选择 "TikTok 爆款"
- 输入："请把结尾改成引导用户去主页"
- 验证：Prompt 包含用户需求，优先级最高

### 测试 3：仅自定义需求
- 选择任意风格
- 输入详细需求："改成脱口秀风格，加入更多吐槽"
- 验证：用户需求主导，风格作为辅助

### 测试 4：快捷标签
- 点击 "更幽默点" 标签
- 验证：输入框自动填充
- 点击改写
- 验证：结果更幽默

---

## 💰 积分策略（保持不变）

- 改写功能：10 积分/次
- 无论是否使用自定义需求，积分消耗相同
- 免费用户：每日限 3 次
- VIP 用户：无限次

---

## 🚀 SEO 优化建议

### 1. 关键词优化
- 页面标题：`AI 自定义文案改写工具 - 按需定制 TikTok/YouTube 爆款脚本`
- Meta 描述：强调"自定义"和"按需定制"

### 2. 用户意图分析
- 记录用户最常输入的自定义需求
- 基于数据优化快捷标签
- 发现新需求时，可考虑新增预设风格

### 3. 内容营销
- 创建"热门自定义改写案例"页面
- Before & After 对比展示
- 提升原创内容质量

---

## ⚠️ 注意事项

1. **不改变 ShipAny 结构**：所有改动都在现有架构内
2. **向后兼容**：`userRequirement` 为可选参数，不影响现有功能
3. **输入验证**：限制输入长度（建议 500 字符以内）
4. **错误处理**：用户需求为空或无效时，降级为仅使用预设风格
5. **性能考虑**：自定义需求会增加 Prompt 长度，注意 Token 消耗

---

## 📊 预期效果

1. **用户体验提升**：从"被动接受"到"主动定制"
2. **产品差异化**：相比其他 AI 改写工具，提供更灵活的定制能力
3. **用户留存**：定制化功能提升用户粘性
4. **付费转化**：VIP 专属功能，提升付费意愿

---

## ✅ 批准检查清单

- [ ] 方案符合 ShipAny 架构要求
- [ ] 技术实现路径清晰
- [ ] UI/UX 设计合理
- [ ] 向后兼容性确认
- [ ] 测试场景完整
- [ ] 性能影响评估

---

**等待批准后开始实施**
