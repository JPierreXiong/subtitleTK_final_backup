# ============================================
# Docker 环境调试脚本 (PowerShell)
# ============================================
# 用途：检查 Docker 环境配置和网络连通性
# 使用方法：.\scripts\debug-docker-env.ps1
# ============================================

$ErrorActionPreference = "Continue"

Write-Host "🔍 Docker 环境调试工具" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Docker 是否安装
Write-Host "📋 步骤1: 检查 Docker 安装" -ForegroundColor Yellow
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerPath) {
    Write-Host "   ✅ Docker 已安装" -ForegroundColor Green
    & docker --version
} else {
    Write-Host "   ❌ Docker 未安装" -ForegroundColor Red
    Write-Host "   请安装 Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 2. 检查 Docker Compose
Write-Host "📋 步骤2: 检查 Docker Compose" -ForegroundColor Yellow
try {
    & docker compose version | Out-Null
    Write-Host "   ✅ Docker Compose 已安装" -ForegroundColor Green
    & docker compose version
} catch {
    Write-Host "   ❌ Docker Compose 未安装或不可用" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. 检查运行中的容器
Write-Host "📋 步骤3: 检查运行中的容器" -ForegroundColor Yellow
try {
    $containers = & docker ps --format "{{.Names}}" 2>$null
    if ([string]::IsNullOrWhiteSpace($containers)) {
        Write-Host "   ⚠️  没有运行中的容器" -ForegroundColor Yellow
        Write-Host "   运行: docker compose up -d 启动容器" -ForegroundColor Cyan
    } else {
        Write-Host "   ✅ 运行中的容器:" -ForegroundColor Green
        $containers | ForEach-Object {
            Write-Host "      - $_"
        }
    }
} catch {
    Write-Host "   ⚠️  无法获取容器列表: $_" -ForegroundColor Yellow
}
Write-Host ""

# 4. 检查数据库容器
Write-Host "📋 步骤4: 检查数据库容器" -ForegroundColor Yellow
try {
    $dbContainer = & docker ps --filter "name=shipany-local-db" --format "{{.Names}}" 2>$null
    if ([string]::IsNullOrWhiteSpace($dbContainer)) {
        Write-Host "   ⚠️  数据库容器未运行" -ForegroundColor Yellow
        Write-Host "   运行: docker compose up -d db" -ForegroundColor Cyan
    } else {
        Write-Host "   ✅ 数据库容器运行中: $dbContainer" -ForegroundColor Green
        
        # 检查容器健康状态
        try {
            $health = & docker inspect --format='{{.State.Health.Status}}' $dbContainer 2>$null
            Write-Host "   健康状态: $health"
        } catch {
            Write-Host "   健康状态: unknown"
        }
        
        # 检查端口映射
        try {
            $ports = & docker port $dbContainer 2>$null
            Write-Host "   端口映射: $ports"
        } catch {
            Write-Host "   端口映射: 无法获取"
        }
    }
} catch {
    Write-Host "   ⚠️  无法检查数据库容器: $_" -ForegroundColor Yellow
}
Write-Host ""

# 5. 检查网络连通性（从容器内）
if ($dbContainer) {
    Write-Host "📋 步骤5: 检查容器网络连通性" -ForegroundColor Yellow
    try {
        Write-Host "   测试 Google DNS..."
        & docker exec $dbContainer ping -c 2 8.8.8.8 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ 容器可以访问外部网络" -ForegroundColor Green
        } else {
            Write-Host "   ❌ 容器无法访问外部网络" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ⚠️  无法测试网络连通性: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 6. 检查环境变量
Write-Host "📋 步骤6: 检查环境变量" -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "   ✅ .env.local 文件存在" -ForegroundColor Green
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "NEXT_PUBLIC_RAPIDAPI_KEY=(.+)") {
        $rapidApiKey = $matches[1].Trim().Trim('"')
        if ([string]::IsNullOrWhiteSpace($rapidApiKey) -or $rapidApiKey -eq "your-rapidapi-key-here") {
            Write-Host "   ⚠️  RAPIDAPI_KEY 未设置或使用占位符" -ForegroundColor Yellow
        } else {
            $keyPreview = $rapidApiKey.Substring(0, [Math]::Min(8, $rapidApiKey.Length))
            $keySuffix = $rapidApiKey.Substring([Math]::Max(0, $rapidApiKey.Length - 4))
            Write-Host "   ✅ RAPIDAPI_KEY 已设置: ${keyPreview}...${keySuffix}" -ForegroundColor Green
        }
    } else {
        Write-Host "   ⚠️  未找到 RAPIDAPI_KEY 配置" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  .env.local 文件不存在" -ForegroundColor Yellow
}
Write-Host ""

# 7. 检查 Docker 日志
if ($dbContainer) {
    Write-Host "📋 步骤7: 检查数据库容器日志（最近10行）" -ForegroundColor Yellow
    try {
        & docker logs $dbContainer --tail 10 2>&1 | Select-Object -First 10
    } catch {
        Write-Host "   ⚠️  无法获取日志: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 8. 测试 RapidAPI 连接（从宿主机）
Write-Host "📋 步骤8: 测试 RapidAPI 连接（从宿主机）" -ForegroundColor Yellow
try {
    Write-Host "   测试 TikTok Transcript API..."
    $response = Invoke-WebRequest -Uri "https://tiktok-transcriptor-api3.p.rapidapi.com" -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 403 -or $response.StatusCode -eq 404) {
        Write-Host "   ✅ 可以访问 RapidAPI (HTTP $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  RapidAPI 响应异常 (HTTP $($response.StatusCode))" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403 -or $statusCode -eq 404) {
        Write-Host "   ✅ 可以访问 RapidAPI (HTTP $statusCode)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 无法访问 RapidAPI: $_" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "✅ 调试完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 下一步:" -ForegroundColor Cyan
Write-Host "   1. 如果 Docker 未安装，请先安装 Docker Desktop"
Write-Host "   2. 如果容器未运行，运行: docker compose up -d"
Write-Host "   3. 如果环境变量未设置，检查 .env.local 文件"
Write-Host "   4. 运行: pnpm tsx scripts/test-rapidapi-connection.ts 测试 API 连接"

