#!/bin/bash
# ============================================
# Docker 环境调试脚本
# ============================================
# 用途：检查 Docker 环境配置和网络连通性
# 使用方法：./scripts/debug-docker-env.sh
# ============================================

set -e

echo "🔍 Docker 环境调试工具"
echo "===================="
echo ""

# 1. 检查 Docker 是否安装
echo "📋 步骤1: 检查 Docker 安装"
if command -v docker &> /dev/null; then
    echo "   ✅ Docker 已安装"
    docker --version
else
    echo "   ❌ Docker 未安装"
    echo "   请安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo ""

# 2. 检查 Docker Compose
echo "📋 步骤2: 检查 Docker Compose"
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "   ✅ Docker Compose 已安装"
    docker compose version 2>/dev/null || docker-compose --version
else
    echo "   ❌ Docker Compose 未安装"
    exit 1
fi
echo ""

# 3. 检查运行中的容器
echo "📋 步骤3: 检查运行中的容器"
CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "")
if [ -z "$CONTAINERS" ]; then
    echo "   ⚠️  没有运行中的容器"
    echo "   运行: docker-compose up -d 启动容器"
else
    echo "   ✅ 运行中的容器:"
    echo "$CONTAINERS" | while read -r container; do
        echo "      - $container"
    done
fi
echo ""

# 4. 检查数据库容器
echo "📋 步骤4: 检查数据库容器"
DB_CONTAINER=$(docker ps --filter "name=shipany-local-db" --format "{{.Names}}" 2>/dev/null || echo "")
if [ -z "$DB_CONTAINER" ]; then
    echo "   ⚠️  数据库容器未运行"
    echo "   运行: docker-compose up -d db"
else
    echo "   ✅ 数据库容器运行中: $DB_CONTAINER"
    
    # 检查容器健康状态
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "unknown")
    echo "   健康状态: $HEALTH"
    
    # 检查端口映射
    PORTS=$(docker port "$DB_CONTAINER" 2>/dev/null || echo "")
    echo "   端口映射: $PORTS"
fi
echo ""

# 5. 检查网络连通性（从容器内）
if [ -n "$DB_CONTAINER" ]; then
    echo "📋 步骤5: 检查容器网络连通性"
    echo "   测试 Google DNS..."
    if docker exec "$DB_CONTAINER" ping -c 2 8.8.8.8 &> /dev/null; then
        echo "   ✅ 容器可以访问外部网络"
    else
        echo "   ❌ 容器无法访问外部网络"
    fi
    
    echo "   测试 DNS 解析..."
    if docker exec "$DB_CONTAINER" nslookup google.com &> /dev/null; then
        echo "   ✅ DNS 解析正常"
    else
        echo "   ⚠️  DNS 解析可能有问题"
    fi
    echo ""
fi

# 6. 检查环境变量
echo "📋 步骤6: 检查环境变量"
if [ -f ".env.local" ]; then
    echo "   ✅ .env.local 文件存在"
    RAPIDAPI_KEY=$(grep "NEXT_PUBLIC_RAPIDAPI_KEY" .env.local | cut -d '=' -f2 | tr -d '"' || echo "")
    if [ -z "$RAPIDAPI_KEY" ] || [ "$RAPIDAPI_KEY" = "your-rapidapi-key-here" ]; then
        echo "   ⚠️  RAPIDAPI_KEY 未设置或使用占位符"
    else
        echo "   ✅ RAPIDAPI_KEY 已设置: ${RAPIDAPI_KEY:0:8}...${RAPIDAPI_KEY: -4}"
    fi
else
    echo "   ⚠️  .env.local 文件不存在"
fi
echo ""

# 7. 检查 Docker 日志
if [ -n "$DB_CONTAINER" ]; then
    echo "📋 步骤7: 检查数据库容器日志（最近10行）"
    docker logs "$DB_CONTAINER" --tail 10 2>&1 | head -10
    echo ""
fi

# 8. 测试 RapidAPI 连接（从宿主机）
echo "📋 步骤8: 测试 RapidAPI 连接（从宿主机）"
if command -v curl &> /dev/null; then
    echo "   测试 TikTok Transcript API..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -I "https://tiktok-transcriptor-api3.p.rapidapi.com" --max-time 5 2>&1 || echo "000")
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "404" ]; then
        echo "   ✅ 可以访问 RapidAPI (HTTP $RESPONSE)"
    else
        echo "   ❌ 无法访问 RapidAPI (HTTP $RESPONSE 或连接失败)"
    fi
else
    echo "   ⚠️  curl 未安装，跳过网络测试"
fi
echo ""

echo "✅ 调试完成！"
echo ""
echo "📋 下一步:"
echo "   1. 如果 Docker 未安装，请先安装 Docker Desktop"
echo "   2. 如果容器未运行，运行: docker-compose up -d"
echo "   3. 如果环境变量未设置，检查 .env.local 文件"
echo "   4. 运行: pnpm tsx scripts/test-rapidapi-connection.ts 测试 API 连接"

