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

| 类 / 接口 | 所在包 | 职责 |
| --- | --- | --- |
| `OrderController` | `controller` | 暴露 5 个流转接口；`@Valid` 校验、取 Session `LoginUser`、封装 `Result<T>`，不含业务分支 |
| `OrderService` | `service` | 定义锁单、接单、取消、分页与详情契约 |
| `OrderServiceImpl` | `service.impl` | 事务边界所在：成对条件更新锁单、状态迁移校验、成对解锁；仅编排，SQL 全部下沉 Mapper |
| `ExchangeOrderMapper` | `mapper` | 单据插入、按状态条件更新、双角色分页、详情联表查询 |
| `ItemMapper` | `mapper` | 物品 `status=1 -> 2` 锁定与 `2 -> 1` 解锁的条件更新、在售态校验、按 ID 批量取摘要 |
| `OrderCreateDTO` | `dto` | `itemId`、`tradeMode`、`offerItemId`、`message`（≤ 200 字）；用 `@NotNull`/`@Pattern`/`@Size` 卡住格式，`offerItemId` 的条件必填在 Service 内按 `tradeMode` 判定 |
| `OrderCancelDTO` | `dto` | `id`、`closeReason`（`@NotBlank`、≤ 255 字） |
| `OrderVo` / `OrderDetailVO` | `vo` | 列表项（单号、对方昵称、物品摘要、状态、时间）与详情（双方物品、状态步骤、可执行动作）；均不含 `verify_code` |
| `OrderStatusEnum` | `enums` | 状态码与中文名、合法迁移表 `canTransit(from, to)`，禁止业务代码散落 `if (status == 1)` |
| `IdUtil` | `util` | `nextOrderNo()` 生成 `CL` + `yyyyMMdd` + 4 位当日序号（如 `CL202611210054`），与 `uk_order_no` 共同兜底幂等 |

### 2、方法设计

| 方法签名 | 对应接口 | 事务 |
| --- | --- | --- |
| `OrderCreateResultVO create(OrderCreateDTO dto, LoginUser current)` | `POST /api/orders` | 是 |
| `OrderStatusVO confirm(Integer orderId, LoginUser current)` | `POST /api/orders/{id}/confirm` | 是 |
| `OrderCancelResultVO cancel(OrderCancelDTO dto, LoginUser current)` | `POST /api/orders/{id}/cancel` | 是 |
| `PageResult<OrderVO> pageMine(OrderQuery query, LoginUser current)` | `GET /api/orders/mine` | 否（只读） |
| `OrderDetailVO detail(Integer orderId, LoginUser current)` | `GET /api/orders/{id}` | 否（只读） |
| `int closeTimeoutOrders(LocalDateTime now)` | 由模块 05 定时任务调用 | 是按单循环（见模块 05） |

```java
public interface OrderService {

    /** 发起流转单：交换模式成对锁单，寄售模式仅锁目标物品 */
    OrderCreateResultVO create(OrderCreateDTO dto, LoginUser current);

    /** 物品所有者确认接单：0 -> 1 */
    OrderStatusVO confirm(Integer orderId, LoginUser current);

    /** 双方取消：0/1/2 -> 4，成对解锁物品 */
    OrderCancelResultVO cancel(OrderCancelDTO dto, LoginUser current);

    /** 我的流转：按 roleType（from/to）与状态分页 */
    PageResult<OrderVO> pageMine(OrderQuery query, LoginUser current);

    /** 详情：仅参与双方可见 */
    OrderDetailVO detail(Integer orderId, LoginUser current);
}
```

### 3、处理流程

**（1）发起流转单 `create`**（`@Transactional(rollbackFor = Exception.class)`）

1、`@Valid` 校验入参格式，失败抛 `BizException(1001)`。

2、按 `itemId` 查目标物品：不存在、`is_deleted = 1` 或 `status != 1` 一律抛 `2102`（不区分“不存在”与“不可操作”，避免探测他人下架物品）。

3、`item.owner_id == current.getUserId()` 时抛 `2102`（禁止向本人下单）。

4、校验 `dto.tradeMode` 与 `item.trade_mode` 一致，不一致抛 `2102`（前端传递错误模式不得顺手改写物品属性）。

5、交换模式（`exchange`）：`offerItemId` 为空抛 `1001`；按 ID 查出换出物品，要求 `owner_id` 为当前用户、`status = 1`、`is_deleted = 0`、且 `id != itemId`，任一不满足抛 `2102`。

6、**成对锁定（事务内，先目标后换出，固定顺序避免死锁）**：

```java
// 目标物品：在售 -> 锁定
int locked = itemMapper.lockItem(itemId);          // UPDATE item SET status=2 WHERE id=? AND status=1 AND is_deleted=0
if (locked != 1) {
    throw new BizException(ErrorCode.ITEM_TAKEN);  // 2101 被抢先
}
// 交换模式再锁换出物品，失败则整个事务回滚，目标物品锁定一并撤销
if (isExchange) {
    int lockedOffer = itemMapper.lockItem(offerItemId);
    if (lockedOffer != 1) {
        throw new BizException(ErrorCode.ITEM_TAKEN); // 2101
    }
}
```

7、生成单号并插入单据：`order_status = 0`、`from_user_id = 当前用户`、`to_user_id = item.owner_id`、`verify_code` 留空（预约时才生成）。

8、事务提交后，经 `@TransactionalEventListener(phase = AFTER_COMMIT)` 异步向物品所有者写一条 `notify`（`notify_type = order`）；通知失败仅记 `warn`，不回滚锁单。

9、返回 `orderId`、`orderNo`、`orderStatus = 0`、`lockedItems`（目标 + 换出物品 ID 列表）。

**（2）确认接单 `confirm`**

1、查单据，不存在或当前用户既非 `from_user_id` 也非 `to_user_id` → `1003`；既非所有者又调用确认 → `1003`（仅 `to_user_id` 可确认）。

2、`OrderStatusEnum.canTransit(0, 1)` 为假 → `2102`（已确认、已取消、已违约均在此拦截，避免重复确认）。

3、条件更新 `UPDATE exchange_order SET order_status = 1 WHERE id = ? AND order_status = 0`，影响行数不等于 1 → `2102`。

4、事务提交后通知发起方“对方已接单，请预约面交”。

**（3）取消流转 `cancel`**

1、查单据并校验参与方 → `1003`。

2、仅 `0`（待确认）、`1`（已确认）、`2`（待面交）可取消，其余状态（`3`/`4`/`5`）→ `2102`。

3、条件更新 `UPDATE exchange_order SET order_status = 4, close_reason = ? WHERE id = ? AND order_status = ?`（带原状态），影响行数不等于 1 → `2102`。

4、**成对解锁**：目标物品 `2 -> 1`；交换模式下换出物品同样 `2 -> 1`。解锁用条件更新 `WHERE status = 2`，影响行数为 0 时记 `warn` 但不抛异常（物品可能已被后台下架，不应阻断取消）。

5、事务提交后通知对方并附取消原因。

**（4）我的流转 `pageMine` / 详情 `detail`**

1、`pageMine` 按 `roleType` 决定过滤列：`from` 用 `from_user_id = ?`，`to` 用 `to_user_id = ?`；`PageHelper.startPage` 紧跟单条查询。

2、`detail` 仅参与双方可读，非参与方 → `1003`；出参不含 `verify_code`（核销码只经二维码通道下发，见模块 05）。

### 4、关键规则

1、**双模式状态机**（越级一律 `2102`）：

| 当前 | 允许迁移 | 触发者 | 说明 |
| --- | --- | --- | --- |
| `0` 待确认 | `1` 已确认 / `4` 已取消 | 所有者 / 双方或超时 | 24 小时未接单由定时任务置 `4` |
| `1` 已确认 | `2` 待面交 / `4` 已取消 | 双方预约 / 双方或超时 | 48 小时未预约由定时任务置 `4` |
| `2` 待面交 | `3` 已完成 / `4` 已取消 / `5` 已违约 | 发起方核销 / 双方 / 超时 | 超预约 24 小时由定时任务置 `5` |
| `3` 已完成 | — | — | 终态，仅可评价 |
| `4` 已取消 | — | — | 终态，物品已解锁 |
| `5` 已违约 | — | — | 终态，物品已解锁，扣发起方积分 |

2、**防重复抢单**：锁单一律用 `WHERE status = 1` 的条件更新 + 影响行数判定，禁止“先 `select` 判断再 `update`”——两人同时下单时后者必然读到过期快照。`lockedItems` 放在同一事务，任一失败整体回滚，不会出现“目标锁了、换出没锁”的半锁状态。

3、**固定加锁顺序**：始终先锁目标物品、后锁换出物品，使两个互相交换的请求（A 换 B、B 换 A）按同一顺序竞争，避免死锁。

4、**禁止向本人下单**：`owner_id == 当前用户` 直接 `2102`，与“物品被锁定”共用同一错误提示，不暴露物品所有权细节。

