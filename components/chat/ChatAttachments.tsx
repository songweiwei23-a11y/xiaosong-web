"use client";

import { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, Loader2, X, Download } from 'lucide-react';
import { CHAT_FILE_ACCEPT, MAX_CHAT_FILES, MAX_CHAT_FILE_BYTES, chatFileType, chatFileUrl, chatFileSize, sanitizeAttachments, type ChatAttachment } from '@/lib/chat-attachments';
import { throwApiError } from '@/lib/api-error';
import { prepareVisionImage } from '@/lib/chat-image-upload';

export function AttachmentList({ files, onRemove }: { files: ChatAttachment[]; onRemove?: (file: ChatAttachment) => void }) {
  if (!files.length) return null;
  return <div className="mb-2 flex flex-wrap gap-2">
    {files.map(file => <div key={file.storagePath} className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-background/50 p-2 text-xs">
      {file.type === 'image'
        ? <a href={chatFileUrl(file, true)} title={`下载 ${file.name}`}><img src={chatFileUrl(file)} alt={file.name} className="h-12 w-12 rounded object-cover" /></a>
        : <FileText className="h-5 w-5 shrink-0 text-primary" />}
      <div className="min-w-0"><span className="block max-w-44 truncate" title={file.name}>{file.name}</span><span className="text-muted-foreground">{chatFileSize(file.size)}</span></div>
      {onRemove ? <button type="button" aria-label={`移除 ${file.name}`} onClick={() => onRemove(file)} className="p-1"><X className="h-4 w-4" /></button>
        : <a href={chatFileUrl(file, true)} aria-label={`下载 ${file.name}`} className="p-1"><Download className="h-4 w-4" /></a>}
    </div>)}
  </div>;
}

/** 独立草稿作用域由父级 key 决定，切换档案/会话会取消旧上传。 */
export function AttachmentComposer({ files, onChange, onBusy, disabled }: {
  files: ChatAttachment[]; onChange: (files: ChatAttachment[]) => void;
  onBusy: (busy: boolean) => void; disabled: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const current = useRef(files);
  current.current = files;
  const live = useRef(true);
  const pending = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; controllers.current.forEach(c => c.abort()); onBusy(false); };
  }, [onBusy]);

  const upload = async (selected: File[]) => {
    if (disabled || !selected.length) return;
    setError('');
    if (selected.length + current.current.length + pending.current > MAX_CHAT_FILES) {
      setError(`每条消息最多 ${MAX_CHAT_FILES} 个文件`); return;
    }
    if (selected.some(f => !chatFileType(f.name) || !f.size || f.size > MAX_CHAT_FILE_BYTES)) {
      setError('请选择支持的图片或文档，每个文件不能超过 10 MB；旧版 Office 文件请另存为新格式。'); return;
    }
    pending.current += selected.length;
    setUploading(true); onBusy(true);
    let next = 0;
    const worker = async () => {
    while (next < selected.length && live.current) {
      const file = selected[next++];
      const controller = new AbortController();
      controllers.current.add(controller);
      const timer = setTimeout(() => controller.abort(), 100_000);
      try {
        const form = new FormData(); form.append('file', file);
        if (chatFileType(file.name) === 'image') form.append('vision', await prepareVisionImage(file), 'vision.jpg');
        if (!live.current) continue;
        const res = await fetch('/api/chat-files', { method: 'POST', body: form, signal: controller.signal });
        if (!res.ok) await throwApiError(res, '文件上传失败');
        const attachment = sanitizeAttachments([await res.json()])[0];
        if (!attachment) throw new Error('文件上传返回的信息不完整，请重试');
        if (live.current) {
          current.current = [...current.current, attachment];
          onChange(current.current);
        }
      } catch (e) {
        if (live.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '文件上传超时，请重试');
      } finally {
        clearTimeout(timer); controllers.current.delete(controller); pending.current -= 1;
      }
    }
    };
    // 三个上传通道缩短多附件等待，避免一次解码六张大图。
    await Promise.all(Array.from({ length: Math.min(3, selected.length) }, () => worker()));
    if (live.current && pending.current === 0) { setUploading(false); onBusy(false); }
  };

  return <div className="mx-auto mb-2 max-w-3xl"
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
    onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); } }}>
    <AttachmentList files={files} onRemove={disabled ? undefined : file => {
      current.current = current.current.filter(f => f.storagePath !== file.storagePath); onChange(current.current);
    }} />
    <input ref={picker} type="file" accept={CHAT_FILE_ACCEPT} multiple className="hidden" aria-label="选择图片或文档"
      onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void upload(selected); }} />
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <button type="button" disabled={disabled || uploading || files.length >= MAX_CHAT_FILES}
        onClick={() => picker.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {uploading ? '正在上传…' : '上传图片 / 文件'}
      </button>
      <span>PDF、Word、Excel、PPT、文本和图片 · 每个 10 MB · 最多 6 个 · 可拖到这里</span>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </div>;
}
