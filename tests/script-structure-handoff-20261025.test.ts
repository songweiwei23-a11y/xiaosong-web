import { describe, expect, it } from 'vitest';
import { FOUR_SCRIPT_CHOICES, fourScriptOfStructure, resolveCreationSettings, settingsFromText, structureName } from '@/lib/creation-settings';
import { SCRIPT_STRUCTURE_NAMES } from '@/lib/tactic-mix';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';

describe('四大脚本的 7 种结构', () => {
  it('每个名字都映射到脚本类型和结构 id，脚本页的卡片才能点', () => {
    expect(FOUR_SCRIPT_CHOICES.map(c => [c.name, c.scriptType, c.structure])).toEqual([
      ['晒过程·火车节', 'show', 'train'],
      ['晒过程·观察型', 'show', 'observe'],
      ['教知识·解题型', 'teach', 'problem'],
      ['教知识·推荐型', 'teach', 'recommend'],
      ['教知识·案例型', 'teach', 'case'],
      ['讲故事·故事型', 'story', 'story'],
      ['聊观点·论证型', 'discuss', 'argue'],
    ]);
    expect(FOUR_SCRIPT_CHOICES).toHaveLength(SCRIPT_STRUCTURE_NAMES.length);
  });

  it('结构 id 能认回四大脚本；旧结构和 AI 推荐不算', () => {
    expect(fourScriptOfStructure('argue')?.name).toBe('聊观点·论证型');
    expect(fourScriptOfStructure('expose')).toBeUndefined();
    expect(fourScriptOfStructure('auto')).toBeUndefined();
  });

  it('显示名：四大脚本带类型前缀，AI 推荐为空', () => {
    expect(structureName('train')).toBe('晒过程·火车节');
    expect(structureName('expose')).toBe('揭秘型');
    expect(structureName('auto')).toBe('');
    expect(structureName(undefined)).toBe('');
  });
});

describe('从别的板块带过来时，脚本类型、结构、拍法认得出来', () => {
  it('内容类型写「聊观点·论证型」时，脚本类型也认成聊观点（原来丢了）', () => {
    expect(settingsFromText('- **内容类型**：聊观点·论证型')).toMatchObject({ scriptType: 'discuss', structure: 'argue' });
  });

  it('内容类型写 36 计、讲法写四大脚本的类型：计名、脚本类型都带过来，结构不瞎猜', () => {
    const body = [
      '### 方向1：一个让人一看就懂的名字',
      '- **视频目的**：人设型 — 讲经历',
      '- **内容类型**：36计·第1计 反向操作',
      '- **讲法**：晒过程——先说明本次实际预算，再选衣、试穿、逐件列价。',
    ].join('\n');
    expect(settingsFromText(body)).toMatchObject({ tactic: '反向操作', scriptType: 'show' });
    expect(settingsFromText(body).structure).toBeUndefined();
  });

  it('讲法写了完整的四大脚本名字，结构也带过来', () => {
    const body = '- **内容类型**：36计·第7计 一句话设定故事感\n- **讲法**：教知识·解题型——从一个具体难题切入。';
    expect(settingsFromText(body)).toMatchObject({ tactic: '一句话设定故事感', scriptType: 'teach', structure: 'problem' });
  });

  it('内容类型写的是四大脚本时，不会误认成 36 计', () => {
    const s = settingsFromText('- **内容类型**：晒过程·火车节');
    expect(s).toMatchObject({ scriptType: 'show', structure: 'train' });
    expect(s.tactic).toBeUndefined();
  });

  it('跳转时（创作方向的整条）计名、类型、结构一起进到脚本设置里', () => {
    const block = [
      '### 方向2：门店试穿过程',
      '- **视频目的**：变现型',
      '- **内容类型**：36计·第10计 情境还原',
      '- **讲法**：晒过程——先选衣，再试穿，最后列价。',
    ].join('\n');
    const settings = resolveCreationSettings({ from: '创作方向', sourceContent: block });
    expect(settings).toMatchObject({ tactic: '情境还原', scriptType: 'show' });
    expect(GROWTH_TACTICS.some(t => t.name === settings.tactic)).toBe(true);
  });
});
