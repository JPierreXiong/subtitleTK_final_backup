# 上传代码到 GitHub 指南

## 前提条件
1. 安装 Git：从 https://git-scm.com/download/win 下载并安装 Git for Windows
2. 确保已登录 GitHub 账户

## 步骤

### 1. 初始化 Git 仓库（如果还没有）
```bash
git init
```

### 2. 添加远程仓库
```bash
git remote add origin https://github.com/JPierreXiong/subtitle_youtube_tk_template.git
```

### 3. 添加所有文件
```bash
git add .
```

### 4. 提交代码
```bash
git commit -m "Initial commit: ShipAny template with SQLite support"
```

### 5. 推送到 GitHub
```bash
git branch -M main
git push -u origin main
```

## 注意事项

- `.env.development` 文件已被 `.gitignore` 忽略，不会被上传（这是安全的）
- `local.db` 数据库文件也会被忽略
- `node_modules` 文件夹会被忽略
- 如果遇到认证问题，可能需要配置 GitHub Personal Access Token

## 如果遇到问题

### 认证问题
如果推送时要求输入用户名和密码，请使用 GitHub Personal Access Token：
1. 访问 https://github.com/settings/tokens
2. 生成新的 token（需要 repo 权限）
3. 使用 token 作为密码

### 或者使用 SSH（推荐）
```bash
git remote set-url origin git@github.com:JPierreXiong/subtitle_youtube_tk_template.git
```











