::: {custom-style="Cover Eyebrow"}
中南大学 · 计算机科学与技术专业 · 高级程序设计实践
:::

::: {custom-style="Title"}
校园闲置互助流转平台
:::

::: {custom-style="Subtitle"}
需求详细设计文档（DDD · Java SSM 框架版）
:::

::: {custom-style="Cover English"}
Campus Loop · Detailed Design Document
:::

::: {custom-style="Cover Version"}
文档编号：03-05 ｜ 版本号：V1.0 ｜ 编制日期：2026 年 11 月
:::

| 项目 | 内容 |
| --- | --- |
| 文档名称 | 需求详细设计文档（DDD） |
| 项目名称 | 校园闲置互助流转平台（Campus Loop） |
| 文档版本 | V1.0 |
| 前置文档 | 《03-01 需求开发概要设计说明书（V1.1）》 |
| 编制团队 | 蒋岳霖（统筹与公共骨架）、陈春贤、邓屠政阳、黄子贤 |
| 读者对象 | 开发人员、测试人员、代码评审人 |
| 编制日期 | 2026 年 11 月 |

::: {custom-style="Page Break"}
:::

# 一、概述

## （一）编写目的

本文档在《03-01 需求开发概要设计说明书（V1.1）》冻结后编写，将系统总体方案细化到可直接编码的类清单、方法签名、处理流程、并发与幂等规则、异常分支、建表语句与核心时序。概要设计定义“有哪些模块与对外契约”，本文档定义“每个类与方法怎么写”，两者交叉引用、不重复定义接口字段。

## （二）适用范围

适用于本平台全部 15 个业务模块及 7 项公共组件的编码、联调、代码评审与测试设计。文中约定的包名、类名、方法名、DTO/VO 与字段名即为编码契约；编码期确需调整时须同步更新本文档并通知测试负责人。

## （三）术语与缩略语

| 术语 | 说明 |
| --- | --- |
| DTO | Data Transfer Object，接口入参对象，承载请求字段与校验注解 |
| VO | View Object，接口出参对象，按页面展示裁剪字段，禁止直接返回实体或密码字段 |
| 状态机 | 将状态枚举与合法状态迁移集中收口到枚举或领域服务，禁止在业务代码中散落判断 |
| 条件更新 | 通过 `UPDATE ... WHERE id = ? AND status = ?` 结合影响行数判断并发抢占是否成功 |
| 幂等 | 同一请求或定时任务重复执行时结果一致，不产生重复单据、重复扣分或重复消息 |
| 降级 | Redis、PDF 生成等非核心依赖不可用时捕获异常并切至备用实现，保证主流程可用 |

## （四）参考文档

1、《01-01 项目立项书（V1.1）》《01-04 团队分工表（V1.1）》《01-05 开发环境清单（V1.1）》

2、《校园闲置互助流转平台项目开发文档说明书（Java SSM 框架版）》

3、《03-01 需求开发概要设计说明书（V1.1）》（接口路径、错误码、15 表与 20 页清单唯一真源）

4、《需求设计交付任务书》

# 二、总体设计

## （一）包结构与分层

后端源码统一置于 `com.csu.campusloop` 根包下，严格单向分层，禁止下层反向调用上层：

| 子包 | 职责内容 | 编码约束 |
| --- | --- | --- |
| `controller` | 15 个业务模块的页面与 API 控制器 | 仅做 `@Valid` 参数校验、获取会话 `LoginUser`、调用 Service 并封装 `Result<T>` |
| `service` / `service.impl` | 业务接口与实现类（含 `FileStorageService`） | 事务边界与状态流转收口于此层；禁止在 impl 内调用 Controller |
| `mapper` | MyBatis Mapper 接口（对应 `resources/mapper/*.xml`） | 仅做持久化访问；参数一律使用 `#{}` 占位，禁止在 Service 拼 SQL |
| `entity` | 与 15 张表一一对应的持久化实体 | 仅含属性与 getter/setter，不直接作为接口返回值暴露 |
| `dto` / `vo` | 入参 DTO（含 `PageQuery`）与出参 VO（含 `Result`、`PageResult`、`LoginUser`） | 按接口拆分，DTO 携带校验注解，VO 严格脱敏 |
| `enums` | 错误码与状态枚举 | 集中定义 `ErrorCode`、物品/流转单/捐赠/举报/活动状态机枚举 |
| `config` | 配置类与常量（含 `RedisKey`、会话常量与 Jackson `ObjectMapper` 配置） | 数据源、Redis、拦截器注册、路径/字典常量与 `JavaTimeModule` 统一日期序列化 |
| `interceptor` | SpringMVC 拦截器 | 登录会话校验、账号实时停用复核、白名单精确放行与同源 CSRF 防护 |
| `aspect` | AOP 切面与 `@OperLog` 注解 | `@OperLog` 操作审计异步落库与敏感字段脱敏切面 |
| `task` | 定时任务 | 流转单三段超时巡检、每日运营数据预聚合 |
| `util` | 公共工具类（含 `RedisHelper`、`PermissionUtil` 等） | BCrypt 密码、日期、单号、图片压缩、二维码、PDF、Excel、敏感词、权限与缓存降级 |
| `exception` | 异常与全局处理 | `BizException`、`GlobalExceptionHandler` |

## （二）请求处理链路

HTTP 请求依次经过：`CharacterEncodingFilter` → `AuthInterceptor` → `Controller` → `Service`（含 `@OperLog` 切面与 `@Transactional`）→ `Mapper` → `MySQL / Redis`，响应沿原路返回，未捕获异常由 `GlobalExceptionHandler` 兜底转换。

1、Filter 仅负责 UTF-8 编码，不编写业务逻辑。

2、`AuthInterceptor` 按 HTTP 方法与路径/正则精确判定白名单；对受保护请求校验 Session 中的 `LoginUser`，调用 `AuthService.getAuthState(userId)` 按主键实时复核 `user.status`、`auth_status` 与 `role`（若账号不存在或已被停用则立即销毁 Session 并按 Ajax/页面区分返回 `1005` 或跳转登录页），同时对写请求执行同源来源校验。

3、Controller 负责 `@Valid` 格式校验、从 Session 提取 `LoginUser` 与调用 Service，不编写 SQL 或复杂分支。

4、Service 负责权限归属校验、业务规则校验、状态条件更新、事务管理与 Redis/PDF 异常降级。

5、Mapper 仅执行参数化 SQL，返回实体或查询 VO。

## （三）公共约定

| 约定项 | 具体要求 |
| --- | --- |
| 主键与金额 | 所有表主键与接口业务 ID 统一 `Integer`；金额统一 `BigDecimal`（`RoundingMode.HALF_UP`，保留 2 位），禁止 `double`/`float` |
| 密码安全 | 统一经 `PasswordUtil` 使用 BCrypt 不可逆哈希存储与比对，禁止明文入库或日志输出 |
| 事务边界 | 涉及多表写操作、成对锁定/解锁、积分原子变更或活动报名扣减的 Service 方法一律标注 `@Transactional(rollbackFor = Exception.class)` |
| 并发与防重 | 禁止“先查后改”；锁单、核销、积分增减与活动名额扣减全部采用数据库原子更新或条件更新，校验影响行数等于 1 才算成功 |
| 异常处理 | 业务校验失败统一抛出 `BizException(ErrorCode)` 或 `BizException(ErrorCode, String customMsg)`，禁止吞掉异常静默返回 `null` |
| 缓存与降级 | Redis 键一律由 `RedisKey` 生成并强制带 TTL；所有 Redis 读写均经 `RedisHelper` 用 `try/catch` 包裹，失败返回降级值并记 `warn` 日志 |
| 分页与时间 | 使用 `PageHelper.startPage(page, pageSize)` 后紧跟单条查询（默认 `page=1, pageSize=12`，上限 `50`）；时间统一 `LocalDateTime`（`yyyy-MM-dd HH:mm:ss`，由全局 `ObjectMapper` 注册 `JavaTimeModule` 序列化） |

