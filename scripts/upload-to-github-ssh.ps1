# ============================================
# 通过SSH上传到GitHub脚本 (PowerShell)
# ============================================
# 用途：删除测试文件和方案文件，然后上传到GitHub
# 使用方法：.\scripts\upload-to-github-ssh.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  上传到 GitHub (SSH)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# GitHub仓库地址
$GITHUB_REPO = "git@github.com:JPierreXiong/subtitleTK_final_backup.git"

# 步骤1: 检查Git是否安装
Write-Host "📋 步骤1: 检查Git安装" -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git 未安装" -ForegroundColor Red
    Write-Host "请先安装 Git: https://git-scm.com/downloads" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Git 已安装" -ForegroundColor Green
Write-Host ""

# 步骤2: 初始化Git仓库（如果还没有）
Write-Host "📋 步骤2: 初始化Git仓库" -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    Write-Host "初始化Git仓库..." -ForegroundColor Cyan
    git init
    Write-Host "✅ Git仓库已初始化" -ForegroundColor Green
} else {
    Write-Host "✅ Git仓库已存在" -ForegroundColor Green
}
Write-Host ""

# 步骤3: 删除测试文件
Write-Host "📋 步骤3: 删除测试文件" -ForegroundColor Yellow
$testFiles = @(
    "scripts\test-*.ts",
    "scripts\test-*.tsx",
    "scripts\check-*.ts",
    "scripts\verify-*.ts",
    "scripts\grant-*.ts",
    "scripts\execute-*.ts",
    "scripts\recreate-*.ts"
)

$deletedCount = 0
foreach ($pattern in $testFiles) {
    $files = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        if ($file.Name -match "test-|check-|verify-|grant-|execute-|recreate-") {
            Remove-Item $file.FullName -Force
            Write-Host "  删除: $($file.Name)" -ForegroundColor Gray
            $deletedCount++
        }
    }
}
Write-Host "✅ 已删除 $deletedCount 个测试文件" -ForegroundColor Green
Write-Host ""

# 步骤4: 删除方案文档（保留README.md）
Write-Host "📋 步骤4: 删除方案文档" -ForegroundColor Yellow
$docFiles = Get-ChildItem -Path "*.md" -Exclude "README.md" -ErrorAction SilentlyContinue
$docCount = 0
foreach ($file in $docFiles) {
    Remove-Item $file.FullName -Force
    Write-Host "  删除: $($file.Name)" -ForegroundColor Gray
    $docCount++
}

# 删除docs目录下的文档
if (Test-Path "docs") {
    $docsFiles = Get-ChildItem -Path "docs\*.md" -ErrorAction SilentlyContinue
    foreach ($file in $docsFiles) {
        Remove-Item $file.FullName -Force
        Write-Host "  删除: docs\$($file.Name)" -ForegroundColor Gray
        $docCount++
    }
}

Write-Host "✅ 已删除 $docCount 个方案文档" -ForegroundColor Green
Write-Host ""

# 步骤5: 配置Git用户信息（如果需要）
Write-Host "📋 步骤5: 检查Git配置" -ForegroundColor Yellow
$gitUser = git config user.name
$gitEmail = git config user.email

if (-not $gitUser -or -not $gitEmail) {
    Write-Host "⚠️  Git用户信息未配置" -ForegroundColor Yellow
    Write-Host "请手动配置:" -ForegroundColor Cyan
    Write-Host "  git config --global user.name 'Your Name'" -ForegroundColor Gray
    Write-Host "  git config --global user.email 'your.email@example.com'" -ForegroundColor Gray
} else {
    Write-Host "✅ Git用户: $gitUser <$gitEmail>" -ForegroundColor Green
}
Write-Host ""

# 步骤6: 配置远程仓库
Write-Host "📋 步骤6: 配置远程仓库" -ForegroundColor Yellow
$remoteUrl = git remote get-url origin -ErrorAction SilentlyContinue

if ($remoteUrl) {
    if ($remoteUrl -ne $GITHUB_REPO) {
        Write-Host "更新远程仓库地址..." -ForegroundColor Cyan
        git remote set-url origin $GITHUB_REPO
        Write-Host "✅ 远程仓库已更新" -ForegroundColor Green
    } else {
        Write-Host "✅ 远程仓库已配置" -ForegroundColor Green
    }
} else {
    Write-Host "添加远程仓库..." -ForegroundColor Cyan
    git remote add origin $GITHUB_REPO
    Write-Host "✅ 远程仓库已添加" -ForegroundColor Green
}
Write-Host ""

# 步骤7: 添加文件到Git
Write-Host "📋 步骤7: 添加文件到Git" -ForegroundColor Yellow
git add .
Write-Host "✅ 文件已添加" -ForegroundColor Green
Write-Host ""

# 步骤8: 提交更改
Write-Host "📋 步骤8: 提交更改" -ForegroundColor Yellow
$commitMessage = "Update: Remove test files and documentation, ready for production"
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 更改已提交" -ForegroundColor Green
} else {
    Write-Host "⚠️  没有需要提交的更改" -ForegroundColor Yellow
}
Write-Host ""

# 步骤9: 推送到GitHub
Write-Host "📋 步骤9: 推送到GitHub (SSH)" -ForegroundColor Yellow
Write-Host "远程仓库: $GITHUB_REPO" -ForegroundColor Cyan
Write-Host ""

# 检查SSH连接
Write-Host "检查SSH连接..." -ForegroundColor Cyan
$sshTest = ssh -T git@github.com 2>&1
if ($LASTEXITCODE -eq 0 -or $sshTest -match "successfully authenticated") {
    Write-Host "✅ SSH连接正常" -ForegroundColor Green
} else {
    Write-Host "⚠️  SSH连接测试失败，但继续尝试推送..." -ForegroundColor Yellow
    Write-Host "如果推送失败，请检查SSH密钥配置" -ForegroundColor Yellow
}
Write-Host ""

# 推送到main分支
Write-Host "推送代码到GitHub..." -ForegroundColor Cyan
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 代码已成功推送到GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 仓库地址:" -ForegroundColor Cyan
    Write-Host "   https://github.com/JPierreXiong/subtitleTK_final_backup" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ 推送失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的原因:" -ForegroundColor Yellow
    Write-Host "  1. SSH密钥未配置" -ForegroundColor Gray
    Write-Host "  2. GitHub账户没有访问权限" -ForegroundColor Gray
    Write-Host "  3. 网络连接问题" -ForegroundColor Gray
    Write-Host ""
    Write-Host "解决方案:" -ForegroundColor Cyan
    Write-Host "  1. 配置SSH密钥: https://docs.github.com/en/authentication/connecting-to-github-with-ssh" -ForegroundColor Gray
    Write-Host "  2. 检查仓库权限" -ForegroundColor Gray
    Write-Host "  3. 尝试使用HTTPS: git remote set-url origin https://github.com/JPierreXiong/subtitleTK_final_backup.git" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  上传完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

