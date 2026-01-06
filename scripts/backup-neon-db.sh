#!/bin/bash
# ============================================
# Neon 数据库备份脚本
# ============================================
# 用途：从 Neon 数据库导出完整备份
# 使用方法：./scripts/backup-neon-db.sh
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始备份 Neon 数据库...${NC}"

# 检查 pg_dump 是否安装
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ 错误: pg_dump 未安装${NC}"
    echo "请安装 PostgreSQL 客户端工具"
    exit 1
fi

# 从环境变量或用户输入获取 Neon 连接信息
if [ -z "$NEON_DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  NEON_DATABASE_URL 环境变量未设置${NC}"
    echo "请输入 Neon 数据库连接字符串:"
    read -p "DATABASE_URL: " NEON_DATABASE_URL
fi

# 生成备份文件名（带时间戳）
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/neon_backup_$(date +%Y%m%d_%H%M%S).dump"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}📦 开始导出...${NC}"
echo "备份文件: $BACKUP_FILE"

# 执行备份
pg_dump "$NEON_DATABASE_URL" \
    --format=custom \
    --no-owner \
    --no-acl \
    --verbose \
    -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ 备份完成！${NC}"
    echo "文件: $BACKUP_FILE"
    echo "大小: $BACKUP_SIZE"
    echo ""
    echo "💡 下一步: 运行迁移脚本导入到 Supabase"
else
    echo -e "${RED}❌ 备份失败${NC}"
    exit 1
fi


