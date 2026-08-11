"use client";

import { AlertCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface QuotaExhaustedProps {
  planName: string;
  feature?: string;
}

export default function QuotaExhausted({ planName, feature }: QuotaExhaustedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-0 bg-red-100 dark:bg-red-900/20 rounded-full blur-xl" />
          <AlertCircle className="relative h-20 w-20 text-red-500 mx-auto" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-3">
        {feature ? `${feature}功能额度已用完` : '额度已用完'}
      </h2>

      <p className="text-muted-foreground mb-2">
        您当前使用的是 <span className="font-semibold text-foreground">{planName}</span>
      </p>

      <p className="text-muted-foreground mb-8 max-w-md">
        升级到更高级的套餐，解锁更多额度和专属功能，让创作更自由！
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/dashboard/subscription">
          <Button size="lg" className="gap-2">
            <Sparkles className="h-4 w-4" />
            立即升级套餐
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg" variant="outline">
            返回工作台
          </Button>
        </Link>
      </div>

      <div className="mt-12 p-6 bg-muted/50 rounded-lg max-w-md">
        <h3 className="font-semibold mb-3 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          升级套餐优势
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2 text-left">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>更多额度，满足高频创作需求</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>解锁高级功能，提升创作效率</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>优先响应速度，节省宝贵时间</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>专属客服支持，随时解决问题</span>
          </li>
        </ul>
      </div>
    </div>
  );
}