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
`DashboardController` 接收管理员查询和导出请求，校验校区、起止日期，分别返回公共响应或文件流。`DashboardService` 统一计算指标，供页面和导出复用。`StatDailyMapper` 读写日统计并查询分类分布；`StatDailyTask` 每日汇总前一自然日，支持指定日期重算。`StatDailyVO` 表示一个日期、一个校区的指标；`DashboardVO` 包含区间 KPI、逐日趋势、分类占比、双模式占比及漏斗四个阶段的数量。

### 2、方法设计
| 入口 | 方法与结果 |
| --- | --- |
| `GET /api/admin/dashboard` | `query(String campus, LocalDate startDate, LocalDate endDate)` 返回 `DashboardVO`，控制器封装为 `Result<DashboardVO>`。 |
| `GET /api/admin/dashboard/export` | `export(String campus, LocalDate startDate, LocalDate endDate, OutputStream out)` 使用同一查询口径，通过 Apache POI 写出 .xlsx 文件流。 |
| 每日定时任务 | `aggregate(LocalDate statDate)` 对指定自然日分别生成各校区及全校统计，按日期和校区唯一键写入。 |

### 3、处理流程
1. 日汇总。从统计日零点取到次日零点之前。发布按物品发布时间计数，流转意向按发起时间计数，交换和寄售按同批流转单的 trade_mode 分组；成交按核销完成时间计数，捐赠按审核通过时间计数。流转单按目标物品归属校区统计。违约归入实际转为违约的日期，浏览归入访问发生日期。
2. 写入。按 `uk_date_campus(stat_date,campus)` 执行 `INSERT ... ON DUPLICATE KEY UPDATE`，将可重算指标覆盖为本次计算值。全校行使用 `campus='ALL'`。查询全校时仅取 ALL 行；查询单校区时只取该校区。
3. 展示。按含首尾两天的日期区间读取日表，累计发布、成交、审核通过捐赠及违约数，按日期输出发布和成交趋势。分类占比另查同期同校区发布物品，按 category_id 分组并除以发布总数。交换与寄售分别除以两种模式单数之和。漏斗依次展示 publish_count、view_count、order_count、finish_count 的区间合计；浏览单位为次，意向和成交单位为单，属于期间业务量。
4. 导出。以相同筛选参数获取看板结果，将校区、日期范围、指标和逐日明细写入工作簿。使用 Apache POI 的 SXSSFWorkbook 分批写行并释放临时文件；下载文件名包含校区和日期范围。

### 4、关键规则
区间违约率取 `SUM(default_count) / SUM(order_count)`，以百分比展示。两天分别有 1/2、0/8 笔违约时，区间结果为 10%。分母为零时比率返回 0；已完成汇总且无业务的日期返回零值，页面展示统一空态。

日指标重跑必须能追溯到统计日。现有物品 view_count 只保存累计次数，订单当前状态也不能确定实际转为违约的日期。建议由浏览处理和违约状态转换在业务写入成功时，于同一事务按日期更新校区行及 ALL 行的对应计数；违约仅在条件更新成功一次时计入。采用此方案时，日任务仅覆盖可从业务明细重算的列，保留已累积的 view_count、default_count，避免重跑清零或重复累加。此写入约定需与对应模块负责人对齐；缺少采集记录的历史区间不能作为零业务验收。立项 Plan B 启用时可暂缓本模块，看板与导出均独立于流转主流程。

### 5、异常分支
两个接口均先校验管理员身份：会话缺失或过期返回 `1002`「未登录」，角色不符返回 `1003`「无权限」。导出生成失败且响应尚未提交时返回 `5001`「系统异常」；若文件流已开始发送，则终止下载并记录失败，避免将 JSON 拼入工作簿。日任务失败时回滚本次事务并记录日期与校区，修复后按原统计日重跑。

## （十二）后台审核与违规处置（模块 12）

### 1、类与职责
`AdminAuditController` 接收待审查询及审核决定；`ReportController` 分别接收用户举报、管理员查询与处置请求；`AdminDictController` 校验字典类型和操作。`AdminAuditService` 管理物品状态转换，`ReportService` 按工单类型执行处罚或申诉复核，`ReportMapper` 负责工单新增、筛选和条件更新。`ItemAuditDTO` 携带物品 ID 列表、决定及原因，`ReportSubmitDTO` 携带举报对象、类型和说明，`ReportHandleDTO` 携带处理状态、动作及备注。经办人从 Session 取得，所有接口 ID 均为 Integer。

