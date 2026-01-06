/**
 * 检查 Vercel 环境变量配置
 * 使用方法: pnpm check:vercel-env
 * 
 * 需要设置 VERCEL_TOKEN 环境变量或使用 Vercel CLI 登录
 */

// 使文件成为模块，避免全局作用域冲突
export {};

// 支持从命令行参数或环境变量获取 token
const VERCEL_TOKEN = process.argv[2] || process.env.VERCEL_TOKEN || process.env.token;
const VERCEL_TEAM = process.env.VERCEL_TEAM; // 可选
const PROJECT_NAME = 'subtitletk'; // 根据实际项目名称修改

interface VercelEnvVar {
  key: string;
  value: string;
  type: 'system' | 'secret' | 'encrypted';
  target?: ('production' | 'preview' | 'development')[];
  gitBranch?: string;
  configurationId?: string;
  id?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface VercelProject {
  id: string;
  name: string;
}

async function getVercelProjects(): Promise<VercelProject[]> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置。请设置环境变量 VERCEL_TOKEN 或使用 Vercel CLI 登录。');
  }

  const url = VERCEL_TEAM
    ? `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM}`
    : 'https://api.vercel.com/v9/projects';

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`获取项目列表失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.projects || [];
}

async function getProjectEnvVars(projectId: string): Promise<VercelEnvVar[]> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置');
  }

  const url = VERCEL_TEAM
    ? `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${VERCEL_TEAM}`
    : `https://api.vercel.com/v9/projects/${projectId}/env`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`获取环境变量失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.envs || [];
}

