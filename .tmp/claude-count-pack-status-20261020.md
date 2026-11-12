# 次数包实现状态（2026-10-20）

- [x] 已收到次数包实现任务，仅处理产品/技术实现，不处理营销
- [x] 读取支付、订单、会员、额度实现（plans.ts、api-guard、creation-quota、order-approval、订单审核路由）
- [x] 设计：会员额度优先、次数包兜底；预留 → 确认/退回三段式；审核发放单独函数，一次性
- [x] 配置：lib/config/count-packs.ts（尝鲜包 19.9 元、15 次、12 个月、**不限购**（maxPurchasesPerAccount = null）；销售开关关闭）
- [x] 数据库变更文件：supabase/migrations/20261020_count_packs.sql（未执行；含证据函数修正与 creation_completion_evidence 外键修正）
- [x] 服务端：lib/count-pack.ts；creation-quota 预留/结算分支；api-guard 预检；quota/check 显示余额；orders 下单分支（入口关闭）；订单审核发放分支；管理员查询 /api/admin/count-packs（review_orders）
- [x] 首页与智能体页面展示：components/quota/CountPackPanel.tsx（首页额度面板、侧边栏底部额度卡 SidebarQuotaCard 共用）；所有智能体页面经过侧边栏，因此统一挂在 Sidebar 底部
- [x] 迁移台账已重新生成（scripts/gen-migration-registry.mjs）
- [x] 测试：次数包 4 个文件（config / quota / migration / ui），改动 1 个旧测试的查询断言（新增次数包余额查询）
- [x] 后台「使用监控」：lib/usage-monitor.ts（纯计算：五维四率、Token、额度、次数包、明细）；GET /api/admin/usage-monitor（manage_users，分页读取，截断时标出）；页面 app/admin/usage-monitor/page.tsx；导航「用户与会员」组内「使用监控」
- [x] 监控测试：tests/usage-monitor.test.ts（14 例，期望值按输入手算）
- [x] 监控套餐判定改用统一的 effectivePlanIdAt（已导出，lib/config/plans.ts），到期订阅显示为免费；修正了第一次全量测试里 payment-flow 的全仓扫描失败
- [x] tsc --noEmit 通过；eslint 0 错误（plans.ts 3 条 any 警告为原有）
- [x] 全量测试：234 个文件、3935 个用例全部通过（日志：scratchpad/vitest-full-20261020-2.log）
- [ ] 未完成：购买页入口与购买说明（入口关闭，未接 UI）；退款流程（未定，只支持驳回未过审订单）；reconcile 对次数包的对账（未做）；监控页面未在浏览器里实际打开核对
- [x] 上线前修复：迁移未执行时，会员额度用完的请求会因次数包函数不存在而返回 503（会反复重试）。已改为函数不存在时按「次数包余额为 0」处理，照常 402（lib/count-pack.ts，tests/count-pack-quota.test.ts 新增用例）
- [x] 上线前审查：额度守卫、预留/结算分支、订单下单与审核分支、quota/check、首页与侧边栏已逐段看 diff；kaiwu_settle_creation 找不到预留时返回 settled:false（不抛错），次数包结算回落正确
- [x] 全量测试（修复后）：234 个文件、3936 个用例全部通过；本地 npm run build 通过（含 /admin/usage-monitor、/api/admin/usage-monitor、/api/admin/count-packs）

## 上线记录（2026-10-20）
- 方式：项目脚本 同步到服务器.ps1 -Yes（打包 16 项，服务器构建，检查产物比源码新，重启 PM2，逐文件 MD5 校验）
- 第一次：上传 tar 与 manifest 成功，传清理脚本时 SSH 断开。线上未变更（脚本在解压前中止）。
- 第二次（重试一次）：成功。构建约 60 秒；PM2 xiaosong-web 在线；595 个文件 MD5 与本地全部一致
- 线上探测（只读）：/api/public/ping 204；/login 200；/admin/usage-monitor 200；/api/quota/check 未登录 401；/api/admin/usage-monitor、/api/admin/count-packs 未登录 403
- 日志里有 Server Reference ID 报错，请求值为 "x"，与本次改动无关（像外部探测请求）
- 没有提交、没有推送；工作区仍有未提交改动（部署内容 = 工作区）
- **生产数据库迁移没有执行。** 在执行前：次数包不可用；使用监控接口会返回 503（找不到 count_pack_lots 表）；首页和侧边栏的次数包余额显示「—」。销售入口仍关闭。
- 待用户：确认后在 Supabase SQL Editor 执行 supabase/migrations/20261020_count_packs.sql，并在「迁移状态」页确认。

- [x] 最终结果报告（见会话回复）

## 第二轮：19.9 面向所有用户开放（2026-10-20，用户确认：迁移已执行；19.9 面向所有用户开放；可以上线）
- 配置：COUNT_PACK_SALES_ENABLED = true；名称去掉「测试配置」（name 与 testConfig=false）；countPackPurchaseBlock 增加可注入的开关参数（测试用）；注释改为当前状态
- 购买入口：CountPackPanel 开放时显示「购买 ¥19.9」（指向 /payment?plan=count_pack_trial_19_9）；「即将开放」只在关闭时显示；会员页新增 CountPackOfferCard（关闭时整块不显示）
- 付款页：次数包分支（价格、有效期、权益、凭证流程、到账后的文案）；退款提示沿用站点现有的「虚拟商品开通后不支持无理由退款」，与会员一致（退款规则仍未定，需产品方确认）
- 参数（产品方确认 19.9 与不限购；15 次、12 个月为推荐值，本次按此开放，需产品方逐项确认）
- 测试：全量 234 个文件、3943 个用例通过；tsc 通过；eslint 0 错误（付款页 4 条警告为原有）；本地 npm run build 通过
- 迁移：用户报告已在 Supabase SQL Editor 执行。线上只读核对（表与 RPC 是否存在）因 SSH 两次断开未能完成
- **上线未完成**：SSH 连接在认证前被服务器断开（两次，按约定只重试一次后停止）。22 端口可达，网站 /api/public/ping 返回 204，线上仍是上一版（销售未开）。SSH 恢复后重跑同步脚本即可上线
- 上线后需要核对：迁移对象是否存在（只读）；未登录 POST /api/orders 返回 401；次数包页面在线上可见

## 第十七轮（本地，未上线）：选题板块搬迁完成并接入助理；脚本未完成（2026-10-20）
- 中转地址默认值写进代码（lib/assistant/config.ts：DEFAULT_ASSISTANT_BASE_URL = https://apiclaude.cc）。服务器只需要密钥；环境变量里有地址时以环境变量为准。需要部署后生效
- 选题：lib/boards/topic-query.ts（buildTopicBoardQuery + extractRelevantPositioningInfo）。页面 app/dashboard/topic/page.tsx 改为调用它（行为不变；setMixUsed 副作用仍在页面）。用脚本按行号搬运原文，不手抄。页面删掉了不再用的导入
- 助理：run_topic 工具（需求、条数 3–10、目的、平台；快速模式用已保存的档案和定位；走 /api/dify/stream，额度由选题扣）
- 审稿（上一轮）：lib/boards/review-query.ts + run_review
- 服务端创作上下文：lib/assistant/board-context.ts（和 useCreatorContext 一致，缺风格预设和创作偏好）
- 已知差异：助理版选题的创作设置用空的（页面上的 currentSettings 更完整），所以助理的选题和页面的选题在细节上不完全一致
- 测试：10 个老的源码扫描测试改为读「页面 + 共用模块」（tests/helpers/source.ts 新增 readTopicBoardCode/readTopicBoardRaw）；新增 tests/board-topic.test.ts（15 个）
- 验证：全量 243 个文件、4049 个用例通过（1 个实测跳过）；tsc 通过；eslint 0 错误；本地 npm run build 通过
- 脚本板块：本轮未完成，第十八轮已搬迁完成（见下）
- **未上线**

