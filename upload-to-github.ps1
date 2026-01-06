# GitHub 上传脚本
# 使用方法: .\upload-to-github.ps1

Write-Host "=== GitHub 上传脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 检查 Git 是否可用
$gitCmd = $null
$gitPaths = @(
    "git",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
)

foreach ($path in $gitPaths) {
    try {
        if ($path -eq "git") {
            $result = Get-Command git -ErrorAction SilentlyContinue
            if ($result) {
                $gitCmd = "git"
                break
            }
        } else {
            if (Test-Path $path) {
                $gitCmd = $path
                break
            }
        }
    } catch {
        continue
    }
}

if (-not $gitCmd) {
    Write-Host "❌ 错误: 未找到 Git！" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 Git:" -ForegroundColor Yellow
    Write-Host "1. 访问 https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "2. 下载并安装 Git for Windows" -ForegroundColor Yellow
    Write-Host "3. 安装完成后重新运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ 找到 Git: $gitCmd" -ForegroundColor Green
Write-Host ""

# 检查是否已初始化 Git 仓库
if (-not (Test-Path .git)) {
    Write-Host "初始化 Git 仓库..." -ForegroundColor Yellow
    & $gitCmd init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git 初始化失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Git 仓库已初始化" -ForegroundColor Green
} else {
    Write-Host "✓ Git 仓库已存在" -ForegroundColor Green
}

Write-Host ""

# 检查远程仓库
$remoteUrl = & $gitCmd remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "添加远程仓库..." -ForegroundColor Yellow
    & $gitCmd remote add origin https://github.com/JPierreXiong/subtitle_youtube_tk_template.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 添加远程仓库失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 远程仓库已添加" -ForegroundColor Green
} else {
    Write-Host "✓ 远程仓库已存在: $remoteUrl" -ForegroundColor Green
    $update = Read-Host "是否要更新远程仓库 URL? (y/n)"
    if ($update -eq "y" -or $update -eq "Y") {
        & $gitCmd remote set-url origin https://github.com/JPierreXiong/subtitle_youtube_tk_template.git
        Write-Host "✓ 远程仓库 URL 已更新" -ForegroundColor Green
    }
}

Write-Host ""

# 添加所有文件
Write-Host "添加文件到 Git..." -ForegroundColor Yellow
& $gitCmd add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 添加文件失败！" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 文件已添加" -ForegroundColor Green

Write-Host ""

# 检查是否有更改需要提交
$status = & $gitCmd status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "ℹ 没有需要提交的更改" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "检查是否需要推送..." -ForegroundColor Yellow
    $currentBranch = & $gitCmd branch --show-current
    $remoteBranch = & $gitCmd ls-remote --heads origin $currentBranch 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteBranch)) {
        Write-Host "✓ 代码已是最新，无需推送" -ForegroundColor Green
    } else {
        Write-Host "推送代码到 GitHub..." -ForegroundColor Yellow
        & $gitCmd branch -M main
        & $gitCmd push -u origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ 代码已成功推送到 GitHub！" -ForegroundColor Green
        } else {
            Write-Host "❌ 推送失败！请检查网络连接和认证信息" -ForegroundColor Red
        }
    }
} else {
    # 提交更改
    Write-Host "提交更改..." -ForegroundColor Yellow
    $commitMessage = Read-Host "请输入提交信息 (直接回车使用默认信息)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Initial commit: ShipAny template with SQLite support"
    }
    
    & $gitCmd commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 提交失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 更改已提交" -ForegroundColor Green
    
    Write-Host ""
    
    # 推送到 GitHub
    Write-Host "推送代码到 GitHub..." -ForegroundColor Yellow
    & $gitCmd branch -M main
    & $gitCmd push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓✓✓ 代码已成功推送到 GitHub！" -ForegroundColor Green
        Write-Host "   仓库地址: https://github.com/JPierreXiong/subtitle_youtube_tk_template" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ 推送失败！" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "1. 需要配置 GitHub 认证（用户名和 Personal Access Token）" -ForegroundColor Yellow
        Write-Host "2. 网络连接问题" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "解决方法:" -ForegroundColor Yellow
        Write-Host "1. 访问 https://github.com/settings/tokens 生成 Personal Access Token" -ForegroundColor Yellow
        Write-Host "2. 使用 token 作为密码进行推送" -ForegroundColor Yellow
        Write-Host "3. 或者配置 SSH 密钥: https://docs.github.com/en/authentication/connecting-to-github-with-ssh" -ForegroundColor Yellow
    }
}

Write-Host ""











