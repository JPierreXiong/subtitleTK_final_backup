# 通过 SSH 上传到 GitHub 指南

## 前提条件

1. ✅ SSH 密钥已配置（已完成）
2. ✅ SSH 连接测试成功（已完成）
3. ⚠️ 需要安装 Git（如果未安装）

## 快速开始

### 方法 1：使用自动化脚本（推荐）

```powershell
.\upload-via-ssh.ps1
```

### 方法 2：手动执行命令

如果 Git 已安装，执行以下命令：

```bash
# 1. 初始化仓库（如果还没有）
git init

# 2. 添加远程仓库（SSH）
git remote add origin git@github.com:JPierreXiong/subtitle_youtube_tk_template.git
# 或者如果已存在，更新 URL：
git remote set-url origin git@github.com:JPierreXiong/subtitle_youtube_tk_template.git

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "Initial commit: ShipAny template with SQLite support"

# 5. 推送到 GitHub
git branch -M main
git push -u origin main
```

## SSH 配置信息

- **SSH 密钥名称**: XJP_SSH_product
- **密钥类型**: ssh-ed25519
- **公钥**: `AAAAC3NzaC1lZDI1NTE5AAAAIBAGVbrxvIGcI5br0aiarNtpfDr3Q02/QtdAeSLHTfBo`
- **GitHub 用户名**: JPierreXiong
- **仓库地址**: https://github.com/JPierreXiong/subtitle_youtube_tk_template

## 如果 Git 未安装

1. 访问 https://git-scm.com/download/win
2. 下载并安装 Git for Windows
3. 安装时选择 "Add Git to PATH"
4. 重新运行脚本或手动执行命令

## 配置 Git 用户信息（首次使用）

如果首次使用 Git，需要配置用户信息：

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 验证 SSH 连接

测试 SSH 是否正常工作：

```bash
ssh -T git@github.com
```

应该看到：`Hi JPierreXiong! You've successfully authenticated...`

## 注意事项

- ✅ `.env.development` 文件会被自动忽略（已在 .gitignore 中）
- ✅ `local.db` 数据库文件会被忽略
- ✅ `node_modules` 文件夹会被忽略
- ✅ 所有敏感文件都会被正确忽略

## 故障排除

### SSH 连接失败
- 检查 SSH 密钥是否已添加到 GitHub: https://github.com/settings/keys
- 确认密钥名称匹配：XJP_SSH_product

### 推送权限错误
- 确认有仓库的写入权限
- 检查仓库是否为私有（需要相应权限）

### Git 命令未找到
- 确保 Git 已安装并添加到 PATH
- 重启 PowerShell 或命令提示符
- 或使用 Git Bash 执行命令











