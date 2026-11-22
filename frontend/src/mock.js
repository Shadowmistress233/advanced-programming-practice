// 演示用本地假数据层：没有后端时让全部页面可交互。
// 接真实后端时把 MOCK_ENABLED 改成 false 即可恢复真实请求。
// 演示账号：student / club / admin，密码任意（6~20 位）。

import appointmentQrUrl from './assets/appointment-code.png'
import { charityClubs, creditLevelOf, pickupPoints } from './constants'

export const MOCK_ENABLED = true

const accounts = {
  student: {
    userId: 1,
    username: 'student',
    realName: '林小满',
    role: 'student',
    campus: '本部',
    college: '计算机科学与技术专业',
    studentNo: '2022214001',
    authStatus: 1,
    creditScore: 96,
  },
  club: {
    userId: 2,
    username: 'club',
    realName: '绿源公益社',
    role: 'club',
    campus: '本部',
    college: '公益社团',
    studentNo: 'C2022001',
    authStatus: 1,
    creditScore: 100,
  },
  admin: {
    userId: 3,
    username: 'admin',
    realName: '运营管理员',
    role: 'admin',
    campus: '本部',
    college: '校园服务中心',
    studentNo: 'A2022001',
    authStatus: 1,
    creditScore: 100,
  },
}

let current = accounts.student
let signedOut = false

// 演示详情只返回发布人的公开昵称、校区与信用分。
const itemPublishers = {
  1: { nickname: '林小满', campus: '本部', creditScore: accounts.student.creditScore },
  2: { nickname: '绿源公益社', campus: '本部', creditScore: accounts.club.creditScore },
  3: { nickname: '运营管理员', campus: '本部', creditScore: accounts.admin.creditScore },
  10: { nickname: '书页', campus: '本部', creditScore: 92 },
  11: { nickname: '树下等风', campus: '本部', creditScore: 89 },
  12: { nickname: '小麦', campus: '新校区', creditScore: 96 },
  13: { nickname: '青禾', campus: '铁道', creditScore: 88 },
  14: { nickname: '阿远', campus: '湘雅', creditScore: 91 },
  15: { nickname: '方糖', campus: '本部', creditScore: 84 },
  16: { nickname: '一只扳手', campus: '新校区', creditScore: 93 },
  19: { nickname: '南风', campus: '湘雅', creditScore: 90 },
  20: { nickname: '墨水瓶', campus: '本部', creditScore: 95 },
  21: { nickname: '木棉', campus: '新校区', creditScore: 87 },
}

const categories = [
  {
    id: 1,
    categoryName: '教材书籍',
    children: [
      { id: 11, categoryName: '专业教材' },
      { id: 12, categoryName: '考研资料' },
      { id: 13, categoryName: '课外读物' },
    ],
  },
  {
    id: 2,
    categoryName: '数码电子',
    children: [
      { id: 21, categoryName: '电脑配件' },
      { id: 22, categoryName: '手机周边' },
    ],
  },
  {
    id: 3,
    categoryName: '生活用品',
    children: [
      { id: 31, categoryName: '宿舍电器' },
      { id: 32, categoryName: '日用杂物' },
    ],
  },
  { id: 4, categoryName: '运动器材', children: [{ id: 41, categoryName: '球类器械' }] },
]

let nextCategoryId = 50
let nextItemId = 100
const rawItems = [
  ['《数据结构与算法分析》C 语言版', '本部', '九成新', 1, 'consign', '', 28, '专业教材', 11, '书角有轻微折痕，无笔记。'],
  ['罗技 M330 静音无线鼠标', '本部', '九成新', 1, 'consign', '', 45, '电脑配件', 21, '大一购入，换机械键盘后闲置。'],
  ['小米 20000mAh 移动电源', '新校区', '七成新', 1, 'consign', '', 55, '手机周边', 22, '容量正常，附原装数据线。'],
  ['大学英语四级真题集（近五年）', '铁道', '全新', 1, 'exchange', '考研数学全套资料', 0, '考研资料', 12, '买重复了，未拆封。'],
  ['折叠自行车 20 寸', '湘雅', '可用', 1, 'exchange', '自行车或电动车', 0, '日用杂物', 32, '毕业转手，车锁一并给。'],
  ['罗技 K380 蓝牙键盘', '本部', '九成新', 1, 'consign', '', 89, '电脑配件', 21, '三设备切换正常。'],
  ['电工实验箱（含全套元器件）', '新校区', '七成新', 1, 'exchange', '模电实验箱', 0, '专业教材', 11, '元器件基本齐全。'],
  ['羽毛球拍一对（含球）', '本部', '九成新', 1, 'consign', '', 60, '球类器械', 41, '拉的 24 磅线，打过两次。'],
  ['机械制图工具套装', '铁道', '全新', 1, 'exchange', '绘图板或测绘仪器', 0, '专业教材', 11, '课程结束后一直放着。'],
  ['可调光护眼台灯', '湘雅', '七成新', 1, 'consign', '', 35, '宿舍电器', 31, '三档调光，宿舍限电可用。'],
  ['考研数学一全套资料', '本部', '九成新', 1, 'exchange', '英语政治全套资料', 0, '考研资料', 12, '含讲义与真题册。'],
  ['保温杯 500ml', '新校区', '全新', 1, 'consign', '', 25, '日用杂物', 32, '活动发的，用不上。'],
]

// 实物图片放在 frontend/public/picture/ 下，按物品标题关键字匹配。
const coverFiles = [
  ['数据结构与算法分析', '数据结构与算法分析.png'],
  ['罗技 M330', '罗技鼠标.png'],
  ['小米', '小米移动电源.png'],
  ['大学英语四级', '大学英语四级真题.png'],
  ['折叠自行车', '折叠自行车.png'],
  ['罗技 K380', '罗技键盘.png'],
  ['电工实验箱', '电工试验箱.png'],
  ['羽毛球拍', '羽毛球拍.png'],
  ['机械制图工具套装', '机械制图工具套装.png'],
  ['可调光护眼台灯', '可调光护眼台灯.png'],
  ['考研数学一', '考研数学一全套资料.png'],
  ['保温杯', '保温杯.png'],
]
const coverOf = (title) => {
  const hit = coverFiles.find(([key]) => title.includes(key))
  return hit ? new URL('picture/' + hit[1], location.href).href : ''
}

