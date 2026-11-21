# 四、模块详细设计（Part C：模块 06、07、15）

## （六）闲置快捐通道（模块 06）

模块职责：承载在校学生一键捐赠在售闲置物品给校内公益社团、社团隔离审核入库、唯一电子捐赠凭证 PDF 非静态目录落盘与鉴权流式下载，以及扫码公开脱敏验真。

### 1、类与职责

| 类名 | 层次 | 职责 |
| --- | --- | --- |
| `DonationController` | `controller` | 暴露快捐申请（`#19`）、台账列表（`#20`）、社团审核（`#21`）、凭证鉴权下载（`#22`）与公开验真（`#23`）接口 |
| `DonationService` / `DonationServiceImpl` | `service` | 执行快捐锁单校验、社团隔离过滤、审核流转、唯一凭证号生成、PDF 解耦渲染重试与公开验真脱敏 |
| `DonationMapper` | `mapper` | `donation` 表新增、按角色隔离条件分页查询、条件状态更新、按主键或 `certificate_no` 查询详情 |
| `DonationApplyDTO` | `dto` | 快捐申请入参：`itemId`（非空）、`clubId`（非空）、`remark`（≤ 255 字） |
| `DonationQuery` | `dto` | 继承 `PageQuery`，含可选筛选 `auditStatus`、`clubId`（社团登录时强制由服务端覆盖） |
| `DonationAuditDTO` | `dto` | 社团审核入参：`pass`（非空布尔）、`auditRemark`（驳回时必填，≤ 255 字） |
| `DonationVO` | `vo` | 捐赠申请与台账分页出参：含捐赠编号、物品标题与封面、捐赠人、接收社团、审核状态、凭证编号与时间 |
| `DonationCertVO` | `vo` | 渲染电子捐赠凭证 PDF 的内部数据模型：凭证编号、捐赠人姓名、物品名、社团名、审核通过日期与验真链接 |
| `DonationVerifyVO` | `vo` | 公开扫码验真最小脱敏出参：`certificateNo`、`itemTitle`、`clubName`、`donorMasked`、`auditTime`、`valid` |

### 2、方法设计

| 方法签名 | 对应接口 / 调用方 | 是否事务 | 说明 |
| --- | --- | --- | --- |
| `Result<DonationApplyVO> DonationController.apply(@Valid @RequestBody DonationApplyDTO dto, HttpSession session)` | `POST /api/donations`（`#19`） | 否 | 校验入参，提取当前学生 `LoginUser` 提交快捐申请 |
| `Result<PageResult<DonationVO>> DonationController.page(@Valid DonationQuery query, HttpSession session)` | `GET /api/donations`（`#20`） | 否 | 按本人/本社团/管理员权限隔离分页返回捐赠台账 |
| `Result<DonationAuditVO> DonationController.audit(@PathVariable Integer id, @Valid @RequestBody DonationAuditDTO dto, HttpSession session)` | `POST /api/donations/{id}/audit`（`#21`） | 否 | 社团审核通过或驳回捐赠申请 |
| `void DonationController.downloadCertificate(@PathVariable Integer id, HttpSession session, HttpServletResponse response)` | `GET /api/donations/{id}/certificate`（`#22`） | 否 | 鉴权校验通过后再设置 PDF 响应头并流式输出 |
| `Result<DonationVerifyVO> DonationController.verify(@RequestParam String certificateNo)` | `GET /api/donations/verify`（`#23`） | 否 | 公开接口，凭凭证号返回最小脱敏核验结果 |
| `DonationApplyVO DonationService.apply(DonationApplyDTO dto, LoginUser current)` | `DonationController.apply` | 是 | 条件更新锁单（`1 -> 2`）并落库 `donation` |
| `DonationAuditVO DonationService.audit(Integer donationId, DonationAuditDTO dto, LoginUser current)` | `DonationController.audit` | 是 | 社团隔离审核，事务外解耦渲染 PDF 写入 `certificate/` |
| `String DonationService.prepareCertificateForDownload(Integer donationId, LoginUser current)` | `DonationController.downloadCertificate` | 否 | 校验归属与审核通过态，缺失 PDF 时尝试即时补偿渲染并返回合法 `certNo` |
| `DonationVerifyVO DonationService.verifyCertificate(String certificateNo)` | `DonationController.verify` | 否 | 正则校验凭证号并组装最小脱敏验真信息 |

```java
package com.csu.campusloop.service;

import com.csu.campusloop.dto.DonationApplyDTO;
import com.csu.campusloop.dto.DonationAuditDTO;
import com.csu.campusloop.dto.DonationQuery;
import com.csu.campusloop.vo.DonationApplyVO;
import com.csu.campusloop.vo.DonationAuditVO;
import com.csu.campusloop.vo.DonationVO;
import com.csu.campusloop.vo.DonationVerifyVO;
import com.csu.campusloop.vo.LoginUser;
import com.csu.campusloop.vo.PageResult;

public interface DonationService {
    DonationApplyVO apply(DonationApplyDTO dto, LoginUser current);
    PageResult<DonationVO> page(DonationQuery query, LoginUser current);
    DonationAuditVO audit(Integer donationId, DonationAuditDTO dto, LoginUser current);
    String prepareCertificateForDownload(Integer donationId, LoginUser current);
    DonationVerifyVO verifyCertificate(String certificateNo);
}
```

### 3、处理流程

快捐申请流程（`POST /api/donations`，`@Transactional(rollbackFor = Exception.class)`）：

1、调用 `PermissionUtil.checkAuthenticatedStudent(current)` 校验已认证学生身份；查询目标社团账号（`user.id = clubId AND role = 'club' AND status = 1`），不存在或已停用抛 `1001`。

2、查询 `item` 记录：若不存在、`is_deleted = 1`、非当前用户所有（`owner_id != current.getUserId()`）或 `status != 1`（非在售），抛出 `BizException(ErrorCode.ITEM_NOT_DONATABLE)`（`2203`）。

3、调用 `ItemService.changeStatus(itemId, 1, 2)` 执行条件更新锁单：若影响行数为 `0`（并发已被他人下单或重复提交快捐），事务回滚并抛出 `BizException(ErrorCode.ITEM_TAKEN)`（`2101`）。

4、插入 `donation` 记录（`donor_id = current.getUserId()`、`club_id = dto.getClubId()`、`audit_status = 0`、`audit_remark = dto.getRemark()`）。

5、事务提交后异步调用模块 10 `NotifyService` 通知目标社团有新捐赠待审核，记录 `@OperLog` 并返回 `{donationId, auditStatus=0}`。

捐赠台账隔离查询流程（`GET /api/donations`）：

