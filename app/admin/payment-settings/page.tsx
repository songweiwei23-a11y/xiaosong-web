'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Upload, Image as ImageIcon, Check, X, Loader2 } from 'lucide-react';

interface PaymentConfig {
  wechat_qrcode: { url: string | null; enabled: boolean };
  alipay_qrcode: { url: string | null; enabled: boolean };
  payment_config: { enabled: boolean; manual_confirm: boolean };
}

export default function PaymentSettingsPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'wechat' | 'alipay' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase.rpc('get_payment_config');
      if (error) throw error;
      
      setConfig(data as any);
    } catch (error) {
      console.error('加载配置失败:', error);
      setMessage('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (type: 'wechat' | 'alipay', file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage('请上传图片文件');
      return;
    }

    setUploading(type);
    try {
      // 1. 上传到Storage
      const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-qrcodes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. 获取公开URL
      const { data: urlData } = supabase.storage
        .from('payment-qrcodes')
        .getPublicUrl(fileName);

      // 3. 更新数据库
      const { error: updateError } = await supabase.rpc('update_payment_qrcode', {
        p_payment_type: type,
        p_qrcode_url: urlData.publicUrl
      });

      if (updateError) throw updateError;

      setMessage(`${type === 'wechat' ? '微信' : '支付宝'}二维码上传成功`);
      loadConfig();
    } catch (error: any) {
      console.error('上传失败:', error);
      setMessage(`上传失败: ${error.message}`);
    } finally {
      setUploading(null);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          收款设置
        </h1>

        {message && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-300">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 微信收款码 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              微信收款码
            </h2>
            
            {config?.wechat_qrcode?.url ? (
              <div className="space-y-4">
                <img 
                  src={config.wechat_qrcode.url} 
                  alt="微信收款码"
                  className="w-full max-w-sm mx-auto rounded-lg border-2 border-gray-200 dark:border-slate-700"
                />
                <label className="block">
                  <span className="sr-only">更换微信收款码</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUpload('wechat', e.target.files[0])}
                    disabled={uploading === 'wechat'}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">点击上传微信收款码</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleUpload('wechat', e.target.files[0])}
                  disabled={uploading === 'wechat'}
                  className="hidden"
                />
              </label>
            )}
            
            {uploading === 'wechat' && (
              <div className="mt-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">上传中...</span>
              </div>
            )}
          </div>

          {/* 支付宝收款码 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              支付宝收款码
            </h2>
            
            {config?.alipay_qrcode?.url ? (
              <div className="space-y-4">
                <img 
                  src={config.alipay_qrcode.url} 
                  alt="支付宝收款码"
                  className="w-full max-w-sm mx-auto rounded-lg border-2 border-gray-200 dark:border-slate-700"
                />
                <label className="block">
                  <span className="sr-only">更换支付宝收款码</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUpload('alipay', e.target.files[0])}
                    disabled={uploading === 'alipay'}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">点击上传支付宝收款码</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleUpload('alipay', e.target.files[0])}
                  disabled={uploading === 'alipay'}
                  className="hidden"
                />
              </label>
            )}
            
            {uploading === 'alipay' && (
              <div className="mt-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">上传中...</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            💡 提示：上传的二维码将显示在用户的付费页面，用户扫码付款后需要管理员手动确认。
          </p>
        </div>
      </div>
    </div>
  );
}