5、**锁定态物品不可编辑、不可删除**：`item.status = 2` 时发布/编辑/下架接口一律 `2102`（该约束由模块 02 执行，本模块只负责置锁与解锁）。

6、**单号幂等兜底**：`order_no` 撞 `uk_order_no` 时由 `GlobalExceptionHandler` 捕获 `DuplicateKeyException` 返回 `2102`，不重试生成新号（防止重复提交产生两张单据）。

7、**通知不参与事务**：通知属可丢消息，一律 `AFTER_COMMIT` 异步发送；若与主事务同生共死，通知服务抖动会让锁单失败，得不偿失。

8、**取消原因必填**：`close_reason` 为空直接 `1001`，保证详情页与后台审计能看到取消理由。

### 5、异常分支

| 错误码 | 触发场景 | 提示语 |
| --- | --- | --- |
| `1001` | `itemId`/`tradeMode` 缺失、`closeReason` 为空、`message` 超 200 字、交换模式缺 `offerItemId` | 请完善必填信息 / 取消原因不能为空 |
| `1002` | Session 缺失或过期 | 请先登录 |
| `1003` | 非流转单参与方查看详情、非所有者调用确认 | 无权操作该流转单 |
| `1005` | 请求过程中账号被管理员停用 | 账号已停用，请联系管理员 |
| `2101` | 目标或换出物品的条件更新影响行数为 0（被他人抢先锁单） | 手慢了，该物品已被抢先锁定 |
| `2102` | 向本人下单、模式不一致、状态越级或重复确认、取消终态单据、操作锁定物品、单号冲突 | 当前状态不允许该操作 |

## （四）技能交换板块（模块 04）

### 1、类与职责

| 类 / 接口 | 所在包 | 职责 |
| --- | --- | --- |
| `SkillController` | `controller` | 暴露 4 个技能接口，参数校验与 `Result` 封装 |
| `SkillService` / `SkillServiceImpl` | `service` | 发布与关闭、筛选分页、详情互补计算、邀约受理 |
| `SkillMapper` | `mapper` | 按用户统计有效条数、条件分页、按 ID 联表取详情 |
| `SkillSaveDTO` | `dto` | `skillId`（空为新增）、`skillName`、`skillType`、`level`、`expectSkill`、`description`、`status` |
| `SkillInviteDTO` | `dto` | `id`（路径）、`message`（≤ 200 字） |
| `SkillQuery` | `dto` | `keyword`、`skillType`、`level`、`page`、`pageSize`（继承 `PageQuery`） |
| `SkillVO` / `SkillDetailVO` | `vo` | 列表项（名称、类型、熟练度、发布人昵称与信用分）与详情（含 `complementary` 标识与匹配依据） |
| `NotifyService` | `service`（模块 10 提供） | 邀约成功后写入站内通知，本模块只单向调用 |

### 2、方法设计

| 方法签名 | 对应接口 | 事务 |
| --- | --- | --- |
| `SkillStatusVO save(SkillSaveDTO dto, LoginUser current)` | `POST /api/skills`（发布/编辑/关闭三合一） | 是 |
| `PageResult<SkillVO> page(SkillQuery query)` | `GET /api/skills` | 否 |
| `SkillDetailVO detail(Integer id, LoginUser current)` | `GET /api/skills/{id}` | 否 |
| `InviteResultVO invite(Integer id, SkillInviteDTO dto, LoginUser current)` | `POST /api/skills/{id}/invites` | 是（含通知） |

```java
public interface SkillService {

    /** 发布 / 编辑 / 关闭：skillId 为空即新增，status=0 即关闭 */
    SkillStatusVO save(SkillSaveDTO dto, LoginUser current);

    /** 技能大厅：按名称、类型、熟练度筛选分页（公开） */
    PageResult<SkillVO> page(SkillQuery query);

    /** 详情：登录用户可见，含与当前用户的双向互补判定 */
    SkillDetailVO detail(Integer id, LoginUser current);

    /** 互换邀约：不可邀约本人、不可邀约已关闭技能，成功写站内通知 */
    InviteResultVO invite(Integer id, SkillInviteDTO dto, LoginUser current);
}
```

### 3、处理流程

**（1）发布 / 编辑 `save`**

1、`skillId` 为空走新增：`@Valid` 校验 `skillName`（≤ 50 字）、`skillType ∈ {1,2}`、`level ∈ {入门, 熟练, 精通}`，非法 → `1001`。

2、新增前统计该用户同 `skill_type` 且 `status = 1` 的有效条数：`SELECT COUNT(*) FROM skill WHERE user_id = ? AND skill_type = ? AND status = 1`，`>= 3` 抛 `2201`。

3、插入记录，`status` 默认 `1`，返回 `skillId`、`status`。

4、`skillId` 非空走编辑：先按 ID 查记录，不存在或 `user_id != 当前用户` → `1003`；仅允许修改 `skillName`、`level`、`expectSkill`、`description`，`skill_type` 发布后不可改（否则可绕过 3 条上限）。

5、`status = 0` 即关闭：条件更新 `WHERE id = ? AND user_id = ?`，关闭后不再出现在大厅列表，已发出的邀约仍可在消息记录中查看。

**（2）筛选分页 `page`**

1、`PageHelper.startPage(page, pageSize)`，`pageSize` 由 `PageQuery` 强制裁剪至 ≤ 50。

2、固定过滤 `status = 1`，按 `skillType`、`level` 等值过滤；`keyword` 对 `skill_name` 与 `expect_skill` 做 `LIKE`，入参先经 `SensitiveWordUtil` 与 `%`/`_` 转义。

3、排序固定 `create_time DESC`，不暴露排序字段（大厅无“最热”需求，避免多一种白名单）。

**（3）详情与互补判定 `detail`**

1、按 ID 查详情，不存在或 `status = 0` → `2102`（已关闭技能不可查看详情，避免邀约入口残留）。

2、读取当前用户与发布者各自“我能提供（1）”与“我需要（2）”的技能名集合。

3、双向匹配：当前用户的“我需要”集合与发布者“我能提供”集合有交集 **且** 当前用户“我能提供”与发布者“我需要”有交集 → 标记 `complementary = true`，并在 `matchTags` 返回交集技能名，作为页面“高度互补”角标依据。

4、出参附发布人信用分与等级，便于判断是否值得交换。

**（4）互换邀约 `invite`**

1、查技能，不存在或 `status = 0` → `2102`。

2、`skill.user_id == 当前用户` → `2202`（不可邀约本人）。

3、事务内写入邀约记录（本模块只需 `notify` 一条站内通知即可承载，不单独建表；通知内容含技能名、邀约人与留言）。

4、`message` 超 200 字 → `1001`；为空则使用默认文案“对你的技能「XXX」很感兴趣，想和你互换”。

5、返回 `inviteSent = true`；通知写入失败抛 `5001` 并回滚（邀约必须送达才有意义，与订单通知的“可丢”策略相反）。

### 4、关键规则

1、**同类有效技能上限 3 条**：按 `user_id + skill_type + status = 1` 计数，编辑不增计数、关闭后释放名额；超限 `2201`。该规则落在 Service 而非数据库约束，因为“有效”是业务状态而非唯一性。

2、**`skill_type` 发布后不可改**：允许改类型等于绕过上限（先发 3 条“我能提供”，再改成“我需要”）。

3、**不可邀约本人**：`2202`，与“已关闭技能”共用同一入口校验顺序（先查存在与状态，再判本人），避免信息泄露。

4、**已关闭技能不可见、不可邀约**：详情与邀约统一返回 `2102`，列表侧直接过滤，防止前端缓存旧链接绕过。

5、**互补判定只做名称交集**：不做语义相似度计算，保证可解释——页面显示的具体技能名就是判定依据，避免“黑箱推荐”难以验收。

6、**邀约通知必须入库**：与订单通知不同，邀约的唯一产出就是通知，所以通知写失败即整体失败（`5001`），不允许“邀约成功但对方收不到”。

7、**技能不占用物品锁**：技能交换只做撮合与通知，不生成 `exchange_order`，因此不参与物品锁定状态机，避免与流转模块耦合。

### 5、异常分支

| 错误码 | 触发场景 | 提示语 |
| --- | --- | --- |
| `1001` | 技能名缺失或超长、`skillType`/`level` 取值非法、留言超 200 字 | 请检查填写内容 |
| `1002` | 未登录访问详情或邀约 | 请先登录 |
| `1005` | 账号已停用 | 账号已停用，请联系管理员 |
| `2102` | 技能不存在、已关闭、编辑他人技能 | 该技能已关闭或不存在 |
| `2201` | 同类有效技能已达 3 条 | 同类技能最多发布 3 条，请先关闭不再需要的技能 |
| `2202` | 邀约自己发布的技能 | 不能邀约自己 |