1、按当前 `LoginUser.role` 强制注入数据隔离条件：`role = "student"` 时固定限定 `donor_id = current.getUserId()`；`role = "club"` 时强制覆盖 `query.setClubId(current.getUserId())`（完全忽略前端传入的 `clubId` 参数，若前端显式传入其他社团 ID 可直接拒绝返回 `1003`）；`role = "admin"` 允许按全部或指定 `clubId` 筛选。

2、紧邻 `PageHelper.startPage` 执行分页查询并封装返回 `PageResult<DonationVO>`。

社团审核与 PDF 解耦生成流程（`POST /api/donations/{id}/audit`，核心状态变更标注 `@Transactional(rollbackFor = Exception.class)`）：

1、调用 `PermissionUtil.checkRole(current, "club")` 校验社团身份；查询 `donation` 记录（不存在抛 `2102`），调用 `PermissionUtil.checkClubAccess(current, donation.getClubId())` 校验本社团归属（越权抛 `1003`）。

2、若 `dto.getPass()` 为 `false`（驳回）：先校验 `dto.getAuditRemark()` 非空（为空抛 `1001`）；执行条件更新 `UPDATE donation SET audit_status = 2, audit_user = ?, audit_time = NOW(), audit_remark = ? WHERE id = ? AND club_id = ? AND audit_status = 0`（影响行数为 `0` 抛 `2102`）；调用 `ItemService.changeStatus(donation.getItemId(), 2, 1)` 将物品解锁回在售态（影响行数为 `0` 回滚抛 `2102`）。

3、若 `dto.getPass()` 为 `true`（通过）：调用 `IdUtil.nextCertNo()` 生成全局唯一凭证号（格式 `CLD` + `yyyyMM` + 6 位流水，如 `CLD2026110019`）；执行条件更新 `UPDATE donation SET audit_status = 1, audit_user = ?, audit_time = NOW(), audit_remark = ?, certificate_no = ? WHERE id = ? AND club_id = ? AND audit_status = 0`（影响行数为 `0` 抛 `2102`；若触发 `uk_certificate_no` 唯一索引冲突则重生成重试最多 3 次）；调用 `ItemService.changeStatus(donation.getItemId(), 2, 3)` 将物品置为已完成态；同事务内调用模块 07 `CreditService.addScore(donation.getDonorId(), +5, "donation", donation.getId(), "公益捐赠审核通过")` 发放捐赠诚信积分。

4、事务提交后解耦执行两项后置动作：第一，构造公开验真链接（如 `{baseUrl}/donations/verify?certificateNo={certNo}`），经 `QrCodeUtil.generatePng` 生成验真二维码与 `PdfUtil.renderDonationCert` 渲染中文字体 PDF，调用 `FileStorageService.saveCertificatePdf(certNo, pdfBytes)` 落盘至非静态目录 `certificate/yyyyMM/{certNo}.pdf`（若渲染或磁盘写入失败，仅捕获异常记 `error` 日志，绝不回滚已提交的审核结果）；第二，调用 `NotifyService` 通知捐赠人审核结论，并通过 `@OperLog` 留痕。

鉴权流式下载与公开脱敏验真流程（`#22`、`#23`）：

1、鉴权下载（`GET /api/donations/{id}/certificate`）：在写入任何响应头前调用 `prepareCertificateForDownload(id, current)`——校验记录存在且 `audit_status == 1`（否则 `2102`）、校验当前用户为捐赠人（`donor_id`）或接收社团（`club_id`，越权抛 `1003`）；检查目标 PDF 是否已存在，若此前异步渲染失败缺失文件，按需触发一次即时补偿渲染落盘（补偿仍失败抛 `5002`）。全部校验通过后，Controller 再设置 `Content-Type: application/pdf` 与 `Content-Disposition: attachment; filename="{certNo}.pdf"`，调用 `FileStorageService.readCertificateStream(certNo, response.getOutputStream())` 流式输出。

2、公开脱敏验真（`GET /api/donations/verify`）：校验 `certificateNo` 非空且匹配正则 `^CLD\d{12}$`（非法抛 `1001`）；按 `uk_certificate_no` 查库，不存在或 `audit_status != 1` 抛出 `2102`（“凭证编号无效或未生效”）；查获有效记录后对捐赠人真实姓名执行脱敏（保留首字，其余字符替换为 `**`，如“林**”），仅返回 `DonationVerifyVO` 六个最小脱敏字段。

### 4、关键规则

1、社团数据严格隔离：社团账号仅可查看、审核与下载归属本社团（`club_id`）的捐赠记录，越权一律返回 `1003`，SQL 层的 `club_id` 条件由后端 Session 强制注入。

2、锁单与解锁原子成对：快捐申请成功即将物品从 `1` 锁为 `2`；社团驳回时必须填写驳回理由并同事务解锁回 `1`；审核通过则同事务置物品为 `3` 已完成，严禁出现“审核通过但物品仍锁定”或“驳回后物品未解锁”。

3、PDF 渲染解耦与非静态保护：PDF 渲染放在数据库事务提交之后执行，必须注册嵌入中文字体防止方框乱码；失败不回滚业务，下载接口支持即时补偿生成；`certificate/` 目录严禁配置 Tomcat 静态资源映射。

4、公开验真最小字段白名单：`#23` 接口仅暴露 `certificateNo`、`itemTitle`、`clubName`、`donorMasked`、`auditTime`、`valid`，禁止返回捐赠人学号、学院、完整姓名及服务端本地路径。

### 5、异常分支

| 异常场景 | 错误码 | 处理与提示语 |
| --- | --- | --- |
| `itemId`/`clubId`/`pass` 缺失、驳回未填理由、目标社团无效或验真 `certificateNo` 格式非法 | `1001` | 拦截并返回具体字段提示（如“驳回捐赠必须填写原因”） |
| 未登录访问申请、台账、审核或凭证下载接口 | `1002` | 拦截器返回“请先登录” |
| 未认证学生发起快捐、非社团角色审核、跨社团审核/查看、非捐赠人且非接收社团下载凭证 | `1003` | `PermissionUtil` 拦截并返回“无权访问该捐赠记录” |
| 已登录账号被停用后发起捐赠或审核操作 | `1005` | 拦截器销毁旧 Session 并返回“账号已被停用” |
| 提交快捐时物品并发已被他人锁单 | `2101` | 条件更新影响行数为 0，回滚并返回“物品已被抢先占用” |
| 重复审核同一捐赠单、未审核通过即下载凭证或公开验真凭证号不存在 | `2102` | 返回“当前捐赠状态不允许该操作”或“凭证编号无效” |
| 捐赠物品非本人所有或非 `1` 在售状态 | `2203` | 返回“仅本人名下在售物品支持发起快捐” |
| PDF 渲染引擎故障或磁盘读写异常导致凭证文件无法就绪 | `5002` | 审核不回滚；下载即时补偿仍失败时返回“电子凭证生成失败，请稍后重试” |

## （七）诚信积分与履约评价（模块 07）