function maskValue(value: string): string {
  if (!value || value.length <= 8) {
    return '****';
  }
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

function checkEnvVar(envVar: VercelEnvVar, key: string, expectedPattern?: RegExp): {
  exists: boolean;
  correct: boolean;
  message: string;
} {
  if (envVar.key !== key) {
    return { exists: false, correct: false, message: '' };
  }

  const exists = true;
  let correct = true;
  let message = '';

  if (expectedPattern) {
    correct = expectedPattern.test(envVar.value);
    if (!correct) {
      message = `❌ 值不符合预期格式`;
    } else {
      message = `✅ 值格式正确`;
    }
  } else {
    message = `✅ 已设置`;
  }

  return { exists, correct, message };
}

async function checkVercelEnv() {
  console.log('========================================');
  console.log('  Vercel 环境变量检查');
  console.log('========================================');
  console.log('');

  // 检查 token
  if (!VERCEL_TOKEN) {
    console.log('❌ VERCEL_TOKEN 未设置');
    console.log('');
    console.log('请使用以下方式之一：');
    console.log('  1. 设置环境变量: export VERCEL_TOKEN="your-token"');
    console.log('  2. 使用 Vercel CLI: vercel login');
    console.log('  3. 在脚本中直接设置 token（不推荐）');
    console.log('');
    console.log('获取 Token:');
    console.log('  https://vercel.com/account/tokens');
    console.log('');
    return;
  }

  console.log('✅ Vercel Token 已设置');
  console.log(`   使用 Token: ${maskValue(VERCEL_TOKEN)}`);
  if (VERCEL_TEAM) {
    console.log(`   团队 ID: ${VERCEL_TEAM}`);
  }
  console.log('');

  try {
    // 获取项目列表
    console.log('📋 正在获取项目列表...');
    const projects = await getVercelProjects();
    
    if (projects.length === 0) {
      console.log('❌ 未找到项目');
      return;
    }

    console.log(`✅ 找到 ${projects.length} 个项目`);
    console.log('');

    // 查找目标项目
    let targetProject = projects.find(p => 
      p.name.toLowerCase().includes(PROJECT_NAME.toLowerCase()) ||
      p.name.toLowerCase().includes('subtitle')
    );

    if (!targetProject && projects.length === 1) {
      targetProject = projects[0];
    }

    if (!targetProject) {
      console.log('⚠️  未找到匹配的项目，显示所有项目:');
      projects.forEach(p => {
        console.log(`  - ${p.name} (${p.id})`);
      });
      console.log('');
      console.log('请修改脚本中的 PROJECT_NAME 或选择项目 ID');
      return;
    }

    console.log(`📦 目标项目: ${targetProject.name} (${targetProject.id})`);
    console.log('');

    // 获取环境变量
    console.log('📋 正在获取环境变量...');
    const envVars = await getProjectEnvVars(targetProject.id);
    
    console.log(`✅ 找到 ${envVars.length} 个环境变量`);
    console.log('');

    // 检查必需的环境变量
    console.log('========================================');
    console.log('  环境变量检查结果');
    console.log('========================================');
    console.log('');

    const requiredVars = {
      'DATABASE_URL': {
        pattern: /postgresql:\/\/.*@.*pooler\.supabase\.com:6543/,
        description: '必须指向 Supabase Pooler（端口 6543）',
      },
      'DATABASE_PROVIDER': {
        pattern: /^postgresql$/,
        description: '必须为 "postgresql"',
      },
      'AUTH_SECRET': {
        pattern: /^.{32,}$/,
        description: '必须至少 32 个字符',
      },
      'AUTH_URL': {
        pattern: /^https?:\/\//,
        description: '必须是有效的 URL',
      },
      'NEXT_PUBLIC_APP_URL': {
        pattern: /^https?:\/\//,
        description: '必须是有效的 URL',
      },
    };

    const toRemoveVars = [
      'AUTH_DATABASE_URL',
      'POSTGRES_URL',
      'POSTGRES_PRISMA_URL',
      'POSTGRES_URL_NON_POOLING',
    ];

    let allCorrect = true;

    // 检查必需变量
    console.log('📋 必需的环境变量:');
    console.log('----------------------------------------');
    for (const [key, config] of Object.entries(requiredVars)) {
      const envVar = envVars.find(e => e.key === key);
      const check = checkEnvVar(envVar || { key: '', value: '' } as VercelEnvVar, key, config.pattern);
      
      if (!check.exists || !envVar) {
        console.log(`❌ ${key}: 未设置`);
        console.log(`   ${config.description}`);
        allCorrect = false;
      } else {
        console.log(`${check.correct ? '✅' : '⚠️'} ${key}: ${check.message}`);
        if (check.correct) {
          const maskedValue = maskValue(envVar.value);
          console.log(`   值: ${maskedValue}`);
          console.log(`   目标环境: ${envVar.target?.join(', ') || 'all'}`);
        } else {
          console.log(`   ${config.description}`);
          console.log(`   当前值: ${maskValue(envVar.value)}`);
          allCorrect = false;
        }
      }
      console.log('');
    }

    // 检查需要删除的变量
    console.log('📋 需要删除的变量:');
    console.log('----------------------------------------');
    let hasUnwantedVars = false;
    for (const key of toRemoveVars) {
      const envVar = envVars.find(e => e.key === key);
      if (envVar) {
        console.log(`❌ ${key}: 存在（应删除）`);
        console.log(`   值: ${maskValue(envVar.value)}`);
        console.log(`   目标环境: ${envVar.target?.join(', ') || 'all'}`);
        hasUnwantedVars = true;
        allCorrect = false;
      } else {
        console.log(`✅ ${key}: 不存在（正确）`);
      }
      console.log('');
    }

    // 显示所有环境变量（用于参考）
    console.log('========================================');
    console.log('  所有环境变量列表');
    console.log('========================================');
    console.log('');
    envVars.forEach(envVar => {
      const isRequired = Object.keys(requiredVars).includes(envVar.key);
      const isUnwanted = toRemoveVars.includes(envVar.key);
      const prefix = isRequired ? '📌' : isUnwanted ? '🗑️' : '  ';
      console.log(`${prefix} ${envVar.key}`);
      console.log(`    值: ${maskValue(envVar.value)}`);
      console.log(`    类型: ${envVar.type}`);
      console.log(`    目标: ${envVar.target?.join(', ') || 'all'}`);
      if (envVar.gitBranch) {
        console.log(`    分支: ${envVar.gitBranch}`);
      }
      console.log('');
    });

    // 总结
    console.log('========================================');
    console.log('  检查总结');
    console.log('========================================');
    console.log('');
    if (allCorrect) {
      console.log('✅ 所有环境变量配置正确！');
    } else {
      console.log('❌ 发现配置问题，请修复：');
      console.log('');
      console.log('修复步骤:');
      console.log('  1. 登录 Vercel Dashboard');
      console.log('  2. 进入项目 Settings -> Environment Variables');
      console.log('  3. 修复上述问题');
      console.log('  4. 重新部署（不使用缓存）');
    }
    console.log('');

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. Token 无效或过期');
    console.log('  2. 网络连接问题');
    console.log('  3. 项目不存在或无权限');
    console.log('');
    console.log('解决方案:');
    console.log('  1. 检查 Token: https://vercel.com/account/tokens');
    console.log('  2. 使用 Vercel CLI: vercel login');
    console.log('  3. 手动检查: 参考 scripts/check-vercel-env.md');
  }
}

// 运行检查
checkVercelEnv().catch((error) => {
  console.error('检查过程中出错:', error);
  process.exit(1);
});

