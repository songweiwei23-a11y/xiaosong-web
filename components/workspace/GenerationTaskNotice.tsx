import { generationStageLabel } from '@/lib/sse-stream';
import type { useGenerationTask } from '@/hooks/useGenerationTask';

const labels: Record<string, string> = {
  accepted: '任务已提交', generating: '正在生成正文', draft_saved: '草稿已保存',
  post_processing: '正在处理草稿', completed: '最终稿已保存',
  partial_saved: '部分内容已保存', recoverable_failed: '处理已中断', permanent_failed: '生成失败',
};

export function GenerationTaskNotice({ state }: { state: ReturnType<typeof useGenerationTask> }) {
  const { task, taskError } = state;
  if (!task && !taskError) return null;
  return (
    <div role="status" className="my-2 text-sm text-muted-foreground">
      {taskError || task?.error_message || (task?.status === 'post_processing' ? generationStageLabel(task.stage) : labels[task?.status || '']) || '任务已提交'}
      {(taskError || task?.status === 'recoverable_failed' || task?.status === 'partial_saved') && (
        <button type="button" className="ml-2 underline" onClick={() => void state.restoreLastTask()}>重新读取已存版本</button>
      )}
    </div>
  );
}
