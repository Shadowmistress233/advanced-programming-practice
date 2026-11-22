// 演示用本地假数据层：没有后端时让全部页面可交互。
// 接真实后端时把 MOCK_ENABLED 改成 false 即可恢复真实请求。
// 演示账号：student / club / admin，密码任意（6~20 位）。

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

// 演示详情只返回发布人的公开昵称与信用分。
const itemPublishers = {
  1: { nickname: '林同学', creditScore: accounts.student.creditScore },
  2: { nickname: '绿源公益社', creditScore: accounts.club.creditScore },
  3: { nickname: '运营管理员', creditScore: accounts.admin.creditScore },
  10: { nickname: '书页', creditScore: 92 },
  11: { nickname: '树下等风', creditScore: 89 },
  12: { nickname: '小麦', creditScore: 96 },
  13: { nickname: '青禾', creditScore: 88 },
  14: { nickname: '阿远', creditScore: 91 },
  15: { nickname: '方糖', creditScore: 84 },
  16: { nickname: '一只扳手', creditScore: 93 },
  19: { nickname: '南风', creditScore: 90 },
  20: { nickname: '墨水瓶', creditScore: 95 },
  21: { nickname: '木棉', creditScore: 87 },
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

// 实物图片放在 frontend/picture/ 下，按物品标题关键字匹配。
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
    tradePlace: campus + '菜鸟驿站',
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
    tradePlace: '本部 6 号宿舍楼',
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
    tradePlace: '线上交付',
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
    tradePlace: '铁道图书馆门口',
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
    tradePlace: '铁道 3 号宿舍楼',
    ownerId: 1,
    favorited: false,
    coverUrl: '',
    images: [],
    createTime: '2026-11-15 16:40:00',
  },
)

const skills = [
  { skillId: 1, skillType: 1, level: '熟练', skillName: '高等数学一对一辅导', expectSkill: '', description: '高数上下均已修完，绩点 4.0。', status: 1, userId: 10, complementary: '' },
  { skillId: 2, skillType: 1, level: '入门', skillName: '吉他入门教学', expectSkill: '', description: '能教基础和弦与扫弦。', status: 1, userId: 11, complementary: '' },
  { skillId: 3, skillType: 2, level: '熟练', skillName: '想找：英语口语陪练', expectSkill: '英语口语陪练', description: '准备雅思口语，希望每周两次。', status: 1, userId: 12, complementary: '可以带你练高数' },
  { skillId: 4, skillType: 1, level: '熟练', skillName: '视频剪辑（剪映 / PR）', expectSkill: '', description: '剪过社团宣传片。', status: 1, userId: 13, complementary: '' },
  { skillId: 5, skillType: 2, level: '入门', skillName: '想找：考研数学答疑', expectSkill: '考研数学答疑', description: '强化阶段急需答疑。', status: 1, userId: 1, complementary: '能教 Python 爬虫' },
  { skillId: 6, skillType: 1, level: '熟练', skillName: '摄影修图', expectSkill: '', description: '人像与活动跟拍。', status: 1, userId: 14, complementary: '' },
]

let nextSkillId = 7

const orders = [
  { orderId: 1, orderNo: 'CL20261118001', itemTitle: '罗技 M330 静音无线鼠标', orderStatus: 0, appointTime: '', appointPlace: '', closeReason: '', fromUserId: 1, toUserId: 42, reviewed: false },
  { orderId: 2, orderNo: 'CL20261118002', itemTitle: '大学英语四级真题集（近五年）', orderStatus: 0, appointTime: '', appointPlace: '', closeReason: '', fromUserId: 42, toUserId: 1, reviewed: false },
  { orderId: 3, orderNo: 'CL20261117003', itemTitle: '羽毛球拍一对（含球）', orderStatus: 2, appointTime: '2026-11-22 15:00:00', appointPlace: '本部体育馆门口', closeReason: '', fromUserId: 1, toUserId: 43, reviewed: false },
  { orderId: 4, orderNo: 'CL20261117004', itemTitle: '保温杯 500ml', orderStatus: 2, appointTime: '2026-11-22 18:30:00', appointPlace: '新校区食堂一楼', closeReason: '', fromUserId: 44, toUserId: 1, reviewed: false },
  { orderId: 5, orderNo: 'CL20261112005', itemTitle: '可调光护眼台灯', orderStatus: 3, appointTime: '2026-11-13 12:00:00', appointPlace: '湘雅宿舍区门口', closeReason: '', fromUserId: 45, toUserId: 1, reviewed: false },
]

