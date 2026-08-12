// 测试Supabase连接和权限
import { supabase } from '@/lib/supabase/client';

async function testSupabase() {
  console.log('=== 开始测试 ===');
  
  // 1. 测试连接
  console.log('1. 测试连接...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('当前用户:', user?.id || '未登录');
  
  // 2. 测试Storage bucket
  console.log('\n2. 测试Storage bucket...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('获取buckets失败:', bucketError);
  } else {
    console.log('可用的buckets:', buckets?.map(b => b.name));
  }
  
  // 3. 测试RPC函数
  console.log('\n3. 测试get_payment_config函数...');
  const { data: configData, error: configError } = await supabase.rpc('get_payment_config');
  if (configError) {
    console.error('调用get_payment_config失败:', configError);
  } else {
    console.log('配置数据:', configData);
  }
  
  console.log('\n=== 测试完成 ===');
}

testSupabase();