# 三、公共组件详细设计

## （一）统一返回与错误码

`Result<T>` 位于 `com.csu.campusloop.vo`，封装 `{code, msg, data}` 三字段，JSON 接口 HTTP 状态码固定返回 `200`，由 `code` 区分结果；错误码全部收口在 `com.csu.campusloop.enums.ErrorCode` 枚举中，与《03-01 需求开发概要设计说明书（V1.1）》第四章（二）逐条一致，严禁在业务代码中硬编码数字错误码。

二进制流接口例外约定：核销二维码下载（`#18 GET /api/orders/{id}/qrcode`，`image/png`）、电子捐赠凭证下载（`#22 GET /api/donations/{id}/certificate`，`application/pdf`）与运营报表导出（`#36 GET /api/admin/dashboard/export`，`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`）成功时直接向 `HttpServletResponse` 写出字节流。鉴权、归属校验与文件/数据存在性检查必须在设置下载响应头与获取 `OutputStream` 之前完成，校验失败时直接抛出 `BizException`，由 `GlobalExceptionHandler` 正常返回 `Result<Void>` JSON。

```java
package com.csu.campusloop.vo;

import com.csu.campusloop.enums.ErrorCode;

public class Result<T> {
    private Integer code; // 0 成功，其余见 ErrorCode
    private String msg;   // 中文提示
    private T data;       // 业务数据，可为 null

    public static <T> Result<T> ok(T data) { /* code=0, msg="ok" */ }
    public static Result<Void> ok() { /* code=0, msg="ok", data=null */ }
    public static <T> Result<T> fail(ErrorCode errorCode) { /* 取枚举 code 与 msg */ }
    public static <T> Result<T> fail(ErrorCode errorCode, String customMsg) { /* 保留枚举 code，覆写提示 */ }
    public static <T> Result<T> fail(Integer code, String msg) { /* 仅框架内部或兜底调用 */ }
}
```

## （二）全局异常处理

`BizException` 继承 `RuntimeException`，持有 `ErrorCode errorCode` 与可选覆盖文案 `customMsg`，提供 `BizException(ErrorCode)` 与 `BizException(ErrorCode, String customMsg)` 两个构造器。`GlobalExceptionHandler` 使用 `@RestControllerAdvice` 统一拦截控制层与业务层抛出的异常并转换为标准 `Result`：

| 异常类型 | 返回错误码 | 处理逻辑与日志级别 |
| --- | --- | --- |
| `BizException` | `e.getCode()` | 直接返回 `e.getMsg()`，记录 `warn` 日志 |
| `MethodArgumentNotValidException` / `BindException` / `ConstraintViolationException` | `1001` | 提取首条参数校验失败提示返回，记录 `warn` 日志 |
| `MissingServletRequestParameterException` / `MethodArgumentTypeMismatchException` / `HttpMessageNotReadableException` / `MissingServletRequestPartException` | `1001` | 返回“请求参数格式不正确或缺少必填项”，不暴露底层反序列化类名，记录 `warn` 日志 |
| `MaxUploadSizeExceededException` | `2001` | 返回“上传图片大小超限（单张不超过 2MB）”，记录 `warn` 日志 |
| `DuplicateKeyException` | `2301` / `2402` / `5001` | 模块 07（评价）与模块 15（活动报名）优先在业务层捕获并执行补偿（模块 15 回补 Redis 预筛名额）后再抛对应 `BizException`；全局处理器按 `e.getMostSpecificCause().getMessage()` 兜底映射：`uk_order_from`→`2301`、`uk_activity_user`→`2402`，其余唯一键冲突记录 `error` 日志返回 `5001` |
| `Exception` | `5001` | 记录完整堆栈 `error` 日志，对外统一返回“系统繁忙，请稍后重试”，严禁向前端透传堆栈或 SQL |

## （三）登录拦截与权限判定

会话对象统一定义为 `com.csu.campusloop.vo.LoginUser`，包含 `userId`（`Integer`）、`username`、`realName`、`role`、`campus`、`authStatus`（`Integer`）六个字段，在 `HttpSession` 中以常量 `AuthConstants.SESSION_LOGIN_USER` 键名存储。

1、白名单精确放行规则：`AuthInterceptor`（实现 `HandlerInterceptor`）严禁将 `/api/**` 公开接口直接配置到 SpringMVC 仅按 URI 匹配的 `excludePathPatterns`（防止与同 URI 的写接口 `POST /api/items`、`POST /api/skills`、`POST /api/reviews`、`POST /api/activities` 碰撞，或用通配符误放行 `GET /api/items/mine`）。`excludePathPatterns` 仅放行静态资源（`/static/**`、`/upload/**`，严禁放行 `/certificate/**`）；其余路径全部在 `preHandle` 中按“HTTP 方法 + 精确路径/纯数字正则”判定：
   公开页面路由（`GET`）：`/login`、`/`、`/index`、`/items`、`^/items/\d+$`、`/skills`、`/activities`、`/donations/verify`；
   公开 API 路由：`POST /api/auth/login`、`GET /api/items`、`GET ^/api/items/\d+$`、`GET /api/categories/tree`、`GET /api/recommendations`、`GET /api/skills`、`GET /api/reviews`、`GET /api/activities`、`GET ^/api/activities/\d+$`、`GET /api/donations/verify`。

2、公开/登录双态接口约定：`GET /api/recommendations`、`GET /api/items/{id}`、`GET /api/activities/{id}` 属于白名单公开读接口，未登录允许浏览；若请求携带有效 Session，Service 层可读取其中的 `LoginUser` 渲染个人态信息（如收藏态、本人物品管理入口与报名态），不额外触发未登录拦截。

3、受保护接口会话校验与实时停用拦截：未命中白名单的请求必须存在有效 `SESSION_LOGIN_USER`；未登录时 Ajax 请求（URI 以 `/api/` 开头或请求头含 `X-Requested-With: XMLHttpRequest`）写出 `Result.fail(ErrorCode.UNAUTHORIZED)` JSON，页面请求重定向至 `/login`。已登录时调用 `AuthService.getAuthState(loginUser.getUserId())` 按主键实时查询 `status`、`auth_status` 与 `role`：若记录不存在或 `!Integer.valueOf(1).equals(state.getStatus())`，立即调用 `session.invalidate()`，Ajax 请求写出 `Result.fail(ErrorCode.ACCOUNT_DISABLED)` JSON，页面请求重定向至 `/login?disabled=1`；账号正常时将最新的 `authStatus` 与 `role` 同步回写至 Session 中的 `LoginUser`，避免权限变更后持有旧态。

4、同源 CSRF 校验：对所有已通过登录校验的 `POST` 写接口，校验请求头 `Origin`（缺失时回退检查 `Referer`）是否与当前站点协议、主机及端口一致；存在跨站来源时立即拒绝并返回 `Result.fail(ErrorCode.FORBIDDEN)`。

