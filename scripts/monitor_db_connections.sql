-- Monitor database connections
-- Use this script to check current connection status and identify connection leaks

-- 1. View current connection count by state
SELECT 
    state,
    count(*) as connection_count
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state
ORDER BY connection_count DESC;

-- 2. View detailed active connections
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    left(query, 100) as query_preview, 
    backend_start,
    state_change,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid <> pg_backend_pid()  -- Exclude current session
ORDER BY backend_start DESC;

-- 3. Check max connections limit
SHOW max_connections;

-- 4. Count total active connections
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_queries,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity 
WHERE datname = current_database();

-- 5. Find long-running idle connections (potential leaks)
SELECT 
    pid,
    usename,
    client_addr,
    state,
    backend_start,
    state_change,
    now() - state_change as idle_duration
FROM pg_stat_activity 
WHERE datname = current_database()
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes'  -- Idle for more than 5 minutes
ORDER BY state_change ASC;
