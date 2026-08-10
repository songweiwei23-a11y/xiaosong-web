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
        {feature ? `${feature}功能额度已用完宍 : '额度已用完?}
      </h2>

      <p className="text-muted-foreground mb-2">
        您当前使用的是?<span className="font-semibold text-foreground">{planName}</span>
      </p>

      <p className="text-muted-foreground mb-8 max-w-md">
        鍗囩骇鍒版洿楂樼骇鐨勫椁愶紝瑙ｉ攣鏇村棰濆害鍜屼笓灞炲姛鑳斤紝璁╁垱浣滄洿鑷敱锛?      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/dashboard/subscription">
          <Button size="lg" className="gap-2">
            <Sparkles className="h-4 w-4" />
            立即升级套餐
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg" variant="outline">
            返回工作台?          </Button>
        </Link>
      </div>

      <div className="mt-12 p-6 bg-muted/50 rounded-lg max-w-md">
        <h3 className="font-semibold mb-3 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          鍗囩骇濂楅浼樺娍
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2 text-left">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">鉁?/span>
            <span>鏇村棰濆害锛屾弧瓒抽珮棰戝垱浣滈渶姹?/span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">鉁?/span>
            <span>解锁高级功能，提升创作效率?/span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">鉁?/span>
            <span>优先响应速度，节省宝贵时间?/span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">鉁?/span>
            <span>涓撳睘瀹㈡湇鏀寔锛岄殢鏃惰В鍐抽棶棰?/span>
          </li>
        </ul>
      </div>
    </div>
  );
}