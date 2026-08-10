"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { notify } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Upload, RefreshCcw, Check } from "lucide-react";

interface QRCode {
  id: string;
  payment_method: string;
  qrcode_url: string;
  is_active: boolean;
  updated_at: string;
}

export default function AdminQRCodesPage() {
  
  const [qrcodes, setQrcodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    loadQRCodes();
  }, []);

  const loadQRCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_qrcodes")
        .select("*")
        .order("payment_method");

      if (error) throw error;
      setQrcodes(data || []);
    } catch (error: any) {
      notify("加载失败: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (method: string, file: File) => {
    try {
      setUploading(method);

      const fileExt = file.name.split(".").pop();
      const fileName = `qrcode-${method}-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-qrcodes")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-qrcodes")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("payment_qrcodes")
        .update({
          qrcode_url: urlData.publicUrl,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq("payment_method", method);

      if (updateError) throw updateError;

      notify("二维码上传成功");
      loadQRCodes();
    } catch (error: any) {
      notify("上传失败: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">收款二维码管理</h1>
          <p className="text-muted-foreground mt-1">上传和管理支付宝、微信收款二维码</p>
        </div>
        <Button onClick={loadQRCodes} variant="outline" size="sm">
          <RefreshCcw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {qrcodes.map((qr) => (
            <Card key={qr.id}>
              <CardHeader>
                <CardTitle>
                  {qr.payment_method === "alipay" ? "支付宝" : "微信支付"}
                </CardTitle>
                <CardDescription>
                  {qr.is_active ? "✅ 已启用" : "⚠️ 未启用"}
                  {qr.updated_at && ` · 更新于 ${new Date(qr.updated_at).toLocaleString("zh-CN")}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {qr.qrcode_url && !qr.qrcode_url.includes("placeholder") && (
                  <div className="relative w-full h-64 bg-muted rounded-md overflow-hidden">
                    <Image 
                      src={qr.qrcode_url} 
                      alt={`${qr.payment_method} 二维码`}
                      fill
                      className="object-contain p-4"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor={`upload-${qr.payment_method}`}>
                    {qr.qrcode_url && !qr.qrcode_url.includes("placeholder") ? "更换二维码" : "上传二维码"}
                  </Label>
                  <Input
                    id={`upload-${qr.payment_method}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUpload(qr.payment_method, file);
                      }
                    }}
                    disabled={uploading === qr.payment_method}
                    className="mt-2"
                  />
                  {uploading === qr.payment_method && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-center">
                      <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                      上传中...
                    </p>
                  )}
                </div>

                {qr.is_active && qr.qrcode_url && !qr.qrcode_url.includes("placeholder") && (
                  <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4 mr-2" />
                    该收款码已生效，用户可见
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-600 dark:text-blue-400">💡 使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. 从支付宝和微信分别导出您的收款二维码图片</p>
          <p>2. 点击上方"上传二维码"按钮，选择对应的图片</p>
          <p>3. 上传成功后，用户在支付页面就能看到您的收款码</p>
          <p>4. 用户扫码支付后会上传支付凭证，您可以在"订单审核"页面进行审核</p>
          <p className="text-orange-600 dark:text-orange-400 font-semibold">
            ⚠️ 请确保二维码清晰可见，否则用户无法成功支付
          </p>
        </CardContent>
      </Card>
    </div>
  );
}