#!/bin/bash
# ============================================
# 数据迁移脚本：Neon → Supabase
# ============================================
# 用途：自动执行完整的数据迁移流程
# 使用方法：./scripts/migrate-to-supabase.sh [backup_file.dump]
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Neon → Supabase 数据迁移工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 pg_restore 是否安装
if ! command -v pg_restore &> /dev/null; then
    echo -e "${RED}❌ 错误: pg_restore 未安装${NC}"
    exit 1
fi

# 获取备份文件
if [ -z "$1" ]; then
    BACKUP_DIR="./backups"
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}❌ 未找到备份文件${NC}"
        echo "请先运行备份脚本，或指定备份文件路径"
        exit 1
    fi
    
    BACKUP_FILE="$LATEST_BACKUP"
    echo -e "${YELLOW}使用最新备份: $BACKUP_FILE${NC}"
else
    BACKUP_FILE="$1"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ 备份文件不存在: $BACKUP_FILE${NC}"
        exit 1
    fi
fi

# 获取 Supabase 直接连接（用于迁移）
if [ -z "$SUPABASE_DIRECT_URL" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_DIRECT_URL 环境变量未设置${NC}"
    echo "请输入 Supabase 直接连接字符串（非 Pooler）:"
    read -p "DATABASE_URL: " SUPABASE_DIRECT_URL
fi

echo ""
echo -e "${GREEN}📋 迁移配置:${NC}"
echo "  备份文件: $BACKUP_FILE"
echo "  目标: Supabase"
echo ""

# 确认
read -p "确认开始迁移？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}已取消${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 开始迁移...${NC}"

# 步骤1: 导入数据
echo -e "${BLUE}步骤1: 导入数据到 Supabase...${NC}"
pg_restore "$SUPABASE_DIRECT_URL" \
    --dbname=postgres \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --verbose \
    "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 数据导入失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 数据导入完成${NC}"
echo ""

# 步骤2: 提示运行序列重置脚本
echo -e "${YELLOW}⚠️  重要: 请运行序列重置脚本${NC}"
echo "在 Supabase SQL Editor 中执行:"
echo "  scripts/reset-sequences.sql"
echo ""
echo "或者使用 psql 命令:"
echo "  psql \"$SUPABASE_DIRECT_URL\" -f scripts/reset-sequences.sql"
echo ""

read -p "是否现在运行序列重置脚本？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}步骤2: 重置序列...${NC}"
    psql "$SUPABASE_DIRECT_URL" -f scripts/reset-sequences.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 序列重置完成${NC}"
    else
        echo -e "${YELLOW}⚠️  序列重置可能失败，请手动检查${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  请稍后手动运行序列重置脚本${NC}"
fi

echo ""
echo -e "${GREEN}✅ 迁移完成！${NC}"
echo ""
echo -e "${BLUE}📋 下一步:${NC}"
echo "  1. 验证迁移结果: pnpm db:verify"
echo "  2. 切换回 Pooler 连接（在 .env.local 中）"
echo "  3. 测试应用功能"



