#!/bin/bash

# 通过 SSH 上传到 GitHub 脚本
# 使用方法: bash upload-via-ssh.sh

echo "=== GitHub SSH 上传脚本 ==="
echo ""

# 检查 Git 是否安装
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未找到 Git！"
    echo ""
    echo "请先安装 Git:"
    echo "1. 访问 https://git-scm.com/download/win"
    echo "2. 下载并安装 Git for Windows"
    exit 1
fi

echo "✓ Git 已安装: $(git --version)"
echo ""

# 测试 SSH 连接
echo "测试 SSH 连接..."
ssh -T git@github.com 2>&1 | head -1
echo ""

# 初始化 Git 仓库
if [ ! -d .git ]; then
    echo "初始化 Git 仓库..."
    git init
    echo "✓ Git 仓库已初始化"
else
    echo "✓ Git 仓库已存在"
fi

echo ""

# 配置远程仓库（SSH）
REMOTE_URL="git@github.com:JPierreXiong/subtitle_youtube_tk_template.git"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$CURRENT_REMOTE" ]; then
    echo "添加远程仓库 (SSH)..."
    git remote add origin "$REMOTE_URL"
    echo "✓ 远程仓库已添加: $REMOTE_URL"
else
    if [ "$CURRENT_REMOTE" != "$REMOTE_URL" ]; then
        echo "更新远程仓库 URL..."
        git remote set-url origin "$REMOTE_URL"
        echo "✓ 远程仓库 URL 已更新: $REMOTE_URL"
    else
        echo "✓ 远程仓库已配置: $REMOTE_URL"
    fi
fi

echo ""

# 添加所有文件
echo "添加文件到 Git..."
git add .
echo "✓ 文件已添加"

echo ""

# 检查是否有更改需要提交
if [ -z "$(git status --porcelain)" ]; then
    echo "ℹ 没有需要提交的更改"
    echo ""
    
    # 检查是否需要推送
    CURRENT_BRANCH=$(git branch --show-current)
    if [ -z "$CURRENT_BRANCH" ]; then
        echo "创建 main 分支..."
        git branch -M main
        CURRENT_BRANCH="main"
    fi
    
    REMOTE_EXISTS=$(git ls-remote --heads origin "$CURRENT_BRANCH" 2>/dev/null)
    if [ -n "$REMOTE_EXISTS" ]; then
        echo "✓ 代码已是最新，无需推送"
    else
        echo "推送代码到 GitHub..."
        git push -u origin "$CURRENT_BRANCH"
        if [ $? -eq 0 ]; then
            echo "✓✓✓ 代码已成功推送到 GitHub！"
        else
            echo "❌ 推送失败！"
        fi
    fi
else
    # 提交更改
    echo "提交更改..."
    COMMIT_MESSAGE="Initial commit: ShipAny template with SQLite support"
    
    git commit -m "$COMMIT_MESSAGE"
    if [ $? -ne 0 ]; then
        echo "❌ 提交失败！"
        echo "提示: 可能需要配置 Git 用户信息:"
        echo "  git config --global user.name \"Your Name\""
        echo "  git config --global user.email \"your.email@example.com\""
        exit 1
    fi
    echo "✓ 更改已提交: $COMMIT_MESSAGE"
    
    echo ""
    
    # 推送到 GitHub
    echo "推送代码到 GitHub..."
    git branch -M main
    git push -u origin main
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓✓✓ 代码已成功推送到 GitHub！"
        echo "   仓库地址: https://github.com/JPierreXiong/subtitle_youtube_tk_template"
        echo "   SSH 地址: git@github.com:JPierreXiong/subtitle_youtube_tk_template.git"
    else
        echo ""
        echo "❌ 推送失败！"
        echo ""
        echo "可能的原因:"
        echo "1. SSH 密钥未正确配置"
        echo "2. 网络连接问题"
        echo "3. 仓库权限问题"
        echo ""
        echo "请检查:"
        echo "1. SSH 密钥是否已添加到 GitHub: https://github.com/settings/keys"
        echo "2. 测试 SSH 连接: ssh -T git@github.com"
    fi
fi

echo ""