## （五）预约面交与扫码核销（模块 05）

### 1、类与职责

| 类 / 接口 | 所在包 | 职责 |
| --- | --- | --- |
| `OrderController`（扩展） | `controller` | 新增预约、核销、二维码 3 个入口（与模块 03 共用控制器，避免 `/api/orders` 被两个控制器瓜分） |
| `AppointmentService` / `AppointmentServiceImpl` | `service` | 预约排期校验、`verify_code` 生成与发放、核销幂等、超时归口 |
| `OrderTimeoutTask` | `task` | 每小时巡检三段超时，逐单幂等处理 |
| `OrderAppointDTO` | `dto` | `appointTime`（`@Future`、30 分钟粒度）、`appointPlace`（自提点白名单） |
| `OrderVerifyDTO` | `dto` | `verifyCode`（`@NotBlank`、长度与字符集校验） |
| `ExchangeOrderMapper`（扩展） | `mapper` | `2 -> 3` 核销条件更新、`2 -> 5` 违约条件更新、超时扫描查询 |
| `QrCodeUtil` | `util` | `generatePng(content, size)` 生成二维码 PNG 流（ZXing） |
| `IdUtil`（扩展） | `util` | `nextVerifyCode()` 生成 32 位一次性核销码（UUID 去横线） |

### 2、方法设计

| 方法签名 | 对应接口 | 事务 |
| --- | --- | --- |
| `OrderAppointVO appoint(OrderAppointDTO dto, Integer orderId, LoginUser current)` | `POST /api/orders/{id}/appointment` | 是 |
| `OrderVerifyVO verify(Integer orderId, OrderVerifyDTO dto, LoginUser current)` | `POST /api/orders/{id}/verify` | 是 |
| `byte[] qrcode(Integer orderId, LoginUser current)` | `GET /api/orders/{id}/qrcode` | 否（只读） |
| `int scanTimeout(LocalDateTime now)` | 由 `OrderTimeoutTask` 每小时调用 | 逐单独立事务 |

```java
public interface AppointmentService {

    /** 预约面交：1 -> 2，生成一次性核销码但不回传 */
    OrderAppointVO appoint(OrderAppointDTO dto, Integer orderId, LoginUser current);

    /** 发起方核销：2 -> 3，条件更新保证幂等，同事务内加分 */
    OrderVerifyVO verify(Integer orderId, OrderVerifyDTO dto, LoginUser current);

    /** 所有者取核销二维码：仅返回图片流，不返回明码 */
    byte[] qrcode(Integer orderId, LoginUser current);

    /** 三段超时巡检：0->4（24h）、1->4（48h）、2->5（超预约 24h） */
    int scanTimeout(LocalDateTime now);
}
```

### 3、处理流程

**（1）预约 `appoint`**（`@Transactional`）

1、查单据并校验参与方（仅 `from_user_id` / `to_user_id`）→ `1003`。

2、单据必须为 `1` 已确认状态，否则：`0` 未接单 → `2102`（提示“等待对方接单”）、`2/3` → `2102`（已预约/已完成）、`4/5` → `2104`。

3、校验预约时间：`appointTime` 必须晚于当前时间且落在 **09:00–21:00** 区间、分钟数为 `00` 或 `30`；不满足 → `1001`。

4、校验 `appointPlace` 属于 `campus-loop.pickup-points` 配置白名单，否则 → `1001`（不落库任意字符串，避免统计口径被污染）。

5、生成一次性核销码 `verify_code = IdUtil.nextVerifyCode()`（32 位，不可猜测）。

6、条件更新 `UPDATE exchange_order SET order_status = 2, appoint_time = ?, appoint_place = ?, verify_code = ? WHERE id = ? AND order_status = 1`，影响行数不等于 1 → `2102`（并发重复预约）。

7、**响应不返回 `verify_code`**：出参仅 `orderId`、`orderStatus`、`appointTime`、`appointPlace`。核销码只进二维码，确保“看到码的人不能核销、能核销的人拿不到码”。

8、事务提交后通知对方预约时间与地点。

**（2）获取二维码 `qrcode`**

1、查单据，校验当前用户为 `to_user_id`（物品所有者），否则 → `1003`（发起方取码即自核销，必须拦死）。

2、单据必须为 `2` 待面交且 `verify_code` 非空，否则 → `2102`。

3、`QrCodeUtil.generatePng("CL-VERIFY:" + verify_code, 300)` 生成 PNG，`Content-Type: image/png` 直接写响应流，禁走 JSON。

**（3）核销 `verify`**（`@Transactional`）

1、查单据，校验当前用户为 `from_user_id`，否则 → `1003`（所有者核销即自核销）。

2、状态判定：`3` 已完成 → `2102`（重复核销，且**不得重复加分**）；`5` 已违约 → `2104`；`0/1` → `2102`（未预约）。

3、核销码校验：`dto.verifyCode` 与库中 `verify_code` 做**常量时间比较**，不一致 → `2103`。

4、条件更新：`UPDATE exchange_order SET order_status = 3, finish_time = NOW() WHERE id = ? AND order_status = 2`，影响行数不等于 1 → `2102`。**这是幂等的唯一闸口**，并发两个核销请求只有一个能拿到 1。

5、同事务内更新物品：目标物品 `2 -> 3` 已完成；交换模式下换出物品同样 `2 -> 3`。

6、同事务内调用模块 07 `CreditService.addScore(fromUserId, +5, "finish", orderId)` 与 `CreditService.addScore(toUserId, +5, "finish", orderId)`：写 `credit_log` 并原子更新 `user.credit_score`。**同一数据库本地事务**，保证“核销成功但没加分”不会发生。

7、事务提交后（`AFTER_COMMIT`）通知双方“已核销，请在 7 天内互评”，并写入模块 10 评价提醒。

8、返回 `orderId`、`orderStatus = 3`、`finishTime`。

**（4）超时巡检 `scanTimeout`**（`OrderTimeoutTask` 每小时执行）

1、三类扫描分别执行，互不影响：

| 段 | 扫描条件 | 处置 |
| --- | --- | --- |
| 待确认 | `order_status = 0 AND create_time < now - 24h` | 置 `4` 已取消，原因“超时未接单”，成对解锁 |
| 待预约 | `order_status = 1 AND create_time < now - 48h` | 置 `4` 已取消，原因“超时未预约”，成对解锁 |
| 待面交 | `order_status = 2 AND appoint_time < now - 24h` | 置 `5` 已违约，成对解锁，扣发起方 10 分 |

2、每单独立事务：先做条件更新（`WHERE order_status = 原状态`），影响行数为 1 才继续解锁与扣分；为 0 说明已被用户操作抢先，直接跳过——**绝不覆盖用户主动操作的结果**。

3、扣分调用 `CreditService.addScore(fromUserId, -10, "timeout", orderId)`，`ref_id` 记订单号，便于申诉回溯；同一订单因条件更新守卫只会扣一次。

4、返回本次处置单数，写入定时任务日志；单次处理上限 500 单，避免长事务拖垮连接池。

### 4、关键规则

1、**角色隔离防自核销**：出码仅 `to_user_id`、核销仅 `from_user_id`，两者在 Controller 之外还要在 Service 再校验一次（拦截器只校验登录态，不区分单据角色）。这是本模块最关键的一条——任一方能在交付前独自完成核销，整个履约约束就失效了。

2、**核销码不可回传、不可枚举**：`verify_code` 为 32 位 UUID 派生值，只经二维码下发；`OrderDetailVO` 与预约响应都不含该字段。

3、**幂等靠条件更新而非查询判断**：`2 -> 3` 的条件更新是唯一闸口，重复提交影响行数为 0 → `2102`，且第 6 步加分根本不会执行，从根上杜绝重复加分。

4、**三段超时统一归口**：`0` 超 24h、`1` 超 48h 均无责取消（用户未推进流程）；`2` 超预约 24h 判违约并默认扣发起方 10 分（按《03-01》第 206 行口径），物品所有者爽约或归责不明时，发起方可经模块 07 提交**单次**申诉，由管理员复核撤回扣分或转扣违约方。

5、**超时不越权**：定时任务只处理“仍未推进”的单据，且以条件更新为准；用户刚操作完的单据不会被定时任务覆盖。

6、**二维码内容带前缀**：`CL-VERIFY:` 前缀用于区分本系统码与外部二维码，扫描后仅解析前缀匹配的载荷，降低误扫风险。

7、**预约粒度与时段**：09:00–21:00、30 分钟一档，与自提点值守时间对齐；不做跨天预约，避免“预约在闭馆时段”导致必然违约。

### 5、异常分支

