// 统一使用规范浏览器客户端（基于 @supabase/ssr，与 middleware 共享 Cookie 会话）。
// 说明：此前此处自建了第二个基于 localStorage 的客户端，会与 SSR 客户端产生会话不一致，已移除。
import { supabase } from './supabase/client';

export { supabase };

// 成交理由相关操作
export const dealReasonService = {
  // 获取当前用户的成交理由
  async get(userId: string) {
    const { data, error } = await supabase
      .from('deal_reasons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching deal reasons:', error);
      return null;
    }
    return data;
  },

  // 保存成交理由
  async save(data: {
    userId: string;
    storeName: string;
    storeType: string;
    storeFeatures?: string;
    targetCustomer?: string;
    analysisResult: string;
    selectedReasons: string[];
  }) {
    const { data: result, error } = await supabase
      .from('deal_reasons')
      .upsert({
        user_id: data.userId,
        store_name: data.storeName,
        store_type: data.storeType,
        store_features: data.storeFeatures,
        target_customer: data.targetCustomer,
        analysis_result: data.analysisResult,
        selected_reasons: data.selectedReasons,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving deal reasons:', error);
      throw error;
    }
    return result;
  },

  // 删除成交理由
  async delete(userId: string) {
    const { error } = await supabase
      .from('deal_reasons')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting deal reasons:', error);
      throw error;
    }
  }
};

// 脚本历史记录
export const scriptHistoryService = {
  // 获取历史记录
  async getAll(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('script_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }
    return data || [];
  },

  // 保存历史记录
  async save(data: {
    userId: string;
    taskType: string;
    inputData: any;
    result: string;
  }) {
    const { error } = await supabase
      .from('script_history')
      .insert({
        user_id: data.userId,
        task_type: data.taskType,
        input_data: data.inputData,
        result: data.result,
      });

    if (error) {
      console.error('Error saving history:', error);
    }
  }
};

// 用户设置
export const userSettingsService = {
  // 获取用户设置
  async get(userId: string) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // 用户设置不存在,创建默认设置
      return await this.create(userId);
    }

    if (error) {
      console.error('Error fetching user settings:', error);
      return null;
    }
    return data;
  },

  // 创建用户设置
  async create(userId: string) {
    const { data, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        quota_limit: 5,
        quota_used: 0,
        subscription_tier: 'free',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user settings:', error);
      return null;
    }
    return data;
  },

  // 更新用户设置
  async update(userId: string, updates: {
    quota_used?: number;
    quota_limit?: number;
    subscription_tier?: string;
  }) {
    const { data, error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
    return data;
  },

  // 增加使用次数
  async incrementUsage(userId: string) {
    const settings = await this.get(userId);
    if (!settings) return;

    if (settings.quota_used >= settings.quota_limit) {
      throw new Error('已达到使用次数上限');
    }

    return await this.update(userId, {
      quota_used: settings.quota_used + 1
    });
  }
};

// 通用生成历史记录服务(增强版)
export const generationHistoryService = {
  // 保存生成记录
  async save(data: {
    userId: string;
    taskType: string; // '脚本生成' | '选题策划' | '分镜脚本' | '审稿优化' | '标题封面' | '账号定位' | '知识库查询'
    inputData: any; // 输入参数
    result: string; // 生成结果
  }) {
    const { data: record, error } = await supabase
      .from('script_history')
      .insert({
        user_id: data.userId,
        task_type: data.taskType,
        input_data: data.inputData,
        result: data.result,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving history:', error);
      throw error;
    }
    
    return record;
  },

  // 获取历史记录(分页)
  async getList(userId: string, taskType?: string, limit = 20, offset = 0) {
    let query = supabase
      .from('script_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching history:', error);
      return { data: [], count: 0 };
    }

    return { data: data || [], count: count || 0 };
  },

  // 获取单条记录
  async getOne(id: string, userId: string) {
    const { data, error } = await supabase
      .from('script_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching record:', error);
      return null;
    }
    return data;
  },

  // 删除记录
  async delete(id: string, userId: string) {
    const { error } = await supabase
      .from('script_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  },

  // 批量删除
  async deleteMultiple(ids: string[], userId: string) {
    const { error } = await supabase
      .from('script_history')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting records:', error);
      throw error;
    }
  },

  // 获取统计信息
  async getStats(userId: string) {
    const { data, error } = await supabase
      .from('script_history')
      .select('task_type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching stats:', error);
      return {};
    }

    // 统计各类型数量
    const stats: Record<string, number> = {};
    data?.forEach(record => {
      stats[record.task_type] = (stats[record.task_type] || 0) + 1;
    });

    return stats;
  }
};