5、细粒度权限校验统一收敛至 `com.csu.campusloop.util.PermissionUtil`，全部方法在校验不通过时统一抛出 `BizException(ErrorCode.FORBIDDEN)`：
   `checkRole(LoginUser user, String... roles)`：校验当前角色在允许列表内；
   `checkAuthenticatedStudent(LoginUser user)`：校验角色为 `student` 且 `Integer.valueOf(1).equals(user.getAuthStatus())`，用于全部校园业务写接口；
   `checkOwner(Integer currentUserId, Integer ownerId)`：校验当前用户为资源归属人；
   `checkOrderParticipant(LoginUser user, ExchangeOrder order)`：校验当前用户为流转单发起方或目标物品所有者；
   `checkOrderQrOwner(LoginUser user, ExchangeOrder order)`：仅允许物品所有者（`to_user_id`）获取核销二维码（`#18`）；
   `checkOrderVerifier(LoginUser user, ExchangeOrder order)`：仅允许流转单发起方（`from_user_id`）提交扫码/输码核销（`#17`）；
   `checkClubAccess(LoginUser user, Integer clubId)`：校验社团账号（`role="club"`）仅可读写归属本社团的数据，管理员按接口规则显式放行。

## （四）分页与查询封装

列表查询入参统一继承 `com.csu.campusloop.dto.PageQuery`（含 `page` 默认 `1`、`pageSize` 默认 `12`，服务端强制将 `page < 1` 修正为 `1`、`pageSize` 裁剪至 `[1, 50]`）。Service 层在单条列表查询前紧邻调用 `PageHelper.startPage(query.getPage(), query.getPageSize())`，统一经 `PageResult.of(List<T> list)` 封装为 `com.csu.campusloop.vo.PageResult<T>{total, list, pages, page, pageSize}` 返回。

说明：`PageResult<T>` 对外协议严格对齐《03-01 需求开发概要设计说明书（V1.1）》第四章（一）约定的 `PageInfo<T>{total, list, pages}` 核心三字段，并补充回显当前 `page` 与 `pageSize`，避免直接序列化 PageHelper 原生 `com.github.pagehelper.PageInfo` 暴露十余个无关内部字段。动态排序字段一律通过服务端 `Map<String, String>` 白名单映射为合法列名，禁止拼接前端传入字段名。

## （五）文件上传与目录隔离

`com.csu.campusloop.service.FileStorageService` 严格区分两类位于应用 WAR 包外部的本地目录，操作系统与 Tomcat 均禁用两目录的脚本执行权限：

1、物品实拍图目录（`upload/yyyyMM/`，允许 Tomcat 配置静态只读映射）：`saveItemImage(MultipartFile file)` 严格按“非空与大小校验（≤ 2MB）→ 扩展名白名单（`jpg`/`jpeg`/`png`/`webp`）→ 文件头魔数校验（不信任客户端 `Content-Type`）→ `ImageUtil` 解码重编码压缩（剥离 EXIF 与潜在脚本，主图最大宽 1200px，命名 `{uuid}.jpg`；同步生成宽 300px 缩略图，命名 `{uuid}_thumb.jpg`）”顺序执行，任意校验失败抛 `BizException(ErrorCode.IMAGE_INVALID)`（`2001`）。方法返回主图相对路径（如 `/upload/202611/{uuid}.jpg`），前端列表卡片按同前缀 `_thumb.jpg` 规则加载缩略图；同步提供 `deleteQuietly(List<String> relativePaths)` 供事务回滚后异步清理孤儿文件。

2、电子捐赠凭证目录（`certificate/yyyyMM/`，严禁配置 Tomcat 静态 URL 映射）：`saveCertificatePdf(String certNo, byte[] pdfBytes)` 按 `certNo` 固定格式（`^CLD(\d{6})\d+$`）解析年月子目录并落盘为 `{certNo}.pdf`；下载时仅由 `DonationController` 在鉴权与归属校验通过后调用 `readCertificateStream(String certNo, OutputStream out)` 流式写出。读取前强制校验 `certNo` 匹配白名单正则并验证 `targetPath.toAbsolutePath().normalize().startsWith(baseDir)` 杜绝路径遍历；文件不存在时抛出 `BizException(ErrorCode.DEPENDENCY_UNAVAILABLE)`（`5002`）提示前端重试生成。

## （六）Redis 客户端与键规范

全部键模板统一收口在 `com.csu.campusloop.config.RedisKey` 并加 `cl:` 前缀，所有 ID 参数类型为 `Integer`；`com.csu.campusloop.util.RedisHelper` 封装 `get`、`setex`、`zrevrange`、`zincrby`、`tryDecrQuotaLua`、`incrQuota`、`incrLoginFail` 等方法，写操作强制传入过期时间（不提供永不过期重载），所有读写均用 `try/catch` 包裹并在异常时记录 `warn` 日志返回降级默认值，严禁因 Redis 故障中断主业务。

下表前 6 项严格对应《03-01 需求开发概要设计说明书（V1.1）》第五章（五）核心业务键，第 7 项为详细设计阶段补充的登录防爆破运行期保护键（不改变 V1.1 核心业务键设计，Redis 不可用时自动降级放行）：

| 方法签名 | 生成键名 | 数据结构 | TTL | 用途与一致性说明 |
| --- | --- | --- | --- | --- |
| `RedisKey.userTag(Integer userId)` | `cl:tag:user:{userId}` | ZSet | 30 天 | 用户兴趣标签权重（浏览 +1、收藏 +3、发布 +5） |
| `RedisKey.hotItem(String campus)` | `cl:rank:hot:{campus}` | ZSet | 1 天 | 校区热门在售物品榜，推荐冷启动兜底 |
| `RedisKey.recCache(Integer userId)` | `cl:rec:cache:{userId}` | String (JSON) | 10 分钟 | 首页个性化推荐 12 条结果缓存 |
| `RedisKey.hotSearch()` | `cl:search:hot` | ZSet | 7 天 | 全校热门检索词榜 |
| `RedisKey.activityQuota(Integer activityId)` | `cl:act:quota:{activityId}` | String (Int) | 活动结束后 24h | 活动名额高并发前置预筛计数（MySQL 事务为唯一真源，回滚回补） |
| `RedisKey.authCode(String studentNo)` | `cl:auth:code:{studentNo}` | String | 5 分钟 | 校园邮箱身份核验验证码（预留扩展） |
| `RedisKey.loginFail(String username)` | `cl:auth:fail:{username}` | String (Int) | 15 分钟（触发冷却重设 5 分钟） | 登录防爆破失败计数（DDD 运行期细化键，异常降级放行） |

## （七）工具类清单

| 工具类 | 职责 | 关键方法签名（均位于 `com.csu.campusloop.util`） |
| --- | --- | --- |
| `PasswordUtil` | BCrypt 密码哈希与校验 | `String encode(String rawPassword)`、`boolean matches(String rawPassword, String encodedPassword)` |
| `PermissionUtil` | 角色、认证态、归属、核销隔离与社团隔离校验 | `void checkRole(...)`、`void checkAuthenticatedStudent(...)`、`void checkOwner(...)`、`void checkOrderParticipant(...)`、`void checkOrderQrOwner(...)`、`void checkOrderVerifier(...)`、`void checkClubAccess(...)` |
| `RedisHelper` | 强制 TTL 与异常降级的 Redis 访问封装 | `String get(String key)`、`void setex(String key, long seconds, String val)`、`List<String> zrevrange(...)`、`void zincrby(...)`、`int tryDecrQuotaLua(String key)`、`void incrQuota(String key)` |
| `IdUtil` | 业务单号与一次性安全随机核销码生成 | `String nextOrderNo()`、`String nextCertNo()`、`String nextJoinNo()`、`String nextVerifyCode()`（基于 `SecureRandom` 生成） |
| `DateUtil` | 时间格式化与间隔计算 | `String format(LocalDateTime time)`、`long hoursBetween(LocalDateTime start, LocalDateTime end)` |
| `ImageUtil` | 文件头魔数校验、重编码压缩与缩略图（WebP 引入 `webp-imageio` SPI） | `String detectRealType(InputStream in)`、`void compressAndThumb(InputStream in, File mainTarget, File thumbTarget)` |
| `QrCodeUtil` | 核销与验真二维码生成（ZXing） | `byte[] generatePng(String content, int size)` |
| `PdfUtil` | 捐赠电子凭证 PDF 渲染（iText + 中文字体） | `byte[] renderDonationCert(DonationCertVO vo, byte[] qrBytes)` |
| `ExcelUtil` | 看板统计报表流式导出（Apache POI） | `void writeDailyStats(List<StatDailyVO> list, OutputStream out)` |
| `SensitiveWordUtil` | 标题与描述敏感词过滤 | `boolean contains(String text)`、`String replace(String text)` |

