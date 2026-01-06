/**
 * 更新 Vercel 环境变量
 * 使用方法: pnpm update:vercel-env [token]
 * 
 * 需要设置 VERCEL_TOKEN 环境变量或作为参数传入
 */

const VERCEL_TOKEN = process.argv[2] || process.env.VERCEL_TOKEN || process.env.token;
const VERCEL_TEAM = process.env.VERCEL_TEAM; // 可选
const PROJECT_NAME = 'subtitletk'; // 根据实际项目名称修改

// Supabase 连接信息（从用户提供的信息）
const SUPABASE_CONFIG = {
  DATABASE_URL: 'postgresql://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
  DATABASE_PROVIDER: 'postgresql',
  AUTH_URL: 'https://www.subtitletk.app',
  NEXT_PUBLIC_APP_URL: 'https://www.subtitletk.app',
};

interface VercelProject {
  id: string;
  name: string;
}

interface VercelEnvVar {
  key: string;
  value: string;
  type: 'system' | 'secret' | 'encrypted';
  target?: ('production' | 'preview' | 'development')[];
  gitBranch?: string;
  id?: string;
}

async function getVercelProjects(): Promise<VercelProject[]> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置');
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

async function createEnvVar(
  projectId: string,
  key: string,
  value: string,
  target: ('production' | 'preview' | 'development')[] = ['production', 'preview', 'development']
): Promise<void> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置');
  }

  const url = VERCEL_TEAM
    ? `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${VERCEL_TEAM}`
    : `https://api.vercel.com/v9/projects/${projectId}/env`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`创建环境变量失败: ${response.status} ${error}`);
  }
}

async function updateEnvVar(
  projectId: string,
  envVarId: string,
  value: string,
  target: ('production' | 'preview' | 'development')[] = ['production', 'preview', 'development']
): Promise<void> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置');
  }

  const url = VERCEL_TEAM
    ? `https://api.vercel.com/v9/projects/${projectId}/env/${envVarId}?teamId=${VERCEL_TEAM}`
    : `https://api.vercel.com/v9/projects/${projectId}/env/${envVarId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value,
      target,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`更新环境变量失败: ${response.status} ${error}`);
  }
}

async function deleteEnvVar(projectId: string, envVarId: string): Promise<void> {
  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN 未设置');
  }

  const url = VERCEL_TEAM
    ? `https://api.vercel.com/v9/projects/${projectId}/env/${envVarId}?teamId=${VERCEL_TEAM}`
    : `https://api.vercel.com/v9/projects/${projectId}/env/${envVarId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`删除环境变量失败: ${response.status} ${error}`);
  }
}

async function updateVercelEnv() {
  console.log('========================================');
  console.log('  更新 Vercel 环境变量');
  console.log('========================================');
  console.log('');

  if (!VERCEL_TOKEN) {
    console.log('❌ VERCEL_TOKEN 未设置');
    console.log('');
    console.log('使用方法:');
    console.log('  pnpm update:vercel-env [token]');
    console.log('  或设置环境变量: export VERCEL_TOKEN="your-token"');
    console.log('');
    return;
  }

  console.log('✅ Vercel Token 已设置');
  console.log('');

  try {
    // 获取项目列表
    console.log('📋 正在获取项目列表...');
    const projects = await getVercelProjects();
    
    if (projects.length === 0) {
      console.log('❌ 未找到项目');
      return;
    }

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

    // 获取现有环境变量
    console.log('📋 正在获取现有环境变量...');
    const envVars = await getProjectEnvVars(targetProject.id);
    console.log(`✅ 找到 ${envVars.length} 个环境变量`);
    console.log('');

    // 需要删除的变量
    const varsToDelete = [
      'AUTH_DATABASE_URL',
      'POSTGRES_URL',
      'POSTGRES_PRISMA_URL',
      'POSTGRES_URL_NON_POOLING',
    ];

    // 删除不需要的变量
    console.log('========================================');
    console.log('  删除不需要的变量');
    console.log('========================================');
    console.log('');
    for (const key of varsToDelete) {
      const envVar = envVars.find(e => e.key === key);
      if (envVar && envVar.id) {
        try {
          await deleteEnvVar(targetProject.id, envVar.id);
          console.log(`✅ 已删除: ${key}`);
        } catch (error: any) {
          console.log(`❌ 删除失败: ${key} - ${error.message}`);
        }
      } else {
        console.log(`⏭️  不存在: ${key}`);
      }
    }
    console.log('');

    // 更新或创建必需的变量
    console.log('========================================');
    console.log('  更新/创建必需的变量');
    console.log('========================================');
    console.log('');
    for (const [key, value] of Object.entries(SUPABASE_CONFIG)) {
      const envVar = envVars.find(e => e.key === key);
      
      if (envVar && envVar.id) {
        // 更新现有变量
        try {
          await updateEnvVar(
            targetProject.id,
            envVar.id,
            value,
            ['production', 'preview', 'development']
          );
          console.log(`✅ 已更新: ${key}`);
        } catch (error: any) {
          console.log(`❌ 更新失败: ${key} - ${error.message}`);
        }
      } else {
        // 创建新变量
        try {
          await createEnvVar(
            targetProject.id,
            key,
            value,
            ['production', 'preview', 'development']
          );
          console.log(`✅ 已创建: ${key}`);
        } catch (error: any) {
          console.log(`❌ 创建失败: ${key} - ${error.message}`);
        }
      }
    }
    console.log('');

    console.log('========================================');
    console.log('  更新完成！');
    console.log('========================================');
    console.log('');
    console.log('⚠️  重要：现在需要重新部署 Vercel 才能生效！');
    console.log('');
    console.log('下一步操作:');
    console.log('  1. 在 Vercel Dashboard 中点击 "Redeploy"');
    console.log('  2. 取消勾选 "Use existing Build Cache"');
    console.log('  3. 等待部署完成');
    console.log('  4. 运行 pnpm test:vercel-auth 测试');
    console.log('');

  } catch (error: any) {
    console.error('❌ 更新失败:', error.message);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. Token 无效或过期');
    console.log('  2. 网络连接问题');
    console.log('  3. 项目不存在或无权限');
    console.log('');
    console.log('解决方案:');
    console.log('  1. 检查 Token: https://vercel.com/account/tokens');
    console.log('  2. 手动更新: 参考 VERCEL_ENV_FIX_REQUIRED.md');
  }
}

// 运行更新
updateVercelEnv().catch((error) => {
  console.error('更新过程中出错:', error);
  process.exit(1);
});


