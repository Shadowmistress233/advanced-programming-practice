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
| `controller` | 15 个业务模块的页面与 API 控制器 | 仅做 `@Valid` 参数校验、获取会话用户、调用 Service 并封装 `Result<T>` |
| `service` / `service.impl` | 业务接口与实现类 | 事务边界与状态流转收口于此层；禁止在 impl 内调用 Controller |
| `mapper` | MyBatis Mapper 接口（对应 `resources/mapper/*.xml`） | 仅做持久化访问；参数一律使用 `#{}` 占位，禁止在 Service 拼 SQL |
| `entity` | 与 15 张表一一对应的持久化实体 | 仅含属性与 getter/setter，不直接作为接口返回值暴露 |
| `dto` / `vo` | 入参 DTO 与出参 VO | 按接口拆分，DTO 携带校验注解，VO 严格脱敏 |
| `enums` | 错误码与状态枚举 | 集中定义 `ErrorCode`、物品/流转单/捐赠/举报/活动状态机枚举 |
| `config` | 配置类与常量 | 数据源、Redis、拦截器注册、路径与字典常量 |
| `interceptor` | SpringMVC 拦截器 | 登录会话校验、账号实时停用复核与白名单放行 |
| `aspect` | AOP 切面 | `@OperLog` 操作审计异步落库切面 |
| `task` | 定时任务 | 流转单三段超时巡检、每日运营数据预聚合 |
| `util` | 公共工具类 | BCrypt 密码、日期、单号、图片压缩、二维码、PDF、Excel、敏感词、权限校验 |
| `exception` | 异常与全局处理 | `BizException`、`GlobalExceptionHandler` |

## （二）请求处理链路

HTTP 请求依次经过：`CharacterEncodingFilter` → `AuthInterceptor` → `Controller` → `Service`（含 `@OperLog` 切面与 `@Transactional`）→ `Mapper` → `MySQL / Redis`，响应沿原路返回，未捕获异常由 `GlobalExceptionHandler` 兜底转换。

1、Filter 仅负责 UTF-8 编码，不编写业务逻辑。

2、`AuthInterceptor` 对公开白名单直接放行；对受保护请求校验 Session 中的 `userId`，并按主键实时复核 `user.status`（若已被停用则立即销毁 Session 并返回 `1005`）。

3、Controller 负责 `@Valid` 格式校验与调用 Service，不编写 SQL 或复杂分支。

4、Service 负责权限归属校验、业务规则校验、状态条件更新、事务管理与 Redis/PDF 异常降级。

5、Mapper 仅执行参数化 SQL，返回实体或查询 VO。

## （三）公共约定

| 约定项 | 具体要求 |
| --- | --- |
| 主键与金额 | 所有表主键与接口业务 ID 统一 `Integer`；金额统一 `BigDecimal`（`RoundingMode.HALF_UP`，保留 2 位），禁止 `double`/`float` |
| 密码安全 | 统一经 `PasswordUtil` 使用 BCrypt 不可逆哈希存储与比对，禁止明文入库或日志输出 |
| 事务边界 | 涉及多表写操作、成对锁定/解锁、积分原子变更或活动报名扣减的 Service 方法一律标注 `@Transactional(rollbackFor = Exception.class)` |
| 并发与防重 | 禁止“先查后改”；锁单、核销、积分增减与活动名额扣减全部采用数据库原子更新或条件更新，校验影响行数等于 1 才算成功 |
| 异常处理 | 业务校验失败统一抛出 `BizException(ErrorCode)`，禁止吞掉异常静默返回 `null` |
| 缓存与降级 | Redis 键一律由 `RedisKey` 生成并带 TTL；所有 Redis 读写均用 `try/catch` 包裹，失败返回降级值并记 warn 日志 |
| 分页与时间 | 使用 `PageHelper.startPage(page, pageSize)` 后紧跟单条查询（默认 `page=1, pageSize=12`，上限 `50`）；时间统一 `LocalDateTime`（`yyyy-MM-dd HH:mm:ss`） |

# 三、公共组件详细设计

## （一）统一返回与错误码

`Result<T>` 封装 `{code, msg, data}` 三字段，HTTP 状态码固定返回 `200`，由 `code` 区分结果；错误码全部收口在 `ErrorCode` 枚举中，与《03-01 需求开发概要设计（V1.1）》第四章（二）逐条一致，严禁硬编码数字。

```java
package com.csu.campusloop.vo;

public class Result<T> {
    private Integer code; // 0 成功，其余见 ErrorCode
    private String msg;   // 中文提示
    private T data;       // 业务数据，可为 null

    public static <T> Result<T> ok(T data) { /* code=0, msg="ok" */ }
    public static Result<Void> ok() { /* code=0, msg="ok", data=null */ }
    public static <T> Result<T> fail(ErrorCode errorCode) { /* 取枚举 code 与 msg */ }
    public static <T> Result<T> fail(Integer code, String msg) { /* 自定义错误提示 */ }
}
```