模块职责：维护配置化诚信积分规则、数据库原子加减分与流水追溯、四档信用等级判定、7 天内双向履约互评防刷，以及复用 `report` 表的扣分单次申诉与进度回显。

### 1、类与职责

| 类名 | 层次 | 职责 |
| --- | --- | --- |
| `CreditController` | `controller` | 暴露个人积分流水与申诉状态查询（`#24`）、提交扣分申诉（`#27`）接口 |
| `ReviewController` | `controller` | 暴露提交双向履约评价（`#25`）、查询用户收到的评价与标签统计（`#26`）接口 |
| `CreditService` / `CreditServiceImpl` | `service` | 原子增减积分、写 `credit_log`、等级判定、流水与申诉进度聚合查询、创建申诉工单 |
| `ReviewService` / `ReviewServiceImpl` | `service` | 校验订单完成态与 7 天期限、防重复评价、同对用户短期防刷加分与评价标签汇总 |
| `CreditLogMapper` | `mapper` | `credit_log` 表写入、按 `user_id` 分页查询、按主键查询单条扣分记录 |
| `ReviewMapper` | `mapper` | `review` 表插入、按 `to_user_id` 分页查询、标签频次聚合及同对用户 7 天好评计数 |
| `CreditRuleEnum` | `enums` | 集中维护 6 条基础积分规则（`publish:+2`、`finish:+5`、`good_review:+3`、`donation:+5`、`no_show/timeout:-10`、`report_valid:-15`）及申诉回补（`appeal_refund`）与四档信用等级阈值 |
| `ReviewSubmitDTO` / `CreditAppealDTO` | `dto` | 评价入参（`orderId`、`score` 1～5、`content` ≤ 500 字、`tags`）；申诉入参（`creditLogId`、`reason` 5～300 字） |
| `CreditLogVO` / `CreditSummaryVO` / `ReviewVO` | `vo` | 积分流水含申诉进度回显、总分与等级概览、评价与标签频次统计出参 |

### 2、方法设计

| 方法签名 | 对应接口 / 调用方 | 是否事务 | 说明 |
| --- | --- | --- | --- |
| `Result<CreditSummaryVO> CreditController.logs(@Valid PageQuery query, HttpSession session)` | `GET /api/credits/logs`（`#24`） | 否 | 查询本人当前总分、信用等级与带申诉进度的积分流水 |
| `Result<AppealCreateVO> CreditController.appeal(@Valid @RequestBody CreditAppealDTO dto, HttpSession session)` | `POST /api/credits/appeals`（`#27`） | 否 | 对单条本人扣分流水提交一次申诉（写入 `report` 表） |
| `Result<ReviewCreateVO> ReviewController.submit(@Valid @RequestBody ReviewSubmitDTO dto, HttpSession session)` | `POST /api/reviews`（`#25`） | 否 | 提交流转单双向履约评价 |
| `Result<ReviewListVO> ReviewController.list(@RequestParam Integer userId, @Valid PageQuery query)` | `GET /api/reviews`（`#26`） | 否 | 公开查询目标用户收到的评价分页与高频标签统计 |
| `void CreditService.addScore(Integer userId, Integer changeValue, String reasonType, Integer refId)` | 模块 05/12 单向调用 | 是 | 原子加减分并写 `credit_log`（默认按规则生成备注） |
| `void CreditService.addScore(Integer userId, Integer changeValue, String reasonType, Integer refId, String remark)` | 模块 05/07/12 单向调用 | 是 | 带自定义说明的原子改分主入口（申诉回补使用此重载） |
| `String CreditService.resolveLevel(Integer creditScore)` | 本模块及模块 02/13 调用 | 否 | 按 `≥90` 优秀、`75~89` 良好、`60~74` 一般、`<60` 受限判定等级 |
| `ReviewCreateVO ReviewService.submit(ReviewSubmitDTO dto, LoginUser current)` | `ReviewController.submit` | 是 | 校验期限与权限、唯一索引防重落库并触发防刷好评加分 |

```java
package com.csu.campusloop.service;

import com.csu.campusloop.dto.CreditAppealDTO;
import com.csu.campusloop.dto.PageQuery;
import com.csu.campusloop.vo.AppealCreateVO;
import com.csu.campusloop.vo.CreditSummaryVO;
import com.csu.campusloop.vo.LoginUser;

public interface CreditService {
    void addScore(Integer userId, Integer changeValue, String reasonType, Integer refId);
    void addScore(Integer userId, Integer changeValue, String reasonType, Integer refId, String remark);
    CreditSummaryVO getMyLogs(PageQuery query, LoginUser current);
    AppealCreateVO submitAppeal(CreditAppealDTO dto, LoginUser current);
    String resolveLevel(Integer creditScore);
}
```

### 3、处理流程

原子积分变动流程（`CreditService.addScore`，`@Transactional(rollbackFor = Exception.class)`，默认 `Propagation.REQUIRED` 融入调用方主事务）：

1、参数校验：`userId`、`changeValue`（非 0）与 `reasonType` 非空，否则抛 `1001`。

2、先查变动前分值档位（用于后续判断是否跨等级发通知），紧接着执行数据库原子更新 `UPDATE user SET credit_score = GREATEST(0, credit_score + #{changeValue}) WHERE id = #{userId}`（最低托底 0 分且校验影响行数 = 1，严禁先查出旧值在内存中加减后再回写）。

3、写入 `credit_log` 流水记录（`user_id`、`change_value`、`reason_type`、`ref_id`、`remark`），流水写入失败则整笔事务回滚，确保余额与流水绝对一致。

4、查询更新后的最新 `credit_score` 并经 `resolveLevel` 判定等级；若发生等级变动或触发扣分/申诉回补，注册事务提交后回调（`TransactionSynchronization.afterCommit`）异步调用 `NotifyService` 发送 `credit` 类型站内通知。

双向履约评价流程（`POST /api/reviews`，`@Transactional(rollbackFor = Exception.class)`）：

1、调用 `PermissionUtil.checkAuthenticatedStudent(current)` 校验已认证学生；查询 `exchange_order` 记录（不存在抛 `2102`），校验 `order_status == 3`（已完成，否则抛 `2102`）。

2、调用 `PermissionUtil.checkOrderParticipant(current, order)` 校验当前用户为交易双方之一（越权抛 `1003`），据此确定被评价人 `toUserId`（若当前为 `from_user_id` 则评 `to_user_id`，反之亦然）。

3、校验评价时效：计算 `order.finish_time` 至当前时间的间隔，超过 `7 * 24` 小时直接抛出 `BizException(ErrorCode.REVIEW_EXPIRED)`（`2302`）；对 `content` 执行 `SensitiveWordUtil` 敏感词检查（命中抛 `1001`）。

