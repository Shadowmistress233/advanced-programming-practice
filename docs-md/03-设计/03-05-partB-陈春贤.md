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

1、**库与字符集**：库名固定 `campus_loop`，默认字符集 `utf8mb4`、排序规则 `utf8mb4_general_ci`（MySQL 5.7 兼容），存储引擎统一 `InnoDB`、行格式 `DYNAMIC`。

2、**主键与业务 ID**：15 张表主键一律 `int NOT NULL AUTO_INCREMENT`，与 Java `Integer` 一一对应；接口层 ID 参数同为 `Integer`，禁止 `long`/`String` 混用，避免 MyBatis 类型映射错位。

3、**金额**：仅 `item.price` 涉及金额，统一 `decimal(10,2) DEFAULT 0.00`，Java 侧 `BigDecimal` 以 `RoundingMode.HALF_UP` 保留 2 位；禁止 `double`/`float`（浮点误差会使“寄售价 ≤ 同类均价 3 倍”的比对失准）。

4、**时间**：统一 `datetime`；`create_time` 默认 `CURRENT_TIMESTAMP`，`update_time` 附 `ON UPDATE CURRENT_TIMESTAMP` 交由数据库维护，业务代码不手工赋值，避免应用服务器时区与数据库不一致。

5、**状态**：一律 `tinyint`，取值含义写入列 `COMMENT`；用字符串存状态会破坏组合索引选择性，也使 `UPDATE ... WHERE status = ?` 的条件更新失去意义。

6、**逻辑删除**：仅历史业务主表 `item`、`activity` 保留 `is_deleted`；其余单据表不设逻辑删除，防止历史流水被“消失”而无法审计。

7、**命名规范**：表名与字段名小写下划线；普通索引 `idx_`、唯一索引 `uk_`、外键 `fk_`，索引名直接体现字段组合（如 `idx_cate_status`），便于 `GlobalExceptionHandler` 按 `DuplicateKeyException` 的索引名映射错误码（`uk_order_from` → `2301`、`uk_activity_user` → `2402`）。

8、**建表顺序**：`user` → `category` → `item` → `item_image` → 其余业务表 → `stat_daily` / `activity` / `activity_join`。全库仅 `item.owner_id`、`item_image.item_id` 两个物理外键，故必须先建被引用表。

9、**MyBatis 映射**：`mybatis-config.xml` 开启 `mapUnderscoreToCamelCase=true`；VO 聚合查询使用显式 `resultMap`，禁止 `SELECT *`，避免后续加字段撑大结果集。

10、**表来源**：15 张表 = 12 张沿用《项目开发文档说明书》表名与字段名（`user` 至 `oper_log`）+ 3 张本次新增（`stat_daily`、`activity`、`activity_join`），字段与《03-01 需求开发概要设计（V1.1）》第五章（二）逐列一致，无增删改。

## （二）表清单与容量估算

| 序号 | 表名 | 中文名 | 归属模块 | 两年预估行数 | 增长来源 | 归档与清理策略 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `user` | 用户表 | 01 | 2,000 | 学生、社团、管理员注册 | 不清理 |
| 2 | `category` | 物品分类表 | 02/08 | 60 | 两级分类字典 | 不清理 |
| 3 | `item` | 物品表 | 02 | 100,000 | 发布闲置，按 10 万基线 | 逻辑删除留痕，历史不物理删 |
| 4 | `item_image` | 物品图片表 | 02 | 350,000 | 每件平均 3.5 张 | 随物品逻辑删除保留 |
| 5 | `skill` | 技能表 | 04 | 8,000 | 技能发布 | 关闭置 `status=0` 不删 |
| 6 | `exchange_order` | 流转单表 | 03/05 | 60,000 | 交换与寄售发起 | 终态单据永久保留 |
| 7 | `donation` | 捐赠记录表 | 06 | 15,000 | 闲置快捐 | 凭证永久保留 |
| 8 | `credit_log` | 诚信积分流水表 | 07 | 250,000 | 每次积分增减一条 | 永久保留，供申诉回溯 |
| 9 | `review` | 履约评价表 | 07 | 50,000 | 每单最多一条 | 永久保留 |
| 10 | `notify` | 站内通知表 | 10 | 800,000 | 每单触发 3～5 条 | 保留 180 天，超期按月归档 |
| 11 | `report` | 举报表 | 12 | 3,000 | 违规举报与积分申诉 | 永久保留 |
| 12 | `oper_log` | 操作日志表 | 14 | 1,200,000 | 后台每次操作一条 | 保留 90 天，超期按月归档 |
| 13 | `stat_daily` | 统计日表 | 11 | 1,500 | 每日 × 校区维度 | 永久保留 |
| 14 | `activity` | 活动表 | 15 | 200 | 主题活动 | 逻辑删除 |
| 15 | `activity_join` | 活动报名表 | 15 | 8,000 | 学生报名 | 永久保留 |