## （二）全局异常处理

`GlobalExceptionHandler` 使用 `@RestControllerAdvice` 统一拦截控制层与业务层抛出的异常并转换为标准 `Result`：

| 异常类型 | 返回错误码 | 处理逻辑与日志级别 |
| --- | --- | --- |
| `BizException` | `e.getCode()` | 直接返回 `e.getMsg()`，记录 `warn` 日志 |
| `MethodArgumentNotValidException` / `BindException` | `1001` | 提取首条参数校验失败提示返回，记录 `warn` 日志 |
| `MaxUploadSizeExceededException` | `2001` | 返回“单张图片大小不能超过 2MB”，记录 `warn` 日志 |
| `DuplicateKeyException` | 按唯一索引名映射或 `2102` | `uk_order_from` 映射 `2301`、`uk_activity_user` 映射 `2402`，其余返回 `2102` |
| `Exception` | `5001` | 记录完整堆栈 `error` 日志，对外统一返回“系统繁忙，请稍后重试” |

## （三）登录拦截与权限判定

1、`AuthInterceptor`（实现 `HandlerInterceptor`）：在 `preHandle` 中先放行公开白名单，包括 `POST /api/auth/login`、`GET /api/items`、`GET /api/items/{id}`、`GET /api/categories/tree`、`GET /api/recommendations`、`GET /api/skills`、`GET /api/reviews`、`GET /api/activities`、`GET /api/activities/{id}`、`GET /api/donations/verify` 及 `/static/**`、`/upload/**`（严禁放行 `/certificate/**`）。

2、非白名单请求校验 Session 中的 `LoginUser`：未登录时 Ajax 请求写出 `Result.fail(1002)` JSON，页面请求重定向至登录页。

3、账号停用实时拦截：Session 有效时按主键查询 `userMapper.selectStatusById(userId)`；若返回 `0`（已停用），立即调用 `session.invalidate()` 并返回 `Result.fail(1005)`，确保管理员封禁后旧会话无法继续提交。

4、细粒度权限校验统一收敛至 `PermissionUtil`：提供 `checkRole(LoginUser, String... roles)`、`checkAuthenticatedStudent(LoginUser)`、`checkOwner(Integer currentUserId, Integer ownerId)`、`checkOrderParticipant(LoginUser, ExchangeOrder)` 与 `checkOrderVerifier(LoginUser, ExchangeOrder)`（核销仅限 `from_user_id`，出码仅限 `to_user_id`），不通过统一抛出 `BizException(1003)`。

## （四）分页与查询封装

列表查询统一继承 `PageQuery`（包含 `page` 默认 1、`pageSize` 默认 12，最大值强制裁剪为 50）。Service 层在查询前紧邻调用 `PageHelper.startPage(query.getPage(), query.getPageSize())`，返回 `PageResult<T>{total, list, pages, page, pageSize}`。动态排序字段通过服务端 `Map<String, String>` 白名单转换为合法列名，禁止拼接前端传入字段名。

## （五）文件上传与目录隔离

`FileStorageService` 严格区分两类外部本地目录，均禁止脚本执行权限：

1、物品实拍图目录（`upload/yyyyMM/`，允许 Tomcat 静态只读映射）：`saveItemImage(MultipartFile file)` 校验扩展名与真实 MIME 白名单（JPG/PNG/WebP）及大小（≤ 2MB，超限抛 `2001`），生成 UUID 文件名，调用 `ImageUtil` 压缩主图（最大宽 1200px）并生成缩略图（宽 300px），返回相对路径。

2、电子捐赠凭证目录（`certificate/yyyyMM/`，不配置静态 URL 映射）：`saveCertificatePdf(String certNo, byte[] pdfBytes)` 落盘保存；下载时仅由 `DonationController` 鉴权通过后调用 `readCertificateStream(String certNo, OutputStream out)` 流式写出。

## （六）Redis 客户端与键规范

全部键模板统一由 `RedisKey` 工具类生成并加 `cl:` 前缀，所有 ID 参数类型为 `Integer`；`RedisHelper` 封装常用读写方法，强制写操作带过期时间、读/写操作全部 `try/catch` 并在异常时记录 `warn` 日志返回降级默认值，严禁因 Redis 故障中断主业务：