### 2、方法设计
| 接口 | 方法、参数与成功结果（由公共 Result 封装） |
| --- | --- |
| `GET /api/admin/items/pending` | listPending(campus, categoryId, page, pageSize)：按校区、分类筛选待审物品，返回 PageInfo<PendingItemVO>。 |
| `POST /api/admin/items/audit` | audit(itemIds, pass, reason)：审核一个或多个物品，返回 processedCount。 |
| `POST /api/reports` | submit(itemId, reportType, reportContent)：按登录用户创建普通举报，返回 reportId、handleStatus。 |
| `GET /api/admin/reports` | listReports(handleStatus, reportType, page, pageSize)：按状态和工单类型筛选，返回 PageInfo<ReportVO>。 |
| `POST /api/admin/reports/{id}/handle` | handle(id, handleStatus, action, remark)：处理一个待办工单，返回 reportId、handleStatus。 |
| `POST /api/admin/dicts/{dictType}` | maintain(dictType, op, payload)：对白名单内字典执行对应操作，返回操作结果或列表。 |

### 3、处理流程
1. 物品审核。校验 itemIds 非空并去重，驳回时校验原因。按 ID 升序在同一事务内把待审物品更新为在售（1）或已下架（4）；任一记录已离开待审状态则整批回滚。通过时逐件调用模块 07 记发布积分；驳回时向发布者说明原因。提交成功后通过模块 10 通知发布者。
2. 工单分流。普通举报按允许的违规类型校验，reporter_id 取会话用户，说明不超过 500 字，初始 handle_status=0。积分申诉由模块 07 的专用入口建单，report_type 为“积分申诉”，report_content 关联原 credit_log.id 与理由；普通举报入口拒绝该保留类型。
3. 管理员处置。在事务中读取工单，按 id 和 handle_status=0 条件写入目标状态、handle_user、handle_time。影响一行才执行对应动作：违规核实可下架物品、扣 15 分、限制发布或停用账号；根据已核实的对象执行，无法确定被处置账号时不得处罚。申诉通过时核对原扣分流水与申请人，通过模块 07 追加对应回补流水，保留原流水。驳回只记录结果。处置成功为 1，驳回为 2；动作失败则工单状态与业务变更一并回滚。事务提交后通知申请人。
4. 字典维护。分类、成色、自提点、积分规则分别校验操作和字段。删除分类前在事务内检查其物品及子分类引用；若存在引用，保留原记录并返回冲突。对分类的引用写入与删除使用一致的锁定顺序，避免检查后又新增引用。

### 4、关键规则
五个 /api/admin/ 接口限 admin，普通举报接口要求有效登录。停用账号在处置事务中写入 user.status=0；此后即使用户持有旧 Session，AuthInterceptor 也会在下一次受保护请求进入控制器前复核状态并销毁会话。所有操作经模块 14 的 `@OperLog` 留痕，记录经办人、目标、动作及结果。两名管理员同时处理同一工单时仅允许一次状态转换和一次处罚或回补。

### 5、异常分支
| 错误码与提示 | 触发条件及结果 |
| --- | --- |
| 1001 参数错误 | 拒绝空审核列表、缺少驳回原因、非法字典类型或与工单不符的处置动作，数据保持原状。 |
| 1002 未登录 | Session 缺失或过期，提示重新登录。 |
| 1003 无权限 | 非管理员访问后台队列或提交后台操作，拦截请求。 |
| 1005 账号已停用 | 账号已停用但旧会话仍发起受保护请求，销毁会话并终止处理。 |
| 2102 状态冲突 | 物品已审核、工单已处置或待删除分类仍被引用；提示刷新记录或先解除引用，重复请求不再记分。 |

## （十三）个人中心与信用档案（模块 13）

### 1、类与职责
`UserProfileController` 从 Session 取得本人 ID，校验请求并封装公共响应。`UserProfileService` 读取个人与信用资料、更新准许维护的字段、校验并更换密码。`ProfileUpdateDTO` 只绑定 campus 和 college；`PasswordUpdateDTO` 接收原密码、新密码和确认值。`UserProfileVO` 按展示字段组装个人名片、认证状态、信用等级和评价标签。

### 2、方法设计
| 本人接口 | 服务方法 | 成功响应 |
| --- | --- | --- |
| `GET /api/users/me` | `getProfile(Integer userId)`，无客户端参数 | `Result<UserProfileVO>` |
| `POST /api/users/me/profile` | `updateProfile(Integer userId, ProfileUpdateDTO dto)`，接收 campus、college | `Result<UserProfileVO>`，返回更新后的资料 |
| `POST /api/users/me/password` | `updatePassword(Integer userId, PasswordUpdateDTO dto)`，接收 oldPassword、newPassword、confirmPassword | 公共响应 code=0，data 为 null |