const placeByCampus = {
  本部: '本部图书馆南门（有监控）',
  新校区: 'B栋教学楼大门口',
  铁道: '三舍楼下服务点',
  湘雅: '二食堂门口',
}

const items = rawItems.map(
  ([title, campus, conditionLevel, status, tradeMode, expectItem, price, categoryName, categoryId, description], index) => ({
    itemId: index + 1,
    title,
    campus,
    conditionLevel,
    status,
    tradeMode,
    expectItem,
    price,
    categoryName,
    categoryId,
    description,
    tradePlace: placeByCampus[campus] || pickupPoints[0],
    ownerId: [8, 9].includes(index + 1) ? 1 : 10 + index,
    favorited: false,
    coverUrl: coverOf(title),
    images: coverOf(title) ? [coverOf(title)] : [],
    createTime: '2026-11-' + String(19 - (index % 5)).padStart(2, '0') + ' 1' + (index % 10) + ':20:00',
  }),
)
items.push(
  {
    itemId: 13,
    title: '宿舍小冰箱 60L',
    campus: '本部',
    conditionLevel: '七成新',
    status: 0,
    tradeMode: 'consign',
    expectItem: '',
    price: 180,
    categoryName: '宿舍电器',
    categoryId: 31,
    description: '毕业转手，制冷正常。',
    tradePlace: '三舍楼下服务点',
    ownerId: 1,
    favorited: false,
    coverUrl: '',
    images: [],
    createTime: '2026-11-20 09:12:00',
  },
  {
    itemId: 15,
    title: 'Adobe 全家桶账号（半年）',
    campus: '新校区',
    conditionLevel: '全新',
    status: 0,
    tradeMode: 'consign',
    expectItem: '',
    price: 60,
    categoryName: '电脑配件',
    categoryId: 21,
    description: '账号类物品，请审核是否允许上架。',
    tradePlace: 'B栋教学楼大门口',
    ownerId: 11,
    favorited: false,
    coverUrl: '',
    images: [],
    createTime: '2026-11-21 08:40:00',
  },
  {
    itemId: 16,
    title: '大学物理实验报告模板合集',
    campus: '铁道',
    conditionLevel: '九成新',
    status: 0,
    tradeMode: 'exchange',
    expectItem: '线性代数笔记',
    price: 0,
    categoryName: '专业教材',
    categoryId: 11,
    description: '含 12 个实验的完整报告。',
    tradePlace: '三舍楼下服务点',
    ownerId: 12,
    favorited: false,
    coverUrl: '',
    images: [],
    createTime: '2026-11-20 21:15:00',
  },
  {
    itemId: 14,
    title: '旧床垫 1.9×0.9',
    campus: '铁道',
    conditionLevel: '可用',
    status: 4,
    tradeMode: 'consign',
    expectItem: '',
    price: 30,
    categoryName: '日用杂物',
    categoryId: 32,
    description: '已下架。',
    tradePlace: '三舍楼下服务点',
    ownerId: 1,
    favorited: false,
    coverUrl: '',
    images: [],
    createTime: '2026-11-15 16:40:00',
  },
)

const skills = [
  {
    skillId: 1,
    skillType: 1,
    level: '熟练',
    skillName: '高等数学一对一辅导',
    expectSkill: '英语四六级口语陪练',
    description: '高数上下均已修完，绩点 4.0，可讲微积分与线代核心例题。',
    status: 1,
    userId: 10,
    publisherName: '书页',
    publisherCredit: 92,
    campus: '本部',
    complementary: '双方数学与英语需求高度互补',
    matchTags: ['高等数学', '英语口语'],
  },
  {
    skillId: 2,
    skillType: 1,
    level: '入门',
    skillName: '吉他入门教学',
    expectSkill: '摄影后期 / Lightroom 调色',
    description: '能教基础和弦转换、扫弦节奏型与简单弹唱曲目。',
    status: 1,
    userId: 11,
    publisherName: '树下等风',
    publisherCredit: 89,
    campus: '本部',
    complementary: '',
    matchTags: [],
  },
  {
    skillId: 3,
    skillType: 2,
    level: '熟练',
    skillName: '英语口语陪练（雅思方向）',
    expectSkill: '高等数学 / 线代答疑',
    description: '准备雅思口语 Part 2/3，希望每周对练两次，时间可协调。',
    status: 1,
    userId: 12,
    publisherName: '小麦',
    publisherCredit: 96,
    campus: '新校区',
    complementary: '你的高数能力与对方需求高度互补',
    matchTags: ['高等数学', '英语口语'],
  },
  {
    skillId: 4,
    skillType: 1,
    level: '熟练',
    skillName: '视频剪辑（剪映 / PR）',
    expectSkill: 'PPT 美化与答辩排版',
    description: '剪过多个社团宣传片与比赛路演视频，支持调色与字幕卡点。',
    status: 1,
    userId: 13,
    publisherName: '青禾',
    publisherCredit: 88,
    campus: '铁道',
    complementary: '',
    matchTags: [],
  },
  {
    skillId: 5,
    skillType: 2,
    level: '入门',
    skillName: '考研数学强化答疑',
    expectSkill: 'Python 爬虫与脚本入门',
    description: '强化阶段真题错题急需梳理，每周两次线下自习室答疑。',
    status: 1,
    userId: 1,
    publisherName: '林小满',
    publisherCredit: 96,
    campus: '本部',
    complementary: '对方擅长 Python 可互换辅导',
    matchTags: ['Python', '考研数学'],
  },
  {
    skillId: 6,
    skillType: 1,
    level: '熟练',
    skillName: '人像摄影与活动跟拍',
    expectSkill: '吉他弹唱基础指导',
    description: '校内毕业照、校园风景与社团活动跟拍，附带精修 10 张。',
    status: 1,
    userId: 14,
    publisherName: '阿远',
    publisherCredit: 91,
    campus: '湘雅',
    complementary: '',
    matchTags: [],
  },
]

let nextSkillId = 7

