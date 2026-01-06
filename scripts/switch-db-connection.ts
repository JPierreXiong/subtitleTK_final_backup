/**
 * 数据库连接切换工具
 * 
 * 用途：在 Pooler 和直接连接之间切换
 * 使用方法：pnpm tsx scripts/switch-db-connection.ts [pooler|direct]
 */

import * as fs from 'fs';
import * as path from 'path';

const CONNECTION_TYPES = {
  pooler: {
    name: 'Pooler 连接（生产环境推荐）',
    url: 'postgres://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
  },
  direct: {
    name: '直接连接（用于迁移）',
    url: 'postgres://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@db.qeqgoztrtyrfzkgpfhvx.supabase.co:5432/postgres?sslmode=require',
  },
};

function switchConnection(type: 'pooler' | 'direct') {
  const envFile = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envFile)) {
    console.error('❌ .env.local 文件不存在');
    process.exit(1);
  }

  const connection = CONNECTION_TYPES[type];
  if (!connection) {
    console.error(`❌ 无效的连接类型: ${type}`);
    console.error('可用类型: pooler, direct');
    process.exit(1);
  }

  // 读取文件
  let content = fs.readFileSync(envFile, 'utf-8');
  
  // 替换 DATABASE_URL
  const urlPattern = /^DATABASE_URL=.*$/m;
  if (urlPattern.test(content)) {
    content = content.replace(urlPattern, `DATABASE_URL=${connection.url}`);
  } else {
    // 如果不存在，添加到文件末尾
    content += `\nDATABASE_URL=${connection.url}\n`;
  }

  // 添加注释
  const commentPattern = /^# 使用 Supabase Pooler 连接.*$/m;
  if (commentPattern.test(content)) {
    content = content.replace(
      commentPattern,
      `# 使用 Supabase ${type === 'pooler' ? 'Pooler' : '直接'}连接（${connection.name}）`
    );
  }

  // 写入文件
  fs.writeFileSync(envFile, content, 'utf-8');

  console.log(`✅ 已切换到 ${connection.name}`);
  console.log(`   连接类型: ${type}`);
  console.log(`   文件: ${envFile}`);
  console.log('');
  console.log('💡 提示: 如果应用正在运行，请重启应用以应用新配置');
}

// 主函数
const args = process.argv.slice(2);
const type = args[0] as 'pooler' | 'direct';

if (!type || (type !== 'pooler' && type !== 'direct')) {
  console.log('📋 数据库连接切换工具');
  console.log('');
  console.log('使用方法:');
  console.log('  pnpm tsx scripts/switch-db-connection.ts pooler   # 切换到 Pooler 连接');
  console.log('  pnpm tsx scripts/switch-db-connection.ts direct  # 切换到直接连接');
  console.log('');
  console.log('当前配置:');
  
  try {
    const envFile = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        const url = match[1];
        if (url.includes('pooler')) {
          console.log('  ✅ Pooler 连接（生产环境）');
        } else if (url.includes('db.qeqgoztrtyrfzkgpfhvx')) {
          console.log('  ✅ 直接连接（迁移模式）');
        } else {
          console.log('  ⚠️  未知连接类型');
        }
      } else {
        console.log('  ❌ DATABASE_URL 未设置');
      }
    } else {
      console.log('  ❌ .env.local 文件不存在');
    }
  } catch (error) {
    console.log('  ❌ 无法读取配置');
  }
  
  process.exit(0);
}

switchConnection(type);