### 3、处理流程
1. 查看。认证拦截器核验会话及账号状态后，服务按本人 ID 查询展示字段和信用概览，将敏感标识脱敏后返回。个人中心 [UI-19] 的名片链接至信用档案 [UI-14]。切换“我的发布、我的流转、我的捐赠、我的技能”时按本人身份分别分页加载；个人资料响应只返回概览。
2. 编辑。服务校验提交的校区、学院，仅更新本次提交且合法的可写字段，更新条件绑定会话用户 ID。提交成功后重新读取资料生成响应；若校区变更，同步当前 Session 中的校区，以便后续页面读取新值。
3. 改密。页面提示密码强度与两次输入是否一致，服务端独立校验。事务内按本人 ID 锁定账号行，以 BCrypt 比对原密码与当前哈希；匹配后为新密码生成 BCrypt 哈希并更新。并发请求依次校验最新哈希，改密成功后保留当前会话。

### 4、关键规则
资料页将学号、姓名和认证状态设为只读。服务端忽略请求夹带的身份、信用和只读字段。例如同时提交有效的新学院和另一学号时，只更新学院，回读的学号保持原值。所有响应均排除 password 及其哈希；改密操作的日志只记录操作结果，禁止记录请求体中的密码或确认值。

### 5、异常分支
| 错误码与提示 | 触发条件与处理 |
| --- | --- |
| 1001 参数错误 | 可写字段值非法、密码参数缺失、新密码强度不合规或两次输入不一致；提示修正相应输入，本次不写入。 |
| 1002 未登录 | 会话缺失或已过期，提示重新登录。 |
| 1005 账号已停用 | 拦截器复核到账号停用，销毁旧会话并终止请求。 |
| 2303 原密码错误 | BCrypt 比对失败，保留原密码哈希并提示重新输入原密码。 |

## （十四）操作日志审计（模块 14）

### 1、类与职责
`@OperLog` 在业务入口声明操作类型；`OperLogAspect` 在调用前后收集审计信息。`OperLogService` 接收已脱敏的记录并异步写入，同时提供分页查询；`OperLogMapper` 负责向 oper_log 插入记录及按条件检索。`OperLogController` 提供管理员只读入口，`OperLogVO` 返回账号、角色、操作类型、脱敏摘要、时间及客户端 IP。

### 2、方法设计
| 入口或方法 | 输入与结果 |
| --- | --- |
| `@Around` 环绕通知 | 接收连接点和注解，仅执行一次目标方法，保留原返回值或异常；将操作结果、耗时及上下文交给记录服务。 |
| `OperLogService.appendAsync` | 接收独立的脱敏记录快照，由线程池执行 Mapper 单行插入。 |
| `GET /api/admin/audit-logs` | 管理员可传 userName、operType、startTime、endTime、page、pageSize，返回 `Result<PageInfo<OperLogVO>>`。 |

### 3、处理流程
1. 在登录、发布、审核、流转、核销、捐赠审核、积分调整及账号处置入口标注操作类型。切面在请求线程读取账号、角色、客户端 IP 和开始时间；登录成功后从新会话补取身份，未识别身份时允许 user_id 为空。
2. 目标调用结束时计算耗时，按允许的字段组装目标标识、结果与耗时摘要。涉及事务的成功变更在提交后投递成功记录，回滚按失败记录。记录快照携带操作发生时间，不把请求或 Session 对象传给后台线程。
3. 后台线程将快照映射到 user_id、user_name、role、oper_type、oper_desc、oper_time、ip_address 并插入。查询时按指定账号、类型及时间区间组合筛选，按 oper_time、id 倒序稳定分页，默认每页 12 条、上限 50 条。后台导航 [UI-17] 的详情抽屉复用选中行的脱敏数据。

### 4、关键规则
先筛选和脱敏，再限制 oper_desc 总长度为 255 字符。摘要仅保留定位操作所需的信息；学号按展示规则遮蔽，密码、密码哈希、核销码和会话凭据均不采集。查询视图只读，无编辑、删除控件及对应接口。队列拒绝任务或异步插入失败时，以应用日志记录操作类型和失败原因，避免再次触发审计切面。审计故障不改变业务结果：管理员已提交的账号停用继续生效，原业务异常也须原样传播。

### 5、异常分支
查询前由公共鉴权组件检查会话及管理员角色。Session 缺失或过期返回 `1002`「未登录」；已登录的非管理员访问返回 `1003`「无权限」，两种情形均不读取日志。管理员筛选后无匹配记录时返回成功及空分页。

---

# 九、日志与监控

（区分访问日志、业务日志、安全审计日志三类格式与脱敏规范；监控指标：接口耗时、错误率、待面交超 24h 积压数、Redis 降级触发次数）

---

# 十、测试要点

（按“并发与防重、幂等与定时任务、角色与安全边界、状态机非法流转、非核心依赖降级”五个维度整理关键测试用例表，覆盖所有 V1.1 核心闭环与安全场景）