const orders = [
  {
    orderId: 1,
    orderNo: 'CL20261118001',
    itemId: 2,
    itemTitle: '罗技 M330 静音无线鼠标',
    tradeMode: 'consign',
    offerItemId: null,
    offerItemTitle: '',
    orderStatus: 0,
    appointTime: '',
    appointPlace: '',
    closeReason: '',
    fromUserId: 1,
    fromUserName: '林小满',
    fromCredit: 96,
    toUserId: 11,
    toUserName: '树下等风',
    toCredit: 89,
    createTime: '2026-11-21 14:20:00',
    confirmTime: '',
    reviewed: false,
  },
  {
    orderId: 2,
    orderNo: 'CL20261118002',
    itemId: 4,
    itemTitle: '大学英语四级真题集（近五年）',
    tradeMode: 'exchange',
    offerItemId: 9,
    offerItemTitle: '机械制图工具套装',
    orderStatus: 0,
    appointTime: '',
    appointPlace: '',
    closeReason: '',
    fromUserId: 15,
    fromUserName: '方糖',
    fromCredit: 84,
    toUserId: 1,
    toUserName: '林小满',
    toCredit: 96,
    createTime: '2026-11-20 19:02:00',
    confirmTime: '',
    reviewed: false,
  },
  {
    orderId: 3,
    orderNo: 'CL20261117003',
    itemId: 8,
    itemTitle: '羽毛球拍一对（含球）',
    tradeMode: 'consign',
    offerItemId: null,
    offerItemTitle: '',
    orderStatus: 2,
    appointTime: '2026-11-23 15:00:00',
    appointPlace: '本部图书馆南门（有监控）',
    closeReason: '',
    fromUserId: 1,
    fromUserName: '林小满',
    fromCredit: 96,
    toUserId: 16,
    toUserName: '一只扳手',
    toCredit: 93,
    createTime: '2026-11-19 10:15:00',
    confirmTime: '2026-11-19 11:00:00',
    reviewed: false,
  },
  {
    orderId: 4,
    orderNo: 'CL20261117004',
    itemId: 12,
    itemTitle: '保温杯 500ml',
    tradeMode: 'consign',
    offerItemId: null,
    offerItemTitle: '',
    orderStatus: 2,
    appointTime: '2026-11-23 18:30:00',
    appointPlace: 'B栋教学楼大门口',
    closeReason: '',
    fromUserId: 21,
    fromUserName: '木棉',
    fromCredit: 87,
    toUserId: 1,
    toUserName: '林小满',
    toCredit: 96,
    createTime: '2026-11-20 16:40:00',
    confirmTime: '2026-11-20 17:10:00',
    reviewed: false,
  },
  {
    orderId: 5,
    orderNo: 'CL20261112005',
    itemId: 10,
    itemTitle: '可调光护眼台灯',
    tradeMode: 'consign',
    offerItemId: null,
    offerItemTitle: '',
    orderStatus: 3,
    appointTime: '2026-11-13 12:00:00',
    appointPlace: '二食堂门口',
    closeReason: '',
    fromUserId: 19,
    fromUserName: '南风',
    fromCredit: 90,
    toUserId: 1,
    toUserName: '林小满',
    toCredit: 96,
    createTime: '2026-11-12 09:30:00',
    confirmTime: '2026-11-12 10:05:00',
    reviewed: false,
  },
]

const activities = [
  {
    activityId: 1,
    title: '毕业季闲置清仓专场',
    organizer: '绿源公益社',
    tag: '毕业清仓',
    campus: '本部',
    location: '本部二食堂前广场',
    startTime: '2026-12-01 09:00:00',
    endTime: '2026-12-01 17:00:00',
    quota: 120,
    remainQuota: 87,
    creatorId: 2,
    status: 1,
    description: '集中收揽毕业生闲置教材、电器与骑行装备，现场支持以物易物与公益快捐。',
    joined: false,
    items: [],
  },
  {
    activityId: 2,
    title: '新校区绿植与书籍交换日',
    organizer: '读书协会',
    tag: '绿植书市',
    campus: '新校区',
    location: '新校区图书馆中庭',
    startTime: '2026-11-25 10:00:00',
    endTime: '2026-11-25 16:00:00',
    quota: 80,
    remainQuota: 24,
    creatorId: 2,
    status: 1,
    description: '带一盆桌面绿植或一本专业好书到场，匹配校园同好现场交换并获活动贴纸。',
    joined: true,
    items: [],
  },
  {
    activityId: 3,
    title: '铁道校区爱心义卖',
    organizer: '校园服务中心',
    tag: '爱心义卖',
    campus: '铁道',
    location: '铁道校区文化广场',
    startTime: '2026-11-10 09:30:00',
    endTime: '2026-11-10 16:30:00',
    quota: 60,
    remainQuota: 0,
    creatorId: 3,
    status: 3,
    description: '义卖及捐赠所得物资全部用于对口乡村小学图书室建设。',
    joined: false,
    items: [],
  },
]

let nextActivityId = 4
let nextJoinNo = 2001

const donations = [
  {
    donationId: 1,
    clubId: 2,
    clubName: '绿源公益社',
    title: '旧床垫 1.9×0.9',
    donorName: '林小满',
    campus: '铁道',
    conditionLevel: '可用',
    coverUrl: '',
    auditStatus: 0,
    auditRemark: '',
    certificateNo: '',
    createTime: '2026-11-20 10:05:00',
    itemId: 14,
    remark: '已清洁消毒，可正常使用。',
  },
  {
    donationId: 2,
    clubId: 2,
    clubName: '绿源公益社',
    title: '保温杯 500ml',
    donorName: '林小满',
    campus: '新校区',
    conditionLevel: '全新',
    coverUrl: coverOf('保温杯'),
    auditStatus: 1,
    auditRemark: '全新未拆封，符合捐赠入库标准',
    certificateNo: 'CLD2026119K4M7X2P',
    createTime: '2026-11-16 15:22:00',
    itemId: 12,
    remark: '活动领取闲置，希望转赠给需要的同学。',
  },
  {
    donationId: 3,
    clubId: 2,
    clubName: '绿源公益社',
    title: '可调光护眼台灯',
    donorName: '南风',
    campus: '湘雅',
    conditionLevel: '七成新',
    coverUrl: coverOf('可调光护眼台灯'),
    auditStatus: 2,
    auditRemark: '灯罩接口松动存在安全隐患，建议维修稳固后重新提交',
    certificateNo: '',
    createTime: '2026-11-11 09:40:00',
    itemId: 10,
    remark: '宿舍毕业闲置台灯。',
  },
]

