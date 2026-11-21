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
`MessageController` 从 Session 获取当前用户 ID，校验请求参数，以公共 `Result<T>` 返回结果。`MessageService` 定义查询、标记已读、统计和模板发送方法；`MessageServiceImpl` 实现归属校验、事务控制和模板渲染。`NotifyMapper` 读写 MySQL 的 `notify` 表。`NotifyTemplateEnum` 为每种业务事件定义通知类型、标题、正文和必填占位符。`NotifyVO` 对外提供 id、title、content、notifyType、isRead、createTime。

### 2、方法设计
| 入口 | Service 方法 | 输入与返回 |
| --- | --- | --- |
| `GET /api/messages` | `list(Integer userId, String notifyType, Integer isRead, Integer page, Integer pageSize)` | 两个筛选条件均可省略；返回 `PageInfo<NotifyVO>`。 |
| `POST /api/messages/read` | `markRead(Integer userId, Integer notifyId, Boolean all)` | 单条模式提供正整数 notifyId；全部模式仅传 all=true。返回含 unreadCount 的对象。 |
| `GET /api/messages/unread-count` | `countUnread(Integer userId)` | 无客户端入参；返回含 unreadCount 的对象。 |
| 业务模块内部调用 | `send(Integer recipientId, NotifyTemplateEnum template, Map<String,String> arguments)` | 调用方提供接收人和模板参数，无返回值；本模块不反向调用业务模块。 |

### 3、处理流程
1. 生成通知。业务事务提交成功后，按模板检查必填参数，渲染标题与正文，独立事务写入接收人、类型和未读状态。业务事务回滚时跳过发送。标题最多 100 字符，正文最多 500 字符。
2. 分页查询。以 `user_id = 当前用户` 为固定条件，再追加类型和阅读态筛选。`PageHelper.startPage` 后立即执行查询，按 create_time、id 双降序排列。页码默认 1，每页默认 12 条，上限 50。
3. 标记已读。单条模式在事务内按 id 和 user_id 查询归属，再以相同条件和 `is_read=0` 更新为 1；本人已读消息直接成功。全部模式仅更新当前用户的未读行。两种模式均在更新后统计当前用户剩余未读数并返回。

### 4、关键规则
类型限定为 order、audit、credit、system；阅读态 0 表示未读，1 表示已读。未读统计按 `user_id` 和 `is_read=0` 计数，复用索引 `idx_notify_user`。顶部红点每 30 秒请求一次统计接口，直接显示服务端返回值。重复或并发标记同一条消息只改变一次状态：起初有 3 条未读且期间无新消息时，连续两次标记同一条后均返回 2。

### 5、异常分支
公共拦截器在三个接口执行前校验身份。Session 缺失或过期返回 `1002`「未登录」；已登录用户被停用时销毁旧 Session，返回 `1005`「账号已停用」。单条标记找不到属于当前用户的目标时统一返回 `1003`「无权限」，避免暴露他人消息是否存在。筛选值非法或标记模式参数矛盾时按公共参数校验返回 `1001`，不执行更新。模板参数缺失、渲染超长或通知写入失败时记录模板、接收人 ID 与失败原因，不记录消息正文，不回滚已提交的主业务。

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
