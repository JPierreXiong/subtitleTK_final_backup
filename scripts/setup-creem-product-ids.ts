/**
 * 设置 Creem Product IDs 到 Vercel 环境变量
 * 
 * 使用方法：
 * npx tsx scripts/setup-creem-product-ids.ts <vercel-token> <project-id> [team-id]
 * 
 * 或者设置环境变量后运行：
 * VERCEL_TOKEN=your-token VERCEL_PROJECT_ID=your-project npx tsx scripts/setup-creem-product-ids.ts
 */

import * as readline from 'readline';

// Creem Product IDs 配置
const CREEM_PRODUCT_IDS = {
  "starter-monthly": "prod_2tOrusjFjkm0WaOn9waSCP",
  "base-monthly": "prod_52so9q1usRp5ZfDZ0vIBru",
  "pro-monthly": "prod_6Wo2c7ZLGrOcz1jGrSqhi0"
};

const ENV_VAR_KEY = 'CREEM_PRODUCT_IDS';
const ENV_VAR_VALUE = JSON.stringify(CREEM_PRODUCT_IDS);

async function setupCreemProductIds() {
  console.log('🚀 设置 Creem Product IDs 到 Vercel 环境变量\n');

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

  console.log('\n📦 开始配置 CREEM_PRODUCT_IDS...\n');
  console.log('配置内容:');
  console.log(JSON.stringify(CREEM_PRODUCT_IDS, null, 2));
  console.log('');

  // 配置环境变量到所有环境
  const environments: ('production' | 'preview' | 'development')[] = ['production', 'preview', 'development'];
  let successCount = 0;
  let failCount = 0;

  for (const environment of environments) {
    try {
      console.log(`配置 ${environment} 环境...`);
      const result = await setVercelEnvVariable(
        vercelToken!,
        projectId!,
        teamId,
        {
          key: ENV_VAR_KEY,
          value: ENV_VAR_VALUE,
          type: 'encrypted',
          target: [environment],
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

  console.log('\n📊 配置完成统计:');
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${failCount}`);
  console.log(`   📦 总计: ${environments.length} 个环境\n`);

  if (failCount === 0) {
    console.log('🎉 CREEM_PRODUCT_IDS 配置成功！');
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
  envVar: {
    key: string;
    value: string;
    type: 'system' | 'secret' | 'encrypted' | 'plain';
    target: ('production' | 'preview' | 'development')[];
  }
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

      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!deleteResponse.ok) {
        console.log(`  ⚠️  删除旧变量失败，继续创建新变量...`);
      }
    }

    // 创建新的环境变量
    const createResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: envVar.key,
        value: envVar.value,
        type: envVar.type,
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
setupCreemProductIds().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

