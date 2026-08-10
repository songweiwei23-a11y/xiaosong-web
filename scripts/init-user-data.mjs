// 数据库初始化脚本 - 补全用户数据
import { createClient } from '@supabase/supabase-js';

// 从环境变量或直接配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nxxbzdstmtuyplcwrrhs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGJ6ZHN0bXR1eXBsY3dycmhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0NTE1NiwiZXhwIjoyMTAwNzIxMTU2fQ.x-pX1CMLjGlJV-UrgFyDzkhcrGaGBLveHp2bxSsmwew';

const supabase = createClient(supabaseUrl, supabaseKey);

async function initUserData() {
  console.log('🔧 开始初始化用户数据...\n');

  try {
    // 1. 获取所有用户
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ 获取用户失败:', usersError);
      return;
    }

    console.log(`📊 找到 ${users.users.length} 个用户\n`);

    // 2. 为每个用户补全数据
    for (const user of users.users) {
      const userId = user.id;
      const email = user.email;

      console.log(`处理用户: ${email}`);

      // 检查并创建 user_quotas
      const { data: existingQuota, error: quotaCheckError } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingQuota) {
        console.log('  ➕ 创建 user_quotas 记录...');
        const { error: quotaError } = await supabase
          .from('user_quotas')
          .insert({
            user_id: userId,
            knowledge_used: 0,
            positioning_used: 0,
            topic_used: 0,
            script_used: 0,
            free_chat_used: 0,
            storyboard_used: 0,
            review_used: 0,
            title_used: 0,
            deal_reason_used: 0,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (quotaError) {
          console.error('  ❌ 创建quota失败:', quotaError.message);
        } else {
          console.log('  ✅ user_quotas 创建成功');
        }
      } else {
        console.log('  ✓ user_quotas 已存在');
      }

      // 检查并创建 subscriptions
      const { data: existingSub, error: subCheckError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingSub) {
        console.log('  ➕ 创建 subscriptions 记录...');
        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan: 'free',
            status: 'active',
            start_date: new Date().toISOString(),
          });

        if (subError) {
          console.error('  ❌ 创建subscription失败:', subError.message);
        } else {
          console.log('  ✅ subscriptions 创建成功');
        }
      } else {
        console.log('  ✓ subscriptions 已存在');
      }
    }

    // 3. 验证数据完整性
    console.log('\n📊 验证数据完整性...\n');

    const { count: profileCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: quotaCount } = await supabase
      .from('user_quotas')
      .select('*', { count: 'exact', head: true });

    const { count: subCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });

    console.log('=== 数据统计 ===');
    console.log(`用户总数: ${users.users.length}`);
    console.log(`Profile记录: ${profileCount || 0}`);
    console.log(`Quota记录: ${quotaCount || 0}`);
    console.log(`Subscription记录: ${subCount || 0}`);

    if (users.users.length === profileCount && 
        users.users.length === quotaCount && 
        users.users.length === subCount) {
      console.log('\n✅ 数据完整！所有用户都有完整记录');
    } else {
      console.log('\n⚠️ 数据不完整，请检查上面的错误信息');
    }

    // 4. 显示详细信息
    console.log('\n📋 用户详细信息:\n');

    for (const user of users.users) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('profile_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: quota } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(`📧 ${user.email}`);
      console.log(`   姓名: ${profile?.profile_name || 'N/A'}`);
      console.log(`   Profile: ${profile ? '✓' : '✗'}`);
      console.log(`   Quota: ${quota ? '✓' : '✗'}`);
      console.log(`   Subscription: ${sub ? '✓' : '✗'}`);
      console.log(`   套餐: ${sub?.plan || 'N/A'}`);
      console.log(`   状态: ${sub?.status || 'N/A'}`);
      console.log('');
    }

    console.log('✨ 初始化完成！\n');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  }
}

// 执行初始化
initUserData();
