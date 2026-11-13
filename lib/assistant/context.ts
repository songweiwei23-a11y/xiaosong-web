/**
 * 助理上下文管理
 * 让助理知道用户在做什么，理解模糊指令
 */

'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 用户当前上下文
 */
export interface AssistantContext {
  // 当前页面
  currentPage: {
    path: string;
    name: string;
    type: 'topic' | 'script' | 'storyboard' | 'title' | 'review' | 'positioning' | 'creative-brief' | 'other';
  };
  
  // 最近的创作内容
  lastCreation?: {
    type: 'topic' | 'script' | 'storyboard' | 'title' | 'review';
    content: string;
    timestamp: number;
    platform?: string;
    scriptType?: string;
  };
  
  // 用户档案信息
  profile?: {
    id: string;
    name: string;
    platform?: string[];
    category?: string[];
    targetAudience?: string[];
  };
  
  // 用户状态
  userState: {
    hasPositioning: boolean;  // 是否完成定位
    hasCreativeBrief: boolean; // 是否有创作简报
    topicCount: number;        // 生成的选题数
    scriptCount: number;       // 生成的脚本数
    lastActiveTime: number;    // 最后活跃时间
  };
}

/**
 * 页面路径到类型的映射
 */
const PAGE_TYPE_MAP: Record<string, AssistantContext['currentPage']['type']> = {
  '/dashboard/topic': 'topic',
  '/dashboard/script': 'script',
  '/dashboard/storyboard': 'storyboard',
  '/dashboard/title': 'title',
  '/dashboard/review': 'review',
  '/dashboard/positioning': 'positioning',
  '/dashboard/creative-brief': 'creative-brief',
};

/**
 * 页面类型到名称的映射
 */
const PAGE_NAME_MAP: Record<AssistantContext['currentPage']['type'], string> = {
  'topic': '选题策划',
  'script': '脚本生成',
  'storyboard': '分镜生成',
  'title': '标题生成',
  'review': '审稿优化',
  'positioning': '账号定位',
  'creative-brief': '创作简报',
  'other': '工作台',
};

/**
 * 获取当前上下文
 */
export function getCurrentContext(): AssistantContext | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem('kaiwu:assistant-context');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * 保存上下文
 */
export function saveContext(context: AssistantContext) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('kaiwu:assistant-context', JSON.stringify(context));
}

/**
 * 更新最近创作内容
 */
export function updateLastCreation(creation: AssistantContext['lastCreation']) {
  const context = getCurrentContext();
  if (!context) return;
  
  saveContext({
    ...context,
    lastCreation: creation,
  });
}

/**
 * 更新用户状态
 */
export function updateUserState(updates: Partial<AssistantContext['userState']>) {
  const context = getCurrentContext();
  if (!context) return;
  
  saveContext({
    ...context,
    userState: {
      ...context.userState,
      ...updates,
      lastActiveTime: Date.now(),
    },
  });
}

/**
 * 解析用户的模糊指令
 * 根据上下文理解"改一下"、"再来一个"等
 */
export function parseAmbiguousCommand(command: string): {
  intent: 'modify' | 'regenerate' | 'create' | 'ask' | 'unknown';
  target?: string;
  suggestion?: string;
} {
  const context = getCurrentContext();
  const lower = command.toLowerCase().trim();
  
  // 修改类指令："改一下"、"优化一下"、"调整一下"
  if (/改|优化|调整|修改|完善/.test(lower)) {
    if (context?.lastCreation) {
      return {
        intent: 'modify',
        target: context.lastCreation.type,
        suggestion: `理解了，你想优化刚才生成的${PAGE_NAME_MAP[context.lastCreation.type]}。我来帮你改进...`,
      };
    }
    return {
      intent: 'modify',
      suggestion: '你想优化什么内容呢？可以直接把内容发给我，或者告诉我想改哪个部分。',
    };
  }
  
  // 重新生成："再来一个"、"换一个"、"重新生成"
  if (/再来|换一个|重新|another|more/.test(lower)) {
    if (context && context.currentPage.type !== 'other') {
      return {
        intent: 'regenerate',
        target: context.currentPage.type,
        suggestion: `好的，我再给你生成一个${context.currentPage.name}...`,
      };
    }
    return {
      intent: 'regenerate',
      suggestion: '再来一个什么呢？选题、脚本、还是标题？',
    };
  }
  
  // 创作类指令：包含数字
  if (/\d+个/.test(lower) && /选题|脚本|标题|分镜/.test(lower)) {
    return {
      intent: 'create',
      suggestion: '好的，我来帮你生成...',
    };
  }
  
  // 疑问类："怎么"、"为什么"、"如何"
  if (/怎么|为什么|如何|why|how/.test(lower)) {
    return {
      intent: 'ask',
      suggestion: undefined,
    };
  }
  
  return {
    intent: 'unknown',
  };
}

/**
 * Hook: 自动追踪页面上下文
 */
export function useAssistantContext() {
  const pathname = usePathname();
  
  useEffect(() => {
    if (!pathname) return;
    
    // 确定页面类型
    let pageType: AssistantContext['currentPage']['type'] = 'other';
    let pageName = '工作台';
    
    for (const [path, type] of Object.entries(PAGE_TYPE_MAP)) {
      if (pathname.includes(path)) {
        pageType = type;
        pageName = PAGE_NAME_MAP[type];
        break;
      }
    }
    
    // 获取或创建上下文
    let context = getCurrentContext();
    if (!context) {
      context = {
        currentPage: { path: pathname, name: pageName, type: pageType },
        userState: {
          hasPositioning: false,
          hasCreativeBrief: false,
          topicCount: 0,
          scriptCount: 0,
          lastActiveTime: Date.now(),
        },
      };
    } else {
      context.currentPage = { path: pathname, name: pageName, type: pageType };
      context.userState.lastActiveTime = Date.now();
    }
    
    saveContext(context);
  }, [pathname]);
}

/**
 * 获取智能建议
 * 根据用户当前状态，给出下一步建议
 */
export function getSmartSuggestions(): string[] {
  const context = getCurrentContext();
  if (!context) return [];
  
  const suggestions: string[] = [];
  const { userState, currentPage } = context;
  
  // 根据用户状态给建议
  if (!userState.hasPositioning) {
    suggestions.push('先完成账号定位，明确创作方向');
  } else if (!userState.hasCreativeBrief) {
    suggestions.push('生成创作简报，形成系统的创作策略');
  } else if (userState.topicCount === 0) {
    suggestions.push('生成10个选题，看看哪些方向适合你');
  } else if (userState.topicCount > 0 && userState.scriptCount === 0) {
    suggestions.push('从选题中挑几个，开始写脚本试试');
  } else if (userState.scriptCount > 0 && userState.scriptCount < 3) {
    suggestions.push('多写几个脚本，找到最适合你的风格');
  }
  
  // 根据当前页面给建议
  if (currentPage.type === 'topic' && userState.topicCount === 0) {
    suggestions.push('试试让我生成5-10个选题');
  } else if (currentPage.type === 'script' && userState.scriptCount === 0) {
    suggestions.push('说说你的主题，我来帮你写脚本');
  }
  
  return suggestions.slice(0, 3); // 最多返回3条建议
}
