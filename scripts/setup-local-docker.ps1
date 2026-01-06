# ============================================
# 本地 Docker 数据库设置脚本 (PowerShell)
# ============================================
# 用途：快速设置本地 PostgreSQL 测试环境
# 使用方法：.\scripts\setup-local-docker.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  本地 Docker 数据库设置" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否安装
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Host "❌ Docker 未安装" -ForegroundColor Red
    Write-Host "请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 检查 Docker Compose
$dockerComposeCmd = "docker compose"
try {
    & docker compose version | Out-Null
} catch {
    Write-Host "❌ Docker Compose 未安装或不可用" -ForegroundColor Red
    exit 1
}

# 设置数据库密码
if (-not $env:POSTGRES_PASSWORD) {
    $passwordInput = Read-Host "请输入数据库密码（留空使用默认密码 'shipany123'）"
    if ([string]::IsNullOrWhiteSpace($passwordInput)) {
        $env:POSTGRES_PASSWORD = "shipany123"
    } else {
        $env:POSTGRES_PASSWORD = $passwordInput
    }
}

# 更新 docker-compose.yml 中的密码
Write-Host "📝 更新 Docker Compose 配置..." -ForegroundColor Cyan
$composeContent = Get-Content "docker-compose.yml" -Raw
$composeContent = $composeContent -replace "POSTGRES_PASSWORD: your_password_here", "POSTGRES_PASSWORD: $env:POSTGRES_PASSWORD"
$composeContent | Set-Content "docker-compose.yml" -NoNewline

# 启动数据库
Write-Host "🚀 启动 Docker 数据库..." -ForegroundColor Cyan
& docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 启动失败" -ForegroundColor Red
    exit 1
}

# 等待数据库就绪
Write-Host "⏳ 等待数据库就绪..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 检查数据库状态
$maxRetries = 30
$retryCount = 0
$isReady = $false

while ($retryCount -lt $maxRetries) {
    try {
        & docker compose exec -T db pg_isready -U postgres | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $isReady = $true
            break
        }
    } catch {
        # 继续重试
    }
    $retryCount++
    Start-Sleep -Seconds 1
}

if (-not $isReady) {
    Write-Host "⚠️  数据库启动超时，请检查日志: docker compose logs db" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 数据库已就绪" -ForegroundColor Green

# 生成连接字符串
$databaseUrl = "postgresql://postgres:$env:POSTGRES_PASSWORD@localhost:5432/shipany"

Write-Host ""
Write-Host "✅ Docker 数据库设置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 下一步:" -ForegroundColor Cyan
Write-Host "  1. 更新 .env.local 中的 DATABASE_URL:"
Write-Host "     DATABASE_URL=$databaseUrl"
Write-Host ""
Write-Host "  2. 初始化数据库:"
Write-Host "     pnpm db:push"
Write-Host ""
Write-Host "  3. 测试连接:"
Write-Host "     pnpm db:test"
Write-Host ""
Write-Host "💡 提示: 可以使用以下命令管理数据库:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f db    # 查看日志"
Write-Host "  docker compose down           # 停止数据库"
Write-Host "  docker compose down -v       # 停止并删除数据"