const messages = [
  { notifyId: 1, createTime: '2026-11-20 19:02:00', title: '流转单待确认', content: '你收到的「大学英语四级真题集」交换申请等待接单。', isRead: false, notifyType: 'order', refId: 2 },
  { notifyId: 2, createTime: '2026-11-19 11:30:00', title: '物品审核通过', content: '你发布的「罗技 M330 静音无线鼠标」已通过审核并上架，信用分 +2。', isRead: false, notifyType: 'audit', refId: 2 },
  { notifyId: 3, createTime: '2026-11-18 08:55:00', title: '信用分变动', content: '完成流转核销，信用分 +5。', isRead: true, notifyType: 'credit', refId: 3 },
  { notifyId: 4, createTime: '2026-11-17 20:14:00', title: '活动报名成功', content: '你已成功报名「新校区绿植与书籍交换日」。', isRead: true, notifyType: 'system', refId: 2 },
  { notifyId: 5, createTime: '2026-11-16 15:22:00', title: '捐赠凭证已生成', content: '捐赠编号 CLD2026119K4M7X2P 的电子凭证已生成并可下载。', isRead: true, notifyType: 'system', refId: 2 },
]

// 信用流水与标准 6 条规则对齐（+2/+5/+3/+5/-10/-15），同时呈现可申诉项（null）与待复核项（0）
const creditLogs = [
  { creditLogId: 1, createTime: '2026-11-18 08:55:00', changeValue: 5, reasonType: 'finish', orderNo: 'CL20261112005', remark: '完成流转单 CL20261112005 面交核销', appealStatus: null },
  { creditLogId: 2, createTime: '2026-11-14 21:10:00', changeValue: -10, reasonType: 'no_show', orderNo: 'CL20261114009', remark: '流转单 CL20261114009 超预约 24 小时未核销', appealStatus: null },
  { creditLogId: 3, createTime: '2026-11-16 15:22:00', changeValue: 5, reasonType: 'donation', orderNo: 'CLD2026119K4M7X2P', remark: '公益捐赠「保温杯 500ml」审核入库', appealStatus: null },
  { creditLogId: 4, createTime: '2026-11-12 20:31:00', changeValue: 3, reasonType: 'good_review', orderNo: 'CL20261112005', remark: '收到来自「书页」的 5 星履约好评', appealStatus: null },
  { creditLogId: 5, createTime: '2026-11-06 18:10:00', changeValue: -10, reasonType: 'timeout', orderNo: 'CL20261106003', remark: '流转单 CL20261106003 爽约超时扣分', appealStatus: 0 },
  { creditLogId: 6, createTime: '2026-11-02 17:45:00', changeValue: 2, reasonType: 'publish', orderNo: 'ITEM-008', remark: '发布闲置物品通过审核上架', appealStatus: null },
]

const reviews = [
  { reviewId: 1, reviewerName: '书页', score: 5, tags: ['准时守约', '描述一致'], content: '物品和描述完全一致，图书馆南门见面非常准时。', createTime: '2026-11-18 09:20:00' },
  { reviewId: 2, reviewerName: '小麦', score: 5, tags: ['沟通顺畅', '成色很新'], content: '沟通非常顺畅，还贴心带了包装袋，强烈推荐。', createTime: '2026-11-12 20:31:00' },
  { reviewId: 3, reviewerName: '南风', score: 4, tags: ['物品实用'], content: '东西很实用，因为下课赶过来稍微等了五分钟。', createTime: '2026-11-05 12:08:00' },
]

const reports = [
  {
    reportId: 1,
    createTime: '2026-11-20 13:24:00',
    reportType: '虚假描述',
    targetTitle: '《高等数学》上下册合集',
    reportContent: '商品描述称全新无笔记，实际内页有多处荧光笔涂画。',
    handleStatus: 0,
    reporterName: '林小满',
  },
  {
    reportId: 2,
    createTime: '2026-11-19 10:15:00',
    reportType: '积分申诉',
    targetTitle: '信用流水 #5（CL20261106003）',
    reportContent: '[creditLogId=5] 当天校车晚点已提前站内告知对方改期，申请复核撤回超时扣分。',
    handleStatus: 0,
    reporterName: '林小满',
  },
  {
    reportId: 3,
    createTime: '2026-11-15 16:33:00',
    reportType: '违禁物品',
    targetTitle: '大功率热得快',
    reportContent: '宿舍违禁大功率发热电器，不符合校园安全规范。',
    handleStatus: 1,
    reporterName: '王思远',
    handleRemark: '已核实下架物品并扣除发布人信用分',
  },
  {
    reportId: 4,
    createTime: '2026-11-10 11:02:00',
    reportType: '恶意爽约',
    targetTitle: '流转单 CL20261109011',
    reportContent: '到达自提点等待半小时对方未现身也未回复。',
    handleStatus: 2,
    reporterName: '李佳',
    handleRemark: '双方已重新约定面交且无实际损失，驳回惩罚请求',
  },
]

const auditLogs = [
  { logId: 1, operTime: '2026-11-20 14:05:00', operType: '物品审核', userName: '运营管理员', operDesc: '审核通过物品 2 件' },
  { logId: 2, operTime: '2026-11-20 13:41:00', operType: '工单处置', userName: '运营管理员', operDesc: '处置违禁物品举报工单 #3 并下架物品' },
  { logId: 3, operTime: '2026-11-19 10:18:00', operType: '字典维护', userName: '运营管理员', operDesc: '更新校内自提点白名单字典' },
  { logId: 4, operTime: '2026-11-18 09:02:00', operType: '用户管理', userName: '运营管理员', operDesc: '核验学生认证信息' },
  { logId: 5, operTime: '2026-11-17 16:50:00', operType: '物品审核', userName: '运营管理员', operDesc: '驳回违规物品 1 件' },
]

const dicts = {
  category: categories,
  condition: ['全新', '九成新', '七成新', '可用'],
  pickup_point: [...pickupPoints],
  credit_rule: [
    { key: 'publish', label: '发布审核通过', delta: '+2' },
    { key: 'finish', label: '完成流转核销', delta: '+5' },
    { key: 'good_review', label: '收到履约好评', delta: '+3' },
    { key: 'donation', label: '公益捐赠审核通过', delta: '+5' },
    { key: 'no_show', label: '爽约 / 超时违约', delta: '-10' },
    { key: 'report_valid', label: '举报核实成立', delta: '-15' },
  ],
}
// 兼容旧字典 key 别名
dicts.pickup = dicts.pickup_point
dicts.credit = dicts.credit_rule

function fail(message) {
  throw new Error(message)
}

