"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface QuotaInfo {
  plan: string;
  planName: string;
  quotas: Record<string, number>;
  used: Record<string, number>;
  periodEnd: string;
}

export function useQuota() {
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/quota?userId=${user.id}`);
      const data = await response.json();
      setQuotaInfo(data);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  const checkAndUseQuota = async (feature: string): Promise<{ allowed: boolean; message?: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { allowed: false, message: '请先登录' };
      }

      const response = await fetch('/api/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, feature })
      });

      const result = await response.json();
      
      if (response.ok && result.allowed) {
        // 刷新额度信息
        await fetchQuota();
        return { allowed: true };
      } else {
        return { allowed: false, message: result.message || '额度不足' };
      }
    } catch (error: any) {
      return { allowed: false, message: error.message || '检查额度失败' };
    }
  };

  const getRemaining = (feature: string): number | string => {
    if (!quotaInfo) return 0;
    
    const quota = quotaInfo.quotas[feature];
    const used = quotaInfo.used[feature] || 0;
    
    if (quota === -1) return '无限';
    return Math.max(0, quota - used);
  };

  const hasAccess = (feature: string): boolean => {
    if (!quotaInfo) return false;
    
    const quota = quotaInfo.quotas[feature];
    const used = quotaInfo.used[feature] || 0;
    
    if (quota === -1) return true;
    return used < quota;
  };

  return {
    quotaInfo,
    loading,
    checkAndUseQuota,
    getRemaining,
    hasAccess,
    refresh: fetchQuota
  };
}