/**
 * 采访模板的触发（2026-10-30）：只在采访是这条内容的主要做法时启用。
 *
 * 线上现象：聊观点的脚本，原始想法里只顺带写了一句「顺便采访两位老顾客」，整条就被改写成采访稿，
 * 出镜人开始用「你」去问自己，观众分不清说话的是谁、问的是谁。
 * 守的是：顺带提到不启用；真正做采访的照常启用，并写清角色（出镜人是主持人、受访者只说自己的话）。
 */
import { describe, expect, it } from 'vitest';
import { creativeCraftRules } from '@/lib/creative-craft';

const INTERVIEW_BLOCK = '【采访落地】';
const ROLE_RULE = '角色分清：出镜人是主持人';

describe('顺带提到采访：不启用采访模板（聊观点照原结构写）', () => {
  it('「顺便采访两位老顾客」不启用，只记下来、不写进脚本', () => {
    const rules = creativeCraftRules({ intent: '聊观点：川菜最不能省的是炒前准备。顺便采访两位老顾客，问他们吃川菜时最在意什么。' });
    expect(rules).not.toContain(INTERVIEW_BLOCK);
    expect(rules).not.toContain(ROLE_RULE);
    expect(rules).toContain('【顺带提到的采访】');
    expect(rules).toContain('脚本正文不写采访段、主问、追问、受访者回答占位');
    expect(rules).toContain('只在第4步执行建议里记一笔');
  });

  it('「另外问问老板」不启用', () => {
    const rules = creativeCraftRules({ intent: '讲讲我对火候的看法，另外问问老板的意见。' });
    expect(rules).not.toContain(INTERVIEW_BLOCK);
  });
});

describe('真正做采访：照常启用，并写清角色', () => {
  it('采访是主要做法：启用，且写了角色分清', () => {
    const rules = creativeCraftRules({ intent: '采访两家店主，做成采访视频，问他们生意最在意什么。' });
    expect(rules).toContain(INTERVIEW_BLOCK);
    expect(rules).toContain(ROLE_RULE);
    expect(rules).toContain('「你」指受访者本人');
  });

  it('已有采访摘要、按记录写视频：启用', () => {
    const rules = creativeCraftRules({ intent: '采访两家店主，已有真实采访摘要，按记录写视频。' });
    expect(rules).toContain(INTERVIEW_BLOCK);
  });
});

describe('明确不做采访：不启用（原有行为不变）', () => {
  it('「不要采访」不启用', () => {
    const rules = creativeCraftRules({ intent: '用样柜演示开合空间，不要采访。' });
    expect(rules).not.toContain(INTERVIEW_BLOCK);
  });
});
