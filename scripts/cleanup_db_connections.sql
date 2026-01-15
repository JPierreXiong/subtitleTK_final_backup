-- Cleanup database connections (Supabase Safe Version)
-- NOTE: In Supabase, you can only terminate your own connections
-- You cannot terminate connections from other users or superuser processes

-- 1. View all connections (safe - read only)
SELECT 
    pid,
    usename,
    client_addr,
    state,
    left(query, 100) as query_preview,
    backend_start,
    state_change
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY backend_start DESC;

-- 2. View only YOUR connections (that you can terminate)
SELECT 
    pid,
    usename,
    client_addr,
    state,
    left(query, 100) as query_preview,
    backend_start,
    state_change,
    now() - state_change as idle_duration
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND usename = current_user  -- Only your own connections
ORDER BY state_change ASC;

-- 3. Terminate only YOUR idle connections (SAFE - only your own)
-- This will only work for connections created by your user
-- Uncomment to execute:
/*
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() 
  AND pid <> pg_backend_pid()
  AND usename = current_user  -- Only your own connections
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes';
*/

-- 4. Alternative: Wait for connections to timeout naturally
-- Check idle timeout setting:
SHOW idle_in_transaction_session_timeout;

-- 5. View connection count by user (to identify which user has many connections)
SELECT 
    usename,
    count(*) as connection_count,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY usename
ORDER BY connection_count DESC;
