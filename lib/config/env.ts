// 环境变量检查和配置

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY', // 订单审核、管理员操作需要
];

export function checkEnvVars() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // 检查必需的环境变量
  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  // 检查可选但重要的环境变量
  optionalEnvVars.forEach((key) => {
    if (!process.env[key]) {
      warnings.push(key);
    }
  });

  if (missing.length > 0) {
    console.error('❌ 缺少必需的环境变量:', missing.join(', '));
    console.error('请在 .env.local 中配置这些变量');
    if (typeof window === 'undefined') {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn('⚠️ 缺少可选环境变量:', warnings.join(', '));
    console.warn('某些功能可能无法正常工作（如订单审核）');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

// 环境变量配置
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // 是否为生产环境
  isProduction: process.env.NODE_ENV === 'production',
  
  // 是否为开发环境
  isDevelopment: process.env.NODE_ENV === 'development',
};

// 服务端启动时检查
if (typeof window === 'undefined') {
  checkEnvVars();
}