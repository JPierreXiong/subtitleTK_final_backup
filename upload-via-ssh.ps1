# 通过 SSH 上传到 GitHub 脚本
# 使用方法: .\upload-via-ssh.ps1

Write-Host "=== GitHub SSH 上传脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 查找 Git
$gitExe = $null
$possiblePaths = @(
    "git",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
    "$env:ProgramFiles\Git\bin\git.exe",
    "$env:ProgramFiles(x86)\Git\bin\git.exe"
)

foreach ($path in $possiblePaths) {
    try {
        if ($path -eq "git") {
            $cmd = Get-Command git -ErrorAction SilentlyContinue
            if ($cmd) {
                $gitExe = "git"
                break
            }
        } else {
            if (Test-Path $path) {
                $gitExe = $path
                break
            }
        }
    } catch {
        continue
    }
}

if (-not $gitExe) {
    Write-Host "❌ 错误: 未找到 Git！" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 Git:" -ForegroundColor Yellow
    Write-Host "1. 访问 https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "2. 下载并安装 Git for Windows" -ForegroundColor Yellow
    Write-Host "3. 安装时选择 'Add Git to PATH'" -ForegroundColor Yellow
    Write-Host "4. 安装完成后重新运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ 找到 Git: $gitExe" -ForegroundColor Green
Write-Host ""

# 测试 SSH 连接
Write-Host "测试 SSH 连接..." -ForegroundColor Yellow
$sshTest = ssh -T git@github.com 2>&1
if ($sshTest -match "successfully authenticated") {
    Write-Host "✓ SSH 认证成功" -ForegroundColor Green
} else {
    Write-Host "⚠ SSH 连接测试: $sshTest" -ForegroundColor Yellow
}
Write-Host ""

# 初始化 Git 仓库
if (-not (Test-Path .git)) {
    Write-Host "初始化 Git 仓库..." -ForegroundColor Yellow
    & $gitExe init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git 初始化失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Git 仓库已初始化" -ForegroundColor Green
} else {
    Write-Host "✓ Git 仓库已存在" -ForegroundColor Green
}

Write-Host ""

# 配置远程仓库（SSH）
$remoteUrl = "git@github.com:JPierreXiong/subtitle_youtube_tk_template.git"
$currentRemote = & $gitExe remote get-url origin 2>$null

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentRemote)) {
    Write-Host "添加远程仓库 (SSH)..." -ForegroundColor Yellow
    & $gitExe remote add origin $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 添加远程仓库失败！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 远程仓库已添加: $remoteUrl" -ForegroundColor Green
} else {
    if ($currentRemote -ne $remoteUrl) {
        Write-Host "更新远程仓库 URL..." -ForegroundColor Yellow
        & $gitExe remote set-url origin $remoteUrl
        Write-Host "✓ 远程仓库 URL 已更新: $remoteUrl" -ForegroundColor Green
    } else {
        Write-Host "✓ 远程仓库已配置: $remoteUrl" -ForegroundColor Green
    }
}

Write-Host ""

# 添加所有文件
Write-Host "添加文件到 Git..." -ForegroundColor Yellow
& $gitExe add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 添加文件失败！" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 文件已添加" -ForegroundColor Green

Write-Host ""

# 检查是否有更改需要提交
$status = & $gitExe status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "ℹ 没有需要提交的更改" -ForegroundColor Yellow
    Write-Host ""
    
    # 检查是否需要推送
    Write-Host "检查远程分支状态..." -ForegroundColor Yellow
    $currentBranch = & $gitExe branch --show-current
    if ([string]::IsNullOrWhiteSpace($currentBranch)) {
        Write-Host "创建 main 分支..." -ForegroundColor Yellow
        & $gitExe branch -M main
        $currentBranch = "main"
    }
    
    $remoteExists = & $gitExe ls-remote --heads origin $currentBranch 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteExists)) {
        Write-Host "✓ 代码已是最新，无需推送" -ForegroundColor Green
    } else {
        Write-Host "推送代码到 GitHub..." -ForegroundColor Yellow
        & $gitExe push -u origin $currentBranch
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓✓✓ 代码已成功推送到 GitHub！" -ForegroundColor Green
        } else {
            Write-Host "❌ 推送失败！" -ForegroundColor Red
        }
    }
} else {
    # 提交更改
    Write-Host "提交更改..." -ForegroundColor Yellow
    $commitMessage = "Initial commit: ShipAny template with SQLite support"
    
    & $gitExe commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 提交失败！" -ForegroundColor Red
        Write-Host "提示: 可能需要配置 Git 用户信息:" -ForegroundColor Yellow
        Write-Host "  git config --global user.name `"Your Name`"" -ForegroundColor Yellow
        Write-Host "  git config --global user.email `"your.email@example.com`"" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ 更改已提交: $commitMessage" -ForegroundColor Green
    
    Write-Host ""
    
    # 推送到 GitHub
    Write-Host "推送代码到 GitHub..." -ForegroundColor Yellow
    & $gitExe branch -M main
    & $gitExe push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓✓✓ 代码已成功推送到 GitHub！" -ForegroundColor Green
        Write-Host "   仓库地址: https://github.com/JPierreXiong/subtitle_youtube_tk_template" -ForegroundColor Cyan
        Write-Host "   SSH 地址: git@github.com:JPierreXiong/subtitle_youtube_tk_template.git" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ 推送失败！" -ForegroundColor Red
        Write-Host "错误代码: $LASTEXITCODE" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "1. SSH 密钥未正确配置" -ForegroundColor Yellow
        Write-Host "2. 网络连接问题" -ForegroundColor Yellow
        Write-Host "3. 仓库权限问题" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "请检查:" -ForegroundColor Yellow
        Write-Host "1. SSH 密钥是否已添加到 GitHub: https://github.com/settings/keys" -ForegroundColor Yellow
        Write-Host "2. 测试 SSH 连接: ssh -T git@github.com" -ForegroundColor Yellow
    }
}

Write-Host ""