---

# 四、模块详细设计

## （一）用户登录与权限控制（模块 01）

模块职责：为学生、公益社团与管理员三类角色提供统一登录、防爆破保护、会话轮换、实时停用拦截、权限判定与安全退出。

### 1、类与职责

| 类名 | 层次 | 职责 |
| --- | --- | --- |
| `AuthController` | `controller` | 暴露登录（`#01`）与退出（`#02`）接口，处理 `HttpServletRequest` 会话轮换与销毁 |
| `AuthService` / `AuthServiceImpl` | `service` | 校验登录凭证、角色一致性、停用态与防爆破冷却，提供拦截器实时查询账号认证状态 |
| `AuthInterceptor` | `interceptor` | 按 HTTP 方法与路径/正则精确判定白名单、校验会话、实时拦截停用账号与同源 CSRF 校验 |
| `UserMapper` | `mapper` | 按 `username` 查询用户完整认证信息、按主键轻量查询 `status / auth_status / role` |
| `LoginDTO` | `dto` | 登录入参：`username`（3～30 位非空）、`password`（6～20 位非空）、`role`（可选角色标识） |
| `LoginVO` | `vo` | 登录出参：`userId`、`username`、`realName`、`role`、`campus`、`creditScore`、`authStatus`、`redirect` |
| `LoginUser` | `vo` | 写入 `HttpSession` 的精简会话对象（6 字段，严禁含密码字段） |
| `UserAuthStateVO` | `vo` | 拦截器实时复核投影对象，仅含 `id`、`status`、`authStatus`、`role` 四列 |

### 2、方法设计

| 方法签名 | 对应接口 / 调用方 | 是否事务 | 说明 |
| --- | --- | --- | --- |
| `Result<LoginVO> AuthController.login(@Valid @RequestBody LoginDTO dto, HttpServletRequest request)` | `POST /api/auth/login`（`#01`） | 否 | 校验凭证、轮换 Session ID、写入 `SESSION_LOGIN_USER` 并返回 `LoginVO` |
| `Result<Void> AuthController.logout(HttpServletRequest request)` | `POST /api/auth/logout`（`#02`） | 否 | 记录退出审计日志并销毁当前服务端 `HttpSession` |
| `LoginVO AuthService.authenticate(LoginDTO dto)` | `AuthController.login` | 否 | 含防爆破预检、BCrypt 校验、角色核验、停用检查与跳转地址计算 |
| `UserAuthStateVO AuthService.getAuthState(Integer userId)` | `AuthInterceptor.preHandle` | 否 | 主键轻量投影查询账号最新启用态、认证态与角色 |
| `User UserMapper.selectByUsername(String username)` | `AuthServiceImpl.authenticate` | 否 | 走唯一索引 `uk_username` 精确查询用户记录 |
| `UserAuthStateVO UserMapper.selectAuthStateById(Integer userId)` | `AuthServiceImpl.getAuthState` | 否 | 仅查询 `id, status, auth_status, role` 四列，走主键索引 |

```java
package com.csu.campusloop.service;

import com.csu.campusloop.dto.LoginDTO;
import com.csu.campusloop.vo.LoginVO;
import com.csu.campusloop.vo.UserAuthStateVO;

public interface AuthService {
    LoginVO authenticate(LoginDTO dto);
    UserAuthStateVO getAuthState(Integer userId);
}
```

### 3、处理流程

登录认证主流程（`POST /api/auth/login`）：

1、Controller 经 `@Valid` 校验 `LoginDTO` 非空与长度（`username` 3～30 位、`password` 6～20 位），若传入非空 `role` 则校验其属于 `student / club / admin` 白名单，不合法抛出 `1001`。

2、Service 经 `RedisHelper` 查询 `RedisKey.loginFail(username)` 失败计数：若当前计数已达到 `5` 次且键未过期，直接抛出 `BizException(ErrorCode.LOGIN_FAILED, "登录失败次数过多，请 5 分钟后再试")`（`1004`）；Redis 异常时记录 `warn` 并降级放行。

3、调用 `UserMapper.selectByUsername(username)` 查询用户；若记录不存在，执行防爆破失败计数自增（TTL 15 分钟；满 5 次重设 TTL 为 5 分钟）并抛出 `BizException(ErrorCode.LOGIN_FAILED)`（`1004`）。

4、先调用 `PasswordUtil.matches(dto.getPassword(), user.getPassword())` 比对 BCrypt 哈希，再校验前端传入的非空 `role` 是否等于库中 `user.role`：任一不通过均执行防爆破计数自增并统一抛出 `ErrorCode.LOGIN_FAILED`（`1004`），防止通过不同错误码枚举账号存在性或角色。

5、密码与角色均校验通过后，校验 `Integer.valueOf(1).equals(user.getStatus())`：若为 `0`（已停用），不计入防爆破失败，直接抛出 `BizException(ErrorCode.ACCOUNT_DISABLED)`（`1005`）。

6、登录校验全部通过，清理 `cl:auth:fail:{username}` 计数，由 `AuthController` 获取或创建 `HttpSession` 后调用 `request.changeSessionId()` 轮换会话 ID 防会话固定，组装 `LoginUser` 写入 `SESSION_LOGIN_USER`，并按库中真实 `user.role` 计算 `redirect`（`student`→`/index`、`club`→`/club/donations`、`admin`→`/admin/dashboard`）返回 `LoginVO`，同步通过 `@OperLog` 异步记录登录审计日志。

受保护请求实时拦截与退出流程：

1、请求进入 `AuthInterceptor.preHandle` 后，先按“HTTP 方法 + 精确路径/纯数字正则”匹配白名单，命中则直接返回 `true` 放行。

2、未命中白名单时读取 `request.getSession(false)` 中的 `LoginUser`；为空则按 Ajax/页面区分返回 `Result.fail(ErrorCode.UNAUTHORIZED)`（`1002`）或 302 重定向 `/login`。

3、Session 有效时调用 `AuthService.getAuthState(loginUser.getUserId())` 实时查库：若返回 `null` 或 `!Integer.valueOf(1).equals(state.getStatus())`，立即调用 `session.invalidate()`，Ajax 返回 `Result.fail(ErrorCode.ACCOUNT_DISABLED)`（`1005`），页面请求重定向 `/login?disabled=1`。

4、若账号正常，将最新 `authStatus` 与 `role` 同步更新到 `LoginUser` 对象中；对 `POST` 写接口进一步执行 `Origin / Referer` 同源校验，不通过直接写出 `Result.fail(ErrorCode.FORBIDDEN)`（`1003`）。

