// 创建缺失的数据库表
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
    console.log('访问: Supabase 控制台的 SQL Editor\n');
    console.log('然后执行 xiaosong-web/supabase/migrations/ 目录下的SQL文件:\n');
    console.log('1. 20240109_user_quotas.sql');
    console.log('2. 20260809_create_subscriptions.sql (需要创建)\n');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

createTables();