## 第三十二轮（文档与测试，未部署，等待指示）：助理能力测试 + 升级方案（2026-10-22）
- 能力测试（服务器真实模型，内部接口模拟，10 个场景各一次）：8 个完全正确；1 个部分（知识库引用不稳定）；1 个虚假成功（「把待办改到周五」新增了一条并声称已改，没有修改工具）
- 另发现：「到期当天会提醒你」说过头（提醒只在面板打开时读取）
- 原始结果：.tmp/knowledge-probe/server-run/assistant-result-one.json（单场景）；探针源码 assistant.probe.ts
- 文档：docs/助理升级方案_20261022/方案.md（测试结论、现状盘点、问题清单、A–J 十个维度的升级建议、四阶段路线图、需要你决定的 7 个问题、验证指标、风险）
- 阈值（上一轮的后续）：服务器到数据库实测 30 次：中位数 887 ms，p90 1034 ms，最慢 2180 ms；阈值改为 2500 ms，检查取三次中位数；代码与测试已改、测试通过，尚未部署（cron 仍在跑旧代码，但没有 webhook，不会推送）
- 知识库检索（服务器实测）：Dify 列表与检索每次约 1 秒，5 库并行约 2–3 秒，不是超时原因
- 服务器磁盘扫描（只读，未删除）：磁盘 76%；最大的候选：/home/ubuntu/.npm 1.3G、/home/ubuntu/xiaosong-web 801M（疑似旧副本）、/var/www/xiaosong-backup-20261007_free_chat_detail（旧备份，含 node_modules）、/var/log/journal 409M、/var/cache/apt 135M、snap 旧版本；.next/cache 448M 不建议删（部署脚本注释：删 .next 会触发全量构建，2G 内存会被压死）
- 迁移：20261022_order_claims.sql 未执行（已核实 claimed_by 列不存在）；20261022_ops_indexes.sql 用户说已执行（索引无法用接口核实）
- 未做：飞书地址（需要用户提供）；并发上限（供应商限额未知，保持关闭）

## 第三十一轮（已上线，提交 c8db47e）：后台扩展方案执行（2026-10-22）
- 上线：同步上线，643 个文件比对一致（日志 scratchpad/deploy-20261022-admin-plan.log）；首页 200；监控、成本、告警、看全文、认领接口未登录均 403
- 服务器：ALERT_CRON_SECRET 已写入 .env.local（备份 .env.local.bak-alerts-20261022）；crontab 每分钟调用 /api/admin/alerts/tick（备份 crontab.bak-20261022）；首次检查 dbLatencyMs=1200（阈值 1000，待判断是否调高）；webhook 未配置（health-alert.env 也不存在）
- 已完成：P0-2 计数缓存、P0-3 带条件计数、P0-4 活跃用户按人查询（缓存 10 秒）、P0-5 两处权限缺口、P0-7 接口权限声明+测试；P1-1 默认拒绝/角色/按角色裁剪/看全文理由；P1-2 排队核心（默认关闭）；P1-3 认领代码（需迁移）；P1-4 告警规则+节流+定时检查；P2-3 成本接口；P2-4 管理员写操作限流
- 未完成（需要你提供或决定）：
  - 执行迁移：supabase/migrations/20261022_ops_indexes.sql（索引）、20261022_order_claims.sql（认领列）——未执行前认领按钮不显示，索引不生效
  - webhook 地址（企业微信或飞书）：未配置前告警只检查、不推送；告诉我地址和类型即可配置
  - 排队的并发上限：需向 Dify/中转供应商确认，确认后设 GENERATION_CONCURRENCY 即开启
  - P0-6 磁盘：当前 75.5%，未清理（需要确认哪些可删）
  - P1-1 两人确认、临时授权看全文：需要新表（未做）
  - P1-3 认领的超时升级、「我的待办」页（未做）
  - P1-5 事件驱动监控（需要迁移与切换，未做）、P1-6 服务器升级（预算决定，未做）
  - P2-1 支付自动化（需要支付平台接口，未做）、P2-2 用户时间线/标签/分群（未做）、P2-5 数据保留策略（需要决定，未做）、P2-6 多实例（未做）
  - 成本看板页面（只有接口，无页面）；助理对话的用量仍未记录
- 测试：全量 257 个文件、4272 条通过（1 条跳过）；tsc 通过

## 第三十轮（方案文档，未执行）：后台扩展与管理方案（2026-10-22）
- 文件：docs/后台扩展方案_20261022/方案.md（诊断、容量估算、P0/P1/P2 分阶段方案、权限与调度设计、告警阈值、需要决定的 7 个问题、未验证部分）
- 只读实测：user_profiles 18、subscriptions 7、script_history 378（24h 10）、usage_events 460（24h 26）、payment_orders 1、funnel_events 269、admin_logs 107；REST 单次 370–2000 ms（本地网络）
- 主要发现：快照每秒全量读历史订单和全表计数；22 个接口文件用 requireAdmin()（读取类不分角色）；quota/reconcile 与 quality/regression 的 POST 只校验身份；仓库里找不到 created_at 索引（待线上核对）；磁盘 75%；无调度、无订单分派、无自动告警
- 未改任何代码、未改数据库、未部署；等你决定执行哪些

## 第二十九轮（本地，未部署）：实时动态完整内容（2026-10-22）
- 原来：动态列表只有最近 40 条生成带完整输入和全文，列表上限 60 条；其余只有摘要
- 现在：最近 EVENT_LIMIT（200）条生成和对话都带完整内容（lib/monitor.ts 的 EVENT_LIMIT，接口和页面共用）；每条「看完整记录」可看全部输入字段和全文
- 性能：完整内容按记录缓存（lib/admin-monitor-data.ts 的 fillContent / pruneContent），每条只从数据库读一次，之后每秒只补新出现的；缓存只留列表里的 200 条，内存有上限
- 全文上限：/api/admin/monitor/record 的 RESULT_CAP 从 2 万字放宽到 20 万字（超出才截断并标出）
- 动态列表说明写成「最近 200 条 · 每条都能点「看完整记录」看完整输入和全文」
- 注意：列表接口每秒返回约 200 条（摘要 + 140 字结果开头），比之前大；首次刷新要读 200 条全文，之后只补新的
- 测试：tests/monitor-full-content.test.ts 新增 6 条（缓存加载、分批、清理，上限与接线）；全量 256 个文件、4235 条通过；tsc 通过；eslint 无新增错误
- 未部署：等你说「部署上线」

