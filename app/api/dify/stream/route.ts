import { NextRequest } from 'next/server';
import { saveConversationMessage, getConversationHistory, formatConversationHistory } from '@/lib/conversation';
import { requireUserWithQuota, incrementUsageServer } from '@/lib/api-guard';

export const maxDuration = 60;
export const runtime = 'nodejs';

// 将任务类型映射到功能代码
function getFeatureFromTaskType(taskType: string): string {
  const mapping: Record<string, string> = {
    '脚本生成': 'script',
    '选题策划': 'topic',
    '分镜脚本': 'storyboard',
    '审稿优化': 'review',
    '标题封面': 'title',
    '账号定位': 'positioning',
    '成交理由': 'dealReason',
    '自由对话': 'freeChat',
    '知识库': 'knowledge'
  };
  return mapping[taskType] || 'script'; // 默认为script
}


export async function POST(req: NextRequest) {
  try {
    const guard = await requireUserWithQuota();
    if (!guard.ok) return guard.response!;

    const body = await req.json();
    const { sessionId, saveHistory } = body;
    let query = '';

    // 原始用户输入必须在任何改写之前固定下来。
    // 之前只在“已有历史”分支里赋值，导致会话首轮的用户消息永远不入库，
    // 对话记忆无法从第一轮开始累积。
    const originalQuery: string = body.query || '';

    // 如果需要对话记忆，加载历史对话
    if (sessionId && saveHistory) {
      console.log('🔍 加载对话历史，Session ID:', sessionId);
      const history = await getConversationHistory(sessionId, 5); // 最近5轮对话
      if (history.length > 0) {
        console.log(`📚 找到 ${history.length} 条历史消息`);
        const formattedHistory = formatConversationHistory(history);
        // 将历史对话拼到查询前面（自由问答类分支会直接读取 body.query）
        body.query = formattedHistory + originalQuery;
      } else {
        console.log('📭 没有历史消息');
      }
    }
    
    // 爆款元素英文到中文的映射
    const elementMap: Record<string, string> = {
      'cost': '💰 成本',
      'people': '👥 人群',
      'celebrity': '⭐ 头牌',
      'weird': '🤪 奇葩',
      'worst': '👎 最差',
      'contrast': '⚡ 反差',
      'nostalgia': '📼 怀旧',
      'hormone': '🔥 荷尔蒙'
    };
    
    if (body.taskType === '选题策划') {
      const parts = ['我需要策划短视频选题'];
      if (body.accountStage) parts.push('账号阶段：' + body.accountStage);
      if (body.fansLevel) parts.push('粉丝量级：' + body.fansLevel);
      if (body.platforms) parts.push('平台：' + body.platforms);
      if (body.tracks) parts.push('赛道：' + body.tracks);
      if (body.contentTypes) parts.push('内容类型：' + body.contentTypes);
      if (body.styles) parts.push('风格：' + body.styles);

      // 账号定位补充说明（重要）
      if (body.positioningExtra && body.positioningExtra.trim()) {
        parts.push('');
        parts.push('## 账号定位补充说明');
        parts.push(body.positioningExtra);
        parts.push('');
        parts.push('【关键要求】生成的选题必须符合这个定位说明，不能偏离账号特色和目标！');
      }
      
      // 转换爆款元素为中文
      if (body.explosiveElements) {
        const elements = body.explosiveElements.split('、').map((e: string) => e.trim());
        const chineseElements = elements.map((e: string) => elementMap[e] || e).join('、');
        parts.push('爆款元素：' + chineseElements);
        parts.push('【重要】每条选题必须至少包含2-3个爆款元素，并在选题中明确标注使用了哪些元素');
      }
      
      if (body.topicCount) parts.push('生成' + body.topicCount + '条选题');
      if (body.difficulty) parts.push('难度：' + body.difficulty);


      // 成交理由（商家变现核心）
      if (body.dealReasons && body.dealReasons.trim()) {
        parts.push('');
        parts.push('## 成交理由（商家变现核心）');
        parts.push('成交理由：' + body.dealReasons);
        parts.push('');
        parts.push('【关键要求】每个选题的标题和内容必须明确体现这些成交理由！');
        parts.push('- 标题要直接包含成交理由的关键词');
        parts.push('- 内容方向要围绕成交理由设计拍摄重点');
        parts.push('- 例如：成交理由是"颜值高、性价比"');
        parts.push('  标题应该是：《人均30吃到撑！这家店装修超美、菜品颜值爆表》');
        parts.push('  而不是：《我用20块钱做了4个菜》');
      } else {
        parts.push('');
        parts.push('## 选题定位：纯流量选题（不涉及变现）');
        parts.push('专注话题性、猎奇性、情感共鸣，追热点做反差');
      }
      // 强制要求输出创作方向和拍摄思路
      parts.push('\n【输出要求】');
      parts.push('每条选题必须包含以下三部分：');
      parts.push('1. 选题标题（标注爆款元素）');
      parts.push('2. 内容创作方向：具体拍什么、讲什么、呈现什么价值点');
      parts.push('3. 编导拍摄思路：景别组合、运镜方式、情绪设计、开场钩子建议');
      
      query = parts.join('\n');
    } else if (body.taskType === '审稿优化') {
      // 审稿优化逻辑
      const parts = ['请帮我审稿并优化以下短视频脚本'];
      parts.push('\n## 脚本内容');
      parts.push(body.draftContent || '未提供脚本内容');
      
      parts.push('\n## 基本信息');
      if (body.platform) parts.push('平台：' + body.platform);
      if (body.duration) parts.push('时长：' + body.duration);
      if (body.scriptType) parts.push('类型：' + body.scriptType);
      
      if (body.reviewDimensions) {
        parts.push('\n## 审稿维度');
        parts.push(body.reviewDimensions);
      }
      
      if (body.optimizationGoals) {
        parts.push('\n## 优化目标');
        parts.push(body.optimizationGoals);
      }
      
      if (body.benchmarkScript) {
        parts.push('\n## 对标脚本');
        parts.push(body.benchmarkScript);
      }
      
      parts.push('\n## 输出要求');
      parts.push('1. 逐项分析审稿维度,给出具体问题和评分');
      parts.push('2. 提供可执行的优化建议');
      parts.push('3. 如有对标脚本,进行对比分析');
      
      query = parts.join('\n');
    } else if (body.taskType === '知识库查询') {
      // 知识库查询逻辑 - 前端已构建完整query
      query = body.topic || body.query || '请提供具体问题';
    } else if (body.taskType === '分镜脚本') {
      // 分镜脚本生成逻辑
      const parts = ['请为以下脚本生成专业分镜脚本'];
      parts.push('\n## 原始脚本');
      parts.push(body.scriptContent || '未提供脚本内容');
      
      parts.push('\n## 基本信息');
      if (body.platform) parts.push('平台：' + body.platform);
      if (body.duration) parts.push('时长：' + body.duration);
      if (body.contentType) parts.push('内容类型：' + body.contentType);
      if (body.visualStyle) parts.push('视觉风格：' + body.visualStyle);
      
      if (body.additionalInfo) {
        parts.push('\n## 补充信息');
        parts.push(body.additionalInfo);
      }
      
      parts.push('\n## 输出要求 - 必须严格按照以下格式');
      parts.push('');
      parts.push('第一步:输出标题');
      parts.push('# 🎬 分镜脚本表');
      parts.push('');
      parts.push('第二步:输出表格(必须使用markdown表格格式)');
      parts.push('| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |');
      parts.push('|------|------|------|----------|-----------|------|----------|');
      parts.push('| 1 | 特写🔍 | 固定 | 具体画面描述 | 具体台词或无 | 3s | 具体拍摄建议 |');
      parts.push('| 2 | ... | ... | ... | ... | ... | ... |');
      parts.push('(继续填写8-12个镜头,总时长=' + (body.duration || '60秒') + ')');
      parts.push('');
      parts.push('**景别说明**: 远景📷、全景🎥、中景📹、近景📸、特写🔍');
      parts.push('**运镜说明**: 固定、推镜、拉镜、摇镜、移镜、跟随');
      parts.push('');
      parts.push('## 📊 拍摄清单');
      parts.push('');
      parts.push('**景别组合**:');
      parts.push('- 特写: X个');
      parts.push('- 近景: X个');
      parts.push('- 中景: X个');
      parts.push('- 全景: X个');
      parts.push('');
      parts.push('**运镜统计**:');
      parts.push('- 固定镜头: X个(占X%)');
      parts.push('- 运动镜头: X个(占X%)');
      parts.push('');
      parts.push('**总时长**: 预计XXs(建议预留5-10s缓冲)');
      parts.push('');
      parts.push('## 💡 拍摄技巧');
      parts.push('');
      parts.push('**连拍建议**:');
      parts.push('- 镜头X-X可连续拍摄(同场景/同机位)');
      parts.push('');
      parts.push('**设备建议**:');
      parts.push('- 基础版: 手机+三脚架');
      parts.push('- 进阶版: 需要稳定器/补光灯等');
      parts.push('');
      parts.push('**注意事项**:');
      parts.push('- 列出3-5条具体的拍摄注意事项');
      parts.push('');
      parts.push('');
      parts.push('【格式要求 - 严格遵守】');
      parts.push('1. 第一行必须是: # 🎬 分镜脚本表');
      parts.push('2. 第二行空一行');
      parts.push('3. 第三行开始必须是markdown表格,包含表头和分割线');
      parts.push('4. 表格必须有6-7列: 镜号|景别|运镜|画面内容|台词/旁白|时长|拍摄要点');
      parts.push('5. 景别必须用emoji: 特写🔍、近景📸、中景📹、全景🎥、远景📷');
      parts.push('6. 时长必须是数字+单位(如"3s"、"5s"、"10s")');
      parts.push('7. 表格后面再输出"## 📊 拍摄清单"和"## 💡 拍摄技巧"');
      parts.push('');
      parts.push('【禁止事项】');
      parts.push('- 禁止输出纯文字描述');
      parts.push('- 禁止说"帮助你梳理脚本"等废话');
      parts.push('- 禁止问"你想要什么"');
      parts.push('- 必须直接输出表格,不要任何前言');
      
      query = parts.join('\n');
    } else if (body.taskType === '账号定位') {
      // 账号定位逻辑 - 支持两种模式
      const parts = ['请帮我进行短视频账号定位分析'];
      
      // 模式1: 基于用户档案（新版）
      if (body.profileInfo) {
        parts.push('\n## 📋 用户档案信息');
        parts.push(body.profileInfo);
        
        if (body.additionalNotes) {
          parts.push('\n## 💡 补充说明');
          parts.push(body.additionalNotes);
        }
      } 
      // 模式2: 传统表单模式（兼容旧版）
      else {
        if (body.personalInfo) {
          parts.push('\n## 个人背景');
          parts.push(body.personalInfo);
        }
        
        if (body.interests) {
          parts.push('\n## 兴趣特长');
          parts.push(body.interests);
        }
        
        if (body.targetAudience) {
          parts.push('\n## 目标人群');
          parts.push(body.targetAudience);
        }
        
        if (body.resources) {
          parts.push('\n## 现有资源');
          parts.push(body.resources);
        }
        
        if (body.monetizationGoal) {
          parts.push('\n## 变现目标');
          parts.push(body.monetizationGoal);
        }
        
        if (body.accountStage) {
          parts.push('\n## 账号阶段');
          parts.push(body.accountStage);
        }
        
        if (body.postingFrequency) {
          parts.push('\n## 发布频率');
          parts.push(body.postingFrequency);
        }
        
        if (body.additionalNotes) {
          parts.push('\n## 补充说明');
          parts.push(body.additionalNotes);
        }
      }
      
      parts.push('\n## 📋 输出要求');
        parts.push('');
        parts.push('⚠️ 核心原则：只输出选题策划需要的核心信息，去掉视觉、执行、时间规划等细节');
        parts.push('');
        parts.push('请按以下结构输出账号定位方案（总字数控制在1000字以内）：');
        parts.push('');
        parts.push('⚠️ 特别强调：');
        parts.push('- 必须结合抖音平台特性分析（算法偏好、用户习惯、流量分配）');
        parts.push('- 目标用户分析要基于抖音真实用户画像');
        parts.push('- 内容配比根据账号阶段动态调整（0-1万/1-5万/5万+粉配比不同）');
        parts.push('- 内容分为：流量型、人设型、变现型，一个内容可以同时具备多种属性');
        parts.push('- 拍摄方向只提供思路，不要写具体选题标题');
        parts.push('- 绝对不能出现"揭秘"二字（容易遭同行诋毁），改用"教你看懂"、"带你了解"、"对比分析"');
        parts.push('- 结合本地知识库和联网搜索，给出符合现实、可落地的方向');
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push('## 🎯 账号核心定位');
        parts.push('');
        parts.push('### 赛道分析');
        parts.push('- 基础赛道：XX');
        parts.push('- 细分定位：XX');
        parts.push('- 抖音该赛道现状：竞争程度、机会点');
        parts.push('- 差异化标签：3个关键词（用//分隔）');
        parts.push('- 一句话定位："[身份]+[特点]+[价值]"');
        parts.push('');
        parts.push('### 目标用户（结合抖音用户画像）');
        parts.push('- 核心人群：年龄/性别/职业/消费能力');
        parts.push('- 真实痛点：3个具体痛点（基于抖音用户行为分析）');
        parts.push('- 真正需求：用户在抖音上搜索什么、关注什么');
        parts.push('- 观看场景：什么时候刷到你的视频（早上通勤/中午休息/晚上睡前）');
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push('## 👤 账号IP个人优势');
        parts.push('');
        parts.push('基于用户档案分析，列出3-4个核心优势：');
        parts.push('- 优势1：具体优势 + 为什么这是优势 + 如何在内容中体现');
        parts.push('- 优势2：具体优势 + 为什么这是优势 + 如何在内容中体现');
        parts.push('- 优势3：具体优势 + 为什么这是优势 + 如何在内容中体现');
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push('## 💎 内容方向与配比');
        parts.push('');
        parts.push('⚠️ 核心原则：按账号阶段动态调整配比，一个内容可以同时具备流量+人设+变现属性');
        parts.push('');
        parts.push('### 当前阶段推荐配比');
        parts.push('根据用户档案中的账号阶段，给出配比建议：');
        parts.push('- 0-1万粉（起号期）：流量型60% + 人设型30% + 变现型10%');
        parts.push('- 1-5万粉（成长期）：流量型40% + 人设型40% + 变现型20%');
        parts.push('- 5万+粉（成熟期）：流量型30% + 人设型30% + 变现型40%');
        parts.push('');
        parts.push('### 流量型内容（XX%）');
        parts.push('**目的**：涨粉、传播、扩大影响力');
        parts.push('**拍摄方向思路**（结合本地知识库和联网搜索，给出3-5个方向）：');
        parts.push('⚠️ 重要：不要提"揭秘"（容易遭同行诋毁），改用"教你看懂"、"带你了解"、"对比分析"');
        parts.push('1. 方向名称 - 具体拍什么角度、为什么能吸引流量');
        parts.push('2. 方向名称 - 具体拍什么角度、为什么能吸引流量');
        parts.push('3. 方向名称 - 具体拍什么角度、为什么能吸引流量');
        parts.push('（不要写具体选题，只提供方向思路）');
        parts.push('');
        parts.push('### 人设型内容（XX%）');
        parts.push('**目的**：建立信任、强化记忆点、让用户记住你');
        parts.push('**拍摄方向思路**（给出2-3个方向）：');
        parts.push('1. 方向名称 - 具体拍什么角度、如何体现个人特点');
        parts.push('2. 方向名称 - 具体拍什么角度、如何强化记忆点');
        parts.push('3. 方向名称 - 具体拍什么角度、如何建立信任');
        parts.push('（不要写具体选题，只提供方向思路）');
        parts.push('');
        parts.push('### 变现型内容（XX%）');
        parts.push('**目的**：体现成交理由、引导到店/购买转化');
        parts.push('**必须结合**：用户选中的成交理由（如：专业强、实在不坑、质量好）');
        parts.push('**拍摄方向思路**（给出2-3个方向）：');
        parts.push('1. 方向名称 - 具体拍什么角度、如何体现成交理由');
        parts.push('2. 方向名称 - 具体拍什么角度、如何引导转化');
        parts.push('（不要写具体选题，只提供方向思路）');
        parts.push('**转化路径**：内容最后如何引导用户行动（评论区留地址/私信/到店验证）');
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push('## ⚡ 差异化优势');
        parts.push('');
        parts.push('列出2-3个核心卖点（每个最多50字）：');
        parts.push('1. 卖点标题 - 为什么能打动用户（对比"别人vs你"）');
        parts.push('2. 卖点标题 - 为什么能打动用户');
        parts.push('3. 卖点标题 - 为什么能打动用户');
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push('## 🎬 总结');
        parts.push('用一句话总结核心优势和行动建议（最多30字）');
        parts.push('');
        parts.push('⚠️ 重要要求：');
        parts.push('- 总字数控制在1000字以内');
        parts.push('- 只输出选题策划需要的核心信息');
        parts.push('- 不要输出：视觉呈现、妆容穿搭、话术风格、发布节奏、15天计划、变现路径、判断标准');
        parts.push('- 必须包含：赛道分析、抖音用户画像、个人优势、动态内容配比（流量型+人设型+变现型）');
        parts.push('- 拍摄方向要提供思路和角度，不要写具体选题标题');
        parts.push('- 严禁出现"揭秘"等容易引起同行诋毁的词汇');
        parts.push('- 所有方向必须可落地、符合现实、低成本执行');
        parts.push('');
        query = parts.join('\n');
    } else if (body.taskType === '标题封面') {
      // 标题封面生成逻辑 - 前端已构建完整query
      query = body.query || '请提供视频主题';
    } else {
      query = body.query || '你好';
    }

    console.log('Calling Dify API...');
    console.log('Query:', query);

    // 【方案6：工作流 + 手动记忆】
    // 构建 Dify 请求体：query 在顶层，conversation_history 在 inputs
    const difyRequestBody: any = {
      inputs: {
        query: query, // 工作流变量
        conversation_history: body.conversationHistory || '', // 传递对话历史
        dealReasons: body.dealReasons || '' // 成交理由（如果有的话）
      },
      query: query, // API 必需的顶层字段
      response_mode: 'streaming',
      user: 'webapp-user-fixed'
    };

    console.log('📤 发送给 Dify (方案6):', {
      query_length: query.length,
      has_history: !!body.conversationHistory,
      history_length: body.conversationHistory?.length || 0
    });
    
    console.log('📦 完整请求体:', JSON.stringify(difyRequestBody, null, 2));

    const response = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.DIFY_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(difyRequestBody)
    });

    console.log('Dify response status:', response.status);

    if (!response.ok) {
      const err = await response.text();
      console.error('Dify Error:', err);
      return new Response(JSON.stringify({ error: 'API调用失败' }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应');

    let totalChunks = 0;
    let fullResponse = ''; // 收集完整回复用于保存
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('Stream done. Total chunks:', totalChunks);
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                
                // 调试：打印 Dify 返回的数据结构
                if (totalChunks === 0) {
                  console.log('📥 Dify 首个响应:', JSON.stringify(data, null, 2));
                }
                
                // 支持两种事件类型：Chatbot 的 message 和工作流的 text_chunk
                const text = data.answer || data.text || '';
                const isContent = (data.event === 'message' || data.event === 'text_chunk') && text;
                
                if (isContent) {
                  totalChunks++;
                  
                  // 收集完整回复
                  fullResponse += text;
                  
                  // 调试：首次收到内容时打印
                  if (totalChunks === 1) {
                    console.log('✅ 开始接收内容，事件类型:', data.event);
                  }
                  
                  // 返回 SSE 格式
                  const sseData = `data: ${JSON.stringify({ 
                    answer: text,
                    conversation_id: data.conversation_id 
                  })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseData));
                }
              } catch (e) {
                console.warn('Parse error:', e);
              }
            }
          }
          controller.close();

          // 生成成功（有内容）后，服务端扣减一次配额
          if (totalChunks > 0 && guard.userId) {
            await incrementUsageServer(guard.userId, getFeatureFromTaskType(body.taskType));
          }
          
          // 保存对话历史
          if (sessionId && saveHistory && originalQuery) {
            console.log('💾 保存对话历史到数据库...');
            
            // 保存用户消息
            await saveConversationMessage({
              sessionId: sessionId,
              taskType: body.taskType || '未知',
              role: 'user',
              content: originalQuery
            });
            
            // 保存助手回复（如果有完整回复）
            if (fullResponse) {
              await saveConversationMessage({
                sessionId: sessionId,
                taskType: body.taskType || '未知',
                role: 'assistant',
                content: fullResponse
              });
              console.log('✅ 对话历史已保存');
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}







































