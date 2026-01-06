#!/bin/bash
# ============================================
# 本地 Docker 数据库设置脚本
# ============================================
# 用途：快速设置本地 PostgreSQL 测试环境
# 使用方法：./scripts/setup-local-docker.sh
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  本地 Docker 数据库设置${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}❌ Docker 未安装${NC}"
    echo "请先安装 Docker: https://www.docker.com/get-started"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 设置数据库密码
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "请输入数据库密码（留空使用默认密码 'shipany123'）:"
    read -s POSTGRES_PASSWORD
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-shipany123}
fi

# 更新 docker-compose.yml 中的密码
echo -e "${BLUE}📝 更新 Docker Compose 配置...${NC}"
sed -i.bak "s/POSTGRES_PASSWORD: your_password_here/POSTGRES_PASSWORD: $POSTGRES_PASSWORD/" docker-compose.yml

# 启动数据库
echo -e "${BLUE}🚀 启动 Docker 数据库...${NC}"
docker-compose up -d

# 等待数据库就绪
echo -e "${BLUE}⏳ 等待数据库就绪...${NC}"
sleep 5

# 检查数据库状态
for i in {1..30}; do
    if docker-compose exec -T db pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✅ 数据库已就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  数据库启动超时，请检查日志: docker-compose logs db${NC}"
        exit 1
    fi
    sleep 1
done

# 生成 .env.local 配置
ENV_LOCAL=".env.local.docker"
DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/shipany"

echo ""
echo -e "${GREEN}✅ Docker 数据库设置完成！${NC}"
echo ""
echo -e "${BLUE}📋 下一步:${NC}"
echo "  1. 更新 .env.local 中的 DATABASE_URL:"
echo "     DATABASE_URL=$DATABASE_URL"
echo ""
echo "  2. 初始化数据库:"
echo "     pnpm db:push"
echo ""
echo "  3. 测试连接:"
echo "     pnpm db:test"
echo ""
echo "💡 提示: 可以使用以下命令管理数据库:"
echo "  docker-compose logs -f db    # 查看日志"
echo "  docker-compose down           # 停止数据库"
echo "  docker-compose down -v       # 停止并删除数据"


