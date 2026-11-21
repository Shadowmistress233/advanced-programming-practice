# 需求详细设计（DDD）分片稿 · Part B（陈春贤）

> **协作与对齐速查（编写前必读）**：
> 1. 唯一真源：`docs-md/03-设计/03-01 需求开发概要设计_V1.1.md` 与 `docs-md/03-设计/03-05-partA-蒋岳霖.md` 第 1–3 章。
> 2. 统一编码契约：根包 `com.csu.campusloop`、主键与 ID 用 `Integer`、金额用 `BigDecimal`、Redis 键通过 `RedisKey` 生成（前缀 `cl:`）且读写 `try/catch` 降级、错误码严格使用 V1.1 码表（`1001–5002`）。
> 3. 本分片必须落实的 V1.1 关键设计：
>    - **模块 03/05**：三段超时自动解锁（`0` 待确认 24h、`1` 已确认 48h 无责取消；`2` 待面交超预约 24h 置违约并默认扣发起方积分）；**核销角色隔离**（`GET /api/orders/{id}/qrcode` 仅限物品所有者 `to_user_id`，`POST /api/orders/{id}/verify` 仅限发起方 `from_user_id`，预约接口不回传 `verifyCode`）。
>    - **第 5 章**：15 张表（12 张对齐《02 说明书》+ 3 张 `stat_daily`/`activity`/`activity_join`），主键 `int`，`user.password` 存 BCrypt 密文，`report` 兼存积分申诉，初始化脚本可重复执行（`INSERT ... ON DUPLICATE KEY UPDATE`）。
>    - **第 11 章**：仅 `upload/` 配置静态只读映射，`certificate/` 不对外做静态映射。
> 4. 仅修改本文件，写完后让 AI 执行精准提交（不要改他人文件）；11/24 晚由组长统一合稿。每个模块严格按五段式撰写，不留 TODO。

---

# 四、模块详细设计（Part B 负责：模块 03、04、05、08、09）

## （三）双模式流转（模块 03）

### 1、类与职责
（覆盖 `OrderController`、`OrderService`、`OrderServiceImpl`、`ExchangeOrderMapper`、`OrderCreateDTO`、`OrderCancelDTO`、`OrderVO`、`OrderDetailVO`）

### 2、方法设计
（对应 `POST /api/orders`、`POST /api/orders/{id}/confirm`、`POST /api/orders/{id}/cancel`、`GET /api/orders/mine`、`GET /api/orders/{id}`）

### 3、处理流程
（按序编号，标明 `@Transactional` 边界、条件更新 `status=1 -> 2` 成对锁单与取消成对解锁）

### 4、关键规则
（双模式状态机、防重复抢单条件更新、禁止向本人下单、三段超时统一归口到解锁入口）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1003`/`1005`/`2101`/`2102` 及提示语）

## （四）技能交换板块（模块 04）

### 1、类与职责
（覆盖 `SkillController`、`SkillService`、`SkillServiceImpl`、`SkillMapper`、`SkillSaveDTO`、`SkillInviteDTO`、`SkillVO`、`SkillDetailVO`）

### 2、方法设计
（对应 `POST /api/skills`、`GET /api/skills`、`GET /api/skills/{id}`、`POST /api/skills/{id}/invites`）

### 3、处理流程
（发布/编辑/关闭、筛选分页、双向互补匹配计算、邀约写通知）

### 4、关键规则
（同类有效技能 ≤ 3 条、不可邀约本人、已关闭技能禁邀约）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1005`/`2102`/`2201`/`2202` 及提示语）

## （五）预约面交与扫码核销（模块 05）

### 1、类与职责
（覆盖预约与核销接口、`OrderTimeoutTask`、`OrderAppointDTO`、`OrderVerifyDTO`）

### 2、方法设计
（对应 `POST /api/orders/{id}/appointment`、`POST /api/orders/{id}/verify`、`GET /api/orders/{id}/qrcode` 及每小时超时定时任务）

