# 选题策划传递给Dify的数据格式示例

## 1. 变现选题（选择了成交理由）

\\\json
{
  "workflow_id": "选题策划",
  "inputs": {
    // 基础信息
    "mode": "quick",                          // 模式：quick（快速）或 custom（自定义）
    "topicType": "变现选题",                   // ✅ 选择类型：变现选题 或 大流量选题
    "selectedProfile": "profile_123",         // 选中的档案ID
    "selectedPositioning": "pos_456",         // 选中的定位ID
    "profileInfo": "{...档案详细信息...}",     // 档案完整数据（JSON字符串）
    "positioningInfo": "{...定位详细信息...}", // 定位完整数据（JSON字符串）
    
    // 账号数据
    "accountStage": "稳定运营，需要新选题",
    "fansLevel": "1-5万",
    "avgViews": "5000",
    
    // 内容定位
    "platforms": "抖音、小红书",
    "tracks": "美食烹饪、职场技能",
    "contentTypes": "教知识型、晒过程型",
    "styles": "活泼亲和、接地气",
    "positioningExtra": "专注家常菜教学，适合上班族",
    
    // 爆款元素
    "explosiveElements": "成本、人群、反差",
    
    // 成交理由（仅变现选题使用）✅
    "dealReasons": "颜值高、效果好、性价比",
    
    // 参考资料
    "keywords": "快手菜、30分钟、下班",
    "benchmarkAccounts": "@美食达人小王",
    "viralCases": "100万播放的快手菜合集",
    
    // 生成参数
    "topicCount": 10,
    "withHook": true,
    "difficulty": "中等创意"
  }
}
\\\

## 2. 大流量选题（未选择成交理由）

\\\json
{
  "workflow_id": "选题策划",
  "inputs": {
    "mode": "custom",
    "topicType": "大流量选题",               // ✅ 未选成交理由，自动为大流量选题
    "accountStage": "刚起号，定位未确定",
    "fansLevel": "0-1000",
    "platforms": "抖音",
    "tracks": "美食烹饪",
    "explosiveElements": "成本、人群",
    "dealReasons": "",                      // ✅ 空字符串，表示不关注变现
    "topicCount": 15,
    "withHook": true,
    "difficulty": "简单易上手"
  }
}
\\\

## 3. Dify工作流建议

在Dify中可以这样使用topicType：

\\\
如果 topicType == "变现选题"：
  - 重点围绕 dealReasons 设计选题
  - 强调产品/服务的价值点
  - 引导用户到变现环节
  - 案例：「为什么我的XX颜值高效果好？」

如果 topicType == "大流量选题"：
  - 忽略 dealReasons 字段
  - 专注爆款元素和流量密码
  - 追求播放量和曝光
  - 案例：「揭秘XX行业的惊人内幕」
\\\

## 4. 字段说明

### 必填字段
- accountStage: 账号阶段
- tracks: 账号赛道（至少1个）

### 可选但重要
- topicType: 自动根据dealReasons判断
- explosiveElements: 爆款元素
- dealReasons: 成交理由（变现选题必选）

### 高级参数
- topicCount: 生成数量（默认10）
- withHook: 是否生成钩子（默认true）
- difficulty: 创意难度（默认中等）

