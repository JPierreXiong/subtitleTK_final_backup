/**
 * 测试 Vercel 部署的 Sign Up 和 Sign In 功能
 * 使用方法: pnpm test:vercel-auth
 */

const VERCEL_URL = 'https://www.subtitletk.app';

// 生成随机测试邮箱
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@test.subtitletk.app`;
}

// 提取 cookies 字符串
function extractCookies(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  
  // better-auth 使用 better-auth.session_token
  // set-cookie 可能包含多个 cookie，需要正确解析
  const cookies: string[] = [];
  
  // 处理多个 set-cookie 头（可能以数组形式返回）
  const cookieStrings = Array.isArray(setCookieHeader) 
    ? setCookieHeader 
    : setCookieHeader.split(',').map(c => c.trim());
  
  for (const cookieStr of cookieStrings) {
    // 提取 better-auth.session_token
    if (cookieStr.includes('better-auth.session_token')) {
      const match = cookieStr.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        cookies.push(`better-auth.session_token=${match[1]}`);
      }
    }
  }
  
  return cookies.join('; ');
}

// 测试 Sign Up
async function testSignUp(email: string, password: string, name: string) {
  console.log('📝 测试 Sign Up...');
  console.log(`   邮箱: ${email}`);
  console.log(`   姓名: ${name}`);
  
  try {
    const response = await fetch(`${VERCEL_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    });

    const data = await response.json();
    const setCookieHeader = response.headers.get('set-cookie');
    const cookies = extractCookies(setCookieHeader);

    console.log(`   状态码: ${response.status}`);
    console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
    
    if (setCookieHeader) {
      console.log(`   Set-Cookie 头: ${setCookieHeader.substring(0, 100)}...`);
    }
    
    if (cookies) {
      console.log(`   提取的 Cookie: ${cookies.substring(0, 80)}...`);
    } else {
      console.log('   ⚠️  未找到 Session Cookie');
    }

    if (response.ok) {
      console.log('   ✅ Sign Up 成功!');
      return { success: true, cookies, data };
    } else {
      console.log('   ❌ Sign Up 失败!');
      return { success: false, cookies, data };
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 测试 Sign In
async function testSignIn(email: string, password: string, cookies?: string) {
  console.log('🔐 测试 Sign In...');
  console.log(`   邮箱: ${email}`);
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // 如果有 cookies，添加到请求头
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await fetch(`${VERCEL_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();
    const setCookieHeader = response.headers.get('set-cookie');
    const newCookies = extractCookies(setCookieHeader) || cookies || '';

    console.log(`   状态码: ${response.status}`);
    console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
    
    if (newCookies) {
      console.log(`   Session Cookie: ${newCookies.substring(0, 80)}...`);
    }

    if (response.ok) {
      console.log('   ✅ Sign In 成功!');
      return { success: true, cookies: newCookies, data };
    } else {
      console.log('   ❌ Sign In 失败!');
      return { success: false, cookies: newCookies, data };
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 测试获取 Session
async function testGetSession(cookies?: string) {
  console.log('👤 测试获取 Session...');
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
      console.log(`   使用 Cookie: ${cookies.substring(0, 60)}...`);
    } else {
      console.log('   ⚠️  未提供 Cookie');
    }

    const response = await fetch(`${VERCEL_URL}/api/auth/get-session`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    const responseCookies = response.headers.get('set-cookie');
    
    console.log(`   状态码: ${response.status}`);
    console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
    if (responseCookies) {
      console.log(`   响应 Cookies: ${responseCookies.substring(0, 80)}...`);
    }

    if (response.ok && data?.user) {
      console.log('   ✅ Session 获取成功!');
      console.log(`   用户信息: ${data.user.email} (${data.user.name})`);
      return { success: true, data };
    } else if (response.ok && data === null) {
      console.log('   ⚠️  Session 返回 null（可能未登录或 cookie 无效）');
      return { success: false, data };
    } else {
      console.log('   ❌ Session 获取失败或未登录');
      return { success: false, data };
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 测试 Sign Out
async function testSignOut(cookies?: string) {
  console.log('🚪 测试 Sign Out...');
  
  try {
    const headers: HeadersInit = {};
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await fetch(`${VERCEL_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    console.log(`   状态码: ${response.status}`);
    console.log(`   响应: ${JSON.stringify(data, null, 2)}`);

    if (response.ok) {
      console.log('   ✅ Sign Out 成功!');
      return { success: true, data };
    } else {
      console.log('   ❌ Sign Out 失败!');
      return { success: false, data };
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runTests() {
  console.log('========================================');
  console.log('  Vercel 认证功能测试');
  console.log('========================================');
  console.log(`目标 URL: ${VERCEL_URL}`);
  console.log('');

  // 生成测试数据
  const testEmail = generateTestEmail();
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';

  console.log('📋 测试数据:');
  console.log(`   邮箱: ${testEmail}`);
  console.log(`   密码: ${testPassword}`);
  console.log(`   姓名: ${testName}`);
  console.log('');

  // 测试 1: Sign Up
  console.log('========================================');
  console.log('  测试 1: Sign Up (注册)');
  console.log('========================================');
  const signUpResult = await testSignUp(testEmail, testPassword, testName);
  console.log('');

  if (!signUpResult.success) {
    console.log('⚠️  Sign Up 失败，跳过后续测试');
    console.log('');
    console.log('可能的原因:');
    console.log('  1. 数据库连接问题');
    console.log('  2. 用户已存在');
    console.log('  3. API 端点不正确');
    console.log('  4. Vercel 部署未完成');
    return;
  }

  // 提取 cookies
  let cookies = signUpResult.cookies || '';
  
  // 等待一下，确保数据库写入完成
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试 2: Get Session (验证注册后的 session)
  console.log('========================================');
  console.log('  测试 2: Get Session (验证注册后的 Session)');
  console.log('========================================');
  const sessionResult1 = await testGetSession(cookies);
  console.log('');

  // 测试 3: Sign Out
  console.log('========================================');
  console.log('  测试 3: Sign Out (登出)');
  console.log('========================================');
  const signOutResult = await testSignOut(cookies);
  console.log('');

  // 测试 4: Sign In (使用刚注册的账号登录)
  console.log('========================================');
  console.log('  测试 4: Sign In (登录)');
  console.log('========================================');
  const signInResult = await testSignIn(testEmail, testPassword);
  console.log('');

  if (signInResult.cookies) {
    cookies = signInResult.cookies;
  }

  // 测试 5: Get Session (验证登录后的 session)
  console.log('========================================');
  console.log('  测试 5: Get Session (验证登录后的 Session)');
  console.log('========================================');
  const sessionResult2 = await testGetSession(cookies);
  console.log('');

  // 测试 6: 测试错误密码
  console.log('========================================');
  console.log('  测试 6: Sign In with Wrong Password (错误密码测试)');
  console.log('========================================');
  const wrongPasswordResult = await testSignIn(testEmail, 'WrongPassword123!');
  console.log('');

  // 测试总结
  console.log('========================================');
  console.log('  测试总结');
  console.log('========================================');
  console.log(`Sign Up:        ${signUpResult.success ? '✅ 通过' : '❌ 失败'}`);
  console.log(`Sign In:        ${signInResult.success ? '✅ 通过' : '❌ 失败'}`);
  console.log(`Sign Out:       ${signOutResult.success ? '✅ 通过' : '❌ 失败'}`);
  console.log(`Session (注册后): ${sessionResult1.success ? '✅ 通过' : '❌ 失败'}`);
  console.log(`Session (登录后): ${sessionResult2.success ? '✅ 通过' : '❌ 失败'}`);
  console.log(`错误密码测试:   ${!wrongPasswordResult.success ? '✅ 通过 (正确拒绝)' : '❌ 失败 (应该拒绝但通过了)'}`);
  console.log('');

  const allPassed = 
    signUpResult.success &&
    signInResult.success &&
    signOutResult.success &&
    sessionResult1.success &&
    sessionResult2.success &&
    !wrongPasswordResult.success;

  if (allPassed) {
    console.log('🎉 所有测试通过!');
  } else {
    console.log('⚠️  部分测试失败，请检查上述输出');
  }
  console.log('');
}

// 运行测试
runTests().catch((error) => {
  console.error('测试过程中出错:', error);
  process.exit(1);
});

