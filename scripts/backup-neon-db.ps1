# ============================================
# Neon 数据库备份脚本 (PowerShell)
# ============================================
# 用途：从 Neon 数据库导出完整备份
# 使用方法：.\scripts\backup-neon-db.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始备份 Neon 数据库..." -ForegroundColor Green

# 检查 pg_dump 是否安装
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    Write-Host "❌ 错误: pg_dump 未安装" -ForegroundColor Red
    Write-Host "请安装 PostgreSQL 客户端工具" -ForegroundColor Yellow
    Write-Host "下载地址: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# 从环境变量或用户输入获取 Neon 连接信息
if (-not $env:NEON_DATABASE_URL) {
    Write-Host "⚠️  NEON_DATABASE_URL 环境变量未设置" -ForegroundColor Yellow
    $neonUrl = Read-Host "请输入 Neon 数据库连接字符串 (DATABASE_URL)"
    $env:NEON_DATABASE_URL = $neonUrl
}

# 生成备份文件名（带时间戳）
$backupDir = ".\backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "neon_backup_$timestamp.dump"

# 创建备份目录
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Write-Host "📦 开始导出..." -ForegroundColor Green
Write-Host "备份文件: $backupFile"

# 执行备份
try {
    & pg_dump $env:NEON_DATABASE_URL `
        --format=custom `
        --no-owner `
        --no-acl `
        --verbose `
        -f $backupFile

    if ($LASTEXITCODE -eq 0) {
        $backupSize = (Get-Item $backupFile).Length / 1MB
        Write-Host "✅ 备份完成！" -ForegroundColor Green
        Write-Host "文件: $backupFile"
        Write-Host "大小: $([math]::Round($backupSize, 2)) MB"
        Write-Host ""
        Write-Host "💡 下一步: 运行迁移脚本导入到 Supabase" -ForegroundColor Cyan
    } else {
        throw "备份失败，退出代码: $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ 备份失败: $_" -ForegroundColor Red
    exit 1
}

