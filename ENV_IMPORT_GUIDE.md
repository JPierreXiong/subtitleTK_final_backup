# 环境变量导入指南

本文档说明如何将环境变量导入到数据库的 `config` 表中。

---

## 📋 文件说明

### 1. `env_variables_import.sql` - 完整版 SQL 文件
- 包含所有环境变量的 INSERT 语句
- 使用 `ON CONFLICT DO UPDATE` 确保可以重复执行
- 适合一次性导入所有配置

### 2. `env_variables_import_minimal.sql` - 最小必需配置
- 仅包含运行应用所需的最小配置
- 适合快速启动和测试

### 3. `env_variables_import.csv` - CSV 格式文件
- 可以用数据库管理工具导入
- 适合批量编辑和导入

---

## 🚀 使用方法

### 方法 1: 使用 SQL 文件（推荐）

#### 步骤 1: 编辑 SQL 文件
打开 `env_variables_import.sql` 或 `env_variables_import_minimal.sql`，将所有 `your-xxx-here` 替换为实际值。

#### 步骤 2: 执行 SQL
```bash
# 使用 psql
psql -U username -d database_name -f env_variables_import.sql

# 或使用数据库管理工具（如 pgAdmin、DBeaver）执行 SQL 文件
```

#### 步骤 3: 验证导入
```sql
SELECT name, value FROM config ORDER BY name;
```

---

### 方法 2: 使用 CSV 文件

#### 步骤 1: 编辑 CSV 文件
打开 `env_variables_import.csv`，将所有 `your-xxx-here` 替换为实际值。

#### 步骤 2: 导入 CSV
使用数据库管理工具（如 pgAdmin、DBeaver）导入 CSV 文件：

**pgAdmin:**
1. 右键点击 `config` 表
2. 选择 "Import/Export Data"
3. 选择 CSV 文件
4. 配置导入选项（分隔符：逗号，编码：UTF-8）
5. 执行导入

**DBeaver:**
1. 右键点击 `config` 表
2. 选择 "Import Data"
3. 选择 CSV 文件
4. 配置映射
5. 执行导入

**使用 psql:**
```sql
-- 先创建临时表
CREATE TEMP TABLE temp_config (name TEXT, value TEXT);

-- 导入 CSV
COPY temp_config FROM '/path/to/env_variables_import.csv' WITH CSV HEADER;

-- 插入到 config 表
INSERT INTO config (name, value)
SELECT name, value FROM temp_config
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
```

---

### 方法 3: 使用脚本导入（TypeScript）

如果您已经配置了数据库连接，可以使用以下脚本：

```typescript
import { saveConfigs } from './src/shared/models/config';

async function importConfigs() {
  const configs = {
    app_url: 'http://localhost:3000',
    rapidapi_key: 'your-rapidapi-key',
    rapidapi_media_key: 'your-rapidapi-key',
    gemini_api_key: 'your-gemini-api-key',
    // ... 其他配置
  };

  await saveConfigs(configs);
  console.log('Configs imported successfully!');
}

importConfigs();
```

---

## ⚠️ 重要提示

### 1. 必需配置
以下配置是运行应用所必需的，请务必填写：
- `app_url` - 应用 URL
- `rapidapi_key` - RapidAPI 密钥
- `rapidapi_media_key` - RapidAPI 媒体密钥
- `gemini_api_key` - Gemini API 密钥

### 2. 敏感信息
以下配置包含敏感信息，请妥善保管：
- API Keys（RapidAPI、Gemini）
- OAuth Secrets（Google、GitHub）
- 支付密钥（Creem、Stripe、PayPal）
- 存储凭证（R2、S3、Vercel Blob）

### 3. 环境变量优先级
**注意**: 某些配置（如支付相关）优先从环境变量读取，数据库配置作为备选。如果同时设置了环境变量和数据库配置，环境变量会覆盖数据库配置。

### 4. 重复执行
SQL 文件使用 `ON CONFLICT DO UPDATE`，可以安全地重复执行，不会产生重复数据。

---

## 📝 配置说明

### 基础应用配置
- `app_url`: 应用 URL（必需）
- `app_name`: 应用名称（默认: Subtitle TK）
- `theme`: 主题（默认: default）
- `appearance`: 外观模式（system/light/dark）
- `default_locale`: 默认语言（en/zh/fr）

### RapidAPI 配置
- `rapidapi_key`: RapidAPI API Key（必需）
- `rapidapi_media_key`: RapidAPI 媒体 Key（必需）
- `rapidapi_host_*`: 各服务的 Host（可选，有默认值）

### AI 服务配置
- `gemini_api_key`: Gemini API Key（必需）
- `gemini_model`: Gemini 模型（默认: gemini-1.5-flash）

### 支付配置
- `creem_enabled`: 启用 Creem 支付
- `creem_environment`: 环境（sandbox/production）
- `creem_api_key`: Creem API Key
- `creem_signing_secret`: Creem 签名密钥
- `creem_product_ids`: 产品 ID（JSON 格式）

### 存储配置
- `storage_provider`: 存储提供商（vercel-blob/r2/s3）
- `blob_read_write_token`: Vercel Blob 令牌
- R2/S3 相关配置（如使用）

---

## 🔍 验证导入

执行以下 SQL 查询验证配置是否正确导入：

```sql
-- 查看所有配置
SELECT name, value FROM config ORDER BY name;

-- 查看必需配置
SELECT name, 
       CASE 
         WHEN value IS NULL OR value = '' THEN '❌ 未设置'
         WHEN value LIKE 'your-%' THEN '⚠️ 需要修改'
         ELSE '✅ 已设置'
       END AS status
FROM config 
WHERE name IN ('app_url', 'rapidapi_key', 'rapidapi_media_key', 'gemini_api_key');

-- 统计配置数量
SELECT COUNT(*) as total_configs FROM config;
```

---

## 🆘 常见问题

### Q: 导入后配置不生效？
A: 检查环境变量是否覆盖了数据库配置。某些配置（如支付相关）优先从环境变量读取。

### Q: 如何更新单个配置？
A: 使用以下 SQL：
```sql
INSERT INTO config (name, value) VALUES ('config_name', 'config_value')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
```

### Q: 如何删除配置？
A: 使用以下 SQL：
```sql
DELETE FROM config WHERE name = 'config_name';
```

---

## 📚 相关文档

- `ENVIRONMENT_VARIABLES.md` - 环境变量完整清单
- `ENV_SETUP.md` - 环境变量设置指南
- `env.example.txt` - 环境变量示例文件