| 错误码 | 触发场景 | 提示语 |
| --- | --- | --- |
| `1001` | 预约时间缺失/已过/不在 09:00–21:00/非整半点、自提点不在白名单、核销码为空 | 请选择有效的面交时间与自提点 |
| `1003` | 非参与方预约、发起方取二维码、所有者调用核销 | 无权执行该操作 |
| `1005` | 账号已停用 | 账号已停用，请联系管理员 |
| `2102` | 未接单即预约、重复预约、重复核销、已完成或已取消单据再操作 | 当前状态不允许该操作 |
| `2103` | 核销码不匹配或已被使用 | 核销码无效，请重新扫码 |
| `2104` | 超过预约时间 24 小时已被判违约关闭 | 该流转单已超时关闭，如有异议可提交申诉 |

## （八）物品检索与筛选（模块 08）

### 1、类与职责

| 类 / 接口 | 所在包 | 职责 |
| --- | --- | --- |
| `ItemSearchController` | `controller` | 暴露检索与分类树两个公开接口 |
| `ItemSearchService` / `ItemSearchServiceImpl` | `service` | 条件装配、排序白名单映射、分页、热门词写入、空结果兜底 |
| `ItemMapper`（检索部分） | `mapper` | 动态条件查询在售物品、按分类与热度取兜底列表 |
| `CategoryMapper` | `mapper` | 查询 `is_show = 1` 的分类并按 `parent_id` 装配两级树 |
| `ItemSearchQuery` | `dto` | `keyword`、`categoryId`、`conditionLevel`、`campus`、`tradeMode`、`minPrice`、`maxPrice`、`sort`、`page`、`pageSize` |
| `ItemCardVO` | `vo` | 卡片字段：`id`、`title`、`coverUrl`、`price`、`tradeMode`、`campus`、`conditionLevel`、`viewCount` |
| `CategoryTreeVO` | `vo` | `id`、`categoryName`、`children`（二级） |
| `SortWhitelist` | `enums` / `config` | `Map<String, String>` 排序白名单：`latest`→`create_time DESC`、`hot`→`view_count DESC`、`price_asc`、`price_desc` |

### 2、方法设计

| 方法签名 | 对应接口 | 事务 |
| --- | --- | --- |
| `ItemSearchResultVO search(ItemSearchQuery query)` | `GET /api/items` | 否（只读） |
| `List<CategoryTreeVO> categoryTree()` | `GET /api/categories/tree` | 否（只读） |

```java
public interface ItemSearchService {

    /** 多条件检索：固定过滤在售未删除，排序走白名单，空结果返回兜底列表 */
    ItemSearchResultVO search(ItemSearchQuery query);

    /** 启用状态的二级分类树（一次查询后在内存装配，避免 N+1） */
    List<CategoryTreeVO> categoryTree();
}
```

### 3、处理流程

**（1）检索 `search`**

1、`@Valid` 校验：`pageSize` 裁剪至 1–50、`page >= 1`；`minPrice > maxPrice` 直接交换两者（宽容处理而非报错，价格区间本无方向语义）；`minPrice`/`maxPrice` 为负 → `1001`。

2、**排序白名单映射**：`sort` 经 `SortWhitelist` 转成 SQL 片段，未命中则回落 `latest`；**前端传入的字符串永远不进 SQL**，只有 `Map` 里的固定值可以拼进 `ORDER BY`。

3、**固定过滤**：`status = 1 AND is_deleted = 0`，由 Mapper 的 `<where>` 前置写死，不接受调用方覆盖。

4、动态条件：`categoryId`（含其二级子分类，用 `IN`）、`conditionLevel`、`campus`、`tradeMode` 等值匹配；`keyword` 对 `title`、`description` 做 `LIKE '%kw%'`，并对 `%`、`_`、`\` 转义。

5、`PageHelper.startPage(page, pageSize)` 后紧跟单条查询，返回 `PageInfo<ItemCardVO>`。

6、**热门词写入**：检索有结果时以 `try/catch` 调 `RedisHelper` 对 `cl:search:hot` 执行 `ZINCRBY keyword 1` 并续期 7 天；失败仅记 `warn`，不影响返回。

7、**空结果兜底**：`total == 0` 且传了 `categoryId` 时，追加一次同分类在售热门查询（`ORDER BY view_count DESC LIMIT 4`），放 `fallbackList` 供前端渲染“同类热门”；无 `categoryId` 则不兜底，返回空列表（搜索“不存在的东西”不该被强行塞结果）。

**（2）分类树 `categoryTree`**

1、一次查询 `SELECT * FROM category WHERE is_show = 1 ORDER BY parent_id, sort_no`。

2、内存中按 `parent_id = 0` 取一级、其余归入对应父节点；**两级封顶**，出现三级数据直接忽略（防止字典误配导致前端嵌套渲染错乱）。

3、结果可按 `campus` 配置缓存，但本版不做缓存——分类字典仅 60 行级，直查比维护缓存失效更简单。

### 4、关键规则

1、**排序白名单防注入**：`ORDER BY` 是 MyBatis 唯一无法用 `#{}` 参数化的位置，因此只允许从固定 `Map` 取值，禁止 `ORDER BY ${sort}` 直传。

2、**组合索引命中**：分类 + 在售态走 `idx_cate_status(category_id, status)`，校区 + 在售态走 `idx_campus_status(campus, status)`；因此 `categoryId`/`campus` 条件必须与 `status` 同时出现才能命中组合索引（固定过滤保证了这一点）。

3、**只在售可见**：`status = 1 AND is_deleted = 0` 是硬过滤，不做“管理员可见全部”的分支——后台用独立接口（模块 12），避免一套 SQL 两种语义。

4、**分页稳定**：`ORDER BY` 末尾补 `id DESC` 兜底，防止 `view_count` 相同的记录在翻页时重复或遗漏。

5、**关键词最短长度**：`keyword` 去空格后长度 < 2 视为未传，避免单字导致全表 `LIKE` 扫描。

6、**兜底不掩盖空态语义**：只有传了分类才兜底，且明确放在 `fallbackList` 字段而非混入 `list`，前端能区分“搜到了”与“没搜到但给你看同类”。

### 5、异常分支

| 错误码 | 触发场景 | 提示语 |
| --- | --- | --- |
| `1001` | `page`/`pageSize` 非法、价格为负、金额格式错误 | 查询条件有误 |
| `5001` | 分类树查询异常、SQL 执行异常 | 系统繁忙，请稍后重试 |

> Redis 写热门词失败不对外暴露错误码：该操作不影响检索结果，仅记 `warn` 日志（不满足“依赖不可用”`5002` 的判定，因为主链路未降级）。

## （九）智能标签推荐（模块 09）

### 1、类与职责

| 类 / 接口 | 所在包 | 职责 |
| --- | --- | --- |
| `RecommendController` | `controller` | 暴露推荐列表与收藏切换两个接口 |
| `RecommendService` / `RecommendServiceImpl` | `service` | 标签加权、TOP 5 召回、热度排序、缓存回填、三级降级 |
| `TagService` | `service` | 独立封装 `cl:tag:user:{userId}` 的累加与续期，供浏览、收藏、发布三处调用 |
| `RecommendItemVO` | `vo` | `id`、`title`、`coverUrl`、`price`、`campus`、`reason`（推荐理由文案） |
| `ItemMapper`（推荐部分） | `mapper` | 按分类批量召回在售物品、按校区取热度 TOP |
| `RedisHelper` | `util`（模块 01 公共组件） | 封装 ZSet/String 读写、TTL 与 `try/catch` 降级 |

### 2、方法设计

| 方法签名 | 对应接口 | 事务 |
| --- | --- | --- |
| `List<RecommendItemVO> recommend(String campus, LoginUser current)` | `GET /api/recommendations` | 否（只读，含缓存回写） |
| `Boolean toggleFavorite(Integer itemId, LoginUser current)` | `POST /api/items/{id}/favorite` | 是 |
| `void addTagWeight(Integer userId, Integer categoryId, int weight)` | 内部方法（`@Async`） | 否 |
| `void refreshTagTtl(Integer userId)` | 内部方法 | 否 |

```java
public interface RecommendService {

    /** 首页为你推荐 12 条；未登录/冷启动/Redis 异常自动降级 */
    List<RecommendItemVO> recommend(String campus, LoginUser current);

    /** 收藏/取消收藏，并异步累加标签权重 +3 */
    Boolean toggleFavorite(Integer itemId, LoginUser current);

    /** 异步打标：浏览 +1、收藏 +3、发布 +5 */
    void addTagWeight(Integer userId, Integer categoryId, int weight);
}
```

### 3、处理流程

**（1）推荐列表 `recommend`**

1、未登录：跳过个性化，直接走降级链第 2 级（校区热门榜）。

2、**读缓存**：`RedisHelper.get(RedisKey.recCache(userId))`；命中且非空则直接返回（缓存内 12 条，前端“换一批”在本地轮换，不再打接口）。

3、**未命中 → 读标签**：`ZREVRANGE cl:tag:user:{userId} 0 4 WITHSCORES` 取权重 TOP 5 的分类 ID。

