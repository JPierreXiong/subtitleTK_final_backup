/**
 * Health Check API
 * 
 * 用途：检查数据库连接状态、响应延迟和当前连接信息
 * 访问：GET /api/health-check
 */

import { NextResponse } from 'next/server';
import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    responseTime: number;
    connectionType: string;
    host?: string;
    error?: string;
  };
  tables: {
    count: number;
    sample: string[];
  };
  environment: {
    provider: string;
    singleton: boolean;
  };
}

export async function GET() {
  const startTime = Date.now();
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: false,
      responseTime: 0,
      connectionType: 'unknown',
    },
    tables: {
      count: 0,
      sample: [],
    },
    environment: {
      provider: envConfigs.database_provider,
      singleton: envConfigs.db_singleton_enabled === 'true',
    },
  };

  try {
    // 检测连接类型
    const databaseUrl = envConfigs.database_url || '';
    if (databaseUrl.includes('pooler')) {
      result.database.connectionType = 'pooler';
      result.database.host = databaseUrl.match(/@([^:]+)/)?.[1] || 'unknown';
    } else if (databaseUrl.includes('db.qeqgoztrtyrfzkgpfhvx')) {
      result.database.connectionType = 'direct';
      result.database.host = 'db.qeqgoztrtyrfzkgpfhvx.supabase.co';
    } else if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
      result.database.connectionType = 'local';
      result.database.host = 'localhost';
    } else {
      result.database.connectionType = 'other';
      // 提取主机名（隐藏敏感信息）
      const hostMatch = databaseUrl.match(/@([^:/]+)/);
      if (hostMatch) {
        result.database.host = hostMatch[1];
      }
    }

    // 测试数据库连接
    const dbStartTime = Date.now();
    
    // 简单查询测试
    await db().execute('SELECT 1');
    
    result.database.connected = true;
    result.database.responseTime = Date.now() - dbStartTime;

    // 获取表列表
    try {
      const tables = await db().execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT 10
      `);

      if (Array.isArray(tables)) {
        result.tables.count = tables.length;
        result.tables.sample = tables
          .slice(0, 5)
          .map((t: any) => t.table_name);
      }

      // 尝试查询一个实际表（user 表）
      try {
        await db().select().from(schema.user).limit(1);
      } catch (error: any) {
        // 表可能不存在，不影响健康检查
      }
    } catch (error: any) {
      // 获取表列表失败，但不影响连接状态
      console.warn('Failed to get table list:', error.message);
    }

  } catch (error: any) {
    result.status = 'unhealthy';
    result.database.connected = false;
    result.database.error = error.message;
    result.database.responseTime = Date.now() - startTime;
  }

  const totalTime = Date.now() - startTime;
  result.database.responseTime = totalTime;

  // 根据状态返回相应的 HTTP 状态码
  const statusCode = result.status === 'healthy' ? 200 : 503;

  return NextResponse.json(result, { status: statusCode });
}





