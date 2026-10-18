import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_FRAMEWORK,
  BENCHMARK_LIMITS,
  buildBenchmarkQuery,
  checkMaterials,
  classifyMaterial,
  summarizeMaterials,
} from '@/lib/benchmark-analysis';

describe('对标拆解：材料分类（整改 C · 对标拆解）', () => {
  it('截图只收 JPG、PNG、WebP；GIF、HEIC 认不了', () => {
    expect(classifyMaterial('主页.jpg', 'image/jpeg')).toBe('image');
    expect(classifyMaterial('主页.png', 'image/png')).toBe('image');
    expect(classifyMaterial('主页.png', '')).toBe('image');
    expect(classifyMaterial('动图.gif', 'image/gif')).toBe('unsupported');
    expect(classifyMaterial('相册.heic', 'image/heic')).toBe('unsupported');
  });

  it('视频：按类型或后缀认', () => {
    expect(classifyMaterial('录屏.mp4', 'video/mp4')).toBe('video');
    expect(classifyMaterial('录屏.mov', '')).toBe('video');
  });

  it('文档：TXT、Word、Excel、PPT、CSV 都能读', () => {
    expect(classifyMaterial('简介.txt', 'text/plain')).toBe('document');
    expect(classifyMaterial('简介.docx', '')).toBe('document');
    expect(classifyMaterial('数据.xlsx', '')).toBe('document');
    expect(classifyMaterial('数据.csv', 'text/csv')).toBe('document');
  });

  it('其它类型直接告诉编导，不假装读了', () => {
    expect(classifyMaterial('程序.exe', 'application/octet-stream')).toBe('unsupported');
  });
});

describe('对标拆解：数量和大小的限制', () => {
  const img = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `图${i}.jpg`, type: 'image/jpeg', size: 1000 }));
  const doc = (n: number, size = 1000) => Array.from({ length: n }, (_, i) => ({ name: `文${i}.txt`, type: 'text/plain', size }));
  const vid = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `视${i}.mp4`, type: 'video/mp4', size: 1000 }));

  it('没有材料：不报错（由组件检查「至少放一份或写几句」）', () => {
    expect(checkMaterials([])).toBeNull();
  });

  it('截图最多 9 张', () => {
    expect(checkMaterials(img(BENCHMARK_LIMITS.images))).toBeNull();
    expect(checkMaterials(img(BENCHMARK_LIMITS.images + 1))).toMatch(/截图最多 9 张/);
  });

  it('文档最多 3 个；单个文档不超过 10MB', () => {
    expect(checkMaterials(doc(3))).toBeNull();
    expect(checkMaterials(doc(4))).toMatch(/文档最多 3 个/);
    expect(checkMaterials(doc(1, 11 * 1024 * 1024))).toMatch(/超过 10MB/);
  });

  it('视频最多 2 个；超过 3 分钟的只拆前 3 分钟（提示写在限制里）', () => {
    expect(checkMaterials(vid(2))).toBeNull();
    expect(checkMaterials(vid(3))).toMatch(/视频最多 2 个/);
  });

  it('不认的类型：报错时告诉编导用什么格式', () => {
    const msg = checkMaterials([{ name: '动图.gif', type: 'image/gif', size: 1000 }]);
    expect(msg).toMatch(/JPG 或 PNG/);
  });

  it('总数不超过 12 个', () => {
    expect(checkMaterials([...img(9), ...doc(3)])).toBeNull();
    expect(checkMaterials([...img(9), ...doc(3), ...vid(1)])).toMatch(/最多 12 个/);
  });
});

describe('对标拆解：「读到了什么」', () => {
  it('截图、文字、视频各说一句，视频没口播要说清楚', () => {
    const lines = summarizeMaterials({
      images: 3,
      texts: [{ name: '编导粘贴的文字', chars: 120 }],
      videos: [{ name: '录屏.mp4', frames: 18, speechChars: 0, truncated: true }],
    });
    expect(lines[0]).toBe('截图 3 张');
    expect(lines[1]).toContain('约 120 字');
    expect(lines[2]).toContain('抽了 18 张画面');
    expect(lines[2]).toContain('没识别出口播');
    expect(lines[2]).toContain('只拆了前 3 分钟');
  });

  it('什么都没有：说没有材料', () => {
    expect(summarizeMaterials({ images: 0, texts: [], videos: [] })).toEqual(['没有提供材料']);
  });
});

describe('对标拆解：提示词的框架和依据规则', () => {
  const query = buildBenchmarkQuery({
    accountName: '测试对标',
    platform: '抖音',
    materialLines: ['截图 2 张'],
    materialText: '【编导粘贴的文字】\n主页简介：一元串串',
    contextBlock: '## 📇 账号背景：我的号',
  });

  it('固定框架按顺序出现：材料清单、账号定位、内容拆解、对我们的参考、待核实', () => {
    const order = ['### 一、材料清单', '### 二、账号定位拆解', '### 三、内容拆解', '### 四、对我们的参考', '### 五、待核实'];
    let last = -1;
    for (const h of order) {
      const at = query.indexOf(h);
      expect(at, h).toBeGreaterThan(last);
      last = at;
    }
    expect(BENCHMARK_FRAMEWORK).toContain('### 二、账号定位拆解');
  });

  it('带上对标账号、材料清单、文字资料，和我们的背景', () => {
    expect(query).toContain('测试对标（抖音）');
    expect(query).toContain('- 截图 2 张');
    expect(query).toContain('主页简介：一元串串');
    expect(query).toContain('我的号');
  });

  it('写明依据和不编造的规则：没依据写【待核实】，样本少要注明，不照抄原话', () => {
    expect(query).toContain('【待核实】');
    expect(query).toContain('样本不足，仅供参考');
    expect(query).toContain('最多 15 个字');
  });

  it('没有档案、没有文字、没有平台：也能生成，并说明缺什么', () => {
    const q = buildBenchmarkQuery({ accountName: 'x', platform: null, materialLines: ['没有提供材料'], materialText: '', contextBlock: '' });
    expect(q).toContain('平台未填');
    expect(q).toContain('只有截图或视频');
    expect(q).toContain('还没有账号档案');
  });
});