4、**召回与排序**：按 5 个分类批量查在售物品（`status = 1 AND is_deleted = 0`），按 `view_count DESC` 排序，取前 12 条；同分类内按权重高的优先，保证“最常看的分类”排在前面。

5、**生成推荐理由**：对每条结果，取其所命中分类的名称拼文案——「因为你常看「数码电子」」，权重来自第一优先分类时用「你最近关注」。文案由服务端生成而非前端拼接，保证多端一致。

6、**回填缓存**：`SETEX cl:rec:cache:{userId} 600 <json>`，10 分钟；序列化用 Jackson，VO 标注 `@JsonIgnoreProperties(ignoreUnknown = true)`。

**（2）降级链（三级）**

| 级别 | 触发条件 | 数据来源 | 前端表现 |
| --- | --- | --- | --- |
| 1 | 标签非空、Redis 正常 | `cl:tag:user` TOP 5 召回 | “为你推荐”+ 个性化理由 |
| 2 | 未登录、新用户无标签、标签为空 | `cl:rank:hot:{campus}` ZSet（读失败再退 3） | “同校区热门”，附“换一批” |
| 3 | Redis 整体不可用 | 直接查 `item`：`status=1` 按 `view_count DESC` + `campus` 过滤 `LIMIT 12` | “同校区热门”（与 2 同文案，用户无感） |

**（3）收藏切换与打标 `toggleFavorite`**

1、查物品，不存在或非在售 → `1001`/`2102` 由模块 02 的口径统一，本接口只需保证 `itemId` 合法。

2、事务内切换收藏状态（本版以 `cl:fav:user:{userId}` Set 承载，不新增表；如需持久化统计再扩表，超出 15 表范围需组长确认）。

3、返回 `favorited` 布尔值。

4、事务提交后异步调用 `addTagWeight(userId, item.categoryId, +3)`；取消收藏不回减权重（权重代表兴趣强度，不随一次取消归零）。

**（4）异步打标 `addTagWeight`**

1、`@Async` 执行，`ZINCRBY cl:tag:user:{userId} {weight} {categoryId}`。

2、随后 `EXPIRE cl:tag:user:{userId} 2592000`（30 天），实现“每次行为后续期”。

3、全程 `try/catch`，失败仅 `warn`——打标丢失影响下一次推荐质量，不影响本次请求。

4、浏览详情在模块 02 的详情接口内触发 `+1`，发布在模块 02 审核通过后触发 `+5`，三处统一调用 `TagService`，权重常量集中定义在 `RecommendConst`。

### 4、关键规则

1、**权重口径固定**：浏览 `+1`、收藏 `+3`、发布 `+5`，与《03-01》第 258 行一致；权重只增不减，靠 30 天 TTL 自然衰减，避免维护“减权重”的复杂逻辑。

2、**缓存 TTL 10 分钟**：过短会导致首页每次都走召回查询，过长会让新发布物品迟迟不出现；10 分钟是“可见性”与“数据库压力”的折中。

3、**所有 Redis 读写必须 `try/catch`**：这是《03-01》非功能设计（三）的硬要求；本模块是 Redis 依赖最重的模块，降级链三级保证“Redis 全挂首页仍可用”。

4、**推荐理由必须可解释**：理由文案只能来自“实际命中的标签分类名”，禁止生成“猜你喜欢”这类无信息量文案——验收时要能指着一条推荐说出为什么推它。

5、“**换一批**”在缓存内轮换：接口固定返回 12 条，前端本地轮换，不打接口；否则每次点击都触发一次召回，缓存形同虚设。

6、**打标与业务解耦**：打标是异步旁路，任何失败不得影响收藏、浏览、发布的主流程（与模块 04 邀约通知的“必须成功”策略相反，因为打标是本模块的旁路增强）。

7、**推荐不返回敏感字段**：`RecommendItemVO` 不含 `owner_id`、`description` 全文，减少一次请求的数据量与越权探测面。

### 5、异常分支

| 错误码 | 触发场景 | 提示语 | 降级行为 |
| --- | --- | --- | --- |
| `1001` | `itemId` 非法或缺失 | 参数错误 | — |
| `1002` | 未登录调用收藏接口 | 请先登录 | — |
| `1005` | 账号已停用 | 账号已停用，请联系管理员 | — |
| `5001` | 数据库查询异常（三级降级全部失效） | 系统繁忙，请稍后重试 | 首页展示空态与“最新发布”列表 |
| 不抛出 | Redis 连接失败或超时 | — | 记 `warn`，按降级链 2/3 返回，接口仍返回 `code=0` |

> 说明：Redis 故障按《03-01》要求走降级而非报 `5002`——`5002` 保留给“核销/凭证等主链路依赖不可用且无法降级”的场景（本模块主链路可降级，故不适用）。

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

1、《03-01 V1.1》第五章（二）与（三）只定义了 15 张表，其中**没有自提点表、也没有积分规则表**，但同文档第 873 行要求初始化“4 个校内自提点与 5 条积分规则”，模块 12 也提到“维护自提点与积分规则字典”。为不擅自扩表（15 表为冻结范围），本版把这两类数据落为**配置字典**：自提点走 `jdbc.properties` 的 `campus-loop.pickup-points`，积分规则走 `CreditRuleEnum`（键与 `credit_log.reason_type` 对齐）。若确需后台可视化维护，应新增 `sys_dict` 表——此举超出 15 表范围，须由组长在合稿时确认。

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

```properties
# jdbc.properties 片段：自提点与积分规则以配置字典落地（不占 15 张表）
# 注意：本项目为 SSM（非 Spring Boot），配置为 properties + Spring XML，无 application.yml
campus-loop.pickup-points=本部图书馆南门（有监控）,三舍楼下服务点,二食堂门口
campus-loop.credit.publish=2
campus-loop.credit.finish=5
campus-loop.credit.good-review=3
campus-loop.credit.donation=5
campus-loop.credit.no-show=-10
campus-loop.credit.report-valid=-15
```

上述键由 `applicationContext.xml` 的 `<context:property-placeholder location="classpath:jdbc.properties"/>` 加载，自提点字符串在 `AppointServiceImpl` 中按逗号切分为 `Set<String>` 做白名单校验，积分规则在 `CreditRuleEnum` 中以 `@Value` 注入分值，禁止在业务代码中硬编码数字。

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

> 说明：本章以「参与方 → 动作 → 事务边界 → 失败分支」的表格化时序描述，不使用图形。原因是交付物需经 Pandoc 导出 Word，图形在跨页时易丢失或被裁切，而表格可逐行比对，便于 11/25 三份文档交叉自检时定位差异。

## （一）以物易物全流程（含角色隔离核销）

### 1、参与方与前置条件

| 代号 | 角色 | 对应字段 | 本流程中的权限边界 |
| --- | --- | --- | --- |
| A | 发起方（学生） | `exchange_order.from_user_id` | 可下单、可取消、**唯一可核销**、可评价 |
| B | 物品所有者 | `exchange_order.to_user_id` | 可接单、可取消、**唯一可取核销码**、可评价 |
| I₁ | 目标物品 | `item.id = exchange_order.item_id` | 由 B 发布，`status = 1` 在售 |
| I₂ | 换出物品 | `item.id = exchange_order.offer_item_id` | 由 A 发布，`status = 1` 在售 |
| M₇ | 模块 07 诚信积分 | `CreditService` | 被模块 05 单向调用，不反向依赖 |
| M₁₀ | 模块 10 站内消息 | `NotifyService` | 横切底座，仅被调用 |

前置条件：A、B 均 `auth_status = 1` 且 `status = 1`；I₁、I₂ 均 `status = 1 AND is_deleted = 0`；I₁ 的 `trade_mode = exchange`。

### 2、阶段一：发起与成对锁单

| 步 | 发起方 | 接收方 | 动作 | 事务 |
| --- | --- | --- | --- | --- |
| 1 | A（浏览器 `[UI-07]`） | `OrderController` | `POST /api/orders`：`itemId=I₁`、`tradeMode=exchange`、`offerItemId=I₂`、`message` | — |
| 2 | `OrderController` | `OrderService.create` | `@Valid` 校验；取 Session `LoginUser` | 事务外 |
| 3 | `OrderServiceImpl` | `ItemMapper` | 查 I₁ 与 I₂，校验在售、非本人、模式一致、I₂ 归属 A | 只读 |
| 4 | `OrderServiceImpl` | `ItemMapper.lockItem(I₁)` | `UPDATE item SET status=2 WHERE id=? AND status=1 AND is_deleted=0` | **事务内** |
| 5 | 同上，影响行数=0 | — | 抛 `BizException(2101)`，事务回滚 | 回滚 |
| 6 | `OrderServiceImpl` | `ItemMapper.lockItem(I₂)` | 同条件更新换出物品；影响行数=0 同样 `2101` 并回滚（I₁ 锁定一并撤销） | **事务内** |
| 7 | `OrderServiceImpl` | `ExchangeOrderMapper.insert` | 插入单据：`order_status=0`、`order_no=CL+日期+序号`、`verify_code=NULL` | **事务内** |
| 8 | 事务提交 | — | 锁单完成 | 提交点 |
| 9 | `OrderServiceImpl` | `NotifyService`（模块 10） | `AFTER_COMMIT` 异步通知 B“有人想换你的物品” | 事务外 |