5、调用 `POST /api/auth/logout` 时，拦截器先验证已登录态，Controller 触发 `@OperLog` 留痕后调用 `session.invalidate()` 清空服务端会话，返回 `Result.ok()`。

### 4、关键规则

1、密码校验与防枚举顺序：一律先验 BCrypt 密码与角色匹配，最后再检查 `user.status`，杜绝未认证者探测封禁名单；全站禁止明文密码入库或输出至任何响应与日志。

2、角色唯一真源与前端标签校验：前端登录页选择的角色标签仅作入口校验，若前端未传 `role` 则按库中角色登录；若前端传入了与库中不一致的 `role` 则按 `1004` 拒绝，绝不信任前端角色覆盖服务端权限。

3、停用账号旧会话即时失效：后台管理员在模块 12 停用某账号后，该账号已持有的任意旧 Session 在下一次访问受保护接口或写接口时即被实时查库拦截并销毁，无法继续提交业务操作。

4、未认证学生（`auth_status = 0` 或 `2`）写操作划界：已登录但未通过校园认证的学生账号允许浏览与执行账号自服务写接口（退出登录 `#02`、消息标已读 `#33`、修改个人资料 `#44`、修改密码 `#45`）；调用全部校园业务写接口（发布/编辑物品 `#03`、下架删除 `#04`、流转下单 `#07`、技能发布/邀约 `#12/#15`、快捐 `#19`、评价 `#25`、申诉 `#27`、举报 `#39`、活动报名 `#50`）时，由各业务 Service 入口调用 `PermissionUtil.checkAuthenticatedStudent(loginUser)` 统一拦截并返回 `1003`。

5、身份核验扩展预留：保留 `user.student_no`、`user.auth_status` 及 `cl:auth:code:{studentNo}`（TTL 5 分钟）验证码模型作为校园邮箱实名认证扩展点；课程演示期通过初始化 SQL 预置已认证模拟账号（密码均为 BCrypt 密文）满足全角色演示。

### 5、异常分支

| 异常场景 | 错误码 | 处理与提示语 |
| --- | --- | --- |
| 账号或密码为空、长度越界或 `role` 非白名单枚举 | `1001` | `@Valid` 或手动校验拦截，返回首条字段校验提示 |
| 未登录访问受保护接口或退出登录 | `1002` | Ajax 返回“请先登录”，页面请求重定向至 `/login` |
| 角色越权、未认证调用业务写接口或跨站 `Origin` 请求 | `1003` | 返回“无权执行该操作”或“请先完成校园身份认证” |
| 账号不存在、BCrypt 密码错误、所选角色与账号不符或触发 5 次防爆破冷却 | `1004` | 常规失败统一返回“账号或密码错误”；冷却期内返回“登录失败次数过多，请 5 分钟后再试” |
| 登录时检测到 `user.status = 0`，或已登录旧会话在拦截器中复核到账号已被停用 | `1005` | 销毁旧 Session 并返回“账号已被停用，请联系管理员” |

## （二）闲置物品发布与管理（模块 02）

模块职责：承载闲置物品的发布/编辑合一、多图校验压缩与封面维护、下架与逻辑删除、我的闲置分页及物品详情可见性与浏览热度计数。

### 1、类与职责

| 类名 | 层次 | 职责 |
| --- | --- | --- |
| `ItemController` | `controller` | 暴露发布/编辑（`#03`）、下架/逻辑删除（`#04`）、我的闲置（`#05`）与详情（`#06`）接口 |
| `ItemService` / `ItemServiceImpl` | `service` | 执行发布与编辑合规校验、状态机条件更新、图片协调落盘与孤儿文件清理、详情可见性控制 |
| `ItemMapper` | `mapper` | `item` 表插入、编辑更新、条件状态更新、在售数与分类均价聚合查询、浏览量原子自增 |
| `ItemImageMapper` | `mapper` | `item_image` 表批量插入、按 `item_id` 查询已有图片列表与编辑时替换清理 |
| `CategoryMapper` | `mapper` | 校验 `category_id` 存在且处于启用展示状态（`is_show = 1`） |
| `ItemSaveDTO` | `dto` | 发布/编辑合一入参：`itemId`（空为发布）、`title`、`categoryId`、`conditionLevel`、`tradeMode`、`expectItem`、`price`、`campus`、`tradePlace`、`description`、`keepImageUrls`（编辑保留旧图列表） |
| `ItemStateDTO` | `dto` | 状态变更入参：`action`（枚举 `offShelf` / `delete`） |
| `ItemMineQuery` | `dto` | 继承 `PageQuery`，含可选筛选字段 `status` |
| `ItemSaveVO` / `ItemStateVO` | `vo` | 写操作返回：`{itemId, status}` |
| `ItemVO` / `ItemDetailVO` | `vo` | 我的闲置卡片出参、物品详情完整出参（含图片有序列表、卖家脱敏摘要、信用等级与 `isOwner` 标识） |
| `ItemStatus` | `enums` | 物品状态枚举（`0` 待审核、`1` 在售、`2` 锁定、`3` 已完成、`4` 已下架）与合法迁移判定 |

### 2、方法设计

| 方法签名 | 对应接口 / 调用方 | 是否事务 | 说明 |
| --- | --- | --- | --- |
| `Result<ItemSaveVO> ItemController.save(@Valid ItemSaveDTO dto, @RequestPart(value = "images", required = false) List<MultipartFile> images, HttpSession session)` | `POST /api/items`（`#03`） | 否 | 接收 `multipart/form-data`，提取 `LoginUser` 调用 `ItemService.save` |
| `Result<ItemStateVO> ItemController.changeState(@PathVariable Integer id, @Valid @RequestBody ItemStateDTO dto, HttpSession session)` | `POST /api/items/{id}/state`（`#04`） | 否 | 处理本人下架（`offShelf`）或逻辑删除（`delete`） |
| `Result<PageResult<ItemVO>> ItemController.mine(@Valid ItemMineQuery query, HttpSession session)` | `GET /api/items/mine`（`#05`） | 否 | 分页查询当前学生名下未删除物品 |
| `Result<ItemDetailVO> ItemController.detail(@PathVariable Integer id, HttpSession session)` | `GET /api/items/{id}`（`#06`） | 否 | 公开/登录双态查询物品详情与图片列表 |
| `ItemSaveVO ItemService.save(ItemSaveDTO dto, List<MultipartFile> images, LoginUser current)` | `ItemController.save` | 是 | 发布与编辑合一主事务，失败清理本次新上传文件 |
| `ItemStateVO ItemService.changeState(Integer itemId, String action, LoginUser current)` | `ItemController.changeState` | 是 | 条件更新下架或逻辑删除，锁定态拒绝 |
| `PageResult<ItemVO> ItemService.pageMine(ItemMineQuery query, LoginUser current)` | `ItemController.mine` | 否 | `PageHelper.startPage` 分页查询 |
| `ItemDetailVO ItemService.detail(Integer itemId, LoginUser current)` | `ItemController.detail` | 否 | 校验可见性，在售非本人浏览原子增 `view_count` 并异步打标 |
| `int ItemService.changeStatus(Integer itemId, Integer expectStatus, Integer targetStatus)` | 模块 03/05/06/12 单向调用 | 由调用方事务托管 | 状态机条件更新唯一收敛入口（`WHERE id=? AND status=? AND is_deleted=0`） |