4、组装 `Review` 插入数据库，由联合唯一索引 `uk_order_from(order_id, from_user_id)` 并发防重；业务层显式捕获 `DuplicateKeyException` 并转抛 `BizException(ErrorCode.REVIEW_DUPLICATE)`（`2301`）。

5、好评防刷与加分：当 `dto.getScore() >= 4` 时，查询最近 7 天内 `credit_log`（或 `review`）中同一对用户 `(from_user_id, to_user_id)` 已触发好评加分的次数；若为 `0`（7 天内首次），同事务调用 `CreditService.addScore(toUserId, +3, "good_review", order.getId(), "收到流转单好评")`；若已加过分则正常保留评价但不重复计分，防止双方互刷积分。

积分流水查询与单次扣分申诉流程（`#24`、`#27`）：

1、流水与申诉回显（`GET /api/credits/logs`）：读取当前用户最新 `credit_score` 与等级，分页查询本人 `credit_log`；提取当前页所有 `change_value < 0` 的 `credit_log.id` 集合，批量查询 `report` 表中 `reporter_id = current.getUserId() AND report_type = '积分申诉'` 的工单，按前缀 `[creditLogId={id}]` 映射每条扣分记录的 `appealStatus`（`null` 未申诉、`0` 待复核、`1` 已通过、`2` 已驳回），组装 `CreditSummaryVO` 返回。

2、提交申诉（`POST /api/credits/appeals`，`@Transactional`）：校验 `credit_log` 存在且 `user_id == current.getUserId()`（越权抛 `1003`）且 `change_value < 0`（正分不可申诉抛 `2102`）；校验 `report` 表中不存在同 `reporter_id` 且前缀匹配 `[creditLogId={creditLogId}]` 的既有申诉记录（已申诉过抛 `2102`）；插入 `report` 表（`item_id = NULL`、`reporter_id = current.getUserId()`、`report_type = "积分申诉"`、`report_content = "[creditLogId=" + creditLogId + "] " + dto.getReason()`、`handle_status = 0`），返回 `{reportId, handleStatus=0}`；后续由模块 12 管理员在 `#40/#41` 统一复核，通过时调用 `CreditService.addScore(userId, +abs(changeValue), "appeal_refund", creditLogId, remark)` 补充回补流水并保留原扣分流水。

### 4、关键规则

1、数据库原子更新：全站任何积分变动必须收敛至 `CreditService.addScore`，使用 `credit_score = GREATEST(0, credit_score + ?)` 原子更新（最低托底 0 分）并与 `credit_log` 写操作处于同一本地事务，禁止内存先查后改。

2、四档信用等级与治理联动：`≥ 90` 优秀、`75～89` 良好、`60～74` 一般、`40～59` 受限（模块 02 在售上限降为 3 件）、`< 40` 观察期（暂停发布 7 天）；所有积分规则统一由 `CreditRuleEnum` 配置化管理。

3、一单一评与短期防刷：`review` 表以 `uk_order_from(order_id, from_user_id)` 强制防重；仅订单完成后 7 天内开放评价；同对用户 7 天内多次互评只计首次好评加分。

4、申诉复用 `report` 表不扩第 16 表：单条扣分流水严格限申诉 1 次，通过结构化前缀 `[creditLogId={id}]` 与 `report_type='积分申诉'` 精准回溯；复核通过只追加 `appeal_refund` 正分流水，严禁删除或篡改原始扣分流水。

### 5、异常分支

| 异常场景 | 错误码 | 处理与提示语 |
| --- | --- | --- |
| 评分不在 1～5、评价超 500 字、命中敏感词或申诉理由为空/超 300 字 | `1001` | 返回对应字段校验或合规提示 |
| 未登录查询本人积分流水、提交评价或提交申诉 | `1002` | 拦截器返回“请先登录” |
| 非流转单双方提交评价、申诉他人积分流水或未认证学生提交评价 | `1003` | 返回“无权执行该操作” |
| 停用账号旧会话发起评价或申诉 | `1005` | 拦截器销毁旧 Session 并返回“账号已被停用” |
| 流转单未完成即评价、对正分流水申诉或同一扣分流水重复申诉 | `2102` | 返回“当前状态不允许评价”或“该条扣分记录仅支持申诉一次” |
| 同一流转单重复评价触发 `uk_order_from` 唯一索引 | `2301` | 业务层捕获 `DuplicateKeyException` 转抛“您已评价过该流转单，请勿重复提交” |
| 流转单核销完成已超过 7 天 | `2302` | 返回“已超过 7 天评价期限” |

## （十五）换物集市与主题活动（模块 15）

模块职责：承载校园主题换物集市活动的发布、编辑、结束、公开展示与高并发防超卖报名（注明：本模块属于《01-01 项目立项书（V1.1）》Plan B 在极端进度受压时可经组长确认优先暂缓的扩展模块，正常周期按以下设计完整实现）。

### 1、类与职责

| 类名 | 层次 | 职责 |
| --- | --- | --- |
| `ActivityController` | `controller` | 暴露活动发布/编辑/结束（`#47`）、活动列表（`#48`）、活动详情（`#49`）与学生报名（`#50`）接口 |
| `ActivityService` / `ActivityServiceImpl` | `service` | 活动全生命周期管理、Redis 名额预热、MySQL 唯一真源防超卖报名与回滚计数回补 |
| `ActivityMapper` | `mapper` | `activity` 表新增、更新、分页查询、条件扣减 `remain_quota > 0` |
| `ActivityJoinMapper` | `mapper` | `activity_join` 表插入（受 `uk_activity_user` 约束）、查询当前用户报名态与统计活动参与人数 |
| `ActivitySaveDTO` | `dto` | 发布/编辑/结束三合一入参：`activityId`（空为新增）、`title`、`themeTag`、`campus`、`location`、`startTime`、`endTime`、`quota`、`description`、`status` |
| `ActivityQuery` | `dto` | 继承 `PageQuery`，含可选筛选 `campus`、`status` |
| `ActivityVO` / `ActivityDetailVO` | `vo` | 活动卡片分页出参、详情出参（含专区关联在售物品摘要、当前用户 `joined` 报名态与 `joinNo`） |
| `ActivityJoinVO` | `vo` | 报名成功出参：`{joinId, joinNo, remainQuota}` |

### 2、方法设计