**容量估算**：以 10 万条物品为基线，按各表平均行宽加权（`item` 约 1.2KB、`notify` 与 `oper_log` 约 0.5KB、其余 0.2～0.6KB）估算，数据总量约 1.3GB；叠加主键、唯一索引与组合索引（约 0.8 倍开销），两年总占用约 2.2～2.6GB。单机 MySQL 5.7 下该量级全表扫描仍在秒级以内，故检索类查询依赖组合索引而非分区，不引入分库分表。

增长最快的两张表是 `oper_log`（后台每次操作一条）与 `notify`（每单 3～5 条），二者合计占总量约 70%，因此按上表设定 90 天 / 180 天的归档窗口；`stat_daily` 按天预聚合，用 1,500 行换掉了看板对 `item`、`exchange_order` 的实时全量聚合。

## （三）建表语句（15 张表 DDL）

以下脚本按第（一）节第 8 条的依赖顺序排列，可直接在 MySQL 5.7 上执行；全部使用反引号包裹标识符（`user`、`status` 等在不同版本中可能成为保留字），字段与《03-01 V1.1》第五章（二）100% 一致。

```sql
-- ============================================================
-- 校园闲置互助流转平台 Campus Loop
-- 建库与建表脚本 sql/schema.sql
-- 目标版本：MySQL 5.7.17 ｜ 字符集 utf8mb4 ｜ 引擎 InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS `campus_loop`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `campus_loop`;

-- 1. 用户表（说明书已有）
CREATE TABLE IF NOT EXISTS `user` (
  `id`           int           NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`     varchar(30)   NOT NULL                COMMENT '登录账号',
  `password`     varchar(100)  NOT NULL                COMMENT 'BCrypt 哈希密文',
  `real_name`    varchar(50)   DEFAULT NULL            COMMENT '真实姓名或社团名',
  `role`         varchar(20)   NOT NULL                COMMENT 'admin/club/student',
  `student_no`   varchar(20)   DEFAULT NULL            COMMENT '学号',
  `college`      varchar(50)   DEFAULT NULL            COMMENT '所属学院',
  `campus`       varchar(30)   DEFAULT NULL            COMMENT '所在校区',
  `credit_score` int           DEFAULT 100             COMMENT '诚信积分',
  `auth_status`  tinyint       DEFAULT 0               COMMENT '0未认证 1已认证 2驳回',
  `status`       tinyint       DEFAULT 1               COMMENT '1正常 0停用',
  `create_time`  datetime      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time`  datetime      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 物品分类表（说明书已有）
CREATE TABLE IF NOT EXISTS `category` (
  `id`            int         NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_name` varchar(50) NOT NULL                COMMENT '分类名称',
  `parent_id`     int         DEFAULT 0               COMMENT '上级分类ID，一级为0',
  `sort_no`       int         DEFAULT 0               COMMENT '排序号，越小越靠前',
  `is_show`       tinyint     DEFAULT 1               COMMENT '1展示 0隐藏',
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物品分类表';