const activities = [
  { activityId: 1, title: '毕业季闲置清仓专场', campus: '本部', location: '本部二食堂前广场', startTime: '2026-12-01 09:00:00', endTime: '2026-12-01 17:00:00', quota: 120, remainQuota: 87, creatorId: 2, status: 1, description: '集中收揽毕业生闲置，现场换物与公益捐赠同步进行。', joined: false, items: [] },
  { activityId: 2, title: '新校区绿植与书籍交换日', campus: '新校区', location: '新校区图书馆中庭', startTime: '2026-11-25 10:00:00', endTime: '2026-11-25 16:00:00', quota: 80, remainQuota: 24, creatorId: 2, status: 1, description: '带一盆绿植或一本书来，换走你需要的。', joined: true, items: [] },
  { activityId: 3, title: '铁道校区爱心义卖', campus: '铁道', location: '铁道校区文化广场', startTime: '2026-11-10 09:30:00', endTime: '2026-11-10 16:30:00', quota: 60, remainQuota: 0, creatorId: 3, status: 3, description: '义卖所得全部用于乡村小学图书室。', joined: false, items: [] },
]

let nextActivityId = 4
let nextJoinNo = 2001

const donations = [
  { donationId: 1, clubName: '绿源公益社', title: '旧床垫 1.9×0.9', auditStatus: 0, auditRemark: '', certificateNo: '', createTime: '2026-11-20 10:05:00', itemId: 14, remark: '已清洁，可正常使用。' },
  { donationId: 2, clubName: '绿源公益社', title: '保温杯 500ml', auditStatus: 1, auditRemark: '符合捐赠标准', certificateNo: 'DON202611160002', createTime: '2026-11-16 15:22:00', itemId: 12, remark: '' },
  { donationId: 3, clubName: '绿源公益社', title: '可调光护眼台灯', auditStatus: 2, auditRemark: '灯罩破损，建议修复后重新提交', certificateNo: '', createTime: '2026-11-11 09:40:00', itemId: 10, remark: '' },
]

const messages = [
  { notifyId: 1, createTime: '2026-11-20 19:02:00', title: '流转单待确认', content: '你收到的「大学英语四级真题集」交换申请等待接单。', isRead: false, notifyType: 'order', refId: 2 },
  { notifyId: 2, createTime: '2026-11-19 11:30:00', title: '物品审核通过', content: '你发布的「罗技 M330 静音无线鼠标」已通过审核并上架。', isRead: false, notifyType: 'audit', refId: 2 },
  { notifyId: 3, createTime: '2026-11-18 08:55:00', title: '信用分变动', content: '按时完成履约，信用分 +2。', isRead: true, notifyType: 'credit', refId: 3 },
  { notifyId: 4, createTime: '2026-11-17 20:14:00', title: '活动报名成功', content: '你已成功报名「新校区绿植与书籍交换日」。', isRead: true, notifyType: 'system', refId: 2 },
  { notifyId: 5, createTime: '2026-11-16 15:22:00', title: '捐赠凭证已生成', content: '捐赠编号 DON202611160002 的电子凭证可下载。', isRead: true, notifyType: 'system', refId: 2 },
]

const creditLogs = [
  { creditLogId: 1, createTime: '2026-11-18 08:55:00', changeValue: 2, remark: '按时完成履约', appealStatus: 0 },
  { creditLogId: 2, createTime: '2026-11-14 21:10:00', changeValue: -5, remark: '面交爽约，未在约定时间到场', appealStatus: 0 },
  { creditLogId: 3, createTime: '2026-11-09 10:02:00', changeValue: 1, remark: '捐赠物品通过审核', appealStatus: 1 },
  { creditLogId: 4, createTime: '2026-11-02 17:45:00', changeValue: 3, remark: '首次发布并完成流转', appealStatus: 0 },
]

