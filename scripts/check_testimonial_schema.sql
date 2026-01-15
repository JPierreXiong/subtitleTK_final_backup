-- Check testimonial table schema
-- This script verifies that all required fields exist

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'testimonial'
ORDER BY ordinal_position;

-- Check if indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'testimonial';
