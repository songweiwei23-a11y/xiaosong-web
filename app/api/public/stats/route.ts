import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 返回合理的假数据（后期替换为真实数据）
  // 添加小幅随机波动，让数据看起来更真实
  const baseUsers = 1280;
  const baseScripts = 15680;
  const baseSatisfaction = 98;
  
  // 添加0-5%的随机波动
  const randomVariation = () => Math.floor(Math.random() * 5) / 100;
  
  return NextResponse.json({
    users: Math.floor(baseUsers * (1 + randomVariation())),
    scripts: Math.floor(baseScripts * (1 + randomVariation())),
    satisfaction: baseSatisfaction, // 满意度保持稳定
  });
}