const reviews = [
  { reviewId: 1, score: 5, content: '物品和描述一致，见面很准时。', createTime: '2026-11-18 09:20:00' },
  { reviewId: 2, score: 5, content: '沟通顺畅，推荐。', createTime: '2026-11-12 20:31:00' },
  { reviewId: 3, score: 4, content: '东西不错，就是等了一会儿。', createTime: '2026-11-05 12:08:00' },
]

const reports = [
  { reportId: 1, createTime: '2026-11-20 13:24:00', reportType: '虚假信息', reportContent: '商品描述称全新，实际有明显使用痕迹。', handleStatus: 0, reporterName: '林小满' },
  { reportId: 2, createTime: '2026-11-18 09:10:00', reportType: '联系方式', reportContent: '详情页留言中夹带外部联系方式。', handleStatus: 0, reporterName: '张一鸣' },
  { reportId: 3, createTime: '2026-11-15 16:33:00', reportType: '不当物品', reportContent: '疑似代购批量货源，与校园闲置定位不符。', handleStatus: 1, reporterName: '王思远' },
  { reportId: 4, createTime: '2026-11-10 11:02:00', reportType: '虚假信息', reportContent: '图片与实物不符。', handleStatus: 2, reporterName: '李佳' },
]

const auditLogs = [
  { logId: 1, operTime: '2026-11-20 14:05:00', operType: '物品审核', userName: '运营管理员', operDesc: '审核通过物品 2 件' },
  { logId: 2, operTime: '2026-11-20 13:41:00', operType: '工单处置', userName: '运营管理员', operDesc: '驳回工单 #4' },
  { logId: 3, operTime: '2026-11-19 10:18:00', operType: '字典维护', userName: '运营管理员', operDesc: '更新流转方式字典' },
  { logId: 4, operTime: '2026-11-18 09:02:00', operType: '用户管理', userName: '运营管理员', operDesc: '重置用户认证状态' },
  { logId: 5, operTime: '2026-11-17 16:50:00', operType: '物品审核', userName: '运营管理员', operDesc: '驳回物品 1 件' },
]