-- 3. 物品表（说明书已有）
CREATE TABLE IF NOT EXISTS `item` (
  `id`              int            NOT NULL AUTO_INCREMENT COMMENT '主键',
  `owner_id`        int            NOT NULL                COMMENT '发布人ID',
  `title`           varchar(100)   NOT NULL                COMMENT '物品标题',
  `category_id`     int            NOT NULL                COMMENT '分类ID',
  `condition_level` varchar(20)    DEFAULT NULL            COMMENT '全新/九成新/七成新/可用',
  `trade_mode`      varchar(20)    NOT NULL                COMMENT 'exchange/consign',
  `expect_item`     varchar(100)   DEFAULT NULL            COMMENT '交换模式期望物品',
  `price`           decimal(10,2)  DEFAULT 0.00            COMMENT '寄售价格',
  `campus`          varchar(30)    DEFAULT NULL            COMMENT '所在校区',
  `trade_place`     varchar(50)    DEFAULT NULL            COMMENT '建议校内面交地点',
  `description`     varchar(1000)  DEFAULT NULL            COMMENT '物品描述',
  `cover_url`       varchar(255)   DEFAULT NULL            COMMENT '封面图路径',
  `status`          tinyint        DEFAULT 0               COMMENT '0待审核 1在售 2锁定 3已完成 4已下架',
  `view_count`      int            DEFAULT 0               COMMENT '浏览次数',
  `is_deleted`      tinyint        DEFAULT 0               COMMENT '0正常 1已删除',
  `create_time`     datetime       DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  `update_time`     datetime       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_owner` (`owner_id`),
  KEY `idx_cate_status` (`category_id`, `status`),
  KEY `idx_campus_status` (`campus`, `status`),
  CONSTRAINT `fk_item_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物品表';

-- 4. 物品图片表（说明书已有）
CREATE TABLE IF NOT EXISTS `item_image` (
  `id`          int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_id`     int          NOT NULL                COMMENT '物品ID',
  `img_url`     varchar(255) NOT NULL                COMMENT '图片访问路径',
  `sort_no`     int          DEFAULT 0               COMMENT '排序号，0为封面',
  `create_time` datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  KEY `idx_item` (`item_id`),
  CONSTRAINT `fk_image_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物品图片表';

-- 5. 技能表（说明书已有）
CREATE TABLE IF NOT EXISTS `skill` (
  `id`           int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      int          NOT NULL                COMMENT '发布人ID',
  `skill_name`   varchar(50)  NOT NULL                COMMENT '技能名称',
  `skill_type`   tinyint      NOT NULL                COMMENT '1我能提供 2我需要',
  `level`        varchar(20)  DEFAULT NULL            COMMENT '入门/熟练/精通',
  `description`  varchar(500) DEFAULT NULL            COMMENT '服务时间与说明',
  `expect_skill` varchar(100) DEFAULT NULL            COMMENT '期望交换内容',
  `status`       tinyint      DEFAULT 1               COMMENT '1有效 0已关闭',
  `create_time`  datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  PRIMARY KEY (`id`),
  KEY `idx_skill_user` (`user_id`),
  KEY `idx_skill_name` (`skill_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能表';

-- 6. 流转单表（说明书已有）
CREATE TABLE IF NOT EXISTS `exchange_order` (
  `id`            int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no`      varchar(32)  NOT NULL                COMMENT '流转单号',
  `item_id`       int          NOT NULL                COMMENT '目标物品ID',
  `from_user_id`  int          NOT NULL                COMMENT '发起方ID（指定核销人）',
  `to_user_id`    int          NOT NULL                COMMENT '物品所有者ID（二维码展示方）',
  `trade_mode`    varchar(20)  NOT NULL                COMMENT 'exchange/consign',
  `offer_item_id` int          DEFAULT NULL            COMMENT '交换模式换出物品ID',
  `order_status`  tinyint      DEFAULT 0               COMMENT '0待确认 1已确认 2待面交 3已完成 4已取消 5已违约',
  `appoint_time`  datetime     DEFAULT NULL            COMMENT '预约面交时间',
  `appoint_place` varchar(50)  DEFAULT NULL            COMMENT '预约校内自提点',
  `verify_code`   varchar(64)  DEFAULT NULL            COMMENT '一次性核销码',
  `finish_time`   datetime     DEFAULT NULL            COMMENT '核销完成时间',
  `close_reason`  varchar(255) DEFAULT NULL            COMMENT '取消或违约原因',
  `create_time`   datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_item_status` (`item_id`, `order_status`),
  KEY `idx_from_user` (`from_user_id`),
  KEY `idx_to_user` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流转单表';

-- 7. 捐赠记录表（说明书已有）
CREATE TABLE IF NOT EXISTS `donation` (
  `id`             int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_id`        int          NOT NULL                COMMENT '捐赠物品ID',
  `donor_id`       int          NOT NULL                COMMENT '捐赠人ID',
  `club_id`        int          NOT NULL                COMMENT '接收公益社团ID',
  `audit_status`   tinyint      DEFAULT 0               COMMENT '0待审核 1通过 2驳回',
  `audit_user`     varchar(30)  DEFAULT NULL            COMMENT '审核人账号',
  `audit_time`     datetime     DEFAULT NULL            COMMENT '审核时间',
  `audit_remark`   varchar(255) DEFAULT NULL            COMMENT '审核意见',
  `certificate_no` varchar(32)  DEFAULT NULL            COMMENT '唯一凭证编号',
  `create_time`    datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_certificate_no` (`certificate_no`),
  KEY `idx_donation_item` (`item_id`),
  KEY `idx_donation_club` (`club_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='捐赠记录表';

-- 8. 诚信积分流水表（说明书已有）
CREATE TABLE IF NOT EXISTS `credit_log` (
  `id`           int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      int          NOT NULL                COMMENT '用户ID',
  `change_value` int          NOT NULL                COMMENT '变动分值（正加负减）',
  `reason_type`  varchar(30)  DEFAULT NULL            COMMENT 'publish/finish/good_review/no_show/report_valid/timeout/appeal_refund',
  `ref_id`       int          DEFAULT NULL            COMMENT '关联业务单号',
  `remark`       varchar(255) DEFAULT NULL            COMMENT '变动说明',
  `create_time`  datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  PRIMARY KEY (`id`),
  KEY `idx_credit_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='诚信积分流水表';

-- 9. 履约评价表（说明书已有）
CREATE TABLE IF NOT EXISTS `review` (
  `id`           int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id`     int          NOT NULL                COMMENT '流转单ID',
  `from_user_id` int          NOT NULL                COMMENT '评价人ID',
  `to_user_id`   int          NOT NULL                COMMENT '被评价人ID',
  `score`        tinyint      DEFAULT 5               COMMENT '评分1-5',
  `content`      varchar(500) DEFAULT NULL            COMMENT '评价内容',
  `tags`         varchar(255) DEFAULT NULL            COMMENT '逗号分隔标签',
  `create_time`  datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_from` (`order_id`, `from_user_id`),
  KEY `idx_review_to` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='履约评价表';

-- 10. 站内通知表（说明书已有）
CREATE TABLE IF NOT EXISTS `notify` (
  `id`          int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`     int          NOT NULL                COMMENT '接收人ID',
  `title`       varchar(100) NOT NULL                COMMENT '通知标题',
  `content`     varchar(500) DEFAULT NULL            COMMENT '通知正文',
  `notify_type` varchar(30)  DEFAULT NULL            COMMENT 'order/audit/credit/system',
  `is_read`     tinyint      DEFAULT 0               COMMENT '0未读 1已读',
  `create_time` datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  PRIMARY KEY (`id`),
  KEY `idx_notify_user` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知表';

-- 11. 举报表（说明书已有，兼承接积分申诉工单）
CREATE TABLE IF NOT EXISTS `report` (
  `id`             int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_id`        int          DEFAULT NULL            COMMENT '被举报物品ID，账号举报或积分申诉时为空',
  `reporter_id`    int          NOT NULL                COMMENT '举报人或申诉人ID',
  `report_type`    varchar(30)  DEFAULT NULL            COMMENT '虚假描述/违禁物品/恶意爽约/骚扰辱骂/积分申诉',
  `report_content` varchar(500) DEFAULT NULL            COMMENT '举报说明，或申诉关联的credit_log.id与理由',
  `handle_status`  tinyint      DEFAULT 0               COMMENT '0待处理 1已处置 2驳回',
  `handle_user`    varchar(30)  DEFAULT NULL            COMMENT '处置或复核管理员账号',
  `handle_time`    datetime     DEFAULT NULL            COMMENT '处置或复核时间',
  `create_time`    datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  PRIMARY KEY (`id`),
  KEY `idx_report_status` (`handle_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='举报表（兼积分申诉工单）';

-- 12. 操作日志表（说明书已有）
CREATE TABLE IF NOT EXISTS `oper_log` (
  `id`         int          NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`    int          DEFAULT NULL            COMMENT '操作人ID',
  `user_name`  varchar(30)  DEFAULT NULL            COMMENT '操作账号',
  `role`       varchar(20)  DEFAULT NULL            COMMENT '操作角色',
  `oper_type`  varchar(50)  DEFAULT NULL            COMMENT '操作类型',
  `oper_desc`  varchar(255) DEFAULT NULL            COMMENT '脱敏摘要',
  `oper_time`  datetime     DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `ip_address` varchar(50)  DEFAULT NULL            COMMENT '客户端IP',
  PRIMARY KEY (`id`),
  KEY `idx_log_time` (`oper_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 13. 统计日表（本次新增）
CREATE TABLE IF NOT EXISTS `stat_daily` (
  `id`                int         NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stat_date`         date        NOT NULL                COMMENT '统计日期',
  `campus`            varchar(30) NOT NULL DEFAULT 'ALL'  COMMENT '校区维度，ALL表全校',
  `publish_count`     int         DEFAULT 0               COMMENT '当日发布数',
  `view_count`        int         DEFAULT 0               COMMENT '当日浏览次数',
  `order_count`       int         DEFAULT 0               COMMENT '当日发起流转数',
  `finish_count`      int         DEFAULT 0               COMMENT '当日成交数',
  `exchange_count`    int         DEFAULT 0               COMMENT '当日交换单数',
  `consign_count`     int         DEFAULT 0               COMMENT '当日寄售单数',
  `donation_count`    int         DEFAULT 0               COMMENT '当日捐赠通过数',
  `default_count`     int         DEFAULT 0               COMMENT '当日违约单数',
  `active_user_count` int         DEFAULT 0               COMMENT '当日活跃用户数',
  `create_time`       datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  `update_time`       datetime    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '重算更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_campus` (`stat_date`, `campus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统计日表';

-- 14. 活动表（本次新增）
CREATE TABLE IF NOT EXISTS `activity` (
  `id`           int           NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        varchar(100)  NOT NULL                COMMENT '活动名称',
  `theme_tag`    varchar(50)   DEFAULT NULL            COMMENT '专区标识标签',
  `campus`       varchar(30)   DEFAULT NULL            COMMENT '举办校区',
  `location`     varchar(100)  DEFAULT NULL            COMMENT '线下地点',
  `start_time`   datetime      NOT NULL                COMMENT '开始时间',
  `end_time`     datetime      NOT NULL                COMMENT '结束时间',
  `quota`        int           NOT NULL                COMMENT '总报名名额',
  `remain_quota` int           NOT NULL                COMMENT '剩余名额（唯一真源）',
  `description`  varchar(1000) DEFAULT NULL            COMMENT '活动说明',
  `status`       tinyint       DEFAULT 1               COMMENT '0草稿 1报名中 2进行中 3已结束',
  `creator_id`   int           NOT NULL                COMMENT '发布人ID',
  `is_deleted`   tinyint       DEFAULT 0               COMMENT '0正常 1已删除',
  `create_time`  datetime      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time`  datetime      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_activity_time` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动表';

-- 15. 活动报名表（本次新增）
CREATE TABLE IF NOT EXISTS `activity_join` (
  `id`          int         NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` int         NOT NULL                COMMENT '活动ID',
  `user_id`     int         NOT NULL                COMMENT '报名学生ID',
  `join_no`     varchar(32) NOT NULL                COMMENT '报名凭证号',
  `status`      tinyint     DEFAULT 1               COMMENT '1已报名 0已取消',
  `create_time` datetime    DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_user` (`activity_id`, `user_id`),
  UNIQUE KEY `uk_join_no` (`join_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动报名表';
```

## （四）索引与外键约束

**索引汇总**（与《03-01 V1.1》第五章（四）逐条对应）：

| 表 | 索引名 | 类型 | 字段 | 支撑的查询或约束 |
| --- | --- | --- | --- | --- |
| `user` | `uk_username` | 唯一 | `username` | 登录按账号查询、账号唯一 |
| `user` | `idx_role` | 普通 | `role` | 管理后台按角色筛选 |
| `category` | `idx_parent` | 普通 | `parent_id` | 分类树两级装配 |
| `item` | `idx_cate_status` | 组合 | `category_id`, `status` | 分类页在售检索主条件 |
| `item` | `idx_campus_status` | 组合 | `campus`, `status` | 校区维度检索与热度榜候选 |
| `item` | `idx_owner` | 普通 | `owner_id` | “我的发布”列表 |
| `item_image` | `idx_item` | 普通 | `item_id` | 详情页按物品取图 |
| `skill` | `idx_skill_user` / `idx_skill_name` | 普通 | `user_id` / `skill_name` | 技能列表按人、按名检索 |
| `exchange_order` | `uk_order_no` | 唯一 | `order_no` | 单号唯一，下单幂等兜底 |
| `exchange_order` | `idx_item_status` | 组合 | `item_id`, `order_status` | 判断物品是否已被在途单据占用 |
| `exchange_order` | `idx_from_user` / `idx_to_user` | 普通 | `from_user_id` / `to_user_id` | 双方“我的流转”列表 |
| `donation` | `uk_certificate_no` | 唯一 | `certificate_no` | 凭证号全局唯一 |
| `donation` | `idx_donation_item` / `idx_donation_club` | 普通 | `item_id` / `club_id` | 物品捐赠溯源、社团受捐列表 |
| `credit_log` | `idx_credit_user` | 普通 | `user_id` | 信用档案积分流水时间轴 |
| `review` | `uk_order_from` | 联合唯一 | `order_id`, `from_user_id` | 防重复评价（冲突映射 `2301`） |
| `review` | `idx_review_to` | 普通 | `to_user_id` | 个人主页评价列表 |
| `notify` | `idx_notify_user` | 组合 | `user_id`, `is_read` | 未读红点与消息列表 |
| `report` | `idx_report_status` | 普通 | `handle_status` | 后台待处理队列 |
| `oper_log` | `idx_log_time` | 普通 | `oper_time` | 按时间范围审计与归档 |
| `stat_daily` | `uk_date_campus` | 唯一 | `stat_date`, `campus` | 日统计重跑幂等 |
| `activity` | `idx_activity_time` | 组合 | `start_time`, `end_time` | 进行中与历史活动筛选 |
| `activity_join` | `uk_activity_user` | 联合唯一 | `activity_id`, `user_id` | 防重复报名（冲突映射 `2402`） |
| `activity_join` | `uk_join_no` | 唯一 | `join_no` | 报名凭证号唯一 |

**外键策略**：全库仅保留两个物理外键，对齐说明书原有物理外键设计——

| 外键名 | 所在表 | 引用 | 删除行为 | 理由 |
| --- | --- | --- | --- | --- |
| `fk_item_owner` | `item.owner_id` | `user(id)` | `RESTRICT` | 用户被引用时禁止物理删除，账号只能停用 |
| `fk_image_item` | `item_image.item_id` | `item(id)` | `ON DELETE CASCADE` | 物品清理时图片一并清除，避免孤儿图片占盘 |

其余表（`exchange_order`、`donation`、`credit_log`、`review`、`notify`、`report`、`activity_join`）一律使用逻辑关联，不建物理外键：这些表是历史单据与审计流水，外键的级联或限制会阻碍归档与数据修复，且高频写入下外键检查会带来额外锁开销。

**与条件更新的配合**：`idx_item_status(item_id, order_status)` 使 `UPDATE exchange_order SET order_status = 2 WHERE id = ? AND order_status = 1` 能走覆盖索引快速判定影响行数；`uk_order_from`、`uk_activity_user` 让重复提交直接抛 `DuplicateKeyException`，由全局异常处理器按索引名映射为 `2301`/`2402`，无需先查后插。

## （五）初始化数据

脚本 `sql/data.sql` 全程使用 `INSERT ... ON DUPLICATE KEY UPDATE`，可重复执行而不报错、不产生重复行：

```sql
-- ============================================================
-- 校园闲置互助流转平台 Campus Loop
-- 初始化数据脚本 sql/data.sql（幂等，可重复执行）
-- 依赖：先执行 sql/schema.sql
-- ============================================================

USE `campus_loop`;

-- 1) 预置模拟账号（三类角色 + 2 个社团账号）
-- 演示密码统一为 Campus@123，以下为 BCrypt(10) 密文，
-- 由 PasswordUtil.encode("Campus@123") 等价生成，已用 PasswordUtil.matches 验证通过。
INSERT INTO `user`
  (`username`, `password`, `real_name`, `role`, `student_no`, `college`, `campus`, `credit_score`, `auth_status`, `status`)
VALUES
  ('admin',      '$2a$10$Er8D6DxCY4Ss85Ekshfed.J72PDJs6Sy//8D2OsmWBvNwnLO2Ahbi', '系统管理员',   'admin',   NULL,       NULL,           '本部', 100, 1, 1),
  ('stu_demo',   '$2a$10$Er8D6DxCY4Ss85Ekshfed.J72PDJs6Sy//8D2OsmWBvNwnLO2Ahbi', '演示学生',     'student', '20230001', '计算机学院',   '本部', 100, 1, 1),
  ('club_green', '$2a$10$Er8D6DxCY4Ss85Ekshfed.J72PDJs6Sy//8D2OsmWBvNwnLO2Ahbi', '绿源公益社',   'club',    NULL,       NULL,           '本部', 100, 1, 1),
  ('club_read',  '$2a$10$Er8D6DxCY4Ss85Ekshfed.J72PDJs6Sy//8D2OsmWBvNwnLO2Ahbi', '读书协会',     'club',    NULL,       NULL,           '本部', 100, 1, 1)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `real_name` = VALUES(`real_name`),
  `role` = VALUES(`role`),
  `credit_score` = VALUES(`credit_score`),
  `auth_status` = VALUES(`auth_status`),
  `status` = VALUES(`status`);

-- 2) 6 个一级分类（parent_id = 0）
INSERT INTO `category` (`id`, `category_name`, `parent_id`, `sort_no`, `is_show`) VALUES
  (1, '教材书籍', 0, 1, 1),
  (2, '数码电子', 0, 2, 1),
  (3, '生活用品', 0, 3, 1),
  (4, '运动器材', 0, 4, 1),
  (5, '服饰鞋包', 0, 5, 1),
  (6, '其他',     0, 6, 1)
ON DUPLICATE KEY UPDATE
  `category_name` = VALUES(`category_name`),
  `parent_id` = VALUES(`parent_id`),
  `sort_no` = VALUES(`sort_no`),
  `is_show` = VALUES(`is_show`);
```

**口径差异标注（需组长确认，未擅自定稿）**：

1、《03-01 V1.1》第五章（二）与（三）只定义了 15 张表，其中**没有自提点表、也没有积分规则表**，但同文档第 873 行要求初始化“4 个校内自提点与 5 条积分规则”，模块 12 也提到“维护自提点与积分规则字典”。为不擅自扩表（15 表为冻结范围），本版把这两类数据落为**配置字典**：自提点走 `application.yml` 的 `campus-loop.pickup-points`，积分规则走 `CreditRuleEnum`（键与 `credit_log.reason_type` 对齐）。若确需后台可视化维护，应新增 `sys_dict` 表——此举超出 15 表范围，须由组长在合稿时确认。

2、自提点取值以《01-02 需求调研记录》第 118 行原文为准，可得 3 个明确点位；第 4 个点位在现有文档中无出处，标注为**待组长补充**，不在本脚本中臆造：

| 序号 | 自提点 | 来源 |
| --- | --- | --- |
| 1 | 本部图书馆南门（有监控） | 《01-02》第 118 行 |
| 2 | 三舍楼下服务点 | 《01-02》第 118 行 |
| 3 | 二食堂门口 | 《01-02》第 118 行 |
| 4 | 待确认 | 现有设计文档无出处 |

3、积分规则《03-01》记“5 条”，而《01-02》第 119 行实际列出 6 项（发布 +2、完成流转 +5、收到好评 +3、公益捐赠 +5、超时未交付 -10、举报核实 -15）。建议按 6 项落地，并在合稿时统一口径：

| 规则键（`reason_type`） | 触发场景 | 分值 | 来源 |
| --- | --- | --- | --- |
| `publish` | 发布闲置或技能通过审核 | +2 | 《01-02》第 119 行 |
| `finish` | 完成流转/核销 | +5 | 《01-02》第 119 行 |
| `good_review` | 收到好评 | +3 | 《01-02》第 119 行 |
| `donation` | 公益捐赠审核通过 | +5 | 《01-02》第 119 行 |
| `no_show` / `timeout` | 超时未交付、爽约 | -10 | 《01-02》第 119 行、《03-01》第 206 行 |
| `report_valid` | 举报核实成立 | -15 | 《01-02》第 119 行、《03-01》第 294 行 |
| `appeal_refund` | 积分申诉复核通过回补 | 按原扣分回补 | 《03-01》第 685 行 |

```yaml
# application.yml 片段：自提点与积分规则以配置字典落地（不占 15 张表）
campus-loop:
  pickup-points:
    - 本部图书馆南门（有监控）
    - 三舍楼下服务点
    - 二食堂门口
  credit:
    publish: 2
    finish: 5
    good-review: 3
    donation: 5
    no-show: -10
    report-valid: -15
```

## （六）Redis 键落地规范

沿用 Part A 第三章（六）的约定：所有键由 `RedisKey` 生成、统一 `cl:` 前缀、全部带 TTL，读写一律 `try/catch` 降级，禁止因缓存故障中断主业务。

```java
package com.csu.campusloop.util;

/**
 * Redis 键生成器：全部键统一 cl: 前缀，ID 参数统一 Integer。
 * TTL 常量集中在此，禁止业务代码散落硬编码。
 */
public final class RedisKey {

    private static final String PREFIX = "cl:";

    private RedisKey() {
    }

    /** 用户标签权重 ZSet，成员为 categoryId */
    public static String userTag(Integer userId) {
        return PREFIX + "tag:user:" + userId;
    }

    /** 校区热门物品榜 ZSet，成员为 itemId，score 为热度 */
    public static String hotItem(String campus) {
        return PREFIX + "rank:hot:" + campus;
    }

    /** 个性化推荐结果缓存（JSON） */
    public static String recCache(Integer userId) {
        return PREFIX + "rec:cache:" + userId;
    }

    /** 全校热门检索词 ZSet */
    public static String hotSearch() {
        return PREFIX + "search:hot";
    }

    /** 活动名额预筛计数 */
    public static String activityQuota(Integer activityId) {
        return PREFIX + "act:quota:" + activityId;
    }

    /** 校园邮箱核验验证码 */
    public static String authCode(String studentNo) {
        return PREFIX + "auth:code:" + studentNo;
    }
}
```

| 键模板 | 结构 | 序列化方式 | TTL | 写入时机 | 降级行为 |
| --- | --- | --- | --- | --- | --- |
| `cl:tag:user:{userId}` | ZSet | `StringRedisTemplate.opsForZSet()`，成员为分类 ID | 30 天（每次写后续期） | 浏览 +1、收藏 +3、发布 +5 | 读失败返回空集，推荐退化为热门榜 |
| `cl:rank:hot:{campus}` | ZSet | 同上，成员为物品 ID | 1 天 | 发布、成交时更新热度 | 读失败直接查 `item` 按 `view_count` 取 TOP 12 |
| `cl:rec:cache:{userId}` | String | `ObjectMapper` 序列化 `List<RecommendItemVO>` | 10 分钟 | 推荐接口未命中时回填 | 读失败视为未命中，重算后回填 |
| `cl:search:hot` | ZSet | 成员为检索词 | 7 天 | 检索接口命中结果时累加 | 写失败仅记 warn，不影响检索返回 |
| `cl:act:quota:{activityId}` | String | 纯整数字符串 | 活动结束后 24 小时 | 报名前预筛 | 读失败跳过预筛，直接以 MySQL 条件更新为准 |
| `cl:auth:code:{studentNo}` | String | 纯字符串验证码 | 5 分钟 | 发送校园邮箱验证码 | 读失败按“验证码已过期”提示重新获取 |

**落地要点**：

1、**序列化统一**：ZSet 成员与值一律用字符串，避免 JDK 序列化产生不可读的二进制成员（`redis-cli` 无法排查）；对象缓存用 Jackson 转 JSON，并在 `RecommendItemVO` 上标注 `@JsonIgnoreProperties(ignoreUnknown = true)`，防止后续加字段导致反序列化失败。

2、**TTL 必须显式设置**：`RedisHelper` 的写方法签名强制传入 TTL（`set(key, value, Duration)`），不提供无 TTL 的重载，从 API 层面杜绝键永不过期。

3、**降级模板**（所有调用点统一形态，禁止裸调用）：

```java
public <T> T getOrDegrade(String key, Supplier<T> loader, Supplier<T> fallback) {
    try {
        String json = stringRedisTemplate.opsForValue().get(key);
        if (json != null) {
            return objectMapper.readValue(json, new TypeReference<T>() { });
        }
    } catch (Exception e) {
        log.warn("Redis 读取失败，降级处理，key={}", key, e);
        return fallback.get();
    }
    return loader.get();
}
```

4、**活动名额以 MySQL 为准**：`cl:act:quota` 仅做高并发前置预筛（快速挡掉大部分超额请求），最终扣减仍走 `UPDATE activity SET remain_quota = remain_quota - 1 WHERE id = ? AND remain_quota > 0` 的原子条件更新，校验影响行数为 1，防止缓存与库不一致时超卖。`stat_daily` 同理，缓存只加速展示，日统计以库表数据重算为准。

---

# 七、关键流程时序（Part B 负责第 1、4 条）

## （一）以物易物全流程（含角色隔离核销）
（按步给出参与方、Controller、Service、Mapper、事务边界：发起成对锁单 → 确认 → 预约 → 所有者展示二维码 → 发起方扫码条件更新核销 → 积分加分与消息通知）

## （四）推荐降级流程
（按步给出正常路径与 Redis 不可用/冷启动时的两级降级链路）

---

# 十一、部署与配置

（单机 Tomcat 10.1.61 + MySQL 5.7.17 + Redis 5.0 环境参数、外部 `upload/` 静态映射与 `certificate/` 非静态受保护目录配置、启动检查清单、SQL 快照备份与 Git Tag WAR 包 5 分钟回滚步骤）
