import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 整改 A2：标题页、分镜页的快速模式。
 * 快速模式下，隐藏的输入不能悄悄带进请求（否则「快速」其实还是按旧输入生成）。
 * 这里锁住请求里用到的变量，改回去就红。
 */
// 源文件在 Windows 上是 CRLF，统一成 LF 再比对，免得断言只在某个平台通过
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\r\n/g, '\n');

describe('标题、分镜快速模式（整改 A2）', () => {
  it('标题页：快速模式下人群、标题类型用默认值，请求和历史记录里都是这两个变量', () => {
    const code = read('app/dashboard/title/page.tsx');
    expect(code).toContain('const quickAudience = quickMode ? "" : targetAudience;');
    expect(code).toContain('const quickTitleType = quickMode ? "auto" : titleType;');
    expect(code).toContain('targetAudience: quickAudience');
    expect(code).toContain('titleType: quickTitleType');
    expect(code).toContain('audience: quickMode ? "" : targetAudience');
  });

  it('标题页：隐藏的「目标人群」「标题风格」整段用 !quickMode 包住', () => {
    const code = read('app/dashboard/title/page.tsx');
    expect(code).toContain('{!quickMode && (\n          <CollapsibleSection title="标题风格"');
    expect(code).toContain('{!quickMode && (\n              <Field label="目标人群"');
  });

  it('分镜页：快速模式下内容类型、视觉风格、补充说明用默认值，请求和历史记录里都是这些变量', () => {
    const code = read('app/dashboard/storyboard/page.tsx');
    expect(code).toContain('const quickContentType = quickMode ? "auto" : contentType;');
    expect(code).toContain('const quickVisualStyle = quickMode ? "cinematic" : visualStyle;');
    expect(code).toContain('const quickAdditional = quickMode ? "" : additionalInfo;');
    expect(code).toContain('contentType: quickContentType,');
    expect(code).toContain('additionalInfo: quickAdditional');
  });

  it('分镜页：三块隐藏内容整段用 !quickMode 包住', () => {
    const code = read('app/dashboard/storyboard/page.tsx');
    expect(code).toContain('{!quickMode && (\n            <Field label="内容类型"');
    expect(code).toContain('{!quickMode && (\n            <Field label="视觉风格"');
    expect(code).toContain('{!quickMode && (\n          <CollapsibleSection title="补充说明"');
  });
});
