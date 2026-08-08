"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { notify, confirmDialog } from '@/components/ui/feedback';

export default function AdminDebugPage() {
  const [debug, setDebug] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkEverything();
  }, []);

  const checkEverything = async () => {
    try {
      // 1. 获取当前会话
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setDebug({ error: "未登录" });
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      const userEmail = session.user.email;

      // 2. 检查 user_settings
      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      // 3. 调用检查API
      const checkResponse = await fetch(`/api/admin/check`);
      const checkData = await checkResponse.json();

      setDebug({
        userId,
        userEmail,
        settings,
        settingsError: settingsError?.message,
        apiCheck: checkData,
        hasIsAdminField: settings?.hasOwnProperty("is_admin"),
        isAdminValue: settings?.is_admin,
      });
    } catch (error: any) {
      setDebug({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const executeSQL = async () => {
    if (!await confirmDialog("确定要执行 SQL 添加 is_admin 字段吗？")) return;
    
    try {
      notify("此功能已下线：请在“权限管理”页面或数据库中设置管理员。");
    } catch (error: any) {
      notify("执行失败: " + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>加载中...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>🔍 管理员权限调试页面</h1>
      
      <div style={{ 
        background: "#f5f5f5", 
        padding: "20px", 
        borderRadius: "8px",
        marginTop: "20px"
      }}>
        <h2>当前用户信息</h2>
        <pre style={{ 
          background: "white", 
          padding: "15px", 
          borderRadius: "4px",
          overflow: "auto"
        }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>诊断结果</h2>
        {debug.error ? (
          <div style={{ color: "red", padding: "15px", background: "#fee" }}>
            ❌ 错误: {debug.error}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "10px" }}>
              ✅ 用户ID: <strong>{debug.userId}</strong>
            </div>
            <div style={{ marginBottom: "10px" }}>
              ✅ 邮箱: <strong>{debug.userEmail}</strong>
            </div>
            <div style={{ marginBottom: "10px" }}>
              {debug.settings ? (
                <>✅ user_settings 记录存在</>
              ) : (
                <>❌ user_settings 记录不存在</>
              )}
            </div>
            <div style={{ marginBottom: "10px" }}>
              {debug.hasIsAdminField ? (
                <>✅ is_admin 字段存在</>
              ) : (
                <>❌ is_admin 字段不存在</>
              )}
            </div>
            <div style={{ marginBottom: "10px" }}>
              {debug.isAdminValue ? (
                <span style={{ color: "green" }}>✅ is_admin = TRUE (你是管理员)</span>
              ) : (
                <span style={{ color: "red" }}>❌ is_admin = FALSE 或不存在</span>
              )}
            </div>
            <div style={{ marginBottom: "10px" }}>
              API检查结果: {debug.apiCheck?.isAdmin ? (
                <span style={{ color: "green" }}>✅ 通过</span>
              ) : (
                <span style={{ color: "red" }}>❌ 未通过</span>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>操作</h2>
        {!debug.hasIsAdminField && (
          <button 
            onClick={executeSQL}
            style={{
              padding: "15px 30px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px"
            }}
          >
            🔧 添加 is_admin 字段并设置权限
          </button>
        )}
        
        <button 
          onClick={() => window.location.href = "/admin"}
          style={{
            padding: "15px 30px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            marginLeft: "10px"
          }}
        >
          🎯 尝试进入管理后台
        </button>
        
        <button 
          onClick={checkEverything}
          style={{
            padding: "15px 30px",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            marginLeft: "10px"
          }}
        >
          🔄 刷新检查
        </button>
      </div>

      <div style={{ 
        marginTop: "30px",
        padding: "20px",
        background: "#fff3cd",
        borderRadius: "8px"
      }}>
        <h3>⚠️ 如果 is_admin 字段不存在</h3>
        <p>需要在 Supabase 中手动执行以下 SQL:</p>
        <pre style={{ 
          background: "white", 
          padding: "15px", 
          borderRadius: "4px",
          overflow: "auto"
        }}>
{`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
UPDATE user_settings SET is_admin = TRUE WHERE user_id = '${debug.userId}';
SELECT * FROM user_settings WHERE user_id = '${debug.userId}';`}
        </pre>
        <p>
          <a 
            href="https://supabase.com/dashboard/project/nxxbzdstmtuyplcwrrhs/editor"
            target="_blank"
            style={{ color: "#2196F3" }}
          >
            点击这里打开 Supabase SQL 编辑器
          </a>
        </p>
      </div>
    </div>
  );
}
