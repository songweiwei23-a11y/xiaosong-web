'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Upload, RefreshCcw, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

interface PaymentConfig {
  payment_wechat_qrcode: { url: string | null; enabled: boolean };
  payment_alipay_qrcode: { url: string | null; enabled: boolean };
  payment_config: { enabled: boolean; manual_confirm: boolean };
}

export default function AdminQRCodesPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'wechat' | 'alipay' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_payment_config');
      if (error) throw error;
      
      setConfig(data as any);
    } catch (error: any) {
      console.error('加载配置失败:', error);
      setMessage('加载配置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (type: 'wechat' | 'alipay', file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage('请上传图片文件');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUploading(type);
    setMessage('');
    
    try {
      // 1. 上传到Storage
      const fileName = `${type}_${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-qrcodes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

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

      setMessage(`✅ ${type === 'wechat' ? '微信' : '支付宝'}二维码上传成功`);
      await loadConfig();
    } catch (error: any) {
      console.error('上传失败:', error);
      setMessage(`❌ 上传失败: ${error.message}`);
    } finally {
      setUploading(null);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">收款二维码管理</h1>
          <p className="text-muted-foreground mt-1">上传和管理支付宝、微信收款二维码</p>
        </div>
        <Button onClick={loadConfig} variant="outline" size="sm" disabled={loading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.includes('✅') 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* 微信收款码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">💚</span>
              微信支付
            </CardTitle>
            <CardDescription>
              {config?.payment_wechat_qrcode?.enabled ? '✅ 已启用' : '⚠️ 未启用'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config?.payment_wechat_qrcode?.url ? (
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border-2 border-border">
                <Image 
                  src={config.payment_wechat_qrcode.url} 
                  alt="微信收款码"
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center text-muted-foreground">
                  <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无二维码</p>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="upload-wechat">
                {config?.payment_wechat_qrcode?.url ? '更换微信收款码' : '上传微信收款码'}
              </Label>
              <Input
                id="upload-wechat"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('wechat', file);
                }}
                disabled={uploading === 'wechat'}
                className="mt-2"
              />
              {uploading === 'wechat' && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  上传中...
                </p>
              )}
            </div>

            {config?.payment_wechat_qrcode?.url && (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4 mr-2" />
                该收款码已生效，用户可见
              </div>
            )}
          </CardContent>
        </Card>

        {/* 支付宝收款码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">💙</span>
              支付宝
            </CardTitle>
            <CardDescription>
              {config?.payment_alipay_qrcode?.enabled ? '✅ 已启用' : '⚠️ 未启用'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config?.payment_alipay_qrcode?.url ? (
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border-2 border-border">
                <Image 
                  src={config.payment_alipay_qrcode.url} 
                  alt="支付宝收款码"
                  fill
                  className="object-contain p-4"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center text-muted-foreground">
                  <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无二维码</p>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="upload-alipay">
                {config?.payment_alipay_qrcode?.url ? '更换支付宝收款码' : '上传支付宝收款码'}
              </Label>
              <Input
                id="upload-alipay"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('alipay', file);
                }}
                disabled={uploading === 'alipay'}
                className="mt-2"
              />
              {uploading === 'alipay' && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  上传中...
                </p>
              )}
            </div>

            {config?.payment_alipay_qrcode?.url && (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4 mr-2" />
                该收款码已生效，用户可见
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-blue-600 dark:text-blue-400">💡 使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. 从支付宝和微信分别导出您的收款二维码图片</p>
          <p>2. 点击上方"上传二维码"按钮，选择对应的图片</p>
          <p>3. 上传成功后，用户在支付页面就能看到您的收款码</p>
          <p>4. 用户扫码支付后会上传支付凭证，您可以在"订单审核"页面进行审核</p>
          <p className="text-orange-600 dark:text-orange-400 font-semibold pt-2">
            ⚠️ 请确保二维码清晰可见，否则用户无法成功支付
          </p>
        </CardContent>
      </Card>
    </div>
  );
}