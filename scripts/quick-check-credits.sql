-- ============================================
-- 快速查询用户积分余额
-- ============================================
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 查询两个用户的积分余额
SELECT 
  u.email,
  u.name,
  COALESCE(SUM(
    CASE 
      WHEN c.transaction_type = 'grant' 
        AND c.status = 'active' 
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        AND c.remaining_credits > 0
      THEN c.remaining_credits
      ELSE 0
    END
  ), 0) as total_credits
FROM "user" u
LEFT JOIN "credit" c ON c.user_id = u.id
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
GROUP BY u.email, u.id, u.name
ORDER BY u.email;