```java
package com.csu.campusloop.service;

import com.csu.campusloop.dto.ItemMineQuery;
import com.csu.campusloop.dto.ItemSaveDTO;
import com.csu.campusloop.vo.ItemDetailVO;
import com.csu.campusloop.vo.ItemSaveVO;
import com.csu.campusloop.vo.ItemStateVO;
import com.csu.campusloop.vo.ItemVO;
import com.csu.campusloop.vo.LoginUser;
import com.csu.campusloop.vo.PageResult;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface ItemService {
    ItemSaveVO save(ItemSaveDTO dto, List<MultipartFile> images, LoginUser current);
    ItemStateVO changeState(Integer itemId, String action, LoginUser current);
    PageResult<ItemVO> pageMine(ItemMineQuery query, LoginUser current);
    ItemDetailVO detail(Integer itemId, LoginUser current);
    int changeStatus(Integer itemId, Integer expectStatus, Integer targetStatus);
}
```

### 3、处理流程

发布或编辑物品合一流程（`POST /api/items`，核心写库步骤标注 `@Transactional(rollbackFor = Exception.class)`）：

1、权限与门槛前置校验：调用 `PermissionUtil.checkAuthenticatedStudent(current)` 校验已认证学生身份；查询用户最新 `credit_score`，若 `< 40` 直接抛 `2004`（信用观察期暂停发布），若 `40 <= score < 60` 则允许上限记为 `3`，否则上限记为 `10`。

2、内容合规与分类校验：校验 `categoryId` 对应分类存在且 `is_show = 1`（否则抛 `1001`）；调用 `SensitiveWordUtil.contains` 校验 `title`（4～40 字）与 `description`（≤ 500 字），命中敏感词抛 `1001` 并提示具体合规问题；按 `tradeMode` 联动校验：`exchange` 要求 `expectItem` 非空且 ≤ 100 字（`price` 归零 `BigDecimal.ZERO`），`consign` 要求 `price > 0` 且调用 `ItemMapper.selectAvgConsignPrice(categoryId)` 获取同类寄售均价，若均价有效则校验 `price <= avgPrice * 3`，若该分类尚无寄售样本则跳过 3 倍校验并校验 `price <= 50000.00`（超限均抛 `2002`）。

3、区分新增与编辑校验：
   若 `dto.getItemId() == null`（新发布）：调用 `ItemMapper.countActiveByOwner(current.getUserId())` 统计 `status IN (0, 1) AND is_deleted = 0` 的件数，达到当前允许上限时（信用受限 3 件抛 `2004`，正常 10 件抛 `2003`）立即拦截；校验 `images` 数量在 `1～5` 张（否则抛 `2001`）。
   若 `dto.getItemId() != null`（编辑）：查询目标物品（不存在或 `is_deleted=1` 抛 `2102`），调用 `PermissionUtil.checkOwner(current.getUserId(), item.getOwnerId())` 校验归属（越权抛 `1003`），校验当前 `status` 必须属于 `{0, 1, 4}`（`2` 锁定或 `3` 已完成抛 `2102`）；若物品原状态为 `4`（已下架）且本次编辑重提将回 `0`（待审核），同样执行上述在售+待审上限校验；校验 `keepImageUrls` 每一项均属于该 `itemId` 在 `item_image` 中的既有路径（防止越权引用他人物品图片，非法抛 `1003`），校验 `keepImageUrls.size() + newImages.size()` 在 `1～5` 张之间（否则抛 `2001`）。

4、图片校验压缩与磁盘落盘：遍历新上传的 `images` 逐张调用 `FileStorageService.saveItemImage(file)`（大小 → 扩展名 → 魔数 → 压缩主图与缩略图），收集本次新写入的相对路径列表 `savedPaths`；将 `keepImageUrls`（编辑态）与 `savedPaths` 按序合并为 `finalUrls`，首张即封面 `coverUrl`。

5、数据库事务写入（`@Transactional`）：若数据库写入发生任何异常，在 `catch` 或事务回滚回调中调用 `FileStorageService.deleteQuietly(savedPaths)` 清理本次新建孤儿文件。
   新发布时写入 `item`（`status = 0`、`view_count = 0`、`is_deleted = 0`、`cover_url = finalUrls.get(0)`），批量插入 `item_image`（`sort_no` 从 `0` 递增）。
   编辑时通过条件更新 `UPDATE item SET ..., cover_url = ?, status = 0 WHERE id = ? AND owner_id = ? AND status IN (0, 1, 4) AND is_deleted = 0` 保证并发下不会覆盖刚被锁定的物品（影响行数为 `0` 抛 `2102`），随后删除该 `item_id` 原 `item_image` 记录并按 `finalUrls` 重建排序记录。

6、事务提交后处理：触发 `@OperLog` 异步记录发布/编辑日志；若为新发布且登录态有效，以 `try/catch` 异步调用 `RedisHelper.zincrby(RedisKey.userTag(userId), categoryTag, 5)` 并续期 30 天（失败仅记 `warn` 不影响返回）；返回 `ItemSaveVO{itemId, status=0}`。

下架与逻辑删除流程（`POST /api/items/{id}/state`，`@Transactional`）：

1、校验 `action` 仅允许 `offShelf` 或 `delete`（否则抛 `1001`）；查询未删除物品记录（不存在抛 `2102`）并调用 `PermissionUtil.checkOwner` 校验本人归属（越权抛 `1003`）。

2、当 `action = "offShelf"` 时，校验当前 `status` 为 `0` 或 `1`，执行条件更新 `UPDATE item SET status = 4 WHERE id = ? AND owner_id = ? AND status IN (0, 1) AND is_deleted = 0`；影响行数为 `0`（如并发已被锁定或已完成）抛 `2102`。

3、当 `action = "delete"` 时，严禁删除锁定态物品，执行条件更新 `UPDATE item SET is_deleted = 1 WHERE id = ? AND owner_id = ? AND status != 2 AND is_deleted = 0`；影响行数为 `0` 抛 `2102`。记录 `@OperLog` 并返回 `ItemStateVO{itemId, status}`。

我的闲置分页与详情浏览流程（`GET /api/items/mine`、`GET /api/items/{id}`）：

1、`pageMine`：强制以当前 `current.getUserId()` 作为 `owner_id` 过滤条件，固定 `is_deleted = 0`，按可选 `status` 与 `create_time DESC` 经 `PageHelper.startPage` 分页查询并返回 `PageResult<ItemVO>`。

2、`detail`：按主键查询 `item` 与有序 `item_image` 列表；若记录不存在或 `is_deleted = 1` 直接抛 `2102`。

3、详情可见性判定：当 `status` 为 `0`（待审核）或 `4`（已下架）时，仅允许发布者本人（`current != null && current.getUserId().equals(item.getOwnerId())`）或管理员（`role="admin"`）查看，其余游客或他人统一抛 `1003`；`status` 为 `1 / 2 / 3` 允许公开查看。

4、热度与兴趣打标：仅当 `status == 1` 且非发布者本人浏览时，执行原子更新 `UPDATE item SET view_count = view_count + 1 WHERE id = ? AND status = 1 AND is_deleted = 0`，同时在 `current != null` 时以 `try/catch` 异步向 `cl:tag:user:{userId}` 累加浏览权重 `+1` 并续期 30 天（Redis 异常静默降级）。最终组装脱敏后的卖家昵称、信用分、信用等级、多图列表与 `isOwner` 标识返回 `ItemDetailVO`。

### 4、关键规则

1、图片合规与旧图防越权：图片数量严格限定 `1～5` 张、单张 `≤ 2MB`、魔数校验仅放行 JPG/PNG/WebP 并重编码剥离 EXIF；编辑时 `keepImageUrls` 必须校验全部归属当前 `itemId`，首图固定作为 `item.cover_url`（`sort_no = 0`）。

