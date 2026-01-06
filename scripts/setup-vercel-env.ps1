# Vercel 环境变量自动配置脚本 (PowerShell)
# 
# 使用方法：
# 1. 在 Vercel Dashboard 获取 Access Token: https://vercel.com/account/tokens
# 2. 获取项目名称或项目ID
# 3. 运行: .\scripts\setup-vercel-env.ps1

param(
    [string]$VercelToken = $env:VERCEL_TOKEN,
    [string]$ProjectId = $env:VERCEL_PROJECT_ID,
    [string]$TeamId = $env:VERCEL_TEAM_ID
)

# 环境变量配置
$envVariables = @(
    @{
        key = "NEXT_PUBLIC_RAPIDAPI_KEY"
        value = "558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST"
        value = "tiktok-transcriptor-api3.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST"
        value = "tiktok-transcript.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST"
        value = "snap-video3.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST"
        value = "tiktok-video-no-watermark2.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST"
        value = "youtube-video-summarizer-gpt-ai.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST"
        value = "youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST"
        value = "youtube-video-and-shorts-downloader1.p.rapidapi.com"
        environments = @("production", "preview", "development")
    },
    @{
        key = "RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST"
        value = "youtube-video-downloader.p.rapidapi.com"
        environments = @("production", "preview", "development")
    }
)

Write-Host "🚀 Vercel 环境变量自动配置脚本" -ForegroundColor Cyan
Write-Host ""

# 获取必要的配置
if (-not $VercelToken) {
    Write-Host "📝 请提供 Vercel Access Token" -ForegroundColor Yellow
    Write-Host "   获取地址: https://vercel.com/account/tokens" -ForegroundColor Gray
    Write-Host ""
    $VercelToken = Read-Host "Vercel Token"
}

if (-not $ProjectId) {
    Write-Host ""
    Write-Host "📝 请提供项目名称或项目ID" -ForegroundColor Yellow
    Write-Host "   可以在 Vercel Dashboard 项目设置中找到" -ForegroundColor Gray
    Write-Host ""
    $ProjectId = Read-Host "项目名称或ID"
}

if (-not $VercelToken -or -not $ProjectId) {
    Write-Host "❌ 缺少必要配置" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 开始配置环境变量..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($envVar in $envVariables) {
    Write-Host "配置: $($envVar.key)" -ForegroundColor White
    
    foreach ($environment in $envVar.environments) {
        try {
            $baseUrl = "https://api.vercel.com"
            $url = if ($TeamId) {
                "$baseUrl/v10/projects/$ProjectId/env?teamId=$TeamId"
            } else {
                "$baseUrl/v10/projects/$ProjectId/env"
            }
            
            $headers = @{
                "Authorization" = "Bearer $VercelToken"
                "Content-Type" = "application/json"
            }
            
            # 检查是否已存在
            $checkResponse = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -ErrorAction Stop
            $existingVar = $checkResponse.envs | Where-Object { 
                $_.key -eq $envVar.key -and $_.target -contains $environment 
            }
            
            # 如果已存在，先删除
            if ($existingVar) {
                $deleteUrl = if ($TeamId) {
                    "$baseUrl/v10/projects/$ProjectId/env/$($existingVar.id)?teamId=$TeamId"
                } else {
                    "$baseUrl/v10/projects/$ProjectId/env/$($existingVar.id)"
                }
                
                try {
                    Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers -ErrorAction SilentlyContinue
                } catch {
                    # 忽略删除错误
                }
            }
            
            # 创建新的环境变量
            $body = @{
                key = $envVar.key
                value = $envVar.value
                type = if ($envVar.key -like "*KEY*") { "secret" } else { "system" }
                target = @($environment)
            } | ConvertTo-Json
            
            $createResponse = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
            
            Write-Host "  ✅ $environment : 成功" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host "  ❌ $environment : $($_.Exception.Message)" -ForegroundColor Red
            $failCount++
        }
    }
    Write-Host ""
}

Write-Host ""
Write-Host "📊 配置完成统计:" -ForegroundColor Cyan
Write-Host "   ✅ 成功: $successCount" -ForegroundColor Green
Write-Host "   ❌ 失败: $failCount" -ForegroundColor Red
Write-Host "   📦 总计: $($envVariables.Count * 3) 个配置项" -ForegroundColor White
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "🎉 所有环境变量配置成功！" -ForegroundColor Green
    Write-Host "   请前往 Vercel Dashboard 验证配置" -ForegroundColor Gray
    Write-Host "   然后重新部署应用以应用新配置" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️  部分配置失败，请检查错误信息" -ForegroundColor Yellow
    Write-Host "   可以手动在 Vercel Dashboard 中配置剩余变量" -ForegroundColor Gray
    Write-Host ""
}