| 方法签名 | 对应接口 / 调用方 | 是否事务 | 说明 |
| --- | --- | --- | --- |
| `Result<ActivitySaveVO> ActivityController.save(@Valid @RequestBody ActivitySaveDTO dto, HttpSession session)` | `POST /api/activities`（`#47`） | 否 | 管理员或社团发布、编辑或结束主题活动 |
| `Result<PageResult<ActivityVO>> ActivityController.page(@Valid ActivityQuery query)` | `GET /api/activities`（`#48`） | 否 | 公开分页查询主题活动列表 |
| `Result<ActivityDetailVO> ActivityController.detail(@PathVariable Integer id, HttpSession session)` | `GET /api/activities/{id}`（`#49`） | 否 | 公开/登录双态查询活动详情、专区物品与本人报名态 |
| `Result<ActivityJoinVO> ActivityController.join(@PathVariable Integer id, HttpSession session)` | `POST /api/activities/{id}/join`（`#50`） | 否 | 学生高并发报名，返回凭证号与最新剩余名额 |
| `ActivitySaveVO ActivityService.save(ActivitySaveDTO dto, LoginUser current)` | `ActivityController.save` | 是 | 保存或变更活动状态，报名中状态同步预热 Redis 预筛键 |
| `ActivityJoinVO ActivityService.join(Integer activityId, LoginUser current)` | `ActivityController.join` | 外层协调 + 内层事务 | 外层负责 Redis Lua 预筛与失败回补，内层调 `doJoinInDb` 执行 MySQL 事务 |
| `ActivityJoinVO ActivityService.doJoinInDb(Integer activityId, LoginUser current)` | `ActivityServiceImpl.join`（经代理自调或拆分事务服务） | 是 | 同一 MySQL 事务内完成状态校验、`remain_quota > 0` 条件更新与 `activity_join` 落库 |

```java
package com.csu.campusloop.service;

import com.csu.campusloop.dto.ActivityQuery;
import com.csu.campusloop.dto.ActivitySaveDTO;
import com.csu.campusloop.vo.ActivityDetailVO;
import com.csu.campusloop.vo.ActivityJoinVO;
import com.csu.campusloop.vo.ActivitySaveVO;
import com.csu.campusloop.vo.ActivityVO;
import com.csu.campusloop.vo.LoginUser;
import com.csu.campusloop.vo.PageResult;

public interface ActivityService {
    ActivitySaveVO save(ActivitySaveDTO dto, LoginUser current);
    PageResult<ActivityVO> page(ActivityQuery query);
    ActivityDetailVO detail(Integer activityId, LoginUser current);
    ActivityJoinVO join(Integer activityId, LoginUser current);
}
```

### 3、处理流程

活动发布/编辑/结束流程（`POST /api/activities`，`@Transactional(rollbackFor = Exception.class)`）：

1、调用 `PermissionUtil.checkRole(current, "admin", "club")` 校验发布权限；校验 `endTime` 晚于 `startTime`、`quota >= 1`（非法抛 `1001`）。

2、若 `activityId == null`（新发布）：插入 `activity` 表（`remain_quota = quota`、`creator_id = current.getUserId()`、`status` 默认 `1` 报名中或 `0` 草稿、`is_deleted = 0`）。

3、若 `activityId != null`（编辑或结束）：查库校验存在且 `is_deleted = 0`（否则 `2102`）；若当前用户为 `club` 角色则额外校验 `creator_id == current.getUserId()`（越权 `1003`）；已结束活动（`status == 3`）禁止重新编辑回报名中（抛 `2102`）；若调整了 `quota`，新 `quota` 不得小于已报名人数（`quota - remain_quota`，否则抛 `1001`）并同步重算 `remain_quota`。

4、事务提交后：若目标状态为 `1`（报名中），以 `try/catch` 调用 `RedisHelper.setex(RedisKey.activityQuota(activityId), ttlSeconds, String.valueOf(remainQuota))` 预热名额预筛键（TTL 设为 `endTime + 24h`）；若状态切为 `3`（已结束），同步清理预筛键并汇总报名人数写入审计日志。

活动报名高并发防超卖流程（`POST /api/activities/{id}/join`）：

1、前置身份校验：调用 `PermissionUtil.checkAuthenticatedStudent(current)` 校验已认证学生身份。

2、Redis 前置预筛（事务外）：调用 `RedisHelper.tryDecrQuotaLua(RedisKey.activityQuota(activityId))` 执行原子 Lua 脚本（若键存在且值 `> 0` 则 `DECR` 返回 `1`；若键存在且值 `<= 0` 则返回 `0`；若键不存在或 Redis 连接异常则返回 `-1`）。
   当返回 `0` 时，直接抛出 `BizException(ErrorCode.ACTIVITY_FULL)`（`2401`），挡住已满额流量；
   当返回 `1` 时，标记局部标志 `redisDecremented = true`，进入第 3 步 MySQL 事务；
   当返回 `-1`（缓存未预热或 Redis 宕机）时，记录 `warn` 日志并保持 `redisDecremented = false`，直接穿透进入第 3 步 MySQL 唯一真源事务。

3、MySQL 唯一真源事务（`doJoinInDb`，标注 `@Transactional(rollbackFor = Exception.class)`）：
   步骤 3.1：按主键查询 `activity` 记录，校验 `is_deleted == 0`、`status == 1`（报名中）且当前时间早于 `end_time`，不满足抛 `2102`。
   步骤 3.2：先执行带条件锁的原子名额扣减：`UPDATE activity SET remain_quota = remain_quota - 1 WHERE id = #{activityId} AND status = 1 AND is_deleted = 0 AND remain_quota > 0`；若影响行数为 `0`，说明名额已耗尽或状态已变，立即抛出 `BizException(ErrorCode.ACTIVITY_FULL)`（`2401`）。
   步骤 3.3：调用 `IdUtil.nextJoinNo()` 生成唯一报名凭证号（`CLJ` + `yyyyMMdd` + 6 位流水），插入 `activity_join(activity_id, user_id, join_no, status=1)`。若该学生此前已报名，MySQL 触发联合唯一索引 `uk_activity_user(activity_id, user_id)` 抛出 `DuplicateKeyException`，本地事务立即回滚（步骤 3.2 扣减的 `remain_quota` 自动复原，绝不出现“重复报名却白扣 1 个名额”），并转抛 `BizException(ErrorCode.ACTIVITY_ALREADY_JOINED)`（`2402`）。
   步骤 3.4：查询最新 `remain_quota` 返回 `ActivityJoinVO{joinId, joinNo, remainQuota}`。

4、异常回滚与 Redis 预筛回补（事务外 `catch` 块）：只要 `redisDecremented == true` 且第 3 步抛出任何异常（包括重复报名 `2402`、活动已结束 `2102` 或数据库异常，但不包括确认已满 `2401`），在 `catch` 块中立即调用 `RedisHelper.incrQuota(RedisKey.activityQuota(activityId))` 回补被预扣的 1 个预筛计数（`try/catch` 保护，失败仅记 `warn`），随后将原业务异常重新抛出。

5、事务提交后：异步调用 `NotifyService` 发送报名成功与凭证号通知，并经 `@OperLog` 记录报名留痕。

### 4、关键规则

1、名额一致性唯一真源：无论 Redis 是否在线，活动剩余名额始终以 MySQL `activity.remain_quota` 及同一事务内的条件更新为唯一真源；Redis 仅作高并发前置拦截层，彻底消除双路径计数分裂和超卖隐患。