## 第二十八轮（已上线）：在线与活跃的真实性 + 版本提示 + 系统状态（2026-10-21）
- 上线：同步上线，634 个文件比对一致（日志 scratchpad/deploy-20261021-build-tag.log）；版本号 BUILD_20261022000044 已写入线上前端包（2 个文件）和服务端（14 个文件）；https://www.biandao.icu 200，POST /api/presence 未登录 401，/api/admin/monitor 未登录 403
- 首次带版本号的部署：之后打开的页面会正常收到心跳；部署前打开的旧标签页仍需手动刷新一次
- 排查（服务器 nginx 访问日志）：管理员的工作台标签页每 25 秒有 /api/public/ping，但从来没有 POST /api/presence；线上前端包里已有心跳代码。结论：这个标签页是部署前打开的旧代码，不会发心跳，所以大屏看不见它。同样的问题对所有部署前打开的页面都成立
- 另一个缺口：后台页面（/admin/*）没有挂心跳，管理员在实时监控里自己也不算在线
- 修复一：部署脚本构建时注入版本号（NEXT_PUBLIC_APP_BUILD = 本次 buildTag），页面和服务器用同一个值
- 修复二：心跳带上页面版本；服务器发现不一致，页面右下方提示「开物已更新到新版本，刷新页面即可」（只提示，不自动刷新）；大屏对旧版本页面标「旧版本页面」，状态栏统计「旧版本在线」
- 修复三：登录用户的任何接口请求（lib/api-guard 的 checkCurrentUser、管理员接口 requireAdmin 不算）也更新在线时间；页面没发心跳也能被看见
- 修复四：后台布局挂心跳（app/admin/layout.tsx），页面名「后台实时监控」
- 修复五：监控新增系统状态（每秒）：服务版本、运行时长、数据库延迟、快照耗时、助理进行中任务数、旧版本在线人数；底部状态条显示
- 最近活跃列表：数据来源写在面板标题上（心跳、接口请求、登录、生成、使用记录，24 小时内）；「最后」仍是最近一次操作
- 已知边界：部署前打开的旧标签页没法远程更新，只能手动刷新一次（它不会出现提示横幅）；心跳和在线记录只在进程内存里，服务重启后 30–90 秒内重新攒齐
- 测试：tests/monitor-presence.test.ts 新增版本、接口请求在线、任务计数、接线等用例；全量 255 个文件、4229 条通过（上一步，加后台心跳前）；tsc 通过，eslint 无新增错误
- 未部署：等你说「部署上线」（这次是第一次带版本号的部署）

## 第二十七轮（已上线）：实时监控刷新统一为 1 秒（2026-10-21）
- 上线：同步上线，634 个文件比对一致（日志 scratchpad/deploy-20261021-refresh1s.log）；https://www.biandao.icu 200，/api/admin/monitor 未登录 403；全量 255 个文件、4219 条通过
- 页面兜底刷新（hooks/useRealtimeMonitor.ts）：5 秒 → 1 秒；漏斗面板跟随同一个刷新信号，也是 1 秒
- 快照时间片（app/api/admin/monitor/route.ts）：5 秒 → 1 秒，「在线」「多久前」「使用情况」每秒更新
- 用户目录缓存（lib/admin-monitor-data.ts）：5 秒 → 1 秒
- 连接状态心跳（app/api/admin/monitor/stream/route.ts）：5 秒 → 1 秒
- 服务端通知检查本来就是 1 秒，没改
- 不动：工作台的在线心跳仍是 30 秒（用户端发送，在线/离线由 90 秒超时决定，改成 1 秒会让每个用户每秒发一次请求）
- 代价：大屏打开时，服务端每秒重算一次快照（约 10 次数据库查询，多个管理员同时看时共用一份）
- 测试：admin 与 monitor 相关 17 个文件、218 条通过；tsc 通过；eslint 无新增错误
- 未部署：等你说「部署上线」

## 第二十六轮（已上线）：在线用户真实显示（2026-10-21）
- 上线：同步上线，634 个文件比对一致（日志 scratchpad/deploy-20261021-presence.log）；https://www.biandao.icu 200，POST /api/presence 未登录 401，/api/admin/monitor 未登录 403；本次没有新迁移
- 现象：最近活跃用户漏人；「正在用」不是真实在线
- 原因：「在线」「最近活跃」只看登录时间、生成记录、使用记录。只是打开工作台浏览、不生成内容的人完全看不见；「15 分钟内有操作」也不等于正在用
- 修复：工作台每 30 秒心跳（components/dashboard/PresenceBeat.tsx，只在页面可见时发，切换页面时补一次）→ POST /api/presence（只收登录用户，lib/presence.ts 记在进程内存里，不写数据库，不需要迁移）
- 在线 = 90 秒内有心跳；只浏览的人也进「最近活跃」，写「只在浏览」，卡片上显示正在哪一页；心跳超时即离线
- 修正上一轮的副作用：快照键加上 5 秒时间片和心跳版本，「在线」「多久前」不再因为没有数据变化而卡住
- 通知：心跳版本变化（有人新上线）推送刷新；大屏兜底刷新从 30 秒改为 5 秒
- 注意：心跳在内存里，pm2 重启后 30 秒内会重新攒齐；以后多进程部署要换成共享存储
- 测试：新增 tests/monitor-presence.test.ts（14 条）；tests/monitor.test.ts 在线用例改为带心跳；全量 255 个文件、4219 条通过；tsc 通过；eslint 无新增错误
- 未部署：等你说「部署上线」

## 第二十五轮（已上线）：后台实时监控不实时（2026-10-21）
- 上线：同步上线，631 个文件比对一致（日志 scratchpad/deploy-20261021-monitor.log）；https://www.biandao.icu 200，/api/admin/monitor 与 /stream 未登录 403；全量 254 个文件、4206 条通过
- 现象：实时监控大屏的数据不是实时显示
- 原因：数据接口 app/api/admin/monitor/route.ts 的快照只按时间缓存 5 秒（coalesce），用户目录缓存 60 秒（readAllUsersCached）。数据库变了、页面收到变更通知去取数，拿到的是缓存的旧快照，要等下一次变更或 30 秒心跳才更新
- 核对：admin_monitor_signal 版本号在业务写入后正常递增（只读检查），线上近一小时日志没有监控报错，问题不在触发器或推送
- 修复：快照键改为数据版本号（readMonitorRevision），版本没变就共享、变了就重算（snapshotForRevision，只留最新一份，不会越攒越多）；读不到版本号时退回 5 秒时间缓存；用户目录缓存 60 秒改为 5 秒
- 测试：tests/admin-monitor-realtime.test.ts 新增 5 条；admin 相关 13 个文件、129 条通过；tsc 通过；eslint 无新增错误
- 未部署：等你说「部署上线」

## 第二十四轮（已提交 git，记忆优化已上线）：线上知识库 A/B + 记忆优化 + 川菜验证 + 分批提交（2026-10-21）
- 知识库配密钥：服务器 .env.local 追加 DIFY_DATASET_API_KEY（先备份为 .env.local.bak-20261021），pm2 restart xiaosong-web，首页 200
- 线上 A/B（服务器上临时探针 .kb-probe/，跑完已删；真实 Dify + 真实助理模型，额度用假的）：
  - 「前三秒」：带知识库 → 工具调用 1 次，回答引用《36 第36节：开篇3_AI总结》等真实资料，框架是「直击痛点」「损失厌恶」等课程的说法，32 秒（含首次读数据集列表）
  - 「选题怎么挑」：带知识库 → 引用《八大爆款元素选题》《三种目的》，16 秒；不带 → 通用说法，15 秒
  - 「天气」：带知识库也没有调用工具，符合预期
  - 第一次对照出现了编造出处（不带工具却引用了不存在的资料），原因是系统提示里还有「先查知识库」的规则。已用线上同样的「没接通」说明重跑对照，编造消失。这说明 KNOWLEDGE_OFF_NOTE 是必要的
- 记忆优化（代码完成，未部署）：
  - 去重：同一件事（忽略空白、标点、大小写）不重复记，返回「已经记着了」
  - 修改：记忆块每条带编号；remember 填 replaceId 改写那一条（只能改自己的）
  - 忘掉要确认：新工具 propose_forget 只把这条发到页面，页面弹出「确定忘掉 / 先留着」，点确定才调 DELETE；删失败留着卡片
  - 摘要没跟上：/api/assistant/threads?id= 返回 summaryLagging（消息超过 24 条而摘要没跟上）；面板打开时提示用户
  - 测试：新增 tests/assistant-memory-ops.test.ts（12 条）；assistant-memory.test.ts 的记忆块用例改成带编号
- 川菜方案：代码（businessLines、定位提示词硬约束、交稿前检查、前采提取和对话修改规则）和线上档案数据（product_category、content_themes）之前已改好，这次补上真实模型验证：.tmp/quality-eval/category-probe-20261018.cjs（线上档案 + 当前提示词 + 开物）→ 定位开头三个品类都出现，川菜不只以厨师身份出现
- 提交（本地 git，未推送）：a3cf328 助理 · a86d910 创作进度 · 6bbe67b 次数包与用量监控 · d5e6c85 新手引导 · f87ad16 收尾（页面、测试、迁移注册表）。未提交：.tmp/、output/（工具产物，不入库）
- 验证：全量 254 个文件、4201 条通过（1 条跳过）；tsc、eslint 通过
- 上线（2026-10-21，记忆优化）：同步上线，631 个文件比对一致（日志 scratchpad/deploy-20261021-memory.log）；https://www.biandao.icu 200，/api/assistant/threads、/api/assistant/memories 未登录 401；本次没有新迁移，记忆优化只用已有的表
- 服务器上留有 /var/www/xiaosong-web/.env.local.bak-20261021（第二十四轮配密钥时的备份，含同样的密钥），确认无误后可删

## 第二十三轮（已上线，知识库已生效）：助理查编导知识库 + 对话进行中不能切换 + 导出补全助理数据（2026-10-21）
- 上线：同步上线，631 个文件比对一致（日志 scratchpad/deploy-20261021.log）；https://www.biandao.icu 200，/api/assistant?status=1 未登录 401；pm2 xiaosong-web online
- 知识库已生效（2026-10-21 补配）：服务器 .env.local 追加了 DIFY_DATASET_API_KEY（备份 .env.local.bak-20261021），pm2 重启；见第二十四轮
- 助理查知识库：新增 lib/assistant/knowledge.ts，走 Dify 知识库检索接口（DIFY_DATASET_API_KEY，dataset- 开头），不走 /api/dify/chat，不扣自由对话额度。数据集列表缓存 10 分钟；6 段以内，每段 900 字；无分数的命中排在有分数的后面
- 工具 search_knowledge（lib/assistant/tools.ts）：每条消息只查一次（和 search_web 一样用闭包缓存）；计入套餐的「知识库查询」额度（和知识库板块同一个额度，次数包不抵扣）：先预留，查到了结算，查不到或出错释放。额度用完、没接通、暂时无法确认，都如实告诉模型，不编造来源
- 系统提示规则 5（lib/assistant/run.ts）：讲方法（选题、脚本、开篇、拍摄、定位）时先查知识库，回答写出依据的《资料名》；知识库没有的，用一般经验回答并说明
- 真实检索探针（.tmp/knowledge-probe/knowledge.probe.ts，只测检索）：「开篇前三秒」召回开篇 36 计等切题资料，4.8 秒（含首次读数据集列表）；「选题怎么挑」召回选题原则和爆款元素，2.7 秒；无关问题（天气）仍返回 6 段，分数只有 0.44–0.53，靠模型忽略，这是已知风险
- 未做真实模型 A/B：本地没有 ASSISTANT_API_KEY（只在服务器配置），所以「回答是否更贴近课程口径」还没有测。要测就在服务器上用同一份代码跑探针，或上线后用真实对话看
- 导出补全（lib/account-export.ts）：新增 account_materials、account_work_insights、assistant_threads、assistant_messages、assistant_memories（都有 user_id，导出按本人过滤）
- 对话进行中：新对话按钮禁用；点历史对话、新建对话、删除当前对话时，提示「正在回答这一条，等它结束后再切换或新建对话」（components/assistant/AssistantWidget.tsx）。原因：结果是写进当前这段对话的，切走了就接不回来
- 测试：新增 tests/assistant-knowledge.test.ts（21 条：检索合并与失败、额度每轮一次、402/503/没接通/查询失败、接线与面板守卫）；tests/account-export.test.ts 补 5 张表的覆盖检查
- 验证：tsc 通过；全量 253 个文件、4186 条通过（1 条跳过）
- 未上线：没有部署、没有提交 git（工作区里还有前几轮未提交的改动）；川菜定位的修复方案（C:\Users\DELL\.claude\plans\dreamy-fluttering-duckling.md）本轮没有动
- 门控：没配 DIFY_DATASET_API_KEY 时，search_knowledge 工具不注册，系统提示加一句「知识库没接通」，线上行为和上一轮一样（否则每条方法论回答都会冒出「没查到知识库」）
- 服务器（已处理）：当时 /var/www/xiaosong-web/.env.local 里没有 DIFY_DATASET_API_KEY，所以知识库没生效；第二十四轮已补上
- 验证补充：修正了 tools.ts 数组展开后 run 参数隐式 any 的 tsc 错误；全量 253 个文件、4189 条通过（1 条跳过）；tsc、eslint 通过
- 待办：服务器配置密钥后，用一个方法论问题在线上确认会出现「《资料名》」引用

## 第二十二轮（已上线，待执行迁移）：助理界面美化 + 记忆 + 长期对话（2026-10-22）
- 界面：对话按「你的话 → 助理的过程、来源、回答」排版；空白时给快捷词；过程用竖线时间线；输入框做成圆角胶囊。头部有新对话、历史对话、我记得的事三个按钮。测试里的 TaskCard 改名为 TaskThread
- 长期对话：对话存在服务器（assistant_threads、assistant_messages）；接口先确认归属，再预留额度，再取摘要和原文；助理跑完把回答和联网来源存进对话；消息超过 24 条时，较早的压缩成摘要（lib/assistant/summarize.ts），最近 12 条保留原文
- 记忆：助理用 remember 工具记下长期有用的事（assistant_memories），每次对话带上；隐私（密码、证件号、银行卡、手机号）拒收；面板里可以查看和删除
- 数据库没建表时：对话照常进行，头部显示「对话暂时不会保存」，界面退回到只在本次打开期间记得
- 验证：tsc 通过；新增文件 eslint 无错误；全量 4165 条通过（1 条跳过）；build 通过
- 上线：同步上线，630 个文件比对一致；https://www.biandao.icu 200，新接口未登录 401
- 待办：在 Supabase 执行 supabase/migrations/20261022_assistant_memory.sql；执行后记忆和长期对话生效（上线时三张表还不存在，只读探测为 404）

## 第二十一轮（已上线）：助理替用户在开物里做事 + 创作进度识别文件内容（2026-10-21）
- 上线：迁移 20261021_account_materials.sql 已由用户执行（两张表只读探测正常）；同步上线，624 个文件比对一致；https://www.biandao.icu 200，新接口未登录 401
- 助理动作：add_todo、list_todos 走真实的待办接口（/api/todos，表 user_todos，不依赖新迁移）；play_ambient、stop_ambient 由界面执行（白噪音 = 开物的「专注」棕噪音）。白名单和参数校验在 lib/assistant/client-action-spec.ts，执行在 components/assistant/clientActions.ts
- 提醒：打开助理面板时读待办，到期和今天要做的列出来；网页关着时不推送（这是现在的边界）
- 不越界：付款、删除数据、发布或发送内容给别人、修改账号和密码，助理不做，告诉用户去哪里做（系统提示写明）；系统提示带着北京时间的今天，「明天」「下周三」按它换算
- 创作进度识别：字幕 srt、vtt、lrc 读成文字；视频读不出台词和画面（服务器没有解码器和语音识别），界面提示导入脚本或字幕；图片交给模型读（lib/work-materials/vision.ts，4MB 上限，失败时如实说明）
- 每条识别出的内容：标题、目的、脚本类型、结构、风格、开篇、人群、是否已发布、播放（lib/work-insight.ts 的 MaterialItem），只填文件里写明的，其余 null；界面出表格，作品概况提示块有一句摘要
- 验证：tsc 通过；新增文件 eslint 无错误；全量 4148 条通过（1 条跳过）；build 通过
- 待办：执行 supabase/migrations/20261021_account_materials.sql（创作进度的导入和概况需要）后部署；助理动作不依赖它，可以先上线

## 第二十轮（已上线）：创作进度导入文件 + 账号作品概况 + 板块打通（2026-10-21）
- 创作进度页顶部新增「账号作品概况」（components/works/MaterialsPanel.tsx）：导入任意格式文件（文字类、网页、docx、pptx、xlsx、PDF 基础提取；图片和其它格式保存但读不出文字，界面会说明）
- 文件解析：lib/work-materials/extract.ts（zip 读取在 zip.ts，解压有上限）；测试 tests/work-materials.test.ts（12 条）
- 配比：确定的配比只认作品记录里的视频目的（单一目的才计入三类，多目的、未记录单独计数）；文件里识别的标题由模型按三种视频定义逐条判断，标为推测，和确定的分开
- 三种视频的定义只用 lib/content-roles 的 ROLE_SPECS（不另起一份）；分类型数据反馈标样本数，少于 3 条不下结论
- 下一批建议：档案计划比实际缺口最大的一类（lib/work-insight.ts nextBatchHint）
- 接口：app/api/work-materials（导入、列出、删除）、app/api/work-insights（取、分析；分析有限流，模型不可用时只给确定的部分）；分析用的是助理的中转模型
- 同步：CreatorContext.workInsight 在客户端 hook 和服务端 loadBoardContext 里都加载（同一个接口）；buildContextBlock 里和数据回流放在同一个条件下（选题、方向、起号、自由对话）。脚本板块仍按方案 D 只给档案
- 失效：作品删除、拍摄发布状态变化、录数据、导入、删除文件、分析后都调用 invalidateCreatorContext，客户端缓存跟着更新
- 数据库：supabase/migrations/20261021_account_materials.sql（两张新表，服务端读写，开启 RLS 无策略）；台账已由 scripts/gen-migration-registry.mjs 重新生成。执行迁移前，导入和分析会提示「暂时没有保存下来」
- 验证：tsc 通过；新文件 eslint 无错误；全量 4127 条通过（1 条跳过）；build 通过
- 待办：执行迁移 → 部署；图片的文字识别（需要视觉模型）；脚本板块是否也要给作品概况（目前按方案 D 不给）

## 第十九轮（已上线）：助理按默认替编导填表、历史入库、界面定稿并部署（2026-10-20）
- 追加上线（2026-10-20）：助理联网对齐自由对话——同一条消息只联网一次、只扣一次联网额度（同一轮的 search_web 复用资料）；资料全文交给模型（工具结果上限 16000 字）；用自由对话的「联网资料使用要求」（freeChatEvidenceRules 的资料段）；来源和状态通过 web 事件推到任务卡，来源是可点的链接（lib/assistant/tools.ts、agent.ts、components/assistant/AssistantWidget.tsx；tests/assistant-web-quality.test.ts）。验证：tsc、eslint、全量 4097 条通过、build 通过；同步上线完成，613 个文件比对一致
- 次数核对：助理一条消息 = 一次 freeChat 预留，套餐数字与自由对话一致（免费 10 / 基础 50 / 专业 120 / 高频 300），次数包兜底走同一函数。差别只在结算记录的类型名（助理写「助理对话」，自由对话写「自由对话」），不影响扣额度
- 用户选定：位置 A（右下角胶囊，保留现在的样子，首页也保留）；弹窗 C（任务卡：每句话一张卡，有过程、结果、复制按钮、额度说明）；首页 3（工作台顶部一句话条，发出去后由右下角面板展示）
- 首页一句话条：components/assistant/AssistantHomeBar.tsx，挂在 app/dashboard/page.tsx「开始创作」之前；通过 lib/assistant/ask.ts 的事件把话交给右下角的助理，助理打开面板并直接执行
- 任务卡：components/assistant/AssistantWidget.tsx 重写。轮询、停止、上文（只带已完成的，最多 8 条）逻辑不变；未实现设计稿里的「带去写脚本」「收藏」按钮（只有复制）
- 助理替编导填表：脚本、选题、审稿的创作设置改为共用函数（lib/boards/script-query、topic-query、review-query），页面和助理调用同一份；助理的默认值 = 页面初始值（SCRIPT_PAGE_DEFAULTS）
- 助理的脚本不带定位（与脚本页一致，方案 D）；选题页从不选定位，助理也不带
- 记忆预填：脚本页默认开着，助理也按同一规则（scriptMemoryPatch）填上次的习惯；widget 把开关 memoryOn 带给接口
- 历史入库：助理跑完的板块结果写入历史。选题走 /api/topics，脚本和审稿走 /api/script-history（新增 task_type 白名单，允许「审稿优化」）。存失败不影响结果。脚本结果后面和页面一样追加质检报告（scriptResultWithQuality）
- 助理的判断规则（lib/assistant/run.ts）：没有特殊要求用页面默认并说明；方向说不清、审稿没有原文、要求与档案冲突、会重复扣额度时才问
- 川菜方案线上数据：锦园地摊串串一元火锅 product_category 去掉「餐饮」，现为 ["川味串串火锅","川味烧烤","川菜"]（用户授权后改，回读确认）
- 验证：tsc 通过；改动文件 eslint 无新增告警；全量测试 245 个文件、4082 条通过（另有新增的 tests/assistant-ui.test.ts 7 条，单独通过）；npm run build 通过
- 部署：同步到服务器.ps1 -Yes 完成，服务器构建成功，PM2 xiaosong-web 在线，线上 613 个文件与本地比对一致；https://www.biandao.icu 首页与 /dashboard 返回 200
- 未验证：登录后的工作台没有在浏览器里看到（入口是邀请制，内置浏览器没有登录态）。助理界面的实际效果需要登录后看一眼
- 川菜线上数据、以上所有改动：本地代码仍有未提交的改动（不在 git 提交里），需要的话再提交

## 第十八轮（本地，未上线）：脚本板块搬迁完成并接入助理（2026-10-20）
- 脚本：提示词拼装搬到 lib/boards/script-query.ts（buildScriptBoardQuery，输入 ScriptBoardInput）。页面 app/dashboard/script/page.tsx 只收集状态，删掉约 440 行内联拼装，并清理了不再用的导入。搬运用脚本按行号进行，提示词文本原样保留；diff 只有四处：`isAd` 改为输入、档案和定位改为输入（不再查 profiles / positionings）、`autoSetup.settings.focusContent` 改为输入、`selectedProfileId` 相关判断统一用 `profile`
- 页面请求体里的续写原文、「自动目的」后缀仍由页面追加；创作设置由共用函数附在最后（和原来同一个顺序）
- 助理：run_script 工具（需求必填；目的可选，三选一；平台默认抖音）。创作设置用 resolveCreationSettings（和页面同一算法）；走 /api/dify/stream，taskType 为「脚本生成」，额度由脚本扣。系统提示里原来「脚本还不能直接生成」那条已改
- 已知差异：助理版脚本没有页面上的开头、钩子、结构、拍法等选择（取默认值），也没有质检分和历史记录
- 发现（原有代码，本轮未改）：脚本页 `const query = (autoScriptType || !isAd) ? 自动生成器 : isAd ? 广告模板 : 内容模板` 里，「内容创作」模板在任何情况下都走不到（!isAd 进第一支，isAd 进第二支），是死代码
- 测试：扫描脚本页源码的 6 个测试改为读「页面 + 共用模块」（tests/helpers/source.ts 新增 readScriptBoardCode / readScriptBoardRaw）；creative-craft-adaptation 改为直接调用 buildScriptBoardQuery；新增 tests/board-script.test.ts（提示词 12 个、助理工具 5 个）
- 验证：全量 245 个文件（244 通过、1 跳过）、4066 个用例通过；tsc 通过；eslint 对改动文件 0 错误（脚本页 13 条 react-hooks 警告是原有的）；npm run build 通过（76 个页面）
- 未做：没有用真实模型探针（提示词文本经 diff 确认未变）；没有在浏览器里点过脚本页（本轮只改了提示词拼装，页面的界面没有动）
- **未上线**

## 第十六轮（本地，未上线）：方案 A 第二步：审稿板块接入助理；选题、脚本待做（2026-10-20）
- 方案 A：把板块的提示词拼装搬到服务端也能用的共用模块，页面和助理共用
- 已完成：
  - lib/boards/review-query.ts：审稿提示词拼装（上下文 + 创作设置 + 相关方案参考 + buildReviewPrompt + 末尾个人要求提醒）。审稿页面改为调用它（行为不变：原来页面里 query + 提醒的拼接现在在共用模块里完成）
  - lib/assistant/board-context.ts：服务端版创作上下文，接口和 hooks/useCreatorContext 一致（只取当前档案自己的定位；风格预设和创作偏好未包含，助理版会少这两段）
  - lib/assistant/tools.ts：新增 run_review 工具：稿子太短先请用户补全；通过 /api/dify/stream 调用审稿（和页面同一个接口，额度由审稿自己扣）；额度不够或服务错误如实返回
  - 助理界面会带上当前档案编号（profileId）
  - 测试：tests/board-review.test.ts 9 个用例；两处页面静态扫描测试改为检查共用模块（review-personal、context-delivery）
- 验证：全量 242 个文件、4033 个用例通过（1 个实测用例跳过）；tsc 通过；eslint 0 错误（审稿页 8 条警告为原有）；本地 npm run build 通过
- 未完成：
  - 选题板块：查询拼装在页面内联约 350 行，依赖页面状态和 setMixUsed 副作用，需要整体搬出（页面保留副作用）
  - 脚本板块：拼装分散在页面多处，需要单独梳理
  - 审稿在服务器上的端到端验证需要一个登录用户的 Cookie 和 Dify 配置，本地只能用假接口测试
- 仍然存在：服务器 .env.local 缺 ASSISTANT_API_BASE_URL（写入被拦），助理在服务器上未启用
- **未上线**

## 第十五轮（本地，未上线）：开物助理（右下角）第一步、第三步；第二步未完成（2026-10-20）
- 中转：端点 https://apiclaude.cc，模型 claude-sonnet-5-5，Anthropic 格式。实测：普通回复正常；工具调用正常（模型调用 read_quota 后给出结论）。密钥已写入服务器 .env.local（权限 600，只列变量名与长度，不回显值）
- **卡点**：服务器 .env.local 还缺 ASSISTANT_API_BASE_URL=https://apiclaude.cc 这一行。写入被自动权限规则拦下（远程 Shell 写入），没有绕过。助理在服务器上未启用（接口 status 为 false，入口不显示）
- 代码（本地）：
  - lib/assistant/config.ts（环境变量读取，三项缺一即关闭）
  - lib/assistant/llm.ts（Anthropic Messages 调用；错误只报状态码，不回显响应体）
  - lib/assistant/agent.ts（对话循环：工具调用、步数上限 6、停止、工具出错不中断）
  - lib/assistant/tools.ts（read_account 读档案/定位/作品；read_quota 读额度；search_web 联网查热点，扣联网额度，真正发起搜索前才扣）
  - lib/assistant/jobs.ts（后台任务，一人一条，只能看自己的，增量进度，30 分钟清理）
  - lib/assistant/run.ts（运行入口：成功结算 1 次自由对话额度；停止或出错释放）
  - app/api/assistant/route.ts（POST 提交；GET 进度/状态；DELETE 停止）
  - components/assistant/AssistantWidget.tsx（右下角；轮询进度；只在已配置时显示）
  - app/dashboard/layout.tsx 挂载
- 测试：tests/assistant-llm（7）、assistant-agent（9）、assistant-jobs（9）、assistant-wiring（9，含「工具不调用自由对话/板块接口，避免重复扣费」「密钥不进仓库」扫描）、assistant-live（实测，仅 ASSISTANT_LIVE=1 时运行，已通过）
- 验证：全量 241 个文件、4024 个用例通过（1 个实测用例跳过）；tsc 通过；eslint 0 错误；本地 npm run build 通过（含 /api/assistant）
- **第二步未完成**：自动调用板块（选题、脚本、审稿）。板块提示词在页面组件里拼装（选题约 300 行内联，审稿依赖客户端上下文 hook），服务端还不能复用；需要先把这些拼装抽成共用模块，页面和助理共用，否则助理的产出和板块不一致。
- **未上线**；未在浏览器里看过右下角窗口

## 第十四轮：上线（2026-10-20）：引导改为「选项」，不替用户选；审稿后推荐同步进度
- 全量测试：237 个文件、3990 个用例通过；本地构建通过
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 30 秒，PM2 在线，599 个文件 MD5 全部一致）。BUILD_ID：N_GKglCNi8ld3_R2UKJ1b
- 线上核对（只读）：/api/public/ping 204；/login 200；/dashboard 200；/dashboard/membership 200；/dashboard/works 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；未登录 POST /api/orders 401；构建含「下面几项你自己选」「同步创作进度」（各 1 个 chunk）
- 未做：登录后的选项显示效果、点击后的跳转实测（需要登录环境）

## 第十三轮（已上线，见第十四轮）：引导改为「选项」，不替用户选；审稿后推荐同步进度
- 问题（用户反馈）：审稿优化已完成，引导仍建议「接着生成脚本」；引导直接把用户带去下一步，用户不想要也会反感
- 原因：环节完成记录缺了脚本，按「第一个没标完成的环节」推荐，于是回到脚本；另外建议是唯一的主按钮，等于替用户选
- 修正：
  - lib/guide.ts：doneStages 按阶段顺序补齐（后面的环节做完，前面必然做过）；审稿优化完成（或全部环节完成）后，建议是「同步创作进度：标记已拍摄或已发布」（链接到作品库），标题封面作为可选项
  - 每个阶段给 2–3 个选项，最多一个标「建议」，不跳转；GuideOutput 去掉 primary，新增 options 和 intro（「下面几项你自己选，不选也行」）
  - components/guide/GuideCard.tsx：首页大卡列出选项，用户自己点
  - components/guide/GuideChip.tsx：顶栏小条变成按钮，点开看选项，点选项才跳转，换页面自动收起
- 测试：tests/guide.test.ts 32 个用例（含「审稿后不再推荐生成脚本」「不自动跳转」「每组最多一个建议」）；全量 237 个文件、3990 个用例通过；tsc 通过；eslint 0 错误；本地 npm run build 通过
- **未上线**

## 第十二轮：上线（2026-10-20）：地基统一按当前档案；同一页面立即更新
- 全量测试：237 个文件、3981 个用例通过；本地构建通过
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 45 秒，PM2 在线，599 个文件 MD5 全部一致）。BUILD_ID：YxZATd59DCccccMjDZHyz
- 线上核对（只读）：/api/public/ping 204；/login 200；/dashboard 200；/dashboard/membership 200；/dashboard/positioning 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；未登录 POST /api/orders 401；构建含进度事件名 kaiwu:progress-changed（1 个 chunk）与「新手引导」（2 个 chunk）
- 未做：登录后同一页面的立即更新实测（需要登录环境）

## 第十一轮（已上线，见第十二轮）：地基统一按当前档案；同一页面立即更新
- 地基按当前档案：lib/setup-progress.ts 新增 pickProfileForSetup（当前档案在列表里就用它，否则第一个；和引导页一致）。hooks/useSetupProgress.ts 的宽松版和严格版都改为看当前档案的定位
- 同一页面立即更新：新增 lib/progress-events.ts（notifyProgressChanged / onProgressChanged）。档案新建删除、定位新建修改删除、创意简报保存、深挖保存、行业建议保存、作品新建/环节保存（touchWork）/拍摄状态/删除、作品计划日期 等成功后通知
- 订阅方：hooks/useSetupProgress.ts（侧栏、首页地基清单）、hooks/useGuide.ts（顶栏小条、首页大卡）、app/dashboard/page.tsx（首页的档案、定位、作品）。地基钩子加了代数防护：旧请求回来不覆盖新数据
- 例外（不通知，写在测试里）：档案编辑页、访谈入口（只改档案文字字段，地基和作品不变）
- 测试：tests/progress-sync.test.ts 7 个用例（选档案规则、严格版按当前档案取定位、静态扫描所有写入文件都调用了通知，扫描自证非空）
- 验证：全量测试 237 个文件、3981 个用例通过；tsc 通过；eslint 0 错误（首页 7 条警告为原有）；本地 npm run build 通过
- **未上线**

## 第十轮：上线（2026-10-20）：次数包无时限；首页价格区块背景；新手引导（含实时刷新修正）
- 全量测试：236 个文件、3974 个用例通过；本地 npm run build 通过
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 45 秒，PM2 在线，598 个文件 MD5 全部一致）。BUILD_ID：io5pmQZV9IIO0wzgPxY9d
- 线上核对（只读）：/api/public/ping 204；/login 200；/dashboard 200；/dashboard/membership 200；/payment?plan=count_pack_trial_19_9 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；未登录 POST /api/orders 401
- 构建含：新手引导阶段文案「新手 · 第 1 步」、「新手引导」（2 个 chunk）、「次数没有时间限制」（4 个 chunk）、「当前查看」、首页定价区块 glass-panel（1 个 chunk），旧的实心 bg-muted 定价区块已不存在
- 未做：登录后的页面外观核对；落地页（/）的视觉核对（有门票拦截）
- 待确认：地基的定位检查是否统一改为按当前档案（目前取 profiles[0]，作品取当前档案）

## 第九轮（已上线，见第十轮）：次数包没有时间限制；首页价格方案背景；新手引导（2026-10-20）
- 次数包无时限：lib/config/count-packs.ts validDays 365 → null（不过期）；展示文案改为「长期有效」「次数不会过期」；付款页备注和权益同步；迁移不需要改（expires_at 本来可空，审核时写入 null）；注意：未用完的次数会长期挂账，配置注释已写明
- 首页「适合您的方案」背景：原来实心 bg-muted，浅色下和页面底色几乎一样，背景等于没画。改成 glass-panel（和功能、FAQ 区块一致）。tests/landing-pricing-background.test.ts 守住这一点。未能在线上看到效果：首页有门票拦截，没有门票无法进入
- 新手引导（规则驱动，不调用模型）：
  - lib/guide.ts：纯函数 buildGuide。阶段：start（没建档案）→ foundation（地基没做完）→ first_work（地基完成、没做过内容）→ in_progress（有没做完的作品）→ returning（7 天以上没动过）→ active（最近在用）。每个阶段：阶段名、一句话现状、只推荐一件下一步、最多 3 条建议；额度用完时给提醒（次数包有余额会说明会自动接着用）
  - hooks/useGuide.ts：汇总地基（useSetupProgress）、作品（listWorksPage，失败时整块不显示，不拿空列表猜）、额度（/api/quota/check）；建档案、生成完、切换档案时重新算
  - components/guide/GuideCard.tsx：首页顶部大卡，替换原来只在地基没做完时显示的 NextStepHero（已删除）
  - components/guide/GuideChip.tsx：顶栏引导小条（app/dashboard/layout.tsx），所有仪表盘页面都有
  - tests/guide.test.ts：17 个用例（阶段、下一步、建议数量、额度提醒、数据没齐时不给建议、接线）
- 验证：全量测试 236 个文件、3968 个用例通过；tsc 通过；eslint 0 错误（page.tsx 的 7 条警告为原有）；本地 npm run build 通过
- **未上线**；未在浏览器里看过顶栏和首页大卡的实际效果（需要登录）
- 实时性修正（用户追问「推荐是不是实时根据用户情况」后核查）：
  - 原问题：顶栏小条挂在布局里，换页面不重新挂载，不会刷新；地基有 60 秒缓存且从未被清掉；取数失败时地基会被当成「一步都没做」（老用户会被当新用户）；失败标记一旦设置就永远不清
  - 修正：hooks/useSetupProgress.ts 新增 loadSetupStepsStrict（失败抛错、无缓存）；hooks/useGuide.ts 在路由变化、生成完成、切换档案、窗口获得焦点时重新取；地基和作品各自记错误，取成功即清除；任一失败整块不显示
  - 仍然不实时的：同一页里保存了档案或定位，但没有切换页面、也没有切回窗口时，顶栏不会立即更新
  - 已知不一致：地基的定位检查取的是 profiles[0]，作品取的是当前档案（active profile）。多档案用户可能出现两边对不上
  - tests/guide.test.ts 共 23 个用例通过（含严格版取数的失败和成功情况）；tsc 通过；eslint 0 错误

## 第八轮：上线（2026-10-20）：侧边栏去掉额度卡；两类毛玻璃切换（会员中心 + 首页价格方案）
- 全量测试：234 个文件、3948 个用例通过；本地构建通过
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 30 秒，PM2 在线，595 个文件 MD5 全部一致）。BUILD_ID：engRuTLgpk-oSAo0mPTwz
- 线上核对（只读）：/api/public/ping 204；/login 200；/dashboard/membership 200；/payment?plan=count_pack_trial_19_9 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；未登录 POST /api/orders 401；构建含「当前查看」「按月订阅」「不限购，用完可以再买」（各 2 个 chunk）
- 已生效：侧边栏不再有额度卡；会员中心和首页价格方案都是两类毛玻璃切换
- 未做：登录后的页面外观核对；落地页（/）的视觉核对（只核对了构建产物）

## 第七轮（本地）：侧边栏去掉额度卡；两类毛玻璃切换（会员中心 + 首页价格方案）（2026-10-20）
- 侧边栏：components/dashboard/Sidebar.tsx 去掉 SidebarQuotaCard（会员额度卡），底部只剩档案切换；components/quota/SidebarQuotaCard.tsx 已删除（无其他引用）
- 两类切换：新增 components/quota/PurchaseKindSwitch.tsx（客户端组件），两张毛玻璃卡「包月会员 / 次数包」，选中的高亮并标「当前查看」；销售关闭时不渲染
- 会员中心：app/dashboard/membership/page.tsx 用 PurchaseKindSwitch 替换原来的药丸切换；次数包标签下显示 CountPackHero 大卡片
- 首页价格方案：app/page.tsx（客户端组件）同样用 PurchaseKindSwitch；「包月会员」显示 4 张套餐卡，「次数包」显示 CountPackHero 大卡片
- 测试：tests/count-pack-ui.test.ts 18 个用例通过（含两类切换渲染、销售关闭、侧边栏不放额度、首页与会员页接线）；tsc 通过；eslint 0 错误（剩余 4 条警告为原有代码）；本地 npm run build 通过
- **未上线**：线上仍是上一版（侧边栏有会员额度卡，会员中心为药丸切换，首页价格方案无次数包）。待用户确认是否上线

## 第六轮：上线（2026-10-20）：侧边栏撤掉次数包、额度 20 次、会员中心切换、首页一行
- 全量测试：234 个文件、3944 个用例通过；本地构建通过
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 30 秒，PM2 在线，595 个文件 MD5 全部一致）。BUILD_ID：Xf_YA-_-bRvenoisDfK4m
- 线上核对（只读）：/api/public/ping 204；/login 200；/dashboard/membership 200；/payment?plan=count_pack_trial_19_9 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；未登录 POST /api/orders 401；构建含会员页「包月会员」「购买次数包」「会员额度优先」，首页次数包一行文案「会员额度用完后，自动从这里扣」
- 已生效：侧边栏不再有次数包；会员中心顶部切换「包月会员 / 次数包」；首页额度面板内一行；次数包 20 次（审核通过时写入批次）
- 未做：登录后的真实页面查看、真实下单与后台审核（需要你的账号或确认）
- 已知：线上 PM2 日志仍有 failed-to-find-server-action 报错（请求值 "x"，与改动无关）

## 第五轮（本地，未上线）：采用展示方案 1（2026-10-20）
- 理解：用户「我选方案 1」同时适用于会员中心方案 1（顶部切换）和首页方案 1（额度面板内嵌一行）。如只选了其中一组，需要告知
- 会员中心：app/dashboard/membership/page.tsx 顶部加「包月会员 / 次数包 ¥19.9」切换；次数包标签下显示 CountPackHero 大卡片；销售关闭（countPackOpen 为假）时没有切换，只显示套餐。原底部的 CountPackOfferCard 撤掉
- 首页：app/dashboard/page.tsx 额度面板里的次数包改为 CountPackRow（一行：名称 + 规格 / 余额 / 购买按钮 / 提示语）
- components/quota/CountPackPanel.tsx：CountPackPanel、CountPackOfferCard 替换为 CountPackRow、CountPackHero；新增 countPackOpen()
- 测试：tests/count-pack-ui.test.ts 改写（首页一行、会员大卡片、切换、侧边栏不放次数包、付款页接线）；6 个次数包相关测试文件 109 个用例通过；tsc 通过；eslint 0 错误（剩余警告为原有代码）；本地 npm run build 通过
- **未上线**：线上仍是上一版（侧边栏次数包、底部会员页卡片、额度 15 次）。待用户确认是否上线

## 第四轮（本地，未上线）：侧边栏撤掉次数包；额度统一 20 次；展示方案待选（2026-10-20）
- 侧边栏：components/quota/SidebarQuotaCard.tsx 去掉次数包（会员套餐和最紧张功能保留）。测试守护：侧边栏额度卡不得再出现 CountPackPanel / packCredits
- 额度：lib/config/count-packs.ts credits 15 → 20（用户决定「统一为 20 次」）；测试与注释同步。次数在审核通过时写入批次，上线后审核通过的订单发 20 次；已经写入的批次（如有）不会因配置改动而变
- 展示方案：docs/次数包展示方案_20261020/方案对比.html，会员中心 3 个方案、首页 3 个方案，等待用户选定后再落地
- 本地验证：次数包相关 6 个测试文件 109 个用例通过；tsc 通过
- **未上线**：线上仍是上一版（侧边栏有次数包、额度 15 次）。待用户确认是否现在上线本轮改动，并选定展示方案

## 第三轮：重试上线并已上线（2026-10-20）
- SSH 恢复（一条简单命令即通过）。线上只读核对：count_pack_lots / count_pack_reservations / count_pack_ledger 均 http 200；kaiwu_reserve_pack_credit、kaiwu_settle_pack_credit、admin_approve_count_pack_order 均已在 PostgREST 接口清单中；kaiwu_settle_creation、kaiwu_record_creation_completion 存在
- 同步：同步到服务器.ps1 -Yes 一次成功（构建约 30 秒，PM2 在线，595 个文件 MD5 全部一致）。新 BUILD_ID：VWui7AHQQOwdEflNdU0yh
- 线上探测：/api/public/ping 204；/login 200；/payment?plan=count_pack_trial_19_9 200；/api/quota/check 未登录 401；/api/admin/usage-monitor 未登录 403；/admin/usage-monitor 200；未登录 POST /api/orders（次数包）401；线上构建产物中包含次数包购买入口（2 个 chunk）
- 未做：登录后的真实下单、后台审核、到账核对（会产生真实订单，需要你的账号或确认后再做）。管理员后台的数据接口（使用监控）登录后未在线上验证
- PM2 日志仍有 failed-to-find-server-action 报错（请求值为 "x"，与本次改动无关，之前已出现）

## 产品决定更新（2026-10-20，用户最新指示，以此为准）
- 售价方向 19.9 元：已赞同，仅作为设计和明确标注的测试配置使用；不得写成已核算盈利
- 次数包不限购：买一次之后还能再买，不设每账号上限；主要目的是让没用过的用户愿意尝试产品
- 包含额度、一次计费口径、有效期、会员与包额度扣减顺序、退款规则：仍未确定，给推荐选项与依据，实现为可配置
- 首次使用门槛：19.9 元是降低首次尝试顾虑，不代表产品已适合完全不懂短视频的商家
- 正式销售入口保持关闭；生产迁移、部署等待用户确认
- 后台需要「用户使用监控」板块：所有用户的使用频率、次数、Token 消耗、额度使用情况、五维四率图，并给出改进建议

## 次数与成本建议（2026-10-20，用户追问，待确认）
- 真实成本数据（只读）：creation_completion_evidence 近 220 条，单次生成 total_tokens 中位数约 6 万（范围约 3.5 万–12 万，极端最高 35 万）；total_price 全为 0，模型单价未知，无法直接算元/次
- 建议 19.9 尝鲜包：15 次（≈3 条完整链路：选题→脚本→标题→审稿→分镜），有效期 12 个月
- 限购已改为不限购（用户决定），因此不再以「限购一次」作为防替代 49 元会员的手段；替代风险需要靠次数和有效期控制，见最终报告
- 成本敏感性：按每百万 tokens 单价 P 元估算，单次中位成本约 0.06P 元；P 未知前不宣称盈利

## 约束
- 不提交、不推送、不部署（未另行授权）
- 正式销售入口在参数确认前不启用
- 不写入生产数据库；迁移文件未执行
- 不输出密钥
- 不改动 .tmp/ 下的既有文件（本文件除外）
