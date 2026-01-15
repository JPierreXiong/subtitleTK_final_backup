# 多语言支持检查报告

## 🔍 检查范围

检查所有用户可见的页面和组件，确保支持多语言（中文、英文、法文）。

---

## ❌ 发现的问题

### 1. **Admin Testimonials 页面** - 硬编码英文

**文件**：`src/app/[locale]/(admin)/admin/testimonials/page.tsx`

**问题**：
- 使用硬编码的英文对象 `const t = { ... }`，没有使用 `getTranslations`
- 注释说明："For now using hardcoded English labels"

**影响**：管理员页面只显示英文，不支持中文和法文

---

### 2. **AI Media Extractor 页面** - CTA 硬编码英文

**文件**：`src/app/[locale]/(landing)/(ai)/ai-media-extractor/page.tsx`

**问题**：
- 第28-33行：CTA 文本硬编码为英文
  - `'Try it free，Analyze Your First YouTube and tiktok Video Now'`
  - `'analyze your first Video Now'`

**影响**：CTA 按钮在所有语言下都显示英文

---

### 3. **Media Extractor 组件** - 硬编码中文

**文件**：`src/shared/blocks/generator/media.tsx`

**问题**：
- 第869行：` (需要 ${requiredCredits} 积分，当前 ${userCredits} 积分)`
- 第914行：` (需要 ${requiredCredits} 积分，当前 ${userCredits} 积分)`
- 第1791行：`'Unknown error'`（英文，但应该翻译）

**影响**：错误消息在非中文环境下显示中文，或显示未翻译的英文

---

### 4. **其他潜在问题**

需要检查以下文件是否有多语言支持：
- `src/shared/hooks/use-ai-rewrite.ts` - Toast 消息
- `src/shared/services/media/gemini-translator.ts` - 错误消息
- 其他组件中的硬编码文本

---

## ✅ 修复方案

### Phase 1: 修复硬编码文本（高优先级）

#### 1.1 修复 Admin Testimonials 页面

**步骤**：
1. 创建翻译文件：`src/config/locale/messages/{lang}/admin/testimonials.json`
2. 使用 `getTranslations('admin.testimonials')` 替换硬编码对象

**翻译键值**：
```json
{
  "list": {
    "title": "Testimonials",
    "crumbs": {
      "admin": "Admin",
      "testimonials": "Testimonials"
    },
    "buttons": {
      "add": "Add Testimonial",
      "edit": "Edit",
      "approve": "Approve",
      "reject": "Reject",
      "delete": "Delete"
    },
    "tabs": {
      "all": "All",
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected"
    }
  },
  "fields": {
    "name": "Name",
    "role": "Role",
    "quote": "Quote",
    "language": "Language",
    "status": "Status",
    "rating": "Rating",
    "created_at": "Created At",
    "actions": "Actions"
  }
}
```

#### 1.2 修复 AI Media Extractor CTA

**步骤**：
1. 在 `src/config/locale/messages/{lang}/ai/media.json` 添加 CTA 翻译
2. 使用 `tt('page.cta.title')` 等替换硬编码文本

**翻译键值**：
```json
{
  "page": {
    "cta": {
      "title": "Try it free，Analyze Your First YouTube and tiktok Video Now",
      "button": "analyze your first Video Now",
      "tip": "No credit card required"
    }
  }
}
```

#### 1.3 修复 Media Extractor 组件

**步骤**：
1. 在 `src/config/locale/messages/{lang}/ai/media.json` 添加错误消息翻译
2. 使用 `t('extractor.credits_info', { required, current })` 替换硬编码文本

**翻译键值**：
```json
{
  "extractor": {
    "credits_info": "需要 {required} 积分，当前 {current} 积分",
    "unknown_error": "未知错误"
  }
}
```

---

### Phase 2: 全面检查（中优先级）

#### 2.1 检查所有 Toast 消息

检查以下文件中的 Toast 消息是否使用翻译：
- `src/shared/hooks/use-ai-rewrite.ts`
- `src/shared/blocks/generator/media.tsx`
- 其他组件

#### 2.2 检查错误消息

检查所有错误消息是否使用翻译：
- API 路由中的错误消息
- 组件中的错误提示

---

## 📋 实施清单

### 立即修复（必须）

- [ ] 修复 Admin Testimonials 页面多语言支持
- [ ] 修复 AI Media Extractor CTA 多语言支持
- [ ] 修复 Media Extractor 组件中的硬编码中文/英文

### 后续优化（建议）

- [ ] 检查所有 Toast 消息
- [ ] 检查所有错误消息
- [ ] 创建多语言检查脚本（自动化检测硬编码文本）

---

## 🚀 开始修复

**请确认是否开始修复这些问题？**

我将按照以下顺序修复：
1. Admin Testimonials 页面
2. AI Media Extractor CTA
3. Media Extractor 组件硬编码文本

每个修复都会：
- ✅ 添加翻译文件（中文、英文、法文）
- ✅ 更新代码使用翻译
- ✅ 保持 ShipAny 结构不变
