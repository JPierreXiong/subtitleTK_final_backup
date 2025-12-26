# 数据库迁移说明

## 🚨 重要提示

由于 `drizzle-kit push` 显示 "No changes detected"，但测试脚本显示数据库缺少新字段，您需要手动执行SQL迁移。

## 📋 迁移步骤

### 方法1: 使用SQL文件（推荐）

1. **备份数据库**（重要！）
   ```bash
   # 使用pg_dump或其他工具备份
   pg_dump your_database > backup.sql
   ```

2. **执行SQL迁移**
   - 使用数据库管理工具（如pgAdmin、DBeaver、psql）连接数据库
   - 打开 `scripts/migrate-plan-system.sql`
   - 执行整个SQL脚本

3. **验证迁移**
   ```bash
   npx tsx scripts/test-plan-system.ts
   ```

### 方法2: 使用psql命令行

```bash
# 连接到PostgreSQL数据库
psql -U your_username -d your_database

# 执行SQL文件
\i scripts/migrate-plan-system.sql

# 退出
\q
```

### 方法3: 使用数据库管理工具

1. 打开数据库管理工具（pgAdmin、DBeaver、TablePlus等）
2. 连接到数据库
3. 打开SQL编辑器
4. 复制 `scripts/migrate-plan-system.sql` 的内容
5. 执行SQL

## ✅ 验证迁移成功

运行测试脚本：
```bash
npx tsx scripts/test-plan-system.ts
```

应该看到：
- ✅ 所有表存在
- ✅ 可以查询user表（不再报错plan_type不存在）
- ✅ 所有功能测试通过

## 🔍 如果迁移失败

### 检查数据库连接
确保 `.env.development` 或 `.env` 中的 `DATABASE_URL` 正确：
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### 检查权限
确保数据库用户有ALTER TABLE和CREATE TABLE权限。

### 检查表是否存在
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user', 'subscription', 'media_tasks');
```

## 📝 迁移后的字段说明

### user表新增字段
- `plan_type`: 套餐类型（free, base, pro, on_demand）
- `free_trial_used`: 已使用免费次数
- `last_checkin_date`: 最后打卡日期

### subscription表新增字段
- `plan_type`: 套餐类型
- `max_video_duration`: 视频长度限制（秒）
- `concurrent_limit`: 并发任务限制
- `export_formats`: 导出格式（JSON字符串）
- `storage_hours`: 存储时长（小时）
- `translation_char_limit`: 翻译字数限制

### media_tasks表新增字段
- `is_free_trial`: 是否使用免费测试

### 新建表
- `daily_checkins`: 每日打卡记录表

---

**迁移完成后，所有套餐系统功能即可正常使用！**