const dicts = {
  category: categories,
  condition: ['全新', '九成新', '七成新', '可用'],
  pickup: ['菜鸟驿站', '图书馆门口', '宿舍楼下', '食堂门口'],
  credit: ['按时履约 +2', '面交爽约 -5', '捐赠审核通过 +1'],
}

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
  if (path === '/recommendations') return activeItems().slice(0, 8)
  if (path === '/categories/tree') return categories

  // ---- 物品 ----
  if (path === '/items' && method === 'GET') {
    const keyword = (params.keyword || '').trim()
    let list = activeItems()
    if (params.campus) list = list.filter((item) => item.campus === params.campus)
    if (params.categoryId) list = list.filter((item) => item.categoryId === Number(params.categoryId))
    if (params.conditionLevel) list = list.filter((item) => item.conditionLevel === params.conditionLevel)
    if (params.tradeMode) list = list.filter((item) => item.tradeMode === params.tradeMode)
    if (params.minPrice) list = list.filter((item) => Number(item.price) >= Number(params.minPrice))
    if (params.maxPrice) list = list.filter((item) => Number(item.price) <= Number(params.maxPrice))
    if (keyword)
      list = list.filter((item) => (item.title + item.description).includes(keyword) || item.categoryName.includes(keyword))
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
      coverUrl: '',
      images: [],
      createTime: '2026-11-21 09:00:00',
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
      sellerNickname: publisher?.nickname,
      sellerCreditScore: publisher?.creditScore,
      viewCount: item.viewCount ?? 0,
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
  if (path === '/reports' && method === 'POST') return null

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
      Object.assign(existing, params, { skillId })
      return { skillId }
    }
    const skill = {
      skillId: nextSkillId++,
      skillType: Number(params.skillType) || 1,
      level: params.level || '入门',
      skillName: params.skillName || '',
      expectSkill: params.expectSkill || '',
      description: params.description || '',
      status: Number(params.status) || 1,
      userId: current.userId,
      complementary: params.complementary || '',
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
    const order = {
      orderId: orders.length + 1,
      orderNo: 'CL2026' + String(11210000 + orders.length + 1),
      itemTitle: items.find((item) => item.itemId === Number(params.itemId))?.title || '闲置物品',
      orderStatus: 0,
      appointTime: '',
      appointPlace: '',
      closeReason: '',
      fromUserId: current.userId,
      toUserId: 42,
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
    return { ...order, item: items.find((item) => item.title === order.itemTitle) }
  }
  if (/^\/orders\/\d+\/(confirm|cancel|verify|appointment)$/.test(path) && method === 'POST') {
    const match = path.match(/^\/orders\/(\d+)\/(\w+)$/)
    const order = orders.find((row) => row.orderId === Number(match[1]))
    if (!order) fail('流转单不存在')
    if (match[2] === 'confirm') order.orderStatus = 1
    else if (match[2] === 'cancel') {
      order.orderStatus = 4
      order.closeReason = params.closeReason || '用户取消'
    } else if (match[2] === 'verify') order.orderStatus = 3
    else if (match[2] === 'appointment') {
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
    reviews.unshift({ reviewId: reviews.length + 1, score: Number(params.score), content: params.content, createTime: '2026-11-21 10:00:00' })
    return null
  }

  // ---- 信用 ----
  if (path === '/credits/logs') return { creditScore: current.creditScore, level: '优秀', ...paginate(creditLogs, params) }
  if (path === '/credits/appeals' && method === 'POST') {
    const log = creditLogs.find((row) => row.creditLogId === Number(params.creditLogId))
    if (log) log.appealStatus = 1
    return null
  }

  // ---- 捐赠 ----
  if (path === '/donations/verify') {
    const donation = donations.find((row) => row.certificateNo === params.certificateNo)
    if (!donation) return { valid: false, certificateNo: params.certificateNo }
    return {
      valid: true,
      certificateNo: donation.certificateNo,
      itemTitle: donation.title,
      donorMasked: '林**',
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
    donations.unshift({
      donationId: donations.length + 1,
      clubName: '绿源公益社',
      title: items.find((item) => item.itemId === Number(params.itemId))?.title || '闲置物品',
      auditStatus: 0,
      auditRemark: '',
      certificateNo: '',
      createTime: '2026-11-21 10:30:00',
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
    if (params.pass) donation.certificateNo = 'DON2026' + String(11210000 + donation.donationId)
    return null
  }

  // ---- 消息 ----
  if (path === '/messages/unread-count') return { unreadCount: messages.filter((row) => !row.isRead).length }
  if (path === '/messages' && method === 'GET') {
    let list = [...messages]
    if (params.notifyType) list = list.filter((row) => row.notifyType === params.notifyType)
    if (params.isRead !== undefined && params.isRead !== '') list = list.filter((row) => row.isRead === (params.isRead === 'true' || params.isRead === true))
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
    return { remainQuota: activity.remainQuota, joinNo: nextJoinNo++ }
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
      tradeModeShare: { 以物换物: 61, 委托寄卖: 45 },
      funnel: { 发布: 128, 意向: 96, 成交: 86 },
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
    return null
  }
  if (/^\/admin\/dicts\/\w+$/.test(path) && method === 'POST') {
    const dictType = path.split('/').pop()
    if (params.op === 'list') return { dictType, list: dicts[dictType] || [] }
    return { dictType, op: params.op, payload: params.payload, updatedAt: '2026-11-21 10:45:00' }
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

function svgBlob(text) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    '<rect width="200" height="200" fill="#ffffff" stroke="#111111" stroke-width="4"/>' +
    '<text x="100" y="105" font-size="26" text-anchor="middle" fill="#111111">' +
    text +
    '</text></svg>'
  return textBlob(svg, 'image/svg+xml')
}

export async function mockFile(path) {
  if (/^\/orders\/\d+\/qrcode$/.test(path)) return svgBlob('A1B2C3')
  if (path === '/admin/dashboard/export')
    return textBlob('校区,发布时间,成交时间\n本部,2026-11-20,2026-11-20\n', 'application/vnd.ms-excel')
  if (/^\/donations\/\d+\/certificate$/.test(path)) {
    const donation = donations.find((row) => row.donationId === Number(path.match(/\d+/)[0]))
    return textBlob('校园循环 · 捐赠电子凭证\n编号：' + (donation?.certificateNo || '—') + '\n物品：' + (donation?.title || '—') + '\n', 'application/pdf')
  }
  return fail('演示数据暂未覆盖该文件接口：' + path)
}