2、寄售价格与冷启动边界：寄售模式 `price` 采用 `BigDecimal` 且须 `> 0`；同分类存在在售/历史寄售样本时不得超过均价 3 倍，分类暂无样本时跳过 3 倍限制但限制 `≤ 50000.00` 元，交换模式忽略前端传价强制落 `0.00`。

3、发布上限与信用分分层门槛：在售数量统一按 `status IN (0, 1) AND is_deleted = 0` 统计，防止批量提交待审冲穿上限；信用分 `≥ 60` 上限 10 件（超限 `2003`），`40～59` 降为 3 件（超限 `2004`），`< 40` 暂停发布与重提（`2004`）。

4、状态机收敛与条件更新：物品状态迁移一律收口至 `ItemService.changeStatus` 或带前置状态条件的 SQL（`WHERE id = ? AND status = ? AND is_deleted = 0`），编辑非锁定态后强制回到 `0` 待审核重新过审；`status = 2`（锁定）禁止编辑、下架与逻辑删除。

5、逻辑删除与孤儿文件兜底：物品删除只更新 `is_deleted = 1`，绝不物理删除 `item` 或历史关联单据；事务回滚时异步清理当次新上传图片，防止磁盘泄漏。

### 5、异常分支

| 异常场景 | 错误码 | 处理与提示语 |
| --- | --- | --- |
| 必填字段缺失、标题非 4～40 字、描述超 500 字、命中敏感词、分类未启用或 `action` 非法 | `1001` | 拒绝入库并返回具体字段校验或合规提示 |
| 未登录访问发布、编辑、上下架、删除或我的闲置接口 | `1002` | 拦截器返回“请先登录” |
| 未完成校园认证发布、操作他人物品、编辑引用他人旧图、非本人/非管理员查看 `0/4` 态物品详情 | `1003` | 抛出越权异常，返回“无权执行该操作” |
| 已登录账号被停用后发起物品写操作或查我的闲置 | `1005` | 拦截器销毁旧 Session 并返回“账号已被停用” |
| 图片总数不在 1～5 张、单张超过 2MB、扩展名或文件头魔数不在白名单 | `2001` | 拒绝上传并清理同批次已落盘临时图，返回“请上传 1～5 张 2MB 以内的 JPG/PNG/WebP 图片” |
| 寄售价格 `≤ 0`、超过同类均价 3 倍或冷启动超过 50000 元 | `2002` | 返回“寄售价格超出合理范围，请调整后重试” |
| 信用分正常（`≥ 60`）但待审与在售物品合计已达 10 件 | `2003` | 返回“同时发布与在售物品已达 10 件上限” |
| 信用分 `< 40` 处于观察期，或 `40～59` 受限态在售与待审已达 3 件 | `2004` | 返回“当前信用分受限，暂不可继续发布” |
| 物品不存在或已逻辑删除、并发编辑/下架/删除命中锁定态（`status=2`）或已完成态（`status=3`） | `2102` | 条件更新影响行数为 0 时回滚并提示“当前物品状态不允许该操作” |

---

# 八、安全设计

本章将《03-01 需求开发概要设计说明书（V1.1）》第六章（二）的安全基线与 7 项核心风控约束落细至组件实现、代码落点与验收场景，作为编码评审与安全测试的直接依据。

## （一）安全防护矩阵总览

| 安全域 | 典型风险场景 | 防护实现方案 | 代码落点 | 拦截错误码 |
| --- | --- | --- | --- | --- |
| 身份认证与防爆破 | 明文泄漏、密码暴力撞库、枚举有效账号与角色 | BCrypt 不可逆哈希；先验密码与角色再验停用态；`cl:auth:fail:{username}` 15 分钟错 5 次冷却 5 分钟（Redis 异常降级放行） | `PasswordUtil`、`AuthServiceImpl`、`RedisHelper` | `1004` / `1005` |
| 会话安全与停用即时失效 | 会话固定攻击、管理员停用账号后旧会话继续提交 | 登录成功调用 `request.changeSessionId()`；Session Cookie 配 `HttpOnly + SameSite=Lax`；拦截器实时查库复核 `user.status`，非 `1` 即 `session.invalidate()` | `AuthController`、`AuthInterceptor`、`context.xml` | `1002` / `1005` |
| 核销角色隔离防自核销 | 一方在未交付前独自核销骗取成交与积分 | 预约响应不返回 `verify_code`；出码接口 `#18` 仅限物品所有者（`to_user_id`），核销接口 `#17` 仅限发起方（`from_user_id`）；`SecureRandom` 一次性码 + `order_status=2 -> 3` 条件更新 | `PermissionUtil`、`IdUtil`、`AppointServiceImpl` | `1003` / `2102` / `2103` |
| 资源越权与社团数据隔离 | 修改/删除他人物品、查看未过审物品、跨社团审核捐赠或下载他人凭证 | 写操作与私密读操作全部经 `PermissionUtil` 校验本人/双方/本社团归属；社团查询 SQL 强制由后端注入 Session 所属 `club_id`，忽略前端传入值；未认证账号禁止校园业务写操作 | `PermissionUtil`、各业务 `ServiceImpl` | `1003` |
| SQL 注入、XSS 与 CSRF | 动态拼接查询/排序注入、评论/标题注入脚本、跨站伪造写请求 | MyBatis 参数全用 `#{}`、动态排序走服务端 `Map` 白名单；JSP 统一 `<c:out>` / `fn:escapeXml` 转义；`POST` 写接口叠加 `SameSite=Lax` 与 `Origin/Referer` 同源校验 | `Mapper XML`、`AuthInterceptor`、JSP 视图 | `1001` / `1003` |
| 文件上传与凭证目录隔离 | 伪造后缀上传可执行脚本、绕过鉴权直接访问 `/certificate/*.pdf`、路径遍历 `../` | `upload/` 与 `certificate/` 均置于 WAR 外并禁执行；图片经“大小→扩展名→魔数→重编码”四步清洗；`certificate/` 禁止静态映射，下载走 `#22` 鉴权流式写出并校验 `certNo` 正则与路径归一化；公开验真 `#23` 仅返最小脱敏字段 | `FileStorageService`、`ImageUtil`、`DonationController` | `1003` / `2001` / `5002` |
| 敏感数据与审计脱敏 | 响应体或日志打印密码、核销码、完整学号或数据库堆栈 | VO 严格裁剪不含 `password`；`@OperLog` 切面与 `logback` 过滤密码与 `verifyCode`，学号脱敏保留前 4 后 2 位；`5001` 异常绝不向前端透传堆栈与 SQL | `OperLogAspect`、`GlobalExceptionHandler`、各 `VO` | `5001` |
| 防重提交与并发一致性 | 并发抢单双锁失败、重复核销/评价刷分、活动超卖与双路径分裂 | 数据库条件更新校验影响行数 = 1；唯一索引（`uk_order_no`、`uk_order_from`、`uk_activity_user`、`uk_certificate_no`）兜底；活动名额以 MySQL 事务为唯一真源，Redis 仅作前置预筛 | 各核心 `ServiceImpl`、数据库表约束 | `2101` / `2301` / `2401` / `2402` |

## （二）关键安全机制落地细则

### 1、会话安全、CSRF 同源防护与停用实时失效

1、Tomcat 10 会话 Cookie 配置：在应用上下文（`META-INF/context.xml` 或 `web.xml`）显式开启 `useHttpOnly="true"`，配置 `Rfc6265CookieProcessor sameSiteCookies="lax"`，会话空闲超时设为 30 分钟；生产若启用 HTTPS 则开启 `secure="true"`。