2、防重与回滚闭环：`uk_activity_user` 联合唯一索引保证单人单活动仅能成功报名一次；重复报名或异常触发事务回滚时，MySQL 名额自动还原且同步回补 Redis 预筛计数。

3、状态机与权限：`activity.status` 严格遵循 `0 草稿 → 1 报名中 → 2 进行中 → 3 已结束`，仅 `1` 态允许报名；社团账号仅可维护本人发布的活动，管理员可维护全校活动。

4、Plan B 裁剪边界：本模块为低耦合外围扩展模块，不反向侵入模块 01～14；若期末开发周期紧张，按《01-01 项目立项书（V1.1）》Plan B 经组长确认可整体暂缓，不影响交易与快捐两条核心演示链路。

### 5、异常分支

| 异常场景 | 错误码 | 处理与提示语 |
| --- | --- | --- |
| 活动名称/地点缺失、`endTime <= startTime`、`quota < 1` 或新名额小于已报名人数 | `1001` | 拒绝保存并返回对应字段校验提示 |
| 未登录访问发布活动或报名接口 | `1002` | 拦截器返回“请先登录” |
| 普通学生调用 `#47` 发布/编辑活动、社团越权编辑他人活动或未认证学生报名 | `1003` | 返回“无权执行该操作” |
| 停用账号旧会话发起活动报名 | `1005` | 拦截器销毁旧 Session 并返回“账号已被停用” |
| 活动不存在、已删除、非 `1` 报名中状态报名，或尝试修改已结束活动 | `2102` | 回滚并回补 Redis（若有预扣），返回“当前活动状态不支持该操作” |
| Redis 预筛返回 `0` 或 MySQL 条件更新 `remain_quota > 0` 影响行数为 `0` | `2401` | 返回“活动名额已满” |
| 同一学生重复报名触发 `uk_activity_user` 唯一索引 | `2402` | 事务回滚复原名额并回补 Redis 计数，返回“您已报名该活动，请勿重复提交” |

---

# 六、接口详细设计

## （一）公共约定

本平台全部 50 个 RESTful 接口路径、HTTP 方法、权限角色与入出参摘要已在《03-01 需求开发概要设计说明书（V1.1）》第四章（三）冻结，本章不再重复罗列 50 条接口清单，重点明确编码期必须遵守的协议细则、两层参数校验契约与统一错误码枚举映射：

| 约定项 | 编码细则 |
| --- | --- |
| 路径与方法 | 统一前缀 `/api`，资源名小写复数；只读查询用 `GET`，新增、状态变更与逻辑删除统一用 `POST` |
| 媒体类型 | `GET` 用 Query String；JSON 写接口用 `application/json;charset=UTF-8`；物品发布/编辑（`#03`）因含多图上传使用 `multipart/form-data` |
| 统一响应体 | JSON 接口 HTTP 状态码固定 `200`，响应体为 `Result<T>{code, msg, data}`；`#18`（PNG）、`#22`（PDF）、`#36`（Excel）三个流式下载接口成功直接写字节流，鉴权/校验失败则在写响应头前交由全局异常处理器返回 JSON |
| 分页协议 | 请求统一继承 `PageQuery{page=1, pageSize=12}`（上限 `50`）；响应统一为 `PageResult<T>{total, list, pages, page, pageSize}`（对齐概要设计 `PageInfo<T>{total, list, pages}` 核心三字段并补回显当前页参数） |
| 鉴权与同源 | 基于 `HttpSession`（`SESSION_LOGIN_USER`）鉴权，拦截器对非白名单请求实时查库复核 `user.status`（停用销毁旧会话返 `1005`），对 `POST` 写接口叠加 `Origin/Referer` 同源校验（跨站返 `1003`） |
| 幂等与并发 | 写接口严禁依赖前端防抖作为唯一防重手段，后端必须依托条件更新（校验影响行数 = 1）与数据库唯一索引兜底 |

## （二）参数校验规则

全站接口实行两层校验：Controller 层通过 Jakarta Validation（`@Valid`、`@NotBlank`、`@NotNull`、`@Size`、`@DecimalMin`、`@Min`/`@Max`）拦截格式与边界错误（统一返 `1001`）；Service 层负责状态机、归属权限、敏感词与数据库约束等业务语义校验（按域返 `1003`/`2xxx`）：

| DTO 对象 | 对应接口 | Controller 注解校验（格式层） | Service 业务语义校验（规则层） |
| --- | --- | --- | --- |
| `LoginDTO` | `#01` | `username` 非空 3～30 位；`password` 非空 6～20 位；`role` 可选 | 防爆破计数预检；BCrypt 校验与 `role` 一致性（`1004`）；`user.status=1`（`1005`） |
| `ItemSaveDTO` | `#03` | `title` 非空 4～40 字；`categoryId`/`conditionLevel`/`tradeMode`/`campus` 非空；`description` ≤ 500 字 | 认证态与信用分门槛（`1003`/`2004`）；分类启用；敏感词（`1001`）；图片 1～5 张 ≤ 2MB 魔数校验（`2001`）；`keepImageUrls` 归属（`1003`）；寄售价 `>0` 且 ≤ 同类均价 3 倍或冷启动 ≤ 50000（`2002`）；待审+在售上限（`2003`/`2004`） |
| `OrderCreateDTO` | `#07` | `itemId` 非空；`tradeMode` 仅 `exchange`/`consign`；`message` ≤ 200 字 | 认证态；不可向本人下单（`2102`）；目标物品在售且模式一致；交换模式 `offerItemId` 非空且归属本人并在售；双条件更新锁单（`2101`） |
| `OrderAppointDTO` | `#16` | `appointTime` 非空（未来日期且 09:00–21:00 半小时整点）；`appointPlace` 非空 ≤ 50 字 | 仅交易双方可预约（`1003`）；`appointPlace` 属于预设校内自提点（`1001`）；`order_status=1 -> 2` 条件更新（`2102`） |
| `OrderVerifyDTO` | `#17` | `verifyCode` 非空 6～32 位 | 仅限发起方 `from_user_id`（`1003`）；未超时 24h（`2104`）；核销码一致（`2103`）；`order_status=2 -> 3` 条件更新（`2102`） |
| `DonationApplyDTO` | `#19` | `itemId`/`clubId` 非空；`remark` ≤ 255 字 | 认证态；社团账号存在且启用（`1001`）；本人 `1` 在售物品（`2203`）；条件锁单（`2101`） |
| `DonationAuditDTO` | `#21` | `pass` 非空；`auditRemark` ≤ 255 字 | 社团角色与本社团 `club_id` 归属（`1003`）；驳回时 `auditRemark` 必填（`1001`）；`audit_status=0` 条件更新防重复审核（`2102`） |
| `ReviewSubmitDTO` | `#25` | `orderId` 非空；`score` 1～5；`content` ≤ 500 字；`tags` ≤ 255 字 | 交易双方（`1003`）；订单已完成（`2102`）；完成 7 天内（`2302`）；敏感词（`1001`）；`uk_order_from` 防重（`2301`） |
| `CreditAppealDTO` | `#27` | `creditLogId` 非空；`reason` 非空 5～300 字 | 流水归属本人（`1003`）；必为负分扣分记录且未申诉过（`2102`） |
| `ActivitySaveDTO` | `#47` | `title` 非空 4～100 字；`campus`/`location`/`startTime`/`endTime`/`quota` 非空；`quota >= 1` | 管理员或社团角色（`1003`）；社团仅改本人活动；`endTime > startTime`（`1001`）；新名额不小于已报名数；已结束活动禁重开（`2102`） |

