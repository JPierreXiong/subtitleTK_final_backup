# TikTok API Separation Completed

## ✅ 修复完成

### 问题
之前 TikTok 的下载视频和提取字幕功能使用同一个 API，导致功能混淆。

### 修复内容

1. **分离 TikTok API 调用** (`src/extensions/media/rapidapi.ts`)
   - 添加 `fetchTikTokVideo()` 方法：专门用于视频下载
   - 保留 `fetchTikTokMedia()` 方法：专门用于字幕提取
   - 根据 `outputType` 参数决定调用哪个 API

2. **更新主入口方法** (`src/extensions/media/rapidapi.ts`)
   - `fetchMedia()` 现在接受 `outputType` 参数
   - TikTok 平台：
     - `outputType === 'video'` → 调用 `fetchTikTokVideo()` → 使用视频下载 API
     - `outputType === 'subtitle'` → 调用 `fetchTikTokMedia()` → 使用字幕提取 API

3. **更新服务层** (`src/shared/services/media/rapidapi.ts`)
   - `fetchMediaFromRapidAPI()` 现在接受 `outputType` 参数
   - 默认值为 `'subtitle'` 保持向后兼容

4. **更新 API 路由** (`src/app/api/media/submit/route.ts`)
   - `processMediaTask()` 现在传递 `outputType` 给 `fetchMediaFromRapidAPI()`
   - 确保根据用户选择调用正确的 API

### API 端点配置

#### 视频下载 API
- **Host**: `tiktok-download-video1.p.rapidapi.com`
- **Method**: GET
- **Endpoint**: `/video/download?url=...` 或 `/download?url=...`
- **Headers**:
  - `x-rapidapi-host: tiktok-download-video1.p.rapidapi.com`
  - `x-rapidapi-key: {apiKey}`

#### 字幕提取 API
- **Host**: `tiktok-transcriptor-api3.p.rapidapi.com`
- **Method**: POST
- **Endpoint**: `/index.php`
- **Headers**:
  - `Content-Type: application/json`
  - `x-rapidapi-host: tiktok-transcriptor-api3.p.rapidapi.com`
  - `x-rapidapi-key: {apiKey}`
- **Body**: `{"url": "..."}`

### 功能流程

#### 选择"下载视频" (outputType: 'video')
1. 调用 `fetchTikTokVideo()`
2. 使用视频下载 API (`tiktok-download-video1.p.rapidapi.com`)
3. 获取视频下载链接
4. 如果 API 返回字幕，也会保存（可选）
5. 消耗 15 积分

#### 选择"提取字幕" (outputType: 'subtitle')
1. 调用 `fetchTikTokMedia()`
2. 使用字幕提取 API (`tiktok-transcriptor-api3.p.rapidapi.com`)
3. 提取字幕内容
4. 如果 API 返回视频链接，也会保存（可选）
5. 消耗 10 积分

### 注意事项

1. **API 端点可能需要调整**
   - 当前实现的视频下载 API 端点可能需要根据实际 RapidAPI 文档调整
   - 如果 API 调用失败，会尝试备用端点

2. **错误处理**
   - 两个 API 都有独立的错误处理
   - 如果 API 调用失败，会抛出明确的错误信息

3. **向后兼容**
   - 如果不传递 `outputType`，默认使用 `'subtitle'`
   - 保持现有功能正常工作

### 测试建议

1. **测试视频下载**：
   - 选择 "Video (TikTok only)"
   - 输入 TikTok URL
   - 验证是否调用视频下载 API
   - 验证视频是否成功下载

2. **测试字幕提取**：
   - 选择 "Subtitle"
   - 输入 TikTok URL
   - 验证是否调用字幕提取 API
   - 验证字幕是否成功提取

3. **验证积分消耗**：
   - 视频下载：15 积分
   - 字幕提取：10 积分

