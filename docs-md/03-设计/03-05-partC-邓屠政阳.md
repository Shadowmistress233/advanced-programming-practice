# 需求详细设计（DDD）分片稿 · Part C（邓屠政阳）

> **协作与对齐速查（编写前必读）**：
> 1. 唯一真源：`docs-md/03-设计/03-01 需求开发概要设计_V1.1.md` 与 `docs-md/03-设计/03-05-partA-蒋岳霖.md` 第 1–3 章。
> 2. 统一编码契约：根包 `com.csu.campusloop`、主键与 ID 用 `Integer`、金额用 `BigDecimal`、Redis 键通过 `RedisKey` 生成（前缀 `cl:`）且读写 `try/catch` 降级、错误码严格使用 V1.1 码表（`1001–5002`）。
> 3. 本分片必须落实的 V1.1 关键设计：
>    - **模块 06**：`certificate/` 不做静态暴露，下载接口 `GET /api/donations/{id}/certificate` 鉴权流式输出；新增公开验真接口 `GET /api/donations/verify` 仅返回最小脱敏字段（捐赠人姓名脱敏如“林**”）；PDF 生成失败不回滚审核落库。
>    - **模块 07**：积分申诉复用 `report` 表（`report_type='积分申诉'`，关联原 `credit_log.id`），单条扣分仅可申诉一次，由模块 12 后台处置接口复核并在积分流水回显状态。
>    - **模块 15**：**名额一致性以 MySQL 为唯一真源**（同一事务内 `uk_activity_user` 防重 + `remain_quota > 0` 条件更新 + 落库），Redis Lua 仅作前置预筛层，事务回滚回补 Redis，Redis 挂掉直接穿透 MySQL。
> 4. 仅修改本文件，写完后让 AI 执行精准提交（不要改他人文件）；11/24 晚由组长统一合稿。每个模块严格按五段式撰写，不留 TODO。

---

# 四、模块详细设计（Part C 负责：模块 06、07、15）

## （六）闲置快捐通道（模块 06）

### 1、类与职责
（覆盖 `DonationController`、`DonationService`、`DonationServiceImpl`、`DonationMapper`、`DonationApplyDTO`、`DonationAuditDTO`、`DonationVO`、`DonationCertVO`、`DonationVerifyVO`）

### 2、方法设计
（对应 `POST /api/donations`、`GET /api/donations`、`POST /api/donations/{id}/audit`、`GET /api/donations/{id}/certificate`、`GET /api/donations/verify`）

### 3、处理流程
（按序编号：校验本人且在售并条件更新锁单 → 社团隔离审核 → 生成唯一 `certificate_no` → 解耦渲染 PDF 写入非静态 `certificate/` 目录 → 鉴权流式下载与公开脱敏验真）

### 4、关键规则
（社团 `club_id` 数据隔离、驳回理由必填且解锁物品回在售、PDF 失败降级可重试、公开验真最小脱敏字段边界）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1003`/`1005`/`2101`/`2102`/`2203`/`5002` 及提示语）

## （七）诚信积分与履约评价（模块 07）

### 1、类与职责
（覆盖 `CreditController`、`ReviewController`、`CreditService`、`ReviewService`、`CreditLogMapper`、`ReviewMapper`、`ReviewSubmitDTO`、`CreditAppealDTO`、`CreditLogVO`、`ReviewVO`）

### 2、方法设计
（对应 `GET /api/credits/logs`、`POST /api/reviews`、`GET /api/reviews`、`POST /api/credits/appeals` 及供模块 05/12 单向调用的原子改分方法）

### 3、处理流程
（按序编号：原子 `UPDATE user SET credit_score = credit_score + ?` + 写 `credit_log`；7 天内双向互评与防刷判定；单次申诉写入 `report` 表与进度回显）

### 4、关键规则
（禁止先查后改、四档等级与 60/40 分限制规则、一单一评 `uk_order_from`、同对用户 7 天内高频互评不重复计分、单条扣分限申诉 1 次）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1003`/`1005`/`2102`/`2301`/`2302` 及提示语）

## （十五）换物集市与主题活动（模块 15）

### 1、类与职责
（覆盖 `ActivityController`、`ActivityService`、`ActivityServiceImpl`、`ActivityMapper`、`ActivityJoinMapper`、`ActivitySaveDTO`、`ActivityVO`、`ActivityDetailVO`、`ActivityJoinVO`）

### 2、方法设计
（对应 `POST /api/activities`、`GET /api/activities`、`GET /api/activities/{id}`、`POST /api/activities/{id}/join`）

### 3、处理流程
（按序编号：活动发布/预热 `cl:act:quota:{activityId}`；报名时先 Redis Lua 预筛 → 进入 MySQL `@Transactional` 校验状态与唯一索引防重 + 条件更新 `remain_quota > 0` + 插入 `activity_join` 生成 `join_no` → 事务异常/重复报名时回补 Redis 计数；Redis 异常直接穿透 MySQL 事务）

### 4、关键规则
（MySQL 为名额唯一真源、仅状态 `1` 报名中可报名、`uk_activity_user` 防重、Plan B 裁剪说明）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1003`/`1005`/`2102`/`2401`/`2402` 及提示语）

---

# 六、接口详细设计

## （一）公共约定
（统一 `/api` 前缀、JSON 与 `multipart/form-data`、分页公共字段 `page`/`pageSize`、会话与实时停用拦截、`Result<T>` 响应结构；不重复粘贴概要设计 50 接口大表，直接引用《03-01 V1.1》第四章）

## （二）参数校验规则
（逐项列出核心 DTO：`LoginDTO`、`ItemSaveDTO`、`OrderCreateDTO`、`OrderAppointDTO`、`OrderVerifyDTO`、`DonationApplyDTO`、`DonationAuditDTO`、`ReviewSubmitDTO`、`CreditAppealDTO`、`ActivitySaveDTO` 的注解校验与 Service 业务校验两层规则）

## （三）错误码总表
（与《03-01 V1.1》第四章（二）逐条一致，补齐对应 `ErrorCode` 枚举常量名与默认中文提示语）

---

# 七、关键流程时序（Part C 负责第 2、3 条）

## （二）捐赠到电子凭证与公开验真
（按步给出申请锁单 → 社团审核 → 事务落库与凭证号生成 → 异步/解耦 PDF 渲染与失败重试 → 鉴权流式下载 / 扫码公开脱敏验真）

## （三）诚信积分变动与申诉复核
（按步给出核销/好评/超时/举报触发原子改分 → 写流水与等级重算 → 发起单次申诉写入 `report` → 管理员复核通过后回补积分并通知）
