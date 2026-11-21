import { reactive } from 'vue'

export const categories = ['教材资料', '数码电子', '生活用品', '运动器材', '服饰鞋包', '其他']
export const shortNames = ['教材', '数码', '生活', '运动', '服饰', '其他']
const rawItems = [
  ['考研数学一全套（李永乐）', 0, 'green', '等价教材', '本部', '9成新', '张', 96, '浏览过考研'],
  ['iPad 第 9 代 64G 深空灰', 1, 'blue', 1650, '铁道', '95新', '王', 92, '收藏过平板'],
  ['捷安特 ATX 山地车 27 速', 3, 'amber', 420, '本部', '8成新', '赵', 74, '浏览过自行车'],
  ['宿舍折叠书桌 + 台灯', 2, 'purple', '任意生活用品', '湘雅', '7成新', '周', 86, '同校区'],
  ['军训服一套 175 码（未拆封）', 4, 'pink', 30, '本部', '全新', '陈', 81, '2 分钟前'],
  ['数据结构（C 语言版）第 3 版', 0, 'slate', '算法导论', '本部', '9成新', '李', 88, '18 分钟前'],
  ['小米电热水壶 1.5L', 2, 'teal', 45, '铁道', '9成新', '陈', 81, '32 分钟前'],
  ['罗技 MX Master 3 鼠标', 1, 'blue', 260, '本部', '9成新', '孙', 90, '1 小时前'],
  ['羽毛球拍 尤尼克斯', 3, 'amber', '运动用品', '本部', '9成新', '张', 96, '2 小时前'],
  ['台灯 + 插排', 1, 'slate', 25, '本部', '9成新', '周', 86, '3 小时前'],
  ['高数教材 + 习题册', 0, 'green', '文具', '铁道', '9成新', '李', 88, '昨天'],
  ['收纳箱两只', 2, 'amber', 15, '本部', '8成新', '王', 92, '昨天'],
  ['学士服（租借）', 4, 'purple', 20, '本部', '9成新', '陈', 81, '昨天'],
  ['Java 编程思想 第 4 版', 0, 'green', '编程教材', '湘雅', '9成新', '李', 88, '昨天'],
  ['网球拍 Wilson', 3, 'amber', 90, '铁道', '7成新', '周', 74, '昨天'],
]
export const items = rawItems.map(
  ([title, category, color, price, campus, condition, owner, credit, note], i) => ({
    id: i + 1,
    title,
    category: categories[category],
    label: shortNames[category],
    color,
    price,
    method: typeof price === 'number' ? '低价寄售' : '以物易物',
    campus,
    condition,
    owner,
    credit,
    note,
  }),
)
export const itemById = (id, fallback = 1) =>
  mine.find((row) => row.item.id === Number(id))?.item ||
  items.find((item) => item.id === Number(id)) ||
  items[fallback - 1]
export const priceText = (item) =>
  typeof item.price === 'number' ? '¥' + item.price.toLocaleString('zh-CN') : '换 ' + item.price
export const skills = [
  ['李', 96, 'Java 辅导（期末冲刺）', '吉他入门 / 摄影跟拍', '学业辅导', '精通'],
  ['王', 88, '高数答疑（微积分、线代）', '英语口语陪练', '学业辅导', '熟练'],
  ['赵', 92, '摄影跟拍（毕业照）', '考研政治辅导', '生活服务', '精通'],
  ['陈', 81, '吉他入门（零基础）', 'Java 辅导', '兴趣陪练', '熟练'],
  ['周', 74, '驾照科目二陪练', '高数答疑', '生活服务', '熟练'],
  ['孙', 90, 'PPT 美化 / 答辩辅导', '摄影跟拍', '技能教学', '精通'],
].map(([name, credit, title, want, category, level], i) => ({
  id: i + 1,
  name,
  credit,
  title,
  want,
  category,
  level,
}))

export const mine = reactive(
  [1, 3, 6, 7, 2, 4, 5, 8, 9, 10, 11, 12].map((id, i) => ({
    item: items[id - 1],
    status: [
      '在售',
      '锁定中',
      '待审核',
      '已捐赠',
      '在售',
      '在售',
      '已下架',
      '在售',
      '在售',
      '在售',
      '待审核',
      '在售',
    ][i],
    views: [128, 356, 42, 88, 66, 12, 38, 59, 23, 11, 9, 32][i],
    offers: [3, 6, 0, 0, 2, 1, 0, 2, 0, 1, 0, 2][i],
  })),
)
export const sample = reactive({
  order: {
    offerId: 6,
    targetId: 1,
    message: '你好，我有数据结构第 3 版，9 成新无笔记，想换你的考研数学，本部可以面交～',
    appointment: null,
    canceled: false,
  },
  extraSkills: [
    {
      id: 7,
      name: '林',
      credit: 85,
      title: '素描基础练习',
      want: '法语口语',
      category: '兴趣陪练',
      level: '熟练',
      complementary: false,
    },
  ],
  invited: [],
  donation: null,
  draft: null,
  noticesRead: [],
  appeal: '',
  registrations: [],
})
export const messages = [
  [
    '流转',
    '你的交换意向已被李同学确认',
    '数据结构换考研数学，对方已确认，请尽快预约面交。',
    '2 分钟前',
    '/order',
  ],
  [
    '审核',
    '物品「数据结构（C 语言版）」审核通过',
    '你的物品已上架，现在可以在首页被看到。',
    '1 小时前',
    '/mine',
  ],
  ['积分', '信用分 +5', '完成一次以物易物，信用分从 91 提升到 96。', '昨天 16:35', '/credit'],
  [
    '捐赠',
    '爱心社已接收你的捐赠',
    '凭证编号 CSU202610000123，可下载电子凭证。',
    '昨天 10:26',
    '/certificate',
  ],
  ['系统', '10 月起执行新的流转规则', '超过 24 小时未核销将判定违约，请注意面交时间。', '10-01', ''],
  [
    '流转',
    '你预约的面交时间即将到来',
    '10 月 27 日 14:30 · 图书馆南门，请携带物品并出示核销码。',
    '昨天 09:00',
    '/appointment',
  ],
  [
    '审核',
    '社团已确认接收你的捐赠',
    '爱心社已完成入库，可在「我的捐赠」查看台账记录。',
    '10-25 16:40',
    '/certificate',
  ],
  ['系统', '毕业季甩卖专场开放报名', '本部南校区广场等你来。', '10-24', '/market'],
].map(([type, title, body, time, path], id) => ({ id, type, title, body, time, path }))
export const statusColor = (status) =>
  ({
    在售: 'mint',
    已通过: 'mint',
    已捐赠: 'violet',
    锁定中: 'sky',
    待审核: 'gold',
    已驳回: 'rose',
    流转: 'mint',
    审核: 'sky',
    积分: 'gold',
    捐赠: 'violet',
    系统: 'violet',
  })[status] || ''
