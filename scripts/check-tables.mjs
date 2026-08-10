// 创建缺失的数据库表
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxxbzdstmtuyplcwrrhs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGJ6ZHN0bXR1eXBsY3dycmhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0NTE1NiwiZXhwIjoyMTAwNzIxMTU2fQ.x-pX1CMLjGlJV-UrgFyDzkhcrGaGBLveHp2bxSsmwew';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('🔧 创建缺失的数据库表...\n');

  try {
    // 先测试表是否存在
    console.log('检查 user_quotas 表...');
    const { data: quotaTest, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .limit(1);
    
    if (quotaError) {
      console.log('❌ user_quotas 表不存在:', quotaError.message);
    } else {
      console.log('✅ user_quotas 表已存在');
    }

    console.log('\n检查 subscriptions 表...');
    const { data: subTest, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(1);
    
    if (subError) {
      console.log('❌ subscriptions 表不存在:', subError.message);
    } else {
      console.log('✅ subscriptions 表已存在');
    }

    console.log('\n\n⚠️ 需要手动在 Supabase 控制台执行以下 SQL:\n');
    console.log('访问: https://supabase.com/dashboard/project/nxxbzdstmtuyplcwrrhs/editor\n');
    console.log('然后执行 xiaosong-web/supabase/migrations/ 目录下的SQL文件:\n');
    console.log('1. 20240109_user_quotas.sql');
    console.log('2. 20260809_create_subscriptions.sql (需要创建)\n');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

createTables();