| 方法签名 | 生成键名 | 数据结构 | TTL |
| --- | --- | --- | --- |
| `RedisKey.userTag(Integer userId)` | `cl:tag:user:{userId}` | ZSet | 30 天 |
| `RedisKey.hotItem(String campus)` | `cl:rank:hot:{campus}` | ZSet | 1 天 |
| `RedisKey.recCache(Integer userId)` | `cl:rec:cache:{userId}` | String (JSON) | 10 分钟 |
| `RedisKey.hotSearch()` | `cl:search:hot` | ZSet | 7 天 |
| `RedisKey.activityQuota(Integer activityId)` | `cl:act:quota:{activityId}` | String (Int) | 活动结束后 24h |
| `RedisKey.authCode(String studentNo)` | `cl:auth:code:{studentNo}` | String | 5 分钟 |

## （七）工具类清单

| 工具类 | 职责 | 关键方法签名（均位于 `com.csu.campusloop.util`） |
| --- | --- | --- |
| `PasswordUtil` | BCrypt 密码哈希与校验 | `String encode(String rawPassword)`、`boolean matches(String rawPassword, String encodedPassword)` |
| `PermissionUtil` | 角色、归属与核销权限校验 | `void checkRole(...)`、`void checkOwner(...)`、`void checkOrderVerifier(...)` |
| `IdUtil` | 业务单号与一次性核销码生成 | `String nextOrderNo()`、`String nextCertNo()`、`String nextJoinNo()`、`String nextVerifyCode()` |
| `DateUtil` | 时间格式化与间隔计算 | `String format(LocalDateTime time)`、`long hoursBetween(LocalDateTime start, LocalDateTime end)` |
| `ImageUtil` | 图片类型校验、等比压缩与缩略图 | `void validateImage(MultipartFile file)`、`void compress(InputStream in, File target, int maxWidth)` |
| `QrCodeUtil` | 核销与验真二维码生成（ZXing） | `byte[] generatePng(String content, int size)` |
| `PdfUtil` | 捐赠电子凭证 PDF 渲染（iText） | `byte[] renderDonationCert(DonationCertVO vo, byte[] qrBytes)` |
| `ExcelUtil` | 看板统计报表流式导出（Apache POI） | `void writeDailyStats(List<StatDailyVO> list, OutputStream out)` |
| `SensitiveWordUtil` | 标题与描述敏感词过滤 | `boolean contains(String text)`、`String replace(String text)` |

---

# 四、模块详细设计（Part A 负责：模块 01、02）

> 编写说明（蒋岳霖负责补全以下两节，严格按“类与职责 → 方法设计 → 处理流程 → 关键规则 → 异常分支”五段式撰写，不留 TODO）：

## （一）用户登录与权限控制（模块 01）

### 1、类与职责
（待补全：`AuthController`、`AuthService`、`AuthServiceImpl`、`UserMapper`、`LoginDTO`、`LoginVO`）

### 2、方法设计
（待补全：对应 `POST /api/auth/login`、`POST /api/auth/logout` 及 `AuthInterceptor` 实时状态查询方法签名）

### 3、处理流程
（待补全：按序编号，含 BCrypt 校验、Session 写入、实时停用拦截销毁 Session 流程）

### 4、关键规则
（待补全：密码防枚举提示、角色以库为准、停用旧会话失效、预置模拟账号与邮箱核验扩展点）

### 5、异常分支
（待补全：覆盖 `1001`/`1002`/`1003`/`1004`/`1005` 错误码与提示语）

## （二）闲置物品发布与管理（模块 02）

### 1、类与职责
（待补全：`ItemController`、`ItemService`、`ItemServiceImpl`、`ItemMapper`、`ItemImageMapper`、`ItemSaveDTO`、`ItemStateDTO`、`ItemVO`、`ItemDetailVO`）

### 2、方法设计
（待补全：对应 `POST /api/items`[发布/编辑合一]、`POST /api/items/{id}/state`、`GET /api/items/mine`、`GET /api/items/{id}`）

### 3、处理流程
（待补全：按序编号，标注 `@Transactional` 边界、图片上传与封面写入、编辑重提回待审、逻辑删除）

### 4、关键规则
（待补全：敏感词过滤、图片 1–5 张 ≤ 2MB、寄售价格 ≤ 同类均价 3 倍、在售 ≤ 10 件与信用分门槛、锁定态禁编辑删除）

### 5、异常分支
（待补全：覆盖 `1001`/`1002`/`1003`/`1005`/`2001`/`2002`/`2003`/`2004`/`2102`）

---

# 八、安全设计（Part A 负责）

> 编写说明（蒋岳霖负责补全，围绕鉴权与停用会话失效、角色隔离防自核销、资源越权与社团数据隔离、SQL 注入与 XSS/CSRF 防护、`upload/` 与 `certificate/` 目录隔离、BCrypt 与日志脱敏展开）。