**关键点**：第 4–7 步必须在同一个事务内。若拆成两个事务，会出现“目标物品已锁、换出物品未锁”的半锁状态，该物品将既不能被别人下单、也无法被 A 用于其他交换，只能等 24 小时超时任务解锁。

### 3、阶段二：接单确认

| 步 | 发起方 | 接收方 | 动作 | 事务 |
| --- | --- | --- | --- | --- |
| 10 | B（`[UI-08]`） | `OrderController` | `POST /api/orders/{id}/confirm` | — |
| 11 | `OrderServiceImpl` | `ExchangeOrderMapper` | 校验参与方身份（B 必须是 `to_user_id`，否则 `1003`） | 只读 |
| 12 | 同上 | `ExchangeOrderMapper` | `UPDATE exchange_order SET order_status=1 WHERE id=? AND order_status=0` | **事务内** |
| 13 | 同上，影响行数=0 | — | 抛 `2102`（已确认/已取消/已违约） | 回滚 |
| 14 | `OrderServiceImpl` | `NotifyService` | `AFTER_COMMIT` 通知 A“对方已接单，请在 48 小时内预约” | 事务外 |

### 4、阶段三：预约与出码（角色隔离起点）

| 步 | 发起方 | 接收方 | 动作 | 事务 |
| --- | --- | --- | --- | --- |
| 15 | A 或 B（`[UI-09]`） | `OrderController` | `POST /api/orders/{id}/appointment`：`appointTime`（09:00–21:00 整半点）、`appointPlace`（自提点白名单） | — |
| 16 | `AppointmentServiceImpl` | — | 校验：参与方、状态必须为 `1`、时间在未来且合法、地点在白名单 | 只读 |
| 17 | 同上 | `IdUtil.nextVerifyCode()` | 生成 32 位一次性核销码 | 事务外 |
| 18 | `AppointmentServiceImpl` | `ExchangeOrderMapper` | `UPDATE ... SET order_status=2, appoint_time=?, appoint_place=?, verify_code=? WHERE id=? AND order_status=1` | **事务内** |
| 19 | 同上，影响行数=0 | — | 抛 `2102`（并发重复预约） | 回滚，`verify_code` 作废 |
| 20 | `AppointmentServiceImpl` | — | 出参**不含 `verify_code`**，仅返回时间与地点 | — |
| 21 | B | `OrderController` | `GET /api/orders/{id}/qrcode`：校验 `to_user_id`，`QrCodeUtil` 生成 `CL-VERIFY:{code}` 的 PNG 流 | 只读 |
| 22 | 同上，非 B 调用 | — | 抛 `1003`；单据状态非 `2` 抛 `2102` | — |

**关键点**：第 20 步是整个角色隔离设计的核心——核销码只存在于二维码图像里，接口响应中永不出现。因此“能看到码的人（A）无法从接口拿到码，能调用取码接口的人（B）不能提交核销”，任一方都无法在交付前独自完成闭环。

### 5、阶段四：核销（幂等闸口）

| 步 | 发起方 | 接收方 | 动作 | 事务 |
| --- | --- | --- | --- | --- |
| 23 | A 当面扫码 | `OrderController` | `POST /api/orders/{id}/verify`：`verifyCode` 来自扫码解析 | — |
| 24 | `AppointmentServiceImpl` | `ExchangeOrderMapper` | 校验 A 是否为 `from_user_id`（否则 `1003`）；状态 `3`→`2102`、`5`→`2104` | 只读 |
| 25 | 同上 | — | 常量时间比较 `verifyCode` 与库中值，不等抛 `2103` | — |
| 26 | 同上 | `ExchangeOrderMapper.verify` | `UPDATE exchange_order SET order_status=3, finish_time=NOW() WHERE id=? AND order_status=2` | **事务内** |
| 27 | 同上，影响行数=0 | — | 抛 `2102`（并发重复核销）；**后续加分代码不会执行** | 回滚 |
| 28 | 同上 | `ItemMapper` | I₁ 由 `2` 置 `3` 已完成；I₂ 同样置 `3` | **事务内** |
| 29 | 同上 | `CreditService`（模块 07） | A、B 各 `+5`（`reason_type=finish`，`ref_id=orderId`）：写 `credit_log` + 原子更新 `user.credit_score` | **同事务** |
| 30 | 事务提交 | — | 核销完成 | 提交点 |
| 31 | `AppointmentServiceImpl` | `NotifyService` + 模块 07 评价提醒 | `AFTER_COMMIT` 通知双方“已核销，7 天内可互评” | 事务外 |

**关键点**：第 26 步的条件更新是**唯一幂等闸口**。两个核销请求并发时，数据库行锁保证只有一个能拿到影响行数 1，另一个在第 27 步被拦下，因此第 29 步的加分绝不会重复执行——这比“先查状态再决定是否加分”可靠得多。

### 6、阶段五：互评

| 步 | 发起方 | 接收方 | 动作 | 事务 |
| --- | --- | --- | --- | --- |
| 32 | A / B（`[UI-08]` 唤起弹窗） | `ReviewController`（模块 07） | `POST /api/reviews`：`orderId`、`score`、`content`、`tags` | — |
| 33 | 同上 | — | 校验：参与方、订单已完成、完成时间在 7 天内（超期 `2302`）、未评价过 | — |
| 34 | 同上 | `ReviewMapper` | 插入评价，触发 `uk_order_from` 唯一索引；冲突返回 `2301` | 事务内 |
| 35 | 同上 | `CreditService` | 收到好评方 `+3`（`good_review`） | 同事务 |

### 7、事务边界与幂等闸口汇总

| 阶段 | 事务范围 | 幂等手段 | 失败后果 |
| --- | --- | --- | --- |
| 发起锁单 | `exchange_order` 插入 + 两件 `item` 条件更新 | `WHERE status=1` 条件更新 + `uk_order_no` | 整体回滚，物品均回到在售 |
| 接单 | 单据状态 `0→1` | `WHERE order_status=0` | 回滚，仍为待确认 |
| 预约 | 单据 `1→2` + 写入 `verify_code` | `WHERE order_status=1` | 回滚，核销码作废不可用 |
| 核销 | 单据 `2→3` + 两件物品置完成 + 双方加分 | `WHERE order_status=2` | 整体回滚，不产生“核销了没加分” |
| 取消 | 单据 →`4` + 成对解锁 | `WHERE order_status IN (0,1,2)` | 回滚，单据状态不变 |
| 互评 | 评价插入 + 加分 | `uk_order_from` 唯一索引 | 冲突返回 `2301`，无副作用 |

### 8、超时与异常分支

| 场景 | 触发条件 | 系统动作 | 用户可见结果 |
| --- | --- | --- | --- |
| 抢单失败 | 他人已锁 I₁ 或 I₂ | 事务回滚，返回 `2101` | “手慢了，该物品已被抢先锁定” |
| 超时未接单 | `0` 状态超 24 小时 | 置 `4`，成对解锁，原因“超时未接单” | 详情显示已取消，物品回到在售 |
| 超时未预约 | `1` 状态超 48 小时 | 置 `4`，成对解锁，原因“超时未预约” | 同上 |
| 面交未核销 | `2` 状态超预约时间 24 小时 | 置 `5` 违约，成对解锁，扣 A `-10` | 详情显示已违约，A 信用分下降 |
| 归责争议 | 实际为 B 爽约 | A 经模块 07 提交单次申诉（写 `report` 工单） | 管理员复核后回补或转扣 B |
| 核销码错误 | 扫码内容不匹配 | 返回 `2103`，单据状态不变 | “核销码无效，请重新扫码” |
| 重复核销 | A 重复提交或网络重试 | 条件更新影响行数 0，返回 `2102` | 提示已完成，不重复加分 |
| 超时后核销 | 单据已被判 `5` 违约 | 返回 `2104` | “该流转单已超时关闭，如有异议可提交申诉” |

## （四）推荐降级流程

### 1、参与方与数据来源

| 代号 | 组件 | 承载数据 | 本流程中的作用 |
| --- | --- | --- | --- |
| U | 当前用户 | `userId`、`campus` | 决定个性化标签与校区热榜 |
| R | Redis | `cl:tag:user:{userId}`、`cl:rec:cache:{userId}`、`cl:rank:hot:{campus}` | 标签权重、结果缓存、热榜 |
| D | MySQL | `item`、`category` | 召回在售物品、分类名与兜底热度 |
| S | `RecommendServiceImpl` | — | 编排三级降级、生成推荐理由 |

