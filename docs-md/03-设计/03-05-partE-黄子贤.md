# 需求详细设计（DDD）分片稿 · Part E（黄子贤）

> **协作与对齐速查（编写前必读）**：
> 1. 唯一真源：`docs-md/03-设计/03-01 需求开发概要设计_V1.1.md` 与 `docs-md/03-设计/03-05-partA-蒋岳霖.md` 第 1–3 章。
> 2. 统一编码契约：根包 `com.csu.campusloop`、主键与 ID 用 `Integer`、金额用 `BigDecimal`、错误码严格使用 V1.1 码表（`1001–5002`）。
> 3. 本分片必须落实的 V1.1 关键设计：
>    - **模块 12**：`report` 处置队列同时承接违规举报与积分申诉（`report_type='积分申诉'`），复核通过需联动模块 07 回补积分；停用账号（`user.status=0`）后，旧会话在下次请求受保护接口时立即失效并返回 `1005`。
>    - **第 10 章测试要点**：务必包含 V1.1 新增的核心验收场景——“用户已登录 → 管理员停用 → 旧会话再提交返回 `1005`”、“所有者出码 / 发起方核销角色隔离防自核销”、“`certificate/` 无法绕过鉴权下载 + 公开验真脱敏”、“三段超时（24h/48h/24h）自动释放”、“活动报名 Redis 宕机降级 MySQL 防超卖”。
> 4. 仅修改本文件，写完后让 AI 执行精准提交（不要改他人文件）；11/24 晚由组长统一合稿。每个模块严格按五段式撰写，不留 TODO。

---

# 四、模块详细设计（Part E 负责：模块 10、11、12、13、14）

## （十）站内消息与通知（模块 10）

### 1、类与职责
（覆盖 `MessageController`、`MessageService`、`MessageServiceImpl`、`NotifyMapper`、`NotifyTemplateEnum`、`NotifyVO`）

### 2、方法设计
（对应 `GET /api/messages`、`POST /api/messages/read`、`GET /api/messages/unread-count` 及供业务模块单向调用的模板发送方法）

### 3、处理流程
（模板占位符渲染 → 异步或独立异常捕获写入 `notify`；按类型筛选分页；单条/全部标为已读并校验归属）

### 4、关键规则
（消息写入失败仅记日志不回滚主业务、30 秒轻量轮询未读数）

### 5、异常分支
（写明错误码 `1002`/`1003`/`1005` 及提示语）

## （十一）统计分析与数据看板（模块 11）

### 1、类与职责
（覆盖 `DashboardController`、`DashboardService`、`StatDailyMapper`、`StatDailyTask`、`DashboardVO`、`StatDailyVO`）

### 2、方法设计
（对应 `GET /api/admin/dashboard`、`GET /api/admin/dashboard/export` 及每日预聚合定时任务）

### 3、处理流程
（定时任务按天×校区统计并 `INSERT ... ON DUPLICATE KEY UPDATE` 写入 `stat_daily`；看板按区间查预聚合表拼装 KPI/趋势/占比/漏斗；Apache POI 流式导出 Excel）

### 4、关键规则
（违约率口径、预聚合幂等重跑、空数据安全返回 0、Plan B 裁剪说明）

### 5、异常分支
（写明错误码 `1002`/`1003`/`5001` 及提示语）

## （十二）后台审核与违规处置（模块 12）

### 1、类与职责
（覆盖 `AdminAuditController`、`ReportController`、`AdminDictController`、`AdminAuditService`、`ReportService`、`ReportMapper`、`ItemAuditDTO`、`ReportSubmitDTO`、`ReportHandleDTO`）

### 2、方法设计
（对应 `GET /api/admin/items/pending`、`POST /api/admin/items/audit`、`POST /api/reports`、`GET /api/admin/reports`、`POST /api/admin/reports/{id}/handle`、`POST /api/admin/dicts/{dictType}`）

### 3、处理流程
（批量审物品通过置在售+触发发布加分/驳回必选原因置下架；`report` 队列区分违规举报处置与积分申诉复核；字典维护与删除引用校验）

### 4、关键规则
（仅 `admin` 角色可访问、不可重复审核/处置非待处理记录、停用账号即时生效、全操作加 `@OperLog` 留痕）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1003`/`1005`/`2102` 及提示语）

## （十三）个人中心与信用档案（模块 13）

### 1、类与职责
（覆盖 `UserProfileController`、`UserProfileService`、`ProfileUpdateDTO`、`PasswordUpdateDTO`、`UserProfileVO`）

### 2、方法设计
（对应 `GET /api/users/me`、`POST /api/users/me/profile`、`POST /api/users/me/password`）

### 3、处理流程
（查询个人资料脱敏去密码；更新仅放行 `campus`/`college` 锁定学号与认证态；改密 BCrypt 比对原密码后以新哈希更新并保留会话）

### 4、关键规则
（响应绝不返回 `password`、只读身份字段服务端白名单忽略非法提交）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1005`/`2303` 及提示语）

## （十四）操作日志审计（模块 14）

### 1、类与职责
（覆盖 `@OperLog` 注解、`OperLogAspect`、`OperLogController`、`OperLogService`、`OperLogMapper`、`OperLogVO`）

### 2、方法设计
（对应 `GET /api/admin/audit-logs`、AOP `@Around` 拦截与异步入库方法）

### 3、处理流程
（切面提取登录人/角色/IP/耗时与脱敏参数摘要 → 提交异步线程池落库 `oper_log`；管理员只读多维分页查询）

### 4、关键规则
（严格只读无删改接口、异步失败不阻塞主请求、密码与学号等敏感信息脱敏）

### 5、异常分支
（写明错误码 `1002`/`1003` 及提示语）

---

# 九、日志与监控

（区分访问日志、业务日志、安全审计日志三类格式与脱敏规范；监控指标：接口耗时、错误率、待面交超 24h 积压数、Redis 降级触发次数）

---

# 十、测试要点

（按“并发与防重、幂等与定时任务、角色与安全边界、状态机非法流转、非核心依赖降级”五个维度整理关键测试用例表，覆盖所有 V1.1 核心闭环与安全场景）
