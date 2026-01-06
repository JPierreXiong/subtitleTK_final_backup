/**
 * 验证 Drizzle Schema 与数据库表结构是否匹配
 * 使用方法: pnpm verify:schema
 */

import { db } from '../src/core/db';
import { user, session, account, verification } from '../src/config/db/schema';
import { sql } from 'drizzle-orm';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const database = db();
  try {
    // 直接使用 SQL 查询，注意 PostgreSQL 中表名可能需要双引号
    const query = sql.raw(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    const result = await database.execute(query);
    // Drizzle 返回格式可能是数组或对象
    if (Array.isArray(result)) {
      return result as ColumnInfo[];
    }
    if ((result as any).rows) {
      return (result as any).rows as ColumnInfo[];
    }
    return [];
  } catch (error: any) {
    console.log(`查询表 ${tableName} 时出错: ${error.message}`);
    return [];
  }
}

async function verifyTableStructure() {
  console.log('========================================');
  console.log('  Drizzle Schema 验证工具');
  console.log('========================================');
  console.log('');

  // 预期的表结构（根据 src/config/db/schema.ts）
  const expectedSchemas = {
    user: [
      { name: 'id', type: 'text', nullable: false },
      { name: 'name', type: 'text', nullable: false },
      { name: 'email', type: 'text', nullable: false },
      { name: 'email_verified', type: 'boolean', nullable: false },
      { name: 'image', type: 'text', nullable: true },
      { name: 'plan_type', type: 'text', nullable: true },
      { name: 'free_trial_used', type: 'integer', nullable: true },
      { name: 'last_checkin_date', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false },
    ],
    session: [
      { name: 'id', type: 'text', nullable: false },
      { name: 'expires_at', type: 'timestamp', nullable: false },
      { name: 'token', type: 'text', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false },
      { name: 'ip_address', type: 'text', nullable: true },
      { name: 'user_agent', type: 'text', nullable: true },
      { name: 'user_id', type: 'text', nullable: false },
    ],
    account: [
      { name: 'id', type: 'text', nullable: false },
      { name: 'account_id', type: 'text', nullable: false },
      { name: 'provider_id', type: 'text', nullable: false },
      { name: 'user_id', type: 'text', nullable: false },
      { name: 'access_token', type: 'text', nullable: true },
      { name: 'refresh_token', type: 'text', nullable: true },
      { name: 'id_token', type: 'text', nullable: true },
      { name: 'access_token_expires_at', type: 'timestamp', nullable: true },
      { name: 'refresh_token_expires_at', type: 'timestamp', nullable: true },
      { name: 'scope', type: 'text', nullable: true },
      { name: 'password', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false },
    ],
    verification: [
      { name: 'id', type: 'text', nullable: false },
      { name: 'identifier', type: 'text', nullable: false },
      { name: 'value', type: 'text', nullable: false },
      { name: 'expires_at', type: 'timestamp', nullable: false },
      { name: 'created_at', type: 'timestamp', nullable: false },
      { name: 'updated_at', type: 'timestamp', nullable: false },
    ],
  };

  let allMatch = true;

  for (const [tableName, expectedColumns] of Object.entries(expectedSchemas)) {
    console.log(`📋 检查表: ${tableName}`);
    console.log('----------------------------------------');

    try {
      const actualColumns = await getTableColumns(tableName);

      if (actualColumns.length === 0) {
        console.log(`❌ 表 ${tableName} 不存在！`);
        allMatch = false;
        console.log('');
        continue;
      }

      // 检查每个预期字段
      const actualColumnMap = new Map(
        actualColumns.map(col => [col.column_name.toLowerCase(), col])
      );

      let tableMatch = true;
      for (const expectedCol of expectedColumns) {
        const actualCol = actualColumnMap.get(expectedCol.name.toLowerCase());

        if (!actualCol) {
          console.log(`  ❌ 缺少字段: ${expectedCol.name}`);
          tableMatch = false;
          allMatch = false;
        } else {
          // 检查类型（PostgreSQL 类型可能略有不同）
          const typeMatch = checkTypeMatch(expectedCol.type, actualCol.data_type);
          const nullableMatch = 
            (expectedCol.nullable && actualCol.is_nullable === 'YES') ||
            (!expectedCol.nullable && actualCol.is_nullable === 'NO');

          if (!typeMatch || !nullableMatch) {
            console.log(`  ⚠️  字段 ${expectedCol.name}:`);
            if (!typeMatch) {
              console.log(`     类型不匹配: 期望 ${expectedCol.type}, 实际 ${actualCol.data_type}`);
            }
            if (!nullableMatch) {
              console.log(`     可空性不匹配: 期望 ${expectedCol.nullable ? 'nullable' : 'not null'}, 实际 ${actualCol.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
            }
            tableMatch = false;
            allMatch = false;
          } else {
            console.log(`  ✅ ${expectedCol.name}: ${actualCol.data_type} ${actualCol.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
          }
        }
      }

      // 检查是否有额外字段
      const expectedColumnNames = new Set(
        expectedColumns.map(col => col.name.toLowerCase())
      );
      for (const actualCol of actualColumns) {
        if (!expectedColumnNames.has(actualCol.column_name.toLowerCase())) {
          console.log(`  ⚠️  额外字段: ${actualCol.column_name} (${actualCol.data_type})`);
        }
      }

      if (tableMatch) {
        console.log(`✅ 表 ${tableName} 结构匹配！`);
      }
    } catch (error: any) {
      console.log(`❌ 检查表 ${tableName} 时出错: ${error.message}`);
      allMatch = false;
    }

    console.log('');
  }

  console.log('========================================');
  if (allMatch) {
    console.log('✅ 所有表结构匹配！');
  } else {
    console.log('❌ 部分表结构不匹配，请检查上述输出');
  }
  console.log('========================================');
}

function checkTypeMatch(expected: string, actual: string): boolean {
  // PostgreSQL 类型映射
  const typeMap: Record<string, string[]> = {
    text: ['text', 'character varying', 'varchar'],
    integer: ['integer', 'int4', 'int'],
    boolean: ['boolean', 'bool'],
    timestamp: ['timestamp without time zone', 'timestamp', 'timestamptz'],
  };

  const expectedTypes = typeMap[expected] || [expected];
  return expectedTypes.some(t => actual.toLowerCase().includes(t.toLowerCase()));
}

// 运行验证
verifyTableStructure().catch((error) => {
  console.error('验证过程中出错:', error);
  process.exit(1);
});

