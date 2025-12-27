# Creem 合规性检测报告与修改方案

## 📋 检测结果摘要

### ✅ 已符合要求的部分
1. **法律页面链接**：Privacy Policy、Terms of Service、Disclaimer 都已正确配置
2. **支持邮箱**：`support@subtitletk.app` 已正确配置
3. **版权声明**：已包含品牌独立性声明
4. **Testimonials**：已在 pricing 页面隐藏

### ❌ 需要修复的问题

#### 1. 虚假社交链接 (False Socials) - **严重问题**

**问题位置：**
- `src/config/locale/messages/en/landing.json` (第 474-500 行)
- `src/config/locale/messages/zh/landing.json` (第 468-494 行)
- `src/config/locale/messages/fr/landing.json` (第 468-494 行)

**当前配置（❌ 虚假链接）：**
```json
"social": {
  "items": [
    {
      "title": "X",
      "icon": "RiTwitterXFill",
      "url": "https://x.com/your-app-name",  // ❌ 占位符链接
      "target": "_blank"
    },
    {
      "title": "Github",
      "icon": "Github",
      "url": "https://github.com/your-app-name",  // ❌ 占位符链接
      "target": "_blank"
    },
    {
      "title": "Discord",
      "icon": "RiDiscordFill",
      "url": "https://discord.gg/your-app-name",  // ❌ 占位符链接
      "target": "_blank"
    },
    {
      "title": "Email",
      "icon": "Mail",
      "url": "mailto:support@subtitletk.app",  // ✅ 真实链接
      "target": "_self"
    }
  ]
}
```

**Creem 审核风险：**
- 审核员会点击这些链接，发现是占位符（`your-app-name`）
- 会被标记为 **"False Socials"**，直接导致拒审
- 即使链接指向真实平台，如果不是您的官方账号，也是虚假信息

#### 2. Hero 部分虚假统计数据 - **已修复**
- `show_avatars: false` 和 `avatars_tip: ""` 已设置，不显示 "999+" 用户数
- ✅ 无需修改

#### 3. Testimonials - **已隐藏**
- Pricing 页面已设置 `testimonials: null`
- ✅ 无需修改

---

## 🔧 修改方案

### 方案 A：完全删除社交链接（推荐）✅

**理由：**
- Creem 宁愿看到没有社交链接，也不愿看到虚假链接
- 符合"少即是多"的合规原则
- 降低审核风险

**修改内容：**
将 `social.items` 数组改为只包含 Email，或完全删除 `social` 对象

### 方案 B：只保留真实链接

**理由：**
- 如果未来需要添加真实社交账号，可以保留 Email
- 但需要确保所有链接都是真实有效的

**修改内容：**
只保留 Email 链接，删除 X、Github、Discord

---

## 📝 详细修改对比

### 修改前（❌ 不符合 Creem 要求）

**文件：** `src/config/locale/messages/en/landing.json`
```json
"social": {
  "items": [
    {
      "title": "X",
      "icon": "RiTwitterXFill",
      "url": "https://x.com/your-app-name",  // ❌ 虚假链接
      "target": "_blank"
    },
    {
      "title": "Github",
      "icon": "Github",
      "url": "https://github.com/your-app-name",  // ❌ 虚假链接
      "target": "_blank"
    },
    {
      "title": "Discord",
      "icon": "RiDiscordFill",
      "url": "https://discord.gg/your-app-name",  // ❌ 虚假链接
      "target": "_blank"
    },
    {
      "title": "Email",
      "icon": "Mail",
      "url": "mailto:support@subtitletk.app",  // ✅ 真实链接
      "target": "_self"
    }
  ]
}
```

### 修改后（✅ 符合 Creem 要求）- 方案 A（推荐）

**文件：** `src/config/locale/messages/en/landing.json`
```json
"social": {
  "items": [
    {
      "title": "Email",
      "icon": "Mail",
      "url": "mailto:support@subtitletk.app",
      "target": "_self"
    }
  ]
}
```

**或者完全删除 social 对象：**
```json
// 删除整个 "social" 字段
```

---

## 🎯 需要修改的文件清单

### 必须修改的文件（3个）：
1. ✅ `src/config/locale/messages/en/landing.json` - 删除虚假社交链接
2. ✅ `src/config/locale/messages/zh/landing.json` - 删除虚假社交链接
3. ✅ `src/config/locale/messages/fr/landing.json` - 删除虚假社交链接

### 不需要修改的文件：
- ✅ `src/themes/default/blocks/footer.tsx` - Footer 组件本身没问题，它只是读取 JSON 配置
- ✅ Hero 部分 - 已正确配置，不显示虚假统计数据
- ✅ Testimonials - 已在 pricing 页面隐藏

---

## 📊 修改影响分析

### 对用户体验的影响：
- **最小影响**：用户仍可通过 Email 联系支持
- **正面影响**：避免用户点击虚假链接产生困惑

### 对 SEO 的影响：
- **正面影响**：删除死链接（Broken Links）提升页面质量
- **无负面影响**：社交链接对 SEO 影响很小

### 对 Creem 审核的影响：
- **显著提升**：消除 "False Socials" 风险
- **提高通过率**：符合 Creem 合规要求

---

## ✅ 修改后的验证清单

修改完成后，请验证：
1. ✅ 页脚不再显示 X、Github、Discord 图标
2. ✅ 页脚仍显示 Email 图标（如果采用方案 B）
3. ✅ 所有法律页面链接（Privacy、Terms、Disclaimer）正常
4. ✅ 支持邮箱 `support@subtitletk.app` 可正常点击
5. ✅ 版权声明正常显示

---

## 🚀 下一步行动

1. **等待确认**：请确认采用方案 A（只保留 Email）还是完全删除 social
2. **执行修改**：确认后，我将修改 3 个语言文件
3. **本地测试**：运行 `pnpm dev` 验证页脚显示
4. **部署验证**：部署后截图页脚，用于 Creem 审核回复

---

## 📧 给 Creem 的回复证据

修改并部署后，可以这样回复 Creem：

> "I have completely removed all placeholder social media links (X/Twitter, GitHub, Discord) from the website footer to ensure 100% compliance. The footer now only contains:
> - Legal documents (Privacy Policy, Terms of Service, Disclaimer)
> - Official support email (support@subtitletk.app)
> - Copyright information
> 
> All false social links have been eliminated to meet your compliance requirements."

---

## ⚠️ 重要提醒

- **不要修改 ShipAny 结构**：只修改 JSON 配置文件，不修改组件代码
- **保持一致性**：三个语言文件（en、zh、fr）需要同步修改
- **测试验证**：修改后务必本地测试，确保页脚正常显示