### 3、处理流程
（按序编号：预约生成 `verify_code` 不回传 → 所有者取码 → 发起方扫码条件更新 `order_status=2 -> 3` → 单向调用模块 07 加分与模块 10 发评价提醒；定时任务三段超时扫描）

### 4、关键规则
（角色隔离防自核销、条件更新幂等防重复加分、24h/48h/24h 三段超时规则与默认归责扣发起方分 + 申诉救济）

### 5、异常分支
（写明错误码 `1001`/`1003`/`1005`/`2102`/`2103`/`2104` 及提示语）

## （八）物品检索与筛选（模块 08）

### 1、类与职责
（覆盖 `ItemSearchController`、`ItemSearchService`、`CategoryMapper`、`ItemSearchQuery`、`ItemCardVO`、`CategoryTreeVO`）

### 2、方法设计
（对应 `GET /api/items`、`GET /api/categories/tree`）

### 3、处理流程
（白名单排序映射 → 固定过滤 `status=1 AND is_deleted=0` → 分页查询 → 写入 `cl:search:hot` → 空结果召回同分类兜底）

### 4、关键规则
（排序白名单防 SQL 注入、组合索引命中、每页 12 条上限 50）

### 5、异常分支
（写明错误码 `1001`/`5001` 及提示语）

## （九）智能标签推荐（模块 09）

### 1、类与职责
（覆盖 `RecommendController`、`RecommendService`、`RecommendServiceImpl`、`RecommendItemVO`）

### 2、方法设计
（对应 `GET /api/recommendations`、`POST /api/items/{id}/favorite` 及内部异步打标方法）

### 3、处理流程
（读 `cl:rec:cache:{userId}` → 未命中则读 `cl:tag:user:{userId}` TOP 5 召回排序并写 10 分钟缓存 → 冷启动或 Redis 异常降级 `cl:rank:hot:{campus}` 或数据库热度查询）

### 4、关键规则
（浏览 `+1`/收藏 `+3`/发布 `+5` 与 30 天续期、推荐理由文案生成、所有 Redis 读写 `try/catch` 降级）

### 5、异常分支
（写明错误码 `1001`/`1002`/`1005`/`5001` 与降级行为）

---

# 五、数据库详细设计

## （一）设计约定
（主键 `int` 自增、`utf8mb4`、`InnoDB`、`decimal(10,2)`、状态 `tinyint`、逻辑删除与索引命名规范）

## （二）表清单与容量估算
（15 张表两年数据量预估与增长来源）

## （三）建表语句（15 张表 DDL）
（给出核心表与 3 张新增表 `stat_daily`、`activity`、`activity_join` 及全部基础表可直接执行的 MySQL 5.7 DDL，使用反引号、Consolas 排版友好，字段与《03-01 V1.1》第五章 100% 一致）

## （四）索引与外键约束
（汇总唯一索引、组合索引与外键保留策略）

## （五）初始化数据
（`sql/data.sql`：三类预置模拟账号及 BCrypt 密文、6 个一级分类、2 个社团账号、4 个校内自提点、5 条积分规则，使用 `INSERT ... ON DUPLICATE KEY UPDATE` 支持幂等重跑）

## （六）Redis 键落地规范
（引用 Part A 第 3 章 `RedisKey`，写明 `cl:` 前缀键的序列化方式、TTL 与降级回退）

---

# 七、关键流程时序（Part B 负责第 1、4 条）

## （一）以物易物全流程（含角色隔离核销）
（按步给出参与方、Controller、Service、Mapper、事务边界：发起成对锁单 → 确认 → 预约 → 所有者展示二维码 → 发起方扫码条件更新核销 → 积分加分与消息通知）

## （四）推荐降级流程
（按步给出正常路径与 Redis 不可用/冷启动时的两级降级链路）

---

# 十一、部署与配置

（单机 Tomcat 10.1.61 + MySQL 5.7.17 + Redis 5.0 环境参数、外部 `upload/` 静态映射与 `certificate/` 非静态受保护目录配置、启动检查清单、SQL 快照备份与 Git Tag WAR 包 5 分钟回滚步骤）
