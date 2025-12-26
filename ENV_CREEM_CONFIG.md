# Creem 环境变量配置指南

## 📋 配置方式

现在支持通过环境变量直接配置 Creem 支付，无需通过后台界面。

## 🔧 在 .env.development 中添加配置

在项目根目录的 `.env.development` 文件中添加以下配置：

```env
# Creem Payment Configuration
CREEM_ENABLED=true
CREEM_ENVIRONMENT=sandbox
CREEM_API_KEY=creem_test_6449uLShhyL3U6HVnhuasm
CREEM_SIGNING_SECRET=whsec_2QBVve0KEHHMYP5g9zEgDi
CREEM_PRODUCT_IDS={"standard-monthly":"prod_7c1FZHQeCCFczvNU5dYWEj","premium-monthly":"prod_1pM4Co56OhCMC7EkwMjVf"}
DEFAULT_PAYMENT_PROVIDER=creem
```

## 📌 配置说明

| 环境变量 | 说明 | 示例值 |
|---------|------|--------|
| `CREEM_ENABLED` | 启用 Creem 支付 | `true` |
| `CREEM_ENVIRONMENT` | 环境类型 | `sandbox` 或 `production` |
| `CREEM_API_KEY` | Creem API 密钥 | `creem_test_xxx` |
| `CREEM_SIGNING_SECRET` | Webhook 签名密钥 | `whsec_xxx` |
| `CREEM_PRODUCT_IDS` | 产品 ID 映射（JSON 字符串） | `{"standard-monthly":"prod_xxx"}` |
| `DEFAULT_PAYMENT_PROVIDER` | 默认支付提供商 | `creem` |

## ⚠️ 注意事项

1. **优先级**：环境变量 > 数据库配置
   - 如果环境变量和数据库都配置了，环境变量会优先使用

2. **JSON 格式**：`CREEM_PRODUCT_IDS` 必须是有效的 JSON 字符串
   - 使用双引号包裹整个 JSON
   - 内部使用转义的双引号：`\"`

3. **重启服务器**：修改 `.env` 文件后需要重启服务器才能生效

4. **安全性**：
   - `.env.development` 文件不应提交到 Git
   - 生产环境使用 `.env.production` 或服务器环境变量

## ✅ 验证配置

配置完成后，运行验证脚本：

```bash
node scripts/test-creem-payment.mjs
```

应该看到：
- ✅ Creem 已启用

## 🚀 其他支付提供商环境变量

系统也支持通过环境变量配置其他支付提供商：

### Stripe
```env
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_SIGNING_SECRET=whsec_xxx
```

### PayPal
```env
PAYPAL_ENABLED=true
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENVIRONMENT=sandbox
```

## 📝 完整配置示例

```env
# Database
DATABASE_URL=postgresql://...
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=false

# Creem Payment
CREEM_ENABLED=true
CREEM_ENVIRONMENT=sandbox
CREEM_API_KEY=creem_test_6449uLShhyL3U6HVnhuasm
CREEM_SIGNING_SECRET=whsec_2QBVve0KEHHMYP5g9zEgDi
CREEM_PRODUCT_IDS={"standard-monthly":"prod_7c1FZHQeCCFczvNU5dYWEj","premium-monthly":"prod_1pM4Co56OhCMC7EkwMjVf"}
DEFAULT_PAYMENT_PROVIDER=creem
```










