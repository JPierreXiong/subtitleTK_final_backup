# ============================================
# 数据迁移脚本：Neon → Supabase (PowerShell)
# ============================================
# 用途：自动执行完整的数据迁移流程
# 使用方法：.\scripts\migrate-to-supabase.ps1 [backup_file.dump]
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Neon → Supabase 数据迁移工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 pg_restore 是否安装
$pgRestorePath = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestorePath) {
    Write-Host "❌ 错误: pg_restore 未安装" -ForegroundColor Red
    Write-Host "请安装 PostgreSQL 客户端工具" -ForegroundColor Yellow
    exit 1
}

# 获取备份文件
$backupFile = $null
if ($args.Count -gt 0) {
    $backupFile = $args[0]
    if (-not (Test-Path $backupFile)) {
        Write-Host "❌ 备份文件不存在: $backupFile" -ForegroundColor Red
        exit 1
    }
} else {
    $backupDir = ".\backups"
    $latestBackup = Get-ChildItem -Path $backupDir -Filter "*.dump" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 1
    
    if (-not $latestBackup) {
        Write-Host "❌ 未找到备份文件" -ForegroundColor Red
        Write-Host "请先运行备份脚本，或指定备份文件路径" -ForegroundColor Yellow
        exit 1
    }
    
    $backupFile = $latestBackup.FullName
    Write-Host "使用最新备份: $backupFile" -ForegroundColor Yellow
}

# 获取 Supabase 直接连接（用于迁移）
if (-not $env:SUPABASE_DIRECT_URL) {
    Write-Host "⚠️  SUPABASE_DIRECT_URL 环境变量未设置" -ForegroundColor Yellow
    $supabaseUrl = Read-Host "请输入 Supabase 直接连接字符串（非 Pooler）"
    $env:SUPABASE_DIRECT_URL = $supabaseUrl
}

Write-Host ""
Write-Host "📋 迁移配置:" -ForegroundColor Green
Write-Host "  备份文件: $backupFile"
Write-Host "  目标: Supabase"
Write-Host ""

# 确认
$confirm = Read-Host "确认开始迁移？(y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 开始迁移..." -ForegroundColor Green

# 步骤1: 导入数据
Write-Host "步骤1: 导入数据到 Supabase..." -ForegroundColor Cyan
try {
    & pg_restore $env:SUPABASE_DIRECT_URL `
        --dbname=postgres `
        --no-owner `
        --no-acl `
        --clean `
        --if-exists `
        --verbose `
        $backupFile

    if ($LASTEXITCODE -ne 0) {
        throw "数据导入失败，退出代码: $LASTEXITCODE"
    }
    
    Write-Host "✅ 数据导入完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 数据导入失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 步骤2: 提示运行序列重置脚本
Write-Host "⚠️  重要: 请运行序列重置脚本" -ForegroundColor Yellow
Write-Host "在 Supabase SQL Editor 中执行:"
Write-Host "  scripts/reset-sequences.sql"
Write-Host ""
Write-Host "或者使用 psql 命令:"
Write-Host "  psql `"$env:SUPABASE_DIRECT_URL`" -f scripts/reset-sequences.sql"
Write-Host ""

$runReset = Read-Host "是否现在运行序列重置脚本？(y/N)"
if ($runReset -eq "y" -or $runReset -eq "Y") {
    Write-Host "步骤2: 重置序列..." -ForegroundColor Cyan
    
    $sqlFile = ".\scripts\reset-sequences.sql"
    if (Test-Path $sqlFile) {
        try {
            $sqlContent = Get-Content $sqlFile -Raw
            & psql $env:SUPABASE_DIRECT_URL -c $sqlContent
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ 序列重置完成" -ForegroundColor Green
            } else {
                Write-Host "⚠️  序列重置可能失败，请手动检查" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  序列重置失败: $_" -ForegroundColor Yellow
            Write-Host "请手动在 Supabase SQL Editor 中运行脚本" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  序列重置脚本未找到: $sqlFile" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  请稍后手动运行序列重置脚本" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ 迁移完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 下一步:" -ForegroundColor Cyan
Write-Host "  1. 验证迁移结果: pnpm db:verify"
Write-Host "  2. 切换回 Pooler 连接（在 .env.local 中）"
Write-Host "  3. 测试应用功能"





