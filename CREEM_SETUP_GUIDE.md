# Creem 支付配置指南

## 📋 配置清单

### 必需配置项

1. **creem_enabled**: `true`
2. **creem_environment**: `sandbox`
3. **creem_api_key**: `creem_test_6449uLShhyL3U6HVnhuasm`
4. **creem_signing_secret**: `whsec_2QBVve0KEHHMYP5g9zEgDi`
5. **creem_product_ids**: 
   ```json
   {
     "standard-monthly": "prod_7c1FZHQeCCFczvNU5dYWEj",
     "premium-monthly": "prod_1pM4Co56OhCMC7EkwMjVf"
   }
   ```

## 🚀 配置方式

### 方式1: 通过后台管理界面（推荐）

1. 确保服务器正在运行：
   ```bash
   pnpm dev
   ```

2. 访问后台设置页面：
   ```
   http://localhost:3000/admin/settings/payment
   ```

3. 找到 "Creem" 配置组，填写以下内容：
   - ✅ **Creem Enabled**: 开启（切换开关）
   - ✅ **Creem Environment**: 选择 "Sandbox"
   - ✅ **Creem API Key**: `creem_test_6449uLShhyL3U6HVnhuasm`
   - ✅ **Creem Signing Secret**: `whsec_2QBVve0KEHHMYP5g9zEgDi`
   - ✅ **Creem Product IDs Mapping**: 粘贴以下 JSON
     ```json
     {
       "standard-monthly": "prod_7c1FZHQeCCFczvNU5dYWEj",
       "premium-monthly": "prod_1pM4Co56OhCMC7EkwMjVf"
     }
     ```

4. 点击保存

### 方式2: 使用 Drizzle Studio

1. 启动 Drizzle Studio：
   ```bash
   pnpm db:studio
   ```

2. 在浏览器中打开显示的 URL（通常是 http://localhost:4983）

3. 选择 `config` 表

4. 添加/更新以下记录：

   | name | value |
   |------|-------|
   | creem_enabled | true |
   | creem_environment | sandbox |
   | creem_api_key | creem_test_6449uLShhyL3U6HVnhuasm |
   | creem_signing_secret | whsec_2QBVve0KEHHMYP5g9zEgDi |
   | creem_product_ids | `{"standard-monthly":"prod_7c1FZHQeCCFczvNU5dYWEj","premium-monthly":"prod_1pM4Co56OhCMC7EkwMjVf"}` |

### 方式3: 使用 SQL 脚本

执行 `configure-creem.sql` 文件中的 SQL 语句。

## ✅ 验证配置

运行验证脚本：
```bash
node scripts/test-creem-payment.mjs
```

应该看到：
- ✅ Creem 已启用

## 🧪 测试支付流程

1. **访问定价页面**：
   ```
   http://localhost:3000/pricing
   ```

2. **选择套餐**：
   - 专业版 ($19.9) - 对应 `standard-monthly`
   - Ultima ($59.9) - 对应 `premium-monthly`

3. **点击购买按钮**

4. **选择支付方式**（如果启用了 `select_payment_enabled`）：
   - 选择 "Creem"

5. **完成测试支付**：
   - 会跳转到 Creem 测试支付页面
   - 使用测试卡完成支付

## 🔗 Webhook 配置

在 Creem Dashboard 中配置 Webhook：

- **URL**: `https://[ngrok-id].ngrok-free.app/api/payment/notify/creem`
- **Secret**: `whsec_2QBVve0KEHHMYP5g9zEgDi`

## 📌 注意事项

1. **免费版不需要 Creem 产品**：免费版 (`starter-monthly`) 不需要配置 Creem 产品 ID

2. **测试环境**：当前使用的是 Sandbox 环境，所有支付都是测试支付

3. **产品映射**：确保 `creem_product_ids` 中的 key 与 `pricing.json` 中的 `product_id` 完全匹配

4. **Webhook**：Webhook 用于接收支付成功通知，必须配置才能完成支付流程

## 🐛 故障排除

### Creem 未显示在支付选项中

- 检查 `creem_enabled` 是否为 `true`
- 检查 `default_payment_provider` 是否设置为 `creem`，或 `select_payment_enabled` 是否为 `true`

### 支付失败

- 检查 `creem_api_key` 是否正确
- 检查 `creem_product_ids` JSON 格式是否正确
- 检查产品 ID 是否与 Creem Dashboard 中的产品 ID 匹配

### Webhook 未收到通知

- 检查 Webhook URL 是否正确
- 检查 `creem_signing_secret` 是否与 Creem Dashboard 中的 Secret 匹配
- 确保 ngrok 隧道正在运行










