'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { postSafely } from '@/lib/safe-post';

export default function SearchKeyPage() {
  const [status, setStatus] = useState<{ configured: boolean; verifiedAt?: string; tableMissing?: boolean } | null>(null);
  const [apiKey, setApiKey] = useState(''), [endpoint, setEndpoint] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const secureEntry = useSyncExternalStore(() => () => {}, () => location.protocol === 'https:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname), () => false);
  useEffect(() => { void fetch('/api/admin/search-key').then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setStatus(d); }).catch(e => setError(e.message)); }, []);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const r = await postSafely('/api/admin/search-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, endpoint: endpoint || undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || '验证失败');
      setStatus(d); setApiKey('');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-8">
    <h1 className="text-2xl font-bold">联网搜索密钥</h1>
    <p className="text-sm text-slate-400">用于深度研究逐题搜索。普通对话的联网仍使用 Dify 中的现有配置。</p>
    {!secureEntry && <p className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-400">当前网站入口使用HTTP，请通过本机项目中的 scripts/安全配置研究搜索.ps1 配置现有密钥；脚本经SSH验证并加密保存。启用HTTPS后可在本页直接配置。</p>}
    <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <p className="flex items-center gap-2 text-sm">{status?.configured ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" />已配置{status.verifiedAt ? ` · 上次验证：${new Date(status.verifiedAt).toLocaleString('zh-CN')}` : ''}</> : '尚未配置'}</p>
      <label className="block text-sm">阿里云 API Key<input disabled={!secureEntry} type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" placeholder="粘贴现有阿里云搜索密钥" /></label>
      <label className="block text-sm">服务地址（可选）<input value={endpoint} onChange={e => setEndpoint(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" placeholder="留空使用当前开物阿里云搜索地址" /></label>
      <p className="flex gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0" />先执行一次 Lite 搜索验证，成功才加密保存；页面不回显密钥。验证会产生一次搜索调用。</p>
      {status?.tableMissing && <p className="text-sm text-amber-400">需先执行深度研究数据库迁移。</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button onClick={save} disabled={!secureEntry || busy || !apiKey.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}验证并保存</button>
    </section>
  </main>;
}