## （三）错误码总表

全站 23 个响应码统一定义于 `com.csu.campusloop.enums.ErrorCode`，与《03-01 需求开发概要设计说明书（V1.1）》第四章（二）严格逐条一致，业务层与全局异常处理器均通过枚举常量引用，严禁硬编码数字：

| 错误码 | `ErrorCode` 枚举常量 | 默认中文提示语 | 典型触发模块与处理建议 |
| --- | --- | --- | --- |
| `0` | `SUCCESS` | `ok` | 全模块正常响应，前端直接消费 `data` |
| `1001` | `PARAM_INVALID` | 参数错误 | 全模块：`@Valid` 校验失败、敏感词命中、驳回理由为空；前端高亮对应表单项提示 |
| `1002` | `UNAUTHORIZED` | 请先登录 | 拦截器：Session 缺失或过期；前端统一跳转登录页 `[UI-01]` |
| `1003` | `FORBIDDEN` | 无权执行该操作 | 拦截器/`PermissionUtil`：角色不符、越权、未认证、非指定核销人、跨社团或跨站 CSRF；前端提示无权限 |
| `1004` | `LOGIN_FAILED` | 账号或密码错误 | 模块 01：账号不存在、BCrypt 校验失败、角色不匹配或防爆破冷却期；前端保留输入并提示 |
| `1005` | `ACCOUNT_DISABLED` | 账号已被停用，请联系管理员 | 模块 01/拦截器：登录或旧会话实时复核到 `user.status=0`；前端清空本地态并跳转 `[UI-01]` |
| `2001` | `IMAGE_INVALID` | 上传图片不合规 | 模块 02：数量非 1～5 张、单张 > 2MB 或魔数非白名单；前端提示重新选图 |
| `2002` | `PRICE_INVALID` | 寄售价格超出合理范围 | 模块 02：寄售价 ≤ 0、超同类均价 3 倍或冷启动超 50000；前端引导调整定价 |
| `2003` | `ITEM_LIMIT_EXCEEDED` | 同时发布与在售物品已达 10 件上限 | 模块 02：正常信用分用户待审+在售满 10 件；前端引导先下架旧物 |
| `2004` | `CREDIT_RESTRICTED` | 当前信用分受限，暂不可继续发布 | 模块 02：信用分 `<40` 观察期或 `40~59` 满 3 件；前端引导跳转信用档案 `[UI-14]` |
| `2101` | `ITEM_TAKEN` | 物品已被抢先占用 | 模块 03/06：并发锁单条件更新影响行数为 0；前端提示并刷新列表 |
| `2102` | `STATE_NOT_ALLOWED` | 当前状态不允许该操作 | 模块 02–07/12/15：越级流转、重复审核/核销、操作锁定物、向本人下单、凭证号无效或重复申诉；前端刷新页面态 |
| `2103` | `VERIFY_CODE_INVALID` | 核销码无效或已使用 | 模块 05：核销码不匹配；前端提示重新核对对方二维码 |
| `2104` | `ORDER_TIMEOUT_CLOSED` | 订单已超时关闭 | 模块 05：预约超 24h 已由定时任务置为违约关闭；前端刷新展示关单原因 |
| `2201` | `SKILL_LIMIT_EXCEEDED` | 同类有效技能最多发布 3 条 | 模块 04：提供或需求单类满 3 条；前端提示先关闭旧技能 |
| `2202` | `SKILL_SELF_INVITE` | 不能向本人发布的技能发起邀约 | 模块 04：发起人与发布人相同；前端置灰本人技能邀约按钮 |
| `2203` | `ITEM_NOT_DONATABLE` | 仅本人名下在售物品支持发起快捐 | 模块 06：非本人或非 `1` 态物品；前端刷新物品状态 |
| `2301` | `REVIEW_DUPLICATE` | 您已评价过该流转单，请勿重复提交 | 模块 07：触发 `uk_order_from` 唯一索引；前端切换为只读评价态 |
| `2302` | `REVIEW_EXPIRED` | 已超过 7 天评价期限 | 模块 07：核销完成超 7 天；前端置灰评价入口 |
| `2303` | `OLD_PASSWORD_WRONG` | 原密码输入错误 | 模块 13：改密时旧密码 BCrypt 校验失败；前端提示重试 |
| `2401` | `ACTIVITY_FULL` | 活动名额已满 | 模块 15：Redis 预筛或 MySQL `remain_quota > 0` 扣减失败；前端置灰报名按钮 |
| `2402` | `ACTIVITY_ALREADY_JOINED` | 您已报名该活动，请勿重复提交 | 模块 15：触发 `uk_activity_user` 唯一索引；前端回显既有凭证号 |
| `5001` | `SYSTEM_ERROR` | 系统繁忙，请稍后重试 | 全局异常兜底：记录 `error` 完整堆栈，严禁向前端透传内部信息 |
| `5002` | `DEPENDENCY_UNAVAILABLE` | 外部服务暂不可用，请稍后重试 | 模块 06/基础设施：PDF 生成失败重试或关键依赖故障；前端提供重试按钮 |

---

# 七、关键流程时序（Part C：第 2、3 条）

## （二）捐赠到电子凭证与公开验真

本流程展示快捐从申请锁单、社团隔离审核、解耦生成电子凭证到鉴权流式下载与扫码脱敏验真的全链路。核心约束为“审核落库与 PDF 渲染事务解耦”以及“`certificate/` 目录绝不对外做静态映射”。