function paginate(list, params = {}, size = 12) {
  const pageSize = Number(params.pageSize) || size
  const pageNum = Number(params.page) || 1
  const start = (pageNum - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    pages: Math.max(1, Math.ceil(list.length / pageSize)),
  }
}

function categoryName(id) {
  for (const parent of categories) {
    for (const child of parent.children || []) if (child.id === Number(id)) return child.categoryName
    if (parent.id === Number(id)) return parent.categoryName
  }
  return ''
}

function profileOf(account) {
  const { userId, username, realName, role, campus, college, studentNo, authStatus, creditScore } = account
  return { userId, username, realName, role, campus, college, studentNo, authStatus, creditScore }
}

function activeItems() {
  return items.filter((item) => item.status === 1)
}

function nextCertNo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'CLD202611'
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const recReasons = [
  '同校区热门',
  '匹配你的「数码配件」兴趣',
  '匹配你的「考研教材」兴趣',
  '高信用发布 · 成色极佳',
  '近 7 天热度上升',
  '本学期刚需教材',
  '同学院同学发布',
  '支持校内自提点面交',
]

export async function mockData(path, method, params = {}) {
  const id = (match) => Number(path.match(match)?.[1])

  // ---- 认证与账号 ----
  if (path === '/auth/login' && method === 'POST') {
    const account = accounts[params.role] || accounts.student
    signedOut = false
    current = account
    return profileOf(account)
  }
  if (path === '/auth/logout' && method === 'POST') {
    signedOut = true
    current = accounts.student
    return null
  }
  if (path === '/users/me') {
    if (signedOut) fail('登录状态已失效，请重新登录')
    return profileOf(current)
  }
  if (path === '/users/me/profile' && method === 'POST') {
    Object.assign(current, { campus: params.campus, college: params.college })
    return profileOf(current)
  }
  if (path === '/users/me/password' && method === 'POST') {
    if (params.newPassword !== params.confirmPassword) fail('两次新密码不一致')
    return null
  }

  // ---- 首页与分类 ----
  if (path === '/recommendations') {
    return activeItems()
      .slice(0, 8)
      .map((item, idx) => ({ ...item, reason: recReasons[idx % recReasons.length] }))
  }
  if (path === '/categories/tree') return categories

  // ---- 物品 ----
  if (path === '/items' && method === 'GET') {
    const keyword = (params.keyword || '').trim()
    let list = activeItems()
    if (params.campus) list = list.filter((item) => item.campus === params.campus)
    if (params.categoryId) {
      const cid = Number(params.categoryId)
      const parent = categories.find((c) => c.id === cid)
      const childIds = parent ? (parent.children || []).map((c) => c.id) : []
      list = list.filter((item) => item.categoryId === cid || childIds.includes(item.categoryId))
    }
    if (params.conditionLevel) list = list.filter((item) => item.conditionLevel === params.conditionLevel)
    if (params.tradeMode) list = list.filter((item) => item.tradeMode === params.tradeMode)
    if (params.minPrice) list = list.filter((item) => Number(item.price) >= Number(params.minPrice))
    if (params.maxPrice) list = list.filter((item) => Number(item.price) <= Number(params.maxPrice))
    if (keyword)
      list = list.filter((item) => (item.title + item.description + item.categoryName).includes(keyword))
    if (params.sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price)
    else if (params.sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price)
    else if (params.sort === 'hot') list = [...list].sort((a, b) => b.itemId - a.itemId)
    else list = [...list].sort((a, b) => b.itemId - a.itemId)
    return { ...paginate(list, params), fallbackList: activeItems().slice(0, 4) }
  }
  if (path === '/items/mine' && method === 'GET') {
    let list = items.filter((item) => item.ownerId === current.userId)
    if (params.status !== undefined && params.status !== '') list = list.filter((item) => item.status === Number(params.status))
    return paginate(list, params)
  }
  if (path === '/items' && method === 'POST') {
    const field = (key) => (params instanceof FormData ? params.get(key) ?? '' : params[key] ?? '')
    const editId = Number(field('itemId'))
    if (editId) {
      const existing = items.find((row) => row.itemId === editId)
      if (!existing) fail('物品不存在')
      Object.assign(existing, {
        title: String(field('title')) || existing.title,
        campus: String(field('campus')) || existing.campus,
        conditionLevel: String(field('conditionLevel')) || existing.conditionLevel,
        tradeMode: String(field('tradeMode') || existing.tradeMode),
        expectItem: String(field('expectItem')),
        price: Number(field('price')) || 0,
        categoryId: Number(field('categoryId')) || existing.categoryId,
        categoryName: categoryName(field('categoryId')) || existing.categoryName,
        description: String(field('description')),
        tradePlace: String(field('tradePlace')),
        status: 0,
      })
      return existing
    }
    const item = {
      itemId: nextItemId++,
      title: String(field('title')),
      campus: String(field('campus')),
      conditionLevel: String(field('conditionLevel')),
      status: 0,
      tradeMode: String(field('tradeMode') || 'consign'),
      expectItem: String(field('expectItem')),
      price: Number(field('price')) || 0,
      categoryId: Number(field('categoryId')) || 11,
      categoryName: categoryName(field('categoryId')),
      description: String(field('description')),
      tradePlace: String(field('tradePlace')),
      ownerId: current.userId,
      favorited: false,
      coverUrl: coverOf(String(field('title'))),
      images: coverOf(String(field('title'))) ? [coverOf(String(field('title')))] : [],
      createTime: '2026-11-22 10:00:00',
    }
    if (!item.title) fail('物品标题不能为空')
    items.unshift(item)
    return item
  }
  if (/^\/items\/\d+$/.test(path) && method === 'GET') {
    const item = items.find((row) => row.itemId === id(/^\/items\/(\d+)$/))
    if (!item) fail('物品不存在或已下架')
    const publisher = itemPublishers[item.ownerId]
    const isOwner = !signedOut && sessionStorage.getItem('campus-session') && item.ownerId === current.userId
    if (item.status === 1 && !isOwner) item.viewCount = (item.viewCount ?? 0) + 1
    return {
      ...item,
      sellerNickname: publisher?.nickname || '校内同学',
      sellerCampus: publisher?.campus || item.campus,
      sellerCreditScore: publisher?.creditScore ?? 90,
      viewCount: item.viewCount ?? 1,
    }
  }
  if (/^\/items\/\d+\/favorite$/.test(path) && method === 'POST') {
    const item = items.find((row) => row.itemId === id(/^\/items\/(\d+)\/favorite$/))
    if (!item) fail('物品不存在')
    item.favorited = !item.favorited
    return { favorited: item.favorited }
  }
  if (/^\/items\/\d+\/state$/.test(path) && method === 'POST') {
    const itemId = id(/^\/items\/(\d+)\/state$/)
    const item = items.find((row) => row.itemId === itemId)
    if (!item) fail('物品不存在')
    if (params.action === 'offShelf') item.status = 4
    else if (params.action === 'delete') items.splice(items.indexOf(item), 1)
    return null
  }

  // ---- 举报 ----
  if (path === '/reports' && method === 'POST') {
    reports.unshift({
      reportId: reports.length + 1,
      createTime: '2026-11-22 10:15:00',
      reportType: params.reportType || '虚假描述',
      targetTitle: items.find((x) => x.itemId === Number(params.itemId))?.title || '物品 #' + params.itemId,
      reportContent: params.reportContent || '',
      handleStatus: 0,
      reporterName: current.realName || current.username,
    })
    return null
  }

  // ---- 技能 ----
  if (path === '/skills' && method === 'GET') {
    let list = skills.filter((skill) => skill.status === 1)
    if (params.skillType) list = list.filter((skill) => skill.skillType === Number(params.skillType))
    if (params.level) list = list.filter((skill) => skill.level === params.level)
    if (params.keyword) {
      const keyword = params.keyword.trim()
      list = list.filter((skill) => (skill.skillName + skill.description + skill.expectSkill).includes(keyword))
    }
    return paginate(list, params)
  }
  if (path === '/skills' && method === 'POST') {
    const skillId = Number(params.skillId)
    const existing = skills.find((skill) => skill.skillId === skillId)
    if (existing) {
      const { skillType: _ignoredType, ...rest } = params
      Object.assign(existing, rest, { skillId })
      return { skillId }
    }
    const sType = Number(params.skillType) || 1
    const activeCount = skills.filter(
      (s) => s.userId === current.userId && s.skillType === sType && s.status === 1,
    ).length
    if (activeCount >= 3) fail('同类有效技能最多发布 3 条，请先关闭不再需要的技能')
    const skill = {
      skillId: nextSkillId++,
      skillType: sType,
      level: params.level || '入门',
      skillName: params.skillName || '',
      expectSkill: params.expectSkill || '',
      description: params.description || '',
      status: Number(params.status ?? 1),
      userId: current.userId,
      publisherName: current.realName || current.username,
      publisherCredit: current.creditScore,
      campus: current.campus,
      complementary: '',
      matchTags: [],
    }
    skills.unshift(skill)
    return { skillId: skill.skillId }
  }
  if (/^\/skills\/\d+$/.test(path) && method === 'GET') {
    const skill = skills.find((row) => row.skillId === id(/^\/skills\/(\d+)$/))
    if (!skill) fail('技能信息不存在')
    return skill
  }
  if (/^\/skills\/\d+\/invites$/.test(path) && method === 'POST') return null

  // ---- 流转单 ----
  if (path === '/orders' && method === 'POST') {
    const targetItem = items.find((item) => item.itemId === Number(params.itemId))
    const offerItem = params.offerItemId ? items.find((item) => item.itemId === Number(params.offerItemId)) : null
    const ownerPub = targetItem ? itemPublishers[targetItem.ownerId] : null
    const order = {
      orderId: orders.length + 1,
      orderNo: 'CL2026' + String(11220000 + orders.length + 1),
      itemId: targetItem?.itemId ?? Number(params.itemId),
      itemTitle: targetItem?.title || '闲置物品',
      tradeMode: params.tradeMode || targetItem?.tradeMode || 'consign',
      offerItemId: offerItem?.itemId ?? null,
      offerItemTitle: offerItem?.title || '',
      orderStatus: 0,
      appointTime: '',
      appointPlace: '',
      closeReason: '',
      fromUserId: current.userId,
      fromUserName: current.realName || current.username,
      fromCredit: current.creditScore,
      toUserId: targetItem?.ownerId ?? 11,
      toUserName: ownerPub?.nickname || '对方同学',
      toCredit: ownerPub?.creditScore ?? 92,
      createTime: '2026-11-22 10:20:00',
      confirmTime: '',
      reviewed: false,
    }
    orders.unshift(order)
    return { orderId: order.orderId, orderNo: order.orderNo }
  }
  if (path === '/orders/mine' && method === 'GET') {
    const key = params.roleType === 'to' ? 'toUserId' : 'fromUserId'
    let list = orders.filter((order) => order[key] === current.userId)
    if (params.orderStatus !== undefined && params.orderStatus !== '')
      list = list.filter((order) => order.orderStatus === Number(params.orderStatus))
    return paginate(list, params)
  }
  if (/^\/orders\/\d+$/.test(path) && method === 'GET') {
    const order = orders.find((row) => row.orderId === id(/^\/orders\/(\d+)$/))
    if (!order) fail('流转单不存在')
    const item = items.find((row) => row.itemId === order.itemId || row.title === order.itemTitle)
    const offerItem = order.offerItemId ? items.find((row) => row.itemId === order.offerItemId) : null
    return { ...order, item, offerItem }
  }
  if (/^\/orders\/\d+\/(confirm|cancel|verify|appointment)$/.test(path) && method === 'POST') {
    const match = path.match(/^\/orders\/(\d+)\/(\w+)$/)
    const order = orders.find((row) => row.orderId === Number(match[1]))
    if (!order) fail('流转单不存在')
    if (match[2] === 'confirm') {
      order.orderStatus = 1
      order.confirmTime = '2026-11-22 10:30:00'
    } else if (match[2] === 'cancel') {
      order.orderStatus = 4
      order.closeReason = params.closeReason || '用户取消'
    } else if (match[2] === 'verify') {
      order.orderStatus = 3
    } else if (match[2] === 'appointment') {
      order.appointTime = params.appointTime
      order.appointPlace = params.appointPlace
      order.orderStatus = 2
    }
    return null
  }

  // ---- 评价 ----
  if (path === '/reviews' && method === 'GET') return paginate(reviews, params)
  if (path === '/reviews' && method === 'POST') {
    const order = orders.find((row) => row.orderId === Number(params.orderId))
    if (order) order.reviewed = true
    const tagList = String(params.tags || '')
      .split(/[,，\s]+/)
      .filter(Boolean)
    reviews.unshift({
      reviewId: reviews.length + 1,
      reviewerName: current.realName || current.username,
      score: Number(params.score),
      tags: tagList,
      content: params.content,
      createTime: '2026-11-22 10:40:00',
    })
    return null
  }

  // ---- 信用 ----
  if (path === '/credits/logs') {
    return {
      creditScore: current.creditScore,
      level: creditLevelOf(current.creditScore),
      avgScore: 4.7,
      reviewCount: reviews.length,
      tags: [
        { label: '准时守约', count: 8 },
        { label: '描述一致', count: 7 },
        { label: '沟通顺畅', count: 6 },
        { label: '成色很新', count: 4 },
      ],
      ...paginate(creditLogs, params),
    }
  }
  if (path === '/credits/appeals' && method === 'POST') {
    const log = creditLogs.find((row) => row.creditLogId === Number(params.creditLogId))
    if (!log) fail('积分流水不存在')
    if (log.appealStatus != null) fail('该条扣分记录已提交过申诉')
    log.appealStatus = 0
    reports.unshift({
      reportId: reports.length + 1,
      createTime: '2026-11-22 10:45:00',
      reportType: '积分申诉',
      targetTitle: '信用流水 #' + log.creditLogId + (log.orderNo ? '（' + log.orderNo + '）' : ''),
      reportContent: '[creditLogId=' + log.creditLogId + '] ' + (params.reason || ''),
      handleStatus: 0,
      reporterName: current.realName || current.username,
    })
    return null
  }

  // ---- 捐赠 ----
  if (path === '/donations/verify') {
    const cert = String(params.certificateNo || '').trim()
    if (!/^CLD\d{6}[A-HJ-NP-Z2-9]{8}$/.test(cert)) return { valid: false, certificateNo: cert }
    const donation = donations.find((row) => row.certificateNo === cert && row.auditStatus === 1)
    if (!donation) return { valid: false, certificateNo: cert }
    return {
      valid: true,
      certificateNo: donation.certificateNo,
      itemTitle: donation.title,
      donorMasked: (donation.donorName || '林')[0] + '**',
      clubName: donation.clubName,
      auditTime: donation.createTime,
    }
  }
  if (path === '/donations' && method === 'GET') {
    let list = [...donations]
    if (params.auditStatus !== undefined && params.auditStatus !== '')
      list = list.filter((row) => row.auditStatus === Number(params.auditStatus))
    return paginate(list, params)
  }
  if (path === '/donations' && method === 'POST') {
    const targetItem = items.find((item) => item.itemId === Number(params.itemId))
    const targetClub = charityClubs.find((c) => c.clubId === Number(params.clubId)) || charityClubs[0]
    donations.unshift({
      donationId: donations.length + 1,
      clubId: targetClub.clubId,
      clubName: targetClub.clubName,
      title: targetItem?.title || '闲置物品',
      donorName: current.realName || current.username,
      campus: targetItem?.campus || current.campus,
      conditionLevel: targetItem?.conditionLevel || '九成新',
      coverUrl: targetItem?.coverUrl || '',
      auditStatus: 0,
      auditRemark: '',
      certificateNo: '',
      createTime: '2026-11-22 10:30:00',
      itemId: Number(params.itemId),
      remark: params.remark || '',
    })
    return null
  }
  if (/^\/donations\/\d+\/audit$/.test(path) && method === 'POST') {
    const donation = donations.find((row) => row.donationId === id(/^\/donations\/(\d+)\/audit$/))
    if (!donation) fail('捐赠记录不存在')
    donation.auditStatus = params.pass ? 1 : 2
    donation.auditRemark = params.auditRemark || ''
    if (params.pass) donation.certificateNo = nextCertNo()
    return null
  }

  // ---- 消息 ----
  if (path === '/messages/unread-count') return { unreadCount: messages.filter((row) => !row.isRead).length }
  if (path === '/messages' && method === 'GET') {
    let list = [...messages]
    if (params.notifyType) list = list.filter((row) => row.notifyType === params.notifyType)
    if (params.isRead !== undefined && params.isRead !== '')
      list = list.filter((row) => row.isRead === (params.isRead === 'true' || params.isRead === true || params.isRead === '1' || params.isRead === 1))
    return paginate(list, params)
  }
  if (path === '/messages/read' && method === 'POST') {
    if (params.all) messages.forEach((row) => (row.isRead = true))
    else {
      const message = messages.find((row) => row.notifyId === Number(params.notifyId))
      if (message) message.isRead = true
    }
    return { unreadCount: messages.filter((row) => !row.isRead).length }
  }

  // ---- 集市活动 ----
  if (path === '/activities' && method === 'GET') {
    let list = [...activities]
    if (params.campus) list = list.filter((row) => row.campus === params.campus)
    if (params.status !== undefined && params.status !== '') list = list.filter((row) => row.status === Number(params.status))
    return paginate(list, params)
  }
  if (path === '/activities' && method === 'POST') {
    const activityId = Number(params.activityId)
    const existing = activities.find((row) => row.activityId === activityId)
    if (existing) {
      Object.assign(existing, params, { activityId })
      return { activityId }
    }
    const activity = {
      activityId: nextActivityId++,
      title: params.title,
      organizer: current.realName || '绿源公益社',
      tag: '校园集市',
      campus: params.campus,
      location: params.location,
      startTime: params.startTime,
      endTime: params.endTime,
      quota: Number(params.quota) || 1,
      remainQuota: Number(params.quota) || 1,
      creatorId: current.userId,
      status: Number(params.status) || 0,
      description: params.description || '',
      joined: false,
      items: [],
    }
    activities.unshift(activity)
    return { activityId: activity.activityId }
  }
  if (/^\/activities\/\d+$/.test(path) && method === 'GET') {
    const activity = activities.find((row) => row.activityId === id(/^\/activities\/(\d+)$/))
    if (!activity) fail('活动不存在')
    return { ...activity, items: activeItems().slice(0, 4) }
  }
  if (/^\/activities\/\d+\/join$/.test(path) && method === 'POST') {
    const activity = activities.find((row) => row.activityId === id(/^\/activities\/(\d+)\/join$/))
    if (!activity) fail('活动不存在')
    if (activity.status !== 1) fail('该活动当前不在报名阶段')
    if (activity.remainQuota <= 0) fail('名额已满')
    activity.remainQuota -= 1
    activity.joined = true
    return { remainQuota: activity.remainQuota, joinNo: 'ACT202611' + String(nextJoinNo++) }
  }

  // ---- 管理端 ----
  if (path === '/admin/dashboard') {
    const campus = params.campus
    const scale = campus ? 0.6 : 1
    return {
      kpi: {
        publishCount: Math.round(128 * scale),
        finishCount: Math.round(86 * scale),
        donationCount: Math.round(23 * scale),
        defaultRate: campus ? '3.1%' : '2.4%',
      },
      trend: [
        { statDate: '2026-11-15', publishCount: 12, finishCount: 8 },
        { statDate: '2026-11-16', publishCount: 18, finishCount: 11 },
        { statDate: '2026-11-17', publishCount: 15, finishCount: 13 },
        { statDate: '2026-11-18', publishCount: 24, finishCount: 16 },
        { statDate: '2026-11-19', publishCount: 21, finishCount: 19 },
        { statDate: '2026-11-20', publishCount: 28, finishCount: 22 },
      ].map((row) => ({
        statDate: row.statDate,
        publishCount: Math.round(row.publishCount * scale),
        finishCount: Math.round(row.finishCount * scale),
      })),
      categoryShare: { 教材书籍: 42, 数码电子: 28, 生活用品: 35, 运动器材: 18 },
      tradeModeShare: { 以物易物: 61, 低价寄售: 45 },
      funnel: { 发布: 128, 浏览: 642, 意向: 96, 成交: 86 },
    }
  }
  if (path === '/admin/audit-logs') {
    let list = [...auditLogs]
    if (params.userName) list = list.filter((row) => row.userName.includes(params.userName))
    if (params.operType) list = list.filter((row) => row.operType.includes(params.operType))
    return paginate(list, params)
  }
  if (path === '/admin/reports' && method === 'GET') {
    let list = [...reports]
    if (params.handleStatus !== undefined && params.handleStatus !== '')
      list = list.filter((row) => row.handleStatus === Number(params.handleStatus))
    if (params.reportType) list = list.filter((row) => row.reportType === params.reportType)
    return paginate(list, params)
  }
  if (/^\/admin\/reports\/\d+\/handle$/.test(path) && method === 'POST') {
    const report = reports.find((row) => row.reportId === id(/^\/admin\/reports\/(\d+)\/handle$/))
    if (!report) fail('工单不存在')
    report.handleStatus = Number(params.handleStatus)
    report.handleRemark = params.remark || ''
    if (report.reportType === '积分申诉') {
      const m = report.reportContent?.match(/\[creditLogId=(\d+)\]/)
      if (m) {
        const log = creditLogs.find((r) => r.creditLogId === Number(m[1]))
        if (log) log.appealStatus = report.handleStatus === 1 ? 1 : 2
      }
    }
    return null
  }
  if (/^\/admin\/dicts\/\w+$/.test(path) && method === 'POST') {
    const dictType = path.split('/').pop()
    const op = params.op || 'list'
    const p = params.payload || {}
    if (dictType === 'condition' && op !== 'list') {
      fail('成色为系统只读枚举，不支持增删改')
    }
    if (op === 'list') return { dictType, list: dicts[dictType] || [] }
    if (dictType === 'category') {
      if (op === 'add' && p.categoryName) {
        if (p.parentId) {
          const parent = categories.find((c) => c.id === Number(p.parentId))
          if (parent) parent.children.push({ id: nextCategoryId++, categoryName: p.categoryName })
        } else {
          categories.push({ id: nextCategoryId++, categoryName: p.categoryName, children: [] })
        }
      } else if (op === 'delete' && p.id) {
        const idx = categories.findIndex((c) => c.id === Number(p.id))
        if (idx >= 0) categories.splice(idx, 1)
        else {
          for (const parent of categories) {
            const cIdx = (parent.children || []).findIndex((c) => c.id === Number(p.id))
            if (cIdx >= 0) parent.children.splice(cIdx, 1)
          }
        }
      }
      return { dictType, list: dicts.category }
    }
    if (dictType === 'pickup_point' || dictType === 'pickup') {
      if (op === 'add' && p.name) dicts.pickup_point.push(p.name)
      else if (op === 'delete' && p.index != null) dicts.pickup_point.splice(Number(p.index), 1)
      else if (op === 'update' && p.index != null && p.name) dicts.pickup_point[Number(p.index)] = p.name
      return { dictType, list: dicts.pickup_point }
    }
    if (dictType === 'credit_rule' || dictType === 'credit') {
      if (op === 'update' && p.key) {
        const hit = dicts.credit_rule.find((r) => r.key === p.key)
        if (hit) {
          if (p.delta) hit.delta = String(p.delta)
          if (p.label) hit.label = String(p.label)
        }
      }
      return { dictType, list: dicts.credit_rule }
    }
    return { dictType, op, payload: p, list: dicts[dictType] || [] }
  }
  if (path === '/admin/items/pending') {
    let list = items.filter((item) => item.status === 0)
    if (params.campus) list = list.filter((item) => item.campus === params.campus)
    if (params.categoryId) list = list.filter((item) => item.categoryId === Number(params.categoryId))
    return paginate(list, params)
  }
  if (path === '/admin/items/audit' && method === 'POST') {
    for (const itemId of params.itemIds || []) {
      const item = items.find((row) => row.itemId === Number(itemId))
      if (!item) continue
      item.status = params.pass ? 1 : 4
      item.remark = params.reason || ''
    }
    return null
  }

  return fail('演示数据暂未覆盖该接口：' + method + ' ' + path)
}

function textBlob(content, type) {
  return new Blob([content], { type })
}

export async function mockFile(path) {
  if (/^\/orders\/\d+\/qrcode$/.test(path)) {
    const resp = await fetch(appointmentQrUrl)
    return resp.blob()
  }
  if (path === '/admin/dashboard/export')
    return textBlob('校区,发布时间,成交时间\n本部,2026-11-20,2026-11-20\n', 'application/vnd.ms-excel')
  if (/^\/donations\/\d+\/certificate$/.test(path)) {
    const donation = donations.find((row) => row.donationId === Number(path.match(/\d+/)[0]))
    return textBlob('校园循环 · 捐赠电子凭证\n编号：' + (donation?.certificateNo || '—') + '\n物品：' + (donation?.title || '—') + '\n', 'application/pdf')
  }
  return fail('演示数据暂未覆盖该文件接口：' + path)
}
