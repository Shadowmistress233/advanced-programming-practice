export const campuses = ['本部', '新校区', '铁道', '湘雅']
export const conditions = ['全新', '九成新', '七成新', '可用']
export const itemStates = ['待审核', '在售', '锁定', '已完成', '已下架']
export const orderStates = ['待确认', '已确认', '待面交', '已完成', '已取消', '已违约']
export const pickupPoints = [
  '本部图书馆南门（有监控）',
  '三舍楼下服务点',
  '二食堂门口',
  'B栋教学楼大门口',
]
export const charityClubs = [
  {
    clubId: 2,
    clubName: '绿源公益社',
    campus: '本部',
    desc: '接收书籍、文具与生活闲置，用于校园循环与公益助学',
  },
  {
    clubId: 4,
    clubName: '读书协会',
    campus: '新校区',
    desc: '专注专业教材、考研资料与课外读物的校园漂流',
  },
]
export const reportTypes = ['虚假描述', '违禁物品', '恶意爽约', '骚扰辱骂', '积分申诉']

export function creditLevelOf(score) {
  const n = Number(score ?? 0)
  if (n >= 90) return '优秀'
  if (n >= 75) return '良好'
  if (n >= 60) return '一般'
  if (n >= 40) return '受限'
  return '观察期'
}