| 步骤 | 参与方 / 组件 | 动作与调用 | 数据与状态变化 | 事务与降级说明 |
| --- | --- | --- | --- | --- |
| 1 | 学生 → `DonationController` | 提交 `POST /api/donations`（`itemId, clubId, remark`） | 无 | `@Valid` 校验入参，拦截器校验会话与停用态 |
| 2 | `DonationServiceImpl` | 校验认证态与本人 `1` 在售物品；调 `ItemService.changeStatus(itemId, 1, 2)` | `item.status: 1 → 2`（锁定） | 事务 1 内；影响行数=0 抛 `2101` 回滚 |
| 3 | `DonationServiceImpl` | 写入 `donation` 申请记录 | `donation` 新增（`audit_status=0`） | 事务 1 内；与步骤 2 原子提交 |
| 4 | `NotifyService` | 发送待审核通知给目标社团 | `notify` 新增 1 条 | 事务 1 `AFTER_COMMIT`，失败仅记 `warn` |
| 5 | 公益社团 → `DonationController` | 提交 `POST /api/donations/{id}/audit`（`pass, auditRemark`） | 无 | 校验社团角色与 `club_id` 归属（越权 `1003`） |
| 6a | `DonationServiceImpl`（通过分支） | 生成 `certificate_no`；条件更新 `donation.audit_status: 0 → 1`；调 `ItemService.changeStatus(itemId, 2, 3)` 与 `CreditService.addScore(donorId, +5, "donation", donationId)` | `donation.audit_status=1`、`certificate_no` 落库；`item.status: 2 → 3`；捐赠人积分 `+5` 且 `credit_log` +1 | 事务 2 内；重复审核条件更新影响行数=0 抛 `2102` |
| 6b | `DonationServiceImpl`（驳回分支） | 校验驳回理由非空；条件更新 `donation.audit_status: 0 → 2`；调 `ItemService.changeStatus(itemId, 2, 1)` | `donation.audit_status=2`；`item.status: 2 → 1`（解锁） | 事务 2 内；驳回完成直接跳至步骤 8 通知学生 |
| 7 | `QrCodeUtil` + `PdfUtil` + `FileStorageService` | 事务 2 提交后，生成验真二维码并渲染中文字体 PDF 落盘 | 写入外部非静态目录 `certificate/yyyyMM/{certNo}.pdf` | 事务外解耦；异常仅记 `error` 日志，绝不回滚审核结果 |
| 8 | `NotifyService` + `@OperLog` | 通知捐赠人审核结论并异步记录审计日志 | `notify` 与 `oper_log` 各 +1 | 事务外异步，失败不影响主流程 |
| 9 | 捐赠人 / 本社团 → `DonationController` | 请求 `GET /api/donations/{id}/certificate` | 无（缺失 PDF 时即时补偿渲染一次） | 先完成归属鉴权（越权 `1003`）与文件就绪校验（缺失补偿失败返 `5002`），再设 PDF 响应头流式输出 |
| 10 | 任意扫码人 → `DonationController` | 请求公开接口 `GET /api/donations/verify?certificateNo=...` | 只读查询 `donation`（`uk_certificate_no`） | 仅返回 `DonationVerifyVO` 6 个最小脱敏字段（如 `donorMasked="林**"`），不暴露路径与隐私 |

事务边界总结：步骤 2～3 为事务 1（申请锁单），步骤 6a 或 6b 为事务 2（审核落库与物品终态/解锁），步骤 7 的 PDF 渲染与步骤 4、8 的通知审计全部置于事务之外，通过下载接口的按需补偿渲染闭合故障恢复路径。

## （三）诚信积分变动与申诉复核

本流程展示核销/好评/超时违约/举报触发原子改分，以及被扣分用户发起单次申诉、经模块 12 管理员复核并回补积分的闭环。核心约束为“原子改分与流水写入同事务”以及“申诉复用 `report` 表、保留原扣分流水不删改”。

| 步骤 | 参与方 / 组件 | 动作与调用 | 数据与状态变化 | 事务与降级说明 |
| --- | --- | --- | --- | --- |
| 1 | 模块 05 / 06 / 07 / 12 | 业务事件触发（核销 `+5`、捐赠 `+5`、好评 `+3`、超时 `-10`、举报核实 `-15`），调用 `CreditService.addScore(userId, val, reasonType, refId, remark)` | 无 | 复用调用方当前数据库事务（`Propagation.REQUIRED`） |
| 2 | `CreditServiceImpl` → `UserMapper` | 执行原子 SQL：`UPDATE user SET credit_score = GREATEST(0, credit_score + ?) WHERE id = ?` | `user.credit_score` 原子增减（最低托底 0 分） | 事务 1 内；禁止先查旧值内存计算后回写 |
| 3 | `CreditServiceImpl` → `CreditLogMapper` | 写入 `credit_log` 流水（含 `ref_id` 关联业务单号） | `credit_log` 新增 1 条 | 事务 1 内；写流水失败则步骤 2 同步回滚 |
| 4 | `CreditServiceImpl` → `NotifyService` | 判定新分值对应四档等级，若跨等级或扣分则通知用户 | `notify` 新增 `credit` 类型消息 | 事务 1 `AFTER_COMMIT`，失败仅记 `warn` |
| 5 | 被扣分学生 → `CreditController` | 在信用档案 `[UI-14]` 查看流水后提交 `POST /api/credits/appeals`（`creditLogId, reason`） | 无 | 校验流水归属本人（`1003`）、`change_value < 0` 且未申诉过（`2102`） |
| 6 | `CreditServiceImpl` → `ReportMapper` | 写入 `report` 申诉工单（`item_id=NULL`、`report_type='积分申诉'`、`report_content='[creditLogId={id}] ...'`） | `report` 新增 1 条（`handle_status=0`） | 事务 2 内；单条扣分仅允许建单 1 次 |
| 7 | 管理员 → `ReportController`（模块 12） | 在后台队列 `[UI-17]` 筛选 `report_type='积分申诉'` 并提交 `POST /api/admin/reports/{id}/handle` | 无 | 仅 `admin` 可调用（`1003`） |
| 8a | `ReportServiceImpl`（复核通过） | 条件更新 `report.handle_status: 0 → 1`；解析 `creditLogId` 并调用 `CreditService.addScore(userId, +absVal, "appeal_refund", creditLogId, remark)` | `report.handle_status=1`；`user.credit_score` 回补；`credit_log` 追加回补流水（原扣分流水保留） | 事务 3 内；重复处置影响行数=0 抛 `2102`；回补失败整体回滚 |
| 8b | `ReportServiceImpl`（复核驳回） | 条件更新 `report.handle_status: 0 → 2`，记录审核人与时间 | `report.handle_status=2`，积分余额不变 | 事务 3 内；重复处置抛 `2102` |
| 9 | `NotifyService` + `@OperLog` | 通知申请人复核结论并记录管理员审计日志；学生刷新 `#24` 流水实时看到最终申诉状态 | `notify` 与 `oper_log` 各 +1 | 事务 3 `AFTER_COMMIT` |

事务边界总结：步骤 1～3 融入触发方业务事务（如核销、超时关单或评价事务）保持强一致；步骤 6 为独立申诉建单事务；步骤 8a 中工单状态置 `1` 与积分回补流水同处事务 3 内，确保复核结果与积分余额绝不撕裂。
