-- ============================================
-- 检查 media_tasks 表结构
-- ============================================
-- 
-- 用途：验证 media_tasks 表的所有字段是否完整
-- 执行方式：在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 检查所有字段
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'media_tasks'
ORDER BY ordinal_position;

-- 检查关键字段是否存在
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'subtitle_rewritten'
        ) THEN '✅ subtitle_rewritten 字段存在'
        ELSE '❌ subtitle_rewritten 字段缺失'
    END AS subtitle_rewritten_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'subtitle_raw'
        ) THEN '✅ subtitle_raw 字段存在'
        ELSE '❌ subtitle_raw 字段缺失'
    END AS subtitle_raw_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'subtitle_translated'
        ) THEN '✅ subtitle_translated 字段存在'
        ELSE '❌ subtitle_translated 字段缺失'
    END AS subtitle_translated_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'video_url_internal'
        ) THEN '✅ video_url_internal 字段存在'
        ELSE '❌ video_url_internal 字段缺失'
    END AS video_url_internal_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'media_tasks' AND column_name = 'output_type'
        ) THEN '✅ output_type 字段存在'
        ELSE '❌ output_type 字段缺失'
    END AS output_type_status;