2、防会话固定与同源校验：登录成功后在写入 `SESSION_LOGIN_USER` 前调用 `request.changeSessionId()` 强制更换 `JSESSIONID`；拦截器对所有非白名单 `POST` 写请求检查 `Origin`（缺失时回退检查 `Referer`），解析其 `scheme + host + port` 与当前请求服务器地址比对，不一致时立即拦截并返回 `1003`。

3、停用账号旧会话实时失效：后台管理员在模块 12 将用户置为 `status = 0` 时无需依赖全集群会话广播，而是由 `AuthInterceptor` 在每次受保护请求中经 `AuthService.getAuthState(userId)` 走主键索引执行毫秒级状态复核；一旦检测到 `status != 1`，立即销毁该旧 Session 并返回 `1005`，确保被封禁账号无法再执行任何发布、下单、核销、快捐、评价或申诉操作。

4、登录防爆破与降级：连续输错密码或角色不匹配达 5 次后，通过 `cl:auth:fail:{username}` 触发 5 分钟冷却；若 Redis 不可用，`RedisHelper` 捕获异常记 `warn` 后直接放行，确保缓存故障不阻断正常登录演示。

### 2、角色隔离核销与越权防护边界

1、核销双角色强制分离：模块 05 预约接口（`#16`）仅生成并持久化绑定该 `order_id` 的一次性 `verify_code`（经 `SecureRandom` 生成 8 位大写字母数字码），响应体严禁回传 `verify_code`；物品所有者（`to_user_id`）仅可调用 `#18 GET /api/orders/{id}/qrcode` 获取二维码，发起方（`from_user_id`）无权调用 `#18`；当面验货后仅发起方（`from_user_id`）可调用 `#17 POST /api/orders/{id}/verify` 提交核销，物品所有者调用 `#17` 一律拦截返回 `1003`。

2、垂直与水平越权双重校验：垂直越权由 `PermissionUtil.checkRole` 拦截（学生账号访问 `/api/admin/**` 或社团审核接口直接返 `1003`）；水平越权由 `checkOwner`、`checkOrderParticipant`、`checkClubAccess` 在 Service 层逐笔校验数据库记录归属，严禁信任前端传入的 `userId`、`ownerId` 或 `clubId`。

3、公益社团数据隔离：社团账号查询捐赠列表（`#20`）、执行审核（`#21`）或下载凭证（`#22`）时，后端强制从 Session `LoginUser` 获取该社团账号对应的 `club_id` 并作为 SQL 必选条件注入，跨社团访问直接返回 `1003`。

### 3、文件上传防恶意执行与凭证目录隔离

1、`upload/` 实拍图防护：目录置于 Tomcat 应用部署目录之外并关闭脚本执行权限；上传严格按“大小 ≤ 2MB → 扩展名白名单 → 文件头魔数校验（JPEG `FF D8 FF`、PNG `89 50 4E 47`、WebP `RIFF....WEBP`）→ `ImageIO` 解码重编码压缩”四步处理，重命名采用随机 UUID，彻底剥离图片隐写脚本与 EXIF 隐私信息。

2、`certificate/` 非静态隔离与防路径遍历：Tomcat 严禁为 `certificate/` 配置任何静态资源映射，直接请求 `/certificate/...` 无法访问任何文件；完整 PDF 仅通过 `#22 GET /api/donations/{id}/certificate` 校验“当前用户为捐赠人 `donor_id` 或接收社团 `club_id`”后流式输出；`FileStorageService` 强制校验 `certNo` 匹配 `^CLD(\d{6})\d+$`，拼装路径后执行 `targetPath.toAbsolutePath().normalize().startsWith(baseDir)` 防御 `../` 路径遍历。

3、公开验真最小字段脱敏：捐赠凭证上的二维码指向公开验真接口 `#23 GET /api/donations/verify?certificateNo=...`，仅返回 `certificateNo`、`itemTitle`、`clubName`、`donorMasked`（如“林**”）、`auditTime` 与 `valid` 六个最小非敏字段，不返回学号、联系方式、真实全名或本地文件路径。

### 4、注入防护、输出转义与敏感数据脱敏

1、SQL 注入防护：所有 MyBatis Mapper XML 参数一律使用 `#{}` 预编译占位；动态排序（如模块 08 物品检索 `sort` 参数）仅允许前端传入枚举代号（`latest` / `hot` / `price_asc` / `price_desc`），由服务端 `Map<String, String>` 白名单映射为固定 `ORDER BY` 片段，严禁使用 `${}` 拼接用户输入。

2、XSS 防护：物品标题、描述、留言、评价内容与举报说明均为纯文本存储（不开放任意 HTML 富文本标签），JSP 页面统一使用 JSTL `<c:out value="${...}" escapeXml="true"/>` 或 `fn:escapeXml` 输出，前端异步渲染使用 `textContent` 而非 `innerHTML`。

3、日志与异常脱敏：`@OperLog` 切面（模块 14）在序列化请求参数前通过脱敏器剔除 `password`、`oldPassword`、`newPassword`、`confirmPassword`、`verifyCode` 等敏感键，对 `studentNo` 保留前 4 后 2 位（中间以 `*` 替代）；`GlobalExceptionHandler` 对未捕获异常仅在服务端 `error` 日志保留堆栈，响应体固定返回 `code=5001` 与通用中文提示。

## （三）安全验收基线清单

以下 8 项安全反例场景须在系统测试阶段（对应第十章测试要点）全部执行并 100% 通过：

| 序号 | 验收场景 | 模拟操作 | 预期结果 |
| --- | --- | --- | --- |
| 1 | 停用账号旧会话即时失效 | 学生登录后保留 Cookie，管理员后台停用该账号，学生用旧 Cookie 提交发布/下单/核销 | 拦截器实时查库拦截并销毁旧 Session，返回 `1005` |
| 2 | 核销角色隔离防自核销 | 发起方调 `#18` 取二维码；或物品所有者拿自己的码调 `#17` 提交核销 | 两者均被 `PermissionUtil` 拒绝并返回 `1003`，订单状态与积分不变 |
| 3 | 凭证非静态隔离与越权下载 | 浏览器直接访问 `/certificate/CLD2026110019.pdf`；或非捐赠人/他社团调 `#22` | 静态路径不可达（404）；越权调 `#22` 返回 `1003`；公开调 `#23` 仅见脱敏捐赠人 |
| 4 | 白名单路径冲突与同路径写保护 | 未登录访问 `GET /api/items/mine` 或未登录调用 `POST /api/items` / `POST /api/reviews` | 全部被拦截返回 `1002`，不发生白名单漏放 |
| 5 | 跨站 CSRF 写请求拦截 | 携带有效 Session Cookie 但伪造 `Origin: https://evil.example` 调用 `POST /api/items` | 拦截器同源校验失败，返回 `1003` |
| 6 | 恶意文件与伪造扩展名上传 | 将文本/JSP 脚本改后缀为 `.jpg` 后调用 `#03` 上传，或传 6 张 / >2MB 图片 | 文件头魔数或大小拦截返回 `2001`，`upload/` 目录无残留文件 |
| 7 | 跨社团与未过审物品越权访问 | 社团 A 审核社团 B 的捐赠单；或学生 B 猜 ID 访问学生 A 处于 `0` 待审的物品详情 `#06` | 均被拦截返回 `1003`，不泄露敏感业务数据 |
| 8 | 敏感信息零泄漏核查 | 抓包登录/个人中心响应并核查 `oper_log` 表与 `logback` 日志文件 | 响应与日志均无明文密码、无 `verifyCode`、无数据库堆栈，学号已脱敏 |
