# 数据库 Schema 同步修复指南

## 🔴 问题诊断

你遇到的错误：
```
Failed query: select "id", "user_id", "name", "email", "role", "quote", "avatar_url", "language", "status", "rating", "source", "sort", "approved_at", "approved_by", "created_at", "updated_at", "deleted_at" from "testimonial" where ...
```

**根本原因**：数据库表结构与代码 Schema 定义不同步，导致查询失败，进而引发全站 500 错误（包括 Auth API）。

---

## ✅ 解决方案（两种方式）

### 方式 1：使用 Drizzle Kit（推荐）

这是最安全和自动化的方式：

```bash
# 1. 生成迁移文件（基于 schema.ts）
npx drizzle-kit generate

# 2. 应用迁移到数据库
npx drizzle-kit push
```

**优点**：
- 自动检测差异
- 生成安全的迁移脚本
- 支持回滚

---

### 方式 2：手动执行 SQL（快速修复）

如果你需要立即修复，可以直接执行 SQL：

```bash
# 连接到你的数据库（Supabase/Neon/PostgreSQL）
# 然后执行：

psql $DATABASE_URL -f scripts/fix_testimonial_table.sql

# 或者在 Supabase Dashboard 的 SQL Editor 中粘贴执行
```

**SQL 脚本位置**：`scripts/fix_testimonial_table.sql`

---

## 🔍 验证修复

执行以下 SQL 检查表结构：

```sql
-- 检查所有字段是否存在
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'testimonial'
ORDER BY ordinal_position;
```

**预期结果**：应该看到以下字段：
- ✅ `id`, `user_id`, `name`, `email`, `role`
- ✅ `quote`, `avatar_url`, `language`, `status`
- ✅ `rating`, `source`, `sort`
- ✅ `approved_at`, `approved_by`
- ✅ `created_at`, `updated_at`, `deleted_at`

---

## 📋 同时需要检查的其他表

### 1. `media_tasks` 表

确保 `subtitle_rewritten` 字段存在：

```sql
ALTER TABLE "media_tasks" ADD COLUMN IF NOT EXISTS "subtitle_rewritten" TEXT;
```

**SQL 脚本**：`scripts/add_subtitle_rewritten_field.sql`

---

## 🚀 修复后的验证步骤

1. **执行数据库修复**（选择上述方式之一）
2. **重启开发服务器**：
   ```bash
   # 停止当前服务器 (Ctrl+C)
   pnpm dev
   ```
3. **测试 Auth API**：
   - 访问 `http://localhost:3000/api/auth/get-session`
   - 应该返回 JSON（而不是 500 错误）
4. **测试页面加载**：
   - 访问首页，应该不再出现 500 错误
   - Testimonials 应该正常显示

---

## ⚠️ 为什么会出现这个问题？

1. **Schema 更新但迁移未执行**：代码中的 `schema.ts` 定义了新字段，但数据库没有同步
2. **手动修改数据库**：可能之前手动删除了某些字段
3. **多环境不同步**：开发环境和生产环境的数据库结构不一致

---

## 📝 预防措施

**建议工作流**：
1. 修改 `src/config/db/schema.ts`
2. 运行 `npx drizzle-kit generate` 生成迁移
3. 运行 `npx drizzle-kit push` 应用迁移
4. 提交迁移文件到 Git

---

## 🆘 如果问题仍然存在

如果修复后仍有错误，请提供：
1. 具体的错误消息（完整的 SQL 错误）
2. 执行 `scripts/check_testimonial_schema.sql` 的结果
3. 数据库类型（Supabase/Neon/本地 PostgreSQL）

---

**修复完成后，Auth API 和全站功能应该恢复正常！** 🎉
