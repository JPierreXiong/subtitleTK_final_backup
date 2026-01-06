/**
 * Vercel 环境变量自动配置脚本
 * 
 * 使用方法：
 * 1. 在 Vercel Dashboard 获取 Access Token: https://vercel.com/account/tokens
 * 2. 获取项目信息（项目名称或项目ID）
 * 3. 运行: npx tsx scripts/setup-vercel-env.ts
 * 
 * 或者设置环境变量后运行：
 * VERCEL_TOKEN=your-token VERCEL_PROJECT=your-project npx tsx scripts/setup-vercel-env.ts
 */

import * as readline from 'readline';

// 环境变量配置
const ENV_VARIABLES = [
  // 通用 API Key
  {
    key: 'NEXT_PUBLIC_RAPIDAPI_KEY',
    value: '558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b',
    environments: ['production', 'preview', 'development'],
  },
  // TikTok 文案提取
  {
    key: 'RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST',
    value: 'tiktok-transcriptor-api3.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  {
    key: 'RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST',
    value: 'tiktok-transcript.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  // TikTok 视频下载
  {
    key: 'RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST',
    value: 'snap-video3.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  {
    key: 'RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST',
    value: 'tiktok-video-no-watermark2.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  // YouTube 文案提取
  {
    key: 'RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST',
    value: 'youtube-video-summarizer-gpt-ai.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  {
    key: 'RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST',
    value: 'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  // YouTube 视频下载
  {
    key: 'RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST',
    value: 'youtube-video-and-shorts-downloader1.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
  {
    key: 'RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST',
    value: 'youtube-video-downloader.p.rapidapi.com',
    environments: ['production', 'preview', 'development'],
  },
];

interface VercelEnvVariable {
  key: string;
  value: string;
  type?: 'system' | 'secret' | 'encrypted';
  target: ('production' | 'preview' | 'development')[];
}

async function setupVercelEnv() {
  console.log('🚀 Vercel 环境变量自动配置脚本\n');

  // 从命令行参数获取配置
  const args = process.argv.slice(2);
  let vercelToken = process.env.VERCEL_TOKEN || (args[0] && args[0] !== 'undefined' ? args[0] : undefined);
  let projectId = process.env.VERCEL_PROJECT_ID || (args[1] && args[1] !== 'undefined' ? args[1] : undefined);
  let teamId = process.env.VERCEL_TEAM_ID || (args[2] && args[2] !== 'undefined' ? args[2] : undefined);

  // 如果命令行参数不足，使用交互式输入
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  if (!vercelToken || vercelToken.trim() === '') {
    console.log('📝 请提供 Vercel Access Token');
    console.log('   获取地址: https://vercel.com/account/tokens\n');
    vercelToken = await question('Vercel Token: ');
  }

  if (!projectId || projectId.trim() === '') {
    console.log('\n📝 请提供项目名称或项目ID');
    console.log('   可以在 Vercel Dashboard 项目设置中找到\n');
    const projectInput = await question('项目名称或ID: ');
    projectId = projectInput;
  }

  rl.close();
  
  // 清理输入
  vercelToken = vercelToken?.trim();
  projectId = projectId?.trim();
  teamId = teamId?.trim() || undefined;

  if (!vercelToken || !projectId) {
    console.error('❌ 缺少必要配置');
    process.exit(1);
  }

  console.log('\n📦 开始配置环境变量...\n');

  // 配置每个环境变量
  let successCount = 0;
  let failCount = 0;

  for (const envVar of ENV_VARIABLES) {
    try {
      console.log(`配置: ${envVar.key}`);
      
      for (const environment of envVar.environments) {
        try {
          const result = await setVercelEnvVariable(
            vercelToken!,
            projectId!,
            teamId,
            {
              key: envVar.key,
              value: envVar.value,
              type: envVar.key.includes('KEY') ? 'secret' : 'system',
              target: [environment as 'production' | 'preview' | 'development'],
            }
          );

          if (result.success) {
            console.log(`  ✅ ${environment}: 成功`);
            successCount++;
          } else {
            console.log(`  ⚠️  ${environment}: ${result.message}`);
            failCount++;
          }
        } catch (error: any) {
          console.log(`  ❌ ${environment}: ${error.message}`);
          failCount++;
        }
      }
      console.log('');
    } catch (error: any) {
      console.error(`❌ 配置 ${envVar.key} 失败: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('\n📊 配置完成统计:');
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${failCount}`);
  console.log(`   📦 总计: ${ENV_VARIABLES.length * 3} 个配置项\n`);

  if (failCount === 0) {
    console.log('🎉 所有环境变量配置成功！');
    console.log('   请前往 Vercel Dashboard 验证配置');
    console.log('   然后重新部署应用以应用新配置\n');
  } else {
    console.log('⚠️  部分配置失败，请检查错误信息');
    console.log('   可以手动在 Vercel Dashboard 中配置剩余变量\n');
  }
}

async function setVercelEnvVariable(
  token: string,
  projectId: string,
  teamId: string | undefined,
  envVar: VercelEnvVariable
): Promise<{ success: boolean; message: string }> {
  const baseUrl = 'https://api.vercel.com';
  const url = teamId
    ? `${baseUrl}/v10/projects/${projectId}/env?teamId=${teamId}`
    : `${baseUrl}/v10/projects/${projectId}/env`;

  try {
    // 先检查是否已存在
    const checkResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!checkResponse.ok) {
      return {
        success: false,
        message: `检查失败: ${checkResponse.status} ${checkResponse.statusText}`,
      };
    }

    const existing = await checkResponse.json();
    const existingVar = existing.envs?.find(
      (e: any) => e.key === envVar.key && e.target?.includes(envVar.target[0])
    );

    // 如果已存在，先删除
    if (existingVar) {
      const deleteUrl = teamId
        ? `${baseUrl}/v10/projects/${projectId}/env/${existingVar.id}?teamId=${teamId}`
        : `${baseUrl}/v10/projects/${projectId}/env/${existingVar.id}`;

      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

            // 创建新的环境变量
            // 对于 NEXT_PUBLIC_* 变量，需要使用 'encrypted' 类型
            // 对于其他变量，也使用 'encrypted' 类型以确保安全
            const varType = 'encrypted';
            
            const createResponse = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key: envVar.key,
                value: envVar.value,
                type: varType,
                target: envVar.target,
              }),
            });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return {
        success: false,
        message: `创建失败: ${createResponse.status} ${error.error?.message || createResponse.statusText}`,
      };
    }

    return {
      success: true,
      message: '配置成功',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `请求失败: ${error.message}`,
    };
  }
}

// 运行脚本
setupVercelEnv().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

