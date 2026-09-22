"use client";

import { useState, useEffect } from "react";
import { History, X, Trash2, Clock, Copy, RefreshCw } from "lucide-react";
import { generationHistoryService } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import { notify, confirmDialog } from '@/components/ui/feedback';

interface HistoryRecord {
  id: string;
  task_type: string;
  input_data: any;
  result: string;
  created_at: string;
}

interface HistoryPanelProps {
  userId: string;
  taskType: string;
  onReuse?: (inputData: any, result: string) => void;
}

export function HistoryPanel({ userId, taskType, onReuse }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isOpen && userId) {
      loadHistory();
    }
  }, [isOpen, userId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, count } = await generationHistoryService.getList(userId, taskType, 50);
      setRecords(data);
      setTotal(count);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog('确定删除这条记录吗?', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;
    
    try {
      await generationHistoryService.delete(id, userId);
      setRecords(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      notify('删除失败');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    notify('已复制到剪贴板');
  };

  const handleReuse = (record: HistoryRecord) => {
    if (onReuse) {
      onReuse(record.input_data, record.result);
      setIsOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* 历史记录按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-8 bottom-8 p-4 brand-gradient text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 z-50"
        title="查看历史记录"
      >
        <History className="w-6 h-6" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive/100 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* 历史记录面板 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">历史记录</h2>
                <span className="text-sm text-muted-foreground">({total}条)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadHistory}
                  className="p-2 hover:bg-foreground/[0.06] rounded-lg transition-colors"
                  title="刷新"
                >
                  <RefreshCw className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-foreground/[0.06] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex flex-1 overflow-hidden">
              {/* 左侧列表 */}
              <div className="w-1/3 border-r overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <History className="w-16 h-16 mb-4" />
                    <p>暂无历史记录</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                          selectedRecord?.id === record.id
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {formatDate(record.created_at)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(record.id);
                            }}
                            className="p-1 hover:bg-destructive/15 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                        <p className="text-sm text-foreground/80 line-clamp-2">
                          {record.result.substring(0, 100)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 右侧详情 */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedRecord ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">
                        生成于 {formatDate(selectedRecord.created_at)}
                      </div>
                      <div className="flex gap-2">
                        {onReuse && (
                          <button
                            onClick={() => handleReuse(selectedRecord)}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            重新使用
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(selectedRecord.result)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary transition-colors text-sm flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          复制
                        </button>
                      </div>
                    </div>
                    {/* dark:prose-invert 不能少：prose 会把正文写死成深灰，
                        深色主题下正文会淹没在背景里 */}
                    <div className="prose prose-sm dark:prose-invert max-w-none
                      prose-p:text-[14px] prose-p:leading-[1.8]
                      prose-strong:text-foreground prose-headings:text-foreground">
                      <ReactMarkdown>{selectedRecord.result}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>选择一条记录查看详情</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
