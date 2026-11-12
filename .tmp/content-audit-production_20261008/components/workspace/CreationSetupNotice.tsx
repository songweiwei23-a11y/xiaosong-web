import type { CreationSettings } from '@/lib/creation-settings';
import { SCRIPT_TYPE_LABELS } from '@/lib/creation-settings';

export function CreationSetupNotice({ settings, preparing }: { settings: CreationSettings; preparing: boolean }) {
  if (!settings.topic && !preparing) return null;
  return <div className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-[12px] leading-6" role="status">
    <p className="font-medium text-foreground">{preparing ? '正在承接原方案并配置创作选项…' : '已承接原方案并自动配置，可直接点击生成'}</p>
    {!preparing && <p className="text-muted-foreground">{[settings.purpose, settings.scriptType && SCRIPT_TYPE_LABELS[settings.scriptType], settings.platform, settings.duration, settings.audience].filter(Boolean).join(' · ')}</p>}
  </div>;
}
