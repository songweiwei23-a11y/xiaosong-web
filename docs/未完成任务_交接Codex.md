# 未完成任务清单 - 交接给 Codex

## 紧急任务 🔥

### 1. 流式输出修复（最重要！）

**问题**：
选题生成时完全不动，最后一次性全部出现，用户体验极差

**根本原因**：
代码 `app/api/dify/stream/route.ts` 第483-490行有判断：
```typescript
if (!topicTask) {
    shownText += text;
    send({
        answer: text,
        conversation_id: capturedConversationId || data.conversation_id,
        message_id: capturedMessageId || undefined,
    });
}
```

选题被标记为 `NO_REPEAT_TASKS`，所以根本不发送流式数据！

**需要做的**：
1. 找到 `app/api/dify/stream/route.ts` 第483-490行
2. 删除 `if (!topicTask)` 判断
3. 改成无条件发送：
```typescript
// 选题也要流式输出，不能等全部完成才显示
shownText += text;
send({
    answer: text,
    conversation_id: capturedConversationId || data.conversation_id,
    message_id: capturedMessageId || undefined,
});
```
4. 提交并部署到腾讯云服务器

---

### 2. 清理调试日志

**位置**：
- `lib/sse-stream.ts` 第176行左右
- `app/dashboard/topic/page.tsx` 第558行左右

**需要删除的日志**：
```typescript
console.log('[SSE] Received chunk, length:', piece.length, 'total:', full.length);
console.log('[Topic] onChunk called, content length:', full.length);
```

这些是临时添加的调试日志，部署前应该删除

---

## 已完成但需要验证的任务 ✅

### 3. 选题去模板化

**已修改的文件**（已在本地提交，需要确认是否正确部署）：
- `lib/content-roles.ts` - 地域差异方向描述
- `lib/growth-tactics.ts` - 地域差异公式
- `lib/boards/topic-query.ts` - 选题生成提示词
- `lib/creation-continuation.ts` - 跨板块续作规则

**核心改动**：
- 强调"方向 = 裂变地基，不是固定模板"
- 只有"方向→选题"需要裂变，后续都是执行
- 增加反模板化检查
- 地域差异改为强调"真实互动"而非"A地B地对比"

**验证方法**：
1. 进入"创作方向"或"内容规划"，选择"地域差异"方向
2. 生成10条选题
3. 检查是否每条都有独特的人物、场景、冲突
4. 而不是"南乐XXX，郑州XXX"的重复模板

---

### 4. 版本更新自动提示

**已添加的文件**（已部署）：
- `app/api/build-id/route.ts` - 版本检测API
- `components/VersionChecker.tsx` - 版本检测组件
- `app/layout.tsx` - 已启用版本检测

**功能**：
每30秒检查一次BUILD_ID，有新版本时弹出提示

**验证方法**：
部署一次更新，等30秒，看浏览器是否弹出"🎉 有新版本可用"

---

## 部署步骤

### SSH连接信息
```bash
服务器：122.51.234.155
用户：ubuntu
密钥：C:\Users\DELL\Desktop\song.pem
项目路径：/home/ubuntu/xiaosong-web
```

### 完整部署命令
```bash
# 1. SSH连接
ssh -i "C:\Users\DELL\Desktop\song.pem" ubuntu@122.51.234.155

# 2. 进入项目目录
cd /home/ubuntu/xiaosong-web

# 3. 拉取最新代码
git fetch origin
git reset --hard origin/main

# 4. 构建
npm run build

# 5. 重启服务
pm2 restart xiaosong-web

# 6. 检查状态
pm2 status
```

---

## 测试清单

部署完成后，请按以下顺序测试：

### ✅ 1. 流式输出测试（最重要！）
- [ ] 打开浏览器，强制刷新（Ctrl+F5）
- [ ] 进入选题页面
- [ ] 填写需求，点击"生成选题"
- [ ] **预期**：内容逐步出现，不是一次性全部出现
- [ ] **如果还是不行**：按F12打开Console，看是否有 `[SSE]` 和 `[Topic]` 日志

### ✅ 2. 选题多样性测试
- [ ] 进入"创作方向"或"内容规划"
- [ ] 选择"地域差异"方向
- [ ] 生成10条选题
- [ ] **预期**：每条都有独特的人物、场景、冲突，不是模板化的"南乐XXX，郑州XXX"

### ✅ 3. 版本更新提示测试
- [ ] 部署一次更新
- [ ] 打开浏览器，等待30秒
- [ ] **预期**：弹出"🎉 有新版本可用"提示

---

## 关键代码位置

### 流式输出相关
- **问题代码**：`app/api/dify/stream/route.ts:483-490`
- **前端接收**：`lib/sse-stream.ts:173-177`
- **选题页面**：`app/dashboard/topic/page.tsx:555-566`

### 选题多样性相关
- **方向定义**：`lib/content-roles.ts:110`
- **36计公式**：`lib/growth-tactics.ts:367-374`
- **选题提示词**：`lib/boards/topic-query.ts:489-494`
- **续作规则**：`lib/creation-continuation.ts:9`

---

## 已知问题

1. **流式输出修复的代码可能没有正确提交到Git**
   - 本地修改了 `app/api/dify/stream/route.ts`
   - 但没有提交到Git
   - 需要重新修改并提交

2. **调试日志还在代码里**
   - 需要删除后再部署

3. **GitHub网络偶尔超时**
   - 如果 `git push` 超时，多试几次
   - 或者直接在服务器上修改文件

---

## 交接说明

以上任务中，**最重要的是第1项"流式输出修复"**，这是用户最不满意的地方。

其他任务都已经在代码中完成，只是可能没有正确部署或需要验证。

如果时间紧急，优先完成第1项，然后验证第3项是否生效。

---

生成时间：2026-11-13 22:12
项目路径：E:\小宋\腾讯云生产版同步_20260918