### 2、正常路径（L1：个性化推荐）

| 步 | 发起方 | 接收方 | 动作 | 降级判定 |
| --- | --- | --- | --- | --- |
| 1 | 首页 `[UI-02]` | `RecommendController` | `GET /api/recommendations?campus=本部` | — |
| 2 | `RecommendController` | `RecommendServiceImpl` | 取 Session；未登录则直接转 L2 | 未登录 → L2 |
| 3 | `RecommendServiceImpl` | `RedisHelper.get(recCache)` | 读推荐缓存 | 命中 → 直接返回 12 条 |
| 4 | `RecommendServiceImpl` | `RedisHelper.zrevrange(userTag, 0, 4)` | 取权重 TOP 5 分类 | 空或异常 → L2 |
| 5 | `RecommendServiceImpl` | `ItemMapper` | 按 5 个分类批量召回 `status=1 AND is_deleted=0`，按 `view_count DESC` 取 12 条 | 查询异常 → `5001` |
| 6 | `RecommendServiceImpl` | — | 按“分类权重降序 + 热度降序”重排，取前 12 | — |
| 7 | `RecommendServiceImpl` | — | 生成理由文案：命中第一优先分类用“你最近关注「X」”，其余用“因为你常看「X」” | — |
| 8 | `RecommendServiceImpl` | `RedisHelper.setex(recCache, 600, json)` | 回填缓存，TTL 10 分钟 | 写失败仅 `warn` |
| 9 | `RecommendController` | 前端 | 返回 `List<RecommendItemVO>`（12 条，含 `reason`） | — |

### 3、降级判定与链路

| 级别 | 触发条件 | 数据来源 | 返回内容 | 前端文案 |
| --- | --- | --- | --- | --- |
| L1 个性化 | 已登录 + 标签非空 + Redis 正常 | `cl:tag:user` TOP 5 → `item` 召回 | 12 条 + 个性化理由 | “为你推荐” |
| L2 校区热榜 | 未登录 / 新用户无标签 / 标签为空 / 标签读异常 | `cl:rank:hot:{campus}` ZSet 取 TOP 12 | 12 条 + “同校区热门”理由 | “同校区热门” |
| L3 数据库兜底 | L2 的 ZSet 也为空或读失败 | `item` 直查：`campus=? AND status=1 AND is_deleted=0 ORDER BY view_count DESC LIMIT 12` | 12 条 + 统一理由“同校区热门” | “同校区热门” |
| 空态 | L3 仍无数据（新部署、无在售） | — | 空列表 | 展示“暂无推荐，去逛逛最新发布” |

**降级触发点**：第 2 步（未登录）、第 4 步（标签为空或 Redis 抛异常）、L2 的 ZSet 为空、L3 的 SQL 异常。四个触发点均在 `try/catch` 内判定，任一异常只降一级、不抛给用户——**首页永不因 Redis 故障白屏**。

### 4、时效与缓存策略

| 缓存键 | TTL | 为何是这个值 |
| --- | --- | --- |
| `cl:rec:cache:{userId}` | 10 分钟 | 短于此会让每次首页刷新都走召回查询；长于此会让新发布物品迟迟不出现 |
| `cl:tag:user:{userId}` | 30 天（每次打标续期） | 兴趣以“月”为衰减周期，靠 TTL 自然过期，不维护减权重逻辑 |
| `cl:rank:hot:{campus}` | 1 天 | 热榜按天更新即可，由发布/成交事件增量写入 |

### 5、与模块 08 的关系

模块 09 只做“召回与排序”，不重复实现检索逻辑：召回阶段的在售过滤（`status=1 AND is_deleted=0`）复用模块 08 的固定条件口径，两者共用 `ItemMapper` 的查询片段。区别在于模块 08 面向“用户主动筛选”，必须支持任意组合条件与分页；模块 09 面向“系统主动推送”，只按分类与热度取固定 12 条，因此不复用 `PageHelper`，直接 `LIMIT` 取数。

---

# 十一、部署与配置

> 本项目为 **Java SSM 单体应用**（Spring 6.2.11 + SpringMVC + MyBatis，打 WAR 包部署到 Tomcat），**不使用 Spring Boot**，因此配置一律为 `properties` + Spring XML，不存在 `application.yml`。以下所有路径、端口、参数与《03-01 V1.1》第（四）节及《01-05 开发环境清单》一致。

## （一）部署拓扑与版本矩阵

单机轻量部署：一台主机运行 Tomcat 承载 WAR，同机部署 MySQL 与 Redis（课程演示环境不拆分物理机，生产化时才考虑独立主机）。

| 组件 | 版本 | 端口 | 部署位置 | 关键参数 |
| --- | --- | --- | --- | --- |
| JDK | 17 | — | `JAVA_HOME` | 编译与运行同版本，避免字节码不兼容 |
| Tomcat | 10.1.61 | 8080 | `/opt/tomcat` | 单实例；`URIEncoding=UTF-8`；仅配置 `upload/` 静态只读映射 |
| MySQL | 5.7.17 | 3306 | 同机 | 库名 `campus_loop`，`utf8mb4_general_ci`，InnoDB |
| Redis | 5.0 | 6379 | 同机 | 独立逻辑库 `database 3`，`maxmemory-policy allkeys-lru` |
| 应用 WAR | — | — | `/opt/tomcat/webapps/campus-loop.war` | 上下文路径 `/campus-loop` |

**Tomcat 10 的命名空间坑（务必注意）**：Tomcat 10 起 Servlet API 由 `javax.servlet.*` 迁移到 `jakarta.servlet.*`，配套 Spring 6.2.11 与 MyBatis 3.5.19。若误用 Tomcat 9 或引入 `javax.servlet-api` 依赖，启动会抛 `ClassNotFoundException: jakarta.servlet.Filter`，因此依赖树中禁止出现任何 `javax.servlet` 坐标。

| 目录 | 用途 | 权限要求 |
| --- | --- | --- |
| `/opt/tomcat/webapps/campus-loop/` | 解压后的应用 | 只读执行 |
| `/data/campus-loop/upload/` | 物品实拍图（`yyyyMM/`） | Tomcat 运行账号可写；对外静态只读 |
| `/data/campus-loop/certificate/` | 捐赠凭证 PDF（`yyyyMM/`） | 仅 Tomcat 运行账号可读写；**不对外映射** |
| `/data/campus-loop/logs/` | 应用与审计日志 | 可写，按天滚动 |
| `/opt/tomcat/backup/` | WAR 包历史版本 | 只读留存 |

## （二）目录规划与静态资源映射

**1、`upload/` 静态只读映射**

在 `spring-mvc.xml` 中把 URL 路径映射到容器外目录，避免图片打进 WAR（重新部署即丢失）：

```xml
<!-- spring-mvc.xml：静态资源与视图 -->
<mvc:resources mapping="/upload/**" location="file:/data/campus-loop/upload/" />
<mvc:resources mapping="/static/**" location="/static/" />

<mvc:default-servlet-handler />
<mvc:annotation-driven />
```

要点：

1、`location` 使用 `file:` 前缀指向容器外绝对路径，WAR 重部署不影响已上传图片。

2、只映射 `/upload/**`，**绝不映射 `/certificate/**`**——后者一旦映射，任何人猜到文件名即可下载他人捐赠凭证。

3、Tomcat 侧需确认未启用 CGI：`conf/web.xml` 的 CGI Servlet 保持注释；`upload/` 目录禁止执行脚本（Linux 下挂载 `noexec` 或将目录属主设为 Tomcat 运行账号且不给组写权限）。

**2、`certificate/` 非静态受保护目录**

1、目录位于 `/data/campus-loop/certificate/`，不在 `webapps` 下，Tomcat 无从将其作为静态资源暴露。

2、唯一访问入口是 `GET /api/donations/{id}/certificate`：`DonationController` 校验当前用户为捐赠人（`donor_id`）或接收社团（`club_id`），通过后由 `FileStorageService.readCertificateStream(certNo, out)` 以 `application/pdf` 流式写出，禁止整文件读入内存（凭证可能含图片，单件可达数 MB）。

3、验真走公开接口 `GET /api/donations/verify?certificateNo=...`，只返回脱敏字段，不返回文件流。

**3、映射自检方法**

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 图片可访问 | `curl -I http://localhost:8080/campus-loop/upload/202611/test.jpg` | `200`，`Content-Type: image/jpeg` |
| 凭证不可静态访问 | `curl -I http://localhost:8080/campus-loop/certificate/202611/CLD001.pdf` | `404`（**不是** `200`，出现 200 说明映射配错） |
| 凭证接口需鉴权 | `curl -i http://localhost:8080/campus-loop/api/donations/1/certificate` | `200` 响应体内 `code=1002` |

## （三）配置文件清单与关键参数

SSM 项目的配置由四个文件构成，按职责分离，禁止把数据源参数写进 XML 硬编码：

