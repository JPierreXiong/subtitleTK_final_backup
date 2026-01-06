-- ============================================
-- 自动重置序列 SQL 脚本
-- ============================================
-- 用途：在数据迁移后，重置所有序列计数器，避免插入新数据时出现主键冲突
-- 使用方法：在 Supabase SQL Editor 中粘贴并运行此脚本
-- ============================================

DO $$

DECLARE
    row RECORD;
    max_id BIGINT;
    seq_name TEXT;
BEGIN
    -- 遍历所有具有自增序列的列
    FOR row IN 
        SELECT 
            table_schema, 
            table_name, 
            column_name, 
            pg_get_serial_sequence(table_schema || '.' || table_name, column_name) as full_seq_name
        FROM 
            information_schema.columns 
        WHERE 
            table_schema = 'public' 
            AND pg_get_serial_sequence(table_schema || '.' || table_name, column_name) IS NOT NULL
    LOOP
        seq_name := row.full_seq_name;
        
        -- 动态获取该表该列的最大值
        EXECUTE format('SELECT MAX(%I) FROM %I.%I', row.column_name, row.table_schema, row.table_name) 
        INTO max_id;
        
        -- 如果表中有数据，则重置序列起始值为 max_id + 1
        IF max_id IS NOT NULL THEN
            EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
            RAISE NOTICE '已重置序列: % 为 %', seq_name, max_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE '序列重置完成！';
END $$;

-- ============================================
-- 验证脚本：检查序列状态
-- ============================================
-- 运行以下查询可以查看所有序列的当前值
/*
SELECT 
    schemaname,
    sequencename,
    last_value,
    is_called
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
*/



