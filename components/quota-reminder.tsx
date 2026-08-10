"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface QuotaWarning {
  feature: string;
  featureName: string;
  used: number;
  total: number;
  remaining: number;
  percentage: number;
}

interface QuotaReminderProps {
  open: boolean;
  onClose: () => void;
  warnings: QuotaWarning[];
  planName: string;
}

export default function QuotaReminder({ open, onClose, warnings, planName }: QuotaReminderProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <DialogTitle>额度提醒</DialogTitle>
          </div>
          <DialogDescription>
            您的部分功能额度即将用尽，请注意合理使用。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="text-sm text-muted-foreground mb-3">
            当前套餐：<span className="font-semibold text-foreground">{planName}</span>
          </div>

          {warnings.map((warning) => (
            <div key={warning.feature} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{warning.featureName}</span>
                <span className={`text-sm font-semibold ${
                  warning.remaining === 0 ? 'text-red-500' : 'text-yellow-600'
                }`}>
                  {warning.remaining === 0 ? '已用尽' : `剩余 ${warning.remaining} 次`}
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>已使用 {warning.used}/{warning.total}</span>
                  <span>{warning.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      warning.remaining === 0 
                        ? 'bg-red-500' 
                        : warning.percentage >= 90 
                          ? 'bg-orange-500' 
                          : 'bg-yellow-500'
                    }`}
                    style={{ width: `${Math.min(warning.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            我知道了
          </Button>
          <Link href="/dashboard/subscription" className="w-full sm:w-auto">
            <Button className="w-full">
              升级套餐
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}