# 数据库迁移修复指南

## 🚨 问题描述

错误信息显示查询时包含了 `subtitle_rewritten` 字段，但数据库表中还没有这个字段，导致查询失败。

## ✅ 解决方案（两种方式）

### 方案 1：使用 SQL 脚本（推荐，最快）

**步骤：**

1. 打开 Supabase Dashboard → SQL Editor
2. 复制并执行以下 SQL：

```sql
-- 添加 subtitle_rewritten 字段
ALTER TABLE "media_tasks" 
ADD COLUMN IF NOT EXISTS "subtitle_rewritten" TEXT;

-- 验证字段是否添加成功
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'subtitle_rewritten'
        ) THEN '✅ 字段已添加'
        ELSE '❌ 字段添加失败'
    END AS status;
```

3. 或者直接运行脚本文件：`scripts/add_subtitle_rewritten_field.sql`

---

### 方案 2：使用 Drizzle Kit（如果使用迁移工具）

**步骤：**

```bash
# 1. 生成迁移文件
pnpm db:generate

# 2. 推送更改到数据库（开发环境推荐）
pnpm db:push

# 或者使用迁移方式（生产环境推荐）
pnpm db:migrate
```

---

## 🔍 验证步骤

执行完 SQL 后，运行验证脚本：

```sql
-- 在 Supabase SQL Editor 中运行
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'media_tasks' 
AND column_name = 'subtitle_rewritten';
```

如果返回结果，说明字段已成功添加。

---

## 📋 完整字段检查

如果需要检查所有相关字段，运行：

```sql
-- 检查所有关键字段
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_tasks' AND column_name = 'subtitle_rewritten') THEN '✅' ELSE '❌' END AS subtitle_rewritten,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_tasks' AND column_name = 'subtitle_raw') THEN '✅' ELSE '❌' END AS subtitle_raw,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_tasks' AND column_name = 'subtitle_translated') THEN '✅' ELSE '❌' END AS subtitle_translated,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_tasks' AND column_name = 'video_url_internal') THEN '✅' ELSE '❌' END AS video_url_internal,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_tasks' AND column_name = 'output_type') THEN '✅' ELSE '❌' END AS output_type;
```

或者直接运行：`scripts/check_media_tasks_schema.sql`

---

## ⚠️ 注意事项

1. **IF NOT EXISTS**：SQL 脚本使用了 `IF NOT EXISTS`，可以安全地重复执行
2. **数据安全**：此操作只添加字段，不会删除或修改现有数据
3. **立即生效**：执行后立即生效，无需重启应用

---

## 🎯 修复后的验证

1. 刷新应用页面
2. 之前的失败任务应该恢复正常显示
3. 尝试进行一次 AI 改写
4. 检查数据库中 `subtitle_rewritten` 是否成功存入内容
