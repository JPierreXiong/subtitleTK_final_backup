-- Supabase Safe Connection Cleanup
-- This script only terminates YOUR OWN connections
-- It will NOT attempt to terminate other users' connections (which would fail with permission error)

-- Step 1: View your current connections
SELECT 
    pid,
    state,
    left(query, 80) as query_preview,
    backend_start,
    state_change,
    now() - state_change as idle_duration
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND usename = current_user  -- Only show YOUR connections
ORDER BY state_change ASC;

-- Step 2: Count your connections by state
SELECT 
    state,
    count(*) as count,
    min(state_change) as oldest_idle_time
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND usename = current_user
GROUP BY state;

-- Step 3: Terminate YOUR idle connections (only if needed)
-- Uncomment the SELECT statement below to execute:
/*
SELECT 
    pid,
    pg_terminate_backend(pid) as terminated,
    state,
    now() - state_change as was_idle_for
FROM pg_stat_activity 
WHERE datname = current_database() 
  AND pid <> pg_backend_pid()
  AND usename = current_user  -- CRITICAL: Only your own connections
  AND state = 'idle'
  AND state_change < now() - interval '2 minutes';  -- Idle for more than 2 minutes
*/

-- Step 4: View all connections (read-only, for monitoring)
-- This helps you see the overall connection situation
SELECT 
    usename,
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
GROUP BY usename
ORDER BY total_connections DESC;