| 文件 | 位置 | 职责 |
| --- | --- | --- |
| `jdbc.properties` | `src/main/resources` | 数据源、Redis、上传根路径等环境相关参数 |
| `applicationContext.xml` | `src/main/resources` | 数据源、`SqlSessionFactory`、事务管理器、扫描 `service` |
| `spring-mvc.xml` | `src/main/resources` | 扫描 `controller`、静态资源映射、拦截器、视图解析 |
| `mybatis-config.xml` | `src/main/resources` | 驼峰映射、别名、分页插件 |
| `web.xml` | `src/main/webapp/WEB-INF` | `DispatcherServlet`、`CharacterEncodingFilter`、Session 超时 |

**`jdbc.properties` 关键项**：

```properties
# ---------- 数据源 ----------
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://127.0.0.1:3306/campus_loop?useUnicode=true&characterEncoding=utf8mb4&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
jdbc.username=campus_loop
jdbc.password=${DB_PASSWORD}
# 连接池（Druid）：最小 5、最大 20，与"50 并发"指标匹配
jdbc.pool.initialSize=5
jdbc.pool.minIdle=5
jdbc.pool.maxActive=20
jdbc.pool.validationQuery=SELECT 1
jdbc.pool.testWhileIdle=true

# ---------- Redis ----------
redis.host=127.0.0.1
redis.port=6379
redis.database=3
redis.timeout=2000
redis.pool.maxTotal=50

# ---------- 文件目录（容器外，禁止打进 WAR）----------
file.upload.root=/data/campus-loop/upload/
file.certificate.root=/data/campus-loop/certificate/
file.image.maxSize=2097152
file.image.allowExt=jpg,jpeg,png,webp

# ---------- 业务字典（15 表范围内无字典表，见第五章口径说明）----------
campus-loop.pickup-points=本部图书馆南门（有监控）,三舍楼下服务点,二食堂门口
campus-loop.credit.publish=2
campus-loop.credit.finish=5
campus-loop.credit.good-review=3
campus-loop.credit.donation=5
campus-loop.credit.no-show=-10
campus-loop.credit.report-valid=-15
```

**`mybatis-config.xml` 关键项**：

```xml
<configuration>
    <settings>
        <!-- 下划线转驼峰：user_name -> userName，避免 15 张表逐列手写 resultMap -->
        <setting name="mapUnderscoreToCamelCase" value="true"/>
        <setting name="cacheEnabled" value="false"/>
        <setting name="jdbcTypeForNull" value="NULL"/>
        <setting name="defaultStatementTimeout" value="10"/>
    </settings>
    <plugins>
        <plugin interceptor="com.github.pagehelper.PageInterceptor">
            <property name="helperDialect" value="mysql"/>
        </plugin>
    </plugins>
</configuration>
```

> `cacheEnabled=false` 是刻意设置：MyBatis 二级缓存按 namespace 共享，跨模块更新（如模块 05 改单据、模块 07 读单据）会导致读到脏数据，统一改由 Redis 承担缓存职责。

**`web.xml` 关键项**：

```xml
<!-- 统一 UTF-8，必须在 DispatcherServlet 之前 -->
<filter>
    <filter-name>encodingFilter</filter-name>
    <filter-class>org.springframework.web.filter.CharacterEncodingFilter</filter-class>
    <init-param><param-name>encoding</param-name><param-value>UTF-8</param-value></init-param>
    <init-param><param-name>forceEncoding</param-name><param-value>true</param-value></init-param>
</filter>

<session-config>
    <session-timeout>30</session-timeout>
</session-config>
```

**时区统一**：JDBC URL 的 `serverTimezone=Asia/Shanghai`、JVM 启动参数 `-Duser.timezone=Asia/Shanghai`、MySQL `time_zone='+08:00'` 三者必须一致。任一处不统一，`appoint_time` 的“超预约 24 小时判违约”就会出现整体偏移，这是超时任务最容易踩的坑。

## （四）启动与自检清单

部署后按顺序逐项验证，**任一项不通过不得进入联调**：

| 序 | 检查项 | 命令或操作 | 通过标准 |
| --- | --- | --- | --- |
| 1 | JDK 版本 | `java -version` | `17.x` |
| 2 | 数据库连通 | `mysql -ucampus_loop -p -e "use campus_loop; show tables;"` | 返回 15 张表 |
| 3 | 初始化数据 | `select count(*) from user;` / `select count(*) from category;` | 用户 4 行、分类 6 行 |
| 4 | 字符集 | `show variables like 'character_set_database';` | `utf8mb4` |
| 5 | 时区 | `select @@global.time_zone;` | `+08:00` |
| 6 | Redis 连通 | `redis-cli -n 3 ping` | `PONG` |
| 7 | 目录可写 | 上传一张物品图 | 落盘 `/data/campus-loop/upload/yyyyMM/`，DB 有 `item_image` 记录 |
| 8 | 静态映射 | 浏览器打开该图片 URL | 正常显示，非 404 |
| 9 | 凭证目录不可访问 | 直接构造 `/certificate/...` URL | 返回 `404` |
| 10 | 登录链路 | 用 `stu_demo` / `Campus@123` 登录 | 返回 `code=0` 且 Session 有值 |
| 11 | 敏感字段脱敏 | 抓取任意接口响应 | 不含 `password`、`verify_code`、`student_no` 全量 |
| 12 | 超时任务开关 | 查看 `OrderTimeoutTask` 日志 | 每小时执行一次，无异常堆栈 |

**日志配置**：`logback.xml` 分三个文件——`app.log`（INFO，按天滚动，保留 30 天）、`error.log`（ERROR，独立文件便于排查）、`oper.log`（操作审计，与模块 14 落库内容一致）。日志中禁止输出密码、token、`verify_code` 与完整学号。

## （五）SQL 快照与 WAR 包回滚（5 分钟）

课程演示要求“5 分钟内可回滚到上一可用版本”，因此发布前必须留三样东西：**数据库快照、上一个 WAR、Git Tag**。

**1、发布前留档（约 2 分钟）**

```bash
# ① 数据库快照：结构 + 数据全量，带时间戳
mysqldump -ucampus_loop -p \
  --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 \
  campus_loop > /opt/tomcat/backup/campus_loop_$(date +%Y%m%d_%H%M).sql

# ② 当前 WAR 另存为上一个版本
cp /opt/tomcat/webapps/campus-loop.war \
   /opt/tomcat/backup/campus-loop_$(date +%Y%m%d_%H%M).war

# ③ 打 Git Tag，标记本次发布点
git tag -a "release-$(date +%Y%m%d-%H%M)" -m "设计阶段联调版本"
git push origin --tags
```

**2、回滚步骤（约 3 分钟）**

| 步 | 操作 | 命令 | 耗时 |
| --- | --- | --- | --- |
| 1 | 停应用 | `systemctl stop tomcat`（或 `shutdown.sh`） | 20s |
| 2 | 还原数据库 | `mysql -ucampus_loop -p campus_loop < /opt/tomcat/backup/campus_loop_20261121_1530.sql` | 60–90s |
| 3 | 换回 WAR | `cp /opt/tomcat/backup/campus-loop_20261121_1500.war /opt/tomcat/webapps/campus-loop.war` | 5s |
| 4 | 清理解压目录 | `rm -rf /opt/tomcat/webapps/campus-loop/` | 5s |
| 5 | 启应用 | `systemctl start tomcat`，`tail -f logs/catalina.out` 看到 `Server startup in xxx ms` | 30–60s |
| 6 | 冒烟验证 | 登录 + 打开首页推荐 + 查一条流转单详情 | 30s |

**3、回滚的三条红线**

1、**只回滚代码、不回滚数据**适用于“新代码有 bug 但数据未污染”；一旦新版本已写入错误数据（如状态机错乱），必须连同快照一起回滚，否则旧代码读到新数据会二次报错。

2、**结构变更不可逆**：若新版本执行了 `ALTER TABLE`（如加列），回滚 SQL 快照会丢失新列数据。因此设计阶段约定——**联调期间禁止直接改线上表结构**，DDL 变更必须走“先改 `schema.sql` + 重建 + 重新灌 `data.sql`”的路径，并在 Git Tag 中记录。

3、**上传文件不回滚**：`upload/` 与 `certificate/` 是增量数据，回滚数据库会使部分文件失去引用，但**不得删除文件**——孤儿文件由定时清理任务在 30 天后处理，人工删会误伤仍在引用的图片。

**4、版本与镜像留存策略**

| 留存对象 | 数量 | 位置 | 清理方式 |
| --- | --- | --- | --- |
| SQL 快照 | 最近 5 份 | `/opt/tomcat/backup/` | 超出按时间删除最旧 |
| WAR 包 | 最近 3 个版本 | 同上 | 同上 |
| Git Tag | 每个发布点 1 个 | 远端仓库 | 不删除（审计需要） |
