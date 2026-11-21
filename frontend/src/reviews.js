import { reactive } from 'vue'
import { items } from './data'

export const goodsReviews = reactive(
  [1, 2, 5, 14, 4, 15].map((id, i) => ({
    id: 'goods-' + id,
    itemId: id,
    title: items[id - 1].title,
    owner: ['张', '王', '陈', '李', '赵', '周'][i] + '同学',
    category: items[id - 1].category,
    time: ['10-26 14:20', '10-26 13:02', '10-26 11:41', '10-26 10:15', '10-25 22:03', '10-25 20:12'][i],
    status: '待审核',
  })),
)
export const clubReviews = reactive(
  [
    ['小米电热水壶 1.5L', '张', '10-26 14:20', '待审核'],
    ['冬季棉服 L 码', '李', '10-26 11:05', '待审核'],
    ['数据结构教材 + 习题册', '王', '10-25 19:40', '待审核'],
    ['羽毛球拍两支', '赵', '10-25 16:12', '已通过'],
    ['台灯（可调光）', '陈', '10-24 10:30', '已驳回'],
  ].map(([title, owner, time, status], i) => ({
    id: 'club-' + i,
    title,
    owner: owner + '同学',
    time,
    status,
  })),
)
export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
